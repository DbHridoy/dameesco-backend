import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import unzipper from 'unzipper';
import { Types } from 'mongoose';
import BulkImportJob, {
  BULK_IMPORT_ROW_STATUS,
  BULK_IMPORT_STATUS,
  BulkImportJobDocument,
  BulkImportRow,
  BulkImportStemRow,
} from './bulk-import.model';
import Song from '@/modules/songs/song.model';
import Stem from '@/modules/songs/stem.model';
import * as songService from '@/modules/songs/song.service';
import {
  createStemFromFile,
  normalizeStemFilename,
} from '@/modules/songs/stem.service';
import { ApiError } from '@/utils/ApiError';
import { ensureValidObjectId } from '@/utils/sanitizeQuery';
import { SONG_STATUS } from '@/constants/song-status';
import logger from '@/config/logger.config';

const tmpRoot = path.resolve(process.cwd(), 'tmp', 'bulk-imports');
const audioExt = /\.(mp3|wav|flac|aac|m4a|ogg)$/i;
const templateHeaders = [
  'audioFilename',
  'title',
  'artist',
  'album',
  'description',
  'genre',
  'mood',
  'tags',
  'bpm',
  'key',
  'trackLanguage',
  'releaseDate',
  'isDownloadable',
  'status',
];
const stemTemplateHeaders = [
  'trackReference',
  'stemFilename',
  'stemType',
  'displayName',
  'sortOrder',
];

type UploadedBulkFiles = {
  zipFile: Express.Multer.File;
  metadataFile: Express.Multer.File;
};

type RawRow = Record<string, unknown>;

const ensureTmpRoot = () => {
  if (!fs.existsSync(tmpRoot)) fs.mkdirSync(tmpRoot, { recursive: true });
};

const clean = (value: unknown): string =>
  value === undefined || value === null ? '' : String(value).trim();

const parseBool = (value: unknown, fallback = true): boolean => {
  const normalized = clean(value).toLowerCase();
  if (!normalized) return fallback;
  return ['true', 'yes', '1', 'y'].includes(normalized);
};

const parseTags = (value: unknown): string[] =>
  clean(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 30);

const normalizeName = (value: string): string =>
  value.replace(/\\/g, '/').split('/').pop()?.trim().toLowerCase() ?? '';

const duplicateKey = (audioFilename: string, title: string): string =>
  `${normalizeName(audioFilename)}::${title.trim().toLowerCase()}`;

const summarize = (rows: BulkImportRow[], stemRows: BulkImportStemRow[] = []) => ({
  total: rows.length,
  valid: rows.filter((row) => row.rowStatus === BULK_IMPORT_ROW_STATUS.VALID).length,
  invalid: rows.filter((row) => row.rowStatus === BULK_IMPORT_ROW_STATUS.INVALID).length,
  warnings: rows.filter((row) => row.warnings.length).length,
  imported: rows.filter((row) => row.rowStatus === BULK_IMPORT_ROW_STATUS.IMPORTED).length,
  skipped: rows.filter((row) => row.rowStatus === BULK_IMPORT_ROW_STATUS.SKIPPED).length,
  failed: rows.filter((row) => row.rowStatus === BULK_IMPORT_ROW_STATUS.FAILED).length,
  stemTotal: stemRows.length,
  stemValid: stemRows.filter((row) => row.rowStatus === BULK_IMPORT_ROW_STATUS.VALID).length,
  stemInvalid: stemRows.filter((row) => row.rowStatus === BULK_IMPORT_ROW_STATUS.INVALID).length,
  stemWarnings: stemRows.filter((row) => row.warnings.length).length,
  stemImported: stemRows.filter((row) => row.rowStatus === BULK_IMPORT_ROW_STATUS.IMPORTED).length,
  stemSkipped: stemRows.filter((row) => row.rowStatus === BULK_IMPORT_ROW_STATUS.SKIPPED).length,
  stemFailed: stemRows.filter((row) => row.rowStatus === BULK_IMPORT_ROW_STATUS.FAILED).length,
});

