import { FilterQuery, Types } from 'mongoose';
import logger from '@/config/logger.config';
import Song, { SongDocument } from '@/modules/songs/song.model';
import { SONG_STATUS } from '@/constants/song-status';
import { ApiError } from '@/utils/ApiError';
import { SmartSearchInput } from './ai-search.validation';
import {
  advancedTextSearch,
  enqueueSpotifyTrack,
  enqueueYouTubeTrack,
  similarLibraryTracksFromLibraryTrack,
  similarLibraryTracksFromSpotify,
  CyaniteTrackMatch,
} from './cyanite.service';

type SearchMode = 'text' | 'spotify' | 'youtube';

interface SmartSearchResult {
  songs: SongDocument[];
  mode: SearchMode;
  source: 'cyanite' | 'local-fallback';
  message: string;
}

const isObjectId = (value: string): boolean => /^[a-fA-F0-9]{24}$/.test(value);

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const detectMode = (query: string, type?: string): SearchMode => {
  if (type === 'link') {
    if (/youtu\.be|youtube\.com/i.test(query)) return 'youtube';
    if (/open\.spotify\.com|spotify:/i.test(query)) return 'spotify';
  }
  if (/youtu\.be|youtube\.com/i.test(query)) return 'youtube';
  if (/open\.spotify\.com|spotify:/i.test(query)) return 'spotify';
  return 'text';
};

const extractSpotifyTrackId = (input: string): string | null => {
  const trimmed = input.trim();
  const uriMatch = trimmed.match(/^spotify:track:([A-Za-z0-9]+)$/i);
  if (uriMatch) return uriMatch[1];
  const urlMatch = trimmed.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/i);
  return urlMatch?.[1] ?? null;
};

const localFallbackSearch = async (
  query: string,
  limit: number,
): Promise<SongDocument[]> => {
  const search = query.trim();
  const filter: FilterQuery<SongDocument> = { status: SONG_STATUS.PUBLISHED };

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { title: regex },
      { artist: regex },
      { album: regex },
      { genre: regex },
      { mood: regex },
      { tags: regex },
    ];
  }

  return Song.find(filter).sort({ createdAt: -1 }).limit(limit);
};

const findSongsForCyaniteMatches = async (
  matches: CyaniteTrackMatch[],
  limit: number,
): Promise<SongDocument[]> => {
  if (!matches.length) return [];

  const cyaniteIds = matches.map((match) => match.id).filter(Boolean);
  const externalIds = matches
    .map((match) => match.externalId)
    .filter((value): value is string => Boolean(value));
  const objectIds = externalIds.filter(isObjectId);
  const titles = matches.map((match) => match.title).filter(Boolean);

  const filters: FilterQuery<SongDocument>[] = [];
  if (cyaniteIds.length) {
    filters.push({ cyaniteLibraryTrackId: { $in: cyaniteIds } } as FilterQuery<SongDocument>);
  }
  if (objectIds.length) {
    filters.push({ _id: { $in: objectIds.map((id) => new Types.ObjectId(id)) } });
  }
  if (externalIds.length) {
    filters.push({ slug: { $in: externalIds } });
  }
  if (titles.length) {
    filters.push({
      title: {
        $in: titles.map((title) => new RegExp(`^${escapeRegex(title)}$`, 'i')),
      },
    });
  }

  if (!filters.length) return [];

  const songs = await Song.find({
    status: SONG_STATUS.PUBLISHED,
    $or: filters,
  }).limit(limit);

  const rank = new Map<string, number>();
  matches.forEach((match, index) => {
    rank.set(match.id, index);
    if (match.externalId) rank.set(match.externalId, index);
    rank.set(match.title.toLowerCase(), index);
  });

  return songs.sort((a, b) => {
    const aRank = Math.min(
      rank.get(String((a as unknown as { cyaniteLibraryTrackId?: string }).cyaniteLibraryTrackId)) ?? Infinity,
      rank.get(a._id.toString()) ?? Infinity,
      rank.get(a.slug) ?? Infinity,
      rank.get(a.title.toLowerCase()) ?? Infinity,
    );
    const bRank = Math.min(
      rank.get(String((b as unknown as { cyaniteLibraryTrackId?: string }).cyaniteLibraryTrackId)) ?? Infinity,
      rank.get(b._id.toString()) ?? Infinity,
      rank.get(b.slug) ?? Infinity,
      rank.get(b.title.toLowerCase()) ?? Infinity,
    );
    return aRank - bRank;
  });
};

export const smartSearch = async (
  payload: SmartSearchInput,
): Promise<SmartSearchResult> => {
  const query = payload.query.trim();
  const limit = payload.limit ?? 20;
  const mode = detectMode(query, payload.type);

  try {
    let matches: CyaniteTrackMatch[] = [];

    if (mode === 'spotify') {
      const spotifyTrackId = extractSpotifyTrackId(query);
      if (!spotifyTrackId) {
        throw new ApiError(400, 'Invalid Spotify track link');
      }
      const cyaniteSpotifyId = await enqueueSpotifyTrack(spotifyTrackId);
      matches = await similarLibraryTracksFromSpotify(cyaniteSpotifyId, limit);
    } else if (mode === 'youtube') {
      const libraryTrackId = await enqueueYouTubeTrack(query);
      matches = await similarLibraryTracksFromLibraryTrack(libraryTrackId, limit);
    } else {
      matches = await advancedTextSearch(query, limit);
    }

    const songs = await findSongsForCyaniteMatches(matches, limit);
    if (songs.length) {
      return {
        songs,
        mode,
        source: 'cyanite',
        message: 'AI search results matched from the SONAR library.',
      };
    }

    const fallbackSongs = await localFallbackSearch(
      mode === 'text' ? query : '',
      limit,
    );
    return {
      songs: fallbackSongs,
      mode,
      source: 'local-fallback',
      message:
        'Cyanite returned results, but they are not linked to local SONAR tracks yet. Showing catalog matches for now.',
    };
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : error, mode },
      'Cyanite smart search failed; falling back to local search',
    );
    if (error instanceof ApiError && error.statusCode === 400) throw error;

    const fallbackSongs = await localFallbackSearch(
      mode === 'text' ? query : '',
      limit,
    );
    return {
      songs: fallbackSongs,
      mode,
      source: 'local-fallback',
      message:
        error instanceof ApiError
          ? error.message
          : 'AI search is temporarily unavailable. Showing catalog matches for now.',
    };
  }
};
