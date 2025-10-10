# Webhook Lead Receiving Flow Diagram

## Complete Lead Processing Flow

```mermaid
flowchart TD
    Start([Third-Party Provider<br/>Sends Lead]) --> ValidateWebhookID{Validate<br/>Webhook ID<br/>Format?}
    
    ValidateWebhookID -->|Invalid| Error400_1[❌ 400 Error<br/>Invalid webhook ID format]
    ValidateWebhookID -->|Valid| CheckWebhookDB{Webhook<br/>Exists in DB<br/>& Active?}
    
    CheckWebhookDB -->|No| Error404[❌ 404 Error<br/>Webhook not configured]
    CheckWebhookDB -->|Yes| ValidateProvider{Provider<br/>Authentication<br/>Header?}
    
    ValidateProvider -->|Missing| Error401_1[❌ 401 Error<br/>Missing provider authentication]
    ValidateProvider -->|Present| CheckProviderDB{Provider<br/>in DB &<br/>Active?}
    
    CheckProviderDB -->|No| Error401_2[❌ 401 Error<br/>Invalid provider]
    CheckProviderDB -->|Yes| CheckProviderAccess{Provider<br/>Allowed for<br/>Webhook?}
    
    CheckProviderAccess -->|No| Error403[❌ 403 Error<br/>Provider access denied]
    CheckProviderAccess -->|Yes| UpdateProviderUsage[Update Provider<br/>last_used_at]
    
    UpdateProviderUsage --> ValidateContentType{Content-Type<br/>= JSON?}
    
    ValidateContentType -->|No| Error400_2[❌ 400 Error<br/>Invalid content type]
    ValidateContentType -->|Yes| ParseJSON{Parse JSON<br/>Body}
    
    ParseJSON -->|Failed| Error400_3[❌ 400 Error<br/>Invalid JSON]
    ParseJSON -->|Success| CheckSignature{Webhook<br/>Secret<br/>Configured?}
    
    CheckSignature -->|Yes| ValidateSignature{Validate<br/>HMAC-SHA256<br/>Signature}
    CheckSignature -->|No| GetSchema[Get Lead Schema<br/>based on Webhook Type]
    
    ValidateSignature -->|Invalid| Error401_3[❌ 401 Error<br/>Invalid signature]
    ValidateSignature -->|Valid| GetSchema
    
    GetSchema --> ValidateSchema{Validate Lead<br/>Data Against<br/>Schema}
    
    ValidateSchema -->|Failed| Error422[❌ 422 Error<br/>Validation failed<br/>with details]
    ValidateSchema -->|Success| NormalizePhone[Normalize Phone Number<br/>to E.164 Format<br/>+1XXXXXXXXXX]
    
    NormalizePhone --> CheckPhoneValid{Phone<br/>Number<br/>Valid?}
    
    CheckPhoneValid -->|No| Error400_4[❌ 400 Error<br/>Invalid phone number]
    CheckPhoneValid -->|Yes| FindContact{Find Contact<br/>by webhook_id<br/>+ phone}
    
    FindContact -->|Not Found| CreateContact[Create New Contact<br/>Generate 6-digit ID]
    FindContact -->|Found| UpdateContact[Update Existing<br/>Contact Info]
    
    CreateContact --> ContactCreated[Contact Created<br/>isNew = true]
    UpdateContact --> ContactUpdated[Contact Updated<br/>isNew = false]
    
    ContactCreated --> GenerateLeadID[Generate Unique<br/>10-digit Lead ID]
    ContactUpdated --> GenerateLeadID
    
    GenerateLeadID --> InsertLead[Insert Lead Record<br/>- Link to contact_id<br/>- Store raw_payload<br/>- Set status = 'new']
    
    InsertLead --> UpdateWebhookStats[Update Webhook Stats<br/>- Increment total_leads<br/>- Update last_lead_at]
    
    UpdateWebhookStats --> LogProviderUsage[Log Provider Usage<br/>INSERT OR REPLACE<br/>provider_usage_log]
    
    LogProviderUsage --> LogLeadEvent[Log Lead Event<br/>event_type = 'created']
    
    LogLeadEvent --> Success{New Contact<br/>or Existing?}
    
    Success -->|New| SuccessNew[✅ 201 Success<br/>New contact created<br/>Lead processed]
    Success -->|Existing| SuccessExisting[✅ 201 Success<br/>Lead added to<br/>existing contact]
    
    style Start fill:#e1f5ff
    style SuccessNew fill:#d4edda
    style SuccessExisting fill:#d4edda
    style Error400_1 fill:#f8d7da
    style Error404 fill:#f8d7da
    style Error401_1 fill:#f8d7da
    style Error401_2 fill:#f8d7da
    style Error403 fill:#f8d7da
    style Error400_2 fill:#f8d7da
    style Error400_3 fill:#f8d7da
    style Error401_3 fill:#f8d7da
    style Error422 fill:#f8d7da
    style Error400_4 fill:#f8d7da
```

