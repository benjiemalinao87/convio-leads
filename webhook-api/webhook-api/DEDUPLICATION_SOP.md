# Lead Deduplication System - Standard Operating Procedure (SOP)

## Document Information
- **Version**: 1.0
- **Last Updated**: September 25, 2025
- **Owner**: Technical Team
- **Audience**: Sales Team, Operations Staff, Management

---

## Table of Contents
1. [Overview](#overview)
2. [How Deduplication Works](#how-deduplication-works)
3. [Contact vs Lead Concept](#contact-vs-lead-concept)
4. [Deduplication Strategy](#deduplication-strategy)
5. [System Behavior Examples](#system-behavior-examples)
6. [Staff Guidelines](#staff-guidelines)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## Overview

### What is Lead Deduplication?
Lead deduplication is our system's ability to identify and handle duplicate inquiries from the same person across different marketing channels and time periods. Instead of creating multiple separate records for the same person, we maintain a single **Contact** record with multiple **Lead** inquiries.

### Why is it Important?
- **Prevents duplicate work**: Sales reps don't waste time calling the same person multiple times
- **Complete customer history**: All interactions with a contact are tracked in one place
- **Better conversion tracking**: We can see the customer's entire journey
- **Cost efficiency**: No duplicate processing or follow-up costs
- **Improved customer experience**: Customers don't receive redundant communications

---

## How Deduplication Works

### Primary Identification Method
Our system uses **phone number** as the primary unique identifier for contacts within each webhook/lead source.

#### Phone Number Normalization
All phone numbers are automatically normalized to E.164 format:
- Input: `(555) 123-4567`, `555.123.4567`, `5551234567`
- Normalized: `+15551234567`
- This ensures different formats of the same number are recognized as identical

### Deduplication Logic Flow
```
1. New lead comes in through webhook
2. System normalizes phone number to +1XXXXXXXXXX format
3. System checks: "Does this phone number already exist for this webhook?"

   IF YES (DUPLICATE):
   - Use existing contact
   - Create new lead linked to existing contact
   - Update contact info with any new/better data
   - Return: "Lead added to existing contact successfully"

   IF NO (NEW):
   - Create new contact record
   - Create new lead linked to new contact
   - Return: "New contact created and lead processed successfully"
```

---

## Contact vs Lead Concept

### 📞 Contact = The Person
- **One record per unique phone number per webhook**
- Contains: Name, Phone, Email, Address, Demographics
- Represents the actual person/customer
- Gets updated with latest/best information

### 📋 Lead = The Inquiry/Request
- **Multiple leads can belong to one contact**
- Contains: Service type, Source, Campaign, Specific requirements
- Represents a specific business inquiry or interest
- Each lead maintains its own status and notes

### Real-World Example
**Contact**: John Doe (+15551234567)
- **Lead #1**: Solar panel inquiry from Google Ads (March 2025)
- **Lead #2**: HVAC service request from Facebook (April 2025)
- **Lead #3**: Solar financing question from website (May 2025)

**Result**: One contact, three separate business opportunities to track and convert.

---

## Deduplication Strategy

### Per-Webhook Uniqueness
- Each webhook/lead source maintains its own contact database
- The same phone number can exist as different contacts across different webhooks
- **Example**: +15551234567 can be Contact A in "Solar Webhook" and Contact B in "HVAC Webhook"

### Why Per-Webhook Strategy?
1. **Different business units**: Solar vs HVAC vs Insurance may be separate teams
2. **Different qualification criteria**: Each service has different requirements
3. **Separate follow-up processes**: Each team manages their own leads
4. **Compliance requirements**: Some industries require separate record-keeping

### Data Update Priority
When a duplicate is detected:
1. **Always create the new lead** (new business opportunity)
2. **Update contact info** if new data is more complete
3. **Preserve lead history** (never overwrite previous leads)
4. **Maintain audit trail** (track all changes)

---

## System Behavior Examples

### Scenario 1: First-Time Inquiry
```json
Input: John Doe, john@email.com, (555) 123-4567, Solar interest
Result: {
  "message": "New contact created and lead processed successfully",
  "contact_id": 1,
  "lead_id": 15,
  "contact_status": "new"
}
```

### Scenario 2: Same Person, Different Service
```json
Input: John Doe, john@email.com, (555) 123-4567, HVAC interest
Result: {
  "message": "Lead added to existing contact successfully",
  "contact_id": 1,
  "lead_id": 16,
  "contact_status": "existing"
}
```

### Scenario 3: Same Person, Updated Email
```json
Input: John Doe, john.doe.new@email.com, (555) 123-4567, Insurance interest
Result: {
  "message": "Lead added to existing contact successfully",
  "contact_id": 1,
  "lead_id": 17,
  "contact_status": "existing"
}
Note: Contact email gets updated to the newer address
```

### Scenario 4: Different Person, Same Address
```json
Input: Jane Doe, jane@email.com, (555) 987-6543, Same address as John
Result: {
  "message": "New contact created and lead processed successfully",
  "contact_id": 2,
  "lead_id": 18,
  "contact_status": "new"
}
Note: Different phone = different contact, even if same household
```

---

## Staff Guidelines

### For Sales Representatives
1. **Check lead history**: Always review all leads for a contact before calling
2. **Reference previous interactions**: "I see you inquired about solar in March..."
3. **Don't assume it's an error**: Multiple leads from same person are legitimate business opportunities
4. **Update lead status**: Mark each lead separately (some may convert, others may not)

### For Operations Staff
1. **Trust the system**: If system says "existing contact," there's a good reason
2. **Review contact timeline**: Understanding inquiry patterns helps with follow-up strategy
3. **Escalate phone number issues**: If you suspect phone normalization problems, report immediately
4. **Monitor conversion patterns**: Track which lead sources generate multiple inquiries

### For Customer Service
1. **Reference complete history**: You have access to customer's full interaction history
2. **Acknowledge previous inquiries**: "I see you've been interested in our services..."
3. **Don't create duplicate records**: Never manually create new contacts for existing phone numbers
4. **Update information carefully**: Changes affect the entire contact relationship

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: "Why are there multiple leads for the same person?"
**Solution**: This is intentional! Each lead represents a separate business opportunity or inquiry.

#### Issue: "Customer says they never inquired before, but system shows existing contact"
**Possible Causes**:
- Phone number was used by previous occupant
- Family member made previous inquiry
- Customer forgot about previous inquiry
**Action**: Verify phone number and check lead dates/sources

#### Issue: "Same person showing as different contacts"
**Possible Causes**:
- Different phone numbers used
- Typo in phone number entry
- Different webhooks (this is expected behavior)
**Action**: Check phone number normalization and webhook source

#### Issue: "Phone number format looks wrong"
**Expected Format**: All phone numbers should display as +15551234567
**Action**: If you see different format, report to technical team

### Escalation Process
1. **Level 1**: Check lead history and contact timeline
2. **Level 2**: Verify phone number normalization
3. **Level 3**: Contact technical team with specific contact/lead IDs

---

## Best Practices

### Data Quality
- **Consistent phone entry**: Always include area code
- **Verify customer information**: Confirm phone number during calls
- **Update contact info**: If customer provides better/newer information
- **Document interactions**: Use lead notes to track customer communications

### Lead Management
- **Treat each lead separately**: Different inquiry = different opportunity
- **Track lead sources**: Understanding where leads come from helps optimize marketing
- **Monitor lead timing**: Multiple leads in short time may indicate high purchase intent
- **Follow up appropriately**: Adjust messaging based on customer's inquiry history

### Customer Experience
- **Acknowledge history**: Reference previous interactions appropriately
- **Don't overwhelm**: Space out communications if customer has multiple recent leads
- **Personalize approach**: Use lead history to customize sales approach
- **Respect preferences**: If customer indicates no interest, update all related leads

---

## Appointment Management (Future Enhancement)

Our system includes appointment tracking capabilities:
- **Multiple appointments per lead**: Each lead can have its own appointments
- **Appointment types**: Consultation, estimate, installation, follow-up
- **Status tracking**: Scheduled, confirmed, completed, cancelled, no-show
- **Outcome tracking**: Results and next actions from each appointment

---

## Key Metrics to Monitor

### Deduplication Effectiveness
- **Duplicate rate**: % of leads that match existing contacts
- **Contact-to-lead ratio**: Average number of leads per contact
- **Time between inquiries**: How often customers re-inquire

### Business Impact
- **Conversion improvement**: Do customers with multiple leads convert better?
- **Sales efficiency**: Are reps handling duplicates appropriately?
- **Customer satisfaction**: Are we providing better service with complete history?

---

## Contact Information

### For Technical Issues
- **Technical Support**: Contact development team
- **System Questions**: Reference this SOP first, then escalate

### For Process Questions
- **Operations Manager**: Lead management processes
- **Sales Manager**: Customer interaction guidelines

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|---------|
| 1.0 | Sep 25, 2025 | Initial SOP creation | Technical Team |

---

## Appendix: Technical Details

### Database Structure
- **Contacts**: Unique per webhook + phone number
- **Leads**: Multiple per contact, each with unique ID
- **Appointments**: Multiple per lead (future feature)

### Integration Points
- **Webhook API**: Receives leads from marketing sources
- **CRM System**: Displays contact and lead relationships
- **Phone System**: References contact history during calls

### Compliance Notes
- **Data retention**: All lead history preserved for audit purposes
- **Privacy**: Contact updates maintain data privacy requirements
- **Consent**: Lead preferences tracked separately per inquiry