const readMetadataRows = (
  metadataPath: string,
): { trackRows: RawRow[]; stemRows: RawRow[] } => {
  const workbook = xlsx.readFile(metadataPath);
  const trackSheet = workbook.Sheets.Tracks ?? workbook.Sheets[workbook.SheetNames[0]];
  if (!trackSheet) throw new ApiError(400, 'Metadata file does not contain a Tracks sheet');
  const stemSheet = workbook.Sheets.Stems;
  return {
    trackRows: xlsx.utils.sheet_to_json<RawRow>(trackSheet, { defval: '' }),
    stemRows: stemSheet
      ? xlsx.utils.sheet_to_json<RawRow>(stemSheet, { defval: '' })
      : [],
  };
};

const extractZip = async (zipPath: string, extractDir: string): Promise<string[]> => {
  await fs.promises.mkdir(extractDir, { recursive: true });
  await fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: extractDir }))
    .promise();

  const files: string[] = [];
  const walk = async (dir: string) => {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (audioExt.test(entry.name)) files.push(fullPath);
    }
  };
  await walk(extractDir);
  return files;
};

const getUploadedFiles = (
  files: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined,
): UploadedBulkFiles => {
  if (!files || Array.isArray(files)) {
    throw new ApiError(400, 'ZIP and metadata files are required');
  }

  const zipFile = files.audioZip?.[0];
  const metadataFile = files.metadata?.[0];
  if (!zipFile) throw new ApiError(400, 'Audio ZIP file is required');
  if (!metadataFile) throw new ApiError(400, 'Metadata file is required');
  if (!/\.zip$/i.test(zipFile.originalname)) {
    throw new ApiError(400, 'Audio file must be a ZIP archive');
  }
  if (!/\.(xlsx|csv)$/i.test(metadataFile.originalname)) {
    throw new ApiError(400, 'Metadata file must be XLSX or CSV');
  }
  return { zipFile, metadataFile };
};

const copyUpload = async (file: Express.Multer.File, jobDir: string): Promise<string> => {
  const target = path.join(jobDir, `${file.fieldname}-${Date.now()}-${file.originalname}`);
  await fs.promises.copyFile(file.path, target);
  fs.unlink(file.path, () => undefined);
  return target;
};

