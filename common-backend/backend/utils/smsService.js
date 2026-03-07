/**
 * SMS and WhatsApp service for order confirmation and OTP.
 * Uses Fast2SMS API. Configure with: FAST2SMS_API_KEY
 * For WhatsApp: FAST2SMS_WHATSAPP_MESSAGE_ID, FAST2SMS_WHATSAPP_PHONE_NUMBER_ID
 * Get API key from https://www.fast2sms.com/dashboard/dev-api
 *
 * Uses Node built-in https (no native fetch in Node 16).
 */

import https from "https"

function getApiKey() {
  return (process.env.FAST2SMS_API_KEY || "").trim()
}

function getWhatsAppConfig() {
  return {
    messageId: (process.env.FAST2SMS_WHATSAPP_MESSAGE_ID || "").trim(),
    phoneNumberId: (process.env.FAST2SMS_WHATSAPP_PHONE_NUMBER_ID || "").trim(),
  }
}

/** Make an HTTPS request and return { status, data }. */
function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      const chunks = []
      res.on("data", (chunk) => chunks.push(chunk))
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8")
        let data
        try {
          data = JSON.parse(body)
        } catch {
          data = { raw: body }
        }
        resolve({ status: res.statusCode, data })
      })
    })
    req.on("error", reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

/**
 * Normalize phone to 10-digit Indian number for Fast2SMS.
 * Exported for use in auth (OTP login).
 */
export function normalizePhone(phone) {
  if (!phone || typeof phone !== "string") return null
  let p = phone.replace(/\D/g, "").trim()
  if (p.length === 12 && p.startsWith("91")) {
    p = p.slice(2)
  }
  if (p.length === 13 && p.startsWith("091")) {
    p = p.slice(3)
  }
  if (p.length === 10 && /^[6-9]/.test(p)) {
    return p
  }
  return null
}

/**
 * Send SMS via Fast2SMS Quick SMS route (POST with authorization header).
 * @param {string} to - Recipient phone (e.g. 9876543210 or +919876543210)
 * @param {string} body - Message text
 * @returns {Promise<boolean>}
 */
export async function sendSms(to, body) {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn("[Fast2SMS] API key not set; SMS skipped. Set FAST2SMS_API_KEY in backend .env")
    return false
  }

  const toPhone = normalizePhone(to)
  if (!toPhone) {
    console.warn("[Fast2SMS] Invalid phone number:", to)
    return false
  }

  const payload = JSON.stringify({
    route: "q",
    message: String(body).slice(0, 1000),
    flash: "0",
    numbers: toPhone,
  })

  console.log("[Fast2SMS] Sending SMS to", toPhone, "| message length:", body.length)

  try {
    const { status, data } = await httpsRequest("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      body: payload,
    })

    console.log("[Fast2SMS] Response status:", status, "| body:", JSON.stringify(data))

    if (status < 200 || status >= 300 || data.return === false) {
      const errMsg = data.message || data.msg || data.error || data.raw || JSON.stringify(data)
      console.error("[Fast2SMS] SMS failed. Status:", status, "| Error:", errMsg)
      console.error("[Fast2SMS] Check: API key validity, account balance, DLT status at https://www.fast2sms.com/dashboard/dev-api")
      return false
    }

    console.log("[Fast2SMS] SMS sent successfully to", toPhone, "| request_id:", data.request_id)
    return true
  } catch (err) {
    console.error("[Fast2SMS] Network error:", err.message)
    return false
  }
}

/**
 * Send WhatsApp template message via Fast2SMS.
 * @param {string} to - Recipient phone (10-digit)
 * @param {string[]} variables - Template variable values (pipe-joined)
 * @returns {Promise<boolean>}
 */
export async function sendWhatsApp(to, variables = []) {
  const apiKey = getApiKey()
  const { messageId, phoneNumberId } = getWhatsAppConfig()

  if (!apiKey || !messageId || !phoneNumberId) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[Fast2SMS] WhatsApp not configured; skipped.")
    }
    return false
  }

  const toPhone = normalizePhone(to)
  if (!toPhone) {
    console.warn("[Fast2SMS] Invalid phone for WhatsApp:", to)
    return false
  }

  try {
    const params = new URLSearchParams({
      authorization: apiKey,
      message_id: messageId,
      phone_number_id: phoneNumberId,
      numbers: toPhone,
    })
    if (variables.length > 0) {
      params.append("variables_values", variables.join("|"))
    }

    const url = `https://www.fast2sms.com/dev/whatsapp?${params.toString()}`
    const { status, data } = await httpsRequest(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    })

    if (status < 200 || status >= 300 || data.status === false) {
      console.error("[Fast2SMS] WhatsApp error:", status, data.message || data.msg || JSON.stringify(data))
      return false
    }

    console.log("[Fast2SMS] WhatsApp sent to", toPhone)
    return true
  } catch (err) {
    console.error("[Fast2SMS] WhatsApp failed:", err.message)
    return false
  }
}

/**
 * Send order confirmation SMS and WhatsApp after successful payment.
 * @param {Object} order - Order with orderNumber, totalAmount, shippingAddress
 */
export async function sendOrderConfirmationSms(order) {
  const phone = order?.shippingAddress?.phone || order?.user?.phone
  if (!phone) {
    console.warn("[Fast2SMS] No phone for order", order?.orderNumber)
    return false
  }

  const orderNumber = order?.orderNumber || order?._id || "N/A"
  const total = order?.totalAmount ?? 0
  const smsBody = `Order confirmed! Order #${orderNumber}. Total: Rs.${total.toFixed(0)}. Thank you for shopping with PhotuPrint.`

  const results = await Promise.allSettled([
    sendSms(phone, smsBody),
    sendWhatsApp(phone, [orderNumber, `Rs.${total.toFixed(0)}`]),
  ])

  const smsOk = results[0]?.status === "fulfilled" && results[0]?.value
  const waOk = results[1]?.status === "fulfilled" && results[1]?.value
  return smsOk || waOk
}
