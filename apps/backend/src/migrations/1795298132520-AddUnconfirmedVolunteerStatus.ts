import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnconfirmedVolunteerStatus1795298132520
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rebuild the type instead of ADD VALUE, since Postgres won't let a new
    // enum value be used (as the column default) in the same transaction.
    // Existing volunteers keep their current status.
    await queryRunner.query(
      `ALTER TYPE "volunteer_status_enum" RENAME TO "volunteer_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "volunteer_status_enum" AS ENUM ('Active', 'Inactive', 'Unconfirmed', 'Pending')`,
    );
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" ALTER COLUMN "status" TYPE "volunteer_status_enum" USING "status"::text::"volunteer_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" ALTER COLUMN "status" SET DEFAULT 'Unconfirmed'`,
    );
    await queryRunner.query(`DROP TYPE "volunteer_status_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Unconfirmed volunteers fall back to Pending, the status they had before this migration.
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `UPDATE "foster_volunteers" SET "status" = 'Pending' WHERE "status" = 'Unconfirmed'`,
    );
    await queryRunner.query(
      `ALTER TYPE "volunteer_status_enum" RENAME TO "volunteer_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "volunteer_status_enum" AS ENUM ('Active', 'Inactive', 'Pending')`,
    );
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" ALTER COLUMN "status" TYPE "volunteer_status_enum" USING "status"::text::"volunteer_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" ALTER COLUMN "status" SET DEFAULT 'Pending'`,
    );
    await queryRunner.query(`DROP TYPE "volunteer_status_enum_old"`);
  }
}
