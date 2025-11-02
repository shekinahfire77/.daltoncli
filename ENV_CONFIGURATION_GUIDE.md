# Environment Configuration Guide for Dalton CLI

## Overview

This guide documents all environment variables used by Dalton CLI and provides instructions for proper configuration across different environments (local development, staging, production).

## Quick Start

1. Copy the template file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your API keys:
   ```bash
   # Linux/macOS
   nano .env

   # Windows
   code .env
   ```

3. Ensure `.env` is in your `.gitignore` (already configured):
   ```bash
   git status .env  # Should show as ignored
   ```

## Environment Variables by Category

### API Provider Keys

These are the primary authentication credentials for AI services. At least one provider should be configured.

| Variable | Required | Provider | Format | Example |
|----------|----------|----------|--------|---------|
| `OPENAI_API_KEY` | Yes (for OpenAI) | OpenAI | String starting with `sk-` | `sk-proj-abc...` |
| `GOOGLE_API_KEY` | No | Google Generative AI | Alphanumeric string | `AIzaSyD1234...` |
| `MISTRAL_API_KEY` | No | Mistral AI | Alphanumeric string | `abc123def456...` |
| `AZURE_OPENAI_ENDPOINT` | No | Azure OpenAI | Full URL with trailing slash | `https://myorg.openai.azure.com/` |
| `AZURE_OPENAI_API_KEY` | No | Azure OpenAI | 32-char alphanumeric | `a1b2c3d4...` |

### Chat & Session Configuration

Control conversation behavior and session management.

| Variable | Default | Type | Range | Purpose |
|----------|---------|------|-------|---------|
| `DALTON_CHAT_HISTORY_LIMIT` | 10 | Integer | 1-1000 | Messages kept in memory for context |
| `DALTON_MAX_SESSION_SIZE` | 100 | Integer | > history limit | Messages before session rotation |
| `DALTON_MAX_HISTORY_UPPER_BOUND` | 1000 | Integer | >= lower bound | Maximum user-configurable history |
| `DALTON_MAX_HISTORY_LOWER_BOUND` | 1 | Integer | >= 1 | Minimum user-configurable history |

### File Operation Limits

Prevent excessive memory usage and provide warnings for large files.

| Variable | Default | Type | Purpose |
|----------|---------|------|---------|
| `DALTON_MAX_READ_BYTES` | 50000 | Integer (bytes) | Max file size to read into memory |
| `DALTON_FILE_WARNING_THRESHOLD` | 50000 | Integer (bytes) | File size triggering warning |

### Shell Execution Configuration

Control shell command execution behavior and timeouts.

| Variable | Default | Type | Min/Max | Purpose |
|----------|---------|------|---------|---------|
| `DALTON_SHELL_TIMEOUT` | 15000 | Integer (ms) | >= 1000 | Max time to wait for commands |
| `DALTON_MAX_COMMAND_LENGTH` | 10000 | Integer (chars) | >= 1 | Prevent excessively long commands |

### API Timeout Configuration

Fine-tune API request timeout behavior.

| Variable | Default | Type | Min | Max | Purpose |
|----------|---------|------|-----|-----|---------|
| `DALTON_API_TIMEOUT_DEFAULT` | 30000 | Integer (ms) | 1000 | 600000 | Standard API call timeout |
| `DALTON_API_TIMEOUT_MIN` | 1000 | Integer (ms) | - | - | Minimum allowed timeout |
| `DALTON_API_TIMEOUT_MAX` | 600000 | Integer (ms) | - | - | Maximum allowed timeout |

### Retry Configuration

Control automatic retry behavior for failed API calls with exponential backoff.

| Variable | Default | Type | Constraints | Purpose |
|----------|---------|------|-------------|---------|
| `DALTON_MAX_RETRIES` | 3 | Integer | >= 0 | Number of retry attempts |
| `DALTON_RETRY_INITIAL_DELAY` | 1000 | Integer (ms) | >= 0 | Starting delay for backoff |
| `DALTON_RETRY_MAX_DELAY` | 10000 | Integer (ms) | >= initial | Max backoff delay |
| `DALTON_RETRY_BACKOFF_MULTIPLIER` | 2.0 | Float | > 1.0 | Exponential backoff factor |
| `DALTON_RETRY_JITTER_FACTOR` | 0.1 | Float | 0.0-1.0 | Randomness for load distribution |

