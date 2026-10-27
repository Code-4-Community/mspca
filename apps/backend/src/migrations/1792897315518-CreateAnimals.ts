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
        "age" int NOT NULL,
        "months" int NOT NULL DEFAULT 0,
        "sex" varchar(10) NOT NULL,
        "breed" text[] NOT NULL DEFAULT '{}',
        "weight" double precision NOT NULL,
        "location" "homebase_enum" NOT NULL,
        "pictures" text[] NOT NULL,
        "foster_bio_memo" text NOT NULL,
        "restrictions" "animal_restriction_enum"[] NOT NULL DEFAULT '{}'
      )
    `);

    // Chameleon animal IDs are now strings, so the columns that store them change type,
    // and matches/recommendations now reference the animal they're for.
    await queryRunner.query(`
      ALTER TABLE "matches"
        ALTER COLUMN "chameleon_animal_id" TYPE varchar(255) USING "chameleon_animal_id"::varchar,
        ADD CONSTRAINT "fk_matches_animal"
          FOREIGN KEY ("chameleon_animal_id")
          REFERENCES "animals" ("chameleon_animal_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "recommendations"
        ALTER COLUMN "chameleon_animal_id" TYPE varchar(255) USING "chameleon_animal_id"::varchar,
        ADD CONSTRAINT "fk_recommendations_animal"
          FOREIGN KEY ("chameleon_animal_id")
          REFERENCES "animals" ("chameleon_animal_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "foster_volunteers"
        ALTER COLUMN "animal_preferences" DROP DEFAULT,
        ALTER COLUMN "animal_preferences" TYPE text[] USING "animal_preferences"::text[],
        ALTER COLUMN "animal_preferences" SET DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "foster_volunteers"
        ALTER COLUMN "animal_preferences" DROP DEFAULT,
        ALTER COLUMN "animal_preferences" TYPE int[] USING "animal_preferences"::int[],
        ALTER COLUMN "animal_preferences" SET DEFAULT '{}'
    `);

    await queryRunner.query(`
      ALTER TABLE "recommendations"
        DROP CONSTRAINT "fk_recommendations_animal",
        ALTER COLUMN "chameleon_animal_id" TYPE int USING "chameleon_animal_id"::int
    `);

    await queryRunner.query(`
      ALTER TABLE "matches"
        DROP CONSTRAINT "fk_matches_animal",
        ALTER COLUMN "chameleon_animal_id" TYPE int USING "chameleon_animal_id"::int
    `);

    await queryRunner.query(`DROP TABLE "animals"`);
    await queryRunner.query(`DROP TYPE "animal_restriction_enum"`);
  }
}
