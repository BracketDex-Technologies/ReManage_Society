import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL || 'https://re-manage-society-app.vercel.app';

const config: CapacitorConfig = {
  appId: 'com.society.management',
  appName: 'ReManage Society',
  // Use CAPACITOR_SERVER_URL for a live Next.js server during packaged QA.
  // Static export to `out/` remains a Phase 8 hardening option.
  webDir: 'public',

  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith('http://'),
        },
      }
    : {}),

  android: {
    allowMixedContent: false,
    backgroundColor: '#0f172a',
    captureInput: true,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#0f172a',
      showSpinner: false,
      spinnerColor: '#6366f1',
      androidSpinnerStyle: 'large',
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
      overlaysWebView: false,
    },
  },
};

export default config;
