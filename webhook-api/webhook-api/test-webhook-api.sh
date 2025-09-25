#!/bin/bash

# Test script for Convio Leads Webhook API
# This script tests all the webhook endpoints and functionality

set -e

API_BASE_URL="${1:-http://localhost:8787}"
WEBHOOK_ID="ws_cal_solar_001"

echo "🚀 Testing Convio Leads Webhook API at $API_BASE_URL"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
test_count=0
pass_count=0

run_test() {
    local test_name="$1"
    local command="$2"
    local expected_status="$3"

    test_count=$((test_count + 1))
    echo -e "\n${YELLOW}Test $test_count: $test_name${NC}"
    echo "Command: $command"

    if eval "$command"; then
        status_code=$?
        if [[ $status_code -eq 0 ]] || [[ $status_code -eq $expected_status ]]; then
            echo -e "${GREEN}✅ PASS${NC}"
            pass_count=$((pass_count + 1))
        else
            echo -e "${RED}❌ FAIL - Expected status $expected_status, got $status_code${NC}"
        fi
    else
        echo -e "${RED}❌ FAIL - Command failed${NC}"
    fi
}

echo -e "\n1. Testing Health Endpoints"
echo "=============================="

run_test "Root endpoint health check" \
    "curl -s -w '%{http_code}' -o /dev/null $API_BASE_URL/ | grep -q 200" \
    0

run_test "Health endpoint check" \
    "curl -s -w '%{http_code}' -o /dev/null $API_BASE_URL/health | grep -q 200" \
    0

run_test "Detailed health endpoint check" \
    "curl -s -w '%{http_code}' -o /dev/null $API_BASE_URL/health/detailed | grep -q 200" \
    0

echo -e "\n2. Testing Webhook Discovery"
echo "============================="

run_test "List all webhooks" \
    "curl -s $API_BASE_URL/webhook | jq -r '.total_webhooks' | grep -q 3" \
    0

run_test "Get specific webhook config" \
    "curl -s $API_BASE_URL/webhook/$WEBHOOK_ID | jq -r '.webhook_id' | grep -q $WEBHOOK_ID" \
    0

echo -e "\n3. Testing Webhook Validation"
echo "=============================="

run_test "Invalid webhook pattern" \
    "curl -s -w '%{http_code}' -o /dev/null $API_BASE_URL/webhook/invalid_pattern | grep -q 400" \
    0

run_test "Non-existent webhook" \
    "curl -s -w '%{http_code}' -o /dev/null $API_BASE_URL/webhook/ws_xx_fake_999 | grep -q 404" \
    0

echo -e "\n4. Testing Lead Data Processing"
echo "================================"

# Create test lead data
cat > /tmp/valid_solar_lead.json << EOF
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "555-123-4567",
  "state": "CA",
  "city": "San Francisco",
  "zipCode": "94102",
  "monthlyElectricBill": 150,
  "propertyType": "single-family",
  "roofCondition": "good",
  "homeownershipStatus": "own",
  "creditScore": "excellent",
  "source": "Test Solar Provider"
}
EOF

cat > /tmp/valid_hvac_lead.json << EOF
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@example.com",
  "phone": "555-987-6543",
  "state": "TX",
  "city": "Austin",
  "zipCode": "73301",
  "serviceType": "installation",
  "systemAge": 15,
  "systemType": "central-air",
  "homeSize": "2000-3000",
  "urgency": "within-month",
  "budget": "10k-15k",
  "source": "Test HVAC Provider"
}
EOF

cat > /tmp/invalid_lead.json << EOF
{
  "email": "invalid-email",
  "phone": "123"
}
EOF

run_test "Valid solar lead submission" \
    "curl -s -X POST $API_BASE_URL/webhook/ws_cal_solar_001 -H 'Content-Type: application/json' -d @/tmp/valid_solar_lead.json | jq -r '.status' | grep -q success" \
    0

run_test "Valid HVAC lead submission" \
    "curl -s -X POST $API_BASE_URL/webhook/ws_tx_hvac_002 -H 'Content-Type: application/json' -d @/tmp/valid_hvac_lead.json | jq -r '.status' | grep -q success" \
    0

run_test "Invalid lead data validation" \
    "curl -s -w '%{http_code}' -X POST $API_BASE_URL/webhook/$WEBHOOK_ID -H 'Content-Type: application/json' -d @/tmp/invalid_lead.json -o /dev/null | grep -q 422" \
    0

echo -e "\n5. Testing Error Handling"
echo "========================="

run_test "Invalid JSON payload" \
    "curl -s -w '%{http_code}' -X POST $API_BASE_URL/webhook/$WEBHOOK_ID -H 'Content-Type: application/json' -d 'invalid json' -o /dev/null | grep -q 400" \
    0

run_test "Missing Content-Type header" \
    "curl -s -w '%{http_code}' -X POST $API_BASE_URL/webhook/$WEBHOOK_ID -d @/tmp/valid_solar_lead.json -o /dev/null | grep -q 400" \
    0

run_test "404 for non-existent endpoint" \
    "curl -s -w '%{http_code}' -o /dev/null $API_BASE_URL/nonexistent | grep -q 404" \
    0

echo -e "\n6. Testing Rate Limiting (Optional)"
echo "==================================="

# Note: This test might not work in development mode without persistent storage
echo "ℹ️  Rate limiting tests require production environment with persistent storage"

echo -e "\n📊 Test Results"
echo "==============="
echo -e "Total tests: $test_count"
echo -e "Passed: ${GREEN}$pass_count${NC}"
echo -e "Failed: ${RED}$((test_count - pass_count))${NC}"

if [[ $pass_count -eq $test_count ]]; then
    echo -e "\n🎉 ${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "\n⚠️  ${RED}Some tests failed.${NC}"
    exit 1
fi

# Cleanup
rm -f /tmp/valid_solar_lead.json /tmp/valid_hvac_lead.json /tmp/invalid_lead.json