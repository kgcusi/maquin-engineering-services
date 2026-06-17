import type { ReactNode } from "react";
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";

// Shared shell for every transactional email (docs/08 §5). Inline styles only —
// email clients ignore <style>/Tailwind. Deep engineering green (#213d18, the
// brand mark color) anchors the header; the rest stays restrained and readable.
const BRAND_GREEN = "#213d18";

const main = { backgroundColor: "#f4f5f3", fontFamily: "Helvetica, Arial, sans-serif" };
const container = {
  margin: "0 auto",
  padding: "24px 0 48px",
  maxWidth: "560px",
};
const card = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e4e6e1",
  padding: "32px",
};
const brand = {
  color: BRAND_GREEN,
  fontSize: "15px",
  fontWeight: 700,
  letterSpacing: "0.02em",
  margin: "0 0 24px",
};
const footer = {
  color: "#8a8f85",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "24px 8px 0",
};

export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Text style={brand}>MAQUIN ENGINEERING SERVICES</Text>
            {children}
          </Section>
          <Hr style={{ borderColor: "#e4e6e1", margin: "24px 0 0" }} />
          <Text style={footer}>
            This is an automated message from the MAQUIN Engineering Services management system. If
            you weren’t expecting it, you can safely ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
