import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVolunteerFosterTypePreferences1791800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "foster_volunteers" ADD COLUMN "foster_type_preferences" "foster_type_enum"[] NOT NULL DEFAULT '{}';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "foster_volunteers" DROP COLUMN "foster_type_preferences";
    `);
  }
}
