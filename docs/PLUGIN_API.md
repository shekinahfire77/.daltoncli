# Dalton CLI Plugin API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Plugin Structure](#plugin-structure)
4. [Commands API](#commands-api)
5. [Tools API](#tools-api)
6. [Installation and Loading](#installation-and-loading)
7. [Complete Examples](#complete-examples)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [API Reference](#api-reference)

---

## Overview

The Dalton CLI plugin system provides a powerful and flexible way to extend the CLI with custom functionality. Plugins can add:

- **Custom CLI Commands**: Extend Dalton CLI with new commands that users can invoke directly
- **AI Tools**: Add new tools that the AI can use during conversations and task execution

### Why Use Plugins?

- **Extensibility**: Add domain-specific functionality without modifying core code
- **Reusability**: Share custom commands and tools across projects and teams
- **Modularity**: Keep related functionality organized in standalone packages
- **Community**: Leverage and contribute to a growing ecosystem of plugins

### How It Works

1. Plugins are standard npm packages with a specific naming convention
2. The plugin loader automatically discovers and loads plugins from `node_modules`
3. Commands become available in the CLI, and tools become available to the AI
4. Plugins are loaded dynamically using ES module imports

---

## Getting Started

### Quick Start: Your First Plugin

Create a simple plugin in 5 minutes:

**1. Create a new npm package:**

```bash
mkdir daltoncli-plugin-hello
cd daltoncli-plugin-hello
npm init -y
```

**2. Update `package.json`:**

```json
{
  "name": "@daltoncli-plugin-hello",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "description": "A simple hello world plugin for Dalton CLI"
}
```

**3. Create `index.js`:**

```javascript
export const commands = [
  {
    name: 'hello',
    description: 'Say hello to the user',
    action: (name = 'World') => {
      console.log(`Hello, ${name}!`);
    },
    options: [
      {
        flags: '-n, --name <name>',
        description: 'Name to greet',
        defaultValue: 'World'
      }
    ]
  }
];
```

**4. Install and use:**

```bash
# In your Dalton CLI project
npm install /path/to/daltoncli-plugin-hello
dalton hello --name Alice
# Output: Hello, Alice!
```

---

## Plugin Structure

### Naming Convention

Plugins MUST follow the naming convention:

```
@daltoncli-plugin-<plugin-name>
```

Examples:
- `@daltoncli-plugin-database`
- `@daltoncli-plugin-deployment`
- `@daltoncli-plugin-analytics`

The `@daltoncli-plugin-` prefix is required for automatic discovery by the plugin loader.

### Directory Structure

A typical plugin structure:

```
@daltoncli-plugin-example/
├── package.json          # Package configuration
├── index.js              # Main entry point
├── commands/             # Command implementations (optional)
│   ├── command1.js
│   └── command2.js
├── tools/                # Tool implementations (optional)
│   ├── tool1.js
│   └── tool2.js
├── lib/                  # Shared utilities (optional)
│   └── utils.js
├── README.md             # Plugin documentation
└── LICENSE               # License file
```

### package.json Requirements

**Minimum required fields:**

```json
{
  "name": "@daltoncli-plugin-yourplugin",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "description": "Description of your plugin"
}
```

**Recommended fields:**

```json
{
  "name": "@daltoncli-plugin-yourplugin",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "description": "Description of your plugin",
  "keywords": ["daltoncli", "plugin", "cli"],
  "author": "Your Name <you@example.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/username/daltoncli-plugin-yourplugin"
  },
  "peerDependencies": {
    "daltoncli": "^1.0.0"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
```

### Entry Point (index.js)

The main entry point must export `commands` and/or `tools`:

```javascript
// Export commands only
export const commands = [ /* ... */ ];

// Export tools only
export const tools = [ /* ... */ ];

// Export both
export const commands = [ /* ... */ ];
export const tools = [ /* ... */ ];
```

---

## Commands API

### Command Interface

```typescript
interface DaltonCLICommand {
  name: string;                    // Command name (required)
  description: string;             // Command description (required)
  action: (...args: any[]) => Promise<void> | void;  // Command handler (required)
  options?: Array<{                // Command options (optional)
    flags: string;                 // Option flags (e.g., '-f, --force')
    description: string;           // Option description
    defaultValue?: any;            // Default value if not provided
  }>;
}
```

### Creating Commands

**Basic command:**

```javascript
export const commands = [
  {
    name: 'greet',
    description: 'Greet the user',
    action: () => {
      console.log('Hello from Dalton CLI!');
    }
  }
];
```

**Command with arguments:**

```javascript
export const commands = [
  {
    name: 'echo',
    description: 'Echo a message',
    action: (message) => {
      console.log(message);
    }
  }
];
```

**Command with options:**

```javascript
export const commands = [
  {
    name: 'deploy',
    description: 'Deploy the application',
    action: (environment, options) => {
      console.log(`Deploying to ${environment}`);
      if (options.force) {
        console.log('Force flag enabled');
      }
      if (options.verbose) {
        console.log('Verbose output enabled');
      }
    },
    options: [
      {
        flags: '-f, --force',
        description: 'Force deployment without confirmation',
        defaultValue: false
      },
      {
        flags: '-v, --verbose',
        description: 'Enable verbose output',
        defaultValue: false
      }
    ]
  }
];
```

**Async command:**

```javascript
export const commands = [
  {
    name: 'fetch-data',
    description: 'Fetch data from API',
    action: async (url) => {
      try {
        const response = await fetch(url);
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
      } catch (error) {
        console.error('Failed to fetch data:', error.message);
        process.exit(1);
      }
    }
  }
];
```

### Command Options Syntax

Options use Commander.js flag syntax:

- `-f, --force`: Boolean flag (short and long form)
- `-p, --port <port>`: Required value
- `-h, --host [host]`: Optional value
- `-c, --config <path>`: Required string argument
- `-n, --count <number>`: Required number argument

**Examples:**

```javascript
// Boolean flags
{ flags: '-f, --force', description: 'Force operation' }

// Required value
{ flags: '-p, --port <port>', description: 'Server port', defaultValue: 3000 }

// Optional value
{ flags: '-h, --host [host]', description: 'Server host', defaultValue: 'localhost' }

// Multiple values
{ flags: '-t, --tags <tags...>', description: 'Tags (can be specified multiple times)' }
```

### Accessing Options in Action

```javascript
{
  name: 'server',
  description: 'Start development server',
  action: (options) => {
    const port = options.port || 3000;
    const host = options.host || 'localhost';
    console.log(`Starting server at http://${host}:${port}`);
  },
  options: [
    { flags: '-p, --port <port>', description: 'Port number' },
    { flags: '-h, --host <host>', description: 'Host address' }
  ]
}
```

---

## Tools API

### Tool Interface

```typescript
interface ToolDefinition {
  name: string;                    // Tool name (required)
  description: string;             // Tool description (required)
  parameters: Record<string, any>; // JSON Schema parameters (required)
  func: Function;                  // Tool implementation (required)
  isNetworkTool?: boolean;         // Whether tool makes network calls (optional)
}
```

### Creating Tools

**Basic tool:**

```javascript
export const tools = [
  {
    name: 'calculate_sum',
    description: 'Calculate the sum of two numbers',
    parameters: {
      type: 'object',
      properties: {
        a: {
          type: 'number',
          description: 'First number'
        },
        b: {
          type: 'number',
          description: 'Second number'
        }
      },
      required: ['a', 'b']
    },
    func: ({ a, b }) => {
      return a + b;
    }
  }
];
```

**Async tool:**

```javascript
export const tools = [
  {
    name: 'fetch_weather',
    description: 'Fetch current weather for a city',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'City name'
        },
        units: {
          type: 'string',
          enum: ['metric', 'imperial'],
          description: 'Temperature units',
          default: 'metric'
        }
      },
      required: ['city']
    },
    func: async ({ city, units = 'metric' }) => {
      const response = await fetch(
        `https://api.weather.com/v1/weather?city=${city}&units=${units}`
      );
      const data = await response.json();
      return data.temperature;
    },
    isNetworkTool: true
  }
];
```

**Tool with complex parameters:**

```javascript
export const tools = [
  {
    name: 'search_database',
    description: 'Search the database with filters',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query'
        },
        filters: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            minPrice: { type: 'number' },
            maxPrice: { type: 'number' },
            inStock: { type: 'boolean' }
          },
          description: 'Search filters'
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return',
          default: 10,
          minimum: 1,
          maximum: 100
        }
      },
      required: ['query']
    },
    func: async ({ query, filters = {}, limit = 10 }) => {
      // Implementation
      const results = await database.search(query, filters, limit);
      return results;
    }
  }
];
```

### Parameter Schema (JSON Schema)

Tools use JSON Schema to define parameters:

**Supported types:**
- `string`: Text values
- `number`: Numeric values
- `boolean`: True/false values
- `object`: Nested objects
- `array`: Lists of values

**Common properties:**
- `type`: Data type
- `description`: Human-readable description
- `default`: Default value
- `enum`: Allowed values
- `minimum`/`maximum`: Numeric constraints
- `minLength`/`maxLength`: String length constraints
- `pattern`: Regex pattern for strings
- `required`: Array of required property names

**Examples:**

```javascript
// String with constraints
{
  type: 'string',
  description: 'User email',
  pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
  minLength: 5,
  maxLength: 100
}

