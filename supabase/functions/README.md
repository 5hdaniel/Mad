# Supabase Edge Functions

Edge Functions run on Deno Deploy and provide secure server-side functionality for the Mad application.

## Available Functions

### `validate-address`
Validates property addresses using Google Maps Geocoding API.

**Features:**
- Secure API key storage (Google Maps API key never exposed to client)
- Address validation and parsing
- Washington state enforcement
- Rate limiting per subscription tier
- API usage tracking

**Request:**
```json
{
  "address": "123 Main St, Seattle, WA 98101",
  "userId": "uuid-here"
}
```

**Response:**
```json
{
  "valid": true,
  "formatted": "123 Main St, Seattle, WA 98101, USA",
  "components": {
    "street": "123 Main St",
    "city": "Seattle",
    "state": "WA",
    "zip": "98101"
  },
  "coordinates": {
    "lat": 47.6062,
    "lng": -122.3321
  }
}
```

## Deployment

### Prerequisites

1. **Install Supabase CLI:**
   ```bash
   # macOS
   brew install supabase/tap/supabase

   # Or npm
   npm install -g supabase
   ```

2. **Login to Supabase:**
   ```bash
   supabase login
   ```

3. **Link to your project:**
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   (Find your project ref in Supabase Dashboard > Settings > General)

### Set Secrets

Before deploying, set the Google Maps API key as a secret:

```bash
supabase secrets set GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
```

Verify secrets are set:
```bash
supabase secrets list
```

### Deploy Functions

#### Deploy All Functions
```bash
supabase functions deploy
```

#### Deploy Specific Function
```bash
supabase functions deploy validate-address
```

#### Deploy with Debug Output
```bash
supabase functions deploy validate-address --debug
```

## Local Development

### Serve Functions Locally

1. **Start Supabase locally:**
   ```bash
   supabase start
   ```

2. **Serve a specific function:**
   ```bash
   supabase functions serve validate-address
   ```

3. **Set local secrets:**
   Create a `.env` file in the function directory:
   ```bash
   echo "GOOGLE_MAPS_API_KEY=your-key" > supabase/functions/.env
   ```

### Test Function Locally

```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/validate-address' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"address":"123 Main St, Seattle, WA","userId":"test-user-id"}'
```

## Monitoring

### View Logs

```bash
# Real-time logs
supabase functions logs validate-address --tail

# Historical logs
supabase functions logs validate-address
```

### Check Function Status

In Supabase Dashboard:
1. Go to "Edge Functions"
2. Click on function name
3. View metrics, logs, and invocations

## Rate Limits

| Tier | Address Validations/Month |
|------|---------------------------|
| Free | 10 |
| Pro | 100 |
| Enterprise | 1,000 |

Limits are enforced per user per calendar month.

## Cost Estimates

- **Google Maps Geocoding API**: $5 per 1,000 requests (first $200/month free)
- **Supabase Edge Functions**: 500K invocations/month free, then $2 per 1M

## Troubleshooting

### Function Not Found
- Verify deployment: `supabase functions list`
- Check project link: `supabase projects list`

### 401 Unauthorized
- Check Authorization header includes valid Supabase key
- Verify RLS policies allow access

### 500 Internal Server Error
- Check function logs: `supabase functions logs validate-address`
- Verify secrets are set: `supabase secrets list`

### Google Maps API Errors
- Verify API key is set correctly
- Check API is enabled in Google Cloud Console
- Ensure billing is enabled (required even for free tier)

## Future Functions

Planned Edge Functions:
- `address-autocomplete` - Google Places autocomplete
- `send-export-email` - Email exports via SendGrid
- `analyze-communication` - AI-powered data extraction (OpenAI)
