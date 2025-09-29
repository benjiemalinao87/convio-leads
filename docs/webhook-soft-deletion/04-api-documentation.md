# API Documentation

## 🔌 Webhook Soft Deletion API Reference

This document provides comprehensive API documentation for all webhook soft deletion endpoints with detailed examples, error handling, and integration guidance.

## 📋 Base Information

### Base URL
```
https://api.homeprojectpartners.com
```

### Authentication
All deletion and restoration operations require user identification:

```http
X-User-ID: admin-user
```

### Content Type
```http
Content-Type: application/json
```

## 🔧 Enhanced DELETE Endpoint

### Soft Delete Webhook (Default)

**Endpoint:** `DELETE /webhook/{webhookId}`

Marks a webhook for deletion with a 24-hour grace period.

#### Request

```http
DELETE /webhook/test-webhook-123?reason=No%20longer%20needed HTTP/1.1
Host: api.homeprojectpartners.com
X-User-ID: admin-user
```

#### Query Parameters

```
┌─────────────┬──────────┬─────────────────────────────────────────────────────┐
│ Parameter   │ Required │ Description                                         │
├─────────────┼──────────┼─────────────────────────────────────────────────────┤
│ reason      │ Optional │ Reason for deletion (URL encoded)                  │
│ force       │ Optional │ Set to 'true' for immediate permanent deletion     │
└─────────────┴──────────┴─────────────────────────────────────────────────────┘
```

#### Response (200 OK)

```json
{
  "status": "success",
  "message": "Webhook scheduled for deletion in 24 hours",
  "webhook_id": "test-webhook-123",
  "job_id": "webhook-del-test-webhook-123-1696000000-abc123",
  "leads_preserved": 45,
  "deletion_type": "scheduled",
  "scheduled_deletion_at": "2025-09-29T10:00:00.000Z",
  "restoration": {
    "available_until": "2025-09-29T10:00:00.000Z",
    "restore_endpoint": "/webhook/test-webhook-123/restore"
  },
  "note": "Webhook can be restored within 24 hours. All leads data will be preserved.",
  "timestamp": "2025-09-28T10:00:00.000Z"
}
```

#### Example with cURL

```bash
# Soft delete with reason
curl -X DELETE "https://api.homeprojectpartners.com/webhook/test-webhook-123?reason=No%20longer%20needed" \
  -H "X-User-ID: admin-user"

# Response will include job_id and restoration info
```

### Force Delete Webhook (Immediate)

**Endpoint:** `DELETE /webhook/{webhookId}?force=true`

Permanently deletes a webhook immediately without grace period.

#### Request

```http
DELETE /webhook/test-webhook-123?force=true&reason=Emergency%20removal HTTP/1.1
Host: api.homeprojectpartners.com
X-User-ID: admin-user
```

#### Response (200 OK)

```json
{
  "status": "success",
  "message": "Webhook configuration permanently deleted immediately",
  "webhook_id": "test-webhook-123",
  "leads_preserved": 45,
  "deletion_type": "immediate",
  "note": "All leads data has been preserved and remains accessible",
  "timestamp": "2025-09-28T10:00:00.000Z"
}
```

#### Example with cURL

```bash
# Force delete immediately
curl -X DELETE "https://api.homeprojectpartners.com/webhook/test-webhook-123?force=true&reason=Emergency%20removal" \
  -H "X-User-ID: admin-user"
```

### Error Responses

#### Webhook Not Found (404)

```json
{
  "error": "Webhook not found",
  "message": "Webhook test-webhook-123 does not exist",
  "timestamp": "2025-09-28T10:00:00.000Z"
}
```

#### Already Deleted (409)

```json
{
  "error": "Webhook already deleted",
  "message": "Webhook test-webhook-123 is already scheduled for deletion",
  "webhook_id": "test-webhook-123",
  "deleted_at": "2025-09-28T09:00:00.000Z",
  "note": "Use ?force=true to permanently delete immediately or POST /webhook/test-webhook-123/restore to restore",
  "timestamp": "2025-09-28T10:00:00.000Z"
}
```

#### Queue Unavailable (503)

```json
{
  "error": "Queue not available",
  "message": "Webhook deletion queue is not configured. Use ?force=true for immediate deletion.",
  "timestamp": "2025-09-28T10:00:00.000Z"
}
```

## 🔄 Restore Webhook Endpoint

