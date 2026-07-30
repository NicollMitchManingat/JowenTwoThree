import { supabase } from '../lib/supabase'

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

export const offlineCache = {
  async set(key, data) {
    const db = await openDB(CACHE_DB, CACHE_STORE);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      tx.objectStore(STORE_NAME).put({ key, data, updatedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async get(key) {
    const db = await openDB(CACHE_DB, CACHE_STORE);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
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
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

function isOnline() {
  return navigator.onLine;
}

export async function processQueue() {
  if (!isOnline()) return;
  const pending = await offlineQueue.dequeueAll();
  if (pending.length === 0) return;

  const results = [];
  for (const op of pending) {
    try {
      let res;
      switch (op.method) {
        case 'insert':
          res = await supabase.from(op.table).insert(op.body).select();
          break;
        case 'update':
          res = await supabase.from(op.table).update(op.body).eq(op.matchField, op.matchValue).select();
          break;
        case 'delete':
          res = await supabase.from(op.table).delete().eq(op.matchField, op.matchValue);
          break;
      }
      if (res.error) throw res.error;
      results.push({ op, success: true });
    } catch (err) {
      results.push({ op, success: false, error: err });
      break;
    }
  }
  await offlineQueue.clear();
  const failed = results.filter(r => !r.success).map(r => r.op);
  for (const op of failed) {
    await offlineQueue.enqueue(op);
  }
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

