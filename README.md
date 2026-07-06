# Dameesco Backend

A production-ready REST API for the **Dameesco** music/audio platform. Users can browse, search, preview, download songs, build playlists, and submit licensing requests. Admins manage everything: users, songs, paid access, downloads, and licensing.

## Tech Stack

- **Node.js** (>= 18) + **Express.js**
- **TypeScript**
- **MongoDB** + **Mongoose**
- **JWT** auth (access + refresh) and **Bcrypt** hashing
- **Zod** for request validation
- **AWS S3** for audio/image/file storage
- **Resend** for transactional email
- **Multer** for uploads
- **FFmpeg** (via `fluent-ffmpeg`) for audio processing & watermark generation
- **Swagger / OpenAPI** for API documentation
- **Pino** for structured logging
- **Helmet**, **CORS**, **compression**, **express-rate-limit**

## Project Structure

```
src/
  app.ts                 # Express app composition
  server.ts              # Bootstrap (DB + listen)
  config/                # env, db, aws, mail, logger, swagger
  constants/             # roles, statuses, plans, etc.
  middleware/            # auth, role, error, validate, upload, rate-limit
  utils/                 # ApiError, ApiResponse, asyncHandler, pagination, ...
  modules/
    auth/                # register, login, forgot/reset password
    users/               # user model + admin management
    songs/               # songs + FFmpeg watermark pipeline
    playlists/           # playlists
    downloads/           # signed-URL downloads (free vs paid)
    licensing/           # license request workflow
    access-requests/     # manual paid access requests
    notifications/       # in-app notifications
    admin/               # dashboard, aggregated admin routes
    email/               # Resend sender + email templates
  storage/s3.service.ts  # AWS S3 wrapper
  audio/                 # FFmpeg watermark + metadata services
  routes/index.ts        # v1 router aggregator
  seed/admin.seed.ts     # Admin seed script
  types/express.d.ts     # Express module augmentation
```

## Setup

1. **Install dependencies** (pnpm recommended):

```bash
pnpm install
```

> **Note about `bcrypt`:** this package compiles a native binding on install. If `pnpm` reports `Ignored build scripts: bcrypt@5.1.1`, manually trigger the install inside the bcrypt package directory:
>
> ```bash
> cd node_modules/.pnpm/bcrypt@*/node_modules/bcrypt && npm run install
> cd ../../../../..
> ```
>
> Or run with a tool that auto-approves builds.

2. **Copy environment file**:

```bash
cp .env.example .env
# then fill in values
```

3. **Run in dev**:

```bash
pnpm dev
```

4. **Build**:

```bash
pnpm build
```

5. **Start compiled server**:

```bash
pnpm start
```

## Environment Variables

See `.env.example`. Highlights:

- `MONGODB_URI`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
- `AWS_*` for S3 access
- `RESEND_API_KEY` for email delivery via Resend
- `RESEND_FROM` or `RESEND_FROM_NAME` + `RESEND_FROM_EMAIL` for the sender identity
- `FFMPEG_PATH` — absolute path to the FFmpeg binary
- `WATERMARK_AUDIO_PATH` — path to a short audio tag used as the watermark source. If missing, the system falls back to a generated sine tone.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — used by `pnpm seed:admin`

## Seeding Admin

```bash
pnpm seed:admin
```

This creates (or promotes) an admin user using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.

## API Documentation

Swagger UI: `http://localhost:5000/api-docs`

Raw JSON: `http://localhost:5000/api-docs.json`

## Key Endpoints

All endpoints are prefixed with `/api/v1`.

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET  /auth/me`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/change-password` (auth)

### Songs

- `GET    /songs` — list (auth optional; admin sees all)
- `GET    /songs/featured`
- `GET    /songs/search?q=...`
- `GET    /songs/:idOrSlug`
- `POST   /songs` (admin)
- `PATCH  /songs/:id` (admin)
- `DELETE /songs/:id` (admin)
- `POST   /songs/:id/upload-audio` (admin, multipart `audio`)
- `POST   /songs/:id/upload-cover` (admin, multipart `cover`)
- `POST   /songs/:id/generate-watermark` (admin)
- `PATCH  /songs/:id/publish` (admin)
- `PATCH  /songs/:id/archive` (admin)

### Downloads

- `POST /downloads/songs/:songId` (auth) — returns a **signed URL**.
  - Free users → watermarked audio
  - Paid users → original audio (subject to `downloadLimit`)

### Playlists

- `POST   /playlists`
- `GET    /playlists/my`
- `GET    /playlists/:id`
- `PATCH  /playlists/:id`
- `DELETE /playlists/:id`
- `POST   /playlists/:id/songs/:songId`
- `DELETE /playlists/:id/songs/:songId`

### Licensing

- `POST /licensing/requests`
- `GET  /licensing/my-requests`
- `GET  /admin/license-requests`
- `GET  /admin/license-requests/:id`
- `PATCH /admin/license-requests/:id/status`

### Access Requests (manual paid access)

- `POST /access-requests` (multipart `paymentProof` optional)
- `GET  /access-requests/my`
- `GET  /admin/access-requests`
- `PATCH /admin/access-requests/:id/approve`
- `PATCH /admin/access-requests/:id/reject`

On approval, the user's `subscriptionStatus` is set to `paid`, with a default 1-month access window and a plan-aware `downloadLimit`. Admins can override `paidAccessEndsAt`, `downloadLimit`, and `subscriptionPlan` via the approval body.

### Notifications

- `GET    /notifications`
- `PATCH  /notifications/:id/read`
- `PATCH  /notifications/read-all`

### Admin

- `GET /admin/dashboard`
- `GET /admin/users`
- `PATCH /admin/users/:id/status`
- `PATCH /admin/users/:id/subscription`
- `GET /admin/songs/stats`
- `GET /admin/downloads`
- `GET /admin/downloads/stats`

## Response Format

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": { /* ... */ },
  "meta": { /* pagination, etc. */ }
}
```

Error:

```json
{
  "success": false,
  "message": "Error message",
  "errors": [ /* optional zod issues */ ]
}
```

## Notes on FFmpeg

- The backend expects `ffmpeg` available on the host.
- Set `FFMPEG_PATH` if it's not on `PATH`.
- `WATERMARK_AUDIO_PATH` should point to a short audio file (mp3/wav) used as the watermark tag. If the file is missing, the system falls back to a periodic sine tone (still produces an audible watermark).

## Notes on AWS S3

- Configure `AWS_*` env vars.
- Cover images are stored as public-read; all audio is served via **signed URLs** so original audio is never publicly exposed.

## Notes on Email Delivery

- The active email provider is **Resend**.
- Set `RESEND_API_KEY` and use a **verified Resend domain** for `RESEND_FROM`.
- The legacy Nodemailer/SMTP config remains in the codebase but is not used by the current sender.

## Roadmap / Pluggable Hooks

- `audio/audio-metadata.service.ts` is intentionally a thin wrapper around FFprobe. Add Cyanite AI (or any DSP provider) here without changing upstream callers.
- The download service has a single `requestSongDownload` entry point — add payment providers there later.

## License

ISC