// Number with range
{
  type: 'number',
  description: 'Age in years',
  minimum: 0,
  maximum: 120
}

// Enum values
{
  type: 'string',
  description: 'Log level',
  enum: ['debug', 'info', 'warn', 'error']
}

// Array of strings
{
  type: 'array',
  description: 'List of tags',
  items: { type: 'string' },
  minItems: 1,
  maxItems: 10
}

// Nested object
{
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' }
  },
  required: ['name']
}
```

### Network Tools

Mark tools that make network requests with `isNetworkTool: true`:

```javascript
{
  name: 'api_call',
  description: 'Call external API',
  parameters: { /* ... */ },
  func: async (params) => {
    const response = await fetch(params.url);
    return await response.json();
  },
  isNetworkTool: true  // Important for rate limiting and monitoring
}
```

---

## Installation and Loading

### Installing Plugins

**From npm:**

```bash
npm install @daltoncli-plugin-database
```

**From local directory:**

```bash
npm install /path/to/plugin
```

**From git repository:**

```bash
npm install git+https://github.com/user/daltoncli-plugin-example.git
```

### Plugin Discovery

The plugin loader automatically:

1. Scans the `node_modules` directory
2. Finds packages starting with `@daltoncli-plugin-`
3. Dynamically imports each plugin
4. Validates the exported `commands` and `tools`
5. Registers them with the CLI and AI

### Loading Process

When Dalton CLI starts:

```
1. Locate node_modules directory
2. Find all @daltoncli-plugin-* packages
3. For each plugin:
   a. Import the module
   b. Validate exports (commands/tools)
   c. Register commands with CLI
   d. Register tools with AI provider
