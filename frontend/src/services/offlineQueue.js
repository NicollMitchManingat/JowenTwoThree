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
        case 'sale':
          await replayQueuedSale(op.body);
          break;
        case 'inventory-update':
          await replayInventoryUpdate(op);
          break;
        default:
          throw new Error(`Unknown queued operation: ${op.method}`);
      }
      if (res && res.error) throw res.error;
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

// Replays one POS sale queued while the database was unreachable.
// Deferred db import avoids a static cycle (services/db.js imports this
// module for offlineQueue/processQueue).
// Idempotent on the transaction via idempotency_key: a sale that partially
// synced before failing resumes instead of duplicating.
// Stock can't be un-sold, so deductions apply with allowShortage (short
// lines floor at 0 and the shortfall is recorded in the adjustment notes).
// Item rows are best-effort: the transaction row already carries the full
// cart JSONB, so the sale survives even if item rows fail (e.g. bundled
// mock product ids with no matching products row).
async function replayQueuedSale(sale) {
  const { db } = await import('./db.js');
  const txn = sale.transaction;
  let txnId;
  let txnNumber = txn.transaction_number;
  const existing = await supabase
    .from('transactions')
    .select('id, transaction_number')
    .eq('idempotency_key', txn.idempotency_key)
    .limit(1);
  if (existing.error) throw existing.error;
  if (existing.data && existing.data.length > 0) {
    txnId = existing.data[0].id;
    txnNumber = existing.data[0].transaction_number;
  } else {
    const ins = await supabase.from('transactions').insert(txn).select();
    if (ins.error) throw ins.error;
    txnId = ins.data[0].id;
  }
  if (!sale.itemsSkipped && Array.isArray(sale.items) && sale.items.length > 0) {
    try {
      const rows = sale.items.map((it) => ({ ...it, transaction_id: txnId }));
      const itemsRes = await supabase.from('transaction_items').insert(rows);
      if (itemsRes.error) throw itemsRes.error;
    } catch (err) {
      console.warn('Queued sale items failed to sync (sale itself is kept):', err);
    }
  }
  if (!sale.trafficSkipped && sale.traffic) {
    try {
      await db.logTraffic(sale.traffic);
    } catch (err) {
      console.warn('Queued sale traffic failed to sync (sale itself is kept):', err);
    }
  }
  if (!sale.deductionsSkipped) {
    let required = [];
    try {
      required = await db.computeRequiredDeductions(sale.cart || []);
    } catch (err) {
      if (err?.code === 'INSUFFICIENT_STOCK') required = err.required || [];
      else throw err;
    }
    await db.applyDeductions(required, txnNumber, { allowShortage: true });
  }
}

// Replays one UI-initiated inventory edit queued while the database was
// unreachable (see queueInventoryUpdate in services/db.js).
// name/category/unit apply direct (last-write-wins — no arithmetic to
// conflict). stock_quantity applies as a DELTA (queued value minus the
// on-screen value at queue time) clamped at 0, with an adjustments row so
// the ledger stays truthful. A row deleted in the meantime drops the op
// with a warning instead of resurrecting it.
// Exported for unit tests (driven through processQueue in production).
export async function replayInventoryUpdate(op) {
  const { body = {}, base = {}, reason, notes, skipAdjustment } = op
  const live = await supabase
    .from(op.table || 'inventory')
    .select('*')
    .eq(op.matchField || 'id', op.matchValue)
    .limit(1)
  if (live.error) throw live.error
  const row = (live.data || [])[0]
  if (!row) {
    console.warn('Queued inventory update dropped (row gone):', op.matchValue)
    return
  }
  const { stock_quantity: _ignored, ...direct } = body
  if (Object.keys(direct).length > 0) {
    const upd = await supabase
      .from(op.table || 'inventory')
      .update(direct)
      .eq(op.matchField || 'id', op.matchValue)
    if (upd.error) throw upd.error
  }
  if (typeof body.stock_quantity !== 'undefined') {
    const baseQty = Number(base?.stock_quantity)
    const targetQty = Number(body.stock_quantity)
    if (Number.isFinite(baseQty) && Number.isFinite(targetQty)) {
      const liveQty = Number(row.stock_quantity)
      const nextQty = Math.max(0, (Number.isFinite(liveQty) ? liveQty : 0) + (targetQty - baseQty))
      const qtyUpd = await supabase
        .from(op.table || 'inventory')
        .update({ stock_quantity: nextQty })
        .eq(op.matchField || 'id', op.matchValue)
      if (qtyUpd.error) throw qtyUpd.error
      if (!skipAdjustment) {
        const adj = await supabase.from('inventory_adjustments').insert({
          inventory_id: op.matchValue,
          previous_quantity: row.stock_quantity,
          new_quantity: nextQty,
          change_amount: nextQty - Number(row.stock_quantity),
          reason: reason || 'offline-edit',
          notes: notes || null,
        })
        if (adj.error) throw adj.error
      }
    }
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

