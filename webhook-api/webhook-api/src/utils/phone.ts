/**
 * Phone number normalization utilities
 * Normalizes phone numbers to E.164 format (+1XXXXXXXXXX)
 */

/**
 * Normalize phone number to +1 format
 * @param phone Raw phone number from various formats
 * @returns Normalized phone number in +1XXXXXXXXXX format or null if invalid
 */
export function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');

  // Handle different cases
  if (digitsOnly.length === 10) {
    // US number without country code: 5551234567 -> +15551234567
    return `+1${digitsOnly}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    // US number with country code: 15551234567 -> +15551234567
    return `+${digitsOnly}`;
  } else if (digitsOnly.length === 11 && !digitsOnly.startsWith('1')) {
    // Assume US number with country code prefix: 15551234567 -> +15551234567
    return `+1${digitsOnly.slice(1)}`;
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('1')) {
    // Already includes +1: 115551234567 -> +15551234567
    return `+${digitsOnly}`;
  }

  // For other lengths, assume it's already in correct format or invalid
  if (digitsOnly.length >= 10) {
    // If it's longer than expected, try to extract the last 10 digits as US number
    const last10 = digitsOnly.slice(-10);
    return `+1${last10}`;
  }

  // Invalid phone number
  return null;
}

/**
 * Format phone number for display (optional, for future use)
 * @param phone Normalized phone number (+1XXXXXXXXXX)
 * @returns Formatted phone number (XXX) XXX-XXXX
 */
export function formatPhoneForDisplay(phone: string): string {
  if (!phone.startsWith('+1') || phone.length !== 12) {
    return phone; // Return as-is if not in expected format
  }

  const digits = phone.slice(2); // Remove +1
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Validate phone number format
 * @param phone Phone number to validate
 * @returns true if valid +1 format
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone.startsWith('+1') || phone.length !== 12) {
    return false;
  }

  const digits = phone.slice(2);
  return /^\d{10}$/.test(digits);
}