---

## Contact Deduplication Flow

```mermaid
flowchart TD
    Start([Lead Data<br/>Received]) --> ExtractPhone[Extract Phone Number<br/>from Lead Data]
    
    ExtractPhone --> NormalizePhone[Normalize Phone<br/>Remove dashes, spaces<br/>Add +1 country code]
    
    NormalizePhone --> QueryDB{Query Database:<br/>SELECT * FROM contacts<br/>WHERE webhook_id = ?<br/>AND phone = ?}
    
    QueryDB -->|Found| ExistingContact[Existing Contact Found]
    QueryDB -->|Not Found| NewContact[No Existing Contact]
    
    ExistingContact --> CompareData{New Data<br/>Different from<br/>Existing?}
    
    CompareData -->|Yes| UpdateFields[UPDATE contacts SET<br/>first_name, last_name<br/>email, address, etc.<br/>WHERE id = ?]
    CompareData -->|No| SkipUpdate[Skip Update<br/>Data unchanged]
    
    UpdateFields --> LogUpdate[Log Contact Event<br/>event_type = 'updated']
    SkipUpdate --> LogUpdate
    
    LogUpdate --> FetchUpdated[Fetch Updated<br/>Contact Record]
    
    FetchUpdated --> ReturnExisting[Return:<br/>contact: ContactWithId<br/>isNew: false]
    
    NewContact --> GenerateID[Generate New<br/>6-digit Contact ID]
    
    GenerateID --> InsertContact[INSERT INTO contacts<br/>webhook_id, phone<br/>first_name, last_name<br/>email, address, etc.]
    
    InsertContact --> LogCreate[Log Contact Event<br/>event_type = 'created']
    
    LogCreate --> FetchNew[Fetch New<br/>Contact Record]
    
    FetchNew --> ReturnNew[Return:<br/>contact: ContactWithId<br/>isNew: true]
    
    ReturnExisting --> CreateLead[Create Lead Record<br/>Linked to contact_id]
    ReturnNew --> CreateLead
    
    CreateLead --> Done([Done:<br/>Lead Linked to Contact])
    
    style Start fill:#e1f5ff
    style Done fill:#d4edda
    style ExistingContact fill:#fff3cd
    style NewContact fill:#fff3cd
```

---

## Database Transaction Flow

```mermaid
sequenceDiagram
    participant P as Provider
    participant W as Webhook API
    participant V as Validator
    participant C as Contact DB
    participant L as Lead DB
    participant S as Stats

    P->>W: POST /webhook/:webhookId
    Note over P,W: Headers: Authorization, Content-Type
    
    W->>V: Validate webhook ID
    V-->>W: Valid
    
    W->>V: Validate provider auth
    V-->>W: Provider authorized
    
    W->>V: Parse & validate JSON
    V-->>W: Schema valid
    
    W->>C: findOrCreateContact(webhookId, phone)
    
    alt Contact Exists
        C->>C: Find contact by webhook_id + phone
        C->>C: Update contact fields
        C-->>W: Return existing contact (isNew: false)
    else Contact Not Found
        C->>C: Generate 6-digit ID
        C->>C: INSERT INTO contacts
        C-->>W: Return new contact (isNew: true)
    end
    
    W->>L: saveLead(leadRecord)
    L->>L: Generate 10-digit lead ID
    L->>L: INSERT INTO leads (contact_id, ...)
    L-->>W: Return lead_id
    
    W->>S: Update webhook statistics
    S->>S: INCREMENT total_leads
    S->>S: UPDATE last_lead_at
    S-->>W: Updated
    
    W->>S: Log provider usage
    S->>S: INSERT OR REPLACE provider_usage_log
    S-->>W: Logged
    
    W->>L: logLeadEvent('created')
    L->>L: INSERT INTO lead_events
    L-->>W: Event logged
    
    W-->>P: 201 Success Response
    Note over W,P: {status: 'success',<br/>contact_id, lead_id,<br/>contact_status: 'new'/'existing'}
```

---

## Phone Number Normalization Flow

