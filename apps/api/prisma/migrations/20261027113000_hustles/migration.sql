BEGIN;
ALTER TYPE "WalletTransactionType" ADD VALUE 'HUSTLE_REWARD';
ALTER TYPE "WalletTransactionType" ADD VALUE 'HUSTLE_LOSS';
CREATE TYPE "HustleOutcome" AS ENUM ('BIG_WIN','SUCCESS','PARTIAL_SUCCESS','FAILURE','DISASTER');
CREATE FUNCTION valid_hustle_profile(p jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE k text; e jsonb; total integer:=0;
BEGIN
 IF jsonb_typeof(p)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(p))<>5 THEN RETURN false; END IF;
 FOREACH k IN ARRAY ARRAY['BIG_WIN','SUCCESS','PARTIAL_SUCCESS','FAILURE','DISASTER'] LOOP
  e:=p->k;
  IF e IS NULL OR jsonb_typeof(e)<>'object' THEN RETURN false; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(e))<>2 OR NOT e ?& ARRAY['weight','xp'] THEN RETURN false; END IF;
  IF jsonb_typeof(e->'weight')<>'number' OR jsonb_typeof(e->'xp')<>'number' OR (e->>'weight')!~'^[0-9]{1,5}$' OR (e->>'xp')!~'^[0-9]{1,4}$' THEN RETURN false; END IF;
  IF (e->>'weight')::integer>10000 OR (e->>'xp')::integer>1350 THEN RETURN false; END IF;
  total:=total+(e->>'weight')::integer;
 END LOOP;
 RETURN total=10000;
