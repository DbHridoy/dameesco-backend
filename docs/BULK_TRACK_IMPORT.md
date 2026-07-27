# Bulk Track Import Behavior

This document describes the current SONAR bulk track import workflow across the
admin dashboard and backend.

## Purpose

Bulk import lets an admin:

1. Download the metadata template.
2. Prepare an XLSX or CSV metadata file.
3. Package the corresponding audio files in a ZIP archive.
4. Validate both files before creating any tracks.
5. Review row-level errors and warnings.
6. Import valid tracks into MongoDB and upload their audio assets to S3.
7. Monitor progress and download a final CSV report.

The dashboard route is:

```text
/music-catalog/bulk-import
```

Bulk Import is intentionally accessed from Music Catalog and Upload Track. It
is not a sidebar item.

## Operator Flow

### 1. Download the template

Click **Download Template** to download `tracks-template.xlsx`.

The workbook contains one sheet named `Tracks` and one example row. The first
row must contain the supported column names.

### 2. Prepare the metadata

One spreadsheet row represents one track.

| Column | Required | Behavior |
| --- | --- | --- |
| `audioFilename` | Yes | Must match an audio filename inside the ZIP. Matching is case-insensitive and uses the basename, so nested ZIP folders are allowed. |
| `title` | Yes | Track title. Used with `audioFilename` for import duplicate detection. |
| `artist` | Yes | Artist or composer name. |
| `album` | No | Album or collection name. |
| `description` | No | Track description. |
| `genre` | No | Primary genre. |
| `mood` | No | Primary mood. |
| `tags` | No | Comma-separated tags. At most 30 tags are stored. |
| `bpm` | No | Whole number from 20 through 400. |
| `key` | No | Musical key, for example `A Minor`. |
| `language` | No | Language or a value such as `Instrumental`. |
| `releaseDate` | No | Any date value that JavaScript can parse reliably; `YYYY-MM-DD` is recommended. |
| `isDownloadable` | No | Defaults to `true`. Use `true` or `false` explicitly. |
| `status` | No | `draft`, `published`, or `archived`. Defaults to `draft`. |

Do not rename template headers. Only the first worksheet is read from an XLSX
file.

### 3. Prepare the audio ZIP

Supported audio extensions are:

```text
.mp3, .wav, .flac, .aac, .m4a, .ogg
```

The files may be in folders inside the ZIP. Each `audioFilename` value must
identify exactly one file by filename.

The upload middleware allows each uploaded bulk-import file to be up to 1 GB.
Deployment proxies or hosting providers may impose a smaller request limit.

### 4. Validate

Select both files and click **Validate Files**.

Validation performs the following work without importing tracks:

- Confirms that the upload contains one ZIP and one XLSX or CSV file.
- Extracts supported audio files into a job-specific temporary directory.
- Matches spreadsheet rows to ZIP files.
- Validates required values, BPM, release date, and status.
- Detects duplicate `audioFilename + title` combinations in the spreadsheet.
- Detects rows already imported by an earlier bulk-import job.
- Reports audio files in the ZIP that are not referenced by the spreadsheet.
- Creates a persistent MongoDB `BulkImportJob` containing the preview results.

The dashboard displays summary counts and every row's errors and warnings.

### 5. Review the preview

Row statuses have these meanings:

| Status | Meaning |
| --- | --- |
| `valid` | Ready to import. |
| `invalid` | Has a validation error and will not be imported. |
| `skipped` | The same `audioFilename + title` was imported previously. |
| `importing` | Currently being processed. |
| `imported` | Song and audio processing completed successfully. |
| `failed` | Import started but failed for this row. |

Warnings do not prevent a valid row from importing. Errors do.

To correct invalid rows, update the spreadsheet or ZIP and run validation
again. The current preview does not support inline metadata editing.

### 6. Import

Click **Import N Valid** to start the import.

Only rows currently marked `valid` are processed. For each row, the backend:

1. Checks whether a song with the same title and artist already exists and
   records a warning if found.
2. Creates the Song document in MongoDB.
3. Uploads and processes the original audio through the normal song audio
   workflow.
4. Creates the preview and watermarked audio assets.
5. Uploads generated assets to S3 and updates the Song document.
6. Marks the row as `imported`, or records the failure message.

Rows are processed sequentially. One failed row does not stop later valid rows.

Cyanite analysis is currently disabled for bulk import
(`triggerCyanite: false`). It can be triggered separately after import.

### 7. Monitor and download the report

The dashboard polls the job every 2.5 seconds while it is available. Job
statuses are:

| Status | Meaning |
| --- | --- |
| `validated` | Preview is ready and import has not started. |
| `processing` | Valid rows are being imported. |
| `completed` | Every importable row has been attempted. |
| `failed` | The job-level processing loop stopped unexpectedly. |

The **Report** button downloads a CSV containing row number, filename, title,
artist, final row status, imported Song ID, errors, and warnings.

## Backend API

All endpoints require an authenticated `ADMIN` or `SUPER_ADMIN`.

Base path:

```text
/api/v1/songs/bulk-import
```

| Method | Endpoint | Behavior |
| --- | --- | --- |
| `GET` | `/template` | Downloads `tracks-template.xlsx`. |
| `POST` | `/validate` | Accepts multipart fields `audioZip` and `metadata`, validates them, and returns a job. |
| `GET` | `/jobs/:id` | Returns current job, row, summary, and progress data. |
| `POST` | `/jobs/:id/import` | Starts background processing and returns HTTP 202. |
| `GET` | `/jobs/:id/report` | Downloads the job report as CSV. |

Example validation request:

```bash
curl -X POST "$API_URL/api/v1/songs/bulk-import/validate" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "audioZip=@tracks.zip" \
  -F "metadata=@tracks-template.xlsx"
```

## Duplicate Rules

Bulk-import identity is the normalized combination:

```text
lowercase(basename(audioFilename)) + lowercase(trim(title))
```

- A duplicate inside the same spreadsheet is invalid.
- A combination imported by an earlier job is skipped only while its linked
  Song still exists. Deleting that Song allows the same files to be imported
  again.
- An existing Song with the same title and artist only produces a warning; it
  does not block import.

This means duplicate rules are specific to bulk-import history and do not
guarantee global Song uniqueness.

## Current Operational Limitations

- Temporary ZIP, spreadsheet, and extracted audio files are stored under
  `tmp/bulk-imports` on the backend instance.
- Temporary job files are not currently deleted automatically.
- Import processing runs inside the API process rather than a durable queue.
- A server restart or an ephemeral Render filesystem reset can interrupt a
  running job and remove files required to resume it.
- If Song creation succeeds but audio processing fails, the row is marked
  failed but the partially created Song may remain and require admin cleanup.
- Rows with completely empty required values may fail MongoDB job persistence
  instead of always appearing as normal row-level validation errors.
- There is no cancel, retry-failed-row, resume, or rollback operation yet.
- Cyanite analysis is not automatically queued.

For production-grade long-running imports, move temporary inputs to durable
object storage and execute each row through a persistent worker queue.
