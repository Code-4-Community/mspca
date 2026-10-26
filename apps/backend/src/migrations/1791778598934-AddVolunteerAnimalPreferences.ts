import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVolunteerAnimalPreferences1791778598934
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "foster_volunteers" ADD COLUMN "animal_preferences" int[] NOT NULL DEFAULT '{}';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "foster_volunteers" DROP COLUMN "animal_preferences";
    `);
  }
}
