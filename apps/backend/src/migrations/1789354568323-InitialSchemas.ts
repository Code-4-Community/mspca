import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchemas1789354568323 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "homebase_enum" AS ENUM ('Boston', 'Cape Cod', 'Salem', 'Nevins Farm')`,
    );
    await queryRunner.query(
      `CREATE TYPE "foster_type_enum" AS ENUM ('Dog', 'Cat', 'Small Animals', 'Baby Bottle Animals')`,
    );
    await queryRunner.query(
      `CREATE TYPE "match_status_enum" AS ENUM ('Pending', 'Active', 'Complete', 'Denied', 'Withdrawn', 'Canceled')`,
    );

    await queryRunner.query(`
      CREATE TABLE "foster_volunteers" (
        "volunteer_id" SERIAL PRIMARY KEY,
        "first_name" varchar(255) NOT NULL,
        "last_name" varchar(255) NOT NULL,
        "phone" varchar(20) NOT NULL,
        "secondary_phone" varchar(20),
        "email" varchar(255) NOT NULL,
        "address" varchar(255) NOT NULL,
        "city" varchar(255) NOT NULL,
        "zipcode" varchar(10) NOT NULL,
        "homebase" "homebase_enum" NOT NULL,
        "resident_animals" text NOT NULL,
        "notes" text,
        "foster_type" "foster_type_enum" NOT NULL,
        "completed_canine_training" boolean,
        "most_recent_waiver_signed" boolean NOT NULL,
        "active" boolean NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "foster_coordinators" (
        "coordinator_id" SERIAL PRIMARY KEY,
        "first_name" varchar(255) NOT NULL,
        "last_name" varchar(255) NOT NULL,
        "phone" varchar(20) NOT NULL,
        "secondary_phone" varchar(20),
        "email" varchar(255) NOT NULL,
        "homebase" "homebase_enum" NOT NULL,
        "active" boolean NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "admin_users" (
        "admin_id" SERIAL PRIMARY KEY,
        "first_name" varchar(255) NOT NULL,
        "last_name" varchar(255) NOT NULL,
        "phone" varchar(20) NOT NULL,
        "secondary_phone" varchar(20),
        "email" varchar(255) NOT NULL,
        "active" boolean NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "matches" (
        "match_id" SERIAL PRIMARY KEY,
        "volunteer_id" int NOT NULL,
        "chameleon_animal_id" int NOT NULL,
        "status" "match_status_enum" NOT NULL,
        "denied_reason" text,
        CONSTRAINT "fk_matches_volunteer" FOREIGN KEY ("volunteer_id")
          REFERENCES "foster_volunteers" ("volunteer_id"),
        CONSTRAINT "chk_denied_reason" CHECK (
          "status" != 'Denied' OR "denied_reason" IS NOT NULL
        )
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "recommendations" (
        "volunteer_id" int NOT NULL,
        "chameleon_animal_id" int NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        PRIMARY KEY ("volunteer_id", "chameleon_animal_id"),
        CONSTRAINT "fk_recommendations_volunteer" FOREIGN KEY ("volunteer_id")
          REFERENCES "foster_volunteers" ("volunteer_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "recommendations"`);
    await queryRunner.query(`DROP TABLE "matches"`);
    await queryRunner.query(`DROP TABLE "admin_users"`);
    await queryRunner.query(`DROP TABLE "foster_coordinators"`);
    await queryRunner.query(`DROP TABLE "foster_volunteers"`);
    await queryRunner.query(`DROP TYPE "match_status_enum"`);
    await queryRunner.query(`DROP TYPE "foster_type_enum"`);
    await queryRunner.query(`DROP TYPE "homebase_enum"`);
  }
}
