import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationPreferences1706800000000 implements MigrationInterface {
  name = 'CreateNotificationPreferences1706800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create notification type enum
    await queryRunner.query(`
      CREATE TYPE "notification_type_enum" AS ENUM(
        'RESERVATION_REQUEST_CREATED',
        'RESERVATION_REQUEST_RESPONDED',
        'RESERVATION_CANCELLED',
        'HOST_RATED',
        'ACCOMMODATION_RATED'
      );
    `);

    // Create notification_preferences table
    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "notificationType" "notification_type_enum" NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_notification_preferences_user"
          FOREIGN KEY ("userId")
          REFERENCES "users"("id")
          ON DELETE CASCADE,
        CONSTRAINT "UQ_notification_preferences_user_type"
          UNIQUE ("userId", "notificationType")
      );
    `);

    // Create index for faster lookups by userId
    await queryRunner.query(`
      CREATE INDEX "IDX_notification_preferences_user"
      ON "notification_preferences" ("userId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notification_preferences_user"`);
    await queryRunner.query(`DROP TABLE "notification_preferences"`);
    await queryRunner.query(`DROP TYPE "notification_type_enum"`);
  }
}
