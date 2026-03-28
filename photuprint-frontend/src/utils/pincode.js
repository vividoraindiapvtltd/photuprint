/** India pincode lookup (postalpincode.in) — shared by cart and product PDP. */
export async function fetchPincodeDetails(pincode) {
  if (!pincode || String(pincode).trim().length !== 6) return { city: "", state: "", valid: false }
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(pincode.trim())}`)
    const data = await res.json()
    if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
      const po = data[0].PostOffice[0]
      return {
        city: po.District || "",
        state: po.State || "",
        valid: true,
      }
    }
  } catch (e) {
    console.error("Pincode lookup failed:", e)
  }
  return { city: "", state: "", valid: false }
}
