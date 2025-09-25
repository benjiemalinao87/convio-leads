# Conversion Tracking Implementation Plan

## Executive Summary
This document outlines the plan to implement a robust conversion tracking system for Home Project Partners. The system will allow external workspaces to update contact/lead statuses, log conversions, and attach custom metadata while maintaining a complete audit trail.

## 1. Database Schema Updates

### 1.1 New Tables

#### `conversions` Table
```sql
CREATE TABLE conversions (
  id TEXT PRIMARY KEY,  -- UUID format
  contact_id INTEGER NOT NULL,
  lead_id INTEGER,
  workspace_id TEXT NOT NULL,
  converted_by TEXT NOT NULL,
  converted_at DATETIME NOT NULL,
  conversion_type TEXT NOT NULL,  -- 'sale', 'appointment', 'qualified', etc.
  conversion_value REAL,
  custom_data TEXT,  -- JSON field for dynamic structured data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
```

#### `workspace_tracking` Table
```sql
CREATE TABLE workspace_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  lead_id INTEGER,
  workspace_id TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'sent', 'received', 'converted', 'updated'
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,  -- JSON field
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
```

### 1.2 Schema Updates to Existing Tables

#### Update `contacts` Table
```sql
ALTER TABLE contacts ADD COLUMN sent_from_workspace TEXT;
ALTER TABLE contacts ADD COLUMN converted_from_workspace TEXT;
ALTER TABLE contacts ADD COLUMN conversion_status TEXT DEFAULT 'pending';
ALTER TABLE contacts ADD COLUMN converted_timestamp DATETIME;
ALTER TABLE contacts ADD COLUMN converted_by TEXT;
ALTER TABLE contacts ADD COLUMN custom_metadata TEXT;  -- JSON field
ALTER TABLE contacts ADD COLUMN lifetime_value REAL DEFAULT 0;
ALTER TABLE contacts ADD COLUMN conversion_count INTEGER DEFAULT 0;
```

#### Update `leads` Table
```sql
ALTER TABLE leads ADD COLUMN workspace_id TEXT;
ALTER TABLE leads ADD COLUMN conversion_id TEXT;
ALTER TABLE leads ADD COLUMN conversion_metadata TEXT;  -- JSON field
```

## 2. API Endpoints Design

### 2.1 Conversion Tracking Endpoints

#### `POST /conversions/log`
Log a new conversion event
```javascript
{
  "contact_id": 123456,  // Required
  "lead_id": 1234567890,  // Optional
  "workspace_id": "workspace_123",
  "converted_by": "agent_john_doe",
  "conversion_type": "sale",
  "conversion_value": 25000,
  "custom_data": {
    "product": "solar_panel_system",
    "contract_id": "CTR-2024-001",
    "financing_type": "loan",
    "term_months": 240,
    "commission_rate": 0.05,
    "notes": "Customer opted for premium package"
  }
}
```

#### `PATCH /contacts/:id/conversion`
Update contact conversion status
```javascript
{
  "sent_from_workspace": "workspace_123",
  "converted_from_workspace": "workspace_456",
  "conversion_status": "converted",
  "converted_by": "agent_john_doe",
  "custom_metadata": {
    "qualification_score": 95,
    "interested_products": ["solar", "battery"],
    "preferred_contact_time": "morning",
    "decision_timeline": "30_days"
  }
}
```

#### `GET /conversions`
Query conversions with filters
```
GET /conversions?workspace_id=workspace_123&from_date=2024-01-01&to_date=2024-12-31
GET /conversions?contact_id=123456
GET /conversions?conversion_type=sale&min_value=10000
```

#### `GET /conversions/analytics`
Get conversion analytics
```javascript
Response:
{
  "summary": {
    "total_conversions": 150,
    "total_value": 3750000,
    "average_value": 25000,
    "conversion_rate": 12.5
  },
  "by_workspace": [
    {
      "workspace_id": "workspace_123",
      "conversions": 75,
      "total_value": 1875000,
      "conversion_rate": 15.0
    }
  ],
  "by_type": {
    "sale": 50,
    "appointment": 75,
    "qualified": 25
  },
  "trends": {
    "daily": [...],
    "weekly": [...],
    "monthly": [...]
  }
}
```

### 2.2 Workspace Management Endpoints

#### `POST /workspaces/register`
Register a new workspace
```javascript
{
  "workspace_id": "workspace_123",
  "workspace_name": "Sales Team Alpha",
  "api_key": "generated_api_key",
  "permissions": ["read", "update", "convert"]
}
```

