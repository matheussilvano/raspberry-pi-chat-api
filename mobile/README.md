# Raspberry Pi Face Mobile

React Native Android app for the Raspberry Pi Face API.

## Requirements

- Node.js 18+
- JDK 17 for native Android builds
- Android Studio or an Android device with Expo Go
- Backend running from the repository root:
  ```bash
  uvicorn main:app --host 0.0.0.0 --reload
  ```

## Setup

```bash
npm install
npm run android:expo
```

For a local Android emulator, keep the API URL as:

```text
http://10.0.2.2:8000
```

For a physical Android phone, use the computer or Raspberry Pi LAN IP, for example:

```text
http://192.168.0.50:8000
```

## Build a native Android project

```bash
npm run android
```

The app lets you:

- Configure and persist the FastAPI backend URL.
- Capture or select an image to recognize faces.
- Capture or select an image to register a person.
- View the latest recognition, registered faces, recent recognitions, and received photos.
