import { Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiResponse } from '@/utils/ApiResponse';
import * as service from './shortlist.service';
import { ShortlistMemberRole } from './shortlist.model';

export const create = asyncHandler(async (req, res: Response) => {
  const shortlist = await service.createShortlist(req.user!.id, req.body);
  res.status(201).json(new ApiResponse('Shortlist created', { shortlist }));
});

export const list = asyncHandler(async (req, res: Response) => {
  const shortlists = await service.listShortlists(req.user!.id);
  res.status(200).json(new ApiResponse('Shortlists fetched', { shortlists }));
});

export const get = asyncHandler(async (req, res: Response) => {
  const shortlist = await service.getShortlist(req.params.id!, req.user!.id);
  res.status(200).json(new ApiResponse('Shortlist fetched', { shortlist }));
});

export const update = asyncHandler(async (req, res: Response) => {
  const shortlist = await service.updateShortlist(
    req.params.id!,
    req.user!.id,
    req.body,
  );
  res.status(200).json(new ApiResponse('Shortlist updated', { shortlist }));
});

export const remove = asyncHandler(async (req, res: Response) => {
  await service.deleteShortlist(req.params.id!, req.user!.id);
  res.status(200).json(new ApiResponse('Shortlist deleted'));
});

export const addSong = asyncHandler(async (req, res: Response) => {
  const shortlist = await service.addSong(
    req.params.id!,
    req.params.songId!,
    req.user!.id,
  );
  res.status(200).json(new ApiResponse('Track added', { shortlist }));
});

export const removeSong = asyncHandler(async (req, res: Response) => {
  const shortlist = await service.removeSong(
    req.params.id!,
    req.params.songId!,
    req.user!.id,
  );
  res.status(200).json(new ApiResponse('Track removed', { shortlist }));
});

export const invite = asyncHandler(async (req, res: Response) => {
  const invitation = await service.createInvitation(
    req.params.id!,
    req.user!.id,
    req.body.email,
    req.body.role as ShortlistMemberRole,
  );
  res.status(201).json(new ApiResponse('Invitation sent', { invitation }));
});

export const invitations = asyncHandler(async (req, res: Response) => {
  const invitations = await service.listInvitations(
    req.params.id!,
    req.user!.id,
  );
  res.status(200).json(new ApiResponse('Invitations fetched', { invitations }));
});

export const inspectInvitation = asyncHandler(async (req, res: Response) => {
  const invitation = await service.inspectInvitation(req.params.token!);
  res.status(200).json(new ApiResponse('Invitation fetched', { invitation }));
});

export const acceptInvitation = asyncHandler(async (req, res: Response) => {
  const shortlist = await service.acceptInvitation(
    req.params.token!,
    req.user!.id,
    req.user!.email,
  );
  res.status(200).json(new ApiResponse('Invitation accepted', { shortlist }));
});

export const declineInvitation = asyncHandler(async (req, res: Response) => {
  await service.declineInvitation(req.params.token!, req.user!.email);
  res.status(200).json(new ApiResponse('Invitation declined'));
});

export const resendInvitation = asyncHandler(async (req, res: Response) => {
  const invitation = await service.resendInvitation(
    req.params.id!,
    req.params.invitationId!,
    req.user!.id,
  );
  res.status(200).json(new ApiResponse('Invitation resent', { invitation }));
});

export const revokeInvitation = asyncHandler(async (req, res: Response) => {
  await service.revokeInvitation(
    req.params.id!,
    req.params.invitationId!,
    req.user!.id,
  );
  res.status(200).json(new ApiResponse('Invitation revoked'));
});

export const updateMember = asyncHandler(async (req, res: Response) => {
  const shortlist = await service.updateMemberRole(
    req.params.id!,
    req.params.userId!,
    req.user!.id,
    req.body.role as ShortlistMemberRole,
  );
  res.status(200).json(new ApiResponse('Member updated', { shortlist }));
});

export const removeMember = asyncHandler(async (req, res: Response) => {
  await service.removeMember(
    req.params.id!,
    req.params.userId!,
    req.user!.id,
  );
  res.status(200).json(new ApiResponse('Member removed'));
});

export const leave = asyncHandler(async (req, res: Response) => {
  await service.leaveShortlist(req.params.id!, req.user!.id);
  res.status(200).json(new ApiResponse('Shortlist left'));
});

export const convertToPersonal = asyncHandler(async (req, res: Response) => {
  const shortlist = await service.convertToPersonal(
    req.params.id!,
    req.user!.id,
  );
  res
    .status(200)
    .json(new ApiResponse('Shortlist converted to personal', { shortlist }));
});

export const comments = asyncHandler(async (req, res: Response) => {
  const comments = await service.listComments(req.params.id!, req.user!.id);
  res.status(200).json(new ApiResponse('Comments fetched', { comments }));
});

export const createComment = asyncHandler(async (req, res: Response) => {
  const comment = await service.createComment(
    req.params.id!,
    req.user!.id,
    req.body.body,
    req.body.songId,
  );
  res.status(201).json(new ApiResponse('Comment created', { comment }));
});

export const updateComment = asyncHandler(async (req, res: Response) => {
  const comment = await service.updateComment(
    req.params.id!,
    req.params.commentId!,
    req.user!.id,
    req.body.body,
  );
  res.status(200).json(new ApiResponse('Comment updated', { comment }));
});

export const deleteComment = asyncHandler(async (req, res: Response) => {
  await service.deleteComment(
    req.params.id!,
    req.params.commentId!,
    req.user!.id,
  );
  res.status(200).json(new ApiResponse('Comment deleted'));
});
