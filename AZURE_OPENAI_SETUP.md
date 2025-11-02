# Azure OpenAI Setup Guide

This guide explains how to configure the dalton-cli application to work with Azure OpenAI endpoints.

## Overview

The dalton-cli application now supports both standard OpenAI and Azure OpenAI endpoints. The provider automatically detects Azure endpoints and configures the SDK accordingly.

## Configuration

### Step 1: Set Your API Key

```bash
dalton-cli configure ai set openai api_key YOUR_AZURE_API_KEY
```

### Step 2: Set Your Azure Endpoint

```bash
dalton-cli configure ai set openai api_endpoint https://your-resource.openai.azure.com
```

Or for Cognitive Services endpoints:

```bash
dalton-cli configure ai set openai api_endpoint https://your-resource.cognitiveservices.azure.com
```

### Step 3: Set Your Deployment Name

Azure OpenAI uses deployment names instead of model names. Set your deployment name:

```bash
dalton-cli configure ai set openai deployment_name YOUR_DEPLOYMENT_NAME
```

For example:

```bash
dalton-cli configure ai set openai deployment_name gpt-5-nano
```

### Step 4: (Optional) Set API Version

By default, the provider uses API version `2024-12-01-preview`. If you need a different version:

```bash
dalton-cli configure ai set openai api_version 2024-12-01-preview
```

## Example Configuration

For the endpoint: `https://miran-mgvptpvr-eastus2.cognitiveservices.azure.com/`

```bash
# Set API key
dalton-cli configure ai set openai api_key your-azure-api-key-here

# Set Azure endpoint
dalton-cli configure ai set openai api_endpoint https://miran-mgvptpvr-eastus2.cognitiveservices.azure.com/

# Set deployment name
dalton-cli configure ai set openai deployment_name gpt-5-nano

# Set API version (optional, defaults to 2024-12-01-preview)
dalton-cli configure ai set openai api_version 2024-12-01-preview
```

## How It Works

The OpenAI provider automatically detects Azure endpoints by checking if the `api_endpoint` contains:
- `.openai.azure.com`
- `.cognitiveservices.azure.com`

When an Azure endpoint is detected:

1. **Authentication**: Uses the `api_key` for authentication with Azure
2. **API Version**: Includes the `api-version` query parameter in all requests
3. **Deployment Names**: Uses the `deployment_name` instead of model names
4. **Base URL**: Configures the SDK to use the Azure endpoint

## Configuration File

Your configuration is stored in `~/.dalton-cli/config.json`. After configuration, it should look like:

```json
{
  "ai_providers": {
    "openai": {
      "api_key": "your-azure-api-key",
      "api_endpoint": "https://miran-mgvptpvr-eastus2.cognitiveservices.azure.com/",
      "deployment_name": "gpt-5-nano",
      "api_version": "2024-12-01-preview"
    }
  }
}
```

## Usage

Once configured, use dalton-cli normally. The provider will automatically:
- Detect the Azure endpoint
- Use the deployment name instead of the model parameter
- Include proper Azure authentication headers
- Add the correct API version to requests

```bash
dalton-cli chat
```

## Switching Between OpenAI and Azure OpenAI

To switch between standard OpenAI and Azure OpenAI:

### Switch to Azure OpenAI:
```bash
dalton-cli configure ai set openai api_endpoint https://your-resource.cognitiveservices.azure.com/
dalton-cli configure ai set openai deployment_name your-deployment
```

### Switch back to Standard OpenAI:
```bash
dalton-cli configure ai unset openai api_endpoint
dalton-cli configure ai unset openai deployment_name
dalton-cli configure ai set openai api_key your-openai-api-key
```

## Troubleshooting

### Error: API key not configured
Make sure you've set your Azure API key:
```bash
dalton-cli configure ai set openai api_key YOUR_AZURE_API_KEY
```

### Error: Authentication failed
- Verify your API key is correct
- Check that your Azure resource is active
- Ensure you have the correct permissions

### Error: Deployment not found
- Verify the deployment name is correct
- Check that the deployment exists in your Azure OpenAI resource
- Ensure the deployment is in a "Succeeded" state

### Error: Invalid API version
- Check the API version is supported by your Azure OpenAI resource
- Default version is `2024-12-01-preview`
- Consult Azure OpenAI documentation for available API versions

## Advanced Configuration

### Multiple Providers

You can configure multiple providers (e.g., one for Azure, one for standard OpenAI):

```bash
# Configure Azure OpenAI as "openai"
dalton-cli configure ai set openai api_key AZURE_KEY
dalton-cli configure ai set openai api_endpoint https://your-resource.cognitiveservices.azure.com/
dalton-cli configure ai set openai deployment_name gpt-5-nano

# Configure standard OpenAI as "openai-standard"
dalton-cli configure ai set openai-standard api_key OPENAI_KEY
```

### Rate Limiting and Timeouts

The Azure OpenAI provider respects all timeout and retry configurations:
- Default timeout: 30 seconds
- Automatic retry with exponential backoff for rate limits
- Network error handling

## Security Best Practices

1. **Never commit API keys**: Your configuration file contains sensitive credentials
2. **Use environment-specific keys**: Different keys for development/production
3. **Rotate keys regularly**: Update API keys periodically
4. **Monitor usage**: Check Azure portal for usage and billing
5. **Restrict permissions**: Use Azure RBAC to limit access to OpenAI resources

## References

- [Azure OpenAI Service Documentation](https://learn.microsoft.com/azure/ai-services/openai/)
- [OpenAI SDK for Node.js](https://github.com/openai/openai-node)
- [Azure OpenAI REST API Reference](https://learn.microsoft.com/azure/ai-services/openai/reference)
