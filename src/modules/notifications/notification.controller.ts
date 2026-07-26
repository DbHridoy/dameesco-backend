import { Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiResponse } from '@/utils/ApiResponse';
import { ensureValidObjectId } from '@/utils/sanitizeQuery';
import * as notificationService from './notification.service';

export const list = asyncHandler(async (req, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const result = await notificationService.listForUser(
    req.user!.id,
    page,
    limit,
  );
  res
    .status(200)
    .json(
      new ApiResponse(
        'Notifications fetched',
        result.notifications,
        { total: result.total, unread: result.unread, page, limit },
      ),
    );
});

export const markRead = asyncHandler(async (req, res: Response) => {
  const id = req.params.id!;
  ensureValidObjectId(id, 'notificationId');
  const notif = await notificationService.markAsRead(id, req.user!.id);
  res
    .status(200)
    .json(new ApiResponse('Notification marked read', { notification: notif }));
});

export const markAllRead = asyncHandler(async (req, res: Response) => {
  const count = await notificationService.markAllAsRead(req.user!.id);
  res
    .status(200)
    .json(new ApiResponse('All notifications marked read', { count }));
});