END $$;
CREATE TABLE hustles (
 id uuid PRIMARY KEY, code varchar(64) NOT NULL UNIQUE, name varchar(80) NOT NULL, description text NOT NULL, location_label varchar(120) NOT NULL,
 tier integer NOT NULL CHECK(tier BETWEEN 1 AND 5), entry_cost bigint NOT NULL DEFAULT 0 CHECK(entry_cost>=0), reward_min bigint NOT NULL CHECK(reward_min>0), reward_max bigint NOT NULL CHECK(reward_max>=reward_min),
 disaster_loss bigint NOT NULL DEFAULT 0 CHECK(disaster_loss>=0), outcome_profile jsonb NOT NULL CHECK(valid_hustle_profile(outcome_profile)),
 base_success_bps integer GENERATED ALWAYS AS ((outcome_profile->'SUCCESS'->>'weight')::integer) STORED,
 risk_label varchar(16) NOT NULL CHECK(risk_label IN ('LOW','MEDIUM','HIGH','VERY HIGH','EXTREME')),
 energy_cost integer NOT NULL CHECK(energy_cost BETWEEN 1 AND 100),
 stress_min integer NOT NULL DEFAULT 0 CHECK(stress_min=0), stress_max integer NOT NULL DEFAULT 0 CHECK(stress_max=0),
 heat_min integer NOT NULL DEFAULT 0 CHECK(heat_min BETWEEN 0 AND 100), heat_max integer NOT NULL DEFAULT 0 CHECK(heat_max BETWEEN heat_min AND 100),
 reputation_min integer NOT NULL DEFAULT 0 CHECK(reputation_min>=0), reputation_max integer NOT NULL DEFAULT 0 CHECK(reputation_max>=reputation_min),
 required_reputation bigint NOT NULL DEFAULT 0 CHECK(required_reputation>=0),
 required_skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT, required_skill_level integer NOT NULL CHECK(required_skill_level BETWEEN 1 AND 10),
 cooldown_seconds integer NOT NULL CHECK(cooldown_seconds BETWEEN 0 AND 86400), future_requirement varchar(160), is_active boolean NOT NULL DEFAULT true,
 test_only boolean NOT NULL DEFAULT false, sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz NOT NULL,
 CHECK(entry_cost::numeric+disaster_loss::numeric<=9223372036854775807)
);
CREATE TABLE hustle_attempts (
 id uuid PRIMARY KEY, character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT, hustle_id uuid NOT NULL REFERENCES hustles(id) ON DELETE RESTRICT,
 hustle_name varchar(80) NOT NULL, tier integer NOT NULL CHECK(tier BETWEEN 1 AND 5), outcome "HustleOutcome" NOT NULL,
 entry_cost bigint NOT NULL CHECK(entry_cost>=0), reward_amount bigint NOT NULL CHECK(reward_amount>=0), loss_amount bigint NOT NULL CHECK(loss_amount>=entry_cost),
 energy_spent integer NOT NULL CHECK(energy_spent BETWEEN 1 AND 100), xp_reward bigint NOT NULL CHECK(xp_reward BETWEEN 0 AND 1350), xp_awarded bigint NOT NULL CHECK(xp_awarded BETWEEN 0 AND xp_reward),
 previous_level integer NOT NULL CHECK(previous_level BETWEEN 1 AND 10), current_level integer NOT NULL CHECK(current_level BETWEEN previous_level AND 10),
 heat_change integer NOT NULL DEFAULT 0 CHECK(heat_change=0), reputation_change bigint NOT NULL DEFAULT 0 CHECK(reputation_change=0), stress_change integer NOT NULL DEFAULT 0 CHECK(stress_change=0),
 rng_version varchar(40) NOT NULL, configuration_snapshot jsonb NOT NULL CHECK(jsonb_typeof(configuration_snapshot)='object'),
 started_at timestamptz NOT NULL, resolved_at timestamptz NOT NULL CHECK(resolved_at>=started_at), cooldown_until timestamptz NOT NULL CHECK(cooldown_until>=resolved_at),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX hustle_attempts_character_created_id_idx ON hustle_attempts(character_id,created_at DESC,id DESC);
CREATE UNIQUE INDEX one_hustle_ledger_side ON wallet_transactions(reference_id,transaction_type) WHERE reference_type='hustle_attempt';
ALTER TABLE wallet_transactions ADD CONSTRAINT hustle_ledger_shape CHECK (
 (transaction_type::text NOT IN ('HUSTLE_REWARD','HUSTLE_LOSS') OR (account='BANK' AND reference_type IS NOT DISTINCT FROM 'hustle_attempt' AND reference_id IS NOT NULL
 AND ((transaction_type::text='HUSTLE_REWARD' AND direction='CREDIT') OR (transaction_type::text='HUSTLE_LOSS' AND direction='DEBIT'))))
 AND (reference_type IS DISTINCT FROM 'hustle_attempt' OR transaction_type::text IN ('HUSTLE_REWARD','HUSTLE_LOSS'))
);
CREATE FUNCTION check_hustle_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a hustle_attempts; rewards bigint; losses bigint; bad integer;
BEGIN
 IF TG_TABLE_NAME='hustle_attempts' THEN SELECT * INTO a FROM hustle_attempts WHERE id=NEW.id;
 ELSE
  IF NEW.reference_type IS DISTINCT FROM 'hustle_attempt' THEN RETURN NULL; END IF;
  SELECT * INTO a FROM hustle_attempts WHERE id=NEW.reference_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing hustle attempt'; END IF;
 END IF;
 SELECT COALESCE(sum(amount) FILTER(WHERE transaction_type::text='HUSTLE_REWARD'),0), COALESCE(sum(amount) FILTER(WHERE transaction_type::text='HUSTLE_LOSS'),0), count(*) FILTER(WHERE character_id<>a.character_id OR account<>'BANK')
 INTO rewards,losses,bad FROM wallet_transactions WHERE reference_type='hustle_attempt' AND reference_id=a.id;
 IF rewards<>a.reward_amount OR losses<>a.loss_amount OR bad<>0 THEN RAISE EXCEPTION 'Hustle ledger mismatch'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER hustle_ledger_consistency AFTER INSERT ON hustle_attempts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_hustle_ledger();
CREATE CONSTRAINT TRIGGER ledger_hustle_consistency AFTER INSERT ON wallet_transactions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_hustle_ledger();
CREATE FUNCTION check_hustle_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s jsonb; lo bigint; hi bigint;
BEGIN
 s:=NEW.configuration_snapshot;
 IF NOT valid_hustle_profile(s->'outcomeProfile') OR NOT s ?& ARRAY['outcomeProfile','rewardMin','rewardMax','entryCost','disasterLoss','energyCost','cooldownSeconds'] THEN RAISE EXCEPTION 'Invalid hustle snapshot'; END IF;
 lo:=(s->>'rewardMin')::bigint; hi:=(s->>'rewardMax')::bigint;
 IF lo<=0 OR hi<lo OR NEW.entry_cost<>(s->>'entryCost')::bigint OR NEW.energy_spent<>(s->>'energyCost')::integer
 OR NEW.cooldown_until<>NEW.resolved_at+make_interval(secs=>(s->>'cooldownSeconds')::integer)
 OR NEW.xp_reward<>(s->'outcomeProfile'->NEW.outcome::text->>'xp')::bigint
 OR NEW.loss_amount<>NEW.entry_cost+(CASE WHEN NEW.outcome='DISASTER' THEN (s->>'disasterLoss')::bigint ELSE 0 END) THEN RAISE EXCEPTION 'Hustle terms mismatch'; END IF;
 IF (NEW.outcome IN ('FAILURE','DISASTER') AND NEW.reward_amount<>0) OR (NEW.outcome NOT IN ('FAILURE','DISASTER') AND NEW.reward_amount NOT BETWEEN lo AND hi) THEN RAISE EXCEPTION 'Invalid hustle reward'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hustle_snapshot_valid BEFORE INSERT ON hustle_attempts FOR EACH ROW EXECUTE FUNCTION check_hustle_snapshot();
CREATE FUNCTION protect_hustle_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Resolved hustle attempts are immutable'; END $$;
CREATE TRIGGER protect_hustle_attempt BEFORE UPDATE OR DELETE ON hustle_attempts FOR EACH ROW EXECUTE FUNCTION protect_hustle_attempt();
CREATE TRIGGER protect_hustle_truncate BEFORE TRUNCATE ON hustle_attempts FOR EACH STATEMENT EXECUTE FUNCTION protect_hustle_attempt();
COMMIT;