const validateRows = async (
  rawRows: RawRow[],
  audioFiles: string[],
): Promise<{ rows: BulkImportRow[]; unmatchedFiles: string[] }> => {
  const audioByName = new Map(audioFiles.map((filePath) => [normalizeName(filePath), filePath]));
  const usedAudioNames = new Set<string>();
  const seen = new Set<string>();
  const sheetKeys = rawRows
    .map((raw) => duplicateKey(clean(raw.audioFilename), clean(raw.title)))
    .filter((key) => !key.startsWith('::') && !key.endsWith('::'));

  const existingJobs = await BulkImportJob.find({
    'rows.rowStatus': BULK_IMPORT_ROW_STATUS.IMPORTED,
    'rows.audioFilename': { $exists: true },
  }).select('rows.audioFilename rows.title rows.rowStatus rows.importedSong');
  const importedSongIds = existingJobs.flatMap((job) =>
    job.rows
      .filter(
        (row) =>
          row.rowStatus === BULK_IMPORT_ROW_STATUS.IMPORTED &&
          row.importedSong,
      )
      .map((row) => row.importedSong!),
  );
  const existingImportedSongs = importedSongIds.length
    ? await Song.find({ _id: { $in: importedSongIds } }).select('_id').lean()
    : [];
  const existingImportedSongIds = new Set(
    existingImportedSongs.map((song) => String(song._id)),
  );
  const importedKeys = new Set<string>();
  const importedSongByKey = new Map<string, Types.ObjectId>();
  existingJobs.forEach((job) => {
    job.rows.forEach((row) => {
      if (
        row.rowStatus === BULK_IMPORT_ROW_STATUS.IMPORTED &&
        row.importedSong &&
        existingImportedSongIds.has(String(row.importedSong))
      ) {
        const key = duplicateKey(row.audioFilename, row.title);
        importedKeys.add(key);
        importedSongByKey.set(key, row.importedSong);
      }
    });
  });

  const rows: BulkImportRow[] = [];

  for (const [index, raw] of rawRows.entries()) {
    const rowNumber = index + 2;
    const audioFilename = clean(raw.audioFilename);
    const title = clean(raw.title);
    const artist = clean(raw.artist);
    const errors: string[] = [];
    const warnings: string[] = [];
    const key = duplicateKey(audioFilename, title);
    const normalizedAudio = normalizeName(audioFilename);
    const matchedFilePath = normalizedAudio ? audioByName.get(normalizedAudio) : undefined;

    if (!audioFilename) errors.push('audioFilename is required');
    if (!title) errors.push('title is required');
    if (!artist) errors.push('artist is required');
    if (audioFilename && !matchedFilePath) errors.push('audioFilename was not found in the ZIP');
    if (key && seen.has(key)) errors.push('Duplicate audioFilename + title inside this metadata file');
    if (key) seen.add(key);
    if (importedKeys.has(key)) warnings.push('This row was already imported and will be skipped');

    const duplicateCount = sheetKeys.filter((item) => item === key).length;
    if (duplicateCount > 1 && !errors.includes('Duplicate audioFilename + title inside this metadata file')) {
      errors.push('Duplicate audioFilename + title inside this metadata file');
    }

    const bpmText = clean(raw.bpm);
    const parsedBpm = bpmText ? Number(bpmText) : undefined;
    const bpm = parsedBpm !== undefined && Number.isInteger(parsedBpm)
      ? parsedBpm
      : undefined;
    if (bpmText && (bpm === undefined || bpm < 20 || bpm > 400)) {
      errors.push('bpm must be a whole number between 20 and 400');
    }

    const statusText = clean(raw.status).toLowerCase();
    const status = ['published', 'archived'].includes(statusText)
      ? (statusText as 'published' | 'archived')
      : SONG_STATUS.DRAFT;
    if (statusText && !['draft', 'published', 'archived'].includes(statusText)) {
      errors.push('status must be draft, published, or archived');
    }

    const releaseDateText = clean(raw.releaseDate);
    const releaseDate = releaseDateText ? new Date(releaseDateText) : undefined;
    if (releaseDateText && Number.isNaN(releaseDate?.getTime())) {
      errors.push('releaseDate must be a valid date');
    }

    if (matchedFilePath) usedAudioNames.add(normalizedAudio);

    rows.push({
      rowNumber,
      audioFilename,
      matchedFilePath,
      title,
      artist,
      album: clean(raw.album) || undefined,
      description: clean(raw.description) || undefined,
      genre: clean(raw.genre) || undefined,
      mood: clean(raw.mood) || undefined,
      tags: parseTags(raw.tags),
      bpm,
      key: clean(raw.key) || undefined,
      language: clean(raw.trackLanguage) || undefined,
      releaseDate,
      isDownloadable: parseBool(raw.isDownloadable, true),
      status,
      rowStatus: importedKeys.has(key)
        ? BULK_IMPORT_ROW_STATUS.SKIPPED
        : errors.length
          ? BULK_IMPORT_ROW_STATUS.INVALID
          : BULK_IMPORT_ROW_STATUS.VALID,
      errors,
      warnings,
      importedSong: importedSongByKey.get(key),
    });
  }

  const unmatchedFiles = audioFiles
    .filter((filePath) => !usedAudioNames.has(normalizeName(filePath)))
    .map((filePath) => path.relative(path.dirname(audioFiles[0] ?? ''), filePath));

  return { rows, unmatchedFiles };
};

const resolveExistingTrack = async (
  reference: string,
): Promise<{ id?: Types.ObjectId; matchedBy?: 'id' | 'slug' }> => {
  if (Types.ObjectId.isValid(reference)) {
    const song = await Song.findById(reference).select('_id').lean();
    if (song) return { id: song._id, matchedBy: 'id' };
  }
  const song = await Song.findOne({ slug: reference }).select('_id').lean();
  return song ? { id: song._id, matchedBy: 'slug' } : {};
};

