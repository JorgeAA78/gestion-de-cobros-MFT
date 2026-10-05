import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mft.cobros',
  appName: 'Cobros MFT',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