4. Log loaded plugins
5. Continue startup
```

### Verification

Check if your plugin loaded successfully:

```bash
# Check CLI output for plugin loading messages
dalton --help
# Your custom commands should appear in the list

# Check logs
# Look for: "Loaded plugin: @daltoncli-plugin-yourplugin"
```

---

## Complete Examples

### Example 1: Simple Command Plugin

**Package: @daltoncli-plugin-greeting**

`package.json`:

```json
{
  "name": "@daltoncli-plugin-greeting",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "description": "Simple greeting commands for Dalton CLI"
}
```

`index.js`:

```javascript
export const commands = [
  {
    name: 'greet',
    description: 'Greet someone with a customizable message',
    action: (name, options) => {
      const greeting = options.formal ? 'Good day' : 'Hello';
      const punctuation = options.enthusiastic ? '!' : '.';
      console.log(`${greeting}, ${name}${punctuation}`);
    },
    options: [
      {
        flags: '-f, --formal',
        description: 'Use formal greeting',
        defaultValue: false
      },
      {
        flags: '-e, --enthusiastic',
        description: 'Add enthusiasm',
        defaultValue: false
      }
    ]
  },
  {
    name: 'farewell',
    description: 'Say goodbye',
    action: (name = 'friend') => {
      console.log(`Goodbye, ${name}! See you later.`);
    }
  }
];
```

**Usage:**

```bash
dalton greet Alice
# Output: Hello, Alice.

dalton greet Alice --formal --enthusiastic
# Output: Good day, Alice!

dalton farewell
# Output: Goodbye, friend! See you later.
```

### Example 2: Simple Tool Plugin

**Package: @daltoncli-plugin-math**

`package.json`:

```json
{
  "name": "@daltoncli-plugin-math",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "description": "Mathematical tools for Dalton CLI AI"
}
```

`index.js`:

```javascript
export const tools = [
  {
    name: 'add',
    description: 'Add two or more numbers',
    parameters: {
      type: 'object',
      properties: {
        numbers: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of numbers to add',
          minItems: 2
        }
      },
      required: ['numbers']
    },
    func: ({ numbers }) => {
      return numbers.reduce((sum, num) => sum + num, 0);
    }
  },
  {
    name: 'multiply',
    description: 'Multiply two or more numbers',
    parameters: {
      type: 'object',
      properties: {
        numbers: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of numbers to multiply',
          minItems: 2
        }
      },
      required: ['numbers']
    },
    func: ({ numbers }) => {
      return numbers.reduce((product, num) => product * num, 1);
    }
  },
  {
    name: 'calculate_average',
    description: 'Calculate the average of numbers',
    parameters: {
      type: 'object',
      properties: {
        numbers: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of numbers',
          minItems: 1
        }
      },
      required: ['numbers']
    },
    func: ({ numbers }) => {
      const sum = numbers.reduce((a, b) => a + b, 0);
      return sum / numbers.length;
    }
  }
];
```

**Usage:**

The AI can now use these tools:

```
User: What's 15 + 27 + 33?
AI: [Uses add tool] The sum is 75.