const validateStemRows = async (
  rawRows: RawRow[],
  audioFiles: string[],
  trackRows: BulkImportRow[],
): Promise<BulkImportStemRow[]> => {
  const audioByName = new Map(audioFiles.map((filePath) => [normalizeName(filePath), filePath]));
  const masterReferences = new Set(
    trackRows.map((row) => normalizeName(row.audioFilename)).filter(Boolean),
  );
  const seen = new Set<string>();
  const rows: BulkImportStemRow[] = [];

  for (const [index, raw] of rawRows.entries()) {
    const rowNumber = index + 2;
    const trackReference = clean(raw.trackReference);
    const stemFilename = clean(raw.stemFilename);
    const stemType = clean(raw.stemType);
    const displayName = clean(raw.displayName) || stemType;
    const normalizedStem = normalizeStemFilename(stemFilename);
    const matchedFilePath = normalizedStem ? audioByName.get(normalizedStem) : undefined;
    const errors: string[] = [];
    const warnings: string[] = [];
    const duplicate = `${trackReference.toLowerCase()}::${normalizedStem}`;

    if (!trackReference) errors.push('trackReference is required');
    if (!stemFilename) errors.push('stemFilename is required');
    if (!stemType) errors.push('stemType is required');
    if (stemFilename && !matchedFilePath) errors.push('stemFilename was not found in the ZIP');
    if (seen.has(duplicate)) errors.push('Duplicate trackReference + stemFilename in the Stems sheet');
    seen.add(duplicate);

    const sortOrderText = clean(raw.sortOrder);
    const sortOrder = sortOrderText ? Number(sortOrderText) : 0;
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      errors.push('sortOrder must be a non-negative whole number');
    }

    let targetSong: Types.ObjectId | undefined;
    const targetsNewTrack = masterReferences.has(normalizeName(trackReference));
    if (!targetsNewTrack && trackReference) {
      const existing = await resolveExistingTrack(trackReference);
      targetSong = existing.id;
      if (!targetSong) {
        errors.push('trackReference does not match a Tracks audioFilename, Song ID, or Song slug');
      } else {
        const duplicateStem = await Stem.exists({
          song: targetSong,
          normalizedFilename: normalizedStem,
        });
        if (duplicateStem) warnings.push('This stem already exists and will be skipped');
      }
    }

    rows.push({
      rowNumber,
      trackReference,
      stemFilename,
      matchedFilePath,
      stemType,
      displayName,
      sortOrder: Number.isInteger(sortOrder) && sortOrder >= 0 ? sortOrder : 0,
      targetSong,
      rowStatus: warnings.some((warning) => warning.includes('already exists'))
        ? BULK_IMPORT_ROW_STATUS.SKIPPED
        : errors.length
          ? BULK_IMPORT_ROW_STATUS.INVALID
          : BULK_IMPORT_ROW_STATUS.VALID,
      errors,
      warnings,
    });
  }

  return rows;
};

export const createTemplateWorkbook = (): Buffer => {
  const example = {
    audioFilename: 'midnight-signal.wav',
    title: 'Midnight Signal',
    artist: 'SONAR Studio',
    album: '',
    description: 'Dark electronic cue for launch films.',
    genre: 'Electronic',
    mood: 'Tense',
    tags: 'dark, synth, driving',
    bpm: 128,
    key: 'A Minor',
    trackLanguage: 'Instrumental',
    releaseDate: '2026-07-27',
    isDownloadable: 'true',
    status: 'draft',
  };
  const sheet = xlsx.utils.json_to_sheet([example], { header: templateHeaders });
  const stemSheet = xlsx.utils.json_to_sheet([{
    trackReference: 'midnight-signal.wav',
    stemFilename: 'midnight-signal-drums.wav',
    stemType: 'Drums',
    displayName: 'Drums',
    sortOrder: 1,
  }], { header: stemTemplateHeaders });
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, sheet, 'Tracks');
  xlsx.utils.book_append_sheet(workbook, stemSheet, 'Stems');
  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
};

