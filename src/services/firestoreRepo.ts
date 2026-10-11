import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  getDocs,
  query,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import {
  dbFirestore,
  auth,
  sanitizeForFirestore,
  handleFirestoreError,
  OperationType,
  isFirestoreQuotaExhausted,
  markFirestoreQuotaExhausted,
  executeFirestoreWriteWithGuard,
} from './firebase';
import {
  Medicine,
  MedicineBatch,
  InventoryTransaction,
  Supplier,
  MedicalSupply,
  UsageRecord,
  InventoryCheck,
  AuditLog,
  AppSettings,
  Student,
  StudentHealthProfile,
  ClinicVisit,
  HealthEvent,
  HealthCheckup,
  SchoolClass,
  User,
  MedicineDisposal,
} from '../types';

export interface BatchWriteOp {
  subcollection: string;
  docId: string;
  data?: any;
  op: 'set' | 'delete';
}

const ADMIN_EMAILS = ['minhtrangdongthanh@gmail.com', 'doanthiminhtrang3990@gmail.com'];

/**
 * Checks if the current Firebase Auth user has permission to read/write the target userId in Firestore
 * AND the daily free-tier Firestore write quota has not been exhausted.
 */
export function isCloudSyncAllowed(userId: string): boolean {
  if (isFirestoreQuotaExhausted()) return false;
  if (!auth.currentUser) return false;
  if (auth.currentUser.uid === userId) return true;
  if (auth.currentUser.email && ADMIN_EMAILS.includes(auth.currentUser.email)) return true;
  return false;
}

/**
 * Ensures Firestore document ID strictly matches ^[a-zA-Z0-9_\-]+$ (max 128 chars)
 * so security rules never reject a single doc or an entire writeBatch.
 */
export function sanitizeDocId(rawId: string): string {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
  return cleaned || `doc-${Date.now()}`;
}

/**
 * Persist a single document in a user's isolated subcollection /users/{userId}/{subcollection}/{docId}
 */
export async function persistUserDoc(
  userId: string,
  subcollection: string,
  docId: string,
  data: any,
  op: 'set' | 'delete' = 'set'
): Promise<void> {
  if (!userId || !docId) return;
  if (!isCloudSyncAllowed(userId)) {
    // Local / unauthenticated session or quota protection mode - persistence handled in localStorage / IndexedDB
    return;
  }
  const safeId = sanitizeDocId(docId);
  const path = `users/${userId}/${subcollection}/${safeId}`;

  try {
    const docRef = doc(dbFirestore, 'users', userId, subcollection, safeId);
    if (op === 'delete') {
      await executeFirestoreWriteWithGuard(() => deleteDoc(docRef));
    } else {
      const now = new Date().toISOString();
      const payload = {
        ...data,
        id: safeId,
        userId: userId,
        updatedAt: now,
        createdAt: data?.createdAt || now,
      };
      await executeFirestoreWriteWithGuard(() =>
        setDoc(docRef, sanitizeForFirestore(payload), { merge: true })
      );
    }
  } catch (error) {
    handleFirestoreError(
      error,
      op === 'delete' ? OperationType.DELETE : OperationType.WRITE,
      path
    );
  }
}

/**
 * Persist multiple document writes atomically using Firestore writeBatch (split into 350-op chunks)
 * Stops immediately if daily free-tier write quota is reached.
 */
export async function persistUserBatch(
  userId: string,
  operations: BatchWriteOp[]
): Promise<void> {
  if (!userId || operations.length === 0) return;
  if (!isCloudSyncAllowed(userId)) {
    return;
  }

  const CHUNK_SIZE = 350;
  const now = new Date().toISOString();

  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    if (isFirestoreQuotaExhausted()) {
      break;
    }
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(dbFirestore);

    for (const op of chunk) {
      const safeId = sanitizeDocId(op.docId);
      const docRef = doc(dbFirestore, 'users', userId, op.subcollection, safeId);
      if (op.op === 'delete') {
        batch.delete(docRef);
      } else {
        const payload = {
          ...op.data,
          id: safeId,
          userId: userId,
          updatedAt: now,
          createdAt: op.data?.createdAt || now,
        };
        batch.set(docRef, sanitizeForFirestore(payload), { merge: true });
      }
    }

    try {
      await executeFirestoreWriteWithGuard(() => batch.commit(), 3500);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `users/${userId}/[batch_chunk_${i}]`
      );
      break;
    }
  }
}

