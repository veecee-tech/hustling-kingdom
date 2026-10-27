BEGIN;
ALTER TYPE "WalletTransactionType" ADD VALUE 'JOB_SALARY';
CREATE TYPE "JobAssignmentStatus" AS ENUM ('ACTIVE','COMPLETED','CANCELLED','EXPIRED');
CREATE TABLE jobs (
 id uuid PRIMARY KEY, code varchar(64) NOT NULL UNIQUE, name varchar(80) NOT NULL,
 description text NOT NULL, location_label varchar(120) NOT NULL,
 base_reward bigint NOT NULL CHECK (base_reward > 0), energy_cost integer NOT NULL CHECK (energy_cost BETWEEN 1 AND 100),
 stress_change integer NOT NULL DEFAULT 0 CHECK (stress_change = 0),
 cooldown_seconds integer NOT NULL CHECK (cooldown_seconds BETWEEN 1 AND 86400),
 reputation_required bigint NOT NULL DEFAULT 0 CHECK (reputation_required >= 0),
 future_requirement varchar(160), is_active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz NOT NULL
);
CREATE TABLE job_assignments (
 id uuid PRIMARY KEY, character_id uuid NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
 job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
 status "JobAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
 started_at timestamptz NOT NULL, completes_at timestamptz NOT NULL, completed_at timestamptz,
 base_reward bigint NOT NULL CHECK (base_reward > 0), energy_cost integer NOT NULL CHECK (energy_cost BETWEEN 1 AND 100),
 reward_amount bigint, transaction_id uuid UNIQUE REFERENCES wallet_transactions(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz NOT NULL,
 CONSTRAINT job_timing CHECK (completes_at > started_at),
 CONSTRAINT job_result CHECK (
  (status = 'COMPLETED' AND completed_at IS NOT NULL AND reward_amount IS NOT NULL AND completed_at >= completes_at AND reward_amount = base_reward AND transaction_id IS NOT NULL)
  OR (status <> 'COMPLETED' AND completed_at IS NULL AND reward_amount IS NULL AND transaction_id IS NULL)
 )
);
CREATE UNIQUE INDEX one_active_job_per_character ON job_assignments(character_id) WHERE status = 'ACTIVE';
CREATE INDEX job_assignments_character_id_status_idx ON job_assignments(character_id,status);
CREATE INDEX job_assignments_character_id_started_at_id_idx ON job_assignments(character_id,started_at DESC,id DESC);
CREATE UNIQUE INDEX one_salary_per_assignment ON wallet_transactions(reference_id) WHERE reference_type = 'job_assignment';
ALTER TABLE wallet_transactions ADD CONSTRAINT job_salary_shape CHECK (
 (transaction_type::text <> 'JOB_SALARY' OR (direction = 'CREDIT' AND account = 'BANK' AND reference_type IS NOT DISTINCT FROM 'job_assignment' AND reference_id IS NOT NULL))
 AND (reference_type IS DISTINCT FROM 'job_assignment' OR transaction_type::text = 'JOB_SALARY')
);
CREATE FUNCTION check_job_salary() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a job_assignments; t wallet_transactions;
BEGIN
 IF TG_TABLE_NAME = 'job_assignments' THEN
  SELECT * INTO a FROM job_assignments WHERE id = NEW.id;
  IF a.status <> 'COMPLETED' THEN RETURN NULL; END IF;
 ELSE
  IF NEW.transaction_type::text <> 'JOB_SALARY' THEN RETURN NULL; END IF;
  SELECT * INTO a FROM job_assignments WHERE id = NEW.reference_id;
  IF NOT FOUND OR a.status <> 'COMPLETED' THEN RAISE EXCEPTION 'Invalid salary assignment'; END IF;
 END IF;
 SELECT * INTO t FROM wallet_transactions WHERE id = a.transaction_id;
 IF NOT FOUND OR t.transaction_type::text <> 'JOB_SALARY' OR t.reference_type <> 'job_assignment'
 OR t.reference_id <> a.id OR t.character_id <> a.character_id OR t.amount <> a.reward_amount
 OR t.account <> 'BANK' OR t.direction <> 'CREDIT' THEN RAISE EXCEPTION 'Invalid assignment salary'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER assignment_salary_consistency AFTER INSERT OR UPDATE ON job_assignments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_job_salary();
CREATE CONSTRAINT TRIGGER salary_assignment_consistency AFTER INSERT ON wallet_transactions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_job_salary();
CREATE FUNCTION protect_completed_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status = 'COMPLETED' THEN RAISE EXCEPTION 'Completed work is immutable'; END IF;
 IF TG_OP = 'UPDATE' AND (NEW.character_id <> OLD.character_id OR NEW.job_id <> OLD.job_id OR NEW.base_reward <> OLD.base_reward OR NEW.energy_cost <> OLD.energy_cost OR NEW.started_at <> OLD.started_at OR NEW.completes_at <> OLD.completes_at) THEN RAISE EXCEPTION 'Work terms are immutable'; END IF;
 RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER protect_completed_job BEFORE UPDATE OR DELETE ON job_assignments FOR EACH ROW EXECUTE FUNCTION protect_completed_job();
COMMIT;
