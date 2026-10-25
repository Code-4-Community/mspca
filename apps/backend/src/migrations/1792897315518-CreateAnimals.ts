import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnimals1792897315518 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "animals" (
        "animal_id" SERIAL PRIMARY KEY,
        "chameleon_animal_id" int NOT NULL UNIQUE,
        "name" varchar(255) NOT NULL,
        "age" int NOT NULL,
        "sex" varchar(50) NOT NULL,
        "breed" text[] NOT NULL DEFAULT '{}',
        "weight" double precision NOT NULL,
        "location" varchar(255) NOT NULL,
        "picture" varchar(2048),
        "foster_bio_memo" text
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "animals"`);
  }
}
