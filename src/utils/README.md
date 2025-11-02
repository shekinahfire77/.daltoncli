# Utils Module

Utility modules for the Dalton CLI application.

## ErrorHandler.ts

A consolidated error handling utility that eliminates 42+ duplicate error handling patterns throughout the codebase.

### Quick Start

```typescript
import ErrorHandler from './ErrorHandler';

try {
  // Your operation here
} catch (error) {
  ErrorHandler.logAndFormat(error, 'Operation description');
}
```

### Available Functions

1. **logAndFormat(error, operationName)** - PRIMARY FUNCTION
   - Extracts, categorizes, formats, and logs errors in one call
   - Use this for most error handling scenarios

2. **extractMessage(error)**
   - Safely extracts message from Error or unknown types
   - Returns 'Unknown error' as fallback

3. **categorizeError(error)**
   - Categorizes error and provides actionable suggestion
   - Returns: `{ category: string, suggestion: string }`

4. **formatError(category, message, suggestion)**
   - Formats error with colors and structure
   - Returns formatted string ready for console output

### Supported Error Categories

- SESSION ERROR (SessionError instances)
- PERMISSION DENIED (EACCES)
- FILE NOT FOUND (ENOENT)
- DISK SPACE FULL (ENOSPC)
- UNKNOWN ERROR (default fallback)

### Examples

**Simple error logging:**
```typescript
try {
  fs.readFileSync(path);
} catch (error) {
  ErrorHandler.logAndFormat(error, 'Failed to read file');
}
```

**Custom error message:**
```typescript
try {
  saveSession(data);
} catch (error) {
  const msg = ErrorHandler.extractMessage(error);
  console.error(`Custom handling: ${msg}`);
}
```

**Error categorization:**
```typescript
try {
  // operation
} catch (error) {
  const { category, suggestion } = ErrorHandler.categorizeError(error);
  console.log(`Error: ${category}`);
  console.log(`Tip: ${suggestion}`);
}
```

### Type Safety

All functions have proper TypeScript type annotations:
- Accepts `unknown` error types (safe)
- Returns typed objects and strings
- Full IDE autocomplete support

### Documentation

For detailed documentation, see:
- `ERROR_HANDLER_USAGE.md` - Comprehensive usage guide
- `CONSOLIDATION_PATTERNS.md` - Pattern analysis and migration guide