/**
 * Synchronizes students, healthProfiles, and schoolClasses to Firestore using compact chunk documents
 * so 2,135+ students only consume ~8 Firestore writes instead of 4,200+ writes (preventing 20k/day quota exhaustion).
 */
export async function syncStudentCollectionsToCloud(
  userId: string,
  dataset: {
    students: Student[];
    healthProfiles: StudentHealthProfile[];
    classes: SchoolClass[];
    pruneObsolete?: boolean;
  }
): Promise<{ syncedStudents: number; syncedClasses: number; deletedObsolete: number }> {
  if (!userId || isFirestoreQuotaExhausted()) {
    return { syncedStudents: 0, syncedClasses: 0, deletedObsolete: 0 };
  }

  const nowMs = Date.now();
  await Promise.all([
    pushSharedSchoolClassesToCloud(dataset.classes || [], [], nowMs, 1),
    pushSharedStudentsToCloud(
      dataset.students || [],
      dataset.healthProfiles || [],
      nowMs,
      true,
      false,
      1
    ),
  ]);

  return {
    syncedStudents: dataset.students.length,
    syncedClasses: dataset.classes.length,
    deletedObsolete: 0,
  };
}

/**
 * Check if the user has any data already in Firestore
 */
export async function checkUserDataExists(userId: string): Promise<boolean> {
  if (!isCloudSyncAllowed(userId)) {
    return false;
  }
  try {
    const opSnap = await getDoc(doc(dbFirestore, 'schoolSync', 'thcs_dt_operational'));
    if (opSnap.exists()) return true;

    const settingsRef = collection(dbFirestore, 'users', userId, 'settings');
    const snap = await getDocs(query(settingsRef, limit(1)));
    return !snap.empty;
  } catch {
    return false;
  }
}

/**
 * Seeds initial demo/starter template data for a newly registered user into their isolated Firestore space
 * (Omits bulk 2,135 individual student docs which are stored in compact schoolSync chunks)
 */
export async function seedInitialUserData(
  userId: string,
  dataset: {
    medicines: Medicine[];
    batches: MedicineBatch[];
    transactions: InventoryTransaction[];
    suppliers: Supplier[];
    supplies: MedicalSupply[];
    usageRecords: UsageRecord[];
    inventoryChecks: InventoryCheck[];
    auditLogs: AuditLog[];
    settings: AppSettings;
    students: Student[];
    healthProfiles: StudentHealthProfile[];
    clinicVisits: ClinicVisit[];
    healthEvents: HealthEvent[];
    healthCheckups: HealthCheckup[];
    classes: SchoolClass[];
    disposals?: MedicineDisposal[];
  }
): Promise<void> {
  if (!isCloudSyncAllowed(userId)) return;
  const operations: BatchWriteOp[] = [];

  // Settings
  operations.push({
    subcollection: 'settings',
    docId: 'current',
    data: dataset.settings,
    op: 'set',
  });

  // Clinic visits
  dataset.clinicVisits.forEach((cv) => {
    operations.push({ subcollection: 'clinicVisits', docId: cv.id, data: cv, op: 'set' });
  });

  // Health events
  dataset.healthEvents.forEach((he) => {
    operations.push({ subcollection: 'healthEvents', docId: he.id, data: he, op: 'set' });
  });

  // Health checkups
  dataset.healthCheckups.forEach((hc) => {
    operations.push({ subcollection: 'healthCheckups', docId: hc.id, data: hc, op: 'set' });
  });

  // Transactions
  dataset.transactions.forEach((t) => {
    operations.push({ subcollection: 'transactions', docId: t.id, data: t, op: 'set' });
  });

  await persistUserBatch(userId, operations);
}

export type SubcollectionMap = {
  medicines: (data: Medicine[]) => void;
  batches: (data: MedicineBatch[]) => void;
  transactions: (data: InventoryTransaction[]) => void;
  suppliers: (data: Supplier[]) => void;
  supplies: (data: MedicalSupply[]) => void;
  usageRecords: (data: UsageRecord[]) => void;
  inventoryChecks: (data: InventoryCheck[]) => void;
  disposals: (data: MedicineDisposal[]) => void;
  auditLogs: (data: AuditLog[]) => void;
  settings: (data: AppSettings) => void;
  students: (data: Student[]) => void;
  healthProfiles: (data: StudentHealthProfile[]) => void;
  clinicVisits: (data: ClinicVisit[]) => void;
  healthEvents: (data: HealthEvent[]) => void;
  healthCheckups: (data: HealthCheckup[]) => void;
  schoolClasses: (data: SchoolClass[]) => void;
};

