CREATE TABLE "project_template_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"duration_days" integer DEFAULT 7 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_template_phases_duration_check" CHECK ("project_template_phases"."duration_days" >= 1)
);
--> statement-breakpoint
CREATE TABLE "project_template_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_phase_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"weight_pct" numeric(5, 2) DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_template_tasks_weight_check" CHECK ("project_template_tasks"."weight_pct" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "project_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "project_template_phases" ADD CONSTRAINT "project_template_phases_template_id_project_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."project_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_template_tasks" ADD CONSTRAINT "project_template_tasks_template_phase_id_project_template_phases_id_fk" FOREIGN KEY ("template_phase_id") REFERENCES "public"."project_template_phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_template_phases_template_idx" ON "project_template_phases" USING btree ("template_id","sequence");--> statement-breakpoint
CREATE INDEX "project_template_tasks_phase_idx" ON "project_template_tasks" USING btree ("template_phase_id","sequence");--> statement-breakpoint
CREATE INDEX "project_templates_name_idx" ON "project_templates" USING btree ("name");