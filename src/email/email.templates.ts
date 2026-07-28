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

export interface AdminLicenseSubmittedEmail extends BaseEmail {
  requestId: string;
  requesterName: string;
  requesterEmail: string;
  songTitle: string;
  songArtist: string;
  companyName?: string;
  projectName?: string;
  usageType: string;
  usageDescription?: string;
  budget?: number;
  message?: string;
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

export interface ShortlistInvitationEmail extends BaseEmail {
  inviterName: string;
  shortlistName: string;
  role: 'viewer' | 'editor';
  inviteUrl: string;
  expiryDays: number;
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

export const adminLicenseSubmittedTemplate = (
  data: AdminLicenseSubmittedEmail,
): string => {
  return layout(
    'New license request',
    `
    <p>A new license request has been submitted.</p>
    <p><strong>Request ID:</strong> <code>${data.requestId}</code></p>
    <p><strong>Track:</strong> ${data.songTitle} by ${data.songArtist}</p>
    <p><strong>Requester:</strong> ${data.requesterName} (${data.requesterEmail})</p>
    ${data.companyName ? `<p><strong>Company:</strong> ${data.companyName}</p>` : ''}
    ${data.projectName ? `<p><strong>Project / Brand:</strong> ${data.projectName}</p>` : ''}
    <p><strong>Usage Type:</strong> ${data.usageType}</p>
    ${data.usageDescription ? `<p><strong>Usage Details:</strong> ${data.usageDescription}</p>` : ''}
    ${data.budget !== undefined ? `<p><strong>Budget:</strong> ${data.budget}</p>` : ''}
    ${data.message ? `<p><strong>Message:</strong> ${data.message}</p>` : ''}
    <p>Please review this request in the admin dashboard.</p>
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

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[character]!,
  );

export const shortlistInvitationTemplate = (
  data: ShortlistInvitationEmail,
): string => {
  const inviterName = escapeHtml(data.inviterName);
  const shortlistName = escapeHtml(data.shortlistName);
  const inviteUrl = escapeHtml(data.inviteUrl);
  return layout(
    'You have been invited to a shortlist',
    `
    <p><strong>${inviterName}</strong> invited you to collaborate on <strong>${shortlistName}</strong> as a ${data.role}.</p>
    <p style="margin:28px 0;">
      <a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;">View invitation</a>
    </p>
    <p>This invitation expires in ${data.expiryDays} days and is tied to this email address.</p>
  `,
  );
};
