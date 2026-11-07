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
    // Farm Animals animals can't be deleted while matches or recommendations reference them
    await queryRunner.query(
      `DELETE FROM "matches"
       WHERE "chameleon_animal_id" IN (
         SELECT "chameleon_animal_id" FROM "animals"
         WHERE "species" = 'Farm Animals'
       )`,
    );
    await queryRunner.query(
      `DELETE FROM "recommendations"
       WHERE "chameleon_animal_id" IN (
         SELECT "chameleon_animal_id" FROM "animals"
         WHERE "species" = 'Farm Animals'
       )`,
    );

    // Drop the deleted animals' IDs from volunteers' animal preferences
    await queryRunner.query(
      `UPDATE "foster_volunteers"
       SET "animal_preferences" = ARRAY(
         SELECT id FROM unnest("animal_preferences") AS id
         WHERE id NOT IN (
           SELECT "chameleon_animal_id" FROM "animals"
           WHERE "species" = 'Farm Animals'
         )
       )`,
    );

    await queryRunner.query(
      `DELETE FROM "animals" WHERE "species" = 'Farm Animals'`,
    );

    // Remove Farm Animals from volunteers; anyone left with no foster types gets Dog
    await queryRunner.query(
      `UPDATE "foster_volunteers"
       SET "foster_type" = CASE
         WHEN cardinality(array_remove("foster_type", 'Farm Animals')) = 0
           THEN ARRAY['Dog']::"foster_type_enum"[]
         ELSE array_remove("foster_type", 'Farm Animals')
       END
       WHERE 'Farm Animals' = ANY ("foster_type")`,
    );

    // Postgres can't drop a single enum value, so rebuild the type without it
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
    await queryRunner.query(
      `ALTER TABLE "animals"
       ALTER COLUMN "species" TYPE "foster_type_enum"
       USING "species"::text::"foster_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "foster_type_enum_old"`);
  }
}
