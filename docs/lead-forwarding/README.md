# Lead Forwarding System Documentation

## 📚 Overview

This directory contains comprehensive documentation for the Home Project Partners Lead Forwarding System, a priority-based, intelligent routing mechanism for automatically distributing leads to partner webhooks.

## 📖 Documentation Files

### [`LEAD_FORWARDING_SYSTEM.md`](./LEAD_FORWARDING_SYSTEM.md)
**Complete system documentation** covering:
- Architecture and data flow with ASCII diagrams
- Priority and routing logic explained in detail
- Two-level control system (master toggle + rule toggle)
- Matching criteria (product types + zip codes)
- Complete API reference with examples
- Database schema and indexes
- Frontend component guide
- Troubleshooting guide
- Best practices

## 🚀 Quick Start

### Understanding the System in 60 Seconds

**What it does:**
- Automatically forwards incoming leads to partner webhooks
- Matches leads based on **Product Type** AND **Zip Code**
- Supports **multiple forwards** (one lead → many partners)
- Uses **priority ordering** to control evaluation sequence

**How to use:**
1. **Enable Master Toggle** for your webhook
2. **Create Forwarding Rules** with product types + zip codes
3. **Set Priorities** (1 = highest priority)
4. **Monitor Activity Logs** to track success/failures

### Example Flow

```
Lead Arrives: Product=Solar, Zip=90210
    ↓
Rule #1: Product=[Solar], Zip=[90210, 90211] → ✅ MATCH → Forward to Partner A
    ↓
Rule #2: Product=[Solar, HVAC], Zip=[90210] → ✅ MATCH → Forward to Partner B
    ↓
Result: Lead forwarded to BOTH partners
```

## 🔗 Related Documentation

- **Main API Docs**: [`../../webhook-api/API_DOCUMENTATION.md`](../../webhook-api/API_DOCUMENTATION.md)
- **Project Overview**: [`../../CLAUDE.md`](../../CLAUDE.md)
- **Webhook Soft Deletion**: [`../webhook-soft-deletion/README.md`](../webhook-soft-deletion/README.md)

## 🎯 Key Files Reference

### Backend
- **Core Logic**: `webhook-api/webhook-api/src/utils/lead-forwarder.ts`
- **API Routes**: `webhook-api/webhook-api/src/routes/lead-forwarding.ts`

### Frontend
- **Rules Management**: `src/components/leads/ForwardingRulesList.tsx`
- **Create Rule Dialog**: `src/components/leads/CreateForwardingRuleDialog.tsx`

### Database
- **Tables**: `lead_forwarding_rules`, `lead_forwarding_log`
- **View**: `v_forwarding_stats`

## 📊 Key Concepts

### Priority System
```
Lower Number = Higher Priority
Priority 1 → Evaluated FIRST
Priority 2 → Evaluated SECOND
Priority 3 → Evaluated THIRD
```

### Two-Level Control
```
Master Toggle (Webhook Level)
├── ON: Rules can execute
└── OFF: NO rules execute (override all)

Rule Toggle (Individual Rule Level)
├── Enabled: Rule executes (if master is ON)
└── Disabled: Rule skipped
```

### Matching Logic
```
Product Match  AND  Zip Match  =  FORWARD
```

## 🔧 Common Tasks

### View Active Rules
```bash
curl https://api.homeprojectpartners.com/webhook/YOUR_WEBHOOK_ID/forwarding-rules
```

### Enable Master Toggle
```bash
curl -X PATCH https://api.homeprojectpartners.com/webhook/YOUR_WEBHOOK_ID/forwarding-toggle \
  -H "Content-Type: application/json" \
  -d '{"forwarding_enabled": true}'
```

### Check Forwarding Logs
```bash
curl "https://api.homeprojectpartners.com/webhook/YOUR_WEBHOOK_ID/forwarding-log?limit=20"
```

### Get Statistics
```bash
curl https://api.homeprojectpartners.com/webhook/YOUR_WEBHOOK_ID/forwarding-stats
```

## 📈 Success Metrics

Track these KPIs for your forwarding system:
- **Success Rate**: Percentage of successful forwards (target: >95%)
- **Response Time**: Average time to forward lead (target: <2s)
- **Partner Coverage**: Percentage of leads matched to rules (target: >80%)
- **Error Rate**: Failed forwards requiring attention (target: <5%)

## 🐛 Troubleshooting

**Rules not executing?**
1. Check master toggle is ON
2. Verify rule is active and enabled
3. Confirm criteria match (product + zip)

**High failure rate?**
1. Check partner webhook URLs are correct
2. Verify partner webhooks are online
3. Review HTTP error codes in logs

**Duplicate forwarding?**
- Review rules for overlapping criteria
- Adjust priorities or disable redundant rules

## 💡 Best Practices

1. **Start Specific** - Begin with narrow criteria and expand
2. **Use Priorities** - Organize rules logically (1-10 premium, 11-20 standard, 21+ backup)
3. **Test First** - Always test with disabled rule before going live
4. **Monitor Regularly** - Review logs weekly for issues
5. **Keep It Simple** - Avoid overly complex rule sets

## 📞 Support

For questions or issues:
1. Review full documentation: [`LEAD_FORWARDING_SYSTEM.md`](./LEAD_FORWARDING_SYSTEM.md)
2. Check troubleshooting section
3. Review Cloudflare Workers logs: `wrangler tail --remote`
4. Contact development team

---

**Version:** 1.0.0
**Last Updated:** October 30, 2025
