import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceAssignedCoordinatorWithJoinTable1791800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "volunteer_coordinator_assignments" (
                "volunteer_id" int NOT NULL,
                "coordinator_id" int NOT NULL,
                CONSTRAINT "pk_volunteer_coordinator_assignments"
                    PRIMARY KEY ("volunteer_id", "coordinator_id"),
                CONSTRAINT "fk_assignment_volunteer"
                    FOREIGN KEY ("volunteer_id")
                    REFERENCES "foster_volunteers" ("volunteer_id")
                    ON DELETE CASCADE,
                CONSTRAINT "fk_assignment_coordinator"
                    FOREIGN KEY ("coordinator_id")
                    REFERENCES "foster_coordinators" ("coordinator_id")
                    ON DELETE RESTRICT
            )
        `);

    // The composite PK leads with volunteer_id, so lookups by coordinator need their own index.
    await queryRunner.query(`
            CREATE INDEX "idx_volunteer_coordinator_assignments_coordinator_id"
                ON "volunteer_coordinator_assignments" ("coordinator_id")
        `);

    await queryRunner.query(`
            INSERT INTO "volunteer_coordinator_assignments" ("volunteer_id", "coordinator_id")
            SELECT "volunteer_id", "assigned_coordinator_id"
            FROM "foster_volunteers"
            WHERE "assigned_coordinator_id" IS NOT NULL
        `);

    await queryRunner.query(`
            ALTER TABLE "foster_volunteers"
                DROP CONSTRAINT "fk_volunteer_coordinator",
                DROP COLUMN "assigned_coordinator_id"
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "foster_volunteers"
                ADD COLUMN "assigned_coordinator_id" int,
                ADD CONSTRAINT "fk_volunteer_coordinator"
                    FOREIGN KEY ("assigned_coordinator_id")
                    REFERENCES "foster_coordinators" ("coordinator_id")
        `);

    // A single column can only hold one coordinator, so keep the lowest ID.
    await queryRunner.query(`
            UPDATE "foster_volunteers" AS v
            SET "assigned_coordinator_id" = a."coordinator_id"
            FROM (
                SELECT "volunteer_id", MIN("coordinator_id") AS "coordinator_id"
                FROM "volunteer_coordinator_assignments"
                GROUP BY "volunteer_id"
            ) AS a
            WHERE v."volunteer_id" = a."volunteer_id"
        `);

    await queryRunner.query(`DROP TABLE "volunteer_coordinator_assignments"`);
  }
}
