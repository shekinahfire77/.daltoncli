# Error Handling Patterns in Dalton CLI

This document describes the comprehensive error handling patterns implemented across the Dalton CLI codebase to ensure robust, production-ready code that fails gracefully and provides clear error information.

## Table of Contents

1. [Overview](#overview)
2. [Core Principles](#core-principles)
3. [Standard Patterns](#standard-patterns)
4. [File-Specific Implementations](#file-specific-implementations)
5. [Custom Error Classes](#custom-error-classes)
6. [Best Practices](#best-practices)

## Overview

The error handling implementation follows defensive programming principles with:
- **Input validation** at function entry points
- **Specific error types** rather than generic catch-all handlers
- **Meaningful error messages** for debugging
- **Proper error propagation** with context
- **Graceful degradation** where appropriate
- **Error recovery mechanisms** for non-critical failures

## Core Principles

### 1. Validate Early, Fail Fast

All public functions validate their parameters before processing:

```typescript
// DEFENSIVE: Validate input parameters at function entry
if (typeof command !== 'string') {
  const message: string = 'Error: Command must be a string';
  console.error(chalk.red(message));
  return message;
}

if (!command || command.trim().length === 0) {
  const message: string = 'Error: No command provided';
  console.error(chalk.red(message));
  return message;
}
```

### 2. Use Specific Exception Types

Create custom error classes for different error categories:

```typescript
class SessionError extends Error {
  constructor(message: string, public sessionName?: string) {
    super(message);
    this.name = 'SessionError';
  }
}

class ShellExecutionError extends Error {
  constructor(
    message: string,
    public exitCode?: number,
    public stderr?: string,
  ) {
    super(message);
    this.name = 'ShellExecutionError';
  }
}
```

### 3. Wrap External Operations

All operations that can fail (file I/O, network requests, external processes) are wrapped in try-catch blocks:

```typescript
try {
  const fileContent: string = fs.readFileSync(filePath, 'utf-8');
  return fileContent;
} catch (error) {
  const errorMessage: string = error instanceof Error ? error.message : 'Unknown error';
  console.error(chalk.red(`Error reading file: ${errorMessage}`));
  return `Error reading file: ${errorMessage}`;
}
```

### 4. Preserve Error Context

Error messages include context about what operation failed and why:

```typescript
// DEFENSIVE: Parse JSON with error handling
try {
  const parsed = JSON.parse(rawData);
  if (!Array.isArray(parsed)) {
    throw new SessionError('Session data is not a valid array', name);
  }
  return parsed as ChatMessage[];
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : 'Unknown error';
  console.error(chalk.red(`Failed to parse session file: ${errorMsg}`));
  throw new SessionError(`Invalid session file format: ${errorMsg}`, name);
}
```

## Standard Patterns

### File I/O Operations

**Pattern**: Check existence → Read → Parse → Validate

```typescript
// 1. Check file existence
if (!fs.existsSync(filePath)) {
  return null;
}

// 2. Read file with error handling
let rawData: string;
try {
  rawData = fs.readFileSync(filePath, 'utf-8');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
    return null;
  }
  throw new SessionError(`Failed to read file: ${errorMsg}`, name);
}

// 3. Parse content
try {
  const parsed = JSON.parse(rawData);
  // 4. Validate parsed data
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid data structure');
  }
  return parsed;
} catch (error) {
  throw new SessionError(`Invalid file format: ${errorMsg}`, name);
}
```

### Async Operations

**Pattern**: Validate → Execute → Handle errors → Provide context

```typescript
// DEFENSIVE: Get completion with error handling
let stream: AsyncIterable<DeltaChunk>;
try {
  stream = await provider.getChatCompletion(truncatedHistory, {
    model,
    tools,
    tool_choice: 'auto',
  });
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : 'Unknown error';
  throw new Error(`Failed to get chat completion: ${errorMsg}`);
}
```

### Directory Operations

**Pattern**: Create directories recursively with error handling

```typescript
// DEFENSIVE: Create directories with error handling
if (!fs.existsSync(APP_DATA_DIR)) {
  try {
    fs.mkdirSync(APP_DATA_DIR, { recursive: true });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new SessionError(`Failed to create app data directory: ${errorMsg}`, name);
  }
}
```

### User Input Validation

**Pattern**: Type check → Format check → Range check → Special characters check

```typescript
const validateSessionName = (name: string): boolean => {
  // Type and empty check
  if (typeof name !== 'string' || name.trim().length === 0) {
    return false;
  }

  // Directory traversal prevention
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) {
    return false;
  }

  // Length limit
  if (name.length > 255) {
    return false;
  }

  return true;
};
```

### Stream Processing

**Pattern**: Validate stream → Process chunks → Handle errors → Verify completion

```typescript
// DEFENSIVE: Validate stream
if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
  throw new PromptError('Invalid stream received from provider');
}

// DEFENSIVE: Stream chunks with error handling
try {
  for await (const chunk of stream) {
    // Validate chunk structure
    if (!chunk || !chunk.choices || !Array.isArray(chunk.choices)) {
      console.warn(chalk.yellow('Warning: Invalid chunk structure received'));
      continue;
    }

    const content = chunk.choices[0]?.delta?.content;
    if (typeof content === 'string') {
      fullResponse += content;
    }
  }
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : 'Unknown error';
  throw new PromptError(`Error processing stream: ${errorMsg}`);
}
```

## File-Specific Implementations

### shell.ts - Command Execution

**Key Features**:
- Command validation (type, length, control characters)
- Custom `ShellExecutionError` class with exit code and stderr
- User confirmation with error recovery
- Timeout handling
- Process error event handling

**Example**:
```typescript
const validateCommand = (command: string): { valid: boolean; error?: string } => {
  if (typeof command !== 'string') {
    return { valid: false, error: 'Command must be a string' };
  }

  if (command.trim().length === 0) {
    return { valid: false, error: 'Command cannot be empty' };
  }

  if (command.length > MAX_COMMAND_LENGTH) {
    return {
      valid: false,
      error: `Command exceeds maximum length of ${MAX_COMMAND_LENGTH} characters`,
    };
  }

  if (command.includes('\0') || command.includes('\n') || command.includes('\r')) {
    return { valid: false, error: 'Command contains invalid control characters' };
  }

  return { valid: true };
};
```

### chat.ts - Session Management and AI Interaction

**Key Features**:
- `SessionError` class with session name context
- Session name validation (prevent directory traversal)
- Graceful session save failures on exit
- Stream assembly error handling
- Tool call validation and execution error handling
- History truncation for memory safety

**Example**:
```typescript
const saveSession = (name: string, history: ChatMessage[]): void => {
  // Validate session name and history
  if (!validateSessionName(name)) {
    throw new SessionError('Invalid session name format', name);
  }

  if (!Array.isArray(history)) {
    throw new SessionError('Chat history must be an array', name);
  }

  try {
    // Create directories with error handling
    if (!fs.existsSync(APP_DATA_DIR)) {
      try {
        fs.mkdirSync(APP_DATA_DIR, { recursive: true });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        throw new SessionError(`Failed to create app data directory: ${errorMsg}`, name);
      }
    }

    // Write file with error handling
    const filePath: string = path.join(SESSIONS_DIR, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2), { encoding: 'utf-8', flag: 'w' });
  } catch (error) {
    if (error instanceof SessionError) {
      throw error;
    }
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new SessionError(`Unexpected error saving session: ${errorMsg}`, name);
  }
};
```

### flow_runner.ts - Workflow Execution

**Key Features**:
- `FlowExecutionError` class with step type and index
- YAML parsing with validation
- Schema validation with Zod
- Step-by-step error recovery
- Dry-run mode continues despite errors
- Flow path validation

**Example**:
```typescript
export async function runFlow(
  flowYamlPath: string,
  dryRun: boolean = false,
  nonInteractive: boolean = false,
  allowNetwork: boolean = false
): Promise<void> {
  // Validate input parameters
  if (!validateFlowPath(flowYamlPath)) {
    throw new FlowExecutionError('Invalid flow path provided');
  }

  // Read flow file with error handling
  let flowContent: string;
  try {
    if (!fs.existsSync(flowYamlPath)) {
      throw new FlowExecutionError(`Flow file not found: ${flowYamlPath}`);
    }
    flowContent = fs.readFileSync(flowYamlPath, 'utf8');
  } catch (error) {
    if (error instanceof FlowExecutionError) {
      throw error;
    }
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new FlowExecutionError(`Failed to read flow file: ${errorMsg}`);
  }

  // Execute steps with error handling
  for (let i = 0; i < flow.steps.length; i++) {
    try {
      // Execute step...
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const stepType = 'type' in step ? String(step.type) : 'unknown';

      console.error(`Error executing step ${i} (${stepType}): ${errorMsg}`);

      // Allow continuing on non-critical errors in dry-run mode
      if (dryRun) {
        console.warn(`[DRY-RUN] Continuing despite error in step ${i}`);
        continue;
      }

      throw new FlowExecutionError(`Step ${i} (${stepType}) failed: ${errorMsg}`, stepType, i);
    }
  }
}
```

### configure.ts - Configuration Management

**Key Features**:
- Action type validation (`ai` vs `mcp`)
- Service name format validation
- Configuration key validation
- Value type checking
- Protection against injection attacks

**Example**:
```typescript
const isValidConfigKey = (key: string | undefined): boolean => {
  // Validate key type and format
  if (typeof key !== 'string' || key.trim().length === 0) {
    return false;
  }

  // Prevent injection and special characters
  if (key.includes('/') || key.includes('\\') || key.includes('\0')) {
    return false;
  }

  // Limit key length
  if (key.length > 100) {
    return false;
  }

  return true;
};
```

### prompt.ts - Single Prompt Handling

**Key Features**:
- `PromptError` class with cause chaining
- Message length validation (prevent abuse)
- Provider validation before use
- Stream validation
- Chunk structure validation
- Empty response detection

**Example**:
```typescript
const isValidPromptMessage = (message: string | undefined): boolean => {
  // Validate message type and content
  if (typeof message !== 'string' || message.trim().length === 0) {
    return false;
  }

  // Limit message length to prevent abuse
  if (message.length > 100000) {
    return false;
  }

  return true;
};
```

### plugin_loader.ts - Plugin System

**Key Features**:
- `PluginLoadError` class with plugin name and cause
- Base directory validation
- Plugin name format validation
- Module structure validation
- Path traversal prevention
- Continue loading despite individual plugin failures

**Example**:
```typescript
const isValidPluginName = (pluginName: string): boolean => {
  // Validate plugin name type
  if (typeof pluginName !== 'string' || pluginName.trim().length === 0) {
    return false;
  }

  // Ensure plugin name starts with valid prefix
  if (!pluginName.startsWith(PLUGIN_PREFIX)) {
    return false;
  }

  // Check for path traversal attempts
  if (pluginName.includes('..') || pluginName.includes('/') || pluginName.includes('\\')) {
    return false;
  }

  return true;
};
```

## Custom Error Classes

### Why Custom Error Classes?

Custom error classes provide:
1. **Type safety** - Catch specific error types
2. **Context preservation** - Store additional error metadata
3. **Clear error origins** - Identify which subsystem failed
4. **Better debugging** - Stack traces with meaningful names

### Implemented Error Classes

#### SessionError
```typescript
class SessionError extends Error {
  constructor(message: string, public sessionName?: string) {
    super(message);
    this.name = 'SessionError';
  }
}
```

**Usage**: Session file operations, JSON parsing, session validation

#### ShellExecutionError
```typescript
class ShellExecutionError extends Error {
  constructor(
    message: string,
    public exitCode?: number,
    public stderr?: string,
  ) {
    super(message);
    this.name = 'ShellExecutionError';
  }
}
```

**Usage**: Command execution, process spawning, timeout handling

#### FlowExecutionError
```typescript
class FlowExecutionError extends Error {
  constructor(
    message: string,
    public stepType?: string,
    public stepIndex?: number
  ) {
    super(message);
    this.name = 'FlowExecutionError';
  }
}
```

**Usage**: Flow file parsing, step execution, schema validation

#### PromptError
```typescript
class PromptError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'PromptError';
  }
}
```

**Usage**: Prompt validation, provider errors, stream processing

#### PluginLoadError
```typescript
class PluginLoadError extends Error {
  constructor(message: string, public pluginName?: string, public cause?: Error) {
    super(message);
    this.name = 'PluginLoadError';
  }
}
```

**Usage**: Plugin discovery, module loading, validation

## Best Practices

### 1. Always Validate Function Parameters

```typescript
// GOOD: Validate at function entry
const handleCommand = (command: string): void => {
  if (typeof command !== 'string' || command.trim().length === 0) {
    throw new Error('Invalid command');
  }
  // Process command...
};

// BAD: No validation
const handleCommand = (command: string): void => {
  // Assume command is valid - could crash
  const result = processCommand(command);
};
```

### 2. Use Specific Error Types

```typescript
// GOOD: Catch specific errors
try {
  const data = JSON.parse(rawData);
} catch (error) {
  if (error instanceof SyntaxError) {
    throw new SessionError(`Invalid JSON: ${error.message}`);
  }
  throw error;
}

// BAD: Generic error handling
try {
  const data = JSON.parse(rawData);
} catch (error) {
  throw new Error('Parse failed');
}
```

### 3. Provide Meaningful Error Messages

```typescript
// GOOD: Specific, actionable error
throw new FlowExecutionError(
  `Step 3 (tool_call) failed: Tool 'executeCommand' not found in registry`,
  'tool_call',
  3
);

// BAD: Vague error message
throw new Error('Step failed');
```

### 4. Log Errors Appropriately

```typescript
// GOOD: Log with context, don't expose sensitive data
console.error(chalk.red(`Failed to execute command: ${sanitizedError}`));

// BAD: Log raw errors that might contain secrets
console.error(error);
```

### 5. Use Finally Blocks for Cleanup

```typescript
// GOOD: Ensure cleanup happens
const file = fs.openSync(path, 'r');
try {
  const data = fs.readSync(file, buffer, 0, buffer.length, 0);
  processData(data);
} catch (error) {
  console.error('Read failed:', error);
} finally {
  fs.closeSync(file);
}
```

### 6. Don't Swallow Errors Silently

```typescript
// GOOD: Log and handle appropriately
try {
  loadPlugin(pluginPath);
} catch (error) {
  console.warn(`Failed to load plugin: ${error.message}`);
  // Continue with other plugins
}

// BAD: Silent failure
try {
  loadPlugin(pluginPath);
} catch (error) {
  // Ignore error
}
```

### 7. Validate External Data

```typescript
// GOOD: Validate structure before use
if (!chunk || !chunk.choices || !Array.isArray(chunk.choices)) {
  console.warn('Invalid chunk structure');
  continue;
}

// BAD: Assume data structure
const content = chunk.choices[0].delta.content; // Could crash
```

### 8. Add Type Hints for Error Prevention

```typescript
// GOOD: Type hints catch errors at compile time
const validateCommand = (command: string): { valid: boolean; error?: string } => {
  // TypeScript enforces return type
  return { valid: true };
};

// BAD: No type hints
const validateCommand = (command) => {
  // Could return anything
  return command.length > 0;
};
```

## Error Recovery Mechanisms

### Non-Critical Failures

Some operations can gracefully degrade:

```typescript
// List sessions - skip invalid ones rather than failing completely
files.forEach((file) => {
  try {
    const history = loadSession(sessionName);
    displaySession(sessionName, history);
  } catch (error) {
    console.warn(`Could not load session ${sessionName}: ${error.message}`);
    // Continue with other sessions
  }
});
```

### Dry-Run Mode

Dry-run operations continue despite errors:

```typescript
if (dryRun) {
  console.warn(`[DRY-RUN] Continuing despite error in step ${i}`);
  continue;
}
```

### User Confirmation

Critical operations require confirmation:

```typescript
const { confirmation } = await inquirer.prompt([
  {
    type: 'confirm',
    name: 'confirmation',
    message: `Allow execution?`,
    default: true,
  },
]);
```

## Testing Error Handling

When testing, verify:
1. **Invalid inputs are rejected** - Test with null, undefined, empty strings, wrong types
2. **File operations handle errors** - Test with missing files, permission errors, corrupted data
3. **Network failures are handled** - Test with timeouts, connection errors, invalid responses
4. **Async operations are properly awaited** - Test promise rejections
5. **Error messages are meaningful** - Verify error context is preserved

## Summary

The error handling implementation in Dalton CLI follows these key principles:

1. ✅ **Validate early** - Check inputs at function boundaries
2. ✅ **Use specific exceptions** - Custom error classes with context
3. ✅ **Wrap external operations** - Try-catch around I/O, network, processes
4. ✅ **Preserve context** - Include operation details in error messages
5. ✅ **Fail gracefully** - Provide meaningful errors and recovery options
6. ✅ **Log appropriately** - Help debugging without exposing secrets
7. ✅ **Use type safety** - TypeScript types prevent many errors
8. ✅ **Recover when possible** - Continue execution for non-critical failures

This comprehensive approach ensures the CLI is production-ready, maintainable, and provides excellent user experience even when things go wrong.
