import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCognitoSubToCoordinators1791234567890
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "foster_coordinators"
        ADD COLUMN "cognito_sub" varchar(255) NOT NULL DEFAULT '',
        ADD CONSTRAINT "UQ_foster_coordinators_email" UNIQUE ("email")
    `);

    await queryRunner.query(`
      ALTER TABLE "admin_users"
        ADD CONSTRAINT "UQ_admin_users_email" UNIQUE ("email")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "admin_users"
        DROP CONSTRAINT "UQ_admin_users_email"
    `);

    await queryRunner.query(`
      ALTER TABLE "foster_coordinators"
        DROP CONSTRAINT "UQ_foster_coordinators_email",
        DROP COLUMN "cognito_sub"
    `);
  }
}