User: Calculate the average of 10, 20, 30, 40, 50
AI: [Uses calculate_average tool] The average is 30.
```

### Example 3: Combined Plugin (Commands + Tools)

**Package: @daltoncli-plugin-fileops**

`package.json`:

```json
{
  "name": "@daltoncli-plugin-fileops",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "description": "File operations plugin for Dalton CLI"
}
```

`index.js`:

```javascript
import fs from 'fs';
import path from 'path';

// CLI Commands
export const commands = [
  {
    name: 'count-files',
    description: 'Count files in a directory',
    action: async (directory = '.', options) => {
      try {
        const files = fs.readdirSync(directory);
        const count = files.length;

        console.log(`Found ${count} files in ${directory}`);

        if (options.detailed) {
          const stats = {
            files: files.filter(f => fs.statSync(path.join(directory, f)).isFile()).length,
            directories: files.filter(f => fs.statSync(path.join(directory, f)).isDirectory()).length
          };
          console.log(`Files: ${stats.files}, Directories: ${stats.directories}`);
        }
      } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
    },
    options: [
      {
        flags: '-d, --detailed',
        description: 'Show detailed breakdown',
        defaultValue: false
      }
    ]
  }
];

// AI Tools
export const tools = [
  {
    name: 'read_file_lines',
    description: 'Read specific lines from a file',
    parameters: {
      type: 'object',
      properties: {
        filepath: {
          type: 'string',
          description: 'Path to the file'
        },
        startLine: {
          type: 'number',
          description: 'Starting line number (1-based)',
          minimum: 1
        },
        endLine: {
          type: 'number',
          description: 'Ending line number (1-based)',
          minimum: 1
        }
      },
      required: ['filepath', 'startLine', 'endLine']
    },
    func: ({ filepath, startLine, endLine }) => {
      try {
        const content = fs.readFileSync(filepath, 'utf-8');
        const lines = content.split('\n');
        const selectedLines = lines.slice(startLine - 1, endLine);
        return selectedLines.join('\n');
      } catch (error) {
        return `Error reading file: ${error.message}`;
      }
    }
  },
  {
    name: 'get_file_info',
    description: 'Get information about a file',
    parameters: {
      type: 'object',
      properties: {
        filepath: {
          type: 'string',
          description: 'Path to the file'
        }
      },
      required: ['filepath']
    },
    func: ({ filepath }) => {
      try {
        const stats = fs.statSync(filepath);
        return {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile()
        };
      } catch (error) {
        return { error: error.message };
      }
    }
  }
];
```

**Usage:**

```bash
# Use the command
dalton count-files ./src --detailed
# Output: Found 25 files in ./src
#         Files: 20, Directories: 5

# AI can use the tools
User: What's in lines 10-20 of config.json?
AI: [Uses read_file_lines tool] Here's the content...

User: How big is package.json?
AI: [Uses get_file_info tool] The file is 1,234 bytes...
```

### Example 4: Real-World Plugin - Database Tools

**Package: @daltoncli-plugin-database**

`index.js`:

```javascript
import { createConnection } from 'mysql2/promise';

let connection = null;

// Helper function to get/create connection
async function getConnection() {
  if (!connection) {
    connection = await createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'test'
    });
  }
  return connection;
}

export const commands = [
  {
    name: 'db-status',
    description: 'Check database connection status',
    action: async () => {
      try {
        const conn = await getConnection();
        const [rows] = await conn.query('SELECT 1 + 1 AS result');
        console.log('Database connection: OK');
        console.log(`Test query result: ${rows[0].result}`);
      } catch (error) {
        console.error('Database connection: FAILED');
        console.error(error.message);
        process.exit(1);
      }
    }
  },
  {
    name: 'db-tables',
    description: 'List all database tables',
    action: async () => {
      try {
        const conn = await getConnection();
        const [tables] = await conn.query('SHOW TABLES');
        console.log('Database tables:');
        tables.forEach(table => {
          console.log(`  - ${Object.values(table)[0]}`);
        });
      } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    }
  }
];

