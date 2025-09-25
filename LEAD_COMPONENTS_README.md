# Lead Management Components

This document describes the lead management components that integrate with your webhook API at `api.homeprojectpartners.com`.

## Components Overview

### 1. LeadDetailPage
A comprehensive modal component that displays detailed lead information matching your design.

**Features:**
- ✅ Contact information display
- ✅ Lead details with deal value, dates, and metadata
- ✅ Quick stats sidebar
- ✅ Real-time activity timeline
- ✅ Status history tracking
- ✅ Clickable status change functionality
- ✅ Add activity button
- ✅ Responsive design

**Props:**
```typescript
interface LeadDetailPageProps {
  leadId: number;
  onClose: () => void;
  onEdit: () => void;
}
```

### 2. StatusChangeModal
A modal for changing lead status with comprehensive tracking.

**Features:**
- ✅ Visual status transition preview
- ✅ Reason and notes fields
- ✅ All pipeline stages (New → Contacted → Qualified → Proposal Sent → Negotiating → Scheduled → Converted/Rejected/Lost)
- ✅ Status history recording
- ✅ API integration with PUT endpoint

### 3. AddActivityModal
A modal for adding activities to leads.

**Features:**
- ✅ Multiple activity types (Call, Email, Meeting, Note, Follow-up)
- ✅ Title and description fields
- ✅ Activity date/time picker
- ✅ Visual activity type selection

### 4. LeadsListExample
An example component showing how to integrate the lead detail page with a leads list.

## API Integration

The components are configured to work with your webhook API:

### Base URL
```javascript
const API_BASE = 'https://api.homeprojectpartners.com';
```

### API Endpoints Used

1. **Get Lead Details**
   ```
   GET /leads/{leadId}
   ```

2. **Get Lead Activities**
   ```
   GET /leads/{leadId}/activities
   ```

3. **Get Lead Status History**
   ```
   GET /leads/{leadId}/history
   ```

4. **Update Lead Status**
   ```
   PUT /leads/{leadId}/status
   ```
   Body:
   ```json
   {
     "status": "scheduled",
     "reason": "Customer agreed to appointment",
     "notes": "Scheduled for next Tuesday",
     "changedBy": "user_id",
     "changedByName": "User Name"
   }
   ```

5. **Add Activity**
   ```
   POST /leads/{leadId}/activities
   ```
   Body:
   ```json
   {
     "activityType": "call",
     "title": "Discovery call",
     "description": "Discussed requirements",
     "createdBy": "user_id",
     "createdByName": "User Name"
   }
   ```

## Usage Example

```jsx
import React, { useState } from 'react';
import LeadDetailPage from './components/LeadDetailPage';

const MyComponent = () => {
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  const handleViewLead = (leadId) => {
    setSelectedLeadId(leadId);
  };

  const handleCloseLead = () => {
    setSelectedLeadId(null);
  };

  const handleEditLead = () => {
    // Implement your edit functionality
    console.log('Edit lead');
  };

  return (
    <div>
      {/* Your leads list */}
      <button onClick={() => handleViewLead(1)}>
        View Lead #1
      </button>

      {/* Lead Detail Modal */}
      {selectedLeadId && (
        <LeadDetailPage
          leadId={selectedLeadId}
          onClose={handleCloseLead}
          onEdit={handleEditLead}
        />
      )}
    </div>
  );
};
```

## Status Pipeline

The components support these lead statuses:

1. **New** - Freshly received lead
2. **Contacted** - Initial contact made
3. **Qualified** - Lead shows interest
4. **Proposal Sent** - Quote/proposal sent
5. **Negotiating** - In negotiation phase
6. **Scheduled** - Appointment scheduled
7. **Converted** - Became a customer
8. **Rejected** - Not interested
9. **Lost** - Lost to competitor

## Activity Types

Supported activity types:
- **Call** - Phone conversations
- **Email** - Email communications
- **Meeting** - In-person/video meetings
- **Note** - General notes
- **Follow-up** - Follow-up activities

## Styling

The components use Tailwind CSS with a dark theme matching your design:
- Background: `bg-gray-900`
- Cards: `bg-gray-800`
- Text: `text-white`
- Accents: `text-blue-400`

## Data Flow

1. **Lead Selection**: User clicks to view a lead
2. **Data Fetching**: Component fetches lead details, activities, and history
3. **Status Changes**: User can change status via clickable status badges
4. **Activity Addition**: User can add new activities
5. **Real-time Updates**: All changes refresh the data automatically

## Testing

You can test the integration with your existing lead data:

```bash
# Test with an existing lead
curl "https://api.homeprojectpartners.com/leads/3/history"
curl "https://api.homeprojectpartners.com/leads/3/activities"
```

The components will automatically display the real data from your webhook API, including:
- Lead #1: Alice Johnson (Solar lead)
- Lead #3: Bob Smith (HVAC lead with status history)

## Next Steps

1. Integrate these components into your existing dashboard
2. Replace placeholder user data with actual authentication
3. Add lead editing functionality as needed
4. Customize styling to match your brand colors
5. Add additional activity types if needed