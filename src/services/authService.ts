/** Firebase Authentication operations + Firestore user profile. */
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendEmailVerification,
  reload,
  getIdToken,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, type Timestamp } from 'firebase/firestore';
import { auth } from './auth';
import { db } from './firebase';
import type { BiologicalSex } from './healthCalculations';

export type EcoFitUserProfile = {
  uid: string;
  name: string;
  email: string;
  heightCm: number | null;
  weightKg: number | null;
  goal: string | null;
  sex?: BiologicalSex | null;
  birthDate?: string | null;
  bodyFatMeasuredPercent?: number | null;
  setupComplete?: boolean;
  activityFactor?: number | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export async function registerUser(email: string, password: string, name: string): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Vui lòng nhập họ tên.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Email không hợp lệ.');
  }
  if (password.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');

  // Firebase Auth stores passwords; never store them in Firestore.
  const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  const user = credential.user;

  // Creating an account signs the user in temporarily.
  // Send verification first; Firestore profile is created ONLY after verified login.
  // Firestore Rules intentionally block profile reads/writes before verification.
  try {
    await updateProfile(user, { displayName: cleanName });
    await sendEmailVerification(user);
  } finally {
    await signOut(auth);
  }
  return user;
}

export async function ensureUserProfile(user: User, name?: string): Promise<void> {
  const ref = doc(db, 'users', user.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return;
  await setDoc(ref, {
    uid: user.uid,
    name: (name ?? user.displayName ?? '').trim(),
    email: user.email ?? '',
    heightCm: null,
    weightKg: null,
    goal: null,
    sex: null,
    birthDate: null,
    bodyFatMeasuredPercent: null,
    setupComplete: false,
    activityFactor: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function loginUser(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  const user = credential.user;
  try {
    // Cached emailVerified may be stale after clicking the link on another device.
    await reload(user);
    if (!user.emailVerified) {
      const error = new Error('Bạn phải xác minh email trong hộp thư trước khi đăng nhập.') as Error & { code: string };
      error.code = 'auth/email-not-verified';
      throw error;
    }
    await getIdToken(user, true);
    await ensureUserProfile(user);
    return user;
  } catch (error) {
    // On a failed verification check, never leave an unverified session open.
    if (!user.emailVerified) await signOut(auth);
    throw error;
  }
}

export async function resendVerificationWithCredentials(email: string, password: string): Promise<void> {
  const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  try {
    await reload(credential.user);
    if (credential.user.emailVerified) {
      throw new Error('Email đã được xác minh. Bạn có thể đăng nhập.');
    }
    await sendEmailVerification(credential.user);
  } finally {
    await signOut(auth);
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export function observeAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function getUserProfile(uid: string): Promise<EcoFitUserProfile | null> {
  const current = auth.currentUser;
  if (!current || current.uid !== uid) throw new Error('Không có quyền đọc hồ sơ này.');
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    uid: snapshot.id,
    name: typeof data.name === 'string' ? data.name : '',
    email: typeof data.email === 'string' ? data.email : '',
    heightCm: typeof data.heightCm === 'number' ? data.heightCm : null,
    weightKg: typeof data.weightKg === 'number' ? data.weightKg : null,
    goal: typeof data.goal === 'string' ? data.goal : null,
    sex: data.sex === 'male' || data.sex === 'female' ? data.sex : null,
    birthDate: typeof data.birthDate === 'string' ? data.birthDate : null,
    bodyFatMeasuredPercent: typeof data.bodyFatMeasuredPercent === 'number' ? data.bodyFatMeasuredPercent : null,
    setupComplete: data.setupComplete === true,
    activityFactor: typeof data.activityFactor === 'number' ? data.activityFactor : null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function sendVerificationEmail(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Bạn chưa đăng nhập.');
  if (!user.emailVerified) await sendEmailVerification(user);
}

export async function refreshVerification(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) throw new Error('Bạn chưa đăng nhập.');
  await reload(user);
  if (user.emailVerified) {
    await getIdToken(user, true); // refresh email_verified claim for Firestore rules
    await ensureUserProfile(user);
  }
  return user.emailVerified;
}

export async function saveHealthProfile(uid: string, values: {
  sex?: BiologicalSex;
  birthDate?: string;
  heightCm?: number;
  weightKg?: number;
  bodyFatMeasuredPercent?: number;
  setupComplete?: boolean;
  activityFactor?: number | null;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.uid !== uid || !user.emailVerified) throw new Error('Cần xác minh email để lưu hồ sơ.');
  await updateDoc(doc(db, 'users', uid), { ...values, updatedAt: serverTimestamp() });
}

export async function changeDisplayName(uid: string, name: string): Promise<void> {
  const user = auth.currentUser;
  const clean = name.trim();
  if (!user || user.uid !== uid || !user.emailVerified) throw new Error('Cần xác minh email.');
  if (!clean || clean.length > 60) throw new Error('Tên cần từ 1 đến 60 ký tự.');
  await updateDoc(doc(db, 'users', uid), { name: clean, updatedAt: serverTimestamp() });
  await updateProfile(user, { displayName: clean });
}