```mermaid
flowchart TD
    Start([Phone Input]) --> RemoveSpaces[Remove All Spaces<br/>Dashes, Parentheses]
    
    RemoveSpaces --> CheckLength{Length ≥ 10?}
    
    CheckLength -->|No| Invalid[❌ Invalid Phone<br/>Too Short]
    CheckLength -->|Yes| CheckFormat{Starts<br/>with +1?}
    
    CheckFormat -->|Yes| Already[Already Normalized<br/>+1XXXXXXXXXX]
    CheckFormat -->|No| CheckCountry{Starts<br/>with 1?}
    
    CheckCountry -->|Yes| AddPlus[Add + Prefix<br/>Result: +1XXXXXXXXXX]
    CheckCountry -->|No| AddBoth[Add +1 Prefix<br/>Result: +1XXXXXXXXXX]
    
    Already --> Validate{Valid US<br/>Phone Number?}
    AddPlus --> Validate
    AddBoth --> Validate
    
    Validate -->|No| Invalid
    Validate -->|Yes| Success[✅ Normalized<br/>+1XXXXXXXXXX]
    
    Success --> UseAsKey[Use as Unique Key<br/>for Contact Lookup]
    
    style Start fill:#e1f5ff
    style Success fill:#d4edda
    style Invalid fill:#f8d7da
    
    Note1[Examples:<br/>5551234567 → +15551234567<br/>555-123-4567 → +15551234567<br/>(555) 123-4567 → +15551234567<br/>+15551234567 → +15551234567]
    
    style Note1 fill:#fff9e6
```

---

## Lead Schema Validation Flow

```mermaid
flowchart TD
    Start([Raw Lead Data]) --> CheckWebhookType{Check Webhook<br/>in LeadProviderConfig}
    
    CheckWebhookType -->|Solar| SolarSchema[Use SolarLeadSchema<br/>+ propertyType<br/>+ monthlyElectricBill<br/>+ roofCondition]
    
    CheckWebhookType -->|HVAC| HVACSchema[Use HVACLeadSchema<br/>+ serviceType<br/>+ systemAge<br/>+ urgency]
    
    CheckWebhookType -->|Insurance| InsuranceSchema[Use InsuranceLeadSchema<br/>+ insuranceType<br/>+ coverageAmount<br/>+ currentPremium]
    
    CheckWebhookType -->|Unknown| BaseSchema[Use BaseLeadSchema<br/>Basic fields only]
    
    SolarSchema --> Validate[Zod Schema Validation]
    HVACSchema --> Validate
    InsuranceSchema --> Validate
    BaseSchema --> Validate
    
    Validate --> CheckRequired{Required<br/>Fields Present?}
    
    CheckRequired -->|No| CollectErrors[Collect All<br/>Validation Errors]
    CheckRequired -->|Yes| CheckTypes{Field Types<br/>Correct?}
    
    CheckTypes -->|No| CollectErrors
    CheckTypes -->|Yes| CheckFormats{Field Formats<br/>Valid?}
    
    CheckFormats -->|No| CollectErrors
    CheckFormats -->|Yes| Success[✅ Validation Passed<br/>Proceed with Processing]
    
    CollectErrors --> Return422[❌ 422 Error<br/>Return Detailed Errors:<br/>- field path<br/>- error message<br/>- error code]
    
    Success --> NormalizeLead[Normalize Lead Data<br/>+ Add metadata<br/>+ Set defaults]
    
    style Start fill:#e1f5ff
    style Success fill:#d4edda
    style Return422 fill:#f8d7da
    
    Note1[Validation Rules:<br/>✓ firstname/firstName required<br/>✓ lastname/lastName required<br/>✓ source required<br/>✓ email format if provided<br/>✓ phone min 10 digits<br/>✓ state 2-letter code<br/>✓ zip 5 digits]
    
    style Note1 fill:#fff9e6
```

---

## Error Handling & Response Flow

```mermaid
flowchart TD
    Start([Request Received]) --> TryCatch{Try-Catch<br/>Block}
    
    TryCatch -->|Success Path| ValidateID{Webhook ID<br/>Valid?}
    TryCatch -->|Exception| InternalError[500 Internal Error<br/>Log error details]
    
    ValidateID -->|No| Return400_1[400 Bad Request<br/>Invalid webhook ID format]
    ValidateID -->|Yes| CheckWebhook{Webhook<br/>Configured?}
    
    CheckWebhook -->|No| Return404[404 Not Found<br/>Webhook not configured]
    CheckWebhook -->|Yes| CheckAuth{Provider<br/>Authenticated?}
    
    CheckAuth -->|No Auth Header| Return401_1[401 Unauthorized<br/>Missing authentication]
    CheckAuth -->|Invalid Provider| Return401_2[401 Unauthorized<br/>Invalid provider]
    CheckAuth -->|No Access| Return403[403 Forbidden<br/>Provider access denied]
    CheckAuth -->|Valid| ValidateData{Data Schema<br/>Valid?}
    
    ValidateData -->|No| Return422[422 Unprocessable<br/>Validation errors array]
    ValidateData -->|Yes| ProcessLead{Process Lead<br/>& Contact}
    
    ProcessLead -->|DB Error| Return500[500 Server Error<br/>Database operation failed]
    ProcessLead -->|Success| Return201[201 Created<br/>Lead processed successfully]
    
    style Start fill:#e1f5ff
    style Return201 fill:#d4edda
    style Return400_1 fill:#f8d7da
    style Return404 fill:#f8d7da
    style Return401_1 fill:#f8d7da
    style Return401_2 fill:#f8d7da
    style Return403 fill:#f8d7da
    style Return422 fill:#f8d7da
    style Return500 fill:#f8d7da
    style InternalError fill:#f8d7da
    
    Note1[All Errors Include:<br/>- error code<br/>- message<br/>- timestamp<br/>- details when applicable]
    
    style Note1 fill:#fff9e6
```

