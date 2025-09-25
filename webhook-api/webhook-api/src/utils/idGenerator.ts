/**
 * ID Generation Utilities
 *
 * Contact IDs: 6-digit unique numbers (100000-999999)
 * Lead IDs: 10-digit unique numbers (1000000000-9999999999)
 */

/**
 * Generate a 6-digit unique contact ID
 * @returns {number} Random number between 100000 and 999999
 */
export function generateContactId(): number {
  return Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;
}

/**
 * Generate a 10-digit unique lead ID
 * @returns {number} Random number between 1000000000 and 9999999999
 */
export function generateLeadId(): number {
  return Math.floor(Math.random() * (9999999999 - 1000000000 + 1)) + 1000000000;
}

/**
 * Check if an ID exists in the database and generate a new one if it does
 * @param db D1 database instance
 * @param table Table name ('contacts' or 'leads')
 * @param generator Function to generate new ID
 * @returns {Promise<number>} Unique ID that doesn't exist in database
 */
export async function generateUniqueId(
  db: any,
  table: 'contacts' | 'leads',
  generator: () => number
): Promise<number> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const id = generator();

    // Check if ID already exists
    const { results } = await db
      .prepare(`SELECT id FROM ${table} WHERE id = ?`)
      .bind(id)
      .all();

    if (results.length === 0) {
      return id; // ID is unique
    }

    attempts++;
  }

  throw new Error(`Failed to generate unique ID for ${table} after ${maxAttempts} attempts`);
}