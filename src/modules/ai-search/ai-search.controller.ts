import { Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiResponse } from '@/utils/ApiResponse';
import * as aiSearchService from './ai-search.service';
import * as searchAnalyticsService from '@/modules/analytics/search-analytics.service';
import { LinkMatchInput, SmartSearchInput } from './ai-search.validation';

export const smartSearch = asyncHandler(async (req, res: Response) => {
  const payload = req.body as SmartSearchInput;
  const result = await aiSearchService.smartSearch(payload);
  await searchAnalyticsService.recordSearchEvent({
    query: payload.query,
    mode: result.mode,
    source: result.source,
    songs: result.songs,
    userId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  }).catch(() => undefined);
  res.status(200).json(
    new ApiResponse('Smart search completed', result.songs, {
      mode: result.mode,
      source: result.source,
      message: result.message,
    }),
  );
});

export const linkMatch = asyncHandler(async (req, res: Response) => {
  const payload = req.body as LinkMatchInput;
  const result = await aiSearchService.linkMatch(payload);
  await searchAnalyticsService.recordSearchEvent({
    query: payload.url,
    mode: result.mode,
    source: result.source,
    songs: result.songs,
    userId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  }).catch(() => undefined);
  res.status(200).json(
    new ApiResponse('Link match completed', result.songs, {
      mode: result.mode,
      source: result.source,
      message: result.message,
      reference: result.reference,
    }),
  );
});
