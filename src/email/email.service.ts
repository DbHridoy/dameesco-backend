import { getMailTransporter } from '@/config/mail.config';
import env from '@/config/env.config';
import logger from '@/config/logger.config';
import {
  passwordResetTemplate,
  licenseSubmittedTemplate,
  licenseStatusTemplate,
  accessRequestSubmittedTemplate,
  accessRequestDecisionTemplate,
  PasswordResetEmail,
  LicenseSubmittedEmail,
  LicenseStatusEmail,
  AccessRequestSubmittedEmail,
  AccessRequestDecisionEmail,
} from './email.templates';

const send = async (
  to: string,
  subject: string,
  html: string,
): Promise<void> => {
  try {
    const transporter = getMailTransporter();
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      html,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error, to, subject },
      'Email send failed',
    );
    // Do not throw — emails should never break a user-facing request.
  }
};

export const sendPasswordResetEmail = async (
  data: PasswordResetEmail,
): Promise<void> => {
  await send(
    data.to,
    data.subject,
    passwordResetTemplate(data),
  );
};

export const sendLicenseSubmittedEmail = async (
  data: LicenseSubmittedEmail,
): Promise<void> => {
  await send(data.to, data.subject, licenseSubmittedTemplate(data));
};

export const sendLicenseStatusEmail = async (
  data: LicenseStatusEmail,
): Promise<void> => {
  await send(data.to, data.subject, licenseStatusTemplate(data));
};

export const sendAccessRequestSubmittedEmail = async (
  data: AccessRequestSubmittedEmail,
): Promise<void> => {
  await send(data.to, data.subject, accessRequestSubmittedTemplate(data));
};

export const sendAccessRequestDecisionEmail = async (
  data: AccessRequestDecisionEmail,
): Promise<void> => {
  await send(data.to, data.subject, accessRequestDecisionTemplate(data));
};