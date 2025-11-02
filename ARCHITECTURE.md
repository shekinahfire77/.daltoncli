# AI Provider Architecture

## Class Hierarchy

```
BaseAIProvider (Abstract Base Class)
│
├─ Protected Constructor(providerName: string)
├─ Protected Methods:
│  ├─ loadAndValidateConfig()
│  ├─ validateProviderConfig()
│  ├─ handleInitializationError()
│  ├─ validateTimeout()
│  ├─ validateMessagesStructure()
│  ├─ validateOptionsStructure()
│  ├─ wrapValidationError()
│  └─ cleanup() / destroy()
│
└─ Subclasses:
   │
   ├─ OpenAIProvider
   │  ├─ Constructor(providerName: string)
   │  ├─ _createClient(): OpenAI
   │  │  └─ Uses: loadAndValidateConfig(), validateProviderConfig()
   │  └─ Provider-Specific:
   │     ├─ Azure deployment name handling
   │     ├─ API version configuration
   │     └─ Custom timeout signal creation
   │
   ├─ GeminiProvider
   │  ├─ Constructor()
   │  ├─ _createClient(): GoogleGenerativeAI
   │  │  └─ Uses: loadAndValidateConfig(), validateProviderConfig()
   │  └─ Provider-Specific:
   │     ├─ Tool conversion to Gemini format
   │     ├─ Safety settings configuration
   │     └─ Stream adaptation to OpenAI format
   │
   └─ MistralProvider
      ├─ Constructor()
      ├─ _createClient(): Mistral
      │  └─ Uses: loadAndValidateConfig(), validateProviderConfig()
      └─ Provider-Specific:
         ├─ Abort controller management
         ├─ Stream timeout wrapping
         └─ Request tracking
```

## Data Flow: Provider Initialization

```
Provider Constructor
    │
    ├─> super(providerName)
    │    └─> BaseAIProvider constructor
    │         └─> Sets this.providerName
    │
    └─> _createClient()
         │
         ├─> loadAndValidateConfig()
         │    ├─> Calls readConfig()
         │    └─> Returns: AppConfig
         │
         ├─> validateProviderConfig(config)
         │    ├─> Validates provider exists in config
         │    ├─> Validates API key exists and is non-empty
         │    └─> Returns: ProviderConfig
         │
         ├─> [Provider-specific client creation]
         │    ├─ OpenAI: Handle Azure or standard
         │    ├─ Gemini: Create GoogleGenerativeAI instance
         │    └─ Mistral: Create Mistral instance
         │
         └─> [Error handling]
              └─> handleInitializationError(error)
                  └─> Throws with provider context
```

## Configuration Validation Flow

```
readConfig() from core/config.ts
    │
    ├─> Load ~/.dalton-cli/config.json
    ├─> Parse and validate with Zod schema
    └─> Return: AppConfig
         │
         ├─ ai_providers?: Record<string, ProviderConfig>
         │  ├─ openai?
         │  │  ├─ api_key: string
         │  │  ├─ api_endpoint?: string (Azure endpoint)
         │  │  ├─ deployment_name?: string (Azure deployment)
         │  │  └─ api_version?: string (Azure API version)
         │  │
         │  ├─ gemini?
         │  │  └─ api_key: string
         │  │
         │  └─ mistral?
         │     └─ api_key: string
         │
         └─ mcp_integrations?: Record<string, unknown>
```

## Error Handling Strategy

```
Initialize Provider
    │
    ├─> Config Read Error
    │    └─> loadAndValidateConfig()
    │         └─> throw: "Failed to read configuration for {provider}: {details}"
    │
    ├─> Missing Config
    │    └─> loadAndValidateConfig()
    │         └─> throw: "Configuration is missing for {provider}"
    │
    ├─> Provider Not Found
    │    └─> validateProviderConfig()
    │         └─> throw: "{provider} provider configuration not found. Use 'dalton-cli configure ai set {provider} api_key <key>'"
    │
    ├─> Missing/Invalid API Key
    │    └─> validateProviderConfig()
    │         └─> throw: "{provider} API key not configured. Use 'dalton-cli configure ai set {provider} api_key <key>'"
    │
    ├─> Client Initialization Error
    │    └─> handleInitializationError()
    │         └─> throw: "Failed to initialize {provider} client: {details}"
    │
    └─> [Provider-specific errors]
         └─> Caught and re-thrown with context
```

## Timeout Validation Hierarchy

```
OpenAIProvider.normalizeTimeout(timeout?: number)
    │
    └─> this.validateTimeout()
         │
         └─> BaseAIProvider.validateTimeout()
              │
              ├─> if (timeout === undefined) return defaultMs
              ├─> if (timeout < minMs) throw Error
              ├─> if (timeout > maxMs) throw Error
              └─> return timeout
                   
Provider-Specific Bounds:
├─ OpenAI: Uses getApiTimeouts() (typically 2s - 10min)
├─ Gemini: 1s - 10min (hardcoded)
└─ Mistral: Uses getApiTimeouts() (typically 2s - 10min)
```

## Defensive Programming Patterns

### 1. Configuration Validation
```typescript
const config = this.loadAndValidateConfig(providerName);
// Error if: readConfig fails, config is null, provider not in config, API key missing
```

### 2. Type Safety
```typescript
const providerConfig = this.validateProviderConfig(config, providerName);
// Error if: Provider config is invalid type, API key not string or empty
```

### 3. Timeout Bounds
```typescript
const timeoutMs = this.validateTimeout(timeout, minMs, maxMs, defaultMs);
// Error if: timeout is not number, below min, above max
```

### 4. Error Context
```typescript
catch (error) {
  this.handleInitializationError(error, providerName);
  // Wraps error with provider context before throwing
}
```

## Extensibility Points

### For Future Providers

1. Create new class extending BaseAIProvider:
```typescript
class NewProvider extends BaseAIProvider {
  constructor() {
    super('newprovider');
    this.client = this._createClient();
  }

  private _createClient() {
    const config = this.loadAndValidateConfig(this.providerName);
    const providerConfig = this.validateProviderConfig(config, this.providerName);
    // Create client using providerConfig.api_key
  }
}
```

2. Inherit all validation methods
3. Override/extend methods as needed for provider-specific behavior
4. Maintain consistent error handling

### For New Validation

1. Timeout validation: Already in base class
2. Message validation: Partially in base (can extend)
3. Options validation: Partially in base (can extend)
4. Custom validation: Add to subclass, call base method first

## Testing Strategy

### Unit Tests for BaseAIProvider
- loadAndValidateConfig() with valid/invalid configs
- validateProviderConfig() with missing/invalid configs
- handleInitializationError() formats errors correctly
- validateTimeout() bounds checking
- validateMessagesStructure() array validation

### Integration Tests for Each Provider
- Successful initialization with valid config
- Error handling with missing config
- Error handling with missing API key
- Client creation works correctly
- Provider-specific features work (Azure, etc.)

### End-to-End Tests
- Provider can be instantiated
- getChatCompletion() works with valid input
- Timeout handling works
- Error messages are clear and helpful