### Restore Soft-Deleted Webhook

**Endpoint:** `POST /webhook/{webhookId}/restore`

Restores a soft-deleted webhook within the 24-hour grace period.

#### Request

```http
POST /webhook/test-webhook-123/restore HTTP/1.1
Host: api.homeprojectpartners.com
Content-Type: application/json
X-User-ID: admin-user
```

#### Response (200 OK)

```json
{
  "status": "success",
  "message": "Webhook restored successfully",
  "webhook_id": "test-webhook-123",
  "restored_by": "admin-user",
  "restored_at": "2025-09-28T15:30:00.000Z",
  "note": "Webhook is now active and can receive leads again",
  "timestamp": "2025-09-28T15:30:00.000Z"
}
```

#### Example with cURL

```bash
# Restore a soft-deleted webhook
curl -X POST "https://api.homeprojectpartners.com/webhook/test-webhook-123/restore" \
  -H "Content-Type: application/json" \
  -H "X-User-ID: admin-user"
```

### Error Responses

#### Webhook Not Found (404)

```json
{
  "error": "Webhook not found",
  "message": "Webhook test-webhook-123 does not exist",
  "timestamp": "2025-09-28T15:30:00.000Z"
}
```

#### Not Deleted (400)

```json
{
  "error": "Webhook not deleted",
  "message": "Webhook test-webhook-123 is not deleted and does not need restoration",
  "webhook_id": "test-webhook-123",
  "timestamp": "2025-09-28T15:30:00.000Z"
}
```

#### Restoration Window Expired (410)

```json
{
  "error": "Restoration window expired",
  "message": "Webhook test-webhook-123 cannot be restored - deletion has been executed or is in progress",
  "webhook_id": "test-webhook-123",
  "executed_at": "2025-09-29T10:00:00.000Z",
  "scheduled_deletion_at": "2025-09-29T10:00:00.000Z",
  "timestamp": "2025-09-29T11:00:00.000Z"
}
```

#### Cannot Restore (409)

```json
{
  "error": "Cannot restore",
  "message": "Webhook test-webhook-123 deletion is already processing and cannot be cancelled",
  "webhook_id": "test-webhook-123",
  "job_status": "processing",
  "timestamp": "2025-09-29T09:59:00.000Z"
}
```

## 📋 List Deleted Webhooks Endpoint

### Get All Soft-Deleted Webhooks

**Endpoint:** `GET /webhook/deleted`

Returns all soft-deleted webhooks with their restoration status.

#### Request

```http
GET /webhook/deleted HTTP/1.1
Host: api.homeprojectpartners.com
```

#### Response (200 OK)

```json
{
  "service": "Webhook API - Deleted Webhooks",
  "total_deleted": 3,
  "restorable": 2,
  "webhooks": [
    {
      "id": "test-webhook-123",
      "name": "Solar Leads - Texas",
      "description": "Solar lead collection for Texas region",
      "type": "solar",
      "deletion": {
        "deleted_at": "2025-09-28T10:00:00.000Z",
        "deleted_by": "admin-user",
        "reason": "No longer needed",
        "scheduled_deletion_at": "2025-09-29T10:00:00.000Z",
        "job_id": "webhook-del-test-webhook-123-1696000000-abc123"
      },
      "job_status": {
        "status": "pending",
        "attempts": 0,
        "execute_at": "2025-09-29T10:00:00.000Z",
        "completed_at": null,
        "error_message": null
      },
      "restoration": {
        "can_restore": true,
        "seconds_until_deletion": 82800,
        "restore_endpoint": "/webhook/test-webhook-123/restore"
      },
      "stats": {
        "total_leads": 45
      }
    },
    {
      "id": "test-webhook-456",
      "name": "HVAC Leads - California",
      "description": "HVAC lead collection for California",
      "type": "hvac",
      "deletion": {
        "deleted_at": "2025-09-27T08:00:00.000Z",
        "deleted_by": "admin-user",
        "reason": "Migrating to new system",
        "scheduled_deletion_at": "2025-09-28T08:00:00.000Z",
        "job_id": "webhook-del-test-webhook-456-1695888000-def456"
      },
      "job_status": {
        "status": "completed",
        "attempts": 1,
        "execute_at": "2025-09-28T08:00:00.000Z",
        "completed_at": "2025-09-28T08:00:05.000Z",
        "error_message": null
      },
      "restoration": {
        "can_restore": false,
        "seconds_until_deletion": 0,
        "restore_endpoint": null
      },
      "stats": {
        "total_leads": 128
      }
    },
    {
      "id": "test-webhook-789",
      "name": "Insurance Leads - Florida",
      "description": "Insurance lead collection for Florida",
      "type": "insurance",
      "deletion": {
        "deleted_at": "2025-09-28T14:00:00.000Z",
        "deleted_by": "manager-user",
        "reason": "Testing purposes",
        "scheduled_deletion_at": "2025-09-29T14:00:00.000Z",
        "job_id": "webhook-del-test-webhook-789-1696014000-ghi789"
      },
      "job_status": {
        "status": "failed",
        "attempts": 2,
        "execute_at": "2025-09-29T14:00:00.000Z",
        "completed_at": null,
        "error_message": "Database connection timeout"
      },
      "restoration": {
        "can_restore": true,
        "seconds_until_deletion": 68400,
        "restore_endpoint": "/webhook/test-webhook-789/restore"
      },
      "stats": {
        "total_leads": 23
      }
    }
  ],
  "timestamp": "2025-09-28T16:00:00.000Z"
}
```

