/**
 * Validates password strength.
 * Rules: min 8 chars, at least 1 uppercase letter, at least 1 special character.
 * @param {string} password
 * @returns {string|null} Error message or null if valid
 */
export function validatePassword(password) {
  if (!password || password.length < 8) return "Password must be at least 8 characters"
  if (!/[A-Z]/.test(password)) return "Password must contain at least 1 uppercase letter"
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return "Password must contain at least 1 special character"
  return null
}

export const PASSWORD_RULES = "Min 8 characters, 1 uppercase, 1 special character"
