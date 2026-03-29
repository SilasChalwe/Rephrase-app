# Rephrase API

This folder contains the Express backend for Rephrase. It is now set up for Vercel serverless hosting and uses Vercel Blob for file uploads.

## Stack

- Node.js 18+
- Express
- Firebase Admin SDK
- Firestore
- Vercel Blob
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

3. For local Firebase Admin auth, either:

- point `FIREBASE_SERVICE_ACCOUNT_PATH` at a local service-account JSON file, or
- paste the JSON into `FIREBASE_SERVICE_ACCOUNT_JSON`

4. Start the API:

```bash
npm run dev
```

The local server listens on `http://localhost:8080` by default.

## Vercel deployment

Deploy the `api` folder as its own Vercel project root. The serverless entrypoint is [src/index.js](/home/silas/repo/Rephrase-app/api/src/index.js), which exports the Express app for Vercel Functions.

Set these Vercel environment variables:

- `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_JSON_AES256`
- `AES_256_SECRET_KEY_HEX` if you use the encrypted Firebase JSON value
- `FIREBASE_DATABASE_URL` if your project uses Realtime Database
- `STORAGE_PROVIDER=vercel-blob`
- `STORAGE_ACCESS=public`
- `BLOB_READ_WRITE_TOKEN` or `STORAGE_READ_WRITE_TOKEN`

When you connect a Vercel Blob store to the project, Vercel normally adds `BLOB_READ_WRITE_TOKEN` for you.

## AES-256-GCM secrets

The backend can decrypt AES-256-GCM env values for:

- `FIREBASE_SERVICE_ACCOUNT_JSON_AES256`
- `STORAGE_READ_WRITE_TOKEN_AES256`

Generate an encrypted value from a plain string:

```bash
node scripts/aes256-secret.js "secret value" --generate-key
```

Generate an encrypted value from the full Firebase Admin JSON file content:

```bash
node scripts/aes256-secret.js --file=/path/to/serviceAccountKey.json --generate-key
```

Then paste the output into Vercel:

- `AES_256_SECRET_KEY_HEX=...`
- `FIREBASE_SERVICE_ACCOUNT_JSON_AES256=...`

## Upload notes

- Profile image uploads now use Vercel Blob only.
- The current app stores profile image URLs directly on the user record, so `STORAGE_ACCESS=public` is the correct setting.
- Vercel Functions accept request bodies up to 4.5 MB, so keep `MAX_UPLOAD_SIZE_MB=4` or lower.

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
