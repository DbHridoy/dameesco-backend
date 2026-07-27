import { Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiResponse } from '@/utils/ApiResponse';
import * as bulkImportService from './bulk-import.service';

export const downloadTemplate = asyncHandler(async (_req, res: Response) => {
  const buffer = bulkImportService.createTemplateWorkbook();
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="tracks-template.xlsx"',
  );
  res.status(200).send(buffer);
});

export const validateImport = asyncHandler(async (req, res: Response) => {
  const job = await bulkImportService.validateImport(req.files, req.user!.id);
  res
    .status(201)
    .json(new ApiResponse('Bulk import validated', { job }));
});

export const getJob = asyncHandler(async (req, res: Response) => {
  const job = await bulkImportService.getJob(req.params.id!);
  res.status(200).json(new ApiResponse('Bulk import job fetched', { job }));
});

export const startImport = asyncHandler(async (req, res: Response) => {
  const job = await bulkImportService.startImport(req.params.id!, req.user!.id);
  res.status(202).json(new ApiResponse('Bulk import started', { job }));
});

export const downloadReport = asyncHandler(async (req, res: Response) => {
  const csv = await bulkImportService.buildReportCsv(req.params.id!);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="bulk-import-${req.params.id}.csv"`,
  );
  res.status(200).send(csv);
});
