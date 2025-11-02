# Enhanced Session Management

This document describes the enhanced session handling features available in the Dalton CLI chat command.

## Features Overview

The chat command now includes three major enhancements:

1. **Session Listing** - View all saved sessions with metadata
2. **Auto-Rotation** - Automatically archive large sessions
3. **Configurable History Limit** - Customize context window size

---

## 1. Session Listing

### Usage

List all available sessions with metadata:

```bash
dalton-cli shekinah chat --list-sessions
```

### Output Example

```
Available Sessions:
  - my_project_session
    Modified: 10/20/2025, 2:30:45 PM
    Messages: 45

  - debugging_session
    Modified: 10/19/2025, 4:15:22 PM
    Messages: 78

  - __last_session
    Modified: 10/20/2025, 3:10:11 PM
    Messages: 12
```

### Features

- Shows all `.json` session files in `~/.dalton-cli/sessions/`
- Displays last modification timestamp
- Shows total message count for each session
- Color-coded output for readability
- Handles empty sessions directory gracefully

### Use Cases

- Finding old sessions to resume
- Checking session size before loading
- Identifying sessions that may need cleanup
- Reviewing recent session activity

---

## 2. Auto-Rotation for Large Sessions

### Overview

When a session exceeds 100 messages, the system automatically:
1. Archives the current session with a timestamp
2. Creates a fresh session with just the system prompt
3. Continues the conversation in the new session

### How It Works

**Before rotation:**
- Session: `my_session` (101 messages)

**After rotation:**
- Archived: `my_session_archived_2025-10-20T14-30-45-123Z` (101 messages)
- Current: `my_session` (1 message - system prompt only)

### Benefits

- **Prevents memory issues** - Large sessions can cause performance problems
- **Maintains context** - Archives preserve full conversation history
- **Seamless transition** - Rotation happens automatically
- **No data loss** - All messages are preserved in archived sessions

### User Feedback

When rotation occurs, you'll see:

```
Session size limit reached (100 messages).
Archiving current session as: my_session_archived_2025-10-20T14-30-45-123Z
Starting fresh session with system prompt only.
```

### Configuration

The maximum session size is set to 100 messages. This constant is defined in:
- File: `src/commands/chat.ts`
- Constant: `MAX_SESSION_SIZE`

To modify, edit the constant value:

```typescript
const MAX_SESSION_SIZE: number = 100; // Change this value
```

### Archive Management

Archived sessions are regular session files and can be:
- Loaded with `--load` option
- Viewed with `--list-sessions`
- Deleted manually from `~/.dalton-cli/sessions/`

---

## 3. Configurable History Limit

### Overview

Control how many messages are kept in the AI's context window during a chat session.

### Usage

```bash
# Use default limit (10 messages)
dalton-cli shekinah chat

# Set custom limit (50 messages)
dalton-cli shekinah chat --max-history 50

# Maximum allowed limit (1000 messages)
dalton-cli shekinah chat --max-history 1000

# Minimum allowed limit (1 message)
dalton-cli shekinah chat --max-history 1
```

### Valid Range

- **Minimum:** 1 message
- **Maximum:** 1000 messages
- **Default:** 10 messages (HISTORY_LIMIT constant)

### How History Truncation Works

The chat system maintains two types of history:

1. **Full Session History** - All messages saved to disk
2. **Context Window** - Messages sent to the AI (limited by --max-history)

**Example with --max-history 5:**

```
Full Session (15 messages):
[0] System prompt
[1] User: "Hello"
[2] Assistant: "Hi there"
[3] User: "What's the weather?"
[4] Assistant: "I can't check weather"
[5] User: "Tell me a joke"
[6] Assistant: "Why did the..."
[7] User: "Another joke"
[8] Assistant: "What do you..."
[9] User: "Explain recursion"
[10] Assistant: "Recursion is..."
[11] User: "Show me code"
[12] Assistant: "Here's an example..."
[13] User: "Thanks"
[14] Assistant: "You're welcome"

Context Window sent to AI (6 messages):
[0] System prompt (always kept)
[10] Assistant: "Recursion is..."
[11] User: "Show me code"
[12] Assistant: "Here's an example..."
[13] User: "Thanks"
[14] Assistant: "You're welcome"
```

### Benefits

**Small Limits (1-20 messages):**
- Faster API responses
- Lower token costs
- Focused conversations
- Good for quick queries

**Medium Limits (20-100 messages):**
- Balanced performance and context
- Good for most development tasks
- Maintains relevant conversation history

**Large Limits (100-1000 messages):**
- Maximum context retention
- Complex, long-running discussions
- Code refactoring across multiple files
- Higher token costs and slower responses

### Error Handling

Invalid values are rejected with clear error messages:

```bash
$ dalton-cli shekinah chat --max-history 0
Error: --max-history must be between 1 and 1000.

$ dalton-cli shekinah chat --max-history 2000
Error: --max-history must be between 1 and 1000.
```

### Combining with Other Options

```bash
# Resume session with custom history limit
dalton-cli shekinah chat --resume --max-history 50

# Load specific session with large context window
dalton-cli shekinah chat --load my_session --max-history 200

# Save session with custom history limit
dalton-cli shekinah chat --save important_session --max-history 100
```

---

## Complete Usage Examples

### Basic Session Management

```bash
# List all sessions
dalton-cli shekinah chat --list-sessions

# Start new session with custom history
dalton-cli shekinah chat --max-history 30 --save project_work

# Resume last session with larger context
dalton-cli shekinah chat --resume --max-history 100

# Load specific session
dalton-cli shekinah chat --load debugging_session --max-history 50
```

