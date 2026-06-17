import type { Metadata } from "next";

import { EmailSettingsForm } from "@/components/settings/email-settings-form";
import { NotificationTestPanel } from "@/components/settings/notification-test-panel";
import { SettingsForm } from "@/components/settings/settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePagePermission } from "@/lib/page-guards";
import { getEmailConfig, getSettings } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  // WEBMASTER-only: `settings.view` is excluded from the ADMIN bundle, so admins
  // and engineers are redirected to their dashboard (src/lib/permissions.ts).
  await requirePagePermission("settings.view");
  const [settings, emailConfig] = await Promise.all([getSettings(), getEmailConfig()]);

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">System settings</h1>
        <p className="text-muted-foreground text-sm">
          Firm-wide configuration. Changes take effect across the app immediately.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Regional</CardTitle>
          <CardDescription>
            The timezone and currency used to display dates, times, and monetary amounts everywhere.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm settings={settings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email delivery</CardTitle>
          <CardDescription>
            Resend credentials used to send email. Sending isn’t wired to any events yet — set the
            credentials here and verify them with a connection test.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailSettingsForm config={emailConfig} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            No app event sends email yet — each is enabled per-event once confirmed with the firm.
            Use this to verify the pipeline end-to-end: it sends a test email to you and lights up
            the in-app bell.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationTestPanel
            canSend={emailConfig.apiKeyConfigured && emailConfig.fromAddress !== null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
