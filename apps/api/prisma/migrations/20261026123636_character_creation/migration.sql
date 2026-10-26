-- CreateEnum
CREATE TYPE "CharacterGender" AS ENUM ('MALE', 'FEMALE', 'NON_BINARY');

-- CreateEnum
CREATE TYPE "CharacterStatus" AS ENUM ('ACTIVE');

-- CreateTable
CREATE TABLE "characters" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "gender" "CharacterGender" NOT NULL,
    "appearance" JSONB NOT NULL,
    "status" "CharacterStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "creation_key" VARCHAR(128) NOT NULL,
    "creation_hash" CHAR(64) NOT NULL,
    "creation_response" JSONB,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_stats" (
    "character_id" UUID NOT NULL,
    "reputation" BIGINT NOT NULL DEFAULT 0,
    "heat" INTEGER NOT NULL DEFAULT 0,
    "health" INTEGER NOT NULL DEFAULT 100,
    "energy" INTEGER NOT NULL DEFAULT 100,
    "stress" INTEGER NOT NULL DEFAULT 10,
    "highest_net_worth" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "character_stats_pkey" PRIMARY KEY ("character_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "characters_user_id_key" ON "characters"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "characters_slug_key" ON "characters"("slug");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_stats" ADD CONSTRAINT "character_stats_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 2 invariants beyond Prisma's schema DSL.
ALTER TABLE character_stats ADD CONSTRAINT character_stats_bounds CHECK (
  reputation >= 0 AND heat BETWEEN 0 AND 100 AND health BETWEEN 0 AND 100
  AND energy BETWEEN 0 AND 100 AND stress BETWEEN 0 AND 100
);
ALTER TABLE characters ADD CONSTRAINT characters_name_bounds CHECK (
  char_length(name) BETWEEN 2 AND 40 AND name = btrim(name)
);
ALTER TABLE characters ADD CONSTRAINT characters_appearance_shape CHECK (
  jsonb_typeof(appearance) = 'object'
  AND appearance ?& ARRAY['skinTone','face','hair','top','bottom','shoes']
  AND appearance - ARRAY['skinTone','face','hair','top','bottom','shoes'] = '{}'::jsonb
);

-- Deferred checks allow nested inserts but prevent committing a character without stats,
-- including direct SQL inserts or later accidental deletion of the stat row.
CREATE FUNCTION enforce_character_stats() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'characters' THEN target_id := NEW.id;
  ELSE target_id := OLD.character_id;
  END IF;
  IF EXISTS (SELECT 1 FROM characters WHERE id = target_id)
     AND NOT EXISTS (SELECT 1 FROM character_stats WHERE character_id = target_id) THEN
    RAISE EXCEPTION 'Character requires stats' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER character_requires_stats
AFTER INSERT OR UPDATE ON characters DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_character_stats();
CREATE CONSTRAINT TRIGGER character_stats_required
AFTER DELETE OR UPDATE ON character_stats DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_character_stats();
