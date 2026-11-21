/** Firebase Auth singleton, persisting sessions in AsyncStorage on native devices. */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth';
// Firebase 12 may expose web-only types to TypeScript while Metro resolves the native implementation.
// @ts-expect-error React Native conditional export is missing from web declaration types
import { getReactNativePersistence } from 'firebase/auth';
import { app } from './firebase';

function initializeEcoFitAuth(): Auth {
  try {
    if (Platform.OS === 'web') {
      return initializeAuth(app, { persistence: browserLocalPersistence });
    }
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'auth/already-initialized') {
      return getAuth(app);
    }
    throw error;
  }
}

export const auth = initializeEcoFitAuth();
