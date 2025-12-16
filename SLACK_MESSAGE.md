🚀 *Feature Update: Embeddable Form with Appointment Booking*

Hey team! We've just launched a new embeddable form feature that allows providers to collect leads directly from their websites. Here's what's been accomplished:

*✅ What's New:*
• Embeddable lead form with full field support
• Optional appointment booking with calendar integration
• Automatic provider integration (no manual webhook setup needed!)
• Enhanced provider tracking for accurate lead attribution
• Complete field support (address2, consent fields, campaign tracking, etc.)

*📋 How Providers Access It:*
1. Go to *Settings* → Click the *"Forms"* tab (visible for provider users)
2. Copy the embed code provided
3. Embed the iframe on their website

*Form URL Format:*
`https://app.buyerfound.ai/form?provider_id=YOUR_PROVIDER_ID`

*📡 API Integration:*
For direct API integration:
• Endpoint: `POST https://api.buyerfound.ai/forms/submit`
• Automatically creates webhook mappings when provider submits first form
• Supports all lead fields + optional appointment booking

*🔧 Key Technical Improvements:*
• Auto webhook creation - no manual mapping required
• Provider tracking stored in multiple places (subsource, source, raw_payload)
• Same-day appointments disabled (next day onwards only)
• Contact deduplication by phone within provider scope

*🎨 Design Features:*
• Clean white mode design
• Improved contrast and accessibility
• Compact layout (minimal scrolling)
• Mobile-responsive

*Questions?* Reach out to the dev team or check the dashboard documentation!

---

*Example API Request:*
```json
{
  "provider_id": "your_provider_id",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "5551234567",
  "address": "123 Main Street",
  "productid": "Solar",
  "appointment": {
    "appointment_date": "2025-01-16T14:00:00Z",
    "appointment_duration": 60,
    "appointment_type": "consultation"
  }
}
```
