import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFosterVolunteerCoordinatorAssignmentRelation1790820106597
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "foster_volunteers"
                ADD COLUMN "assigned_coordinator_id" int,
                ADD CONSTRAINT "fk_volunteer_coordinator"
                    FOREIGN KEY ("assigned_coordinator_id")
                    REFERENCES "foster_coordinators" ("coordinator_id")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "foster_volunteers"
                DROP CONSTRAINT "fk_volunteer_coordinator",
                DROP COLUMN "assigned_coordinator_id"
        `);
  }
}
