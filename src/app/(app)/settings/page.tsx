import type { Metadata } from "next";

import { EmailSettingsForm } from "@/components/settings/email-settings-form";
import { NotificationSettingsPanel } from "@/components/settings/notification-settings-panel";
import { NotificationTestPanel } from "@/components/settings/notification-test-panel";
import { SettingsForm } from "@/components/settings/settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requirePagePermission } from "@/lib/page-guards";
import { listNotificationSettings } from "@/modules/notifications/queries";
import { getEmailConfig, getSettings } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  // WEBMASTER-only: `settings.view` is excluded from the ADMIN bundle, so admins
  // and engineers are redirected to their dashboard (src/lib/permissions.ts).
  await requirePagePermission("settings.view");
  const [settings, emailConfig, notificationEvents] = await Promise.all([
    getSettings(),
    getEmailConfig(),
    listNotificationSettings(),
  ]);

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
            Resend credentials used to send email. Set them here and verify with a connection test;
            enabled notification events then deliver through this sender.
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
            Turn events on per-firm and choose how each one reaches people. Recipients are fixed per
            event; you control whether it fires and on which channels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <NotificationSettingsPanel
            events={notificationEvents}
            emailConfigured={emailConfig.apiKeyConfigured && emailConfig.fromAddress !== null}
          />
          <Separator />
          <div className="space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">End-to-end test</h3>
              <p className="text-muted-foreground text-xs">
                Sends a real email to your address and drops an in-app notice — a delivery check
                independent of the events above.
              </p>
            </div>
            <NotificationTestPanel
              canSend={emailConfig.apiKeyConfigured && emailConfig.fromAddress !== null}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
