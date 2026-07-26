import { FilterQuery, Types } from 'mongoose';
import logger from '@/config/logger.config';
import Song, { SongDocument } from '@/modules/songs/song.model';
import { SONG_STATUS } from '@/constants/song-status';
import { ApiError } from '@/utils/ApiError';
import { LinkMatchInput, SmartSearchInput } from './ai-search.validation';
import {
  advancedTextSearch,
  enqueueSpotifyTrack,
  enqueueYouTubeTrack,
  similarLibraryTracksFromLibraryTrack,
  similarLibraryTracksFromSpotify,
  CyaniteTrackMatch,
} from './cyanite.service';
import { attachFreshSongCoverUrls } from '@/modules/songs/song.service';

type SearchMode = 'text' | 'spotify' | 'youtube';

interface SmartSearchResult {
  songs: SongDocument[];
  mode: SearchMode;
  source: 'cyanite' | 'local-fallback';
  message: string;
}

interface LinkMatchResult extends SmartSearchResult {
  mode: 'spotify' | 'youtube';
  reference: {
    provider: 'spotify' | 'youtube';
    url: string;
    title: string | null;
  };
}

const MIN_TEXT_MATCH_SCORE = 0.35;

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

const extractYouTubeVideoId = (input: string): string | null => {
  const trimmed = input.trim();
  const shortMatch = trimmed.match(/youtu\.be\/([A-Za-z0-9_-]+)/i);
  if (shortMatch) return shortMatch[1];
  const watchMatch = trimmed.match(/[?&]v=([A-Za-z0-9_-]+)/i);
  if (watchMatch) return watchMatch[1];
  const embedMatch = trimmed.match(/youtube\.com\/(?:embed|shorts)\/([A-Za-z0-9_-]+)/i);
  return embedMatch?.[1] ?? null;
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

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/https?:\/\/|www\.|open\.spotify\.com|youtube\.com|youtu\.be|spotify:track:/g, ' ')
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !['track', 'watch', 'music', 'video'].includes(token));

const localRankedLinkSearch = async (
  referenceText: string,
  limit: number,
): Promise<SongDocument[]> => {
  const tokens = tokenize(referenceText);
  const songs = await Song.find({ status: SONG_STATUS.PUBLISHED })
    .sort({ createdAt: -1 })
    .limit(200);

  if (!tokens.length) return songs.slice(0, limit);

  const scored = songs.map((song) => {
    const title = song.title.toLowerCase();
    const artist = song.artist.toLowerCase();
    const genre = (song.genre ?? '').toLowerCase();
    const mood = (song.mood ?? '').toLowerCase();
    const tags = song.tags.join(' ').toLowerCase();
    let score = 0;

    for (const token of tokens) {
      if (title.includes(token)) score += 5;
      if (artist.includes(token)) score += 4;
      if (genre.includes(token)) score += 3;
      if (mood.includes(token)) score += 3;
      if (tags.includes(token)) score += 2;
    }

    return { song, score };
  });

  const matches = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.song);

  return (matches.length ? matches : songs).slice(0, limit);
};

const getReferenceTitle = async (
  provider: 'spotify' | 'youtube',
  url: string,
): Promise<string | null> => {
  try {
    const endpoint =
      provider === 'spotify'
        ? `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
        : `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint);
    if (!response.ok) return null;
    const body = (await response.json()) as { title?: string };
    return body.title?.trim() || null;
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : error, provider },
      'Reference metadata lookup failed',
    );
    return null;
  }
};

const matchWithCyaniteLink = async (
  provider: 'spotify' | 'youtube',
  url: string,
  limit: number,
): Promise<SongDocument[]> => {
  let matches: CyaniteTrackMatch[] = [];

  if (provider === 'spotify') {
    const spotifyTrackId = extractSpotifyTrackId(url);
    if (!spotifyTrackId) throw new ApiError(400, 'Invalid Spotify track link');
    const cyaniteSpotifyId = await enqueueSpotifyTrack(spotifyTrackId);
    matches = await similarLibraryTracksFromSpotify(cyaniteSpotifyId, limit);
  } else {
    const libraryTrackId = await enqueueYouTubeTrack(url);
    matches = await similarLibraryTracksFromLibraryTrack(libraryTrackId, limit);
  }

  return findSongsForCyaniteMatches(matches, limit);
};

