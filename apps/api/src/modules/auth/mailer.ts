import nodemailer from "nodemailer";

import type { ApiConfig } from "../../config.js";

export interface OutboundMail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: OutboundMail): Promise<void>;
}

const DEFAULT_FROM = "SprachPilot <no-reply@sprachpilot.local>";

export function createSmtpMailer(smtp: ApiConfig["smtp"]): Mailer {
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    ...(smtp.user !== undefined && smtp.pass !== undefined
      ? { auth: { user: smtp.user, pass: smtp.pass } }
      : {}),
  });

  return {
    async send(message) {
      await transport.sendMail({
        from: DEFAULT_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
    },
  };
}
