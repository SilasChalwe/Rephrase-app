# Rephrase App

Rephrase is a chat application with a Firebase-authenticated mobile client and a Firebase/Vercel-backed API.

## Project layout

- `api/` contains the Express.js backend.
- `mobile-app/` contains the Expo/React Native frontend.

## Configuration

- Backend config lives in `api/.env.example` and the local `api/.env` file.
- Frontend config lives in `mobile-app/setting.env.example` and the local `mobile-app/setting.env` file.

## Run locally

1. Install dependencies in each folder:
   `cd api && npm install`
   `cd mobile-app && npm install`
2. Add your Firebase Admin service-account JSON for the API and update both env files.
3. Start the API:
   `cd api && npm run dev`
4. Start the mobile app:
   `cd mobile-app && npm start`

## Android Release Builds

- Push a Git tag to trigger the Android APK workflow in [.github/workflows/android-production-apk.yml](/home/silas/repo/Rephrase-app/.github/workflows/android-production-apk.yml).
- The workflow builds the Expo app with the `production-apk` EAS profile in [mobile-app/eas.json](/home/silas/repo/Rephrase-app/mobile-app/eas.json).
