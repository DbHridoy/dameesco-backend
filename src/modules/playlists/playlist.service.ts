import { FilterQuery } from 'mongoose';
import fs from 'fs';
import Playlist, { PlaylistDocument } from './playlist.model';
import Song from '@/modules/songs/song.model';
import { attachFreshSongCoverUrl } from '@/modules/songs/song.service';
import { ApiError } from '@/utils/ApiError';
import { ensureValidObjectId } from '@/utils/sanitizeQuery';
import {
  buildS3Key,
  deleteFile,
  getSignedDownloadUrl,
  isS3Configured,
  uploadFile,
} from '@/storage/s3.service';
import {
  CreatePlaylistInput,
  UpdatePlaylistInput,
} from './playlist.validation';

const ensureOwnership = async (
  playlistId: string,
  userId: string,
  isAdmin: boolean,
): Promise<PlaylistDocument> => {
  ensureValidObjectId(playlistId, 'playlistId');
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) throw new ApiError(404, 'Playlist not found');
  if (!isAdmin && playlist.user.toString() !== userId) {
    throw new ApiError(403, 'You can only manage your own playlists');
  }
  return playlist;
};

const attachFreshCoverUrl = async (
  playlist: PlaylistDocument,
): Promise<PlaylistDocument> => {
  if (playlist.coverImageKey) {
    playlist.coverImageUrl = await getSignedDownloadUrl(
      playlist.coverImageKey,
      900,
    );
  }
  if (Array.isArray(playlist.songs)) {
    await Promise.all(
      playlist.songs.map((song) => {
        if (
          typeof song === 'object' &&
          song !== null &&
          'coverImageKey' in song
        ) {
          return attachFreshSongCoverUrl(
            song as unknown as import('@/modules/songs/song.model').SongDocument,
          );
        }
        return Promise.resolve(song);
      }),
    );
  }
  return playlist;
};

const attachFreshCoverUrls = async (
  playlists: PlaylistDocument[],
): Promise<PlaylistDocument[]> => {
  return Promise.all(playlists.map((playlist) => attachFreshCoverUrl(playlist)));
};

export const createPlaylist = async (
  userId: string,
  payload: CreatePlaylistInput,
): Promise<PlaylistDocument> => {
  const songs = payload.songs ?? [];
  if (songs.length > 0) {
    const count = await Song.countDocuments({ _id: { $in: songs } });
    if (count !== songs.length) {
      throw new ApiError(400, 'One or more songs are invalid');
    }
  }
  const playlist = await Playlist.create({
    user: userId,
    name: payload.name,
    description: payload.description,
    theme: payload.theme,
    genre: payload.genre,
    mood: payload.mood,
    songs,
    isPublic: payload.isPublic ?? false,
  });
  return attachFreshCoverUrl(playlist);
};

export const updatePlaylist = async (
  playlistId: string,
  userId: string,
  isAdmin: boolean,
  payload: UpdatePlaylistInput,
): Promise<PlaylistDocument> => {
  const playlist = await ensureOwnership(playlistId, userId, isAdmin);
  if (payload.songs !== undefined && payload.songs.length > 0) {
    const count = await Song.countDocuments({ _id: { $in: payload.songs } });
    if (count !== payload.songs.length) {
      throw new ApiError(400, 'One or more songs are invalid');
    }
  }
  if (payload.name !== undefined) playlist.name = payload.name;
  if (payload.description !== undefined)
    playlist.description = payload.description;
  if (payload.theme !== undefined) playlist.theme = payload.theme;
  if (payload.genre !== undefined) playlist.genre = payload.genre;
  if (payload.mood !== undefined) playlist.mood = payload.mood;
  if (payload.isPublic !== undefined) playlist.isPublic = payload.isPublic;
  if (payload.songs !== undefined)
    playlist.songs = payload.songs as unknown as typeof playlist.songs;
  await playlist.save();
  return getPlaylist(playlist._id.toString());
};

