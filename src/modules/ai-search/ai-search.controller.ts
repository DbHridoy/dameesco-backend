import { Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiResponse } from '@/utils/ApiResponse';
import * as aiSearchService from './ai-search.service';
import { SmartSearchInput } from './ai-search.validation';

export const smartSearch = asyncHandler(async (req, res: Response) => {
  const result = await aiSearchService.smartSearch(req.body as SmartSearchInput);
  res.status(200).json(
    new ApiResponse('Smart search completed', result.songs, {
      mode: result.mode,
      source: result.source,
      message: result.message,
    }),
  );
});
