import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceCanineTrainingWithCompletedTrainings1793150103842
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "foster_training_enum" AS ENUM ('Dog', 'Cat');
      ALTER TABLE "foster_volunteers" ADD COLUMN "completed_trainings" "foster_training_enum"[] NOT NULL DEFAULT '{}';
      UPDATE "foster_volunteers" SET "completed_trainings" = ARRAY['Dog']::"foster_training_enum"[] WHERE "completed_canine_training" = true;
      ALTER TABLE "foster_volunteers" DROP COLUMN "completed_canine_training";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "foster_volunteers" ADD COLUMN "completed_canine_training" boolean;
      UPDATE "foster_volunteers" SET "completed_canine_training" = ('Dog' = ANY("completed_trainings"));
      ALTER TABLE "foster_volunteers" DROP COLUMN "completed_trainings";
      DROP TYPE "foster_training_enum";
    `);
  }
}
