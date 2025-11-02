# Magic Numbers and Strings Consolidation - Change Documentation

## Overview
This document details the consolidation of hardcoded magic numbers and strings throughout the Dalton CLI codebase into centralized configuration files. This refactoring improves maintainability, consistency, and configurability.

## Files Created

### 1. `src/core/Constants.ts` (NEW)
**Purpose**: Centralized repository for all string constants and configuration values used throughout the application.

**Key Constants Defined**:

#### Azure OpenAI Integration
- `AZURE_PATTERNS`: Domain patterns for Azure endpoint detection
  - `OPENAI_AZURE_COM`: `.openai.azure.com`
  - `COGNITIVE_SERVICES_AZURE_COM`: `.cognitiveservices.azure.com`

- `AZURE_DEFAULTS`: Default values for Azure OpenAI configuration
  - `DEFAULT_API_VERSION`: `'2024-12-01-preview'` (previously hardcoded in openai_provider.ts:67)
  - `DEPLOYMENT_PATH`: `'/openai/deployments/'` (previously hardcoded in openai_provider.ts:74)
  - `API_VERSION_PARAM`: `'api-version'` (for query parameters)
  - `API_KEY_HEADER`: `'api-key'` (for HTTP headers)

#### Error Messages
- `ERROR_MESSAGES`: Comprehensive error message templates with placeholders
  - Configuration errors (CONFIG_READ_FAILURE, CONFIG_MISSING, PROVIDER_NOT_CONFIGURED, API_KEY_NOT_CONFIGURED)
  - Client initialization errors (CLIENT_INIT_FAILURE)
  - Timeout validation errors (INVALID_TIMEOUT_VALUE, TIMEOUT_TOO_SHORT, TIMEOUT_TOO_LONG)
  - Message validation errors (MESSAGES_NOT_ARRAY, MESSAGES_EMPTY, MESSAGE_AT_INDEX_INVALID, MESSAGE_MISSING_ROLE)
  - Options validation errors (OPTIONS_INVALID, MODEL_NOT_SPECIFIED, TOOLS_NOT_ARRAY, INVALID_TOOL_CHOICE)
  - Stream processing errors (STREAM_CHUNK_ERROR, UNKNOWN_ERROR_PROCESSING_CHUNK)
  - General error fallbacks

#### Additional Constants
- `DEFAULT_MODELS`: Provider-specific default model names
- `PROVIDER_NAMES`: Standardized provider name references
- `CONFIG_KEYS`: Configuration key constants
- `TOOL_CONSTANTS`: Tool-related constants (TOOL_CHOICE_NONE, TOOL_CHOICE_AUTO, VALID_TOOL_CHOICES)
- `CHAT_CONSTANTS`: Chat and session constants (message roles, session load messages)

#### Utility Functions
- `formatErrorMessage(template, values)`: Helper function to format error messages with placeholder replacement

---

## Files Modified

### 1. `src/core/app_limits.ts`
**Changes**: Added two new threshold constants to the ChatLimits interface

**Added to ChatLimits Interface**:
```typescript
/** Threshold for warning when loading sessions with many messages */
sessionLoadWarningThreshold: number;

/** Threshold for rotating chat history to prevent unbounded growth */
chatHistoryRotationThreshold: number;
```

**Added to DEFAULT_LIMITS**:
```typescript
sessionLoadWarningThreshold: parseInt(
  process.env.DALTON_SESSION_LOAD_WARNING_THRESHOLD || '100', 10
),
chatHistoryRotationThreshold: parseInt(
  process.env.DALTON_CHAT_HISTORY_ROTATION_THRESHOLD || '100', 10
),
```

**Added Validation**:
```typescript
if (limits.chat.sessionLoadWarningThreshold < 1) {
  throw new Error('Session load warning threshold must be at least 1');
}

if (limits.chat.chatHistoryRotationThreshold < 1) {
  throw new Error('Chat history rotation threshold must be at least 1');
}
```

**Why**: These thresholds were previously hardcoded as `100` in chat.ts (lines 1315, 1358), making them non-configurable. Now they can be overridden via environment variables.

---

### 2. `src/providers/gemini_provider.ts`
**Changes**: Replaced local timeout constants with centralized app_limits

