# Provider Access Control - Testing Guide

## Overview
This guide explains how to test the provider access control implementation to ensure providers can only see their own leads and webhooks.

## What Was Fixed

### Issue
Providers with login credentials could see ALL leads and webhooks in the system, including data from other providers. This was a major security and privacy issue.

### Solution
- Backend webhook endpoint now filters by `provider_id`
- Frontend passes `provider_id` when fetching data for provider users
- Visual indicators show providers they're viewing filtered data
- Admin-only actions are hidden from provider users

## Test Accounts

### Admin Account
- **Email**: `admin@homeprojectpartners.com`
- **Password**: (check your environment)
- **Expected Behavior**: Can see ALL webhooks and leads

### Provider Accounts (Example)
- **Provider ID**: `click_ventures_1234`
- **Email**: `john@clickventures.com`
- **Password**: (set in database)
- **Expected Behavior**: Can only see webhooks assigned to this provider

## Testing Procedures

### Test 1: Provider Login and Dashboard Access
**Steps:**
1. Logout if currently logged in
2. Login with a provider account (provider_id + email + password)
3. Navigate to Dashboard
4. Navigate to Leads page
5. Navigate to Webhooks page

**Expected Results:**
- ✅ Login successful
- ✅ Blue notice appears on Leads page: "Provider View: You are viewing only the leads..."
- ✅ Blue notice appears on Webhooks page: "Provider View: You are viewing only the webhooks..."
- ✅ Only sees leads from their webhooks
- ✅ Only sees their assigned webhooks

**Failure Indicators:**
- ❌ Sees all webhooks (not just theirs)
- ❌ No blue notice appears
- ❌ Can access admin features

### Test 2: Webhook Filtering
**Steps:**
1. Login as Admin
2. Go to Webhooks page
3. Count total webhooks visible
4. Note down webhook names/IDs
5. Logout
6. Login as Provider
7. Go to Webhooks page
8. Count webhooks visible

**Expected Results:**
- ✅ Admin sees ALL webhooks (e.g., 50 webhooks)
- ✅ Provider sees only THEIR webhooks (e.g., 2-3 webhooks)
- ✅ Provider's webhooks are subset of admin's view
- ✅ Blue notice appears for provider

**Failure Indicators:**
- ❌ Provider sees same count as admin
- ❌ Provider sees webhooks not assigned to them

### Test 3: Leads Filtering
**Steps:**
1. Login as Admin
2. Go to Leads page
3. Note total lead count
4. Filter by a specific webhook
5. Note which leads appear
6. Logout
7. Login as Provider A
8. Go to Leads page
9. Note total lead count
10. Logout
11. Login as Provider B (different provider)
12. Go to Leads page
13. Compare lead counts

**Expected Results:**
- ✅ Admin sees ALL leads
- ✅ Provider A sees only leads from Provider A's webhooks
- ✅ Provider B sees only leads from Provider B's webhooks
- ✅ Provider A and B see different data
- ✅ Blue notice appears for both providers

**Failure Indicators:**
- ❌ Providers see same leads as admin
- ❌ Provider A and Provider B see same data
- ❌ Leads from other providers are visible

### Test 4: UI Elements for Providers
**Steps:**
1. Login as Provider
2. Go to Webhooks page
3. Look for the following buttons/features:
   - "Add Webhook" button
   - "Delete" button on webhook cards
   - "Manage Forwarding" button
   - "View Deleted" button
   - "API Docs" button

**Expected Results:**
- ✅ "Add Webhook" button is HIDDEN
- ✅ "Delete" button is HIDDEN
- ✅ "Manage Forwarding" button is HIDDEN
- ✅ "View Deleted" button is HIDDEN
- ✅ "API Docs" button is HIDDEN
- ✅ "Refresh" button is VISIBLE
- ✅ "Activity" button is VISIBLE
- ✅ "Copy URL" button is VISIBLE

**Failure Indicators:**
- ❌ Admin buttons visible to providers
- ❌ Can create/delete webhooks as provider

### Test 5: API Direct Testing
**Steps:**
1. Get a provider's ID from database
2. Test API directly:

```bash
# Test without provider_id (as admin)
curl https://api.homeprojectpartners.com/webhook

# Test with provider_id (as provider)
curl "https://api.homeprojectpartners.com/webhook?provider_id=click_ventures_1234"
```

**Expected Results:**
- ✅ Without provider_id: Returns ALL webhooks
- ✅ With provider_id: Returns only that provider's webhooks
- ✅ Response includes `provider_id` field in metadata

**Failure Indicators:**
- ❌ Same results for both queries
- ❌ Provider_id parameter ignored

### Test 6: Multi-Provider Isolation
**Steps:**
1. Create or identify 2 different provider accounts
2. Assign different webhooks to each provider in database:

```sql
-- Assign webhook to Provider A
INSERT INTO webhook_provider_mapping (webhook_id, provider_id)
VALUES ('webhook_001', 'provider_a_1234');

-- Assign webhook to Provider B  
INSERT INTO webhook_provider_mapping (webhook_id, provider_id)
VALUES ('webhook_002', 'provider_b_5678');
```

3. Login as Provider A
4. Note webhooks and leads visible
5. Logout and login as Provider B
6. Note webhooks and leads visible
7. Compare results

**Expected Results:**
- ✅ Provider A sees only webhook_001
- ✅ Provider B sees only webhook_002
- ✅ No overlap in visible data
- ✅ Each provider sees leads only from their webhooks

