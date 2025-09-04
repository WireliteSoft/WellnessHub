// functions/api/admin/recipes/import.ts
// POST /api/admin/recipes/import
// Body: { url: string, limit?: number }
// Accepts ThemealDB "lookup" or "search" URLs and upserts recipes.

import type { PagesFunction } from "@cloudflare/workers-types";
import { requireUser, requireAdmin } from "../../../_utils/auth";

// ---- helpers ---------------------------------------------------------------

function safeJson<T = any>(text: string): T | null {
  try { return JSON.parse(text); } catch { return null; }
}

function mapMealToCategory(strCategory?: string): "breakfast" | "lunch" | "dinner" | "snack" | "other" {
  const c = (strCategory || "").toLowerCase();
  if (c.includes("breakfast")) return "breakfast";
  if (c.includes("dessert"))   return "snack";
  // lean default
  return "dinner";
}

function splitInstructions(s?: string): string[] {
  if (!s) return [];
  // ThemealDB uses \r\n lines (sometimes with blanks)
  return s
    .split(/\r?\n+/)
    .map(t => t.trim())
    .filter(Boolean);
}

// Extract up to 20 ingredient/measure fields from ThemealDB meal row
function extractIngredients(meal: any): Array<{ name: string; quantity?: string; pos: number }> {
  const out: Array<{ name: string; quantity?: string; pos: number }> = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] || "").trim();
    const qty  = (meal[`strMeasure${i}`]    || "").trim();
    if (!name) continue;
    out.push({ name, quantity: qty || undefined, pos: out.length + 1 });
  }
  return out;
}

// ---- handler ---------------------------------------------------------------

