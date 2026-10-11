import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  writeBatch,
  setLogLevel,
  disableNetwork,
  enableNetwork,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { User, UserRole } from '../types';

// Silence internal @firebase/firestore backoff console.error spam when free-tier daily quota is reached
try {
  setLogLevel('silent');
} catch {
  // ignore
}

const app = initializeApp(firebaseConfig);
export const dbFirestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

const QUOTA_STORAGE_KEY = 'thcs_dt_firestore_quota_v2_day';
const FORCE_RETRY_KEY = 'thcs_dt_firestore_force_retry';
let quotaExhaustedInMemory = false;
let networkDisabledForQuota = false;

// Clear legacy false-positive quota key so all home and school browsers reconnect immediately
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('thcs_dt_firestore_quota_exhausted_day');
  } catch {
    // ignore
  }
}

function getTodayUTCDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isFirestoreQuotaExhausted(): boolean {
  if (quotaExhaustedInMemory) return true;
  if (typeof window !== 'undefined') {
    try {
      const todayKey = getTodayUTCDateKey();
      const savedDay = localStorage.getItem(QUOTA_STORAGE_KEY);
      if (savedDay === todayKey && localStorage.getItem(FORCE_RETRY_KEY) !== todayKey) {
        quotaExhaustedInMemory = true;
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

export function markFirestoreQuotaExhausted(): void {
  quotaExhaustedInMemory = true;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(QUOTA_STORAGE_KEY, getTodayUTCDateKey());
      localStorage.removeItem(FORCE_RETRY_KEY);
    } catch {
      // ignore
    }
  }
  if (!networkDisabledForQuota) {
    networkDisabledForQuota = true;
    disableNetwork(dbFirestore).catch(() => {});
  }
}

export async function resetFirestoreQuotaCircuitBreaker(): Promise<void> {
  quotaExhaustedInMemory = false;
  networkDisabledForQuota = false;
  if (typeof window !== 'undefined') {
    try {
      const todayKey = getTodayUTCDateKey();
      localStorage.removeItem(QUOTA_STORAGE_KEY);
      localStorage.removeItem('thcs_dt_firestore_quota_exhausted_day');
      localStorage.setItem(FORCE_RETRY_KEY, todayKey);
    } catch {
      // ignore
    }
  }
  try {
    await enableNetwork(dbFirestore);
  } catch {
    // ignore
  }
}

// Intercept any residual @firebase/firestore resource-exhausted console errors and trip the circuit breaker immediately
if (typeof window !== 'undefined') {
  const isQuotaMessage = (args: any[]) => {
    const text = args
      .map((a) => {
        if (typeof a === 'string') return a;
        if (a instanceof Error) return a.message;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a || '');
        }
      })
      .join(' ');
    return (
      text.includes('resource-exhausted') ||
      text.includes('Quota limit exceeded') ||
      text.includes('Free daily write units')
    );
  };

  const origConsoleError = console.error.bind(console);
  console.error = (...args: any[]) => {
    if (isQuotaMessage(args)) {
      markFirestoreQuotaExhausted();
      return;
    }
    origConsoleError(...args);
  };

  const origConsoleWarn = console.warn.bind(console);
  console.warn = (...args: any[]) => {
    if (isQuotaMessage(args)) {
      markFirestoreQuotaExhausted();
      return;
    }
    origConsoleWarn(...args);
  };

  if (isFirestoreQuotaExhausted()) {
    networkDisabledForQuota = true;
    disableNetwork(dbFirestore).catch(() => {});
  } else {
    enableNetwork(dbFirestore).catch(() => {});
  }
}

/**
 * Executes a Firestore write promise with a timeout guard.
 * Note: A slow network timeout does NOT mark daily quota exhausted; only actual resource-exhausted errors do.
 */