const mergeSongLists = (
  primary: SongDocument[],
  secondary: SongDocument[],
  limit: number,
): SongDocument[] => {
  const seen = new Set<string>();
  const merged: SongDocument[] = [];

  for (const song of [...primary, ...secondary]) {
    const id = song._id.toString();
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(song);
    if (merged.length >= limit) break;
  }

  return merged;
};

const keepConfidentTextMatches = (
  matches: CyaniteTrackMatch[],
): CyaniteTrackMatch[] =>
  matches.filter(
    (match) =>
      typeof match.score !== 'number' || match.score >= MIN_TEXT_MATCH_SCORE,
  );

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
  const localTitleMatches =
    mode === 'text' ? await localFallbackSearch(query, Math.min(limit, 10)) : [];

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

    const usableMatches =
      mode === 'text' ? keepConfidentTextMatches(matches) : matches;
    const songs = await findSongsForCyaniteMatches(usableMatches, limit);
    const mergedSongs =
      mode === 'text'
        ? mergeSongLists(localTitleMatches, songs, limit)
        : songs;

    if (mergedSongs.length) {
      const source = songs.length ? 'cyanite' : 'local-fallback';
      return {
        songs: await attachFreshSongCoverUrls(mergedSongs),
        mode,
        source,
        message:
          source === 'cyanite'
            ? 'AI search results matched from the SONAR library.'
            : 'Showing matching tracks from the SONAR catalog.',
      };
    }

    const fallbackSongs = await localFallbackSearch(
      mode === 'text' ? query : '',
      limit,
    );
    return {
      songs: await attachFreshSongCoverUrls(fallbackSongs),
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
      songs: await attachFreshSongCoverUrls(fallbackSongs),
      mode,
      source: 'local-fallback',
      message:
        error instanceof ApiError
          ? error.message
          : 'AI search is temporarily unavailable. Showing catalog matches for now.',
    };
  }
};

export const linkMatch = async (
  payload: LinkMatchInput,
): Promise<LinkMatchResult> => {
  const url = payload.url.trim();
  const limit = payload.limit ?? 20;
  const mode = detectMode(url, 'link');

  if (mode !== 'spotify' && mode !== 'youtube') {
    throw new ApiError(400, 'Only Spotify and YouTube links are supported');
  }

  if (mode === 'spotify' && !extractSpotifyTrackId(url)) {
    throw new ApiError(400, 'Invalid Spotify track link');
  }
  if (mode === 'youtube' && !extractYouTubeVideoId(url)) {
    throw new ApiError(400, 'Invalid YouTube link');
  }

  const referenceTitle = await getReferenceTitle(mode, url);
  const referenceText = referenceTitle ? `${referenceTitle} ${url}` : url;

  try {
    const songs = await matchWithCyaniteLink(mode, url, limit);
    if (songs.length) {
      return {
        songs: await attachFreshSongCoverUrls(songs),
        mode,
        source: 'cyanite',
        message: `Matched similar SONAR tracks from the ${mode === 'spotify' ? 'Spotify' : 'YouTube'} reference.`,
        reference: {
          provider: mode,
          url,
          title: referenceTitle,
        },
      };
    }
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : error, mode },
      'Cyanite link match failed; using local fallback',
    );
  }

  const fallbackSongs = await localRankedLinkSearch(referenceText, limit);

  return {
    songs: await attachFreshSongCoverUrls(fallbackSongs),
    mode,
    source: 'local-fallback',
    message: referenceTitle
      ? `Showing SONAR catalog matches based on "${referenceTitle}".`
      : 'Showing SONAR catalog matches for this reference link.',
    reference: {
      provider: mode,
      url,
      title: referenceTitle,
    },
  };
};
