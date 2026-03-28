/**
 * Unit examples: stable idempotency keys for cashback wallet operations.
 */
import { test } from "node:test"
import assert from "node:assert/strict"

const IDEMPOTENCY_DELIVERED = (orderId) => `cashback:delivered:${orderId}`
const IDEMPOTENCY_REVERSE = (orderId) => `cashback:reverse:${orderId}`

test("delivered cashback key is deterministic", () => {
  const id = "507f1f77bcf86cd799439011"
  assert.equal(IDEMPOTENCY_DELIVERED(id), "cashback:delivered:507f1f77bcf86cd799439011")
})

test("reverse cashback key differs from delivered key for same order", () => {
  const id = "507f1f77bcf86cd799439011"
  assert.notEqual(IDEMPOTENCY_DELIVERED(id), IDEMPOTENCY_REVERSE(id))
})
