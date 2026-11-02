import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFarmAnimalsToFosterType1793476100199
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "foster_type_enum" ADD VALUE IF NOT EXISTS 'Farm Animals'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "foster_type_enum" RENAME TO "foster_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "foster_type_enum" AS ENUM ('Dog', 'Cat', 'Small Animals', 'Baby Bottle Animals')`,
    );
    await queryRunner.query(
      `ALTER TABLE "foster_volunteers"
       ALTER COLUMN "foster_type" TYPE "foster_type_enum"[]
       USING "foster_type"::text[]::"foster_type_enum"[]`,
    );
    await queryRunner.query(`DROP TYPE "foster_type_enum_old"`);
  }
}
