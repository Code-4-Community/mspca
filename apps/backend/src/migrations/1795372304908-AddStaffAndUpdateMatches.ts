import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStaffAndUpdateMatches1795372304908
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "staff_type_enum" AS ENUM ('Hospital', 'Shelter')
    `);

    await queryRunner.query(`
      CREATE TABLE "foster_staff" (
        "staff_id" SERIAL PRIMARY KEY,
        "first_name" varchar(255) NOT NULL,
        "last_name" varchar(255) NOT NULL,
        "phone" varchar(20) NOT NULL,
        "secondary_phone" varchar(20),
        "email" varchar(255) NOT NULL,
        "address" varchar(255) NOT NULL,
        "city" varchar(255) NOT NULL,
        "zipcode" varchar(10) NOT NULL,
        "homebase" "homebase_enum" NOT NULL,
        "resident_animals" text NOT NULL,
        "notes" text,
        "most_recent_waiver_signed" boolean NOT NULL,
        "staff_type" "staff_type_enum" NOT NULL,
        "active" boolean NOT NULL,
        "cognito_sub" varchar(255) NOT NULL DEFAULT '',
        CONSTRAINT "UQ_foster_staff_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "staff_coordinator_assignments" (
        "staff_id" int NOT NULL,
        "coordinator_id" int NOT NULL,
        PRIMARY KEY ("staff_id", "coordinator_id"),
        CONSTRAINT "fk_staff_coordinator_staff" FOREIGN KEY ("staff_id")
          REFERENCES "foster_staff" ("staff_id") ON DELETE CASCADE,
        CONSTRAINT "fk_staff_coordinator_coordinator" FOREIGN KEY ("coordinator_id")
          REFERENCES "foster_coordinators" ("coordinator_id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "matches"
        ALTER COLUMN "volunteer_id" DROP NOT NULL,
        ADD COLUMN "staff_id" int,
        ADD CONSTRAINT "fk_matches_staff" FOREIGN KEY ("staff_id")
          REFERENCES "foster_staff" ("staff_id"),
        ADD CONSTRAINT "chk_matches_one_applicant" CHECK (
          ("volunteer_id" IS NOT NULL AND "staff_id" IS NULL)
          OR ("volunteer_id" IS NULL AND "staff_id" IS NOT NULL)
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "matches"
        DROP CONSTRAINT "chk_matches_one_applicant",
        DROP CONSTRAINT "fk_matches_staff",
        DROP COLUMN "staff_id",
        ALTER COLUMN "volunteer_id" SET NOT NULL
    `);

    await queryRunner.query(`DROP TABLE "staff_coordinator_assignments"`);

    await queryRunner.query(`DROP TABLE "foster_staff"`);

    await queryRunner.query(`DROP TYPE "staff_type_enum"`);
  }
}
