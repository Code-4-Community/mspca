import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnimalUpdatesAndFosterTypeArray1791429623582
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" ADD "animal_updates" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers"
       ALTER COLUMN "foster_type" TYPE "foster_type_enum"[]
       USING ARRAY["foster_type"]`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers"
       ALTER COLUMN "foster_type" TYPE "foster_type_enum"
       USING "foster_type"[1]`,
    );
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" DROP COLUMN "animal_updates"`,
    );
  }
}
