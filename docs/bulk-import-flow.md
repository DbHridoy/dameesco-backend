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
6. Add valid tracks and stems into the music library.

## Operator Flow

### 1. Download the template

Click **Download Template** to download `tracks-template.xlsx`.

The workbook contains `Tracks` and `Stems` sheets with example rows. The first
row of each sheet must contain the supported column names.

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
| `trackLanguage` | No | Language or a value such as `Instrumental`. |
| `releaseDate` | No | Any date value that JavaScript can parse reliably; `YYYY-MM-DD` is recommended. |
| `isDownloadable` | No | Defaults to `true`. Use `true` or `false` explicitly. |
| `status` | No | `draft`, `published`, or `archived`. Defaults to `draft`. |

Do not rename template headers. The legacy `language` header is not supported.

### 3. Prepare stem metadata

Each row in the optional `Stems` sheet represents one downloadable stem.

| Column | Required | Behavior |
| --- | --- | --- |
| `trackReference` | Yes | A master `audioFilename` in the `Tracks` sheet, an existing Song ID, or an existing Song slug. |
| `stemFilename` | Yes | Must match an audio filename inside the ZIP. |
| `stemType` | Yes | Free-form type such as `Drums`, `Bass`, `Vocals`, or `Instrumental`. |
| `displayName` | No | User-facing name. Defaults to `stemType`. |
| `sortOrder` | No | Non-negative whole number. Defaults to `0`. |

### 4. Prepare the audio ZIP

Supported audio extensions are:

```text
.mp3, .wav, .flac, .aac, .m4a, .ogg
```

The files may be in folders inside the ZIP. Master and stem filename values
are matched case-insensitively by basename.

### 5. Validate

Select both files and click **Validate Files**.

Validation performs the following work without importing tracks:

- Confirms that the upload contains one ZIP and one XLSX or CSV file.
- Extracts supported audio files into a job-specific temporary directory.
- Matches spreadsheet rows to ZIP files.
- Resolves stem targets from the current workbook or existing catalog.
- Detects duplicate stems for a track and skips them.
- Validates required values, BPM, release date, and status.
- Detects duplicate `audioFilename + title` combinations in the spreadsheet.
- Detects rows already imported by an earlier bulk-import job.
- Reports audio files in the ZIP that are not referenced by the spreadsheet.
- Creates a persistent MongoDB `BulkImportJob` containing the preview results.

The dashboard displays separate track and stem summaries plus every row's
errors and warnings. A stem error does not invalidate its master track.

### 6. Review the preview

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
again.

### 7. Import

Click **Import N Valid** to start the import.

Only rows currently marked `valid` are processed. Tracks are processed first,
then valid stems. For each track, the backend:

1. Checks whether a song with the same title and artist already exists and
   records a warning if found.
2. Creates the Song document in MongoDB.
3. Uploads and processes the original audio through the normal song audio
   workflow.
4. Creates the preview and watermarked audio assets.
5. Uploads generated assets to S3 and updates the Song document.
6. Marks the row as `imported`, or records the failure message.

When **Run Cyanite analysis** is selected before validation, each successfully
uploaded master track also starts Cyanite analysis through the normal audio
processing workflow. Stem files are not sent to Cyanite.

For each stem, the backend uploads the private audio asset to S3 and creates a
Stem document linked to the Song. If a new master track fails, its stems fail
with a dependency error. One failed row does not stop later valid rows.



### 8. Monitor and download the report

statuses are:

| Status | Meaning |
| --- | --- |
| `validated` | Preview is ready and import has not started. |
| `processing` | Valid rows are being imported. |
| `completed` | Every importable row has been attempted. |
| `failed` | The job-level processing loop stopped unexpectedly. |

The **Report** button downloads a combined CSV containing track and stem row
results, imported IDs, errors, and warnings.

## Duplicate Rules


- A duplicate inside the same spreadsheet is invalid.
- A combination imported by an earlier job is skipped only while its linked
  Song still exists. Deleting that Song allows the same files to be imported
  again.
- An existing Song with the same title and artist only produces a warning; it
  does not block import.
- A stem filename must be unique within its parent Song. To replace a stem,
  delete the existing stem from Track Inventory and import the replacement.

## Stem Access

- All users can see available stem names for published tracks.
- Individual stem downloads require active paid access.
- Each stem download uses one download allowance.
- Admins can download or delete stems from Track Inventory.
