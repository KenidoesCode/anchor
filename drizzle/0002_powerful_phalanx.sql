CREATE TYPE "public"."notify_target" AS ENUM('holder', 'line_manager', 'account_owner', 'director');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('director', 'deployment_coordinator', 'lead_auditor', 'auditor', 'training_admin', 'trainer', 'qehs_consultant', 'finance', 'deployed_officer', 'client_user');--> statement-breakpoint
CREATE TABLE "app_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"person_id" uuid,
	"password_hash" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "app_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "escalation_stage_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_key" text NOT NULL,
	"days_before" integer NOT NULL,
	"notify_target" "notify_target" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "escalation_stage_config_stage_key_unique" UNIQUE("stage_key")
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid,
	"recipient_role" text,
	"channel" "notification_channel" NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"related_entity" text,
	"related_id" uuid,
	"status" "delivery_outcome" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "certification" ADD COLUMN "document_key" text;--> statement-breakpoint
ALTER TABLE "certification" ADD COLUMN "document_filename" text;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "national_id_last4" text;--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_id_person_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;