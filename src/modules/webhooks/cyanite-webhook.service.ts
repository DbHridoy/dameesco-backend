import crypto from 'crypto';
import env from '@/config/env.config';
import logger from '@/config/logger.config';
import { ApiError } from '@/utils/ApiError';
import * as songService from '@/modules/songs/song.service';

interface CyaniteWebhookPayload {
  version?: string;
  resource?: {
    type?: string;
    id?: string;
  };
  event?: {
    type?: string;
    status?: string;
  };
  [key: string]: unknown;
}

interface HandleCyaniteWebhookInput {
  payload: CyaniteWebhookPayload;
  rawBody?: Buffer;
  signature?: string;
}

const verifySignature = (
  rawBody: Buffer | undefined,
  signature: string | undefined,
): boolean => {
  if (!env.CYANITE_WEBHOOK_SECRET) {
    logger.warn('CYANITE_WEBHOOK_SECRET is not configured');
    return false;
  }

  if (!signature) {
    logger.warn('Cyanite webhook received without signature');
    return false;
  }

  if (!rawBody) {
    throw new ApiError(400, 'Missing raw webhook body');
  }

  const expected = crypto
    .createHmac('sha512', env.CYANITE_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    throw new ApiError(401, 'Invalid Cyanite webhook signature');
  }

  return true;
};

export const handleCyaniteWebhook = async ({
  payload,
  rawBody,
  signature,
}: HandleCyaniteWebhookInput) => {
  const verified = verifySignature(rawBody, signature);
  let songId: string | null = null;

  const isLibraryTrackEvent =
    typeof payload.resource?.type === 'string' &&
    payload.resource.type.toLowerCase() === 'librarytrack';

  if (verified && isLibraryTrackEvent && payload.resource?.id) {
    const updatedSong = await songService.handleCyaniteAnalysisWebhook(
      payload.resource.id,
    );
    songId = updatedSong?._id.toString() ?? null;
  }

  logger.info(
    {
      verified,
      version: payload.version,
      resource: payload.resource,
      event: payload.event,
      songId,
    },
    'Cyanite webhook received',
  );

  return {
    received: true,
    verified,
    version: payload.version ?? null,
    resourceType: payload.resource?.type ?? null,
    resourceId: payload.resource?.id ?? null,
    eventType: payload.event?.type ?? null,
    eventStatus: payload.event?.status ?? null,
    songId,
  };
};
