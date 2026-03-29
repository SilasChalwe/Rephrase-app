# Rephrase Mobile App

This folder contains the Expo/React Native frontend for Rephrase.

## Configuration

1. Copy `setting.env.example` to `setting.env`.
2. Set `API_BASE_URL` to the Express API you want the app to use.
3. Fill in the Firebase client values used for authentication.
4. Set `FIREBASE_DATABASE_URL` to your Firebase Realtime Database URL for live chat updates.

## Run

```bash
npm install
npm start
```

For Android emulators, you will usually want `API_BASE_URL=http://10.0.2.2:8080`.

## Android Firebase

This app is currently using the JavaScript Firebase SDK from [mobile-app/firebase.js](/home/silas/repo/Rephrase-app/mobile-app/firebase.js), not a bare native Android project.

- The Android Firebase config file is [mobile-app/google-services.json](/home/silas/repo/Rephrase-app/mobile-app/google-services.json).
- Expo is pointed to that file in [mobile-app/app.json](/home/silas/repo/Rephrase-app/mobile-app/app.json).
- There is no `android/` Gradle project in the repo right now, so there is no `build.gradle` file to edit manually.

If you later run `expo prebuild` or create a native Android folder, use package name `com.covianhive.rephrase` and then add the Google services Gradle plugin plus Firebase dependencies in the generated Gradle files.

## Firebase data split

- Firestore-backed API routes are used for user profiles, friend lists, and friend requests.
- Firebase Realtime Database is used directly by the chat screen for live messages, presence, and read or delivery updates.

## Tag Builds

This repo now includes a tag-triggered GitHub Actions workflow at [android-production-apk.yml](/home/silas/repo/Rephrase-app/.github/workflows/android-production-apk.yml) that runs an EAS Android build using the `production-apk` profile in [eas.json](/home/silas/repo/Rephrase-app/mobile-app/eas.json).

When you push a Git tag, the workflow will:

- install the mobile app dependencies
- recreate `setting.env` from a GitHub secret
- recreate `google-services.json` from a GitHub secret
- start an EAS production APK build

Add these GitHub repository secrets before using it:

- `EXPO_TOKEN`
- `MOBILE_APP_SETTING_ENV`
- `ANDROID_GOOGLE_SERVICES_JSON`
