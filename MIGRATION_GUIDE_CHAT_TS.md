# Migration Guide: chat.ts CommonJS to ES Modules with TypeScript

## Overview

The file `src/commands/chat.ts` has been successfully converted from CommonJS (`require()`/`module.exports`) to modern ES modules with comprehensive TypeScript type annotations.

## Changes Summary

### 1. Import Statements (CommonJS → ES Modules)

**Before:**
```typescript
const inquirer = require('inquirer');
const chalk = require('chalk');
const os = require('os');
const { getAvailableModels } = require('../core/model_registry');
const { getProvider } = require('../core/api_client');
const { metaprompt } = require('../core/system_prompt');
const { readConfig } = require('../core/config');
const { handleFs, isPathSafe } = require('./fs');
const handleShell = require('./shell');
const { tools } = require('../core/tools');
const fs = require('fs');
const path = require('path');
```

**After:**
```typescript
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { getAvailableModels } from '../core/model_registry';
import { getProvider } from '../core/api_client';
import { metaprompt } from '../core/system_prompt';
import { readConfig, AppConfig } from '../core/config';
import { handleFs, isPathSafe } from './fs';
import handleShell from './shell';
import { tools, Tool } from '../core/tools';
```

**Key Changes:**
- All `require()` statements replaced with `import` statements
- Named imports for modular functions
- Namespace imports (`import * as`) for standard library modules
- Added import of `AppConfig` type from config module for type safety

### 2. Export Statement (CommonJS → ES Modules)

**Before:**
```typescript
module.exports = handleChat;
```

**After:**
```typescript
export default handleChat;
```

### 3. TypeScript Type Annotations

Added comprehensive interface definitions to ensure type safety throughout the module:

#### Core Interfaces Added:

**ChatMessage** - Represents a message in the chat history
```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}
```

**ToolCall** - Represents an AI tool call request
```typescript
interface ToolCall {
  id: string;
  index?: number;
  function: {
    name: string;
    arguments: string;
  };
}
```

**ToolResult** - Represents the result of a tool call
```typescript
interface ToolResult {
  tool_call_id: string;
  role: 'tool';
  name: string;
  content: string;
}
```

**DeltaChunk** - Represents a streaming response chunk
```typescript
interface DeltaChunk {
  choices: Array<{
    delta?: {
      content?: string;
      tool_calls?: ToolCallDelta[];
    };
  }>;
}
```

**ToolCallDelta** - Represents tool call information in a stream chunk
```typescript
interface ToolCallDelta {
  index: number;
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}
```

**ChatOptions** - CLI options for the chat command
```typescript
interface ChatOptions {
  resume?: boolean | string;
  load?: string;
  file?: string;
  provider?: string;
  model?: string;
  save?: string;
}
```

**AIProvider** - Interface for AI provider implementations
```typescript
interface AIProvider {
  providerName: string;
  getChatCompletion(
    messages: ChatMessage[],
    options: { model: string; tools: Tool[]; tool_choice: string }
  ): Promise<AsyncIterable<DeltaChunk>>;
}
```

### 4. Variable Type Annotations

All constants and variables now have explicit type annotations:

```typescript
// Constants
const HISTORY_LIMIT: number = 10;
const APP_DATA_DIR: string = path.join(os.homedir(), '.dalton-cli');
const SESSIONS_DIR: string = path.join(APP_DATA_DIR, 'sessions');
const LAST_SESSION_NAME: string = '__last_session';
```

### 5. Function Signature Updates

All functions now have complete type signatures with return types:

**Before:**
```typescript
const saveSession = (name, history) => {
  // ... implementation
};
```

**After:**
```typescript
const saveSession = (name: string, history: ChatMessage[]): void => {
  if (!fs.existsSync(APP_DATA_DIR)) fs.mkdirSync(APP_DATA_DIR);
  if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);
  const filePath: string = path.join(SESSIONS_DIR, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
};
```

### 6. Error Handling Improvements

Error handling now properly checks error types:

**Before:**
```typescript
catch (error) {
  return { tool_call_id: toolCall.id, role: 'tool', name, content: `Error parsing arguments: ${error.message}` };
}
```

