import { registerPlugin } from '@capacitor/core';

export const TifloUpdate = registerPlugin('TifloUpdate');

export async function checkForUpdate(plugin = TifloUpdate) {
  try {
    const info = await plugin.check();
    return {
      available: info?.available === true,
      availability: Number(info?.availability || 0),
      versionCode: Number(info?.versionCode || 0),
      priority: Number(info?.priority || 0),
      flexibleAllowed: info?.flexibleAllowed === true,
      immediateAllowed: info?.immediateAllowed === true,
      installStatus: Number(info?.installStatus || 0)
    };
  } catch {
    return {
      available: false,
      availability: 0,
      versionCode: 0,
      priority: 0,
      flexibleAllowed: false,
      immediateAllowed: false,
      installStatus: 0
    };
  }
}