#### `GET /workspaces/:id/activity`
Get workspace activity log
```javascript
Response:
{
  "workspace_id": "workspace_123",
  "total_contacts_received": 500,
  "total_contacts_sent": 450,
  "total_conversions": 75,
  "conversion_rate": 15.0,
  "recent_activity": [...]
}
```

## 3. Implementation Phases

### Phase 1: Database Schema Updates (Week 1)
- [ ] Create migration scripts for new tables
- [ ] Update existing tables with new columns
- [ ] Create indexes for performance optimization
- [ ] Test database migrations in development

### Phase 2: Core API Development (Week 2-3)
- [ ] Implement conversion logging endpoint
- [ ] Implement contact update endpoint
- [ ] Add authentication/authorization for workspace access
- [ ] Implement data validation and sanitization
- [ ] Create comprehensive error handling

### Phase 3: Analytics & Reporting (Week 4)
- [ ] Develop analytics endpoints
- [ ] Implement aggregation queries
- [ ] Create caching layer for performance
- [ ] Build real-time conversion tracking

### Phase 4: Frontend Dashboard (Week 5-6)
- [ ] Design conversion metrics components
- [ ] Build conversion timeline view
- [ ] Create workspace performance dashboard
- [ ] Implement real-time updates
- [ ] Add export functionality

## 4. Dashboard Visualization Components

### 4.1 Conversion Overview Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│                   Conversion Metrics Overview                │
├──────────────┬──────────────┬──────────────┬───────────────┤
│ Total Conv.  │ Conv. Rate   │ Avg. Value   │ Total Value   │
│    150       │   12.5%      │   $25,000    │  $3,750,000   │
└──────────────┴──────────────┴──────────────┴───────────────┘
```

### 4.2 Conversion Funnel Visualization
```
Leads Received    ████████████████████ 1,200
     ↓
Qualified         ██████████████ 800 (66.7%)
     ↓
Appointments      ████████ 400 (33.3%)
     ↓
