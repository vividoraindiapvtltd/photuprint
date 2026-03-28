/**
 * Inserts a dummy default cashback rule for admin UI testing.
 *
 * Usage (from common-backend):
 *   node backend/scripts/seed-dummy-cashback-rule.js
 *
 * Optional env:
 *   WEBSITE_ID=<24-char hex>  — target website; otherwise uses first active website.
 */
import mongoose from "mongoose"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

import { DB_NAME } from "../constants.js"
import Website from "../models/website.model.js"
import CashbackRule from "../models/cashbackRule.model.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({
  path: path.join(__dirname, "..", ".env"),
})

const DUMMY_NOTES = "Dummy test rule (seed script)"

function requireEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

async function main() {
  const uri = requireEnv("MONGODB_URI")

  await mongoose.connect(uri, {
    dbName: DB_NAME,
    writeConcern: { w: 1, j: false },
  })

  let websiteId = process.env.WEBSITE_ID?.trim()
  if (websiteId) {
    const w = await Website.findById(websiteId)
    if (!w) {
      throw new Error(`No website found for WEBSITE_ID=${websiteId}`)
    }
  } else {
    const w = await Website.findOne({ deleted: false, isActive: true }).sort({ createdAt: 1 })
    if (!w) {
      throw new Error("No active website found. Create a website in admin or set WEBSITE_ID.")
    }
    websiteId = w._id.toString()
    console.log(`Using website: ${w.name} (${websiteId})`)
  }

  const existing = await CashbackRule.findOne({
    website: websiteId,
    scope: "default",
    notes: DUMMY_NOTES,
  })

  if (existing) {
    console.log("Dummy cashback rule already exists:", existing._id.toString())
    console.log(JSON.stringify(existing.toObject(), null, 2))
    await mongoose.disconnect()
    return
  }

  const rule = await CashbackRule.create({
    website: websiteId,
    scope: "default",
    category: null,
    product: null,
    percent: 5,
    expiryDays: 90,
    priority: 10,
    isActive: true,
    notes: DUMMY_NOTES,
  })

  console.log("Created dummy cashback rule:", rule._id.toString())
  console.log(JSON.stringify(rule.toObject(), null, 2))
  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error(err)
  try {
    await mongoose.disconnect()
  } catch {
    // ignore
  }
  process.exit(1)
})
