import User from '@/modules/users/user.model';
import Song from '@/modules/songs/song.model';
import Download from '@/modules/downloads/download.model';
import LicenseRequest from '@/modules/licensing/license-request.model';
import AccessRequest from '@/modules/access-requests/access-request.model';
import { SUBSCRIPTION_STATUS } from '@/constants/subscription';
import { SONG_STATUS } from '@/constants/song-status';
import { ACCESS_REQUEST_STATUS } from '@/constants/license-status';
import { getSearchAnalytics } from '@/modules/analytics/search-analytics.service';
import SearchAnalytics from '@/modules/analytics/search-analytics.model';
import { getPopularPlaylists } from '@/modules/analytics/playlist-analytics.service';

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

const sinceDateForRange = (range: string | undefined): Date => {
  if (range === '7d') return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (range === '90d') return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
};

const getTrackPerformanceAnalytics = async (range?: string) => {
  const since = sinceDateForRange(range);

  const [downloads, licenseRequests, searchAppearances] = await Promise.all([
    Download.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$song', downloads: { $sum: 1 } } },
    ]),
    LicenseRequest.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$song', licenseRequests: { $sum: 1 } } },
    ]),
    SearchAnalytics.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $unwind: '$matchedSongs' },
      { $group: { _id: '$matchedSongs', searchAppearances: { $sum: 1 } } },
    ]),
  ]);

  const stats = new Map<string, {
    songId: unknown;
    downloads: number;
    licenseRequests: number;
    searchAppearances: number;
  }>();

  const getEntry = (songId: unknown) => {
    const id = String(songId);
    const existing = stats.get(id);
    if (existing) return existing;
    const entry = {
      songId,
      downloads: 0,
      licenseRequests: 0,
      searchAppearances: 0,
    };
    stats.set(id, entry);
    return entry;
  };

  downloads.forEach((item) => {
    getEntry(item._id).downloads = item.downloads;
  });
  licenseRequests.forEach((item) => {
    getEntry(item._id).licenseRequests = item.licenseRequests;
  });
  searchAppearances.forEach((item) => {
    getEntry(item._id).searchAppearances = item.searchAppearances;
  });

  const ranked = [...stats.values()]
    .map((item) => ({
      ...item,
      score: item.downloads * 5 + item.licenseRequests * 4 + item.searchAppearances,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const songs = await Song.find({ _id: { $in: ranked.map((item) => item.songId) } })
    .select('title artist genre mood status isFeatured downloadCount')
    .lean();
  const songById = new Map(songs.map((song) => [song._id.toString(), song]));

  return ranked.map((item) => {
    const song = songById.get(String(item.songId));
    return {
      songId: item.songId,
      title: song?.title ?? 'Unknown track',
      artist: song?.artist ?? '',
      genre: song?.genre ?? '',
      mood: song?.mood ?? '',
      status: song?.status ?? '',
      isFeatured: Boolean(song?.isFeatured),
      totalDownloads: song?.downloadCount ?? 0,
      downloads: item.downloads,
      licenseRequests: item.licenseRequests,
      searchAppearances: item.searchAppearances,
      score: item.score,
    };
  });
};

export const getAnalytics = async (range?: string) => {
  const since = sinceDateForRange(range);
  const [search, tracks, playlists] = await Promise.all([
    getSearchAnalytics(range),
    getTrackPerformanceAnalytics(range),
    getPopularPlaylists({ createdAt: { $gte: since } }),
  ]);
  return { search, tracks, playlists };
};