export async function executeFirestoreWriteWithGuard<T>(
  writeFn: () => Promise<T>,
  timeoutMs = 10000
): Promise<T | null> {
  if (isFirestoreQuotaExhausted()) {
    return null;
  }
  let timer: any = null;
  try {
    const timeoutPromise = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        resolve(null);
      }, timeoutMs);
    });
    const result = await Promise.race([writeFn(), timeoutPromise]);
    return result;
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (
      msg.includes('resource-exhausted') ||
      msg.includes('Quota limit exceeded') ||
      err?.code === 'resource-exhausted'
    ) {
      markFirestoreQuotaExhausted();
      return null;
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Operational Error Logging conforming to Firestore Zero-Trust Guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errMsg = error instanceof Error ? error.message : String(error);
  if (
    errMsg.includes('resource-exhausted') ||
    errMsg.includes('Quota limit exceeded') ||
    errMsg.includes('offline') ||
    isFirestoreQuotaExhausted()
  ) {
    markFirestoreQuotaExhausted();
    return;
  }
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore notice:', JSON.stringify(errInfo));
}

// Connection validation test required by Firebase integration skill
export async function testConnection(): Promise<boolean> {
  try {
    if (isFirestoreQuotaExhausted()) return false;
    if (!auth.currentUser) return true;
    await getDocFromServer(doc(dbFirestore, 'test', 'connection'));
    return true;
  } catch (error: any) {
    const msg = String(error?.message || error || '');
    if (msg.includes('resource-exhausted') || msg.includes('Quota limit exceeded')) {
      markFirestoreQuotaExhausted();
    }
    return false;
  }
}

// Clean object helper: removes undefined keys before sending to Firestore
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      clean[key] = sanitizeForFirestore(value);
    } else if (Array.isArray(value)) {
      clean[key] = value.map(item => (item !== null && typeof item === 'object' ? sanitizeForFirestore(item) : item));
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

// Google Sign In
export const loginWithGoogle = async (): Promise<User> => {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  return await syncOrCreateUserProfile(user);
};

// Email & Password Sign In
export const loginWithEmail = async (email: string, pass: string): Promise<User> => {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return await syncOrCreateUserProfile(result.user);
};

// Email & Password Registration
export const registerWithEmail = async (
  email: string,
  pass: string,
  fullName: string,
  role: UserRole = 'medic'
): Promise<User> => {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  await updateProfile(result.user, { displayName: fullName });
  return await syncOrCreateUserProfile(result.user, { fullName, role });
};

// Helper to ensure user profile exists in Firestore /users/{userId}
export async function syncOrCreateUserProfile(
  user: FirebaseUser,
  defaults?: { fullName?: string; role?: UserRole }
): Promise<User> {
  const isAdminEmail = user.email === 'minhtrangdongthanh@gmail.com' || user.email === 'doanthiminhtrang3990@gmail.com';

  // Check if user already has customized role/permissions in local users list
  let localSavedUser: User | undefined;
  if (typeof window !== 'undefined') {
    try {
      const rawUsers = localStorage.getItem('thcs_dongthanh_users_v1');
      if (rawUsers) {
        const parsed: User[] = JSON.parse(rawUsers);
        if (Array.isArray(parsed)) {
          localSavedUser = parsed.find(
            (u) => u.id === user.uid || (user.email && u.email?.toLowerCase() === user.email.toLowerCase())
          );
        }
      }
    } catch {
      // ignore
    }
  }

  const rawRole =
    defaults?.role ||
    localSavedUser?.role ||
    (isAdminEmail ? 'admin' : 'medic');
  const role: UserRole = rawRole === 'admin' || rawRole === 'bgh' ? 'admin' : 'medic';

  const fallbackUser: User = {
    id: role === 'admin' ? 'role-admin' : 'role-medic',
    username: role === 'admin' ? 'quantri' : 'nhanvien_yte',
    fullName: role === 'admin' ? 'Quản trị' : 'Nhân viên Y tế',
    email: user.email || localSavedUser?.email || '',
    role: role,
    phone: '',
    title: role === 'admin' ? 'Nhiệm vụ Quản trị hệ thống' : 'Nhiệm vụ Nhân viên Y tế học đường',
    department: role === 'admin' ? 'Quản trị Hệ thống' : 'Phòng Y tế Học đường',
    status: 'active',
    permissions: localSavedUser?.permissions,
    createdAt: localSavedUser?.createdAt || new Date().toISOString(),
  };

  if (isFirestoreQuotaExhausted()) {
    return fallbackUser;
  }

  const userRef = doc(dbFirestore, 'users', user.uid);
  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await executeFirestoreWriteWithGuard(() => setDoc(userRef, sanitizeForFirestore(fallbackUser), { merge: true }));
      return fallbackUser;
    } else {
      const userData = userSnap.data() as User;
      if (localSavedUser?.permissions) {
        userData.permissions = localSavedUser.permissions;
      }
      if (localSavedUser?.role) {
        userData.role = localSavedUser.role;
      } else if (isAdminEmail && userData.role !== 'admin') {
        await executeFirestoreWriteWithGuard(() => setDoc(userRef, { role: 'admin' }, { merge: true }));
        userData.role = 'admin';
      }
      return userData;
    }
  } catch {
    return fallbackUser;
  }
}

