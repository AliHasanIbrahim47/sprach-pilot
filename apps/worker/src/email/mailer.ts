import nodemailer from "nodemailer";

import type { WorkerConfig } from "../config.js";

export interface OutboundMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: OutboundMail): Promise<void>;
}

export function createSmtpMailer(smtp: WorkerConfig["smtp"]): Mailer {
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
        from: smtp.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    },
  };
}