export const validateImport = async (
  files: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined,
  userId: string,
  triggerCyanite = false,
): Promise<BulkImportJobDocument> => {
  const { zipFile, metadataFile } = getUploadedFiles(files);
  ensureTmpRoot();
  const jobId = new Types.ObjectId();
  const jobDir = path.join(tmpRoot, jobId.toString());
  const extractDir = path.join(jobDir, 'audio');
  await fs.promises.mkdir(jobDir, { recursive: true });

  const zipPath = await copyUpload(zipFile, jobDir);
  const metadataPath = await copyUpload(metadataFile, jobDir);
  const audioFiles = await extractZip(zipPath, extractDir);
  const { trackRows, stemRows: rawStemRows } = readMetadataRows(metadataPath);
  const { rows } = await validateRows(trackRows, audioFiles);
  const stemRows = await validateStemRows(rawStemRows, audioFiles, rows);
  const usedFiles = new Set([
    ...rows.map((row) => row.matchedFilePath).filter(Boolean),
    ...stemRows.map((row) => row.matchedFilePath).filter(Boolean),
  ]);
  const unmatchedFiles = audioFiles
    .filter((filePath) => !usedFiles.has(filePath))
    .map((filePath) => path.relative(extractDir, filePath));

  return BulkImportJob.create({
    _id: jobId,
    createdBy: userId,
    status: BULK_IMPORT_STATUS.VALIDATED,
    originalZipName: zipFile.originalname,
    originalMetadataName: metadataFile.originalname,
    zipPath,
    metadataPath,
    extractDir,
    triggerCyanite,
    rows,
    stemRows,
    unmatchedFiles,
    summary: summarize(rows, stemRows),
  });
};

export const getJob = async (id: string): Promise<BulkImportJobDocument> => {
  ensureValidObjectId(id, 'jobId');
  const job = await BulkImportJob.findById(id)
    .populate('rows.importedSong', 'title artist')
    .populate('stemRows.targetSong', 'title artist slug')
    .populate('stemRows.importedStem', 'displayName type');
  if (!job) throw new ApiError(404, 'Bulk import job not found');
  return job;
};

const makeMulterFile = async (row: BulkImportRow): Promise<Express.Multer.File> => {
  if (!row.matchedFilePath) throw new ApiError(400, 'Matched audio file missing');
  const stat = await fs.promises.stat(row.matchedFilePath);
  return {
    fieldname: 'audio',
    originalname: row.audioFilename,
    encoding: '7bit',
    mimetype: 'audio/mpeg',
    size: stat.size,
    destination: path.dirname(row.matchedFilePath),
    filename: path.basename(row.matchedFilePath),
    path: row.matchedFilePath,
    buffer: Buffer.alloc(0),
    stream: fs.createReadStream(row.matchedFilePath),
  };
};

