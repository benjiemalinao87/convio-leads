# 🚀 Feature Update: Embeddable Form with Appointment Booking

## What's New

We've launched a new **embeddable form feature** that allows providers to collect leads directly from their websites! The form supports full lead data collection and optional appointment booking.

### ✅ Key Features Completed Today

1. **📝 Embeddable Lead Form**
   - Full lead fields collection (name, email, phone, address, etc.)
   - Optional appointment booking with calendar integration
   - White mode design with improved accessibility
   - Mobile-responsive layout

2. **🔗 Automatic Provider Integration**
   - Forms automatically link to providers via `provider_id`
   - No manual webhook mapping required - system auto-creates mappings
   - Provider tracking stored in multiple places for reliability

3. **📅 Appointment Booking**
   - Calendar date picker (next day onwards only)
   - Time selection with duration options
   - Appointment type and notes fields
   - Automatically creates appointment records linked to leads

4. **🔄 Enhanced Provider Tracking**
   - Provider ID stored in `subsource` field for easy querying
   - Provider ID included in `source` field
   - Full provider tracking in `raw_payload` for audit trail
   - Leads accurately reference their provider

5. **📊 Complete Field Support**
   - All standard lead fields (name, contact, address)
   - Campaign tracking (source, subsource, landing_page_url)
   - TCPA compliance fields (consent_description, consent_value, tcpa_compliance)
   - Address line 2 support (apartments, suites)
   - Product/service type selection

## 🎯 How to Access

### For Provider Users:

1. **Navigate to Settings**
   - Go to **Settings** from the main navigation
   - Click on the **"Forms"** tab (visible for provider users)

2. **Get Your Embed Code**
   - The embed code section will display your personalized iframe code
   - Copy the embed code provided
   - Your `provider_id` is automatically included in the form URL

3. **Embed on Your Website**
  ```html
  <iframe 
    src="https://app.buyerfound.ai/form?provider_id=your_provider_id" 
    width="100%" 
    height="800"
    frameborder="0">
  </iframe>
  ```

### Form URL Structure:
```
https://app.buyerfound.ai/form?provider_id=YOUR_PROVIDER_ID
```

## 📡 API Endpoint

For direct API integration, use the form submission endpoint:

**Endpoint:** `POST /forms/submit`

**Base URL:** `https://api.buyerfound.ai/forms/submit`

**Request Body Example:**
```json
{
  "provider_id": "your_provider_id",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "5551234567",
  "address": "123 Main Street",
  "address2": "Apt 4B",
  "city": "Los Angeles",
  "state": "CA",
  "zipCode": "90210",
  "source": "Google Ads",
  "productid": "Solar",
  "subsource": "Campaign Name",
  "landing_page_url": "https://example.com/landing",
  "consent_description": "Consent text...",
  "consent_value": true,
  "tcpa_compliance": true,
  "notes": "Additional notes",
  "appointment": {
    "appointment_date": "2025-01-16T14:00:00Z",
    "appointment_duration": 60,
    "appointment_type": "consultation",
    "appointment_notes": "Appointment notes"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Form submitted successfully",
  "data": {
    "lead_id": 1234567890,
    "contact_id": 987654,
    "appointment_id": 30,
    "is_new_contact": true,
    "provider_id": "your_provider_id",
    "webhook_id": "your_provider_id_form_ws_us_general"
  }
}
```

## 🔧 Technical Details

- **Auto Webhook Creation**: The system automatically creates webhook mappings when a provider submits their first form - no manual setup required!
- **Provider Tracking**: Leads are linked to providers through multiple methods for reliability
- **Appointment Integration**: Appointments are automatically created and linked to leads and contacts
- **Field Validation**: Required fields are validated (firstName, lastName, and either email or phone)

## 📋 Requirements

- Provider must exist in `lead_source_providers` table and be active
- Form requires either `email` OR `phone` (at least one)
- Appointment booking is completely optional - users can submit without booking

## 🎨 Design Features

- Clean white mode design
- Improved contrast and readability
- Compact layout (no excessive scrolling)
- Easy-to-use date and time pickers
- Clear form validation and error messages

## 📝 Notes

- Same-day appointments are disabled (next day onwards only)
- All form submissions create leads automatically
- Contacts are deduplicated by phone number within each provider's scope
- Provider identifier is visible in the leads/contacts UI

---

**Questions?** Reach out to the dev team or check the documentation in the dashboard under the Documentation section.
