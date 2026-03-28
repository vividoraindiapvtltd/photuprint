import { test } from "node:test"
import assert from "node:assert/strict"

function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

test("roundMoney handles floating point cents", () => {
  assert.equal(roundMoney(10.005), 10.01)
  assert.equal(roundMoney(1.234), 1.23)
  assert.equal(roundMoney(0), 0)
})
