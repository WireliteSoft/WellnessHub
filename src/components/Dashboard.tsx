// src/components/Dashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Activity, HeartPulse, FlameKindling, Clock, TrendingUp } from "lucide-react";

type WorkoutRow = {
  id: string;
  name: string;
  type: "cardio" | "strength" | "flexibility" | "balance" | "other";
  duration_min: number;
  intensity: "low" | "moderate" | "high";
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

type GlucoseRow = {
  id: string;
  mg_dl: number;
  reading_time: string; // ISO
  meal_context?: "fasting" | "pre-meal" | "post-meal" | "bedtime" | "other" | null;
  notes?: string | null;
};

function authHeaders() {
  const t = typeof window !== "undefined" ? localStorage.getItem("auth:token") : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function startOfWeek(d = new Date()) {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=Sun..
  const diff = (day + 6) % 7; // make Monday the start (adjust as desired)
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function fmtDate(s?: string) {
  if (!s) return "";
  const d = new Date(s);
  return d.toLocaleString();
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const displayName = user?.name?.trim() || user?.email || "Welcome";

  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [glucose, setGlucose] = useState<GlucoseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Load real data
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const [wRes, gRes] = await Promise.all([
          fetch("/api/workouts", { headers: { ...authHeaders() } }),
          fetch("/api/glucose", { headers: { ...authHeaders() } }),
        ]);

        if (!wRes.ok) throw new Error(`GET /api/workouts ${wRes.status}`);
        if (!gRes.ok) throw new Error(`GET /api/glucose ${gRes.status}`);

        const wRows: WorkoutRow[] = await wRes.json();
        const gRows: GlucoseRow[] = await gRes.json();

        setWorkouts(Array.isArray(wRows) ? wRows : []);
        setGlucose(Array.isArray(gRows) ? gRows : []);
      } catch (e: any) {
        console.error(e);
        setErr("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Derived stats
  const {
    workoutsThisWeek,
    minutesThisWeek,
    lastWorkout,
    avgGlucose14d,
    inRangePct14d,
    lastGlucose,
  } = useMemo(() => {
    const now = new Date();
    const sow = startOfWeek(now);
    const wThisWeek = workouts.filter((w) => {
      const t = w.created_at ? new Date(w.created_at) : null;
      return t ? t >= sow : false;
    });
    const minThisWeek = wThisWeek.reduce((sum, w) => sum + (Number(w.duration_min) || 0), 0);
    const lastW = [...workouts].sort((a, b) => {
      const ta = a.created_at ? +new Date(a.created_at) : 0;
      const tb = b.created_at ? +new Date(b.created_at) : 0;
      return tb - ta;
    })[0];

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const g14 = glucose.filter((g) => new Date(g.reading_time) >= cutoff);
    const avg = g14.length ? Math.round(g14.reduce((s, r) => s + r.mg_dl, 0) / g14.length) : null;
    const inRange = g14.length ? Math.round((g14.filter((r) => r.mg_dl >= 70 && r.mg_dl <= 180).length / g14.length) * 100) : null;

    const lastG = [...glucose].sort((a, b) => +new Date(b.reading_time) - +new Date(a.reading_time))[0];

    return {
      workoutsThisWeek: wThisWeek.length,
      minutesThisWeek: minThisWeek,
      lastWorkout: lastW,
      avgGlucose14d: avg,
      inRangePct14d: inRange,
      lastGlucose: lastG,
    };
  }, [workouts, glucose]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-emerald-500 to-blue-600 p-2 rounded-lg shadow-md">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Hey, {displayName.split("@")[0]}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Your wellness snapshot, based on your real data.
            </p>
            {err && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{err}</p>}
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Workouts this week</span>
            <FlameKindling className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {loading ? "…" : workoutsThisWeek}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Active minutes (week)</span>
            <Clock className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {loading ? "…" : minutesThisWeek}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Avg glucose (14d)</span>
            <HeartPulse className="h-5 w-5 text-rose-500" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {loading ? "…" : (avgGlucose14d ?? "—")}
            <span className="text-base font-normal text-gray-500 dark:text-gray-400 ml-2">mg/dL</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            In range (70–180): {loading ? "…" : (inRangePct14d === null ? "—" : `${inRangePct14d}%`)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Last reading</span>
            <TrendingUp className="h-5 w-5 text-violet-500" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {loading || !lastGlucose ? "—" : lastGlucose.mg_dl}
            <span className="text-base font-normal text-gray-500 dark:text-gray-400 ml-2">mg/dL</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {loading || !lastGlucose ? "" : fmtDate(lastGlucose.reading_time)}
          </p>
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent activity</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Latest workouts and glucose logs.
          </p>
        </div>

        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {/* Show up to 10 combined items */}
          {(() => {
            // Normalize to one list with a timestamp
            const items: { when: string; node: React.ReactNode; key: string }[] = [];

            workouts.slice(0, 10).forEach((w) => {
              const when = w.created_at ?? w.updated_at ?? new Date().toISOString();
              items.push({
                key: "w-" + w.id,
                when,
                node: (
                  <li className="p-5 flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-2 rounded-lg">
                        <Activity className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Workout: {w.name} · {w.duration_min} min · {w.intensity}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {fmtDate(when)}
                        </p>
                      </div>
                    </div>
                  </li>
                ),
              });
            });

            glucose.slice(0, 10).forEach((g) => {
              items.push({
                key: "g-" + g.id,
                when: g.reading_time,
                node: (
                  <li className="p-5 flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="bg-rose-500/10 text-rose-600 dark:text-rose-400 p-2 rounded-lg">
                        <HeartPulse className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Glucose: {g.mg_dl} mg/dL {g.meal_context ? `· ${g.meal_context}` : ""}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {fmtDate(g.reading_time)}
                        </p>
                      </div>
                    </div>
                  </li>
                ),
              });
            });

            // Sort newest first and take top 10 mixed
            items.sort((a, b) => +new Date(b.when) - +new Date(a.when));
            return items.slice(0, 10).map((it) => <React.Fragment key={it.key}>{it.node}</React.Fragment>);
          })()}
        </ul>

        <div className="p-4 text-right">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Data updates when you log a workout or glucose reading.
          </span>
        </div>
      </div>

      {/* Last workout quick summary */}
      {lastWorkout && (
        <div className="mt-8 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">Last workout</h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {lastWorkout.name} · {lastWorkout.duration_min} minutes · {lastWorkout.intensity} · {fmtDate(lastWorkout.created_at)}
          </p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
