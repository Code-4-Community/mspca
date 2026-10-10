import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVolunteerCognitoSub1791000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" ADD COLUMN "cognito_sub" varchar(255) NOT NULL DEFAULT ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers" DROP COLUMN "cognito_sub"`,
    );
  }
}
