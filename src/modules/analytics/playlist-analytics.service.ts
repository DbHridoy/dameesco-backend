import { Types } from 'mongoose';
import Playlist from '@/modules/playlists/playlist.model';
import PlaylistAnalytics from './playlist-analytics.model';
import { ensureValidObjectId } from '@/utils/sanitizeQuery';

interface RecordPlaylistViewInput {
  playlistId: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export const recordPlaylistView = async ({
  playlistId,
  userId,
  ipAddress,
  userAgent,
}: RecordPlaylistViewInput): Promise<void> => {
  ensureValidObjectId(playlistId, 'playlistId');
  const playlist = await Playlist.findOne({ _id: playlistId, isPublic: true }).select('_id');
  if (!playlist) return;

  await PlaylistAnalytics.create({
    playlist: playlist._id,
    user: userId && Types.ObjectId.isValid(userId) ? userId : undefined,
    ipAddress,
    userAgent,
  });
};

export const getPopularPlaylists = async (
  match: Record<string, unknown>,
) => {
  return PlaylistAnalytics.aggregate([
    { $match: match },
    { $group: { _id: '$playlist', views: { $sum: 1 } } },
    { $sort: { views: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'playlists',
        localField: '_id',
        foreignField: '_id',
        as: 'playlist',
      },
    },
    { $unwind: '$playlist' },
    {
      $project: {
        _id: 0,
        playlistId: '$_id',
        name: '$playlist.name',
        theme: '$playlist.theme',
        genre: '$playlist.genre',
        mood: '$playlist.mood',
        views: 1,
        songCount: { $size: { $ifNull: ['$playlist.songs', []] } },
      },
    },
  ]);
};
