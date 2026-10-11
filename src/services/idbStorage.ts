/**
 * High-capacity IndexedDB storage engine for School Health & Student Records.
 * Eliminates browser 5MB LocalStorage quota issues when storing 1,000 - 10,000+ student records
 * and ensures clinic visits, medicine batches, and transactions are never lost on reload or logout.
 */

const IDB_NAME = 'thcs_dongthanh_idb_v1';
const IDB_VERSION = 1;
const STORE_NAME = 'school_collections';

export interface OperationalMasterBundle {
  clinicVisits: any[];
  medicines: any[];
  batches: any[];
  transactions: any[];
  supplies?: any[];
  suppliers?: any[];
  usageRecords?: any[];
  inventoryChecks?: any[];
  disposals?: any[];
  healthEvents?: any[];
  healthCheckups?: any[];
  users?: any[];
  staffMembers?: any[];
  settings?: any;
  deletedVisitIds?: string[];
  deletedUserIds?: string[];
  inventoryUpdatedAt?: number;
  updatedAt: string;
}

function openIdb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbSet<T>(key: string, value: T): Promise<boolean> {
  const db = await openIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        db.close();
        resolve(req.result !== undefined ? (req.result as T) : null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function idbSaveStudentBundle(bundle: {
  students: any[];
  healthProfiles: any[];
  classes: any[];
  updatedAt: string;
}): Promise<boolean> {
  return idbSet('student_master_bundle_v1', bundle);
}

export async function idbLoadStudentBundle(): Promise<{
  students: any[];
  healthProfiles: any[];
  classes: any[];
  updatedAt: string;
} | null> {
  return idbGet('student_master_bundle_v1');
}

export async function idbSaveOperationalBundle(bundle: OperationalMasterBundle): Promise<boolean> {
  return idbSet('operational_master_bundle_v1', bundle);
}

export async function idbLoadOperationalBundle(): Promise<OperationalMasterBundle | null> {
  return idbGet('operational_master_bundle_v1');
}
