# Rephrase API

This folder contains the Express backend for Rephrase. It is now set up for Vercel serverless hosting and uses Vercel Blob for file uploads.

## Stack

- Node.js 18+
- Express
- Firebase Admin SDK
- Firestore
- Vercel Blob
- Firebase Realtime Database for chat, presence, and typing
- Multer for uploads

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example env file:

```bash
cp .env.example .env
```

3. For Firebase Admin auth:

- set `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` to the base64-encoded full service-account JSON

4. Start the API:

```bash
npm run dev
```

The local server listens on `http://localhost:8080` by default.

## Vercel deployment

Deploy the `api` folder as its own Vercel project root. The serverless entrypoint is [index.js](/home/silas/repo/Rephrase-app/api/api/index.js), which exports the Express app for Vercel Functions.

Set these Vercel environment variables:

- `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`
- `FIREBASE_DATABASE_URL` if your project uses Realtime Database
- `STORAGE_PROVIDER=vercel-blob`
- `STORAGE_ACCESS=public`
- `BLOB_READ_WRITE_TOKEN` or `_READ_WRITE_TOKEN`

Vercel usually gives you `BLOB_READ_WRITE_TOKEN` automatically. The backend also accepts `_READ_WRITE_TOKEN` if you prefer the shorter alias.
Base64 is only an encoding format for easier env pasting, not encryption.

## Upload notes

- Profile image uploads now use Vercel Blob only.
- The current app stores profile image URLs directly on the user record, so `STORAGE_ACCESS=public` is the correct setting.
- Vercel Functions accept request bodies up to 4.5 MB, so keep `MAX_UPLOAD_SIZE_MB=4` or lower.

## Firebase data split

- Firestore stores user profiles, friend lists, and friend requests.
- Realtime Database stores chat messages, presence, typing, and message read or delivery status.

## Key routes

- `POST /api/auth/register`
- `GET /api/auth/me`
- `GET /api/users/me`
- `PUT /api/users/me`
- `PUT /api/users/me/profile`
- `GET /api/public/users/search?q=name`
- `GET /api/friends`
- `GET /api/friends/requests/pending`
- `POST /api/friends/requests`
- `PUT /api/friends/requests/:requesterId`
- `GET /api/chat/messages/:receiverId`
- `POST /api/chat/messages/text`
- `POST /api/users/media/profile`

## Environment files

- `.env` is the local backend configuration file.
- `.env.example` is the template for local setups and Vercel env setup.
