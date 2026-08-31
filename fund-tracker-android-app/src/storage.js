import { Preferences } from '@capacitor/preferences';

// Simple async key/value wrapper around Capacitor's Preferences plugin.
// Data lives on-device only (private to whoever installed the app on that phone).
export async function getItem(key) {
  try {
    const { value } = await Preferences.get({ key });
    return value; // string or null
  } catch (e) {
    return null;
  }
}

export async function setItem(key, value) {
  try {
    await Preferences.set({ key, value });
    return true;
  } catch (e) {
    return false;
  }
}
