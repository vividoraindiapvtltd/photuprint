import * as walletLedger from "../services/walletLedger.service.js"

function parseOptionalISODate(s) {
  if (s == null || String(s).trim() === "") return null
  const t = String(s).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  return t
}

/** Admin / self: balance for a user on current website */
export const getWalletBalance = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: "Website context is required" })
    const targetUserId = req.query.userId || req.user?._id || req.user?.id
    if (!targetUserId) return res.status(400).json({ msg: "userId required" })
    const isAdmin = ["admin", "super_admin", "editor"].includes(req.user?.role)
    const self = String(targetUserId) === String(req.user?._id || req.user?.id)
    if (!isAdmin && !self) return res.status(403).json({ msg: "Forbidden" })

    const balance = await walletLedger.getBalance(targetUserId, req.websiteId)
    res.json({ balance, currency: "INR" })
  } catch (e) {
    console.error(e)
    res.status(500).json({ msg: "Failed to load balance" })
  }
}

export const getWalletLedger = async (req, res) => {
  try {
    if (!req.websiteId) return res.status(400).json({ msg: "Website context is required" })
    const targetUserId = req.query.userId || req.user?._id || req.user?.id
    if (!targetUserId) return res.status(400).json({ msg: "userId required" })
    const isAdmin = ["admin", "super_admin", "editor"].includes(req.user?.role)
    const self = String(targetUserId) === String(req.user?._id || req.user?.id)
    if (!isAdmin && !self) return res.status(403).json({ msg: "Forbidden" })

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200)
    const skip = parseInt(req.query.skip, 10) || 0
    const fromDate = parseOptionalISODate(req.query.fromDate)
    const toDate = parseOptionalISODate(req.query.toDate)
    if (req.query.fromDate && !fromDate) {
      return res.status(400).json({ msg: "fromDate must be YYYY-MM-DD" })
    }
    if (req.query.toDate && !toDate) {
      return res.status(400).json({ msg: "toDate must be YYYY-MM-DD" })
    }
    if (fromDate && toDate && fromDate > toDate) {
      return res.status(400).json({ msg: "fromDate cannot be after toDate" })
    }

    const entries = await walletLedger.listLedgerForUser(targetUserId, req.websiteId, {
      limit,
      skip,
      fromDate,
      toDate,
    })
    const cashbackEntries = await walletLedger.listCashbackLedgerForUser(targetUserId, req.websiteId, {
      limit: Math.min(limit, 200),
      skip: 0,
      fromDate,
      toDate,
    })
    res.json({ entries, cashbackEntries, limit, skip, fromDate: fromDate || null, toDate: toDate || null })
  } catch (e) {
    console.error(e)
    res.status(500).json({ msg: "Failed to load ledger" })
  }
}
