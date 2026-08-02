// src/services/emailService.js
//
// Requires: npm install nodemailer
//
// If SMTP_* env vars aren't set, this falls back to printing the email to
// the console instead of throwing — so registration/reset flows still work
// end-to-end in local dev before you've wired up a real mail provider
// (SendGrid, Mailgun, SES, Gmail app password, etc. — anything nodemailer
// can talk SMTP to).

import nodemailer from "nodemailer";
import { logger } from "../utils/logger.js";

const hasSmtpConfig = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

export const sendMail = async ({ to, subject, html }) => {
  if (!transporter) {
    logger.warn("SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS) — printing email instead of sending:");
    logger.info(`TO: ${to}\nSUBJECT: ${subject}\n${html}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "no-reply@schemecompanion.app",
    to,
    subject,
    html,
  });
};
// emailService.js (add this export)
export const canSendEmails = () => !!transporter;