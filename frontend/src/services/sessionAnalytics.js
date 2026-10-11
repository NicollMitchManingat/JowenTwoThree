import { db } from './db';

export const HISTORY_PAGE_SIZE = 10;

export function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);

// Pure close-out math over a session window. Mirrors the Transactions tab:
// fully refunded orders leave gross entirely; partial refunds subtract.
// Customer totals sum the M/F/U split (robust against legacy rows).
export function computeSessionSummary(txns, refundsByTxn) {
  const list = txns || [];
  const grouped = refundsByTxn || {};
  let gross = 0;
  let discounts = 0;
  let refunded = 0;
  let refundCount = 0;
  let male = 0;
  let female = 0;
  let unspecified = 0;
  list.forEach((o) => {
    const recs = grouped[o.id] || [];
    const r = recs.reduce((sum, rec) => sum + num(rec.refund_amount), 0);
    refundCount += recs.length;
    if ((o.status || 'COMPLETED') !== 'REFUNDED') {
      gross += num(o.total);
      discounts += num(o.discount);
      refunded += r;
    }
    male += num(o.male_count);
    female += num(o.female_count);
    unspecified += num(o.unspecified_count);
  });
  const orders = list.length;
  const customers = male + female + unspecified;
  return {
    orders,
    gross,
    discounts,
    refunded,
    refundCount,
    net: gross - refunded,
    customers: { total: customers, male, female, unspecified },
    avgOrder: orders > 0 ? gross / orders : 0,
  };
}

export function summarizeSessionWindow(session, summary) {
  const start = new Date(session.started_at).getTime();
  const end = new Date(session.ended_at || Date.now()).getTime();
  const hours = Math.max(Number.isFinite(end - start) ? (end - start) / 3600000 : 0, 1 / 3600);
  return {
    ...summary,
    hours,
    salesPerHour: summary.orders / hours,
    revPerHour: summary.gross / hours,
  };
}

// One range query for a session window (never fans out to N queries).
export async function loadSessionSummary(session) {
  const txns = await db.getTransactionsForAnalytics(session.started_at, session.ended_at);
  const ids = (txns || []).map((o) => o.id).filter(Boolean);
  const refunds = await db.getRefundsForTransactions(ids);
  const grouped = {};
  (refunds || []).forEach((r) => {
    if (!grouped[r.transaction_id]) grouped[r.transaction_id] = [];
    grouped[r.transaction_id].push(r);
  });
  return summarizeSessionWindow(session, computeSessionSummary(txns, grouped));
}