#### Example with cURL

```bash
# Get all deleted webhooks
curl -X GET "https://api.homeprojectpartners.com/webhook/deleted"
```

### Response Field Descriptions

```
┌─────────────────────┬─────────────────────────────────────────────────────────┐
│      Field          │                    Description                          │
├─────────────────────┼─────────────────────────────────────────────────────────┤
│ total_deleted       │ Total number of soft-deleted webhooks                  │
│ restorable          │ Number of webhooks that can still be restored          │
│ deletion.deleted_at │ Timestamp when webhook was soft deleted                │
│ deletion.deleted_by │ User ID who initiated the deletion                     │
│ deletion.reason     │ User-provided reason for deletion                      │
│ job_status.status   │ Current status of the deletion job                     │
│ job_status.attempts │ Number of processing attempts                          │
│ restoration.        │ Whether webhook can still be restored                  │
│ can_restore         │                                                         │
│ restoration.        │ Seconds remaining until permanent deletion             │
│ seconds_until_      │                                                         │
│ deletion            │                                                         │
│ stats.total_leads   │ Number of leads processed by this webhook              │
└─────────────────────┴─────────────────────────────────────────────────────────┘
```

## 📋 Enhanced Webhook Listing

### Get Active Webhooks (Modified)

**Endpoint:** `GET /webhook`

The existing webhook listing endpoint now excludes soft-deleted webhooks.

#### Request

```http
GET /webhook HTTP/1.1
Host: api.homeprojectpartners.com
```

#### Response Changes

**Before Soft Deletion:**
- Returned all webhooks regardless of deletion status

**After Soft Deletion:**
- Only returns active webhooks (deleted_at IS NULL)
- Soft-deleted webhooks are hidden from normal operations
- Use `/webhook/deleted` to see deleted webhooks

#### Example Response

```json
{
  "service": "Webhook API",
  "total_webhooks": 5,
  "webhooks": [
    {
      "id": "active-webhook-001",
      "name": "Solar Leads - Arizona",
      "type": "solar",
      "region": "us",
      "category": "solar",
      "enabled": true,
      "endpoints": {
        "health": "/webhook/active-webhook-001",
        "receive": "/webhook/active-webhook-001"
      },
      "total_leads": 234,
      "conversion_rate": 15.5,
      "total_revenue": 45600,
      "created_at": "2025-09-01T10:00:00.000Z",
      "last_lead_at": "2025-09-28T09:30:00.000Z"
    }
  ],
  "usage": {
    "health_check": "GET /webhook/{webhookId}",
    "receive_lead": "POST /webhook/{webhookId}",
    "list_all": "GET /webhook",
    "list_deleted": "GET /webhook/deleted",
    "create_webhook": "POST /webhook",
    "delete_webhook": "DELETE /webhook/{webhookId}",
    "restore_webhook": "POST /webhook/{webhookId}/restore"
  },
  "timestamp": "2025-09-28T16:00:00.000Z"
}
```

## 🔍 Webhook Details with Deletion Status

### Get Specific Webhook

**Endpoint:** `GET /webhook/{webhookId}`

Health check endpoint now includes soft deletion status.

#### Response for Active Webhook