export const tools = [
  {
    name: 'query_database',
    description: 'Execute a SELECT query on the database',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'SQL SELECT query to execute'
        },
        limit: {
          type: 'number',
          description: 'Maximum rows to return',
          default: 100,
          minimum: 1,
          maximum: 1000
        }
      },
      required: ['query']
    },
    func: async ({ query, limit = 100 }) => {
      try {
        // Security: Only allow SELECT queries
        if (!query.trim().toLowerCase().startsWith('select')) {
          return { error: 'Only SELECT queries are allowed' };
        }

        const conn = await getConnection();
        const limitedQuery = `${query} LIMIT ${limit}`;
        const [rows] = await conn.query(limitedQuery);

        return {
          rowCount: rows.length,
          data: rows
        };
      } catch (error) {
        return { error: error.message };
      }
    },
    isNetworkTool: true
  },
  {
    name: 'count_records',
    description: 'Count records in a table with optional filter',
    parameters: {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          description: 'Table name'
        },
        whereClause: {
          type: 'string',
          description: 'Optional WHERE clause (without WHERE keyword)',
          default: ''
        }
      },
      required: ['table']
    },
    func: async ({ table, whereClause = '' }) => {
      try {
        const conn = await getConnection();
        const query = whereClause
          ? `SELECT COUNT(*) as count FROM ${table} WHERE ${whereClause}`
          : `SELECT COUNT(*) as count FROM ${table}`;

        const [rows] = await conn.query(query);
        return rows[0].count;
      } catch (error) {
        return { error: error.message };
      }
    },
    isNetworkTool: true
  }
];
```

---

## Best Practices

### Naming Conventions

**Plugin names:**
- Use lowercase with hyphens: `@daltoncli-plugin-my-tool`
- Be descriptive: `@daltoncli-plugin-aws-deploy` not `@daltoncli-plugin-ad`
- Avoid generic names: `@daltoncli-plugin-database-mysql` not `@daltoncli-plugin-db`

**Command names:**
- Use kebab-case: `deploy-app`, `check-status`
- Be specific: `build-docker-image` not `build`
- Avoid conflicts with built-in commands

**Tool names:**
- Use snake_case: `fetch_user_data`, `calculate_total`
- Be descriptive: `search_products_by_category` not `search`
- Prefix with domain if needed: `db_query`, `api_call`

### Error Handling

**Commands:**

```javascript
{
  name: 'risky-operation',
  description: 'Perform a risky operation',
  action: async (input) => {
    try {
      // Validate input
      if (!input) {
        console.error('Error: Input is required');
        process.exit(1);
      }

      // Perform operation
      const result = await performOperation(input);
      console.log('Success:', result);

    } catch (error) {
      console.error('Operation failed:', error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}
```

**Tools:**

```javascript
{
  name: 'safe_tool',
  description: 'A tool with proper error handling',
  parameters: { /* ... */ },
  func: async (params) => {
    try {
      // Validate parameters
      if (!params.required_field) {
        return {
          success: false,
          error: 'required_field is missing'
        };
      }

      // Perform operation
      const result = await doSomething(params);

      return {
        success: true,
        data: result
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
```

### Input Validation

**Always validate inputs:**

```javascript
// Command validation
action: (url, options) => {
  // Type validation
  if (typeof url !== 'string') {
    console.error('Error: URL must be a string');
    process.exit(1);
  }

  // Format validation
  try {
    new URL(url);
  } catch {
    console.error('Error: Invalid URL format');
    process.exit(1);
  }

  // Range validation
  if (options.port && (options.port < 1 || options.port > 65535)) {
    console.error('Error: Port must be between 1 and 65535');
    process.exit(1);
  }

  // Proceed with validated input
}

// Tool validation (use JSON Schema when possible)
parameters: {
  type: 'object',
  properties: {
    email: {
      type: 'string',
      pattern: '^[^@]+@[^@]+\\.[^@]+$',
      description: 'Valid email address'
    },
    age: {
      type: 'number',
      minimum: 0,
      maximum: 120,
      description: 'Age in years'
    }
  },
  required: ['email']
}
```

### Security Considerations

**1. Sanitize user input:**

```javascript
// Bad - vulnerable to injection
const query = `SELECT * FROM users WHERE name = '${userInput}'`;

// Good - use parameterized queries
const query = 'SELECT * FROM users WHERE name = ?';
const [rows] = await connection.query(query, [userInput]);
```

**2. Validate file paths:**

```javascript
import path from 'path';

function validatePath(filepath) {
  const resolved = path.resolve(filepath);
  const allowed = path.resolve('./data');

  if (!resolved.startsWith(allowed)) {
    throw new Error('Access denied: Path outside allowed directory');
  }

  return resolved;
}
```

**3. Protect sensitive data:**

```javascript
// Bad - exposing credentials
console.log('API Key:', process.env.API_KEY);

// Good - mask sensitive data
console.log('API Key:', '***' + process.env.API_KEY.slice(-4));
```

**4. Limit network access:**

```javascript
{
  name: 'api_call',
  description: 'Call external API',
  parameters: { /* ... */ },
  func: async ({ url }) => {
    // Whitelist allowed domains
    const allowedDomains = ['api.example.com', 'data.example.org'];
    const urlObj = new URL(url);

    if (!allowedDomains.includes(urlObj.hostname)) {
      return { error: 'Domain not allowed' };
    }

    // Proceed with request
  },
  isNetworkTool: true
}
```

### Performance Optimization

**1. Cache expensive operations:**

```javascript
const cache = new Map();

{
  name: 'expensive_calculation',
  description: 'Perform expensive calculation with caching',
  parameters: { /* ... */ },
  func: async (params) => {
    const cacheKey = JSON.stringify(params);

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const result = await performExpensiveCalculation(params);
    cache.set(cacheKey, result);

    return result;
  }
}
```

**2. Use streaming for large data:**

```javascript
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

action: async (filepath) => {
  const stream = createReadStream(filepath);
  const rl = createInterface({ input: stream });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    // Process line by line instead of loading entire file
  }

  console.log(`Processed ${lineCount} lines`);
}
```

**3. Implement timeouts:**

```javascript
func: async (params) => {
  const timeout = 5000; // 5 seconds

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Operation timed out')), timeout)
  );

  const operationPromise = performOperation(params);

  try {
    return await Promise.race([operationPromise, timeoutPromise]);
  } catch (error) {
    return { error: error.message };
  }
}
```

### Testing

**Create tests for your plugin:**

`test/commands.test.js`:

```javascript
import { describe, it, expect, vi } from 'vitest';
import { commands } from '../index.js';

describe('Plugin Commands', () => {
  it('should execute greet command', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const greetCommand = commands.find(cmd => cmd.name === 'greet');

    greetCommand.action('Alice', { formal: false, enthusiastic: false });

    expect(consoleSpy).toHaveBeenCalledWith('Hello, Alice.');
  });
});
```

`test/tools.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { tools } from '../index.js';

describe('Plugin Tools', () => {
  it('should add numbers correctly', () => {
    const addTool = tools.find(tool => tool.name === 'add');
    const result = addTool.func({ numbers: [1, 2, 3, 4, 5] });

    expect(result).toBe(15);
  });

  it('should validate parameters', () => {
    const addTool = tools.find(tool => tool.name === 'add');

    expect(addTool.parameters.properties.numbers.minItems).toBe(2);
    expect(addTool.parameters.required).toContain('numbers');
  });
});
```

### Documentation

**Include a comprehensive README:**

```markdown
# @daltoncli-plugin-example

Description of your plugin.

## Installation

\`\`\`bash
npm install @daltoncli-plugin-example
\`\`\`

## Commands

### command-name

Description of the command.

**Usage:**
\`\`\`bash
dalton command-name [options]
\`\`\`

**Options:**
- `-o, --option` - Description

**Examples:**
\`\`\`bash
dalton command-name --option value
\`\`\`

## Tools

### tool_name

Description of the tool.

**Parameters:**
- `param1` (string, required) - Description
- `param2` (number, optional) - Description

**Returns:** Description of return value

## Configuration

Environment variables or configuration needed.

## License

MIT
```

---

## Troubleshooting

### Plugin Not Loading

**Problem:** Plugin not detected by Dalton CLI

**Checklist:**
1. Package name starts with `@daltoncli-plugin-`
2. Plugin is installed in `node_modules`
3. `package.json` has `"type": "module"`
4. Main file exports `commands` or `tools`

**Debug steps:**

```bash
# Check if plugin is installed
npm list | grep daltoncli-plugin

# Check plugin directory structure
ls node_modules/@daltoncli-plugin-yourplugin

# Check for syntax errors
node --check node_modules/@daltoncli-plugin-yourplugin/index.js

# Enable debug logging
DEBUG=dalton:* dalton --help
```

### Command Not Appearing

**Problem:** Plugin loads but command doesn't show in `dalton --help`

**Causes:**
1. Command export format incorrect
2. Command name conflicts with existing command
3. Missing required fields (`name`, `description`, `action`)

**Solution:**

```javascript
// Verify export format
export const commands = [  // Must be named export
  {
    name: 'unique-name',      // Required, must be unique
    description: 'Clear description',  // Required
    action: () => { /* ... */ }  // Required
  }
];

// Check for conflicts
dalton --help | grep "your-command-name"
```

### Tool Not Available to AI

**Problem:** Tool loads but AI can't use it

**Causes:**
1. Tool export format incorrect
2. Invalid parameter schema
3. `func` is not a function

**Solution:**

```javascript
// Verify export format
export const tools = [  // Must be named export
  {
    name: 'tool_name',        // Required
    description: 'Description',  // Required
    parameters: {             // Required, valid JSON Schema
      type: 'object',
      properties: { /* ... */ }
    },
    func: (params) => { /* ... */ }  // Required, must be function
  }
];

// Test tool function directly
import { tools } from './index.js';
const result = tools[0].func({ test: 'value' });
console.log(result);
```

### Module Import Errors

**Problem:** `Error [ERR_MODULE_NOT_FOUND]` or similar

**Causes:**
1. Missing `"type": "module"` in `package.json`
2. Using CommonJS syntax in ES module
3. Missing file extensions in imports

**Solutions:**

```json
// package.json - Add this
{
  "type": "module"
}
```

```javascript
// Use ES module syntax
import fs from 'fs';  // Not: const fs = require('fs')
export const commands = [];  // Not: module.exports = { commands }

// Include file extensions
import { helper } from './utils.js';  // Not: './utils'
```

### Parameter Validation Failing

**Problem:** Tool rejects valid parameters

**Cause:** JSON Schema validation too strict or incorrect

**Solution:**

```javascript
// Debug schema validation
import Ajv from 'ajv';
const ajv = new Ajv();

const schema = {
  type: 'object',
  properties: { /* your schema */ }
};

const validate = ajv.compile(schema);
const valid = validate({ /* test data */ });

if (!valid) {
  console.log(validate.errors);
}
```

### Async/Promise Issues

**Problem:** Tool returns `[object Promise]` instead of result

**Cause:** Async function not properly awaited

**Solution:**

```javascript
// Wrong - missing async
func: (params) => {
  return fetchData(params);  // Returns Promise
}

// Correct - async function
func: async (params) => {
  return await fetchData(params);  // Returns actual data
}

// Or use .then()
func: (params) => {
  return fetchData(params).then(data => data);
}
```

### Environment Variables Not Working

**Problem:** `process.env.VARIABLE` is undefined

**Solutions:**

```javascript
// 1. Check variable is set
console.log('Available env vars:', Object.keys(process.env));

// 2. Provide defaults
const apiKey = process.env.API_KEY || 'default-key';

// 3. Load from .env file
import dotenv from 'dotenv';
dotenv.config();

// 4. Document required variables
if (!process.env.REQUIRED_VAR) {
  console.error('Error: REQUIRED_VAR environment variable not set');
  process.exit(1);
}
```

---

## API Reference

### DaltonCLIPlugin Interface

Main plugin interface that plugins must export.

```typescript
interface DaltonCLIPlugin {
  commands?: DaltonCLICommand[];  // Optional array of CLI commands
  tools?: ToolDefinition[];       // Optional array of AI tools
}
```

**Example:**

```javascript
export const commands = [ /* ... */ ];  // Optional
export const tools = [ /* ... */ ];     // Optional
```

At least one of `commands` or `tools` must be provided.

---

### DaltonCLICommand Interface

Defines a custom CLI command.

```typescript
interface DaltonCLICommand {
  name: string;
  description: string;
  action: (...args: any[]) => Promise<void> | void;
  options?: Array<{
    flags: string;
    description: string;
    defaultValue?: any;
  }>;
}
```

#### Properties

**`name`** (string, required)
- Command name as it appears in CLI
- Must be unique across all plugins
- Use kebab-case: `deploy-app`, `check-status`

**`description`** (string, required)
- Brief description shown in help text
- Should be one sentence
- Appears in `dalton --help` output

**`action`** (function, required)
- Function executed when command is invoked
- Can be sync or async
- Receives arguments and options
- Signature: `(arg1, arg2, ..., options) => void | Promise<void>`

**`options`** (array, optional)
- Array of command-line options
- Each option has `flags`, `description`, and optional `defaultValue`
- Uses Commander.js flag syntax

#### Action Function Arguments

```javascript
action: (arg1, arg2, options) => {
  // arg1, arg2: positional arguments
  // options: object with all option values
}
```

**Example:**

```bash
dalton deploy production --force --timeout 30
```

```javascript
{
  name: 'deploy',
  action: (environment, options) => {
    console.log(environment);    // 'production'
    console.log(options.force);   // true
    console.log(options.timeout); // 30
  },
  options: [
    { flags: '-f, --force', description: 'Force deploy' },
    { flags: '-t, --timeout <seconds>', description: 'Timeout' }
  ]
}
```

---

### ToolDefinition Interface

Defines an AI tool that can be called by the language model.

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  func: Function;
  isNetworkTool?: boolean;
}
```

#### Properties

**`name`** (string, required)
- Tool name used by AI
- Must be unique across all tools
- Use snake_case: `fetch_user_data`, `calculate_total`

**`description`** (string, required)
- Clear description of what the tool does
- Used by AI to decide when to use the tool
- Be specific and concise

**`parameters`** (object, required)
- JSON Schema object defining tool parameters
- Must include `type: 'object'`
- Define `properties` and `required` fields
- See JSON Schema specification for full options

**`func`** (function, required)
- Function that implements the tool
- Receives parameters as single object argument
- Can be sync or async
- Should return serializable data
- Signature: `(params: object) => any | Promise<any>`

**`isNetworkTool`** (boolean, optional)
- Set to `true` if tool makes network requests
- Used for rate limiting and monitoring
- Defaults to `false`

#### Function Return Values

Tools should return:
- Primitive values: strings, numbers, booleans
- Plain objects: `{ key: value }`
- Arrays: `[item1, item2]`
- Error objects: `{ error: 'message' }`

**Avoid returning:**
- Class instances
- Functions
- Circular references
- Non-serializable objects

---

### JSON Schema for Parameters

Tool parameters use JSON Schema Draft 7.

#### Basic Structure

```javascript
parameters: {
  type: 'object',
  properties: {
    // Define parameters here
  },
  required: ['param1', 'param2']  // Array of required parameter names
}
```

#### Common Patterns

**String parameter:**

```javascript
{
  type: 'string',
  description: 'Description',
  minLength: 1,
  maxLength: 100,
  pattern: '^[a-z]+$',  // Regex pattern
  enum: ['option1', 'option2']  // Allowed values
}
```

**Number parameter:**

```javascript
{
  type: 'number',
  description: 'Description',
  minimum: 0,
  maximum: 100,
  multipleOf: 5,  // Must be multiple of 5
  default: 10
}
```

**Boolean parameter:**

```javascript
{
  type: 'boolean',
  description: 'Description',
  default: false
}
```

**Array parameter:**

```javascript
{
  type: 'array',
  description: 'Description',
  items: {
    type: 'string'  // Array item type
  },
  minItems: 1,
  maxItems: 10,
  uniqueItems: true  // No duplicates
}
```

**Object parameter:**

```javascript
{
  type: 'object',
  description: 'Description',
  properties: {
    nested1: { type: 'string' },
    nested2: { type: 'number' }
  },
  required: ['nested1']
}
```

**Optional parameter with default:**

```javascript
{
  type: 'string',
  description: 'Description',
  default: 'default-value'
}
```

---

### Plugin Loader

The plugin loader automatically discovers and loads plugins.

#### Location

`src/core/plugin_loader.ts`

#### Discovery Process

1. Scans `node_modules` directory
2. Finds packages matching `@daltoncli-plugin-*` pattern
3. Dynamically imports each plugin module
4. Validates exports (`commands` and/or `tools`)
5. Returns array of loaded plugins

#### Loading Function

```typescript
function loadPlugins(baseDir: string): Promise<DaltonCLIPlugin[]>
```

**Parameters:**
- `baseDir`: Directory containing `node_modules`

**Returns:**
- Promise resolving to array of loaded plugins

**Logs:**
- `"Loaded plugin: @daltoncli-plugin-name"` on success
- `"Plugin X does not export commands or tools"` for invalid plugins
- `"Failed to load plugin X"` on error

---

### Plugin Naming Requirements

**Required format:**

```
@daltoncli-plugin-<name>
```

**Examples of valid names:**
- `@daltoncli-plugin-database`
- `@daltoncli-plugin-aws-deploy`
- `@daltoncli-plugin-math-tools`

**Examples of invalid names:**
- `daltoncli-plugin-database` (missing `@`)
- `@dalton-plugin-database` (wrong prefix)
- `@daltoncli-db` (missing `plugin` keyword)

---

### Export Requirements

Plugins must use ES module named exports:

```javascript
// Required named exports
export const commands = [ /* ... */ ];
export const tools = [ /* ... */ ];

// NOT: default export
// export default { commands, tools };

// NOT: CommonJS
// module.exports = { commands, tools };
```

At least one of `commands` or `tools` must be exported with a non-empty array.

---

## Additional Resources

### Related Documentation

- [Dalton CLI User Guide](./USER_GUIDE.md) - General CLI usage
- [Provider Wrapper API](./PROVIDER_WRAPPER.md) - AI provider integration
- [Configuration Guide](./CONFIGURATION.md) - CLI configuration

### External References

- [Commander.js Documentation](https://github.com/tj/commander.js) - CLI framework used for commands
- [JSON Schema](https://json-schema.org/) - Parameter schema specification
- [npm Package Guidelines](https://docs.npmjs.com/packages-and-modules) - npm package best practices

### Example Plugins

Check out these example plugins for reference:

- `@daltoncli-plugin-example-basic` - Minimal plugin example
- `@daltoncli-plugin-example-full` - Comprehensive plugin with all features
- `@daltoncli-plugin-example-testing` - Plugin with full test coverage

### Getting Help

- GitHub Issues: [Report bugs or request features](https://github.com/dalton/cli/issues)
- Discussions: [Ask questions and share plugins](https://github.com/dalton/cli/discussions)
- Discord: [Join the community](https://discord.gg/daltoncli)

---

## Version History

**v1.0.0** - Initial plugin system release
- Basic command and tool support
- Auto-discovery from node_modules
- JSON Schema parameter validation

---

## License

This documentation is part of Dalton CLI and is licensed under the MIT License.

---

**Happy Plugin Building!**

For questions or feedback, please open an issue on GitHub or join our community Discord.
