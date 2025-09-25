#!/bin/bash

API_BASE="https://api.homeprojectpartners.com"

echo "🚀 Setting up demo conversion data..."

# Step 1: Register a test workspace
echo -e "\n🏢 Registering test workspace..."
WORKSPACE_RESULT=$(curl -s -X POST "${API_BASE}/conversions/workspace/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"workspace_id\": \"demo_sales_team\",
        \"name\": \"Demo Sales Team\",
        \"permissions\": [\"read\", \"write\", \"convert\"]
    }")

echo "Workspace registration result:"
echo "$WORKSPACE_RESULT" | jq '.'

# Extract API key
API_KEY=$(echo "$WORKSPACE_RESULT" | jq -r '.workspace.api_key')
echo "Generated API Key: $API_KEY"

# Step 2: Get existing contacts to work with
echo -e "\n📋 Getting existing contacts..."
CONTACTS=$(curl -s "${API_BASE}/leads?limit=5")
CONTACT_LIST=$(echo "$CONTACTS" | jq -r '.leads[]')

if [ -n "$CONTACT_LIST" ]; then
    echo "Found contacts, creating demo conversions..."

    # Create multiple demo conversions
    CONTACT_1_ID=$(echo "$CONTACTS" | jq -r '.leads[0].contact_id // empty')
    CONTACT_2_ID=$(echo "$CONTACTS" | jq -r '.leads[1].contact_id // empty')
    LEAD_1_ID=$(echo "$CONTACTS" | jq -r '.leads[0].id // empty')
    LEAD_2_ID=$(echo "$CONTACTS" | jq -r '.leads[1].id // empty')

    if [ -n "$CONTACT_1_ID" ] && [ "$CONTACT_1_ID" != "null" ]; then
        echo -e "\n💰 Creating sale conversion..."
        curl -s -X POST "${API_BASE}/conversions/log" \
            -H "Content-Type: application/json" \
            -H "X-Workspace-ID: demo_sales_team" \
            -H "X-API-Key: $API_KEY" \
            -d "{
                \"contact_id\": $CONTACT_1_ID,
                \"lead_id\": $LEAD_1_ID,
                \"workspace_id\": \"demo_sales_team\",
                \"converted_by\": \"john_doe_sales\",
                \"conversion_type\": \"sale\",
                \"conversion_value\": 45000,
                \"custom_data\": {
                    \"product\": \"Premium Solar System\",
                    \"contract_id\": \"SOL-2025-001\",
                    \"financing_type\": \"loan\",
                    \"term_months\": 300,
                    \"installation_date\": \"2025-02-15\",
                    \"system_size_kw\": 12.5,
                    \"expected_savings\": 3200
                }
            }" | jq '.'
    fi

    if [ -n "$CONTACT_2_ID" ] && [ "$CONTACT_2_ID" != "null" ]; then
        echo -e "\n📅 Creating appointment conversion..."
        curl -s -X POST "${API_BASE}/conversions/log" \
            -H "Content-Type: application/json" \
            -H "X-Workspace-ID: demo_sales_team" \
            -H "X-API-Key: $API_KEY" \
            -d "{
                \"contact_id\": $CONTACT_2_ID,
                \"lead_id\": $LEAD_2_ID,
                \"workspace_id\": \"demo_sales_team\",
                \"converted_by\": \"jane_smith_sales\",
                \"conversion_type\": \"appointment\",
                \"conversion_value\": 0,
                \"custom_data\": {
                    \"appointment_date\": \"2025-01-28\",
                    \"appointment_type\": \"home_assessment\",
                    \"preferred_time\": \"morning\",
                    \"contact_method\": \"phone\",
                    \"interest_level\": \"high\",
                    \"property_type\": \"single_family\",
                    \"roof_condition\": \"excellent\"
                }
            }" | jq '.'
    fi

    # Register another workspace
    echo -e "\n🏢 Registering second workspace..."
    WORKSPACE_2_RESULT=$(curl -s -X POST "${API_BASE}/conversions/workspace/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"workspace_id\": \"hvac_specialists\",
            \"name\": \"HVAC Specialists Team\",
            \"permissions\": [\"read\", \"write\", \"convert\"]
        }")

    API_KEY_2=$(echo "$WORKSPACE_2_RESULT" | jq -r '.workspace.api_key')

    # Create HVAC conversion if we have more contacts
    CONTACT_3_ID=$(echo "$CONTACTS" | jq -r '.leads[2].contact_id // empty')
    LEAD_3_ID=$(echo "$CONTACTS" | jq -r '.leads[2].id // empty')

    if [ -n "$CONTACT_3_ID" ] && [ "$CONTACT_3_ID" != "null" ]; then
        echo -e "\n🔧 Creating HVAC conversion..."
        curl -s -X POST "${API_BASE}/conversions/log" \
            -H "Content-Type: application/json" \
            -H "X-Workspace-ID: hvac_specialists" \
            -H "X-API-Key: $API_KEY_2" \
            -d "{
                \"contact_id\": $CONTACT_3_ID,
                \"lead_id\": $LEAD_3_ID,
                \"workspace_id\": \"hvac_specialists\",
                \"converted_by\": \"mike_hvac_tech\",
                \"conversion_type\": \"qualified\",
                \"conversion_value\": 8500,
                \"custom_data\": {
                    \"service_type\": \"ac_installation\",
                    \"system_type\": \"central_air\",
                    \"home_size_sqft\": 2400,
                    \"current_system_age\": 15,
                    \"urgency\": \"within_month\",
                    \"energy_efficiency_rating\": \"16_seer\",
                    \"warranty_years\": 10
                }
            }" | jq '.'
    fi

    sleep 2

    echo -e "\n📊 Final Analytics Check:"
    curl -s "${API_BASE}/conversions/analytics" | jq '.analytics.summary'

    echo -e "\n🎯 Conversion Funnel:"
    curl -s "${API_BASE}/conversions/funnel" | jq '.funnel.stages'

    echo -e "\n✅ Demo data setup complete!"
    echo -e "\n🎉 Visit your conversion dashboard at:"
    echo "   http://localhost:8085/conversions"
    echo -e "\n📊 You should see:"
    echo "   • Total conversions: 3"
    echo "   • Total revenue: \$53,500"
    echo "   • 2 active workspaces"
    echo "   • Conversion funnel with real data"

else
    echo "❌ No contacts found. Please create some leads first using the webhook endpoint."
    echo "You can use the main dashboard to send test webhook data first."
fi