---

## Statistics & Logging Flow

```mermaid
flowchart LR
    LeadCreated([Lead Successfully<br/>Created]) --> UpdateWebhook[Update webhook_configs<br/>INCREMENT total_leads<br/>SET last_lead_at]
    
    UpdateWebhook --> LogProvider[Log provider_usage_log<br/>INSERT OR REPLACE<br/>Daily request count]
    
    LogProvider --> LogLead[Create lead_events<br/>event_type: 'created'<br/>event_data: JSON]
    
    LogLead --> LogContact{New Contact<br/>or Existing?}
    
    LogContact -->|New| CreateContactEvent[Create contact_events<br/>event_type: 'created']
    LogContact -->|Existing| UpdateContactEvent[Create contact_events<br/>event_type: 'updated']
    
    CreateContactEvent --> Done([All Logs Created])
    UpdateContactEvent --> Done
    
    Done --> Analytics[Analytics Available:<br/>- Webhook performance<br/>- Provider usage<br/>- Lead timeline<br/>- Contact history]
    
    style LeadCreated fill:#e1f5ff
    style Done fill:#d4edda
    style Analytics fill:#d1ecf1
```

---

## Key Concepts Summary

### 1. **Unique Contact per Webhook**
- One contact per unique `webhook_id` + `phone` combination
- Prevents duplicate contacts across multiple lead submissions
- Maintains relationship between leads and contacts

### 2. **Lead-to-Contact Relationship**
- **One-to-Many**: One contact can have many leads
- Each lead is linked via `contact_id` foreign key
- Tracks full history of interactions per contact

### 3. **Phone Normalization Strategy**
- All phones stored as `+1XXXXXXXXXX`
- Enables consistent matching across different formats
- Used as unique identifier within webhook scope

### 4. **Validation Layers**
1. **Webhook ID Format** - Pattern matching
2. **Provider Authentication** - Database lookup
3. **Provider Access** - Webhook restrictions
4. **Content Type** - JSON requirement
5. **JSON Parsing** - Valid JSON structure
6. **Schema Validation** - Zod runtime validation
7. **Phone Validation** - E.164 format

### 5. **Database Transaction Safety**
- Uses prepared statements with parameter binding
- Atomic operations where possible
- Error handling prevents partial writes
- Logging failures don't break main flow

### 6. **Soft Delete Protection**
- Webhooks can be soft-deleted with 24-hour grace period
- Deleted webhooks cannot receive new leads
- Restoration available before permanent deletion
- All lead data preserved regardless of webhook status

---

## Performance Considerations

### Database Indexes
```sql
-- Contacts table
CREATE UNIQUE INDEX idx_contacts_webhook_phone 
ON contacts(webhook_id, phone);

-- Leads table
CREATE INDEX idx_leads_webhook_id ON leads(webhook_id);
CREATE INDEX idx_leads_contact_id ON leads(contact_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at);

-- Provider usage
CREATE UNIQUE INDEX idx_provider_usage 
ON provider_usage_log(provider_id, webhook_id, date);
```

### Query Optimization
- Single query for contact lookup: `O(1)` with index
- Batch updates for statistics: Grouped operations
- Fire-and-forget logging: Async where possible
- Connection pooling: D1 handles automatically

### Edge Computing Benefits
- Low latency: Runs closest to request origin
- Global distribution: Multiple data centers
- Auto-scaling: Handles traffic spikes
- No cold starts: Always-on edge functions

---

## Related Documentation

- [Complete API Documentation](/webhook-api/API_DOCUMENTATION.md)
- [Soft Delete System](/docs/webhook-soft-deletion/)
- [Deployment Guide](/WEBHOOK_SOFT_DELETE_DEPLOYMENT.md)
- [Implementation Study](/WEBHOOK_LEAD_RECEIVING_IMPLEMENTATION.md)