**Before**:
```typescript
const DEFAULT_TIMEOUT_MS = 30000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 600000; // 10 minutes
```

**After**:
```typescript
import { getApiTimeouts } from '../core/app_limits';

// In normalizeTimeout method:
private normalizeTimeout(timeout?: number): number {
  const apiTimeouts = getApiTimeouts();
  return this.validateTimeout(timeout, apiTimeouts.min, apiTimeouts.max, apiTimeouts.default);
}
```

**Why**: These hardcoded timeout values (30000, 1000, 600000) are now centralized in app_limits.ts where they can be consistently configured across all providers.

---

### 3. `src/providers/openai_provider.ts`
**Changes**:
1. Replaced hardcoded Azure URL patterns and API version
2. Added Constants import for Azure configuration

**Before**:
```typescript
// Lines 48-49
baseURL.includes('.openai.azure.com') ||
baseURL.includes('.cognitiveservices.azure.com')

// Line 67
: '2024-12-01-preview'; // Default to latest stable version

// Line 74
azureBaseURL = `${endpoint}/openai/deployments/${this.azureDeploymentName}`;

// Lines 82-83
defaultQuery: { 'api-version': apiVersion },
defaultHeaders: { 'api-key': providerConfig.api_key },
```

**After**:
```typescript
import { AZURE_PATTERNS, AZURE_DEFAULTS } from '../core/Constants';

// Lines 48-50
baseURL.includes(AZURE_PATTERNS.OPENAI_AZURE_COM) ||
baseURL.includes(AZURE_PATTERNS.COGNITIVE_SERVICES_AZURE_COM)

// Line 68
: AZURE_DEFAULTS.DEFAULT_API_VERSION;

// Line 75
azureBaseURL = `${endpoint}${AZURE_DEFAULTS.DEPLOYMENT_PATH}${this.azureDeploymentName}`;

// Lines 83-84
defaultQuery: { [AZURE_DEFAULTS.API_VERSION_PARAM]: apiVersion },
defaultHeaders: { [AZURE_DEFAULTS.API_KEY_HEADER]: providerConfig.api_key },
```

**Why**: Azure-specific configuration is now centralized and easily updatable. API version can be changed globally without touching provider code.

---

### 4. `src/commands/chat.ts`
**Changes**: Replaced hardcoded message count thresholds with configurable limits

**Before** (Lines 1315, 1358):
```typescript
if (messageCount > 100) {
  // ...
  console.log(chalk.cyan('Session load cancelled.'));
}
```

**After**:
```typescript
import { CHAT_CONSTANTS } from '../core/Constants';

const chatLimits = getChatLimits();
if (messageCount > chatLimits.sessionLoadWarningThreshold) {
  // ...
  console.log(chalk.cyan(CHAT_CONSTANTS.SESSION_LOAD_CANCELLED));
}
```

**Why**: The hardcoded threshold of 100 is now configurable via environment variable `DALTON_SESSION_LOAD_WARNING_THRESHOLD`, and the string message is now centralized in Constants.

---

### 5. `src/providers/BaseAIProvider.ts`
**Changes**: Comprehensive update to use centralized error messages and constants

**Added Imports**:
```typescript
import { ERROR_MESSAGES, formatErrorMessage, TOOL_CONSTANTS } from '../core/Constants';
```

**Methods Updated**:

1. **loadAndValidateConfig()** (Lines 40-60)
   - Before: Hardcoded error strings
   - After: Uses `ERROR_MESSAGES.CONFIG_READ_FAILURE`, `ERROR_MESSAGES.CONFIG_MISSING`, `ERROR_MESSAGES.UNKNOWN_ERROR_READING_CONFIG`

2. **validateProviderConfig()** (Lines 71-90)
   - Before: Hardcoded configuration error messages
   - After: Uses `ERROR_MESSAGES.PROVIDER_NOT_CONFIGURED`, `ERROR_MESSAGES.API_KEY_NOT_CONFIGURED`

3. **handleInitializationError()** (Lines 100-106)
   - Before: Hardcoded error wrapper
   - After: Uses `ERROR_MESSAGES.CLIENT_INIT_FAILURE` with formatting

