import { Button, Heading, Text } from "@react-email/components";

import { EmailLayout } from "./layout";

// Generic notification email — the dispatcher renders this for every event in the
// current scaffold (event-specific templates are added per-module in Stage 2+).
// All copy is passed in as typed props; the deep link is built from APP_BASE_URL by
// the caller.
export type NotificationEmailProps = {
  heading: string;
  message: string;
  recipientName?: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
};

const BRAND_GREEN = "#213d18";

const headingStyle = { color: "#1a1d17", fontSize: "20px", fontWeight: 700, margin: "0 0 12px" };
const greeting = { color: "#3f443b", fontSize: "14px", margin: "0 0 12px" };
const bodyStyle = { color: "#3f443b", fontSize: "15px", lineHeight: "24px", margin: "0 0 24px" };
const button = {
  backgroundColor: BRAND_GREEN,
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  padding: "12px 20px",
  textDecoration: "none",
};

export default function NotificationEmail({
  heading,
  message,
  recipientName,
  actionLabel,
  actionUrl,
}: NotificationEmailProps) {
  return (
    <EmailLayout preview={heading}>
      <Heading style={headingStyle}>{heading}</Heading>
      {recipientName ? <Text style={greeting}>Hi {recipientName},</Text> : null}
      <Text style={bodyStyle}>{message}</Text>
      {actionUrl && actionLabel ? (
        <Button href={actionUrl} style={button}>
          {actionLabel}
        </Button>
      ) : null}
    </EmailLayout>
  );
}
