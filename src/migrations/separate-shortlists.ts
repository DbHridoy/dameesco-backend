import mongoose from 'mongoose';
import env from '@/config/env.config';
import Playlist from '@/modules/playlists/playlist.model';
import PlaylistAnalytics from '@/modules/analytics/playlist-analytics.model';
import User from '@/modules/users/user.model';
import { USER_ROLES } from '@/constants/roles';
import { deleteFile } from '@/storage/s3.service';

const execute = process.argv.includes('--execute');
const backupConfirmed = process.argv.includes('--backup-confirmed');

const run = async (): Promise<void> => {
  await mongoose.connect(env.MONGODB_URI);
  const userIds = await User.find({ role: USER_ROLES.USER }).distinct('_id');
  const playlists = await Playlist.find({ user: { $in: userIds } }).select(
    '_id name user coverImageKey',
  );
  const ids = playlists.map((playlist) => playlist._id);

  console.info(
    JSON.stringify(
      {
        mode: execute ? 'execute' : 'dry-run',
        userCount: userIds.length,
        playlistCount: playlists.length,
        playlistIds: ids.map(String),
      },
      null,
      2,
    ),
  );

  if (!execute || playlists.length === 0) return;
  if (!backupConfirmed) {
    throw new Error(
      'Refusing destructive migration without --backup-confirmed. Create and verify a database backup first.',
    );
  }

  const failedCoverDeletes: string[] = [];
  for (const playlist of playlists) {
    if (!playlist.coverImageKey) continue;
    try {
      await deleteFile(playlist.coverImageKey);
    } catch {
      failedCoverDeletes.push(playlist.coverImageKey);
    }
  }

  const [analyticsResult, playlistResult] = await Promise.all([
    PlaylistAnalytics.deleteMany({ playlist: { $in: ids } }),
    Playlist.deleteMany({ _id: { $in: ids } }),
  ]);

  console.info(
    JSON.stringify(
      {
        deletedPlaylists: playlistResult.deletedCount,
        deletedAnalytics: analyticsResult.deletedCount,
        failedCoverDeletes,
      },
      null,
      2,
    ),
  );
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