export const onRequestPost: PagesFunction = async ({ env, request }) => {
  // auth identical to users endpoint (but we guard against throwing Responses)
  let user: any;
  try {
    user = await requireUser(env as any, request);
  } catch (err: any) {
    // If your requireUser throws a Response, pass it through.
    if (err instanceof Response) return err;
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    requireAdmin(user);
  } catch (err: any) {
    if (err instanceof Response) return err;
    return new Response("Forbidden", { status: 403 });
  }

  // parse input
  let body: { url?: string; limit?: number } | null = null;
  try {
    body = await request.json();
  } catch {}
  const url = body?.url?.trim();
  const limit = Math.max(0, Math.min(50, Number(body?.limit || 0))); // cap imports to be safe

  if (!url) {
    return new Response(JSON.stringify({ ok: false, error: "Missing 'url' in body" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  // Only ThemealDB is supported in this importer
  const isMealDb = /themealdb\.com\/api\/json\/v1\/1\//i.test(url);
  if (!isMealDb) {
    return new Response(JSON.stringify({ ok: false, error: "Only ThemealDB URLs are supported by this importer." }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  // fetch external
  let ext: Response;
  try {
    ext = await fetch(url, { cf: { cacheTtl: 60, cacheEverything: false } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: "Upstream fetch failed", detail: String(e) }), {
      status: 502, headers: { "content-type": "application/json" },
    });
  }
  if (!ext.ok) {
    return new Response(JSON.stringify({ ok: false, error: "Upstream returned non-200", status: ext.status }), {
      status: 502, headers: { "content-type": "application/json" },
    });
  }

  const text = await ext.text();
  const json = safeJson<any>(text);
  if (!json) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON from upstream" }), {
      status: 502, headers: { "content-type": "application/json" },
    });
  }

  // ThemealDB shape: { meals: Meal[] | null }
  const meals: any[] = Array.isArray(json.meals) ? json.meals : [];
  if (meals.length === 0) {
    return new Response(JSON.stringify({ ok: true, succeeded: 0, failed: 0, inserted: 0, updated: 0, results: [] }), {
      headers: { "content-type": "application/json" },
    });
  }

  const max = limit > 0 ? Math.min(limit, meals.length) : meals.length;

  const results: Array<{ external_id: string; ok: boolean; id?: string; created?: boolean; error?: string }> = [];
  let inserted = 0;
  let updated = 0;

  try {
    // Process each meal one-by-one (each in its own atomic batch)
    for (let idx = 0; idx < max; idx++) {
      const meal = meals[idx];
      const external_source = "themealdb";
      const external_id = String(meal.idMeal || "").trim();
      if (!external_id) {
        results.push({ external_id: "(missing)", ok: false, error: "No idMeal" });
        continue;
      }

      // Convert ThemealDB -> our schema
      const category = mapMealToCategory(meal.strCategory);
      const title = (meal.strMeal || "Untitled").trim();
      const description = (meal.strArea ? `${meal.strArea} • ` : "") + (meal.strCategory || "");
      const image = (meal.strMealThumb || "").trim() || null;
      const steps = splitInstructions(meal.strInstructions);
      const ings = extractIngredients(meal);

      // Look up existing by external key
      const existing = await env.DB
        .prepare("SELECT id FROM recipes WHERE external_source=? AND external_id=? LIMIT 1")
        .bind(external_source, external_id)
        .first<{ id: string }>();

      const rid = existing?.id || crypto.randomUUID();

      const stmts: D1PreparedStatement[] = [];

      if (existing?.id) {
        // update core record
        stmts.push(
          env.DB.prepare(
            `UPDATE recipes
               SET title=?, category=?, description=?, image_url=?, updated_at=datetime('now')
             WHERE id=?`
          ).bind(title, category, description, image, rid)
        );
        // clear children and nutrition (ThemealDB has no macros we trust)
        stmts.push(env.DB.prepare("DELETE FROM recipe_ingredients WHERE recipe_id=?").bind(rid));
        stmts.push(env.DB.prepare("DELETE FROM recipe_steps       WHERE recipe_id=?").bind(rid));
        stmts.push(env.DB.prepare("DELETE FROM recipe_nutrition   WHERE recipe_id=?").bind(rid));
      } else {
        // insert new
        stmts.push(
          env.DB.prepare(
            `INSERT INTO recipes
              (id, title, category, description, image_url, created_by,
               is_public, published, created_at, updated_at,
               external_source, external_id)
             VALUES (?,?,?,?,?,?, 1,1, datetime('now'), datetime('now'), ?,?)`
          ).bind(
            rid, title, category, description, image, user.id,
            external_source, external_id
          )
        );
      }

      // nutrition: ThemealDB doesn't provide macros we can trust. Insert zeros (optional).
      stmts.push(
        env.DB.prepare(
          "INSERT INTO recipe_nutrition (recipe_id, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg) VALUES (?,?,?,?,?,?,?,?)"
        ).bind(rid, 0, 0, 0, 0, 0, 0, 0)
      );

      // ingredients
      for (const ing of ings) {
        stmts.push(
          env.DB
            .prepare("INSERT INTO recipe_ingredients (id, recipe_id, name, quantity, position) VALUES (?,?,?,?,?)")
            .bind(crypto.randomUUID(), rid, ing.name, ing.quantity ?? null, ing.pos)
        );
      }

      // steps
      for (let i = 0; i < steps.length; i++) {
        stmts.push(
          env.DB
            .prepare("INSERT INTO recipe_steps (id, recipe_id, step_no, text) VALUES (?,?,?,?)")
            .bind(crypto.randomUUID(), rid, i + 1, steps[i])
        );
      }

      // execute atomically
      await env.DB.batch(stmts);

      if (existing?.id) {
        updated++;
        results.push({ external_id, ok: true, id: rid, created: false });
      } else {
        inserted++;
        results.push({ external_id, ok: true, id: rid, created: true });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, succeeded: inserted + updated, failed: results.filter(r => !r.ok).length, inserted, updated, results }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    // Never leak an exception -> front-end (prevents 500 bubble)
    return new Response(JSON.stringify({ ok: false, error: "Server error", detail: String(e) }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
};
