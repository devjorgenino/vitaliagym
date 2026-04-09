import { openDB } from 'idb';

const DB_NAME = 'vitaliagym-offline-db';
const STORE_NAME = 'mutations';

export async function initDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('queries')) {
        db.createObjectStore('queries', { keyPath: 'key' });
      }
    },
  });
}

export async function saveMutation(mutation) {
  const db = await initDB();
  return db.add(STORE_NAME, {
    ...mutation,
    timestamp: Date.now(),
  });
}

export async function getMutations() {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

export async function clearMutation(id) {
  const db = await initDB();
  return db.delete(STORE_NAME, id);
}

export async function clearAllMutations() {
  const db = await initDB();
  return db.clear(STORE_NAME);
}