**After:**
```typescript
catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  return {
    tool_call_id: toolCall.id,
    role: 'tool',
    name,
    content: `Error parsing arguments: ${errorMessage}`,
  };
}
```

### 7. JSDoc Comments

Added comprehensive JSDoc comments to all public functions for better IDE support and documentation:

```typescript
/**
 * Saves a chat session to a JSON file
 * @param name - The session name
 * @param history - The chat history to save
 */
const saveSession = (name: string, history: ChatMessage[]): void => {
  // ...
};
```

### 8. Type Assertions Where Needed

Added proper type assertions for cases where types need to be clarified:

```typescript
// When getting answer from inquirer
providerName = answer.providerName as string;

// Type casting for getProvider result
const provider: AIProvider = getProvider(
  providerName
) as unknown as AIProvider;
```

### 9. Null-Safe Array Filtering

Improved type safety when filtering tool calls:

```typescript
// Filter out undefined entries in toolCalls
const validToolCalls: ToolCall[] = toolCalls.filter(
  (tc): tc is ToolCall => tc !== undefined
);
```

## Benefits of This Migration

1. **Type Safety**: Full TypeScript support prevents runtime errors
2. **IDE Support**: Better IntelliSense and autocomplete in IDEs
3. **Modern Standards**: ES modules are the standard in modern JavaScript/TypeScript
4. **Tree-Shaking**: ES modules enable better bundle optimization
5. **Better Error Handling**: Proper error type checking prevents unexpected runtime issues
6. **Documentation**: JSDoc comments provide self-documentation
7. **Maintainability**: Clear type definitions make the code easier to understand and maintain

## Compatibility Notes

### Imports from Related Modules

The conversion assumes the following modules are properly exporting their types and values:

- `../core/model_registry.ts` - Should export `getAvailableModels` function
- `../core/api_client.ts` - Should export `getProvider` function (returns AIProvider)
- `../core/system_prompt.js` - Should export `metaprompt` constant
- `../core/config.ts` - Should export `readConfig` function and `AppConfig` type
- `./fs.ts` - Should export `handleFs` and `isPathSafe` functions
- `./shell.ts` - Should export default `handleShell` function
- `../core/tools.ts` - Should export `tools` array and `Tool` type

### system_prompt.ts Conversion Needed

The `system_prompt.js` file should also be converted to TypeScript and ES modules:

**Suggested conversion for system_prompt.ts:**
```typescript
export const metaprompt: string = `You are Dalton's personal assistant...`;
```

## Testing Checklist

After this migration, verify the following:

- [ ] TypeScript compilation succeeds without errors
- [ ] No import errors when running the application
- [ ] Chat functionality works as expected
- [ ] Session save/load operations function correctly
- [ ] Error messages display properly
- [ ] Tool calls are executed correctly
- [ ] Shell commands can be executed via tools
- [ ] File reading works with the fs tool
- [ ] Provider and model selection works
- [ ] Chat history truncation works as expected

## Files Modified

- `C:\Users\deadm\Desktop\.daltoncli\src\commands\chat.ts` - Main conversion

## Files That May Need Updates

- `src/core/system_prompt.js` - Convert to TypeScript ES module for consistency
- Any files importing from `chat.ts` - Should use `import handleChat from './commands/chat'`

## Next Steps

1. Verify TypeScript compilation: `npm run build` or `tsc`
2. Run the chat command: `dalton-cli shekinah chat`
3. Test session persistence and loading
4. Test tool execution functionality
5. Consider converting other CommonJS files in the `src/commands/` directory following the same pattern

## Summary of All Changes

| Aspect | Before | After |
|--------|--------|-------|
| Module System | CommonJS (require/exports) | ES Modules (import/export) |
| Type Annotations | None | Comprehensive types for all functions |
| Error Handling | Generic `error.message` | Type-safe error checking |
| Interfaces | None | 6+ interfaces defined |
| Documentation | Comments | JSDoc comments on all functions |
| Constants | No type annotations | Explicit type annotations |
| Export | `module.exports = handleChat` | `export default handleChat` |
