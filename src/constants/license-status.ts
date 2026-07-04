export const LICENSE_STATUS = {
  PENDING: 'pending',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type LicenseStatus =
  (typeof LICENSE_STATUS)[keyof typeof LICENSE_STATUS];

export const ACCESS_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type AccessRequestStatus =
  (typeof ACCESS_REQUEST_STATUS)[keyof typeof ACCESS_REQUEST_STATUS];

export const NOTIFICATION_TYPE = {
  LICENSE_SUBMITTED: 'license_submitted',
  LICENSE_UPDATED: 'license_updated',
  ACCESS_SUBMITTED: 'access_submitted',
  ACCESS_UPDATED: 'access_updated',
  SYSTEM: 'system',
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];