import { Types } from 'mongoose';
import SearchAnalytics from './search-analytics.model';
import { SongDocument } from '@/modules/songs/song.model';

type SearchMode = 'catalog' | 'text' | 'spotify' | 'youtube';
type SearchSource = 'catalog' | 'cyanite' | 'local-fallback';

interface RecordSearchEventInput {
  query: string;
  mode: SearchMode;
  source: SearchSource;
  songs: SongDocument[];
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

const normalizeQuery = (query: string): string =>
  query.trim().replace(/\s+/g, ' ').toLowerCase();

const unique = (values: Array<string | undefined | null>): string[] => {
  const seen = new Set<string>();
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => {
      if (!value || seen.has(value.toLowerCase())) return false;
      seen.add(value.toLowerCase());
      return true;
    });
};

export const recordSearchEvent = async ({
  query,
  mode,
  source,
  songs,
  userId,
  ipAddress,
  userAgent,
}: RecordSearchEventInput): Promise<void> => {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) return;

  await SearchAnalytics.create({
    query: query.trim(),
    normalizedQuery,
    mode,
    source,
    resultCount: songs.length,
    matchedSongs: songs.map((song) => song._id),
    genres: unique(songs.map((song) => song.genre)),
    moods: unique(songs.map((song) => song.mood)),
    user: userId && Types.ObjectId.isValid(userId) ? userId : undefined,
    ipAddress,
    userAgent,
  });
};

const sinceDateForRange = (range: string | undefined): Date => {
  if (range === '7d') return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (range === '90d') return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
};

const topArrayValue = async (
  field: '$genres' | '$moods',
  match: Record<string, unknown>,
) =>
  SearchAnalytics.aggregate([
    { $match: match },
    { $unwind: field },
    { $group: { _id: field, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 10 },
    { $project: { _id: 0, label: '$_id', count: 1 } },
  ]);

export const getSearchAnalytics = async (range?: string) => {
  const since = sinceDateForRange(range);
  const match = { createdAt: { $gte: since } };

  const [
    totalSearches,
    zeroResultSearches,
    popularSearches,
    popularTracks,
    popularGenres,
    popularMoods,
    modeBreakdown,
    recentSearches,
  ] = await Promise.all([
    SearchAnalytics.countDocuments(match),
    SearchAnalytics.countDocuments({ ...match, resultCount: 0 }),
    SearchAnalytics.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$normalizedQuery',
          query: { $first: '$query' },
          count: { $sum: 1 },
          averageResults: { $avg: '$resultCount' },
        },
      },
      { $sort: { count: -1, query: 1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          query: 1,
          count: 1,
          averageResults: { $round: ['$averageResults', 1] },
        },
      },
    ]),
    SearchAnalytics.aggregate([
      { $match: match },
      { $unwind: '$matchedSongs' },
      { $group: { _id: '$matchedSongs', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'songs',
          localField: '_id',
          foreignField: '_id',
          as: 'song',
        },
      },
      { $unwind: '$song' },
      {
        $project: {
          _id: 0,
          songId: '$_id',
          title: '$song.title',
          artist: '$song.artist',
          count: 1,
        },
      },
    ]),
    topArrayValue('$genres', match),
    topArrayValue('$moods', match),
    SearchAnalytics.aggregate([
      { $match: match },
      { $group: { _id: '$mode', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, mode: '$_id', count: 1 } },
    ]),
    SearchAnalytics.find(match)
      .sort({ createdAt: -1 })
      .limit(12)
      .select('query mode source resultCount createdAt')
      .lean(),
  ]);

  return {
    range: range ?? '30d',
    totalSearches,
    zeroResultSearches,
    popularSearches,
    popularTracks,
    popularGenres,
    popularMoods,
    modeBreakdown,
    recentSearches,
  };
};
