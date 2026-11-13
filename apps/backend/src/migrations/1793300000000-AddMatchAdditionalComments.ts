import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMatchAdditionalComments1793300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "matches" ADD COLUMN "additional_comments" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "matches" DROP COLUMN "additional_comments"`,
    );
  }
}
