import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: "io.ionic.starter",
  appName: "dbase-dashboard",
  webDir: "dist",
  plugins: {
    Geolocation: {
      androidPermissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
    },
    Camera: {
      permissions: {
        android: ["CAMERA", "WRITE_EXTERNAL_STORAGE", "READ_EXTERNAL_STORAGE"],
        ios: ["camera", "photos"],
      },
    },
    BarcodeScanner: {
      android: {
        permissions: ["CAMERA"],
      },
      ios: {
        permissions: ["camera"],
      },
    },
  },
};

export default config;
