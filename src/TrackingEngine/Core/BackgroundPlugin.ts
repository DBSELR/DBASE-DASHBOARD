import { registerPlugin } from '@capacitor/core';

let pluginInstance: any = null;

try {
  pluginInstance = registerPlugin<any>('BackgroundGeolocation');
} catch (e) {
  console.warn('[BackgroundPlugin] registerPlugin failed or already registered, using fallback:', e);
  try {
    pluginInstance = (window as any).Capacitor?.Plugins?.BackgroundGeolocation;
  } catch {}
}

export const BackgroundGeolocation = pluginInstance;
