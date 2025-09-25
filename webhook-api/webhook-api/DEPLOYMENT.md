# Convio Leads Webhook API - Deployment Guide

This guide covers deploying the Webhook API to Cloudflare Workers.

## Prerequisites

1. **Wrangler CLI** - Already installed and authenticated
2. **Cloudflare Account** - Active account with Workers enabled
3. **Domain** (Optional) - For custom domain routing

## Quick Start

```bash
# Install dependencies
npm install

# Generate TypeScript types
npm run cf-typegen

# Start development server
npm run dev

# Deploy to Cloudflare Workers
npm run deploy
```

## Environment Setup

### 1. Set Webhook Secret (Required for Production)

```bash
# Set the webhook secret for signature validation
wrangler secret put WEBHOOK_SECRET
# Enter a strong, randomly generated secret when prompted
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your specific values.

## Deployment Commands

```bash
# Development deployment
npm run deploy

# Staging deployment (requires staging environment config)
npm run deploy:staging

# Production deployment (requires production environment config)
npm run deploy:production
```

## Webhook Endpoints

After deployment, your webhook API will be available at:

```
https://convio-leads-webhook-api.your-subdomain.workers.dev
```

### Available Endpoints

1. **Health Check**: `GET /health`
2. **Webhook List**: `GET /webhook`
3. **Specific Webhook Health**: `GET /webhook/{webhookId}`
4. **Receive Lead Data**: `POST /webhook/{webhookId}`

### Configured Webhooks

- `ws_cal_solar_001` - Solar Leads - California
- `ws_tx_hvac_002` - HVAC Leads - Texas
- `ws_fl_ins_003` - Insurance - Florida

### Example URLs

```
GET  https://your-domain/webhook/ws_cal_solar_001
POST https://your-domain/webhook/ws_cal_solar_001
GET  https://your-domain/webhook/ws_tx_hvac_002
POST https://your-domain/webhook/ws_tx_hvac_002
GET  https://your-domain/webhook/ws_fl_ins_003
POST https://your-domain/webhook/ws_fl_ins_003
```

## Custom Domain Setup (Optional)

### 1. Add Domain to Cloudflare

Ensure your domain (`leadmanager.com`) is managed by Cloudflare.

### 2. Update Wrangler Configuration

Edit `wrangler.jsonc` and uncomment the routes section:

```json
"routes": [
  {
    "pattern": "api.leadmanager.com/webhook/*",
    "zone_name": "leadmanager.com"
  }
]
```

### 3. Deploy with Custom Domain

```bash
npm run deploy:production
```

## Monitoring and Logging

### View Real-time Logs

```bash
# Development logs
npm run logs

# Production logs
npm run logs:production
```

### Monitor Performance

Visit the Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select your worker
3. View Analytics tab for:
   - Request volume
   - Error rates
   - Response times
   - Geographic distribution

## Security Configuration

### 1. Webhook Signature Validation

The API supports webhook signature validation using HMAC-SHA256:

```bash
# Set the webhook secret
wrangler secret put WEBHOOK_SECRET
```

### 2. Rate Limiting

Built-in rate limiting (100 requests/minute per IP) is enabled by default.

### 3. CORS Configuration

CORS is configured for specific domains. Update in `src/index.ts`:

```typescript
origin: ['https://leadmanager.com', 'https://api.leadmanager.com']
```

## Testing the API

### 1. Health Check

```bash
curl https://your-worker-url.workers.dev/health
```

### 2. Webhook Health Check

```bash
curl https://your-worker-url.workers.dev/webhook/ws_cal_solar_001
```

### 3. Send Test Lead

```bash
curl -X POST https://your-worker-url.workers.dev/webhook/ws_cal_solar_001 \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=your-signature" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "555-123-4567",
    "state": "CA",
    "monthlyElectricBill": 150,
    "propertyType": "single-family"
  }'
```

## Troubleshooting

### Common Issues

1. **Route Conflicts**: Ensure no conflicting routes in Cloudflare
2. **CORS Errors**: Check origin configuration in CORS middleware
3. **Signature Validation**: Ensure WEBHOOK_SECRET is set correctly
4. **Rate Limiting**: Check rate limit headers in responses

### Debug Mode

Enable detailed logging by setting:

```bash
wrangler secret put LOG_LEVEL
# Enter: debug
```

### Log Analysis

```bash
# Tail logs with filtering
wrangler tail --format=pretty | grep "ERROR"
```

## Performance Optimization

### 1. Smart Placement

Smart placement is enabled in `wrangler.jsonc` for optimal performance.

### 2. Caching Strategy

Consider implementing KV storage for frequently accessed data:

```bash
# Create KV namespace
wrangler kv:namespace create "LEADS_CACHE"
```

### 3. Database Integration

For persistent storage, set up D1 database:

```bash
# Create D1 database
wrangler d1 create convio-leads
```

## Next Steps

1. **Database Integration**: Set up D1 for lead storage
2. **Queue Processing**: Implement Cloudflare Queues for async processing
3. **Analytics**: Set up Analytics Engine for metrics
4. **Notifications**: Integrate with Slack/email for lead alerts
5. **CRM Integration**: Connect to your existing CRM system

## Support

For issues or questions:
1. Check Cloudflare Workers documentation
2. Review application logs
3. Monitor Cloudflare Dashboard analytics
4. Check GitHub issues or create new ones