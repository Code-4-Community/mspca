import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameAdminUsersToOwners1793485161630
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "admin_users" RENAME TO "owners"`);

    await queryRunner.query(
      `ALTER TABLE "owners" RENAME COLUMN "admin_id" TO "owner_id"`,
    );

    // Renaming the table and column doesn't rename the constraints and
    // sequence Postgres generated for them, so rename those to match.
    await queryRunner.query(
      `ALTER TABLE "owners" RENAME CONSTRAINT "admin_users_pkey" TO "owners_pkey"`,
    );

    await queryRunner.query(
      `ALTER TABLE "owners" RENAME CONSTRAINT "UQ_admin_users_email" TO "UQ_owners_email"`,
    );

    await queryRunner.query(
      `ALTER SEQUENCE "admin_users_admin_id_seq" RENAME TO "owners_owner_id_seq"`,
    );

    await queryRunner.query(`
      ALTER TABLE "owners"
        ADD COLUMN "cognito_sub" varchar(255) NOT NULL DEFAULT ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "owners" DROP COLUMN "cognito_sub"`);

    await queryRunner.query(
      `ALTER SEQUENCE "owners_owner_id_seq" RENAME TO "admin_users_admin_id_seq"`,
    );

    await queryRunner.query(
      `ALTER TABLE "owners" RENAME CONSTRAINT "UQ_owners_email" TO "UQ_admin_users_email"`,
    );

    await queryRunner.query(
      `ALTER TABLE "owners" RENAME CONSTRAINT "owners_pkey" TO "admin_users_pkey"`,
    );

    await queryRunner.query(
      `ALTER TABLE "owners" RENAME COLUMN "owner_id" TO "admin_id"`,
    );

    await queryRunner.query(`ALTER TABLE "owners" RENAME TO "admin_users"`);
  }
}