### Policy Engine Configuration

Control policy validation and enforcement.

| Variable | Default | Type | Purpose |
|----------|---------|------|---------|
| `DALTON_CODE_BLOCK_THRESHOLD` | 10 | Integer | Code blocks for policy evaluation |

### System Configuration

System-level variables (usually auto-detected).

| Variable | Auto-Detected | Platform | Purpose |
|----------|---------------|----------|---------|
| `SHELL` | Yes | Linux/macOS | Shell executable path |

## Setup by Environment

### Local Development

Create `.env.local` for local overrides:

```bash
# .env.local - Local development overrides
OPENAI_API_KEY="sk-your-test-key"

# Use more verbose settings for debugging
DALTON_API_TIMEOUT_DEFAULT="60000"
DALTON_MAX_RETRIES="5"
```

For local development with extended history:
```bash
DALTON_CHAT_HISTORY_LIMIT="50"
DALTON_MAX_SESSION_SIZE="200"
```

### Staging Environment

```bash
# .env.staging - Staging configuration
OPENAI_API_KEY="sk-staging-key-here"
GOOGLE_API_KEY="staging-google-key"

# Standard timeouts with retries
DALTON_API_TIMEOUT_DEFAULT="30000"
DALTON_MAX_RETRIES="3"

# Conservative limits
DALTON_CHAT_HISTORY_LIMIT="20"
DALTON_MAX_SESSION_SIZE="100"
```

### Production Environment

```bash
# .env.production - Production configuration
OPENAI_API_KEY="sk-production-key-here"

# Shorter timeouts in production
DALTON_API_TIMEOUT_DEFAULT="20000"
DALTON_API_TIMEOUT_MIN="500"

# Aggressive retry strategy
DALTON_MAX_RETRIES="5"
DALTON_RETRY_BACKOFF_MULTIPLIER="1.5"
DALTON_RETRY_JITTER_FACTOR="0.3"

# Conservative resource limits
DALTON_CHAT_HISTORY_LIMIT="10"
DALTON_MAX_SESSION_SIZE="50"
DALTON_MAX_READ_BYTES="25000"
```

## Security Best Practices

### 1. Never Commit Secrets

```bash
# Verify .env is in .gitignore
cat .gitignore | grep "^\.env"

# Check git is not tracking .env
git ls-files | grep "^\.env$"  # Should return nothing
```

### 2. Store Secrets Securely

Dalton CLI supports OS keychain storage for sensitive values:

```bash
# Add a secret to OS keychain
dalton configure secret set OPENAI_API_KEY "sk-your-key"

# The application will check .env first, then fallback to keychain
```

### 3. API Key Format Validation

- **OpenAI**: Always starts with `sk-` (e.g., `sk-proj-...`)
- **Google**: Typically 39 characters starting with `AIzaSy`
- **Mistral**: Alphanumeric, usually 32-64 characters
- **Azure**: Two separate credentials - endpoint URL and API key

### 4. Environment Variable Prefixes

All Dalton-specific variables use the `DALTON_` prefix to avoid conflicts:

```bash
# Good - Dalton-specific
DALTON_CHAT_HISTORY_LIMIT="20"

# Standard - Generic AI provider keys
OPENAI_API_KEY="sk-..."
GOOGLE_API_KEY="..."
```

### 5. Credential Rotation

When rotating API keys:

1. Update `.env` with new key
2. Test thoroughly
3. Revoke old key in provider console
4. Update any stored secrets in OS keychain

## Validation and Testing

### Validate Configuration

```bash
# Check if all required variables are set
node -e "
const env = process.env;
const required = ['OPENAI_API_KEY', 'GOOGLE_API_KEY', 'MISTRAL_API_KEY', 'AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY'];
const missing = required.filter(v => !env[v]);
console.log(missing.length === 0 ? 'All required variables set' : 'Missing: ' + missing.join(', '));
"
```

### Test API Connection

```bash
# Once .env is configured, test your setup
npm run dev -- chat "Hello"
```

## Troubleshooting

### Issue: "API key not found"

1. Check `.env` exists: `ls -la .env`
2. Verify key is set: `grep OPENAI_API_KEY .env`
3. Check key format: OpenAI keys start with `sk-`
4. Ensure no extra whitespace in value