const processJob = async (jobId: string, userId: string) => {
  const job = await BulkImportJob.findById(jobId);
  if (!job) return;

  job.status = BULK_IMPORT_STATUS.PROCESSING;
  job.startedAt = new Date();
  await job.save();

  try {
    for (const row of job.rows) {
      if (row.rowStatus !== BULK_IMPORT_ROW_STATUS.VALID) continue;

      row.rowStatus = BULK_IMPORT_ROW_STATUS.IMPORTING;
      await job.save();

      try {
        const existingTitle = await Song.findOne({
          title: row.title,
          artist: row.artist,
        }).select('_id');
        if (existingTitle) {
          row.warnings.push('A song with the same title and artist already exists');
        }

        const song = await songService.createSong({
          title: row.title,
          artist: row.artist,
          album: row.album,
          description: row.description,
          genre: row.genre,
          mood: row.mood,
          tags: row.tags,
          bpm: row.bpm,
          key: row.key,
          language: row.language,
          releaseDate: row.releaseDate?.toISOString(),
          isDownloadable: row.isDownloadable,
          status: row.status,
        }, userId);

        const file = await makeMulterFile(row);
        await songService.uploadAndProcessAudio(song._id.toString(), file, {
          triggerCyanite: job.triggerCyanite,
        });

        row.importedSong = song._id;
        row.rowStatus = BULK_IMPORT_ROW_STATUS.IMPORTED;
        row.processedAt = new Date();
      } catch (error) {
        row.rowStatus = BULK_IMPORT_ROW_STATUS.FAILED;
        row.errors.push(error instanceof Error ? error.message : 'Import failed');
      }

      job.summary = summarize(job.rows, job.stemRows);
      await job.save();
    }

    const importedTracks = new Map<string, Types.ObjectId>();
    job.rows.forEach((row) => {
      if (row.importedSong) {
        importedTracks.set(normalizeName(row.audioFilename), row.importedSong);
      }
    });

    for (const row of job.stemRows) {
      if (row.rowStatus !== BULK_IMPORT_ROW_STATUS.VALID) continue;

      row.rowStatus = BULK_IMPORT_ROW_STATUS.IMPORTING;
      await job.save();

      try {
        const targetSong = row.targetSong
          ?? importedTracks.get(normalizeName(row.trackReference));
        if (!targetSong) {
          throw new ApiError(
            400,
            'The referenced track was not imported successfully',
          );
        }
        if (!row.matchedFilePath) {
          throw new ApiError(400, 'Matched stem audio file is missing');
        }

        const stem = await createStemFromFile({
          songId: targetSong.toString(),
          displayName: row.displayName,
          type: row.stemType,
          originalFilename: row.stemFilename,
          filePath: row.matchedFilePath,
          sortOrder: row.sortOrder,
          uploadedBy: userId,
        });

        row.targetSong = targetSong;
        row.importedStem = stem._id;
        row.rowStatus = BULK_IMPORT_ROW_STATUS.IMPORTED;
        row.processedAt = new Date();
      } catch (error) {
        row.rowStatus = BULK_IMPORT_ROW_STATUS.FAILED;
        row.errors.push(error instanceof Error ? error.message : 'Stem import failed');
      }

      job.summary = summarize(job.rows, job.stemRows);
      await job.save();
    }

    job.status = BULK_IMPORT_STATUS.COMPLETED;
    job.completedAt = new Date();
    job.summary = summarize(job.rows, job.stemRows);
    await job.save();
  } catch (error) {
    job.status = BULK_IMPORT_STATUS.FAILED;
    job.error = error instanceof Error ? error.message : 'Bulk import failed';
    job.completedAt = new Date();
    job.summary = summarize(job.rows, job.stemRows);
    await job.save();
    logger.error({ error, jobId }, 'Bulk import job failed');
  }
};

export const startImport = async (
  id: string,
  userId: string,
): Promise<BulkImportJobDocument> => {
  const job = await getJob(id);
  if (job.status === BULK_IMPORT_STATUS.PROCESSING) {
    throw new ApiError(409, 'Bulk import job is already processing');
  }

  const importableRows = job.rows.filter((row) => row.rowStatus === BULK_IMPORT_ROW_STATUS.VALID);
  const importableStemRows = job.stemRows.filter(
    (row) => row.rowStatus === BULK_IMPORT_ROW_STATUS.VALID,
  );
  if (!importableRows.length && !importableStemRows.length) {
    throw new ApiError(400, 'No valid new rows are available to import');
  }

  void processJob(job._id.toString(), userId).catch((error) => {
    logger.error({ error, jobId: job._id.toString() }, 'Bulk import background task failed');
  });

  return job;
};

const csvValue = (value: unknown): string => {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export const buildReportCsv = async (id: string): Promise<string> => {
  const job = await getJob(id);
  const headers = [
    'recordType',
    'rowNumber',
    'filename',
    'trackReference',
    'title',
    'artist',
    'status',
    'importedSong',
    'errors',
    'warnings',
  ];
  const lines = [headers.join(',')];
  job.rows.forEach((row) => {
    lines.push([
      'track',
      row.rowNumber,
      row.audioFilename,
      '',
      row.title,
      row.artist,
      row.rowStatus,
      row.importedSong ? String(row.importedSong) : '',
      row.errors.join('; '),
      row.warnings.join('; '),
    ].map(csvValue).join(','));
  });
  job.stemRows.forEach((row) => {
    lines.push([
      'stem',
      row.rowNumber,
      row.stemFilename,
      row.trackReference,
      row.displayName,
      row.stemType,
      row.rowStatus,
      row.importedStem ? String(row.importedStem) : '',
      row.errors.join('; '),
      row.warnings.join('; '),
    ].map(csvValue).join(','));
  });
  return lines.join('\n');
};