export const logout = async (): Promise<void> => {
  try {
    localStorage.removeItem('school_health_auth_session');
    localStorage.removeItem('school_health_user_cache');
    await signOut(auth);
  } catch (err) {
    console.warn('Sign out warning:', err);
    localStorage.removeItem('school_health_auth_session');
  }
};

// Helper for RoleManagement to read users from Firestore
export async function getUsers(): Promise<User[]> {
  if (isFirestoreQuotaExhausted()) return [];
  try {
    const usersCol = collection(dbFirestore, 'users');
    const snap = await getDocs(usersCol);
    const users: User[] = [];
    snap.forEach((docSnap) => {
      users.push(docSnap.data() as User);
    });
    return users;
  } catch {
    return [];
  }
}

// Helper for RoleManagement to update user role and permissions (uses setDoc merge so local-only users also persist)
export async function updateUserRole(userId: string, role: UserRole, fullUserData?: Partial<User>): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;
  try {
    const userRef = doc(dbFirestore, 'users', userId);
    const payload: Record<string, any> = {
      id: userId,
      role,
      updatedAt: new Date().toISOString(),
    };
    if (fullUserData) {
      if (fullUserData.fullName !== undefined) payload.fullName = fullUserData.fullName;
      if (fullUserData.username !== undefined) payload.username = fullUserData.username;
      if (fullUserData.email !== undefined) payload.email = fullUserData.email;
      if (fullUserData.phone !== undefined) payload.phone = fullUserData.phone;
      if (fullUserData.permissions !== undefined) payload.permissions = fullUserData.permissions;
      if (fullUserData.status !== undefined) payload.status = fullUserData.status;
      if (fullUserData.title !== undefined) payload.title = fullUserData.title;
      if (fullUserData.department !== undefined) payload.department = fullUserData.department;
    }
    await executeFirestoreWriteWithGuard(() => setDoc(userRef, sanitizeForFirestore(payload), { merge: true }));
  } catch {
    // ignore
  }
}

// Helper for RoleManagement to save new user to Firestore
export async function saveUserToFirebase(user: User): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;
  try {
    const userRef = doc(dbFirestore, 'users', user.id);
    await executeFirestoreWriteWithGuard(() => setDoc(userRef, sanitizeForFirestore(user), { merge: true }));
  } catch {
    // ignore
  }
}

// Helper for RoleManagement to delete a user from Firestore
export async function deleteUserFromFirebase(userId: string): Promise<void> {
  if (!userId || isFirestoreQuotaExhausted()) return;
  try {
    const userRef = doc(dbFirestore, 'users', userId);
    await executeFirestoreWriteWithGuard(() => deleteDoc(userRef));
  } catch {
    // ignore
  }
}
