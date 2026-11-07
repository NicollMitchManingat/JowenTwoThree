import { apiRequest, currentActorId } from './apiClient'

const DB_NAME = 'jowen-offline-queue';
const STORE_NAME = 'mutations';
const CACHE_DB = 'jowen-offline-cache';
const CACHE_STORE = 'cache';

function openDB(name, store) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(store)) {
        req.result.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const offlineQueue = {
  async enqueue(operation) {
    const db = await openDB(DB_NAME, STORE_NAME);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add({
        ...operation,
        createdAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async dequeueAll() {
    const db = await openDB(DB_NAME, STORE_NAME);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async enqueueCommand(body) {
    const actorId = currentActorId();
    if (!actorId) throw new Error('Sign in before saving an offline stock change.');
    await this.enqueue({ method: 'authorized-inventory', actorId, body: { operationKey: crypto.randomUUID(), ...body } });
    return { id: body.id || body.operationKey || crypto.randomUUID(), ...body.values, _queued: true };
  },
  async remove(id) {
    const db = await openDB(DB_NAME, STORE_NAME);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
  },
  async clear() {
    const db = await openDB(DB_NAME, STORE_NAME);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async size() {
    const db = await openDB(DB_NAME, STORE_NAME);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
};

// NOTE: the POS menu snapshot does NOT use this store — it lives in
// services/menuCache.js (localStorage) so the render path can read it
// synchronously when Supabase is unreachable.
export const offlineCache = {
  async set(key, data) {
    const db = await openDB(CACHE_DB, CACHE_STORE);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      tx.objectStore(CACHE_STORE).put({ key, data, updatedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async get(key) {
    const db = await openDB(CACHE_DB, CACHE_STORE);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const req = tx.objectStore(CACHE_STORE).getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        const match = items.find(i => i.key === key);
        resolve(match ? match.data : null);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async clear() {
    const db = await openDB(CACHE_DB, CACHE_STORE);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      tx.objectStore(CACHE_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

function isOnline() {
  return navigator.onLine;
}

let processing = false;
export async function processQueue() {
  if (!isOnline() || processing) return;
  processing = true;
  try {
    const pending = await offlineQueue.dequeueAll();
    if (pending.some(op => op.method !== 'authorized-inventory')) window.dispatchEvent(new Event('jowen-queue-review'));
    if (!pending.some(op => op.method === 'authorized-inventory')) return;
    const { user } = await apiRequest('/api/auth/me');
    for (const op of pending) {
      // Legacy operations have no authenticated actor or approval. Preserve them
      // for reconciliation; never reinterpret them as another user's writes.
      if (op.method !== 'authorized-inventory' || op.actorId !== user.id) continue;
      try {
        await apiRequest('/api/commands/inventory', { method: 'POST', body: op.body });
        await offlineQueue.remove(op.id);
      } catch { window.dispatchEvent(new Event('jowen-queue-review')); break; }
    }
  } finally { processing = false; }
}

export function wrapDbMethod(fn, cacheKey) {
  return async (...args) => {
    try {
      const result = await fn(...args);
      if (cacheKey) {
        await offlineCache.set(cacheKey, result);
      }
      return result;
    } catch (err) {
      if (cacheKey && !isOnline()) {
        const cached = await offlineCache.get(cacheKey);
        if (cached) return cached;
      }
      if (!isOnline()) {
        throw new Error('You are offline. Please try again when connected.');
      }
      throw err;
    }
  };
}