```json
{
  "status": "healthy",
  "webhook_id": "active-webhook-001",
  "config": {
    "name": "Solar Leads - Arizona",
    "description": "Solar lead collection for Arizona region",
    "type": "solar",
    "region": "us",
    "category": "solar",
    "total_leads": 234,
    "created_at": "2025-09-01T10:00:00.000Z"
  },
  "deletion_status": {
    "is_deleted": false,
    "deleted_at": null,
    "can_restore": false
  },
  "endpoints": {
    "health": "GET /webhook/active-webhook-001",
    "receive": "POST /webhook/active-webhook-001",
    "delete": "DELETE /webhook/active-webhook-001"
  },
  "timestamp": "2025-09-28T16:00:00.000Z"
}
```

#### Response for Soft-Deleted Webhook

```json
{
  "status": "soft_deleted",
  "webhook_id": "test-webhook-123",
  "config": {
    "name": "Solar Leads - Texas",
    "description": "Solar lead collection for Texas region",
    "type": "solar",
    "region": "us",
    "category": "solar",
    "total_leads": 45,
    "created_at": "2025-09-15T10:00:00.000Z"
  },
  "deletion_status": {
    "is_deleted": true,
    "deleted_at": "2025-09-28T10:00:00.000Z",
    "scheduled_deletion_at": "2025-09-29T10:00:00.000Z",
    "deleted_by": "admin-user",
    "deletion_reason": "No longer needed",
    "can_restore": true,
    "seconds_until_deletion": 82800,
    "job_id": "webhook-del-test-webhook-123-1696000000-abc123"
  },
  "endpoints": {
    "health": "GET /webhook/test-webhook-123",
    "restore": "POST /webhook/test-webhook-123/restore"
  },
  "note": "This webhook is scheduled for permanent deletion. It can be restored until 2025-09-29T10:00:00.000Z",
  "timestamp": "2025-09-28T16:00:00.000Z"
}
```

## 🔧 Integration Examples

### JavaScript/TypeScript Integration

#### Soft Delete with Confirmation

```typescript
interface DeleteOptions {
  force: boolean;
  reason: string;
}

async function deleteWebhook(
  webhookId: string,
  options: DeleteOptions,
  userId: string
): Promise<any> {
  const params = new URLSearchParams();
  if (options.force) params.append('force', 'true');
  if (options.reason) params.append('reason', options.reason);

  const response = await fetch(
    `https://api.homeprojectpartners.com/webhook/${webhookId}?${params}`,
    {
      method: 'DELETE',
      headers: {
        'X-User-ID': userId
      }
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete webhook');
  }

  return response.json();
}

// Usage examples
try {
  // Soft delete
  const result = await deleteWebhook('my-webhook-123', {
    force: false,
    reason: 'No longer needed'
  }, 'admin-user');

  console.log(`Webhook scheduled for deletion: ${result.job_id}`);
  console.log(`Can restore until: ${result.restoration.available_until}`);

} catch (error) {
  console.error('Deletion failed:', error.message);
}
```

#### Restore Webhook

```typescript
async function restoreWebhook(
  webhookId: string,
  userId: string
): Promise<any> {
  const response = await fetch(
    `https://api.homeprojectpartners.com/webhook/${webhookId}/restore`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId
      }
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to restore webhook');
  }

  return response.json();
}

// Usage
try {
  const result = await restoreWebhook('my-webhook-123', 'admin-user');
  console.log(`Webhook restored successfully at: ${result.restored_at}`);
} catch (error) {
  console.error('Restoration failed:', error.message);
}
```

#### List and Monitor Deleted Webhooks

```typescript
interface DeletedWebhook {
  id: string;
  name: string;
  deletion: {
    deleted_at: string;
    deleted_by: string;
    reason: string;
    scheduled_deletion_at: string;
  };
  restoration: {
    can_restore: boolean;
    seconds_until_deletion: number;
    restore_endpoint: string | null;
  };
  stats: {
    total_leads: number;
  };
}

async function getDeletedWebhooks(): Promise<DeletedWebhook[]> {
  const response = await fetch(
    'https://api.homeprojectpartners.com/webhook/deleted'
  );

  if (!response.ok) {
    throw new Error('Failed to fetch deleted webhooks');
  }

  const data = await response.json();
  return data.webhooks;
}

