import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVolunteerCognitoSub1791000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" ADD COLUMN "cognito_sub" varchar(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" ADD CONSTRAINT "UQ_foster_volunteers_email" UNIQUE ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // IF EXISTS so databases that ran this migration before the constraint was
    // added to it can still revert.
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" DROP CONSTRAINT IF EXISTS "UQ_foster_volunteers_email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" DROP COLUMN "cognito_sub"`,
    );
  }
}