/**
 * Subscribe to all user subcollections with real-time onSnapshot listeners
 */
export function subscribeToUserSubcollections(
  userId: string,
  callbacks: Partial<SubcollectionMap>,
  onError?: (subcollection: string, err: any) => void
): () => void {
  if (!isCloudSyncAllowed(userId)) {
    return () => {};
  }
  const unsubscribers: Unsubscribe[] = [];

  const subcollections: (keyof SubcollectionMap)[] = [
    'medicines',
    'batches',
    'transactions',
    'suppliers',
    'supplies',
    'usageRecords',
    'inventoryChecks',
    'disposals',
    'auditLogs',
    'settings',
    'students',
    'healthProfiles',
    'clinicVisits',
    'healthEvents',
    'healthCheckups',
    'schoolClasses',
  ];

  subcollections.forEach((subName) => {
    const cb = callbacks[subName];
    if (!cb) return;

    try {
      const colRef = collection(dbFirestore, 'users', userId, subName);
      const unsub = onSnapshot(
        colRef,
        (snap) => {
          if (subName === 'settings') {
            const settingsDoc = snap.docs.find((d) => d.id === 'current');
            if (settingsDoc) {
              (cb as any)(settingsDoc.data());
            }
          } else {
            const items = snap.docs.map((d) => d.data());
            (cb as any)(items);
          }
        },
        (err) => {
          if (onError) {
            onError(subName, err);
          } else {
            console.error(`Error in listener for ${subName}:`, err);
          }
        }
      );
      unsubscribers.push(unsub);
    } catch (e) {
      console.warn(`Could not attach listener for ${subName}:`, e);
    }
  });

  return () => {
    unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {
        // ignore
      }
    });
  };
}

const SHARED_SYNC_TOKEN = 'THCS_DONG_THANH_2026_V1';