// Monitor restoration status
async function monitorDeletionStatus() {
  const deletedWebhooks = await getDeletedWebhooks();

  for (const webhook of deletedWebhooks) {
    if (webhook.restoration.can_restore) {
      const hoursRemaining = webhook.restoration.seconds_until_deletion / 3600;
      console.log(
        `Webhook "${webhook.name}" can be restored for ${hoursRemaining.toFixed(1)} more hours`
      );
    } else {
      console.log(`Webhook "${webhook.name}" cannot be restored (permanently deleted)`);
    }
  }
}
```

### Python Integration

```python
import requests
import json
from typing import Dict, List, Optional
from datetime import datetime

class WebhookDeletionClient:
    def __init__(self, base_url: str = "https://api.homeprojectpartners.com"):
        self.base_url = base_url

    def delete_webhook(
        self,
        webhook_id: str,
        user_id: str,
        reason: Optional[str] = None,
        force: bool = False
    ) -> Dict:
        """Soft delete or force delete a webhook"""

        params = {}
        if reason:
            params['reason'] = reason
        if force:
            params['force'] = 'true'

        headers = {'X-User-ID': user_id}

        response = requests.delete(
            f"{self.base_url}/webhook/{webhook_id}",
            params=params,
            headers=headers
        )

        response.raise_for_status()
        return response.json()

    def restore_webhook(self, webhook_id: str, user_id: str) -> Dict:
        """Restore a soft-deleted webhook"""

        headers = {
            'Content-Type': 'application/json',
            'X-User-ID': user_id
        }

        response = requests.post(
            f"{self.base_url}/webhook/{webhook_id}/restore",
            headers=headers
        )

        response.raise_for_status()
        return response.json()

    def list_deleted_webhooks(self) -> List[Dict]:
        """Get all soft-deleted webhooks"""

        response = requests.get(f"{self.base_url}/webhook/deleted")
        response.raise_for_status()

        data = response.json()
        return data['webhooks']

    def get_restoration_status(self, webhook_id: str) -> Dict:
        """Get detailed status of a specific webhook"""

        response = requests.get(f"{self.base_url}/webhook/{webhook_id}")
        response.raise_for_status()

        return response.json()

# Usage examples
client = WebhookDeletionClient()

# Soft delete
result = client.delete_webhook(
    webhook_id="my-webhook-123",
    user_id="admin-user",
    reason="No longer needed",
    force=False
)
print(f"Scheduled for deletion: {result['scheduled_deletion_at']}")

# List deleted webhooks
deleted = client.list_deleted_webhooks()
for webhook in deleted:
    if webhook['restoration']['can_restore']:
        hours_left = webhook['restoration']['seconds_until_deletion'] / 3600
        print(f"{webhook['name']}: {hours_left:.1f} hours to restore")

# Restore webhook
try:
    restore_result = client.restore_webhook("my-webhook-123", "admin-user")
    print(f"Restored successfully: {restore_result['restored_at']}")
except requests.HTTPError as e:
    print(f"Restoration failed: {e.response.json()['message']}")
```

## 🚨 Error Handling Best Practices

### HTTP Status Codes

```
┌─────────────┬─────────────────────────────────────────────────────────────┐
│ Status Code │                       Meaning                               │
├─────────────┼─────────────────────────────────────────────────────────────┤
│ 200         │ Success - Operation completed successfully                  │
│ 400         │ Bad Request - Invalid parameters or webhook state           │
│ 401         │ Unauthorized - Missing or invalid authentication            │
│ 403         │ Forbidden - Insufficient permissions                       │
│ 404         │ Not Found - Webhook does not exist                         │
│ 409         │ Conflict - Webhook already deleted or cannot be restored    │
│ 410         │ Gone - Restoration window expired                          │
│ 422         │ Unprocessable Entity - Validation errors                   │
│ 500         │ Internal Server Error - Database or queue errors           │
│ 503         │ Service Unavailable - Queue system not available           │
└─────────────┴─────────────────────────────────────────────────────────────┘
```

### Retry Logic

```typescript
async function deleteWebhookWithRetry(
  webhookId: string,
  options: DeleteOptions,
  userId: string,
  maxRetries: number = 3
): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await deleteWebhook(webhookId, options, userId);
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // Only retry on server errors or service unavailable
      if (error.status === 500 || error.status === 503) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Don't retry client errors
      throw error;
    }
  }
}
```

---

**Next**: Learn about [Frontend Components](./05-frontend-components.md) and UI integration.