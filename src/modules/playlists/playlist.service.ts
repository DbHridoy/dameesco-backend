import { FilterQuery } from 'mongoose';
import Playlist, { PlaylistDocument } from './playlist.model';
import Song from '@/modules/songs/song.model';
import { ApiError } from '@/utils/ApiError';
import { ensureValidObjectId } from '@/utils/sanitizeQuery';
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
    songs,
    isPublic: payload.isPublic ?? false,
  });
  return playlist;
};

export const updatePlaylist = async (
  playlistId: string,
  userId: string,
  isAdmin: boolean,
  payload: UpdatePlaylistInput,
): Promise<PlaylistDocument> => {
  const playlist = await ensureOwnership(playlistId, userId, isAdmin);
  if (payload.name !== undefined) playlist.name = payload.name;
  if (payload.description !== undefined)
    playlist.description = payload.description;
  if (payload.isPublic !== undefined) playlist.isPublic = payload.isPublic;
  await playlist.save();
  return playlist;
};

export const deletePlaylist = async (
  playlistId: string,
  userId: string,
  isAdmin: boolean,
): Promise<void> => {
  await ensureOwnership(playlistId, userId, isAdmin);
  await Playlist.deleteOne({ _id: playlistId });
};

export const getPlaylist = async (
  playlistId: string,
): Promise<PlaylistDocument> => {
  ensureValidObjectId(playlistId, 'playlistId');
  const playlist = await Playlist.findById(playlistId).populate({
    path: 'songs',
    select:
      'title slug artist coverImageUrl duration previewAudioUrl status',
  });
  if (!playlist) throw new ApiError(404, 'Playlist not found');
  return playlist;
};

export const listMyPlaylists = async (
  userId: string,
): Promise<PlaylistDocument[]> => {
  return Playlist.find({ user: userId }).sort({ createdAt: -1 });
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
  return Playlist.find(filter)
    .sort({ createdAt: -1 })
    .populate('user', 'name email');
};