export async function pushSharedSchoolClassesToCloud(
  classes: SchoolClass[],
  deletedClassIds: string[],
  classesUpdatedAt: number,
  revision = 1
): Promise<boolean> {
  if (isFirestoreQuotaExhausted()) return false;
  try {
    const payloadJson = JSON.stringify({
      classes: classes || [],
      deletedClassIds: deletedClassIds || [],
      classesUpdatedAt: classesUpdatedAt || Date.now(),
    });
    if (payloadJson.length > 890000) return false;
    const docRef = doc(dbFirestore, 'schoolSync', 'thcs_dt_classes');
    await executeFirestoreWriteWithGuard(() =>
      setDoc(docRef, {
        syncToken: SHARED_SYNC_TOKEN,
        updatedAt: new Date().toISOString(),
        payloadJson,
        revision: Math.max(1, Math.floor(Number(revision) || 1)),
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function pushSharedOperationalToCloud(
  operationalData: Record<string, any>,
  revision = 1
): Promise<boolean> {
  if (isFirestoreQuotaExhausted()) return false;
  try {
    const payloadJson = JSON.stringify(operationalData);
    if (payloadJson.length > 890000) return false;
    const docRef = doc(dbFirestore, 'schoolSync', 'thcs_dt_operational');
    await executeFirestoreWriteWithGuard(() =>
      setDoc(docRef, {
        syncToken: SHARED_SYNC_TOKEN,
        updatedAt: new Date().toISOString(),
        payloadJson,
        revision: Math.max(1, Math.floor(Number(revision) || 1)),
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function pushSharedStudentsToCloud(
  students: Student[],
  healthProfiles: StudentHealthProfile[],
  studentsUpdatedAt: number,
  realStudentsImported: boolean,
  studentsCleaned: boolean,
  revision = 1,
  deletedStudentIds: string[] = []
): Promise<boolean> {
  if (isFirestoreQuotaExhausted()) return false;
  try {
    const list = Array.isArray(students) ? students : [];
    const CHUNK_SIZE = 350;
    const chunkCount = Math.min(10, Math.ceil(list.length / CHUNK_SIZE));
    const safeRev = Math.max(1, Math.floor(Number(revision) || 1));

    for (let i = 0; i < chunkCount; i++) {
      const slice = list.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const chunkJson = JSON.stringify({ students: slice, chunkIndex: i });
      if (chunkJson.length <= 890000) {
        const chunkRef = doc(dbFirestore, 'schoolSync', `thcs_dt_students_${i}`);
        await executeFirestoreWriteWithGuard(() =>
          setDoc(chunkRef, {
            syncToken: SHARED_SYNC_TOKEN,
            updatedAt: new Date().toISOString(),
            payloadJson: chunkJson,
            revision: safeRev,
            chunkCount,
          })
        );
      }
    }

    const compactProfiles = (healthProfiles || [])
      .filter(
        (hp) =>
          hp.allergies ||
          hp.chronicConditions ||
          hp.specialAttention ||
          hp.notes ||
          hp.height ||
          hp.weight ||
          hp.bloodType ||
          hp.visionLeft ||
          hp.visionRight
      )
      .slice(0, 600);

    const metaJson = JSON.stringify({
      totalStudents: list.length,
      chunkCount,
      studentsUpdatedAt: studentsUpdatedAt || Date.now(),
      realStudentsImported: Boolean(realStudentsImported),
      studentsCleaned: Boolean(studentsCleaned),
      deletedStudentIds: Array.isArray(deletedStudentIds) ? deletedStudentIds : [],
      healthProfiles: compactProfiles,
    });

    if (metaJson.length <= 890000) {
      const metaRef = doc(dbFirestore, 'schoolSync', 'thcs_dt_students_meta');
      await executeFirestoreWriteWithGuard(() =>
        setDoc(metaRef, {
          syncToken: SHARED_SYNC_TOKEN,
          updatedAt: new Date().toISOString(),
          payloadJson: metaJson,
          revision: safeRev,
          chunkCount,
        })
      );
    }
    return true;
  } catch {
    return false;
  }
}

export async function loadSharedStudentsChunksFromCloud(chunkCount: number): Promise<Student[]> {
  if (isFirestoreQuotaExhausted() || chunkCount <= 0) return [];
  try {
    const safeCount = Math.min(10, Math.max(0, Math.floor(chunkCount)));
    const snaps = await Promise.all(
      Array.from({ length: safeCount }, (_, i) =>
        getDoc(doc(dbFirestore, 'schoolSync', `thcs_dt_students_${i}`))
      )
    );
    const allStudents: Student[] = [];
    for (const snap of snaps) {
      if (snap.exists()) {
        const data = snap.data();
        if (data?.payloadJson) {
          const parsed = JSON.parse(data.payloadJson);
          if (Array.isArray(parsed?.students)) {
            allStudents.push(...parsed.students);
          }
        }
      }
    }
    return allStudents;
  } catch {
    return [];
  }
}

export function subscribeToSharedSchoolSync(callbacks: {
  onClassesChunk: (
    payload: { classes?: SchoolClass[]; deletedClassIds?: string[]; classesUpdatedAt?: number } | null,
    exists: boolean
  ) => void;
  onOperationalChunk: (payload: Record<string, any> | null, exists: boolean) => void;
  onStudentsMetaChunk: (meta: Record<string, any> | null, exists: boolean) => void;
}): () => void {
  if (isFirestoreQuotaExhausted()) return () => {};
  const unsubs: Unsubscribe[] = [];

  try {
    unsubs.push(
      onSnapshot(
        doc(dbFirestore, 'schoolSync', 'thcs_dt_classes'),
        (snap) => {
          if (!snap.exists()) {
            callbacks.onClassesChunk(null, false);
            return;
          }
          try {
            const raw = snap.data()?.payloadJson;
            callbacks.onClassesChunk(raw ? JSON.parse(raw) : null, true);
          } catch {
            // ignore parse error
          }
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        doc(dbFirestore, 'schoolSync', 'thcs_dt_operational'),
        (snap) => {
          if (!snap.exists()) {
            callbacks.onOperationalChunk(null, false);
            return;
          }
          try {
            const raw = snap.data()?.payloadJson;
            callbacks.onOperationalChunk(raw ? JSON.parse(raw) : null, true);
          } catch {
            // ignore
          }
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        doc(dbFirestore, 'schoolSync', 'thcs_dt_students_meta'),
        (snap) => {
          if (!snap.exists()) {
            callbacks.onStudentsMetaChunk(null, false);
            return;
          }
          try {
            const raw = snap.data()?.payloadJson;
            callbacks.onStudentsMetaChunk(raw ? JSON.parse(raw) : null, true);
          } catch {
            // ignore
          }
        },
        () => {}
      )
    );
  } catch {
    // ignore
  }

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {
        // ignore
      }
    });
  };
}

