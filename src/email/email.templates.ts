interface BaseEmail {
  to: string;
  subject: string;
}

export interface PasswordResetEmail extends BaseEmail {
  name: string;
  otp: string;
  expiryMinutes: number;
}

export interface LicenseSubmittedEmail extends BaseEmail {
  name: string;
  songTitle: string;
  requestId: string;
}

export interface LicenseStatusEmail extends BaseEmail {
  name: string;
  songTitle: string;
  status: 'approved' | 'rejected' | 'in_review';
  adminNote?: string;
}

export interface AccessRequestSubmittedEmail extends BaseEmail {
  name: string;
  requestedPlan: string;
}

export interface AccessRequestDecisionEmail extends BaseEmail {
  name: string;
  requestedPlan: string;
  decision: 'approved' | 'rejected';
  adminNote?: string;
}

const layout = (title: string, body: string): string => {
  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
  </head>
  <body style="font-family: Arial, sans-serif; background:#f6f8fa; padding:24px;">
    <div style="max-width:560px; margin:0 auto; background:#fff; padding:32px; border-radius:8px;">
      <h1 style="color:#111827; margin-top:0;">${title}</h1>
      ${body}
      <hr style="margin:32px 0; border:none; border-top:1px solid #e5e7eb;" />
      <p style="color:#9ca3af; font-size:12px;">Dameesco &middot; Music Platform</p>
    </div>
  </body>
</html>`;
};

export const passwordResetTemplate = (data: PasswordResetEmail): string => {
  return layout(
    'Reset your password',
    `
    <p>Hi ${data.name},</p>
    <p>Use the OTP below to reset your password. It expires in ${data.expiryMinutes} minutes.</p>
    <p style="font-size:28px; letter-spacing:8px; font-weight:bold; color:#2563eb; text-align:center; margin:24px 0;">
      ${data.otp}
    </p>
    <p>If you did not request this, please ignore this email.</p>
  `,
  );
};

export const licenseSubmittedTemplate = (
  data: LicenseSubmittedEmail,
): string => {
  return layout(
    'License request received',
    `
    <p>Hi ${data.name},</p>
    <p>We received your license request for <strong>${data.songTitle}</strong>.</p>
    <p>Request ID: <code>${data.requestId}</code></p>
    <p>Our team will review and respond shortly.</p>
  `,
  );
};

export const licenseStatusTemplate = (data: LicenseStatusEmail): string => {
  return layout(
    `License request ${data.status.replace('_', ' ')}`,
    `
    <p>Hi ${data.name},</p>
    <p>Your license request for <strong>${data.songTitle}</strong> has been updated to <strong>${data.status.toUpperCase()}</strong>.</p>
    ${data.adminNote ? `<p><em>Note from our team:</em> ${data.adminNote}</p>` : ''}
  `,
  );
};

export const accessRequestSubmittedTemplate = (
  data: AccessRequestSubmittedEmail,
): string => {
  return layout(
    'Access request received',
    `
    <p>Hi ${data.name},</p>
    <p>We received your request to upgrade to the <strong>${data.requestedPlan}</strong> plan.</p>
    <p>Our admin team will review and respond shortly.</p>
  `,
  );
};

export const accessRequestDecisionTemplate = (
  data: AccessRequestDecisionEmail,
): string => {
  return layout(
    `Access request ${data.decision}`,
    `
    <p>Hi ${data.name},</p>
    <p>Your request for the <strong>${data.requestedPlan}</strong> plan has been <strong>${data.decision.toUpperCase()}</strong>.</p>
    ${data.adminNote ? `<p><em>Note from our team:</em> ${data.adminNote}</p>` : ''}
    ${
      data.decision === 'approved'
        ? '<p>You now have paid access. Enjoy the music!</p>'
        : ''
    }
  `,
  );
};