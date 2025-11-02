# Session Management Quick Reference

## Command Options

### List All Sessions
```bash
dalton-cli shekinah chat --list-sessions
```
Shows all saved sessions with modification date and message count.

### Custom History Limit
```bash
dalton-cli shekinah chat --max-history <number>
```
- **Range:** 1 to 1000 messages
- **Default:** 10 messages
- Controls context window size (not saved session size)

## Common Usage Patterns

### Quick Session Check
```bash
# See what sessions are available
dalton-cli shekinah chat --list-sessions
```

### Start with Custom Context
```bash
# Small context for quick tasks
dalton-cli shekinah chat --max-history 5

# Large context for complex work
dalton-cli shekinah chat --max-history 200
```

### Resume with Custom History
```bash
# Resume last session with 50 message context
dalton-cli shekinah chat --resume --max-history 50
```

### Load Specific Session
```bash
# Load and set custom context
dalton-cli shekinah chat --load my_session --max-history 100
```

### Save with Custom Settings
```bash
# Save session with large context
dalton-cli shekinah chat --save project_work --max-history 150
```

## Auto-Rotation Behavior

**Threshold:** 100 messages

When a session exceeds 100 messages:
1. Current session is archived with timestamp
2. New session starts with system prompt only
3. You continue working in the fresh session

**Example:**
- Before: `my_session` (101 messages)
- After rotation:
  - Archived: `my_session_archived_2025-10-20T14-30-45-123Z` (101 messages)
  - Current: `my_session` (1 message)

## History vs Session Size

**Session Size (on disk):**
- All messages are always saved
- No limit (auto-rotates at 100 messages)
- Can be viewed with `--list-sessions`

**History Limit (in context):**
- Number of messages sent to AI
- Controlled by `--max-history`
- Default: 10 messages
- Affects: API cost, response time, context retention

## Validation Rules

### Max History
- ✅ Valid: 1, 10, 50, 100, 500, 1000
- ❌ Invalid: 0, -1, 1001, 2000

**Error message:**
```
Error: --max-history must be between 1 and 1000.
```

## Tips

### When to Use Small Context (1-20)
- Quick questions
- Simple debugging
- Fast responses needed
- Low API costs desired

### When to Use Medium Context (20-100)
- Regular development work
- Multi-file refactoring
- Balanced cost/performance

### When to Use Large Context (100-1000)
- Complex architecture discussions
- Long debugging sessions
- Maximum context retention
- Higher costs acceptable

## Session File Locations

**Windows:**
```
C:\Users\<username>\.dalton-cli\sessions\
```

**macOS/Linux:**
```
/home/<username>/.dalton-cli/sessions/
```

## Examples by Use Case

### Debugging Session
```bash
# List sessions to find the right one
dalton-cli shekinah chat --list-sessions

# Load debugging session with focused context
dalton-cli shekinah chat --load bug_fix --max-history 20
```

### Code Review
```bash
# Large context for comprehensive review
dalton-cli shekinah chat --save code_review --max-history 200
```

### Quick Help
```bash
# Minimal context for fast responses
dalton-cli shekinah chat --max-history 3
```

### Long-term Project
```bash
# Medium context that will auto-rotate at 100 messages
dalton-cli shekinah chat --save backend_refactor --max-history 50
```

## Combining Options

All options can be combined:

```bash
# Resume last session with custom history and file context
dalton-cli shekinah chat --resume --max-history 30 --file ./context.txt

# Load session, set history, and save under new name
dalton-cli shekinah chat --load old_session --max-history 100 --save new_session

# Everything at once
dalton-cli shekinah chat \
  --load my_session \
  --save my_session_v2 \
  --max-history 75 \
  --file ./requirements.txt
```

## Troubleshooting

### Can't find a session
```bash
# List all to verify name
dalton-cli shekinah chat --list-sessions
```

### Session too large (slow responses)
```bash
# Reduce context window
dalton-cli shekinah chat --load large_session --max-history 20
```

### Need more context
```bash
# Increase context window
dalton-cli shekinah chat --resume --max-history 200
```

### Session auto-rotated unexpectedly
- This is normal at 100 messages
- Archived session is preserved
- To change threshold, edit `MAX_SESSION_SIZE` in `src/commands/chat.ts`

## For More Information

See `docs/SESSION_MANAGEMENT.md` for detailed documentation.
