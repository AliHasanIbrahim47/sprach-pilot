import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import type { UiLocale } from "@sprachpilot/shared";
import type { ReactNode } from "react";

import { emailCopy } from "./copy.js";

const DARK_MODE_CSS = `
  :root { color-scheme: light dark; }
  @media (prefers-color-scheme: dark) {
    .email-body { background-color: #1c1917 !important; }
    .email-card { background-color: #292524 !important; }
    .email-text, .email-heading { color: #fafaf9 !important; }
    .email-muted { color: #d6d3d1 !important; }
    .email-button { background-color: #5eead4 !important; color: #042f2e !important; }
  }
`;

const bodyStyle = {
  backgroundColor: "#f5f5f4",
  fontFamily: "Segoe UI, Helvetica, Arial, sans-serif",
  margin: "0",
  padding: "24px 12px",
};

const cardStyle = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "32px 28px",
};

const headingStyle = { color: "#1c1917", fontSize: "24px", lineHeight: "32px", margin: "0 0 12px" };
const textStyle = { color: "#1c1917", fontSize: "16px", lineHeight: "24px", margin: "0 0 16px" };
const mutedStyle = { color: "#44403c", fontSize: "14px", lineHeight: "22px", margin: "0 0 12px" };
const buttonStyle = {
  backgroundColor: "#115e59",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  lineHeight: "24px",
  padding: "12px 20px",
  textDecoration: "none",
};

function EmailLayout(props: { locale: UiLocale; preview: string; children: ReactNode }) {
  return (
    <Html lang={props.locale} dir={props.locale === "ar" ? "rtl" : "ltr"}>
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{DARK_MODE_CSS}</style>
      </Head>
      <Preview>{props.preview}</Preview>
      <Body className="email-body" style={bodyStyle}>
        <Container className="email-card" style={cardStyle}>
          {props.children}
        </Container>
      </Body>
    </Html>
  );
}

export function VerificationEmail(props: { locale: UiLocale; url: string }) {
  const copy = emailCopy(props.locale);
  return (
    <EmailLayout locale={props.locale} preview={copy.verifyPreview}>
      <Heading className="email-heading" style={headingStyle}>
        {copy.verifyHeading}
      </Heading>
      <Text className="email-text" style={textStyle}>
        {copy.verifyBody}
      </Text>
      <Button className="email-button" href={props.url} style={buttonStyle}>
        {copy.verifyAction}
      </Button>
      <Text className="email-muted" style={mutedStyle}>
        {copy.fallback}
      </Text>
      <Text className="email-muted" style={mutedStyle}>
        {props.url}
      </Text>
      <Text className="email-muted" style={mutedStyle}>
        {copy.verifyFooter}
      </Text>
    </EmailLayout>
  );
}

export function ResetEmail(props: { locale: UiLocale; url: string }) {
  const copy = emailCopy(props.locale);
  return (
    <EmailLayout locale={props.locale} preview={copy.resetPreview}>
      <Heading className="email-heading" style={headingStyle}>
        {copy.resetHeading}
      </Heading>
      <Text className="email-text" style={textStyle}>
        {copy.resetBody}
      </Text>
      <Button className="email-button" href={props.url} style={buttonStyle}>
        {copy.resetAction}
      </Button>
      <Text className="email-muted" style={mutedStyle}>
        {copy.fallback}
      </Text>
      <Text className="email-muted" style={mutedStyle}>
        {props.url}
      </Text>
      <Text className="email-muted" style={mutedStyle}>
        {copy.resetFooter}
      </Text>
    </EmailLayout>
  );
}

export function NoticeEmail(props: { locale: UiLocale }) {
  const copy = emailCopy(props.locale);
  return (
    <EmailLayout locale={props.locale} preview={copy.noticePreview}>
      <Heading className="email-heading" style={headingStyle}>
        {copy.noticeHeading}
      </Heading>
      <Text className="email-text" style={textStyle}>
        {copy.noticeBody}
      </Text>
      <Text className="email-text" style={textStyle}>
        {copy.noticeSignIn}
      </Text>
      <Text className="email-muted" style={mutedStyle}>
        {copy.noticeIgnore}
      </Text>
    </EmailLayout>
  );
}
