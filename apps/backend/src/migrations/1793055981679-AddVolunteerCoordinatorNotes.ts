import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVolunteerCoordinatorNotes1793055981679
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "foster_volunteers" ADD COLUMN "coordinator_notes" text NOT NULL DEFAULT '';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "foster_volunteers" DROP COLUMN "coordinator_notes";
    `);
  }
}
