# Appointment API Simplification

## Overview

When a `lead_id` is provided, the appointment API now uses **ONLY** data from the lead record for routing and customer information. This eliminates the need to send redundant customer data in the request payload.

## Simplified Payload Structure

### With `lead_id` (Simplified)

When you have an existing lead, you only need to send:

```json
{
  "lead_id": 4971027880,
  "appointment_date": "2025-10-01T14:00:00Z",
  "estimated_value": 25000,
  "appointment_notes": "Customer interested in 10kW solar system - converted from lead to scheduled appointment"
}
```

**Required fields when `lead_id` is provided:**
- `lead_id` - The existing lead ID
- `appointment_date` - ISO format date/time

**Optional fields:**
- `estimated_value` - Estimated appointment value
- `appointment_notes` - Additional notes
- `appointment_duration` - Duration in minutes (defaults to 60)
- `appointment_type` - Type of appointment (defaults to 'consultation')
- `workspace_id` - Override routing to specific workspace

**Ignored fields (data comes from lead record):**
- `customer_name` - Fetched from `contacts.first_name` and `contacts.last_name`
- `customer_phone` - Fetched from `contacts.phone`
- `customer_email` - Fetched from `contacts.email`
- `service_type` - Fetched from `leads.productid`
- `customer_zip` - Fetched from `leads.zip_code`

### Without `lead_id` (Full Payload)

When creating an appointment without an existing lead:

```json
{
  "customer_name": "John Doe",
  "customer_phone": "5551234567",
  "customer_email": "john.doe@example.com",
  "service_type": "Bath",
  "customer_zip": "90210",
  "appointment_date": "2025-10-01T14:00:00Z",
  "appointment_duration": 60,
  "appointment_type": "consultation",
  "estimated_value": 25000,
  "appointment_notes": "Customer interested in bathroom renovation"
}
```

## How Routing Works

### With `lead_id`

1. **Fetch Lead Data**: The API queries the `leads` table with the provided `lead_id`
2. **Get Contact Info**: Joins with `contacts` table to get customer details
3. **Extract Routing Data**:
   - `service_type` = `leads.productid` (e.g., "Solar", "Bath", "Kitchen")
   - `customer_zip` = `leads.zip_code`
   - `state` = `leads.state` (if needed for routing rules)
4. **Route to Workspace**: Uses routing rules matching `productid` and `zip_code`
5. **Create Appointment**: Links to existing lead and contact

### Without `lead_id`

1. **Validate Required Fields**: Ensures all customer fields are provided
2. **Find or Create Contact**: Searches by phone number or creates new contact
3. **Route to Workspace**: Uses routing rules matching `service_type` and `customer_zip`
4. **Create Lead**: Creates a new lead record for this appointment
5. **Create Appointment**: Links to the new lead and contact

## Validation Rules

### When `lead_id` is Provided

The lead record **must** have:
- ✅ `productid` - Used for service type routing
- ✅ `zip_code` - Used for zip code routing
- ✅ `contact_id` - Links to a valid contact record
- ✅ Contact must have valid `phone` number (normalized format)

**Error Messages:**
- `"Invalid lead_id: Lead not found"` - Lead doesn't exist
- `"Lead record missing required routing data: productid"` - Lead has no productid
- `"Lead record missing required routing data: zip_code"` - Lead has no zip_code
- `"Invalid phone number format in lead record"` - Contact phone is invalid
- `"Lead record missing contact_id"` - Lead not linked to contact

### When `lead_id` is NOT Provided

All customer fields are required:
- ✅ `customer_name`
- ✅ `customer_phone`
- ✅ `service_type`
- ✅ `customer_zip`
- ✅ `appointment_date`

## Benefits

1. **Reduced Payload Size**: Only send what's needed (4 fields vs 10+ fields)
2. **Data Consistency**: Always uses the source of truth (lead record) for customer data
3. **Simpler Integration**: Less data to manage and validate
4. **Automatic Updates**: If lead data changes, appointments automatically use updated info
5. **Error Prevention**: No risk of mismatched data between payload and lead record

## Example Flow

### Scenario: Converting a Lead to Appointment

1. **Lead exists** in database:
   ```sql
   lead_id: 4971027880
   productid: "Bath"
   zip_code: "90210"
   contact_id: 12345
   ```

2. **Send minimal appointment request**:
   ```bash
   curl -X POST https://api.homeprojectpartners.com/appointments/receive \
     -H "Content-Type: application/json" \
     -d '{
       "lead_id": 4971027880,
       "appointment_date": "2025-10-01T14:00:00Z",
       "estimated_value": 25000,
       "appointment_notes": "Customer interested in bathroom renovation"
     }'
   ```

3. **API automatically**:
   - Fetches lead data (productid="Bath", zip_code="90210")
   - Fetches contact data (name, phone, email)
   - Routes to matching workspace based on "Bath" + "90210"
   - Creates appointment linked to existing lead and contact
   - Updates lead status to "scheduled"
   - Forwards to workspace webhook

4. **Response**:
   ```json
   {
     "success": true,
     "message": "Appointment received and routed successfully",
     "appointment_id": 123,
     "contact_id": 12345,
     "lead_id": 4971027880,
     "matched_workspace_id": "bath_west_coast",
     "routing_method": "auto",
     "appointment_date": "2025-10-01T14:00:00Z"
   }
   ```

## Migration Notes

**No breaking changes** - The API still accepts the full payload format when `lead_id` is not provided. However, when `lead_id` IS provided:

- Customer fields in the request body are **ignored** (not used)
- Only lead record data is used for routing and customer info
- This ensures data consistency and prevents mismatches

## Testing

Test with a valid lead_id:

```bash
# Get a valid lead_id from your database first
curl -X POST https://api.homeprojectpartners.com/appointments/receive \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": 4971027880,
    "appointment_date": "2025-10-01T14:00:00Z",
    "estimated_value": 25000,
    "appointment_notes": "Test appointment"
  }'
```

Expected: Success with routing based on lead's `productid` and `zip_code`.

