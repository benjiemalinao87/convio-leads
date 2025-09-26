#!/bin/bash

# Test script for Provider Authentication Feature
# Tests the new lead_source_provider_id header requirement

# Configuration
API_BASE_URL="https://api.homeprojectpartners.com"
WEBHOOK_ID="click-ventures_ws_us_general_656"

echo "🧪 Testing Provider Authentication Feature"
echo "=========================================="
echo "API Base URL: $API_BASE_URL"
echo "Webhook ID: $WEBHOOK_ID"
echo ""

# Test payload
TEST_PAYLOAD='{
    "firstname": "John",
    "lastname": "TestProvider",
    "email": "john.testprovider@example.com",
    "phone": "5551234567",
    "address1": "123 Test Street",
    "city": "Test City",
    "state": "CA",
    "zip": "90210",
    "source": "Provider Auth Test",
    "productid": "Solar",
    "subsource": "Authentication Testing",
    "consent": {
      "description": "By providing your phone number, you consent to receive marketing messages via text. Reply STOP to opt out.",
      "value": true
    },
    "tcpa_compliance": true
}'

echo "Test Payload:"
echo "$TEST_PAYLOAD" | jq .
echo ""

# Test 1: Request without provider header (should fail with 401)
echo "📋 Test 1: POST without lead_source_provider_id header (should return 401)"
echo "------------------------------------------------------------------------"
HTTP_STATUS=$(curl -s -o response.json -w "%{http_code}" \
  -X POST "$API_BASE_URL/webhook/$WEBHOOK_ID" \
  -H "Content-Type: application/json" \
  -d "$TEST_PAYLOAD")

echo "HTTP Status: $HTTP_STATUS"
echo "Response:"
cat response.json | jq .
echo ""

# Test 2: Request with invalid provider (should fail with 401)
echo "📋 Test 2: POST with invalid lead_source_provider_id (should return 401)"
echo "-----------------------------------------------------------------------"
HTTP_STATUS=$(curl -s -o response.json -w "%{http_code}" \
  -X POST "$API_BASE_URL/webhook/$WEBHOOK_ID" \
  -H "Content-Type: application/json" \
  -H "lead_source_provider_id: invalid_provider_999" \
  -d "$TEST_PAYLOAD")

echo "HTTP Status: $HTTP_STATUS"
echo "Response:"
cat response.json | jq .
echo ""

# Test 3: Request with valid provider (should succeed with 201)
echo "📋 Test 3: POST with valid lead_source_provider_id (should return 201)"
echo "----------------------------------------------------------------------"
HTTP_STATUS=$(curl -s -o response.json -w "%{http_code}" \
  -X POST "$API_BASE_URL/webhook/$WEBHOOK_ID" \
  -H "Content-Type: application/json" \
  -H "lead_source_provider_id: click_ventures_001" \
  -d "$TEST_PAYLOAD")

echo "HTTP Status: $HTTP_STATUS"
echo "Response:"
cat response.json | jq .
echo ""

# Test 4: Request with inactive provider (should fail with 401)
echo "📋 Test 4: POST with inactive lead_source_provider_id (should return 401)"
echo "------------------------------------------------------------------------"
HTTP_STATUS=$(curl -s -o response.json -w "%{http_code}" \
  -X POST "$API_BASE_URL/webhook/$WEBHOOK_ID" \
  -H "Content-Type: application/json" \
  -H "lead_source_provider_id: test_provider_999" \
  -d "$TEST_PAYLOAD")

echo "HTTP Status: $HTTP_STATUS"
echo "Response:"
cat response.json | jq .
echo ""

# Test 5: Health check (should still work without provider header)
echo "📋 Test 5: GET health check (should work without provider header)"
echo "-----------------------------------------------------------------"
HTTP_STATUS=$(curl -s -o response.json -w "%{http_code}" \
  -X GET "$API_BASE_URL/webhook/$WEBHOOK_ID")

echo "HTTP Status: $HTTP_STATUS"
echo "Response:"
cat response.json | jq .
echo ""

# Cleanup
rm -f response.json

echo "✅ Provider Authentication Testing Complete!"
echo ""
echo "Expected Results:"
echo "- Test 1: HTTP 401 (Missing provider authentication)"
echo "- Test 2: HTTP 401 (Invalid provider)"
echo "- Test 3: HTTP 201 (Success with valid provider)"
echo "- Test 4: HTTP 401 (Inactive provider)" 
echo "- Test 5: HTTP 200 (Health check still works)"
echo ""
echo "Note: Make sure the database migration has been applied to create the lead_source_providers table."
