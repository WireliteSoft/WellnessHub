PRAGMA foreign_keys = ON;

-- =========
-- Accounts
-- =========
CREATE TABLE users (
  id                    TEXT PRIMARY KEY,                         -- UUID
  email                 TEXT NOT NULL UNIQUE,
  name                  TEXT,
  -- Auth identity (use if you roll your own or mirror external IdP)
  password_hash         TEXT,
  auth_provider         TEXT,                                      -- 'email','oauth','access', etc.
  auth_subject          TEXT,                                      -- IdP subject (sub)
  -- Roles
  is_admin              INTEGER NOT NULL DEFAULT 0,                -- 0/1
  is_nutritionist       INTEGER NOT NULL DEFAULT 0,                -- 0/1
  -- Billing identity (PSP customer)
  billing_email         TEXT,
  billing_provider      TEXT,                                      -- e.g. 'stripe'
  billing_customer_id   TEXT,                                      -- PSP customer id
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_users_admin           ON users(is_admin);
CREATE INDEX idx_users_nutritionist    ON users(is_nutritionist);
CREATE INDEX idx_users_billing_lookup  ON users(billing_provider, billing_customer_id);

-- Simple auth sessions (optional if you use managed auth)
CREATE TABLE auth_sessions (
  id          TEXT PRIMARY KEY,              -- UUID
  user_id     TEXT NOT NULL,
  issued_at   TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);

-- =================
-- Admin-owned data
-- =================
-- Recipes replace mock data; created by admins; public by default
CREATE TABLE recipes (
  id          TEXT PRIMARY KEY,              -- UUID
  title       TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('breakfast','lunch','dinner','snack','other')),
  description TEXT,
  image_url   TEXT,
  created_by  TEXT NOT NULL,                 -- users.id (admin)
  is_public   INTEGER NOT NULL DEFAULT 1,    -- visible to all
  published   INTEGER NOT NULL DEFAULT 1,    -- listed in Nutrition
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_recipes_category  ON recipes(category);
CREATE INDEX idx_recipes_published ON recipes(published);
CREATE INDEX idx_recipes_public    ON recipes(is_public);

CREATE TABLE recipe_ingredients (
  id         TEXT PRIMARY KEY,               -- UUID
  recipe_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  quantity   TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);

CREATE TABLE recipe_nutrition (
  recipe_id  TEXT PRIMARY KEY,
  calories   INTEGER NOT NULL DEFAULT 0,
  protein_g  REAL    NOT NULL DEFAULT 0,
  carbs_g    REAL    NOT NULL DEFAULT 0,
  fat_g      REAL    NOT NULL DEFAULT 0,
  fiber_g    REAL    NOT NULL DEFAULT 0,
  sugar_g    REAL    NOT NULL DEFAULT 0,
  sodium_mg  INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE recipe_steps (
  id         TEXT PRIMARY KEY,               -- UUID
  recipe_id  TEXT NOT NULL,
  step_no    INTEGER NOT NULL,
  text       TEXT NOT NULL,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX uq_recipe_steps_order ON recipe_steps(recipe_id, step_no);

-- ======================
-- Per-user private data
-- ======================
CREATE TABLE workouts (
  id             TEXT PRIMARY KEY,           -- UUID
  user_id        TEXT NOT NULL,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('cardio','strength','flexibility','balance','other')),
  duration_min   INTEGER NOT NULL DEFAULT 0,
  intensity      TEXT NOT NULL CHECK (intensity IN ('low','moderate','high')),
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_workouts_user ON workouts(user_id);
CREATE INDEX idx_workouts_type ON workouts(type);

CREATE TABLE workout_sessions (
  id                 TEXT PRIMARY KEY,       -- UUID
  user_id            TEXT NOT NULL,
  workout_id         TEXT,                   -- nullable if ad-hoc
  started_at         TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at       TEXT,
  status             TEXT NOT NULL CHECK (status IN ('started','paused','completed','abandoned')),
  actual_duration_s  INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE SET NULL
);
CREATE INDEX idx_workout_sessions_user    ON workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_workout ON workout_sessions(workout_id);

CREATE TABLE goals (
  id             TEXT PRIMARY KEY,           -- UUID
  user_id        TEXT NOT NULL,
  title          TEXT NOT NULL,
  target_value   REAL NOT NULL,
  unit           TEXT NOT NULL,              -- 'workouts','kg','kcal','steps', etc.
  current_value  REAL NOT NULL DEFAULT 0,
  due_date       TEXT,
  status         TEXT NOT NULL CHECK (status IN ('active','completed','archived')) DEFAULT 'active',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_goals_user   ON goals(user_id);
CREATE INDEX idx_goals_status ON goals(status);

CREATE TABLE goal_progress (
  id         TEXT PRIMARY KEY,               -- UUID
  goal_id    TEXT NOT NULL,
  delta      REAL NOT NULL,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
);
CREATE INDEX idx_goal_progress_goal ON goal_progress(goal_id);

CREATE TABLE glucose_readings (
  id           TEXT PRIMARY KEY,             -- UUID
  user_id      TEXT NOT NULL,
  mg_dl        REAL NOT NULL,
  reading_time TEXT NOT NULL,                -- ISO datetime
  meal_context TEXT CHECK (meal_context IN ('fasting','pre-meal','post-meal','bedtime','other')),
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_glucose_user_time ON glucose_readings(user_id, reading_time);

CREATE TABLE health_measurements (
  id           TEXT PRIMARY KEY,             -- UUID
  user_id      TEXT NOT NULL,
  metric       TEXT NOT NULL CHECK (metric IN ('weight_kg','bodyfat_pct','systolic_mmHg','diastolic_mmHg','resting_hr_bpm','sleep_hours','steps','kcal_intake')),
  value_num    REAL,
  value_text   TEXT,
  taken_at     TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_health_user_metric_time ON health_measurements(user_id, metric, taken_at);

CREATE TABLE activity_log (
  id         TEXT PRIMARY KEY,               -- UUID
  user_id    TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('workout_completed','goal_progress','glucose_added','recipe_created')),
  ref_id     TEXT,                           -- pointer to related row
  meta_json  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_activity_user_time ON activity_log(user_id, created_at);

-- ==========================
-- Paid chat (conversations)
-- ==========================
CREATE TABLE chat_conversations (
  id               TEXT PRIMARY KEY,         -- UUID
  customer_id      TEXT NOT NULL,            -- users.id (payer)
  nutritionist_id  TEXT,                     -- users.id (assigned pro)
  subject          TEXT,
  status           TEXT NOT NULL CHECK (status IN ('open','awaiting_payment','assigned','closed')) DEFAULT 'open',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id)     REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (nutritionist_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_chat_conv_customer ON chat_conversations(customer_id, created_at);
CREATE INDEX idx_chat_conv_nutri    ON chat_conversations(nutritionist_id, created_at);
CREATE INDEX idx_chat_conv_status   ON chat_conversations(status);

CREATE TABLE chat_messages (
  id               TEXT PRIMARY KEY,         -- UUID
  conversation_id  TEXT NOT NULL,
  sender_id        TEXT NOT NULL,            -- users.id
  role             TEXT NOT NULL CHECK (role IN ('user','nutritionist','system')),
  content          TEXT NOT NULL,
  attachment_url   TEXT,
  metadata_json    TEXT,
  sent_at          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id)       REFERENCES users(id)             ON DELETE CASCADE
);
CREATE INDEX idx_chat_msg_conv_time ON chat_messages(conversation_id, sent_at);

CREATE TABLE chat_reads (
  id              TEXT PRIMARY KEY,          -- UUID
  conversation_id TEXT NOT NULL,
  message_id      TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  read_at         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id)      REFERENCES chat_messages(id)      ON DELETE CASCADE,
  FOREIGN KEY (user_id)         REFERENCES users(id)              ON DELETE CASCADE
);
CREATE UNIQUE INDEX uq_chat_reads ON chat_reads(message_id, user_id);

-- Optional time-based sessions (for metered billing)
CREATE TABLE chat_sessions (
  id                   TEXT PRIMARY KEY,     -- UUID
  conversation_id      TEXT NOT NULL,
  started_at           TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at             TEXT,
  duration_sec         INTEGER,
  billable_sec         INTEGER,
  rate_cents_per_min   INTEGER,
  amount_cents         INTEGER,
  status               TEXT NOT NULL CHECK (status IN ('open','billed','void')) DEFAULT 'open',
  invoice_id           TEXT,                 -- link once billed
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
);
CREATE INDEX idx_chat_sessions_conv ON chat_sessions(conversation_id, started_at);
CREATE INDEX idx_chat_sessions_inv  ON chat_sessions(invoice_id);

-- ==========================
-- Billing (plans/subs/invoices/payments/refunds/ledger)
-- ==========================
CREATE TABLE plans (
  id             TEXT PRIMARY KEY,           -- e.g. 'chat-monthly'
  name           TEXT NOT NULL,
  price_cents    INTEGER NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'usd',
  interval       TEXT NOT NULL CHECK (interval IN ('one_time','month','year','minute')),
  active         INTEGER NOT NULL DEFAULT 1,
  metadata_json  TEXT
);

CREATE TABLE subscriptions (
  id                        TEXT PRIMARY KEY,
  user_id                   TEXT NOT NULL,
  plan_id                   TEXT NOT NULL,
  status                    TEXT NOT NULL CHECK (status IN ('trialing','active','past_due','canceled','incomplete','incomplete_expired','paused')) DEFAULT 'active',
  current_period_start      TEXT,
  current_period_end        TEXT,
  cancel_at                 TEXT,
  canceled_at               TEXT,
  provider                  TEXT,                  -- PSP name
  provider_subscription_id  TEXT,                  -- PSP sub id
  created_at                TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id)  REFERENCES plans(id) ON DELETE RESTRICT
);
CREATE INDEX idx_subs_user      ON subscriptions(user_id, status);
CREATE INDEX idx_subs_provider  ON subscriptions(provider, provider_subscription_id);

CREATE TABLE invoices (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('draft','open','paid','void','uncollectible')) DEFAULT 'open',
  currency           TEXT NOT NULL DEFAULT 'usd',
  amount_due_cents   INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents  INTEGER NOT NULL DEFAULT 0,
  period_start       TEXT,
  period_end         TEXT,
  due_date           TEXT,
  provider           TEXT,
  provider_invoice_id TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_invoices_user_status ON invoices(user_id, status);

CREATE TABLE payments (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL,
  invoice_id            TEXT,                   -- nullable for standalone charges
  provider              TEXT NOT NULL,          -- 'stripe', etc.
  provider_payment_id   TEXT,
  amount_cents          INTEGER NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'usd',
  status                TEXT NOT NULL CHECK (status IN ('requires_method','requires_confirmation','processing','succeeded','failed','canceled','refunded')) DEFAULT 'processing',
  description           TEXT,
  idempotency_key       TEXT,
  metadata_json         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
);
CREATE INDEX idx_payments_user_time ON payments(user_id, created_at);
CREATE INDEX idx_payments_invoice   ON payments(invoice_id);
CREATE UNIQUE INDEX uq_payments_idem ON payments(idempotency_key);

CREATE TABLE refunds (
  id                   TEXT PRIMARY KEY,
  payment_id           TEXT NOT NULL,
  provider             TEXT,
  provider_refund_id   TEXT,
  amount_cents         INTEGER NOT NULL,       -- positive here; ledger will use direction
  status               TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed','canceled')) DEFAULT 'pending',
  reason               TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);
CREATE INDEX idx_refunds_payment ON refunds(payment_id);

CREATE TABLE ledger_entries (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('debit','credit')),  -- debit: user owes/you earn; credit: refund/relief
  amount_cents  INTEGER NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'usd',
  source_type   TEXT NOT NULL CHECK (source_type IN ('payment','refund','invoice','chat_session','adjustment')),
  source_id     TEXT NOT NULL,                                         -- free pointer (can reference multiple tables)
  occurred_at   TEXT NOT NULL DEFAULT (datetime('now')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_ledger_user_time ON ledger_entries(user_id, occurred_at);
CREATE INDEX idx_ledger_source    ON ledger_entries(source_type, source_id);

CREATE VIEW user_balances AS
SELECT user_id,
       COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount_cents ELSE -amount_cents END), 0) AS balance_cents
FROM ledger_entries
GROUP BY user_id;
