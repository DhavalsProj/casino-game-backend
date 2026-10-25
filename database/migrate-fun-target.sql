CREATE TABLE IF NOT EXISTS fun_target_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1), game_name varchar NOT NULL DEFAULT 'Fun Target',
  min_bet numeric(15,2) NOT NULL DEFAULT 1.00 CHECK (min_bet > 0), max_bet numeric(15,2) NOT NULL DEFAULT 5000.00 CHECK (max_bet >= min_bet AND max_bet <= 5000),
  denominations jsonb NOT NULL DEFAULT '[1,5,10,50,100,500,1000,5000]'::jsonb, denomination_restrictions boolean NOT NULL DEFAULT true,
  result_mode varchar NOT NULL DEFAULT 'MANUAL' CHECK (result_mode IN ('MANUAL','RANDOM')), joker_enabled boolean NOT NULL DEFAULT false,
  joker_multiplier integer NOT NULL DEFAULT 2 CHECK (joker_multiplier > 0), joker_frequency integer NOT NULL DEFAULT 5 CHECK (joker_frequency > 0),
  admin_share_percent numeric(5,2) NOT NULL DEFAULT 60 CHECK (admin_share_percent BETWEEN 0 AND 100),
  winning_allocation_percent numeric(5,2) NOT NULL DEFAULT 40 CHECK (winning_allocation_percent BETWEEN 0 AND 100), active boolean NOT NULL DEFAULT true,
  created_by integer, updated_by integer, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (admin_share_percent + winning_allocation_percent = 100)
);
CREATE TABLE IF NOT EXISTS fun_target_rounds (
  id serial PRIMARY KEY, status varchar NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING','OPEN','CLOSED','COMPLETED')),
  scheduled_at timestamptz NOT NULL UNIQUE, opened_at timestamptz, closed_at timestamptz,
  result_mode varchar NOT NULL CHECK (result_mode IN ('MANUAL','RANDOM')), joker_enabled boolean NOT NULL DEFAULT false,
  joker_multiplier integer NOT NULL DEFAULT 1 CHECK (joker_multiplier > 0), winning_number integer CHECK (winning_number BETWEEN 1 AND 9),
  result_generated_by integer, result_generated_at timestamptz, finalized_by integer, finalized_at timestamptz,
  created_by integer, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fun_target_bets (
  id serial PRIMARY KEY, round_id integer NOT NULL REFERENCES fun_target_rounds(id), user_id integer NOT NULL REFERENCES "Users"(id),
  number integer NOT NULL CHECK (number BETWEEN 1 AND 9), amount numeric(15,2) NOT NULL CHECK (amount > 0),
  idempotency_key varchar(100) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_fun_target_bets_round_number ON fun_target_bets(round_id,number);
CREATE TABLE IF NOT EXISTS fun_target_joker_schedules (
  id serial PRIMARY KEY, round_id integer NOT NULL UNIQUE REFERENCES fun_target_rounds(id), multiplier integer NOT NULL CHECK (multiplier > 0),
  active boolean NOT NULL DEFAULT true, created_by integer, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fun_target_result_audit (
  id serial PRIMARY KEY, round_id integer NOT NULL REFERENCES fun_target_rounds(id), actor_id integer NOT NULL,
  action varchar(30) NOT NULL, winning_number integer CHECK (winning_number BETWEEN 1 AND 9), created_at timestamptz NOT NULL DEFAULT now()
);
