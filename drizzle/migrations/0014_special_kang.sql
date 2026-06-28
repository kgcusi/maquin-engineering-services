CREATE TYPE "public"."inspection_status" AS ENUM('REQUESTED', 'PASSED', 'FAILED');--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_code" text NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"area" text,
	"description" text,
	"scheduled_for" date,
	"inspector_id" text,
	"requested_by_id" text,
	"status" "inspection_status" DEFAULT 'REQUESTED' NOT NULL,
	"outcome_remarks" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"inspected_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "inspections_ref_code_unique" UNIQUE("ref_code")
);
--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_inspector_id_user_id_fk" FOREIGN KEY ("inspector_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_requested_by_id_user_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inspections_project_idx" ON "inspections" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "inspections_inspector_idx" ON "inspections" USING btree ("inspector_id");