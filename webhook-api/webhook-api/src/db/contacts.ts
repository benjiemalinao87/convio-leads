import { D1Database } from '@cloudflare/workers-types'
import { generateContactId, generateUniqueId } from '../utils/idGenerator'

export interface ContactRecord {
  webhook_id: string
  phone: string
  first_name: string
  last_name: string
  email?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
}

export interface ContactWithId extends ContactRecord {
  id: number
  created_at: string
  updated_at: string
}

export class ContactDatabase {
  constructor(private db: D1Database) {}

  // Find existing contact by webhook_id and phone
  async findContactByPhone(webhookId: string, phone: string): Promise<ContactWithId | null> {
    const { results } = await this.db
      .prepare('SELECT * FROM contacts WHERE webhook_id = ? AND phone = ?')
      .bind(webhookId, phone)
      .all()

    if (results.length === 0) {
      return null
    }

    // Temporarily return any to fix TypeScript error
    return results[0] as any
  }

  // Create new contact
  async createContact(contactData: ContactRecord): Promise<number> {
    // Generate unique 6-digit contact ID
    const contactId = await generateUniqueId(this.db, 'contacts', generateContactId)

    const result = await this.db
      .prepare(`
        INSERT INTO contacts (
          id, webhook_id, phone, first_name, last_name, email,
          address, city, state, zip_code,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)
      .bind(
        contactId,
        contactData.webhook_id,
        contactData.phone,
        contactData.first_name,
        contactData.last_name,
        contactData.email || null,
        contactData.address || null,
        contactData.city || null,
        contactData.state || null,
        contactData.zip_code || null
      )
      .run()

    if (!result.success) {
      throw new Error('Failed to create contact')
    }

    // Log contact creation event
    await this.logContactEvent(contactId, 'created', {
      webhook_id: contactData.webhook_id,
      phone: contactData.phone,
      email: contactData.email
    })

    return contactId
  }

  // Update existing contact with new information
  async updateContact(contactId: number, contactData: Partial<ContactRecord>): Promise<void> {
    const updateFields: string[] = []
    const updateValues: any[] = []

    // Build dynamic update query based on provided fields
    if (contactData.first_name !== undefined) {
      updateFields.push('first_name = ?')
      updateValues.push(contactData.first_name)
    }
    if (contactData.last_name !== undefined) {
      updateFields.push('last_name = ?')
      updateValues.push(contactData.last_name)
    }
    if (contactData.email !== undefined) {
      updateFields.push('email = ?')
      updateValues.push(contactData.email)
    }
    if (contactData.address !== undefined) {
      updateFields.push('address = ?')
      updateValues.push(contactData.address)
    }
    if (contactData.city !== undefined) {
      updateFields.push('city = ?')
      updateValues.push(contactData.city)
    }
    if (contactData.state !== undefined) {
      updateFields.push('state = ?')
      updateValues.push(contactData.state)
    }
    if (contactData.zip_code !== undefined) {
      updateFields.push('zip_code = ?')
      updateValues.push(contactData.zip_code)
    }

    if (updateFields.length === 0) {
      return // Nothing to update
    }

    // Always update the updated_at timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP')
    updateValues.push(contactId)

    const query = `UPDATE contacts SET ${updateFields.join(', ')} WHERE id = ?`

    const result = await this.db
      .prepare(query)
      .bind(...updateValues)
      .run()

    if (!result.success) {
      throw new Error('Failed to update contact')
    }

    // Log contact update event
    await this.logContactEvent(contactId, 'updated', contactData)
  }

  // Get contact with lead count
  async getContactWithStats(contactId: number): Promise<any> {
    const { results } = await this.db
      .prepare(`
        SELECT
          c.*,
          COUNT(l.id) as total_leads,
          MAX(l.created_at) as last_lead_date
        FROM contacts c
        LEFT JOIN leads l ON c.id = l.contact_id
        WHERE c.id = ?
        GROUP BY c.id
      `)
      .bind(contactId)
      .all()

    return results.length > 0 ? results[0] : null
  }

  // Find or create contact (upsert pattern)
  async findOrCreateContact(webhookId: string, phone: string, contactData: ContactRecord): Promise<{ contact: ContactWithId; isNew: boolean }> {
    // Try to find existing contact first
    let contact = await this.findContactByPhone(webhookId, phone)

    if (contact) {
      // Update existing contact with any new information
      await this.updateContact(contact.id, contactData)

      // Fetch updated contact data
      contact = await this.findContactByPhone(webhookId, phone)

      return { contact: contact!, isNew: false }
    } else {
      // Create new contact
      const contactId = await this.createContact(contactData)

      // Fetch the created contact
      contact = await this.findContactByPhone(webhookId, phone)

      return { contact: contact!, isNew: true }
    }
  }

  // Log contact events
  private async logContactEvent(contactId: number, eventType: string, eventData: any): Promise<void> {
    try {
      await this.db
        .prepare('INSERT INTO contact_events (contact_id, event_type, event_data, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
        .bind(contactId, eventType, JSON.stringify(eventData))
        .run()
    } catch (error) {
      console.error('Failed to log contact event:', error)
      // Don't throw - logging failures shouldn't break the main flow
    }
  }

  // Get all leads for a contact
  async getContactLeads(contactId: number): Promise<any[]> {
    const { results } = await this.db
      .prepare(`
        SELECT
          l.*,
          c.phone as contact_phone,
          c.first_name as contact_first_name,
          c.last_name as contact_last_name
        FROM leads l
        JOIN contacts c ON l.contact_id = c.id
        WHERE c.id = ?
        ORDER BY l.created_at DESC
      `)
      .bind(contactId)
      .all()

    return results
  }
}