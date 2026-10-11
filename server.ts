import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'school_state.json');
const FIREBASE_CONFIG_FILE = path.join(__dirname, 'firebase-applet-config.json');
const FIRESTORE_SYNC_TOKEN = 'THCS_DONG_THANH_2026_V1';

let firebaseConfig: { projectId?: string; firestoreDatabaseId?: string; apiKey?: string } | null = null;
try {
  if (fs.existsSync(FIREBASE_CONFIG_FILE)) {
    firebaseConfig = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_FILE, 'utf-8'));
  }
} catch (err) {
  console.warn('Could not read firebase-applet-config.json:', err);
}

function getFirestoreChunkUrl(chunkId: string): string | null {
  if (!firebaseConfig?.projectId || !firebaseConfig?.firestoreDatabaseId || !firebaseConfig?.apiKey) {
    return null;
  }
  return `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/schoolSync/${chunkId}?key=${firebaseConfig.apiKey}`;
}

async function readFirestoreChunkServer(chunkId: string): Promise<any | null> {
  const url = getFirestoreChunkUrl(chunkId);
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const doc = await res.json();
    const payloadStr = doc?.fields?.payloadJson?.stringValue;
    if (!payloadStr) return null;
    return {
      payload: JSON.parse(payloadStr),
      updatedAt: doc?.fields?.updatedAt?.stringValue || null,
      revision: Number(doc?.fields?.revision?.integerValue ?? doc?.fields?.revision?.doubleValue ?? 0),
      chunkCount: Number(doc?.fields?.chunkCount?.integerValue ?? doc?.fields?.chunkCount?.doubleValue ?? 0),
    };
  } catch {
    return null;
  }
}

async function writeFirestoreChunkServer(
  chunkId: string,
  payloadObj: any,
  revision = 1,
  chunkCount?: number
): Promise<boolean> {
  const url = getFirestoreChunkUrl(chunkId);
  if (!url) return false;
  try {
    const payloadJson = JSON.stringify(payloadObj);
    if (payloadJson.length > 890000) {
      console.warn(`Chunk ${chunkId} exceeds 890KB (${payloadJson.length} bytes), skipping write`);
      return false;
    }
    const fields: Record<string, any> = {
      syncToken: { stringValue: FIRESTORE_SYNC_TOKEN },
      updatedAt: { stringValue: new Date().toISOString() },
      payloadJson: { stringValue: payloadJson },
      revision: { integerValue: String(Math.max(1, Math.floor(Number(revision) || 1))) },
    };
    if (typeof chunkCount === 'number') {
      fields.chunkCount = { integerValue: String(Math.max(0, Math.floor(chunkCount))) };
    }
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not create data dir:', err);
  }
}

function loadServerState() {
  ensureDataDir();
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      if (raw && raw.trim()) {
        return JSON.parse(raw);
      }
    }
  } catch (err) {
    console.warn('Failed to read school_state.json:', err);
  }
  return null;
}

