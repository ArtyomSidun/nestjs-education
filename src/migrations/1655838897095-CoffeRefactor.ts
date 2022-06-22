import { MigrationInterface, QueryRunner } from 'typeorm';

export class CoffeRefactor1655838897095 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coffee" RENAME "name" TO "title"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coffee" RENAME "title" TO "name" `);
  }
}
