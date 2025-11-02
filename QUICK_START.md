# daltoncli Quick Start Guide

## Files Created

### Configuration Files
- **config.json** - Main configuration file with all AI providers and MCP settings
- **config.types.ts** - TypeScript interfaces and type guards
- **CONFIG_VALIDATION_REPORT.md** - Detailed validation and setup guide
- **.env.example** - Template for environment variables

## Quick Setup (5 minutes)

### 1. Copy Environment Template
```bash
cp .env.example .env
```

### 2. Add Your API Keys
Edit `.env` and add your actual API keys:
```bash
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
MISTRAL_API_KEY=...
```

### 3. Verify Configuration
```bash
# The config.json is already validated and ready to use
```

## Configuration Structure

### AI Providers
The config includes 5 major providers:

| Provider | Status | Default Model | Models |
|----------|--------|---------------|--------|
| OpenAI | Enabled | gpt-4o-mini | 3 |
| Google | Enabled | gemini-2.0-flash | 4 |
| Mistral | Enabled | mistral-large-latest | 3 |
| Azure | Disabled | gpt-4-deployment | 2 |
| Groq | Disabled | mixtral-8x7b-32768 | 3 |

### Enable a Provider
Set `enabled: true` in config.json and ensure the API key environment variable is set.

### Disable a Provider
Set `enabled: false` in config.json.

## Common Tasks

### Switch Default Model for OpenAI
```json
{
  "openai": {
    "default_model": "gpt-4o"  // Changed from gpt-4o-mini
  }
}
```

### Add a Custom MCP Server
```json
{
  "mcp_integrations": {
    "servers": [
      {
        "name": "my-custom-server",
        "enabled": true,
        "command": "node",
        "args": ["/path/to/server.js"],
        "timeout_seconds": 30
      }
    ]
  }
}
```

### Change Timeout
```json
{
  "runtime_settings": {
    "request_timeout_seconds": 120  // Increase from 60
  }
}
```

### Adjust Fallback Order
```json
{
  "fallback_strategy": {
    "fallback_chain": [
      "google",
      "openai",
      "mistral"
    ]
  }
}
```

## Environment Variables Required

| Variable | Provider | Link |
|----------|----------|------|
| OPENAI_API_KEY | OpenAI | https://platform.openai.com/api-keys |
| GOOGLE_API_KEY | Google | https://aistudio.google.com/app/apikey |
| MISTRAL_API_KEY | Mistral | https://console.mistral.ai/api-keys |
| AZURE_OPENAI_API_KEY | Azure | Azure Portal |
| GROQ_API_KEY | Groq | https://console.groq.com/keys |

## TypeScript Usage

### Import Types
```typescript
import {
  DaltoncliConfig,
  isValidProvider,
  getDefaultModel,
  getAvailableModels
} from './config.types';

const config: DaltoncliConfig = require('./config.json');
```

### Check Provider Status
```typescript
import { isConfigEnabled } from './config.types';

if (isConfigEnabled(config, 'openai')) {
  // OpenAI is enabled
}
```

### Get Available Models
```typescript
import { getAvailableModels } from './config.types';

const models = getAvailableModels(config, 'google');
// Returns: [{ id: 'gemini-2.0-flash', ... }, ...]
```

### Get Default Model
```typescript
import { getDefaultModel } from './config.types';

const model = getDefaultModel(config, 'openai');
// Returns: 'gpt-4o-mini'
```

## Performance Settings

### For High-Throughput
```json
{
  "runtime_settings": {
    "max_concurrent_requests": 50,
    "cache_ttl_seconds": 1800,
    "request_timeout_seconds": 120
  }
}
```

### For Low-Latency
```json
{
  "runtime_settings": {
    "max_concurrent_requests": 5,
    "cache_ttl_seconds": 300,
    "request_timeout_seconds": 30
  }
}
```

### For Development
```json
{
  "runtime_settings": {
    "environment": "development",
    "debug": true,
    "log_level": "debug"
  }
}
```

## Troubleshooting

### Check if Config is Valid JSON
```bash
node -e "JSON.parse(require('fs').readFileSync('./config.json', 'utf8')); console.log('Valid!');"
```

### Test API Connection
```javascript
const config = require('./config.json');
const key = process.env.OPENAI_API_KEY;

if (!key) {
  console.error('OPENAI_API_KEY not set');
} else {
  console.log('OpenAI API key is configured');
}
```

### View Current Configuration
```bash
# Pretty print config
node -e "console.log(JSON.stringify(require('./config.json'), null, 2))"
```

## Cost Optimization

### Use Cheaper Models
- OpenAI: Switch from gpt-4o to gpt-4o-mini
- Google: Switch from gemini-1.5-pro to gemini-1.5-flash
- Mistral: Use mistral-small-latest for simple tasks

### Monitor Spending
Track tokens per model:
```
gpt-4o-mini: 0.0003 per 1K input, 0.0012 per 1K output
gemini-1.5-flash: 0.000375 per 1K input, 0.0015 per 1K output
mistral-small-latest: 0.00014 per 1K input, 0.00042 per 1K output
```

## Next Steps

1. Read **CONFIG_VALIDATION_REPORT.md** for detailed setup
2. Review **config.types.ts** for TypeScript integration
3. Copy **.env.example** to **.env** and add your API keys
4. Start using daltoncli with the configured providers

## Support

- Documentation: https://docs.daltoncli.io/configuration
- Config Last Updated: 2025-10-22
- Config Version: 1.0.0
