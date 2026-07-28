import env from '@/config/env.config';
import logger from '@/config/logger.config';
import {
  passwordResetTemplate,
  adminLicenseSubmittedTemplate,
  licenseSubmittedTemplate,
  licenseStatusTemplate,
  accessRequestSubmittedTemplate,
  accessRequestDecisionTemplate,
  PasswordResetEmail,
  AdminLicenseSubmittedEmail,
  LicenseSubmittedEmail,
  LicenseStatusEmail,
  AccessRequestSubmittedEmail,
  AccessRequestDecisionEmail,
  shortlistInvitationTemplate,
  ShortlistInvitationEmail,
} from './email.templates';

const RESEND_API_URL = 'https://api.resend.com/emails';

const getResendFrom = (): string => {
  if (env.RESEND_FROM) return env.RESEND_FROM;
  return `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`;
};

const send = async (
  to: string,
  subject: string,
  html: string,
): Promise<void> => {
  try {
    if (!env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getResendFrom(),
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Resend request failed: ${response.status} ${errorBody}`);
    }
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

export const sendAdminLicenseSubmittedEmail = async (
  data: AdminLicenseSubmittedEmail,
): Promise<void> => {
  await send(data.to, data.subject, adminLicenseSubmittedTemplate(data));
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

export const sendShortlistInvitationEmail = async (
  data: ShortlistInvitationEmail,
): Promise<void> => {
  await send(data.to, data.subject, shortlistInvitationTemplate(data));
};