4. **validateTimeout()** (Lines 119-145)
   - Before: Hardcoded timeout validation messages
   - After: Uses `ERROR_MESSAGES.INVALID_TIMEOUT_VALUE`, `ERROR_MESSAGES.TIMEOUT_TOO_SHORT`, `ERROR_MESSAGES.TIMEOUT_TOO_LONG`

5. **validateMessagesStructure()** (Lines 155-180)
   - Before: Hardcoded validation messages
   - After: Uses centralized ERROR_MESSAGES constants

6. **validateOptionsStructure()** (Lines 190-213)
   - Before: Hardcoded validation messages and hardcoded `['none', 'auto']` array
   - After: Uses ERROR_MESSAGES constants and `TOOL_CONSTANTS.VALID_TOOL_CHOICES`

7. **wrapValidationError()** (Lines 223-229)
   - Before: Hardcoded error wrapper
   - After: Uses `ERROR_MESSAGES.VALIDATION_ERROR_CONTEXT` with formatting

**Why**: Centralizing error messages ensures consistency across the codebase, makes it easier to update messaging without searching multiple files, and provides a single source of truth for user-facing error text.

---

### 6. `src/providers/mistral_provider.ts`
**Changes**: Added import for PROVIDER_NAMES constant (for future use and consistency)

**Added Import**:
```typescript
import { PROVIDER_NAMES } from '../core/Constants';
```

**Why**: Ensures consistency with other providers and allows for future use of standardized provider name references.

---

## Migration Path for Environment Variables

Users can now configure these previously hardcoded values via environment variables:

### Chat/Session Limits
```bash
export DALTON_SESSION_LOAD_WARNING_THRESHOLD=100
export DALTON_CHAT_HISTORY_ROTATION_THRESHOLD=100
```

### API Timeouts
```bash
export DALTON_API_TIMEOUT_DEFAULT=30000
export DALTON_API_TIMEOUT_MIN=1000
export DALTON_API_TIMEOUT_MAX=600000
```

### Azure Configuration
- API version is now in `Constants.ts` and can be configured through the openai_provider configuration file

---

## Benefits of These Changes

1. **Single Source of Truth**: All magic numbers and strings are now in one or two centralized files
2. **Configurability**: Previously hardcoded values can now be overridden via environment variables
3. **Consistency**: Error messages are standardized across all providers
4. **Maintainability**: Changing a global setting requires updating only one location instead of multiple files
5. **Type Safety**: Constants are properly typed and can be validated
6. **Documentation**: All constants have clear JSDoc comments explaining their purpose
7. **Extensibility**: The `formatErrorMessage()` utility makes it easy to add new parameterized error messages

---

## Files with Changes Summary

| File | Type | Changes |
|------|------|---------|
| `src/core/Constants.ts` | NEW | Created comprehensive constants module with 700+ lines |
| `src/core/app_limits.ts` | MODIFIED | Added 2 new threshold constants to ChatLimits interface |
| `src/providers/gemini_provider.ts` | MODIFIED | Replaced 3 hardcoded timeout constants with app_limits import |
| `src/providers/openai_provider.ts` | MODIFIED | Replaced 4 hardcoded Azure configuration values with Constants |
| `src/commands/chat.ts` | MODIFIED | Replaced 2 hardcoded `100` thresholds with configurable limits |
| `src/providers/BaseAIProvider.ts` | MODIFIED | Updated 7 methods to use centralized error messages |
| `src/providers/mistral_provider.ts` | MODIFIED | Added Constants import for consistency |

**Total Lines Changed**: ~150 lines modified across 7 files, ~700 lines created in Constants.ts

---

## Testing Recommendations

1. **Unit Tests**: Verify that `formatErrorMessage()` correctly replaces all placeholders
2. **Integration Tests**: Ensure all error messages display correctly with actual error conditions
3. **Environment Variable Tests**: Verify that `DALTON_SESSION_LOAD_WARNING_THRESHOLD` environment variable is respected
4. **Azure Configuration Tests**: Confirm Azure endpoint detection and configuration still works correctly
5. **Error Message Tests**: Verify all error messages are consistent and properly formatted across all providers

---

## Next Steps (Optional)

1. Consider adding a configuration file loader to load constants from a `.daltonclirc` or similar config file
2. Add metrics/logging for when sessions exceed the warning threshold
3. Create a CLI command to display current configuration limits
4. Consider adding validation for environment variables at startup