Conversions       ███ 150 (12.5%)
```

### 4.3 Workspace Performance Grid
```
┌────────────────┬──────────┬────────────┬──────────────┬─────────┐
│ Workspace      │ Contacts │ Conversions│ Conv. Rate   │ Revenue │
├────────────────┼──────────┼────────────┼──────────────┼─────────┤
│ Sales Alpha    │   500    │     75     │    15.0%     │ $1.87M  │
│ Sales Beta     │   400    │     50     │    12.5%     │ $1.25M  │
│ Sales Gamma    │   300    │     25     │     8.3%     │ $625K   │
└────────────────┴──────────┴────────────┴──────────────┴─────────┘
```

### 4.4 Real-time Conversion Feed
```
┌─────────────────────────────────────────────────────────────┐
│                  Recent Conversions Feed                     │
├─────────────────────────────────────────────────────────────┤
│ 🟢 2 min ago: Contact #123456 converted → $25,000 (Solar)   │
│ 🟢 15 min ago: Contact #123457 converted → $18,500 (HVAC)   │
│ 🟡 1 hr ago: Contact #123458 qualified → Appointment set    │
│ 🟢 2 hrs ago: Contact #123459 converted → $32,000 (Solar)   │
└─────────────────────────────────────────────────────────────┘
```

### 4.5 Conversion Timeline Chart
- Interactive line chart showing conversions over time
- Filterable by workspace, conversion type, date range
- Drill-down capability to individual conversions
- Export to CSV/Excel functionality

### 4.6 Custom Metadata Display
```
┌─────────────────────────────────────────────────────────────┐
│              Contact Custom Metadata                         │
├─────────────────────────────────────────────────────────────┤
│ Qualification Score: ████████░░ 85/100                       │
│ Products: [Solar] [Battery] [Maintenance]                    │
│ Timeline: Within 30 days                                     │
│ Financing: Approved for $45,000                              │
│ Custom Fields:                                               │
│   • Installation Date: March 15, 2024                        │
│   • System Size: 8.5kW                                       │
│   • Expected Savings: $2,400/year                            │
└─────────────────────────────────────────────────────────────┘
```

## 5. Security & Compliance

### 5.1 Authentication
- API key-based authentication for workspace access
- JWT tokens for session management
- Rate limiting per workspace (1000 requests/hour)

### 5.2 Authorization
- Role-based access control (RBAC)
- Workspace-specific permissions
- Audit logging for all conversion events

### 5.3 Data Protection
- Encryption of sensitive custom metadata
- PII masking in logs
- GDPR compliance for data retention

## 6. Integration Examples

### 6.1 CRM Integration (Salesforce)
```javascript
// Example: Salesforce webhook to log conversion
const logConversion = async (salesforceOpportunity) => {
  const response = await fetch('https://api.homeprojectpartners.com/conversions/log', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace-ID': 'salesforce_prod',
      'X-API-Key': process.env.CONVIO_API_KEY
    },
    body: JSON.stringify({
      contact_id: salesforceOpportunity.convio_contact_id,
      workspace_id: 'salesforce_prod',
      converted_by: salesforceOpportunity.owner_id,
      conversion_type: 'sale',
      conversion_value: salesforceOpportunity.amount,
      custom_data: {
        opportunity_id: salesforceOpportunity.id,
        stage: salesforceOpportunity.stage,
        close_date: salesforceOpportunity.close_date,
        products: salesforceOpportunity.line_items
      }
    })
  });
  return response.json();
};
```

### 6.2 Marketing Automation (HubSpot)
```javascript
// Example: HubSpot workflow to update contact
const updateContactConversion = async (hubspotContact) => {
  const response = await fetch(`https://api.homeprojectpartners.com/contacts/${hubspotContact.convio_id}/conversion`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Workspace-ID': 'hubspot_marketing',
      'X-API-Key': process.env.CONVIO_API_KEY
    },
    body: JSON.stringify({
      sent_from_workspace: 'lead_gen_team',
      converted_from_workspace: 'hubspot_marketing',
      conversion_status: 'qualified',
      converted_by: hubspotContact.owner,
      custom_metadata: {
        lead_score: hubspotContact.lead_score,
        lifecycle_stage: hubspotContact.lifecycle_stage,
        email_engagement: hubspotContact.email_metrics,
        behavior_score: hubspotContact.behavior_score
      }
    })
  });
  return response.json();
};
```

## 7. Performance Considerations

### 7.1 Database Optimization
- Create composite indexes on frequently queried columns
- Implement database connection pooling
- Use materialized views for analytics queries
- Partition large tables by date

### 7.2 Caching Strategy
- Cloudflare KV for conversion analytics (5-minute TTL)
- Edge caching for workspace configuration
- In-memory cache for frequently accessed contacts

### 7.3 Scalability
- Horizontal scaling with Cloudflare Workers
- Event-driven architecture for real-time updates
- Queue-based processing for bulk operations

## 8. Monitoring & Alerting

### 8.1 Key Metrics to Track
- Conversion rate by workspace
- API response times
- Error rates by endpoint
- Database query performance
- Cache hit rates

### 8.2 Alerting Rules
- Alert if conversion rate drops below threshold
- Alert on API errors > 1%
- Alert on database connection failures
- Alert on unusual workspace activity

## 9. Testing Strategy

### 9.1 Unit Tests
- Test conversion calculation logic
- Test data validation rules
- Test custom metadata parsing

### 9.2 Integration Tests
- Test end-to-end conversion flow
- Test workspace authentication
- Test analytics aggregation

### 9.3 Load Testing
- Simulate 1000 concurrent conversions
- Test analytics under heavy load
- Verify cache performance

## 10. Documentation Requirements

### 10.1 API Documentation
- OpenAPI/Swagger specification
- Integration guides for popular CRMs
- Webhook setup tutorials
- Authentication guide

### 10.2 User Documentation
- Dashboard user guide
- Conversion tracking best practices
- Custom metadata field guide
- Troubleshooting guide

## 11. Timeline & Milestones

| Week | Milestone | Deliverables |
|------|-----------|--------------|
| 1 | Database Design | Migration scripts, schema documentation |
| 2-3 | API Development | Core endpoints, authentication |
| 4 | Analytics | Analytics endpoints, aggregation queries |
| 5-6 | Frontend | Dashboard components, visualizations |
| 7 | Testing | Test suite, load testing results |
| 8 | Deployment | Production deployment, monitoring setup |

## 12. Success Metrics

- **Technical Metrics**
  - API response time < 200ms (p95)
  - System uptime > 99.9%
  - Zero data loss incidents

- **Business Metrics**
  - Track 100% of conversions
  - Reduce manual data entry by 80%
  - Increase visibility into conversion funnel
  - Enable real-time conversion tracking

## 13. Next Steps

1. Review and approve this implementation plan
2. Set up development environment for conversion tracking
3. Begin Phase 1: Database schema updates
4. Create API specification document
5. Design mockups for dashboard visualizations
6. Schedule stakeholder review meetings

---

**Document Version**: 1.0
**Last Updated**: 2025-01-25
**Author**: Convio Leads Development Team
**Status**: DRAFT - Pending Review