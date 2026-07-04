import User from '@/modules/users/user.model';
import Song from '@/modules/songs/song.model';
import Download from '@/modules/downloads/download.model';
import LicenseRequest from '@/modules/licensing/license-request.model';
import AccessRequest from '@/modules/access-requests/access-request.model';
import { SUBSCRIPTION_STATUS } from '@/constants/subscription';
import { SONG_STATUS } from '@/constants/song-status';
import { ACCESS_REQUEST_STATUS } from '@/constants/license-status';

export const getDashboardStats = async () => {
  const [
    totalUsers,
    paidUsers,
    freeUsers,
    totalSongs,
    publishedSongs,
    totalDownloads,
    totalLicenseRequests,
    pendingAccessRequests,
    recentUsers,
    recentDownloads,
    recentLicenseRequests,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ subscriptionStatus: SUBSCRIPTION_STATUS.PAID }),
    User.countDocuments({ subscriptionStatus: SUBSCRIPTION_STATUS.FREE }),
    Song.countDocuments(),
    Song.countDocuments({ status: SONG_STATUS.PUBLISHED }),
    Download.countDocuments(),
    LicenseRequest.countDocuments(),
    AccessRequest.countDocuments({
      status: ACCESS_REQUEST_STATUS.PENDING,
    }),
    User.find().sort({ createdAt: -1 }).limit(5).select('-password'),
    Download.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name email')
      .populate('song', 'title artist'),
    LicenseRequest.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'name email')
      .populate('song', 'title'),
  ]);

  return {
    users: { total: totalUsers, paid: paidUsers, free: freeUsers },
    songs: { total: totalSongs, published: publishedSongs },
    downloads: { total: totalDownloads },
    licenseRequests: { total: totalLicenseRequests },
    pendingAccessRequests,
    recent: {
      users: recentUsers,
      downloads: recentDownloads,
      licenseRequests: recentLicenseRequests,
    },
  };
};

export const getSongStats = async () => {
  const [total, published, draft, archived, downloads] = await Promise.all([
    Song.countDocuments(),
    Song.countDocuments({ status: SONG_STATUS.PUBLISHED }),
    Song.countDocuments({ status: SONG_STATUS.DRAFT }),
    Song.countDocuments({ status: SONG_STATUS.ARCHIVED }),
    Song.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$downloadCount' },
        },
      },
    ]),
  ]);
  return {
    total,
    published,
    draft,
    archived,
    totalDownloads: downloads[0]?.total ?? 0,
  };
};