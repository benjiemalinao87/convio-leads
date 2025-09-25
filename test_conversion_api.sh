#!/bin/bash

API_BASE="https://api.homeprojectpartners.com"

echo "🚀 Testing Conversion Tracking API..."

# First, let's check existing contacts to get a contact_id
echo -e "\n📋 Getting existing contacts..."
CONTACTS=$(curl -s "${API_BASE}/leads?limit=5" | jq -r '.leads[0] // empty')

if [ -n "$CONTACTS" ]; then
    CONTACT_ID=$(echo "$CONTACTS" | jq -r '.contact_id // empty')
    LEAD_ID=$(echo "$CONTACTS" | jq -r '.id // empty')

    if [ -n "$CONTACT_ID" ] && [ "$CONTACT_ID" != "null" ]; then
        echo "✅ Found contact ID: $CONTACT_ID, Lead ID: $LEAD_ID"

        # Test 1: Log a conversion
        echo -e "\n💰 Testing conversion logging..."
        CONVERSION_RESULT=$(curl -s -X POST "${API_BASE}/conversions/log" \
            -H "Content-Type: application/json" \
            -H "X-Workspace-ID: test_workspace_1" \
            -H "X-API-Key: test_key_12345" \
            -d "{
                \"contact_id\": $CONTACT_ID,
                \"lead_id\": $LEAD_ID,
                \"workspace_id\": \"test_workspace_1\",
                \"converted_by\": \"john_sales_agent\",
                \"conversion_type\": \"sale\",
                \"conversion_value\": 25000,
                \"custom_data\": {
                    \"product\": \"solar_panel_system\",
                    \"contract_id\": \"CTR-2024-001\",
                    \"financing_type\": \"loan\",
                    \"term_months\": 240
                }
            }")

        echo "Conversion Result:"
        echo "$CONVERSION_RESULT" | jq '.'

        # Test 2: Update contact conversion status
        echo -e "\n📝 Testing contact conversion update..."
        UPDATE_RESULT=$(curl -s -X PATCH "${API_BASE}/conversions/contacts/$CONTACT_ID" \
            -H "Content-Type: application/json" \
            -H "X-Workspace-ID: test_workspace_1" \
            -H "X-API-Key: test_key_12345" \
            -d "{
                \"sent_from_workspace\": \"lead_gen_team\",
                \"converted_from_workspace\": \"test_workspace_1\",
                \"conversion_status\": \"converted\",
                \"converted_by\": \"john_sales_agent\",
                \"custom_metadata\": {
                    \"qualification_score\": 95,
                    \"interested_products\": [\"solar\", \"battery\"],
                    \"preferred_contact_time\": \"morning\",
                    \"decision_timeline\": \"30_days\"
                },
                \"qualification_score\": 95
            }")

        echo "Update Result:"
        echo "$UPDATE_RESULT" | jq '.'

    else
        echo "❌ No valid contact_id found"
    fi
else
    echo "❌ No contacts found. Please create some leads first."
fi

# Test 3: Get conversion analytics
echo -e "\n📊 Testing conversion analytics..."
ANALYTICS_RESULT=$(curl -s "${API_BASE}/conversions/analytics")
echo "Analytics Result:"
echo "$ANALYTICS_RESULT" | jq '.'

# Test 4: Get conversion funnel
echo -e "\n🎯 Testing conversion funnel..."
FUNNEL_RESULT=$(curl -s "${API_BASE}/conversions/funnel")
echo "Funnel Result:"
echo "$FUNNEL_RESULT" | jq '.'

# Test 5: Get recent conversions
echo -e "\n📋 Testing recent conversions..."
CONVERSIONS_RESULT=$(curl -s "${API_BASE}/conversions?limit=5")
echo "Recent Conversions:"
echo "$CONVERSIONS_RESULT" | jq '.'

echo -e "\n✅ Conversion API testing complete!"
echo "Now visit http://localhost:8085/conversions to see the dashboard!"