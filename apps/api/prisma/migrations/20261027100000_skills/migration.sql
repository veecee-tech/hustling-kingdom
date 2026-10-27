BEGIN;
CREATE TABLE skills (
 id uuid PRIMARY KEY, code varchar(24) NOT NULL UNIQUE CHECK(code IN ('BUSINESS','TECHNOLOGY','TRADING','SOCIAL','FITNESS','STREET')),
 name varchar(80) NOT NULL, description text NOT NULL, max_level integer NOT NULL DEFAULT 10 CHECK(max_level BETWEEN 1 AND 10),
 is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz NOT NULL
);
CREATE TABLE character_skills (
 character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
 level integer NOT NULL DEFAULT 1 CHECK(level BETWEEN 1 AND 10),
 xp bigint NOT NULL DEFAULT 0 CHECK(xp BETWEEN 0 AND 1350), updated_at timestamptz NOT NULL,
 PRIMARY KEY(character_id,skill_id),
 CONSTRAINT skill_level_matches_xp CHECK(xp >= 15*(level-1)*level AND (level=10 OR xp < 15*level*(level+1)))
);
CREATE FUNCTION protect_skill_progress() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.xp < OLD.xp OR NEW.level < OLD.level OR NEW.character_id <> OLD.character_id OR NEW.skill_id <> OLD.skill_id THEN RAISE EXCEPTION 'Skill progression cannot decrease or change owner'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER skill_progress_monotonic BEFORE UPDATE ON character_skills FOR EACH ROW EXECUTE FUNCTION protect_skill_progress();
ALTER TABLE jobs ADD COLUMN required_skill_id uuid REFERENCES skills(id) ON DELETE RESTRICT,
 ADD COLUMN required_skill_lvl integer CHECK(required_skill_lvl BETWEEN 1 AND 10),
 ADD COLUMN xp_skill_id uuid REFERENCES skills(id) ON DELETE RESTRICT,
 ADD COLUMN xp_reward bigint NOT NULL DEFAULT 0 CHECK(xp_reward BETWEEN 0 AND 1350),
 ADD CONSTRAINT job_skill_requirement_pair CHECK((required_skill_id IS NULL)=(required_skill_lvl IS NULL)),
 ADD CONSTRAINT job_xp_pair CHECK((xp_skill_id IS NULL AND xp_reward=0) OR (xp_skill_id IS NOT NULL AND xp_reward>0));
ALTER TABLE job_assignments ADD COLUMN xp_skill_id uuid REFERENCES skills(id) ON DELETE RESTRICT,
 ADD COLUMN xp_reward bigint NOT NULL DEFAULT 0 CHECK(xp_reward BETWEEN 0 AND 1350),
 ADD COLUMN xp_awarded bigint NOT NULL DEFAULT 0 CHECK(xp_awarded>=0 AND xp_awarded<=xp_reward),
 ADD COLUMN previous_level integer, ADD COLUMN current_level integer,
 ADD CONSTRAINT assignment_xp_pair CHECK((xp_skill_id IS NULL AND xp_reward=0) OR (xp_skill_id IS NOT NULL AND xp_reward>0)),
 ADD CONSTRAINT assignment_xp_result CHECK(
 (status='COMPLETED' AND xp_skill_id IS NOT NULL AND previous_level IS NOT NULL AND current_level IS NOT NULL AND previous_level BETWEEN 1 AND 10 AND current_level BETWEEN previous_level AND 10)
 OR ((status<>'COMPLETED' OR xp_skill_id IS NULL) AND xp_awarded=0 AND previous_level IS NULL AND current_level IS NULL));
CREATE FUNCTION protect_assignment_xp() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.xp_skill_id IS DISTINCT FROM OLD.xp_skill_id OR NEW.xp_reward<>OLD.xp_reward THEN RAISE EXCEPTION 'Shift XP terms are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_assignment_xp BEFORE UPDATE ON job_assignments FOR EACH ROW EXECUTE FUNCTION protect_assignment_xp();
INSERT INTO skills(id,code,name,description,max_level,updated_at) VALUES
('55000000-0000-4000-8000-000000000001','BUSINESS','Business','Learn to organize work and build dependable enterprises.',10,CURRENT_TIMESTAMP),
('55000000-0000-4000-8000-000000000002','TECHNOLOGY','Technology','Turn creative tools and technical practice into capability.',10,CURRENT_TIMESTAMP),
('55000000-0000-4000-8000-000000000003','TRADING','Trading','Understand fictional markets. No active XP source yet.',10,CURRENT_TIMESTAMP),
('55000000-0000-4000-8000-000000000004','SOCIAL','Social','Get better at helping customers and communicating.',10,CURRENT_TIMESTAMP),
('55000000-0000-4000-8000-000000000005','FITNESS','Fitness','Build capability through physical work.',10,CURRENT_TIMESTAMP),
('55000000-0000-4000-8000-000000000006','STREET','Street','Know your way around Kingdom City. No active XP source yet.',10,CURRENT_TIMESTAMP)
ON CONFLICT(code) DO NOTHING;

-- Explicit V1 cross-skill bridges prevent circular progression: customer work ->
-- Social -> Sales (Business), photography (Technology) -> skilled careers.
WITH config(code,xp_code,required_code,required_level,xp_reward) AS (VALUES
 ('CLEANER','FITNESS',NULL::text,NULL::integer,15),
 ('SHOP_ASSISTANT','SOCIAL',NULL,NULL,15),
 ('DELIVERY_RIDER','FITNESS','FITNESS',2,25),
 ('SALES_REP','BUSINESS','SOCIAL',2,25),
 ('PHOTOGRAPHER','TECHNOLOGY','SOCIAL',2,25),
 ('DESIGNER','TECHNOLOGY','TECHNOLOGY',2,25),
 ('JUNIOR_DEVELOPER','TECHNOLOGY','TECHNOLOGY',3,25),
 ('ACCOUNTANT','BUSINESS','BUSINESS',2,25),
 ('SOFTWARE_ENGINEER','TECHNOLOGY','TECHNOLOGY',5,35),
 ('MANAGER','BUSINESS','BUSINESS',4,35),
 ('CONSULTANT','BUSINESS','BUSINESS',6,40)
)
UPDATE jobs j SET xp_skill_id=x.id, xp_reward=c.xp_reward,
 required_skill_id=r.id, required_skill_lvl=c.required_level,
 future_requirement=CASE WHEN j.code='DELIVERY_RIDER' THEN 'Requires a vehicle · future progression' ELSE NULL END,
 updated_at=CURRENT_TIMESTAMP
FROM config c JOIN skills x ON x.code=c.xp_code LEFT JOIN skills r ON r.code=c.required_code
WHERE j.code=c.code AND j.xp_skill_id IS NULL;

COMMIT;