export const deletePlaylist = async (
  playlistId: string,
  userId: string,
  isAdmin: boolean,
): Promise<void> => {
  const playlist = await ensureOwnership(playlistId, userId, isAdmin);
  if (playlist.coverImageKey) {
    await deleteFile(playlist.coverImageKey).catch(() => undefined);
  }
  await Playlist.deleteOne({ _id: playlistId });
};

export const getPlaylist = async (
  playlistId: string,
): Promise<PlaylistDocument> => {
  ensureValidObjectId(playlistId, 'playlistId');
  const playlist = await Playlist.findById(playlistId).populate({
    path: 'songs',
    select:
      'title slug artist coverImageKey coverImageUrl duration previewAudioUrl status',
  });
  if (!playlist) throw new ApiError(404, 'Playlist not found');
  return attachFreshCoverUrl(playlist);
};

export const listMyPlaylists = async (
  userId: string,
): Promise<PlaylistDocument[]> => {
  const playlists = await Playlist.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate({
      path: 'songs',
      select:
        'title slug artist coverImageKey coverImageUrl duration previewAudioUrl status',
    });
  return attachFreshCoverUrls(playlists);
};

export const listPublicPlaylists = async (): Promise<PlaylistDocument[]> => {
  const playlists = await Playlist.find({ isPublic: true })
    .sort({ updatedAt: -1, createdAt: -1 })
    .populate({
      path: 'songs',
      match: { status: 'published' },
      select:
        'title slug artist genre mood coverImageKey coverImageUrl duration previewAudioUrl watermarkedAudioUrl originalAudioUrl isDownloadable status',
    });
  return attachFreshCoverUrls(playlists);
};

export const uploadPlaylistCoverImage = async (
  playlistId: string,
  userId: string,
  isAdmin: boolean,
  file: Express.Multer.File,
): Promise<PlaylistDocument> => {
  try {
    const playlist = await ensureOwnership(playlistId, userId, isAdmin);

    if (!isS3Configured()) {
      throw new ApiError(500, 'S3 storage is not configured');
    }

    const key = buildS3Key('playlist-covers', file.originalname);
    const uploaded = await uploadFile({
      key,
      body: fs.readFileSync(file.path),
      contentType: file.mimetype,
      isPublic: true,
    });

    if (playlist.coverImageKey && playlist.coverImageKey !== uploaded.key) {
      await deleteFile(playlist.coverImageKey).catch(() => undefined);
    }

    playlist.coverImageKey = uploaded.key;
    playlist.coverImageUrl = uploaded.url;
    await playlist.save();

    return getPlaylist(playlist._id.toString());
  } finally {
    fs.unlink(file.path, () => undefined);
  }
};

export const addSongToPlaylist = async (
  playlistId: string,
  songId: string,
  userId: string,
  isAdmin: boolean,
): Promise<PlaylistDocument> => {
  ensureValidObjectId(songId, 'songId');
  const playlist = await ensureOwnership(playlistId, userId, isAdmin);
  const song = await Song.findById(songId);
  if (!song) throw new ApiError(404, 'Song not found');

  const exists = playlist.songs.some(
    (s) => s.toString() === songId,
  );
  if (!exists) {
    playlist.songs.push(song._id);
    await playlist.save();
  }
  return playlist;
};

export const removeSongFromPlaylist = async (
  playlistId: string,
  songId: string,
  userId: string,
  isAdmin: boolean,
): Promise<PlaylistDocument> => {
  ensureValidObjectId(songId, 'songId');
  const playlist = await ensureOwnership(playlistId, userId, isAdmin);
  playlist.songs = playlist.songs.filter(
    (s) => s.toString() !== songId,
  ) as typeof playlist.songs;
  await playlist.save();
  return playlist;
};

export const listAllPlaylists = async (
  filter: FilterQuery<PlaylistDocument> = {},
): Promise<PlaylistDocument[]> => {
  const playlists = await Playlist.find(filter)
    .sort({ createdAt: -1 })
    .populate('user', 'name email');
  return attachFreshCoverUrls(playlists);
};