function saveServerState(state) {
  ensureDataDir();
  try {
    const tmpFile = `${STATE_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(state), 'utf-8');
    fs.renameSync(tmpFile, STATE_FILE);
    return true;
  } catch (err) {
    console.warn('Failed to write school_state.json:', err);
    return false;
  }
}

function mergeById(existingArr, incomingArr, deletedIdSet) {
  const map = new Map();
  if (Array.isArray(existingArr)) {
    for (const item of existingArr) {
      if (item && item.id && (!deletedIdSet || !deletedIdSet.has(item.id))) {
        map.set(item.id, item);
      }
    }
  }
  if (Array.isArray(incomingArr)) {
    for (const item of incomingArr) {
      if (item && item.id && (!deletedIdSet || !deletedIdSet.has(item.id))) {
        const prev = map.get(item.id);
        if (!prev) {
          map.set(item.id, item);
        } else {
          const prevTime = new Date(prev.updatedAt || prev.lastUpdated || prev.createdAt || 0).getTime();
          const nextTime = new Date(item.updatedAt || item.lastUpdated || item.createdAt || 0).getTime();
          if (nextTime >= prevTime) {
            map.set(item.id, { ...prev, ...item });
          }
        }
      }
    }
  }
  return Array.from(map.values());
}

function normalizeServerUsersToTwoRoles(usersArr) {
  const defaultAdminPerms = {
    canManageMedicine: true,
    canManageTransactions: true,
    canManageClinicVisits: true,
    canManageStudents: true,
    canManageInventoryCheck: true,
    canViewReports: true,
    canManageSettings: true,
    canApproveAudits: true,
  };
  const defaultMedicPerms = {
    canManageMedicine: true,
    canManageTransactions: true,
    canManageClinicVisits: true,
    canManageStudents: true,
    canManageInventoryCheck: true,
    canViewReports: true,
    canManageSettings: false,
    canApproveAudits: false,
  };
  const existingAdmin = Array.isArray(usersArr)
    ? usersArr.find((u) => u && (u.id === 'role-admin' || u.role === 'admin'))
    : null;
  const existingMedic = Array.isArray(usersArr)
    ? usersArr.find((u) => u && (u.id === 'role-medic' || u.role === 'medic'))
    : null;

  return [
    {
      id: 'role-admin',
      username: 'quantri',
      fullName: 'Quản trị',
      role: 'admin',
      email: '',
      phone: '',
      title: 'Nhiệm vụ Quản trị hệ thống',
      department: 'Quản trị & Phê duyệt hệ thống',
      status: 'active',
      permissions: existingAdmin?.permissions
        ? { ...defaultAdminPerms, ...existingAdmin.permissions, canManageSettings: true, canApproveAudits: true }
        : defaultAdminPerms,
      createdAt: '2026-01-01T08:00:00.000Z',
      updatedAt: existingAdmin?.updatedAt || new Date().toISOString(),
    },
    {
      id: 'role-medic',
      username: 'nhanvien_yte',
      fullName: 'Nhân viên Y tế',
      role: 'medic',
      email: '',
      phone: '',
      title: 'Nhiệm vụ Nhân viên Y tế',
      department: 'Phòng Y tế Học đường',
      status: 'active',
      permissions: existingMedic?.permissions
        ? { ...defaultMedicPerms, ...existingMedic.permissions }
        : defaultMedicPerms,
      createdAt: '2026-01-01T08:00:00.000Z',
      updatedAt: existingMedic?.updatedAt || new Date().toISOString(),
    },
  ];
}

let cachedState = loadServerState();
if (cachedState && Array.isArray(cachedState.users)) {
  cachedState.users = normalizeServerUsersToTwoRoles(cachedState.users);
}

const DEMO_TEACHER_BY_CLASS: Record<string, string> = {
  '6/1': 'Cô Nguyễn Thị Lan',
  '6/2': 'Thầy Trần Minh Tuấn',
  '7/1': 'Cô Lê Thị Mai',
  '7/2': 'Cô Hoàng Thị Hoa',
  '7/3': 'Thầy Phạm Văn Nam',
  '8/1': 'Cô Vũ Thu Hương',
  '8/2': 'Thầy Đặng Quang Huy',
  '9/1': 'Cô Bùi Thanh Thảo',
  '9/2': 'Thầy Ngô Quốc Bảo',
};

function normalizeClassKeyServer(name: any): string {
  if (!name) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/^lớp\s*/i, '')
    .replace(/^lop\s*/i, '')
    .replace(/\s+/g, '')
    .replace(/[-.aA]/g, '/');
}

function isDemoClassServer(c: any): boolean {
  if (!c || typeof c !== 'object') return true;
  if (c.updatedAt) return false;
  const key = normalizeClassKeyServer(c.name);
  const demoTeacher = DEMO_TEACHER_BY_CLASS[key];
  if (!demoTeacher) return false;
  return (c.homeroomTeacher || '').trim() === demoTeacher;
}

function isOnlyDemoClassesServer(arr: any): boolean {
  if (!Array.isArray(arr) || arr.length === 0) return true;
  if (arr.length > 9) return false;
  return arr.every((c) => isDemoClassServer(c));
}

function mergeSchoolClassesServer(existingClasses: any, incomingClasses: any, deletedClassSet: Set<string>) {
  const listA = Array.isArray(existingClasses) ? existingClasses : [];
  const listB = Array.isArray(incomingClasses) ? incomingClasses : [];

  const aOnlyDemo = isOnlyDemoClassesServer(listA);
  const bOnlyDemo = isOnlyDemoClassesServer(listB);

  // If one side has real school classes/GVCN and the other only has the 9 unmodified demo classes,
  // do not let the unmodified demo classes overwrite or pollute the real classes
  const effectiveA = !bOnlyDemo && aOnlyDemo ? [] : listA;
  const effectiveB = !aOnlyDemo && bOnlyDemo ? [] : listB;

  const byKey = new Map<string, any>();

  const upsertClass = (cls: any, isIncoming: boolean) => {
    if (!cls || !cls.name) return;
    const normKey = normalizeClassKeyServer(cls.name);
    if (!normKey) return;
    if (deletedClassSet && (deletedClassSet.has(cls.id) || deletedClassSet.has(normKey))) {
      return;
    }

    const prev = byKey.get(normKey);
    if (!prev) {
      byKey.set(normKey, { ...cls });
      return;
    }

    const prevIsDemo = isDemoClassServer(prev);
    const nextIsDemo = isDemoClassServer(cls);

    if (prevIsDemo && !nextIsDemo) {
      byKey.set(normKey, { ...prev, ...cls });
      return;
    }
    if (!prevIsDemo && nextIsDemo) {
      return;
    }

    const rawPrevUpdated = prev.updatedAt === '2026-09-15T08:00:00.000Z' ? '' : prev.updatedAt || '';
    const rawNextUpdated = cls.updatedAt === '2026-09-15T08:00:00.000Z' ? '' : cls.updatedAt || '';
    const prevTime = rawPrevUpdated ? new Date(rawPrevUpdated).getTime() || 0 : 0;
    const nextTime = rawNextUpdated ? new Date(rawNextUpdated).getTime() || 0 : 0;

    const prevTeacher = (prev.homeroomTeacher || '').trim();
    const nextTeacher = (cls.homeroomTeacher || '').trim();
    const prevPhone = (prev.teacherPhone || '').trim();
    const nextPhone = (cls.teacherPhone || '').trim();
    const prevRoom = (prev.room || '').trim();
    const nextRoom = (cls.room || '').trim();

    if (nextTime > prevTime || (nextTime === prevTime && isIncoming)) {
      const merged = {
        ...prev,
        ...cls,
        homeroomTeacher: nextTeacher || prevTeacher,
        teacherPhone: nextPhone || prevPhone,
        room: nextRoom || prevRoom,
        updatedAt: rawNextUpdated || rawPrevUpdated || undefined,
      };
      byKey.set(normKey, merged);
    } else {
      const merged = {
        ...cls,
        ...prev,
        homeroomTeacher: prevTeacher || nextTeacher,
        teacherPhone: prevPhone || nextPhone,
        room: prevRoom || nextRoom,
        updatedAt: rawPrevUpdated || rawNextUpdated || undefined,
      };
      byKey.set(normKey, merged);
    }
  };

  for (const c of effectiveA) upsertClass(c, false);
  for (const c of effectiveB) upsertClass(c, true);

  const result = Array.from(byKey.values());
  if (result.length === 0 && listA.length > 0 && deletedClassSet.size === 0) {
    return listA;
  }
  return result.sort((a, b) => {
    const gA = Number(a.grade) || 6;
    const gB = Number(b.grade) || 6;
    if (gA !== gB) return gA - gB;
    return String(a.name || '').localeCompare(String(b.name || ''), 'vi', { numeric: true });
  });
}

function mergeSchoolState(existing, incoming) {
  if (!existing) {
    const firstState = {
      ...incoming,
      users: normalizeServerUsersToTwoRoles(incoming?.users),
      revision: 1,
      updatedAt: new Date().toISOString(),
    };
    return firstState;
  }

  const deletedVisitIds = Array.from(
    new Set([...(existing.deletedVisitIds || []), ...(incoming.deletedVisitIds || [])])
  ).filter((id) => id && !String(id).startsWith('KB-'));
  const deletedUserIds = Array.from(
    new Set([...(existing.deletedUserIds || []), ...(incoming.deletedUserIds || [])])
  );
  const deletedTxIds = Array.from(
    new Set([...(existing.deletedTxIds || []), ...(incoming.deletedTxIds || [])])
  );
  const deletedClassIds = Array.from(
    new Set([...(existing.deletedClassIds || []), ...(incoming.deletedClassIds || [])])
  );
  const deletedEventIds = Array.from(
    new Set([...(existing.deletedEventIds || []), ...(incoming.deletedEventIds || [])])
  );
  const deletedCheckupIds = Array.from(
    new Set([...(existing.deletedCheckupIds || []), ...(incoming.deletedCheckupIds || [])])
  );
  const deletedStudentIds = Array.from(
    new Set([...(existing.deletedStudentIds || []), ...(incoming.deletedStudentIds || [])])
  );
  const deletedStaffIds = Array.from(
    new Set([...(existing.deletedStaffIds || []), ...(incoming.deletedStaffIds || [])])
  );

  const deletedVisitSet = new Set(deletedVisitIds);
  const deletedUserSet = new Set(deletedUserIds);
  const deletedTxSet = new Set(deletedTxIds);
  const deletedClassSet = new Set(deletedClassIds);
  const deletedEventSet = new Set(deletedEventIds);
  const deletedCheckupSet = new Set(deletedCheckupIds);
  const deletedStudentSet = new Set(deletedStudentIds);
  const deletedStaffSet = new Set(deletedStaffIds);

  // 1. Merge Clinic Visits by ID (preserving all visits across machines except explicitly deleted ones)
  const mergedClinicVisits = mergeById(
    existing.clinicVisits,
    incoming.clinicVisits,
    deletedVisitSet
  ).sort((a, b) => {
    const tA = new Date(a.createdAt || `${a.visitDate || ''}T${a.timeIn || '00:00'}`).getTime() || 0;
    const tB = new Date(b.createdAt || `${b.visitDate || ''}T${b.timeIn || '00:00'}`).getTime() || 0;
    return tB - tA;
  });

  // 2. Merge Transactions by ID
  const mergedTransactions = mergeById(
    existing.transactions,
    incoming.transactions,
    deletedTxSet
  ).sort((a, b) => {
    const tA = new Date(a.date || a.createdAt || 0).getTime() || 0;
    const tB = new Date(b.date || b.createdAt || 0).getTime() || 0;
    return tB - tA;
  });

  // 3. Merge Inventory Checks, Disposals, Health Events, Health Checkups, Usage Records, Users
  const mergedInventoryChecks = mergeById(existing.inventoryChecks, incoming.inventoryChecks, null);
  const mergedDisposals = mergeById(existing.disposals, incoming.disposals, null);
  const mergedHealthEvents = mergeById(existing.healthEvents, incoming.healthEvents, deletedEventSet);
  const mergedHealthCheckups = mergeById(existing.healthCheckups, incoming.healthCheckups, deletedCheckupSet);
  const mergedUsageRecords = mergeById(existing.usageRecords, incoming.usageRecords, null);
  const mergedUsers = normalizeServerUsersToTwoRoles(incoming.users || existing.users);

  // 3.1 Merge Staff Members with deletion and update timestamp awareness
  const existingStaffTime = Number(existing.staffUpdatedAt || 0);
  const incomingStaffTime = Number(incoming.staffUpdatedAt || 0);
  const incomingStaffCount = Array.isArray(incoming.staffMembers) ? incoming.staffMembers.length : 0;
  const existingStaffCount = Array.isArray(existing.staffMembers) ? existing.staffMembers.length : 0;

  let mergedStaffMembers: any[] = [];
  if (incoming.staffCleaned && incomingStaffTime >= existingStaffTime) {
    mergedStaffMembers = [];
  } else if (incoming.replaceAllStaff && Array.isArray(incoming.staffMembers)) {
    mergedStaffMembers = incoming.staffMembers.filter((s: any) => s && !deletedStaffSet.has(s.id));
  } else if (
    incomingStaffCount > 0 &&
    (incomingStaffTime >= existingStaffTime || incomingStaffCount !== existingStaffCount)
  ) {
    mergedStaffMembers = mergeById(existing.staffMembers, incoming.staffMembers, deletedStaffSet);
  } else if (Array.isArray(incoming.staffMembers) && incomingStaffCount === 0 && incoming.staffCleaned) {
    mergedStaffMembers = [];
  } else {
    mergedStaffMembers = mergeById(existing.staffMembers, incoming.staffMembers, deletedStaffSet);
  }

  // 4. Inventory Batches & Medicines: prefer whichever side has newer inventoryUpdatedAt or more transactions
  const existingInvTime = Number(existing.inventoryUpdatedAt || 0);
  const incomingInvTime = Number(incoming.inventoryUpdatedAt || 0);
  const incomingTxCount = Array.isArray(incoming.transactions) ? incoming.transactions.length : 0;
  const existingTxCount = Array.isArray(existing.transactions) ? existing.transactions.length : 0;

  const preferIncomingInventory =
    incomingInvTime >= existingInvTime || incomingTxCount >= existingTxCount;

  const mergedBatches =
    preferIncomingInventory && Array.isArray(incoming.batches) && incoming.batches.length > 0
      ? incoming.batches
      : existing.batches || incoming.batches || [];

  const mergedMedicines =
    preferIncomingInventory && Array.isArray(incoming.medicines) && incoming.medicines.length > 0
      ? incoming.medicines
      : existing.medicines || incoming.medicines || [];

  const mergedSupplies =
    preferIncomingInventory && Array.isArray(incoming.supplies) && incoming.supplies.length > 0
      ? incoming.supplies
      : existing.supplies || incoming.supplies || [];

  const mergedSuppliers =
    Array.isArray(incoming.suppliers) && incoming.suppliers.length > 0
      ? incoming.suppliers
      : existing.suppliers || [];

  // 5. Students, Health Profiles & Classes (GVCN)
  const existingStuTime = Number(existing.studentsUpdatedAt || 0);
  const incomingStuTime = Number(incoming.studentsUpdatedAt || 0);
  const existingClassesTime = Number(existing.classesUpdatedAt || 0);
  const incomingClassesTime = Number(incoming.classesUpdatedAt || 0);
  const existingStuCount = Array.isArray(existing.students) ? existing.students.length : 0;
  const incomingStuCount = Array.isArray(incoming.students) ? incoming.students.length : 0;

  let mergedStudents = existing.students || [];
  let mergedHealthProfiles = existing.healthProfiles || [];
  let realStudentsImported = Boolean(existing.realStudentsImported || incoming.realStudentsImported);
  let studentsCleaned = Boolean(incoming.studentsCleaned);

  if (
    incomingStuCount > existingStuCount ||
    (incomingStuTime >= existingStuTime && incomingStuCount > 0) ||
    (incoming.studentsCleaned && incomingStuTime >= existingStuTime) ||
    (Array.isArray(incoming.deletedStudentIds) && incoming.deletedStudentIds.length > (existing.deletedStudentIds?.length || 0))
  ) {
    mergedStudents = (incoming.students || []).filter((s) => s && !deletedStudentSet.has(s.id));
    mergedHealthProfiles = mergeById(existing.healthProfiles, incoming.healthProfiles, null).filter(
      (hp) => hp && !deletedStudentSet.has(hp.studentId)
    );
  } else {
    mergedStudents = (existing.students || []).filter((s) => s && !deletedStudentSet.has(s.id));
    mergedHealthProfiles = mergeById(incoming.healthProfiles, existing.healthProfiles, null).filter(
      (hp) => hp && !deletedStudentSet.has(hp.studentId)
    );
  }

  // Always merge classes & Homeroom Teachers (GVCN) intelligently so GVCN changes sync across all computers
  let mergedClasses = mergeSchoolClassesServer(existing.classes, incoming.classes, deletedClassSet);
  for (const c of mergedClasses) {
    c.totalStudents = mergedStudents.filter(
      (s) =>
        s &&
        (s.className === c.name ||
          normalizeClassKeyServer(s.className) === normalizeClassKeyServer(c.name))
    ).length || c.totalStudents || 0;
  }

  return {
    medicines: mergedMedicines,
    batches: mergedBatches,
    transactions: mergedTransactions,
    suppliers: mergedSuppliers,
    supplies: mergedSupplies,
    usageRecords: mergedUsageRecords,
    inventoryChecks: mergedInventoryChecks,
    disposals: mergedDisposals,
    settings: { ...(existing.settings || {}), ...(incoming.settings || {}) },
    users: mergedUsers,
    staffMembers: mergedStaffMembers,
    students: mergedStudents,
    healthProfiles: mergedHealthProfiles,
    clinicVisits: mergedClinicVisits,
    healthEvents: mergedHealthEvents,
    healthCheckups: mergedHealthCheckups,
    classes: mergedClasses,
    deletedVisitIds,
    deletedUserIds,
    deletedTxIds,
    deletedClassIds,
    deletedEventIds,
    deletedCheckupIds,
    deletedStudentIds,
    deletedStaffIds,
    staffUpdatedAt: Math.max(existingStaffTime, incomingStaffTime, Date.now()),
    staffCleaned: Boolean(incoming.staffCleaned),
    realStudentsImported,
    studentsCleaned,
    inventoryUpdatedAt: Math.max(existingInvTime, incomingInvTime),
    studentsUpdatedAt: Math.max(existingStuTime, incomingStuTime),
    classesUpdatedAt: Math.max(existingClassesTime, incomingClassesTime),
    revision: Math.max(Number(existing.revision) || 0, Number(incoming.revision) || 0) + 1,
    updatedAt: new Date().toISOString(),
  };
}

let lastCloudPullAt = 0;
let isCloudPulling = false;
let lastPushedStudentsHash = '';

async function pushStateToCloudFirestore(state: any, forceStudents = false): Promise<void> {
  if (!state) return;
  const rev = Number(state.revision) || 1;
  try {
    // 1. Push classes & homeroom teachers (GVCN) chunk
    const classesPayload = {
      classes: state.classes || [],
      deletedClassIds: state.deletedClassIds || [],
      classesUpdatedAt: state.classesUpdatedAt || Date.now(),
    };
    await writeFirestoreChunkServer('thcs_dt_classes', classesPayload, rev);

    // 2. Push operational records chunk
    const operationalPayload = {
      medicines: state.medicines || [],
      batches: state.batches || [],
      transactions: state.transactions || [],
      suppliers: state.suppliers || [],
      supplies: state.supplies || [],
      usageRecords: state.usageRecords || [],
      inventoryChecks: state.inventoryChecks || [],
      disposals: state.disposals || [],
      settings: state.settings || {},
      users: state.users || [],
      staffMembers: state.staffMembers || [],
      clinicVisits: state.clinicVisits || [],
      healthEvents: state.healthEvents || [],
      healthCheckups: state.healthCheckups || [],
      deletedVisitIds: state.deletedVisitIds || [],
      deletedUserIds: state.deletedUserIds || [],
      deletedTxIds: state.deletedTxIds || [],
      deletedClassIds: state.deletedClassIds || [],
      deletedEventIds: state.deletedEventIds || [],
      deletedCheckupIds: state.deletedCheckupIds || [],
      deletedStudentIds: state.deletedStudentIds || [],
      deletedStaffIds: state.deletedStaffIds || [],
      staffUpdatedAt: state.staffUpdatedAt || Date.now(),
      staffCleaned: Boolean(state.staffCleaned),
      inventoryUpdatedAt: state.inventoryUpdatedAt || Date.now(),
      classesUpdatedAt: state.classesUpdatedAt || Date.now(),
      studentsUpdatedAt: state.studentsUpdatedAt || 0,
      realStudentsImported: Boolean(state.realStudentsImported),
      studentsCleaned: Boolean(state.studentsCleaned),
      revision: rev,
    };
    await writeFirestoreChunkServer('thcs_dt_operational', operationalPayload, rev);

    // 3. Push students & healthProfiles in 350-student chunks if changed
    const students = Array.isArray(state.students) ? state.students : [];
    const stuHash = `${students.length}_${state.studentsUpdatedAt || 0}_${Boolean(state.realStudentsImported)}`;
    if (forceStudents || stuHash !== lastPushedStudentsHash) {
      lastPushedStudentsHash = stuHash;
      const CHUNK_SIZE = 350;
      const chunkCount = Math.min(10, Math.ceil(students.length / CHUNK_SIZE));
      for (let i = 0; i < chunkCount; i++) {
        const slice = students.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        await writeFirestoreChunkServer(`thcs_dt_students_${i}`, { students: slice, chunkIndex: i }, rev, chunkCount);
      }
      const metaPayload = {
        totalStudents: students.length,
        chunkCount,
        studentsUpdatedAt: state.studentsUpdatedAt || Date.now(),
        realStudentsImported: Boolean(state.realStudentsImported),
        studentsCleaned: Boolean(state.studentsCleaned),
        deletedStudentIds: state.deletedStudentIds || [],
        healthProfiles: Array.isArray(state.healthProfiles) ? state.healthProfiles.slice(0, 600) : [],
      };
      await writeFirestoreChunkServer('thcs_dt_students_meta', metaPayload, rev, chunkCount);
    }
  } catch (err) {
    console.warn('Cloud Firestore push notice:', err);
  }
}

async function pullStateFromCloudFirestore(force = false): Promise<boolean> {
  if (isCloudPulling) return false;
  if (!force && Date.now() - lastCloudPullAt < 15000 && cachedState) {
    return false;
  }
  isCloudPulling = true;
  lastCloudPullAt = Date.now();
  try {
    const [clsDoc, opDoc, stuMetaDoc] = await Promise.all([
      readFirestoreChunkServer('thcs_dt_classes'),
      readFirestoreChunkServer('thcs_dt_operational'),
      readFirestoreChunkServer('thcs_dt_students_meta'),
    ]);

    if (!clsDoc && !opDoc && !stuMetaDoc) {
      // Cloud Firestore has no schoolSync state yet; if we have local state, push it up to seed Cloud Firestore
      if (cachedState) {
        await pushStateToCloudFirestore(cachedState, true);
      }
      return false;
    }

    const cloudIncoming: Record<string, any> = {
      ...(opDoc?.payload || {}),
    };

    if (clsDoc?.payload) {
      if (Array.isArray(clsDoc.payload.classes)) {
        cloudIncoming.classes = clsDoc.payload.classes;
      }
      if (Array.isArray(clsDoc.payload.deletedClassIds)) {
        cloudIncoming.deletedClassIds = Array.from(
          new Set([...(cloudIncoming.deletedClassIds || []), ...clsDoc.payload.deletedClassIds])
        );
      }
      if (clsDoc.payload.classesUpdatedAt) {
        cloudIncoming.classesUpdatedAt = clsDoc.payload.classesUpdatedAt;
      }
    }

    if (stuMetaDoc?.payload) {
      const meta = stuMetaDoc.payload;
      cloudIncoming.studentsUpdatedAt = meta.studentsUpdatedAt || cloudIncoming.studentsUpdatedAt || 0;
      cloudIncoming.realStudentsImported = Boolean(meta.realStudentsImported || cloudIncoming.realStudentsImported);
      cloudIncoming.studentsCleaned = Boolean(meta.studentsCleaned);
      if (Array.isArray(meta.healthProfiles)) {
        cloudIncoming.healthProfiles = meta.healthProfiles;
      }
      if (Array.isArray(meta.deletedStudentIds)) {
        cloudIncoming.deletedStudentIds = Array.from(
          new Set([...(cloudIncoming.deletedStudentIds || []), ...meta.deletedStudentIds])
        );
      }

      const localStuCount = Array.isArray(cachedState?.students) ? cachedState.students.length : 0;
      const cloudTotalStu = Number(meta.totalStudents) || 0;
      const cloudChunkCount = Math.min(10, Number(meta.chunkCount || stuMetaDoc.chunkCount || 0));

      if (
        cloudChunkCount > 0 &&
        (cloudTotalStu > localStuCount ||
          Number(meta.studentsUpdatedAt || 0) > Number(cachedState?.studentsUpdatedAt || 0) ||
          !cachedState)
      ) {
        const chunkPromises = [];
        for (let i = 0; i < cloudChunkCount; i++) {
          chunkPromises.push(readFirestoreChunkServer(`thcs_dt_students_${i}`));
        }
        const chunkDocs = await Promise.all(chunkPromises);
        const allCloudStudents: any[] = [];
        for (const cDoc of chunkDocs) {
          if (cDoc?.payload && Array.isArray(cDoc.payload.students)) {
            allCloudStudents.push(...cDoc.payload.students);
          }
        }
        if (allCloudStudents.length > 0) {
          cloudIncoming.students = allCloudStudents;
        }
      }
    }

    const cloudRev = Math.max(
      Number(clsDoc?.revision || 0),
      Number(opDoc?.revision || 0),
      Number(stuMetaDoc?.revision || 0)
    );
    cloudIncoming.revision = cloudRev;

    const prevJson = cachedState ? JSON.stringify({ c: cachedState.classes, v: cachedState.clinicVisits?.length, s: cachedState.students?.length, st: cachedState.staffMembers?.length, stu: cachedState.staffUpdatedAt }) : '';
    cachedState = mergeSchoolState(cachedState, cloudIncoming);
    if (cloudRev > cachedState.revision) {
      cachedState.revision = cloudRev;
    }
    const nextJson = JSON.stringify({ c: cachedState.classes, v: cachedState.clinicVisits?.length, s: cachedState.students?.length, st: cachedState.staffMembers?.length, stu: cachedState.staffUpdatedAt });
    if (prevJson !== nextJson) {
      saveServerState(cachedState);
    }
    return true;
  } catch (err) {
    console.warn('Cloud Firestore pull notice:', err);
    return false;
  } finally {
    isCloudPulling = false;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));

  // Initial sync with Cloud Firestore on startup so cold-started containers immediately have the school's state
  pullStateFromCloudFirestore(true).catch(() => {});

  // Lightweight health & revision check for multi-computer real-time sync
  app.get('/api/health', async (_req, res) => {
    if (!cachedState) {
      cachedState = loadServerState();
    }
    res.json({
      ok: true,
      hasData: Boolean(cachedState),
      revision: cachedState?.revision || 0,
      updatedAt: cachedState?.updatedAt || null,
      counts: {
        students: cachedState?.students?.length || 0,
        classes: cachedState?.classes?.length || 0,
        clinicVisits: cachedState?.clinicVisits?.length || 0,
        staffMembers: cachedState?.staffMembers?.length || 0,
        medicines: cachedState?.medicines?.length || 0,
        batches: cachedState?.batches?.length || 0,
        transactions: cachedState?.transactions?.length || 0,
      },
    });
  });

  // Get full shared school state for any computer opening the app link
  app.get('/api/school-state', async (_req, res) => {
    if (!cachedState) {
      cachedState = loadServerState();
    }
    await pullStateFromCloudFirestore(false);
    res.json({
      ok: true,
      hasData: Boolean(cachedState),
      state: cachedState,
    });
  });

  // Merge and save full or partial school state from a client computer
  app.post('/api/school-state', async (req, res) => {
    try {
      const incoming = req.body;
      if (!incoming || typeof incoming !== 'object') {
        res.status(400).json({ ok: false, error: 'Invalid payload' });
        return;
      }
      if (!cachedState) {
        cachedState = loadServerState();
      }
      cachedState = mergeSchoolState(cachedState, incoming);
      saveServerState(cachedState);
      // Persist to Cloud Firestore in background so client receives an immediate response (<10ms)
      pushStateToCloudFirestore(cachedState, false).catch((err) => {
        console.warn('Background Cloud Firestore push notice:', err);
      });
      res.json({
        ok: true,
        revision: cachedState.revision,
        updatedAt: cachedState.updatedAt,
        counts: {
          students: cachedState.students?.length || 0,
          classes: cachedState.classes?.length || 0,
          clinicVisits: cachedState.clinicVisits?.length || 0,
          staffMembers: cachedState.staffMembers?.length || 0,
          batches: cachedState.batches?.length || 0,
          transactions: cachedState.transactions?.length || 0,
        },
      });
    } catch (err) {
      console.error('Error in POST /api/school-state:', err);
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // Dedicated instant endpoint for getting, adding, updating, importing, deleting staff members
  app.get('/api/staff-members', async (_req, res) => {
    if (!cachedState) {
      cachedState = loadServerState() || {};
    }
    await pullStateFromCloudFirestore(false);
    res.json({
      ok: true,
      count: cachedState?.staffMembers?.length || 0,
      staffUpdatedAt: cachedState?.staffUpdatedAt || null,
      staffMembers: cachedState?.staffMembers || [],
    });
  });

  app.post('/api/staff-members', async (req, res) => {
    try {
      const { action, staff, id, ids, staffMembers, replaceAll, oldIds } = req.body || {};
      if (!cachedState) {
        cachedState = loadServerState() || {};
      }
      await pullStateFromCloudFirestore(false);

      const deletedStaffIds = new Set(cachedState.deletedStaffIds || []);
      let staffList: any[] = Array.isArray(cachedState.staffMembers) ? [...cachedState.staffMembers] : [];

      if (action === 'delete' && id) {
        deletedStaffIds.add(id);
        staffList = staffList.filter((s) => s && s.id !== id);
      } else if (action === 'delete_multiple' && Array.isArray(ids)) {
        for (const targetId of ids) {
          if (targetId) deletedStaffIds.add(targetId);
        }
        const toDelete = new Set(ids);
        staffList = staffList.filter((s) => s && !toDelete.has(s.id));
      } else if (action === 'delete_all') {
        if (Array.isArray(oldIds)) {
          for (const targetId of oldIds) {
            if (targetId) deletedStaffIds.add(targetId);
          }
        }
        for (const s of staffList) {
          if (s?.id) deletedStaffIds.add(s.id);
        }
        staffList = [];
        cachedState.staffCleaned = true;
      } else if (action === 'add' && staff && staff.id) {
        deletedStaffIds.delete(staff.id);
        const idx = staffList.findIndex((s) => s && s.id === staff.id);
        if (idx !== -1) {
          staffList[idx] = { ...staffList[idx], ...staff };
        } else {
          staffList.push(staff);
        }
        cachedState.staffCleaned = false;
      } else if (action === 'update' && id) {
        const idx = staffList.findIndex((s) => s && s.id === id);
        if (idx !== -1) {
          staffList[idx] = { ...staffList[idx], ...(req.body.updates || staff || {}) };
        }
      } else if (action === 'import' && Array.isArray(staffMembers)) {
        cachedState.staffCleaned = false;
        if (replaceAll) {
          staffList = staffMembers;
        } else {
          staffList = mergeById(staffList, staffMembers, deletedStaffIds);
        }
      }

      cachedState.staffMembers = staffList;
      cachedState.deletedStaffIds = Array.from(deletedStaffIds);
      cachedState.staffUpdatedAt = Date.now();
      cachedState.revision = (Number(cachedState.revision) || 1) + 1;
      cachedState.updatedAt = new Date().toISOString();

      saveServerState(cachedState);
      pushStateToCloudFirestore(cachedState, false).catch((err) => {
        console.warn('Background Cloud Firestore push for staff notice:', err);
      });

      res.json({
        ok: true,
        count: cachedState.staffMembers.length,
        staffUpdatedAt: cachedState.staffUpdatedAt,
        staffMembers: cachedState.staffMembers,
      });
    } catch (err) {
      console.error('Error in POST /api/staff-members:', err);
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // Dedicated instant endpoint for saving/updating/deleting a clinic visit + deducted stock
  app.post('/api/clinic-visit', async (req, res) => {
    try {
      const { action, visit, visitId, batches, medicines, transactions, supplies, healthProfile } = req.body || {};
      if (!cachedState) {
        cachedState = loadServerState() || {};
      }
      await pullStateFromCloudFirestore(false);

      const deletedVisitIds = new Set(cachedState.deletedVisitIds || []);
      let visits = Array.isArray(cachedState.clinicVisits) ? [...cachedState.clinicVisits] : [];

      if (action === 'delete' && visitId) {
        deletedVisitIds.add(visitId);
        visits = visits.filter((v) => v && v.id !== visitId);
      } else if (visit && visit.id) {
        deletedVisitIds.delete(visit.id);
        const idx = visits.findIndex((v) => v && v.id === visit.id);
        if (idx !== -1) {
          visits[idx] = { ...visits[idx], ...visit };
        } else {
          visits.unshift(visit);
        }
      }

      cachedState.clinicVisits = visits;
      cachedState.deletedVisitIds = Array.from(deletedVisitIds);

      if (Array.isArray(batches) && batches.length > 0) {
        cachedState.batches = batches;
      }
      if (Array.isArray(medicines) && medicines.length > 0) {
        cachedState.medicines = medicines;
      }
      if (Array.isArray(transactions)) {
        cachedState.transactions = mergeById(cachedState.transactions, transactions, new Set(cachedState.deletedTxIds || []));
      }
      if (Array.isArray(supplies) && supplies.length > 0) {
        cachedState.supplies = supplies;
      }
      if (healthProfile && healthProfile.id) {
        cachedState.healthProfiles = mergeById(cachedState.healthProfiles, [healthProfile], null);
      }

      const visitMs = visit?.createdAt ? new Date(visit.createdAt).getTime() : 0;
      cachedState.inventoryUpdatedAt =
        visitMs > 0 && !isNaN(visitMs)
          ? Math.max(Number(cachedState.inventoryUpdatedAt) || 0, visitMs)
          : Number(cachedState.inventoryUpdatedAt) || Date.now();
      cachedState.revision = (Number(cachedState.revision) || 0) + 1;
      cachedState.updatedAt = new Date().toISOString();

      saveServerState(cachedState);
      await pushStateToCloudFirestore(cachedState, false);
      res.json({
        ok: true,
        revision: cachedState.revision,
        updatedAt: cachedState.updatedAt,
        clinicVisitsCount: cachedState.clinicVisits.length,
      });
    } catch (err) {
      console.error('Error in POST /api/clinic-visit:', err);
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  const distPath = path.join(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`School Health Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