### Issue: "DALTON_CHAT_HISTORY_LIMIT must be a number"

The `.env` values are parsed as strings. Numeric variables are automatically converted:
- Valid: `DALTON_CHAT_HISTORY_LIMIT="10"`
- Invalid: `DALTON_CHAT_HISTORY_LIMIT=10` (missing quotes)

### Issue: "Timeout waiting for API response"

Increase the timeout:
```bash
DALTON_API_TIMEOUT_DEFAULT="60000"  # 60 seconds
```

### Issue: "Too many API errors, stopping"

Increase retries:
```bash
DALTON_MAX_RETRIES="5"
DALTON_RETRY_BACKOFF_MULTIPLIER="1.5"
```

## Advanced Configuration

### Custom Limits for Specific Use Cases

**High-volume processing:**
```bash
DALTON_CHAT_HISTORY_LIMIT="100"
DALTON_MAX_SESSION_SIZE="500"
DALTON_MAX_READ_BYTES="100000"
DALTON_API_TIMEOUT_DEFAULT="60000"
```

**Low-latency requirements:**
```bash
DALTON_CHAT_HISTORY_LIMIT="5"
DALTON_API_TIMEOUT_DEFAULT="10000"
DALTON_MAX_RETRIES="2"
DALTON_SHELL_TIMEOUT="5000"
```

**Development with debugging:**
```bash
DALTON_API_TIMEOUT_DEFAULT="120000"
DALTON_MAX_RETRIES="5"
DALTON_CHAT_HISTORY_LIMIT="50"
```

## File Structure

```
.daltoncli/
├── .env                           # Actual config (NEVER commit)
├── .env.example                   # Template with all variables
├── .env.local                     # Local development overrides
├── .gitignore                     # Prevents committing secrets
└── ENV_CONFIGURATION_GUIDE.md     # This file
```

## Loading Order

1. `.env` (main configuration)
2. `.env.local` (local development overrides) - if using dotenv with multiple file support
3. OS keychain (for secrets registered via CLI)
4. Built-in defaults (see values in code)

The first value found is used; subsequent sources are skipped.

## Related Files

- **Configuration Reference**: `src/core/app_limits.ts` - Default values and limit definitions
- **Secret Manager**: `src/core/secret_manager.ts` - OS keychain integration
- **Config Management**: `src/core/config.ts` - Configuration file handling
- **Provider Integration**: `src/core/api_client.ts` - API authentication

## Support and Maintenance

- For issues with environment setup, check the Troubleshooting section
- For new providers, add variables following the `PROVIDER_API_KEY` pattern
- For new limits, prefix with `DALTON_` and document in this guide
- Keep `.env.example` synchronized with actual usage in code

## Quick Reference: All Environment Variables

```bash
# API Keys (Required - at least one)
OPENAI_API_KEY="sk-..."
GOOGLE_API_KEY="AIzaSy..."
MISTRAL_API_KEY="..."
AZURE_OPENAI_ENDPOINT="https://..."
AZURE_OPENAI_API_KEY="..."

# Chat (Tuning)
DALTON_CHAT_HISTORY_LIMIT="10"
DALTON_MAX_SESSION_SIZE="100"
DALTON_MAX_HISTORY_UPPER_BOUND="1000"
DALTON_MAX_HISTORY_LOWER_BOUND="1"

# Files (Limits)
DALTON_MAX_READ_BYTES="50000"
DALTON_FILE_WARNING_THRESHOLD="50000"

# Shell (Execution)
DALTON_SHELL_TIMEOUT="15000"
DALTON_MAX_COMMAND_LENGTH="10000"

# API (Timeouts)
DALTON_API_TIMEOUT_DEFAULT="30000"
DALTON_API_TIMEOUT_MIN="1000"
DALTON_API_TIMEOUT_MAX="600000"

# Retry (Resilience)
DALTON_MAX_RETRIES="3"
DALTON_RETRY_INITIAL_DELAY="1000"
DALTON_RETRY_MAX_DELAY="10000"
DALTON_RETRY_BACKOFF_MULTIPLIER="2"
DALTON_RETRY_JITTER_FACTOR="0.1"

# Policy (Enforcement)
DALTON_CODE_BLOCK_THRESHOLD="10"
```

---

Last Updated: 2025-10-22
Guide Version: 1.0