**Failure Indicators:**
- ❌ Both providers see same data
- ❌ Providers can see each other's webhooks
- ❌ Cross-contamination of leads

### Test 7: Permission-Based Route Access
**Steps:**
1. Login as Provider
2. Try to access various routes:
   - `/leads` - Should work
   - `/webhooks` - Should work
   - `/dashboard` - Should work
   - `/settings` - Check access
   - `/analytics` - Check access

**Expected Results:**
- ✅ Can access public/shared routes
- ✅ All pages show filtered data
- ✅ No admin-only routes accessible
- ✅ Consistent filtering across all pages

**Failure Indicators:**
- ❌ Can access admin-only routes
- ❌ Some pages show unfiltered data
- ❌ Inconsistent filtering

## Database Verification

### Check Provider-Webhook Mapping
```sql
-- View all provider-webhook assignments
SELECT 
    p.provider_name,
    p.provider_id,
    wpm.webhook_id,
    w.name as webhook_name
FROM lead_source_providers p
LEFT JOIN webhook_provider_mapping wpm ON p.provider_id = wpm.provider_id
LEFT JOIN webhook_configs w ON wpm.webhook_id = w.webhook_id
ORDER BY p.provider_name;
```

### Check User Accounts
```sql
-- View all user accounts and their provider associations
SELECT 
    u.email,
    u.permission_type,
    u.provider_id,
    p.provider_name
FROM users u
LEFT JOIN lead_source_providers p ON u.provider_id = p.provider_id
ORDER BY u.permission_type, u.email;
```

### Verify Lead Counts
```sql
-- Count leads per provider
SELECT 
    wpm.provider_id,
    p.provider_name,
    COUNT(l.id) as lead_count
FROM webhook_provider_mapping wpm
LEFT JOIN leads l ON wpm.webhook_id = l.webhook_id
LEFT JOIN lead_source_providers p ON wpm.provider_id = p.provider_id
GROUP BY wpm.provider_id, p.provider_name
ORDER BY lead_count DESC;
```

## Common Issues and Solutions

### Issue 1: Provider sees all data
**Symptom:** Provider can see all webhooks and leads, not just theirs
**Check:**
1. Verify user has `permission_type = 'provider'`
2. Verify user has valid `provider_id`
3. Check webhook_provider_mapping table has entries
4. Check frontend is passing provider_id to API

**Fix:**
```sql
-- Update user to be provider type
UPDATE users 
SET permission_type = 'provider', provider_id = 'their_provider_id'
WHERE email = 'their@email.com';

-- Add webhook mapping if missing
INSERT INTO webhook_provider_mapping (webhook_id, provider_id)
VALUES ('webhook_id', 'provider_id');
```

### Issue 2: No data visible for provider
**Symptom:** Provider sees empty lists for webhooks and leads
**Check:**
1. Verify webhook_provider_mapping has entries for this provider
2. Check webhooks are active (is_active = 1)
3. Verify leads exist for their webhooks

**Fix:**
```sql
-- Check if provider has webhooks assigned
SELECT * FROM webhook_provider_mapping 
WHERE provider_id = 'their_provider_id';

-- If none, assign webhooks
INSERT INTO webhook_provider_mapping (webhook_id, provider_id)
VALUES ('webhook_id', 'provider_id');
```

### Issue 3: UI actions still visible
**Symptom:** Provider can see admin buttons
**Check:**
1. Check if useAuth is properly imported
2. Verify isProvider logic is working
3. Check conditional rendering logic

**Fix:** Ensure conditional rendering wraps admin actions:
```typescript
{!isProvider && (
  <Button>Admin Action</Button>
)}
```

## Performance Testing

### Expected Performance:
- Page load times should be similar for providers and admins
- API response times < 500ms
- No noticeable UI lag when filtering

### Load Testing:
```bash
# Test API endpoint performance
ab -n 1000 -c 10 "https://api.homeprojectpartners.com/webhook?provider_id=test_1234"
```

## Security Checklist

- [ ] Provider cannot see other providers' data
- [ ] Provider cannot create webhooks
- [ ] Provider cannot delete webhooks
- [ ] Provider cannot manage forwarding rules
- [ ] Provider cannot access admin API endpoints
- [ ] Provider ID is validated server-side
- [ ] Database queries use proper JOINs
- [ ] No data leakage in API responses
- [ ] Visual indicators clearly show filtered view
- [ ] Permission checks on all sensitive routes

## Rollback Plan

If issues are discovered:

1. **Quick Fix:** Disable provider logins temporarily
```sql
UPDATE users SET is_active = 0 WHERE permission_type = 'provider';
```

2. **Revert Frontend:**
```bash
git revert [commit-hash]
git push
```

3. **Revert Backend:**
```bash
cd webhook-api
git revert [commit-hash]
npm run deploy
```

4. **Communicate:** Notify providers of temporary access issues

## Success Criteria

✅ All tests pass
✅ Zero data leakage between providers
✅ UI clearly indicates filtered view
✅ Performance remains acceptable
✅ No breaking changes for admin users
✅ Database relationships correctly enforced
✅ Security checklist complete

## Support

If issues persist:
1. Check `lesson_learned.md` for troubleshooting guide
2. Review database relationships
3. Verify user permission_type and provider_id
4. Check browser console for errors
5. Review API logs for failed requests

## Date Created
December 5, 2025

## Last Updated
December 5, 2025
