import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPetsAndHouseholdDetails1794408338094
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "pets" (
        "pet_id" SERIAL PRIMARY KEY,
        "volunteer_id" int NOT NULL
          REFERENCES "foster_volunteers" ("volunteer_id") ON DELETE CASCADE,
        "age_year" int NOT NULL,
        "age_month" int NOT NULL,
        "species" "foster_type_enum" NOT NULL,
        "breed" varchar(255) NOT NULL,
        CONSTRAINT "CHK_pets_age_year" CHECK ("age_year" >= 0),
        CONSTRAINT "CHK_pets_age_month" CHECK ("age_month" BETWEEN 0 AND 11)
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "foster_volunteers"
        ADD COLUMN "has_children" boolean NOT NULL DEFAULT false,
        ADD COLUMN "children_ages" int[] NOT NULL DEFAULT '{}',
        ADD COLUMN "has_separate_foster_room" boolean NOT NULL DEFAULT false,
        DROP COLUMN "resident_animals"
    `);

    // The defaults only let rows in local dev databases migrate; the API requires both booleans.
    // Separate statement: Postgres can't alter a column added in the same ALTER TABLE.
    await queryRunner.query(`
      ALTER TABLE "foster_volunteers"
        ALTER COLUMN "has_children" DROP DEFAULT,
        ALTER COLUMN "has_separate_foster_room" DROP DEFAULT,
        ADD CONSTRAINT "CHK_foster_volunteers_children_ages" CHECK (
          ("has_children" AND cardinality("children_ages") > 0)
          OR (NOT "has_children" AND cardinality("children_ages") = 0)
        ),
        ADD CONSTRAINT "CHK_foster_volunteers_children_ages_nonnegative"
          CHECK (0 <= ALL ("children_ages"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "foster_volunteers"
        DROP CONSTRAINT "CHK_foster_volunteers_children_ages_nonnegative",
        DROP CONSTRAINT "CHK_foster_volunteers_children_ages",
        DROP COLUMN "has_separate_foster_room",
        DROP COLUMN "children_ages",
        DROP COLUMN "has_children",
        ADD COLUMN "resident_animals" text NOT NULL DEFAULT ''
    `);

    // Separate statement for the same reason as in up.
    await queryRunner.query(`
      ALTER TABLE "foster_volunteers" ALTER COLUMN "resident_animals" DROP DEFAULT
    `);

    await queryRunner.query(`DROP TABLE "pets"`);
  }
}
