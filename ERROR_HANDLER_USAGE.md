# ErrorHandler Utility Module - Usage Guide

## Overview

The `ErrorHandler` utility module (`src/utils/ErrorHandler.ts`) consolidates 42+ duplicate error handling patterns found in `chat.ts`.

## Module Location
```
C:\Users\deadm\Desktop\.daltoncli\src\utils\ErrorHandler.ts
```

## Functions

### 1. `extractMessage(error: unknown): string`
Safely extracts error messages from Error objects or unknown error types.

**Before:**
```typescript
const errorMsg = error instanceof Error ? error.message : 'Unknown error';
```

**After:**
```typescript
const errorMsg = ErrorHandler.extractMessage(error);
```

**Example:**
```typescript
try {
  fs.readFileSync('nonexistent.txt');
} catch (error) {
  const msg = ErrorHandler.extractMessage(error);
  // "ENOENT: no such file or directory..."
}
```

---

### 2. `categorizeError(error: unknown): { category: string, suggestion: string }`
Categorizes errors and provides actionable user guidance.

Supports:
- Custom `SessionError` instances
- Node.js filesystem error codes (`EACCES`, `ENOENT`, `ENOSPC`)
- Generic unknown errors

**Before:**
```typescript
const { category, suggestion } = categorizeError(error);
```

**After:**
```typescript
const { category, suggestion } = ErrorHandler.categorizeError(error);
```

**Example:**
```typescript
try {
  fs.mkdirSync('/root/forbidden');
} catch (error) {
  const { category, suggestion } = ErrorHandler.categorizeError(error);
  // category: "PERMISSION DENIED"
  // suggestion: "Check file permissions or run with appropriate access rights."
}
```

---

### 3. `formatError(category: string, message: string, suggestion: string): string`
Formats error messages with visual styling and suggestions.

**Before:**
```typescript
const formatted = formatError(category, message, suggestion);
```

**After:**
```typescript
const formatted = ErrorHandler.formatError(category, message, suggestion);
```

**Output Example:**
```
❌ NETWORK ERROR
   Failed to connect to API
   💡 Suggestion: Check your internet connection and try again.
```

---

### 4. `logAndFormat(error: unknown, operationName: string): void`
**PRIMARY CONVENIENCE FUNCTION** - Combines extraction, categorization, formatting, and logging in one call.

**Before (OLD PATTERN - 42+ instances):**
```typescript
try {
  saveSession(data);
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : 'Unknown error';
  const { category, suggestion } = categorizeError(error);
  console.error(formatError(category, `Failed to save session: ${errorMsg}`, suggestion));
}
```

**After (NEW PATTERN):**
```typescript
try {
  saveSession(data);
} catch (error) {
  ErrorHandler.logAndFormat(error, 'Failed to save session');
}
```

---

## Import Options

### Option 1: Named import of the namespace object
```typescript
import ErrorHandler from '../utils/ErrorHandler';

ErrorHandler.logAndFormat(error, 'Failed to X');
ErrorHandler.extractMessage(error);
ErrorHandler.categorizeError(error);
ErrorHandler.formatError(category, message, suggestion);
```

### Option 2: Named imports (better for tree-shaking)
```typescript
import { logAndFormat, extractMessage, categorizeError } from '../utils/ErrorHandler';

logAndFormat(error, 'Failed to X');
extractMessage(error);
categorizeError(error);
```

### Option 3: Default export
```typescript
import ErrorHandler from '../utils/ErrorHandler';

ErrorHandler.logAndFormat(error, 'Failed to X');
```

---

## Error Categories

The module supports the following error categories:

| Error Code | Category | Suggestion |
|-----------|----------|-----------|
| `SessionError` | SESSION ERROR | Try using --list-sessions to see available sessions |
| `EACCES` | PERMISSION DENIED | Check file permissions or run with appropriate access rights |
| `ENOENT` | FILE NOT FOUND | Verify the session exists using --list-sessions |
| `ENOSPC` | DISK SPACE FULL | Free up disk space and try again |
| (default) | UNKNOWN ERROR | Check your configuration and try again |

---

## Migration Guide for chat.ts

### Pattern 1: Simple error extraction
**Lines: 390-391, 399-400, 419-420, 426-427, etc.**

Before:
```typescript
const errorMsg = error instanceof Error ? error.message : 'Unknown error';
throw new SessionError(`Failed to create app data directory: ${errorMsg}`, name);
```

After:
```typescript
const errorMsg = ErrorHandler.extractMessage(error);
throw new SessionError(`Failed to create app data directory: ${errorMsg}`, name);
```

### Pattern 2: Categorize and format (most common - 42+ instances)
**Lines: 464-466, 480-483, 492-493, 526-528, etc.**

Before:
```typescript
const errorMsg = error instanceof Error ? error.message : 'Unknown error';
const { category, suggestion } = categorizeError(error);
console.error(formatError(category, `Failed to read session file: ${errorMsg}`, suggestion));
```

After:
```typescript
ErrorHandler.logAndFormat(error, 'Failed to read session file');
```

### Pattern 3: Variable error message construction
**Lines: 701-706, 710-715, 836-840, etc.**

Before:
```typescript
const errorMsg = error instanceof Error ? error.message : 'Unknown error';
console.error(formatError(
  'DELETION FAILED',
  `Failed to delete session: ${errorMsg}`,
  'Check file permissions and try again.'
));
```

After:
```typescript
ErrorHandler.logAndFormat(error, 'Failed to delete session');
```

---

## Benefits

1. **Code Reduction**: Eliminates ~200+ lines of duplicate error handling code
2. **Consistency**: All errors handled uniformly across the application
3. **Maintainability**: Single source of truth for error formatting logic
4. **Extensibility**: Easy to add new error categories or customize formatting
5. **Testability**: Utility functions can be unit tested independently
6. **Type Safety**: Proper TypeScript type annotations throughout

---

## Type Definitions

```typescript
interface ErrorCategory {
  category: string;
  suggestion: string;
}
```

---

## Compilation Status

✓ TypeScript compilation successful
✓ No type errors detected
✓ Ready for integration into chat.ts and other modules
