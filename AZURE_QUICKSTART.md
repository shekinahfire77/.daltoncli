# Azure OpenAI Quick Start

## For Your Specific Setup

Based on your requirements, here's how to configure dalton-cli for your Azure OpenAI endpoint:

### Endpoint Details:
- **Azure Endpoint**: https://miran-mgvptpvr-eastus2.cognitiveservices.azure.com/
- **Deployment Name**: gpt-5-nano
- **API Version**: 2024-12-01-preview

### Configuration Commands:

```bash
# 1. Set your Azure API key
dalton-cli configure ai set openai api_key YOUR_AZURE_API_KEY

# 2. Set the Azure endpoint
dalton-cli configure ai set openai api_endpoint https://miran-mgvptpvr-eastus2.cognitiveservices.azure.com/

# 3. Set the deployment name
dalton-cli configure ai set openai deployment_name gpt-5-nano

# 4. Set the API version
dalton-cli configure ai set openai api_version 2024-12-01-preview
```

### Verification:

After running these commands, verify your configuration:

```bash
# View your configuration
dalton-cli configure ai get openai api_endpoint
dalton-cli configure ai get openai deployment_name
dalton-cli configure ai get openai api_version
```

### Start Using:

```bash
dalton-cli chat
```

That's it! The provider will automatically detect the Azure endpoint and configure everything properly.

## What Changed?

The OpenAI provider now:

1. **Auto-detects Azure endpoints** - Checks if `api_endpoint` contains `.openai.azure.com` or `.cognitiveservices.azure.com`
2. **Configures Azure authentication** - Sets proper headers and query parameters
3. **Uses deployment names** - When Azure is detected, uses `deployment_name` instead of model parameter
4. **Includes API version** - Adds `api-version` query parameter to all requests

## Technical Details

### Azure Detection Logic:
The provider checks if the endpoint URL contains:
- `.openai.azure.com` OR
- `.cognitiveservices.azure.com`

### Azure Configuration:
When Azure is detected, the OpenAI SDK is configured with:
```typescript
{
  apiKey: providerConfig.api_key,
  baseURL: baseURL,
  defaultQuery: { 'api-version': apiVersion },
  defaultHeaders: { 'api-key': providerConfig.api_key },
  timeout: apiTimeouts.default,
}
```

### Model/Deployment Name:
- **Standard OpenAI**: Uses the `model` parameter as-is
- **Azure OpenAI**: Uses `deployment_name` if configured, falls back to `model` parameter

## Complete File: openai_provider.ts

The key changes in `C:\Users\deadm\Desktop\.daltoncli\src\providers\openai_provider.ts`:

1. **Added Azure-specific config fields** (lines 16-22):
   ```typescript
   interface ProviderConfig {
     api_key?: string;
     api_endpoint?: string;
     deployment_name?: string;  // Azure-specific
     api_version?: string;       // Azure-specific
     [key: string]: unknown;
   }
   ```

2. **Added Azure detection state** (lines 24-29):
   ```typescript
   class OpenAIProvider {
     private isAzure: boolean = false;
     private azureDeploymentName?: string;
     // ... other fields
   }
   ```

3. **Added Azure detection and configuration** (lines 66-105):
   - Detects Azure endpoints
   - Configures SDK with Azure-specific settings
   - Stores deployment name for later use

4. **Uses deployment name for Azure** (lines 231-234):
   - Checks if Azure and deployment name is set
   - Uses deployment name instead of model parameter

## Need Help?

See the full documentation in `AZURE_OPENAI_SETUP.md` for:
- Detailed configuration steps
- Troubleshooting guide
- Security best practices
- Advanced usage scenarios
