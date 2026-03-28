import mongoose from "mongoose"
import Wallet from "../models/wallet.model.js"
import WalletTransaction from "../models/walletTransaction.model.js"

function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

/**
 * @param {import('mongoose').ClientSession} [session]
 */
export async function getOrCreateWallet(userId, websiteId, session = null) {
  const q = Wallet.findOne({ user: userId, website: websiteId })
  if (session) q.session(session)
  let w = await q
  if (w) return w
  const create = Wallet.create([{ user: userId, website: websiteId, balance: 0 }], { session })
  const arr = await create
  return arr[0]
}

/**
 * Debit wallet (money out). Idempotent: same idempotencyKey returns existing result without double charge.
 */
export async function debitWallet({
  userId,
  websiteId,
  amount,
  idempotencyKey,
  reason,
  orderId = null,
  meta = {},
  session = null,
}) {
  if (!idempotencyKey) throw new Error("idempotencyKey is required for wallet debit")
  const amt = roundMoney(amount)
  if (amt <= 0) throw new Error("Debit amount must be positive")

  const existing = await WalletTransaction.findOne({ idempotencyKey }).session(session || null)
  if (existing) {
    const w = await getOrCreateWallet(userId, websiteId, session)
    return { transaction: existing, wallet: w, duplicate: true }
  }

  const wallet = await getOrCreateWallet(userId, websiteId, session)
  if (roundMoney(wallet.balance) < amt) {
    throw new Error("Insufficient wallet balance")
  }

  const newBalance = roundMoney(wallet.balance - amt)
  const updated = await Wallet.findOneAndUpdate(
    { _id: wallet._id, balance: { $gte: amt } },
    { $inc: { balance: -amt } },
    { new: true, session }
  )
  if (!updated) throw new Error("Insufficient wallet balance (concurrent update)")

  const [tx] = await WalletTransaction.create(
    [
      {
        user: userId,
        website: websiteId,
        order: orderId,
        amount: -amt,
        balanceAfter: newBalance,
        reason,
        idempotencyKey,
        meta,
      },
    ],
    { session }
  )
  return { transaction: tx, wallet: updated, duplicate: false }
}

/**
 * Credit wallet (money in). Idempotent by idempotencyKey.
 */
export async function creditWallet({
  userId,
  websiteId,
  amount,
  idempotencyKey,
  reason,
  orderId = null,
  expiresAt = null,
  meta = {},
  session = null,
}) {
  if (!idempotencyKey) throw new Error("idempotencyKey is required for wallet credit")
  const amt = roundMoney(amount)
  if (amt <= 0) throw new Error("Credit amount must be positive")

  const existing = await WalletTransaction.findOne({ idempotencyKey }).session(session || null)
  if (existing) {
    const w = await getOrCreateWallet(userId, websiteId, session)
    return { transaction: existing, wallet: w, duplicate: true }
  }

  const wallet = await getOrCreateWallet(userId, websiteId, session)
  const newBalance = roundMoney(wallet.balance + amt)

  const updated = await Wallet.findByIdAndUpdate(
    wallet._id,
    { $inc: { balance: amt } },
    { new: true, session }
  )

  const [tx] = await WalletTransaction.create(
    [
      {
        user: userId,
        website: websiteId,
        order: orderId,
        amount: amt,
        balanceAfter: newBalance,
        reason,
        idempotencyKey,
        expiresAt,
        meta,
      },
    ],
    { session }
  )
  return { transaction: tx, wallet: updated, duplicate: false }
}

/** YYYY-MM-DD → UTC day start */
function utcDayStart(isoDate) {
  const [y, m, d] = String(isoDate).split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
}

/** YYYY-MM-DD → UTC day end */
function utcDayEnd(isoDate) {
  const [y, m, d] = String(isoDate).split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
}

/**
 * @param {{ limit?: number, skip?: number, fromDate?: string, toDate?: string }} opts
 * fromDate / toDate: YYYY-MM-DD (optional). Both ends inclusive in UTC.
 */
export async function listLedgerForUser(userId, websiteId, { limit = 50, skip = 0, fromDate, toDate } = {}) {
  const query = { user: userId, website: websiteId }
  if (fromDate || toDate) {
    query.createdAt = {}
    if (fromDate) {
      const start = utcDayStart(fromDate)
      if (start) query.createdAt.$gte = start
    }
    if (toDate) {
      const end = utcDayEnd(toDate)
      if (end) query.createdAt.$lte = end
    }
    if (Object.keys(query.createdAt).length === 0) delete query.createdAt
  }

  return WalletTransaction.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Math.min(limit, 200))
    .populate("order", "orderNumber totalAmount orderStatus")
    .lean()
}

const CASHBACK_REASONS = new Set([
  "cashback_order_delivered",
  "cashback_reversed_refund",
  "cashback_expired",
])

/**
 * Ledger lines that are cashback-related (assigned credit, reversal, expiry debit).
 */
export async function listCashbackLedgerForUser(userId, websiteId, { limit = 100, skip = 0, fromDate, toDate } = {}) {
  const query = {
    user: userId,
    website: websiteId,
    reason: { $in: [...CASHBACK_REASONS] },
  }
  if (fromDate || toDate) {
    query.createdAt = {}
    if (fromDate) {
      const start = utcDayStart(fromDate)
      if (start) query.createdAt.$gte = start
    }
    if (toDate) {
      const end = utcDayEnd(toDate)
      if (end) query.createdAt.$lte = end
    }
    if (Object.keys(query.createdAt).length === 0) delete query.createdAt
  }

  return WalletTransaction.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Math.min(limit, 200))
    .populate("order", "orderNumber totalAmount orderStatus")
    .lean()
}

export async function getBalance(userId, websiteId) {
  const w = await Wallet.findOne({ user: userId, website: websiteId }).lean()
  return w ? roundMoney(w.balance) : 0
}
