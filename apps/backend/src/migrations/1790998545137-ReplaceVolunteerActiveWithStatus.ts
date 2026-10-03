import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceVolunteerActiveWithStatus1790998545137
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "volunteer_status_enum" AS ENUM ('Active', 'Inactive', 'Pending')`,
    );

    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" ADD COLUMN "status" "volunteer_status_enum"`,
    );

    await queryRunner.query(
      `UPDATE "foster_volunteers" SET "status" = CASE WHEN "active" THEN 'Active' ELSE 'Inactive' END`,
    );

    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" ALTER COLUMN "status" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" DROP COLUMN "active"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" ADD COLUMN "active" boolean`,
    );

    await queryRunner.query(
      `UPDATE "foster_volunteers" SET "active" = ("status" = 'Active')`,
    );

    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" ALTER COLUMN "active" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" DROP COLUMN "status"`,
    );

    await queryRunner.query(`DROP TYPE "volunteer_status_enum"`);
  }
}
