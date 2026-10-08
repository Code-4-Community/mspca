import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCognitoSubToCoordinators1791234567890
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "foster_coordinators"
                ADD COLUMN "cognito_sub" varchar(255) NOT NULL DEFAULT ''
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "foster_coordinators"
                DROP COLUMN "cognito_sub"
        `);
  }
}