### Advanced Workflows

**Long-term project work:**
```bash
# Day 1: Start session with medium context
dalton-cli shekinah chat --save backend_refactor --max-history 50

# Day 2: Resume with same context size
dalton-cli shekinah chat --load backend_refactor --max-history 50

# Note: Session auto-rotates at 100 messages, preserving history
```

**Quick debugging:**
```bash
# Small context for focused debugging
dalton-cli shekinah chat --max-history 5 --save quick_debug
```

**Code review:**
```bash
# Large context for comprehensive review
dalton-cli shekinah chat --max-history 200 --save code_review
```

---

## Session Storage

### Location

All sessions are stored in:
```
~/.dalton-cli/sessions/
```

On Windows:
```
C:\Users\<username>\.dalton-cli\sessions\
```

On macOS/Linux:
```
/home/<username>/.dalton-cli/sessions/
```

### File Format

Sessions are stored as JSON files with the structure:

```json
[
  {
    "role": "system",
    "content": "System prompt..."
  },
  {
    "role": "user",
    "content": "User message"
  },
  {
    "role": "assistant",
    "content": "AI response"
  },
  {
    "role": "tool",
    "tool_call_id": "call_123",
    "name": "execute_shell_command",
    "content": "Tool output"
  }
]
```

### Manual Management

You can manually:
- **View sessions:** Open JSON files in any text editor
- **Delete sessions:** Remove unwanted `.json` files
- **Backup sessions:** Copy `.json` files to another location
- **Share sessions:** Send session files to colleagues

---

## Technical Details

### Implementation Files

- **Command Handler:** `src/commands/chat.ts`
- **CLI Options:** `src/index.ts`
- **Tests:** `tests/chat.test.ts`

### Key Functions

**`listSessions()`**
- Lists all available sessions
- Reads session directory
- Displays formatted output with metadata

**`rotateSessionIfNeeded(sessionName, history)`**
- Checks if session exceeds MAX_SESSION_SIZE (100)
- Archives large session with timestamp
- Returns 'new_rotation' signal if rotation occurred

**`chatLoop(provider, model, history, sessionName, maxHistory)`**
- Main chat interaction loop
- Accepts maxHistory parameter (default: HISTORY_LIMIT)
- Truncates context window while preserving full history
- Handles rotation on exit

### Constants

```typescript
HISTORY_LIMIT = 10           // Default history limit
MAX_SESSION_SIZE = 100       // Auto-rotation threshold
SESSIONS_DIR = '~/.dalton-cli/sessions/'
LAST_SESSION_NAME = '__last_session'
```

---

## Best Practices

### Session Naming

**Good names:**
- `feature_authentication`
- `bug_fix_api_endpoint`
- `code_review_2025_10_20`
- `refactor_database_layer`

**Avoid:**
- Generic names like `session1`, `test`, `temp`
- Special characters that may cause file system issues
- Extremely long names (keep under 50 characters)

### History Limit Selection

**Small projects:** 10-30 messages
**Medium projects:** 30-100 messages
**Large projects:** 100-500 messages
**Maximum context:** 500-1000 messages (use sparingly due to cost)

### Session Hygiene

- **Review sessions monthly** - Use `--list-sessions` to identify old sessions
- **Archive important sessions** - Copy critical session files to project directories
- **Delete obsolete sessions** - Remove sessions from completed projects
- **Use descriptive names** - Make sessions easy to identify later

---

## Troubleshooting

### "No sessions directory found"

**Cause:** No sessions have been created yet
**Solution:** Start a chat session with `--save` option

### Session list is empty

**Cause:** All session files have been deleted
**Solution:** Sessions are created automatically when you use the chat command

### Rotation not working

**Cause:** Session name not specified or saved
**Solution:** Use `--save` option to enable rotation

### Max history validation fails

**Cause:** Value outside 1-1000 range
**Solution:** Provide a value between 1 and 1000

---

## FAQ

**Q: Can I change the rotation threshold from 100 messages?**
A: Yes, edit the `MAX_SESSION_SIZE` constant in `src/commands/chat.ts`

**Q: Are archived sessions automatically deleted?**
A: No, you must manually delete archived sessions if needed

**Q: Does --max-history affect what's saved to disk?**
A: No, all messages are saved. It only affects the AI's context window

**Q: Can I resume an archived session?**
A: Yes, use `--load session_name_archived_timestamp`

**Q: What happens if I exceed maxHistory during a session?**
A: The system automatically truncates the context window while keeping the full session saved

**Q: Is there a limit to how many sessions I can have?**
A: Only limited by your disk space. Each session is typically a few KB to a few MB

---

## Performance Considerations

### Token Usage

Higher --max-history values increase:
- API token consumption
- Response generation time
- Cost per request

### Memory Usage

Sessions with thousands of messages may:
- Take longer to load
- Consume more RAM
- Slow down file operations

### Best Practices

1. Use appropriate --max-history for your task
2. Regularly clean up old sessions
3. Archive sessions that exceed 1000 messages
4. Monitor API costs when using high limits

---

## Future Enhancements

Potential improvements being considered:

- Session search and filtering
- Session merge capability
- Automatic old session cleanup
- Session export to various formats
- Session statistics and analytics
- Configurable rotation threshold via CLI
- Session compression for large archives

---

## Support

For issues or feature requests, please:
1. Check existing sessions with `--list-sessions`
2. Review this documentation
3. Check the test file for usage examples
4. Report issues to the project maintainer
