import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnimals1792897315518 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "animal_restriction_enum" AS ENUM (
        'No Restrictions',
        'Dog-Free Home',
        'Cat-Free Home',
        'Activity Restriction',
        'Child-Free Home',
        'Pet-Free Home',
        'Requires Medication'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "animals" (
        "animal_id" SERIAL PRIMARY KEY,
        "chameleon_animal_id" varchar(255) NOT NULL UNIQUE,
        "name" varchar(255) NOT NULL,
        "age_year" int NOT NULL DEFAULT 0,
        "age_month" int NOT NULL DEFAULT 0,
        "sex" varchar(10) NOT NULL,
        "species" "foster_type_enum" NOT NULL,
        "breed" text[] NOT NULL DEFAULT '{}',
        "weight" double precision NOT NULL,
        "location" "homebase_enum" NOT NULL,
        "pictures" text[] NOT NULL,
        "foster_bio_memo" text NOT NULL,
        "restrictions" "animal_restriction_enum"[] NOT NULL DEFAULT '{}'
      )
    `);

    // Chameleon animal IDs are now strings, so the columns that store them change type,
    // and matches/recommendations now reference the animal they're for. Existing rows
    // point at old test IDs that aren't in the (new, empty) animals table, so they're
    // deleted first; otherwise adding the foreign keys would fail.
    for (const table of ['matches', 'recommendations']) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
          ALTER COLUMN "chameleon_animal_id" TYPE varchar(255) USING "chameleon_animal_id"::varchar
      `);

      await queryRunner.query(`
        DELETE FROM "${table}" t
        WHERE NOT EXISTS (
          SELECT 1 FROM "animals" a
          WHERE a."chameleon_animal_id" = t."chameleon_animal_id"
        )
      `);

      await queryRunner.query(`
        ALTER TABLE "${table}"
          ADD CONSTRAINT "fk_${table}_animal"
            FOREIGN KEY ("chameleon_animal_id")
            REFERENCES "animals" ("chameleon_animal_id")
      `);
    }

    await queryRunner.query(`
      ALTER TABLE "foster_volunteers"
        ALTER COLUMN "animal_preferences" DROP DEFAULT,
        ALTER COLUMN "animal_preferences" TYPE text[] USING "animal_preferences"::text[],
        ALTER COLUMN "animal_preferences" SET DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only numeric IDs fit back into the old int columns, so anything else
    // (i.e. real Chameleon IDs like 'A476750') is dropped before casting.
    // Postgres doesn't allow subqueries in ALTER ... USING, hence the separate
    // UPDATE/DELETE statements.
    await queryRunner.query(`
      UPDATE "foster_volunteers"
        SET "animal_preferences" = ARRAY(
          SELECT id FROM unnest("animal_preferences") AS id
          WHERE id ~ '^[0-9]{1,9}$'
        )
    `);

    await queryRunner.query(`
      ALTER TABLE "foster_volunteers"
        ALTER COLUMN "animal_preferences" DROP DEFAULT,
        ALTER COLUMN "animal_preferences" TYPE int[] USING "animal_preferences"::int[],
        ALTER COLUMN "animal_preferences" SET DEFAULT '{}'
    `);

    for (const table of ['recommendations', 'matches']) {
      await queryRunner.query(`
        ALTER TABLE "${table}" DROP CONSTRAINT "fk_${table}_animal"
      `);

      await queryRunner.query(`
        DELETE FROM "${table}"
        WHERE "chameleon_animal_id" !~ '^[0-9]{1,9}$'
      `);

      await queryRunner.query(`
        ALTER TABLE "${table}"
          ALTER COLUMN "chameleon_animal_id" TYPE int USING "chameleon_animal_id"::int
      `);
    }

    await queryRunner.query(`DROP TABLE "animals"`);
    await queryRunner.query(`DROP TYPE "animal_restriction_enum"`);
  }
}
