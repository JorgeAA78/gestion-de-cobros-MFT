import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mft.cobros',
  appName: 'Cobros MFT',
  webDir: 'dist',
  server: {
    url: 'https://gestion-de-cobros-mft-production.up.railway.app',
    cleartext: false,
    androidScheme: 'https'
  }
};

export default config;
