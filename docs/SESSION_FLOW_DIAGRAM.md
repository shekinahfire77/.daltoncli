# Session Management Flow Diagram

## Feature Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Enhanced Session Handling                     │
├─────────────────────────────────────────────────────────────────┤
│  1. Session Listing     2. Auto-Rotation     3. History Limit   │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Session Listing Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  User executes: dalton-cli shekinah chat --list-sessions         │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
           ┌─────────────────────────┐
           │  Check sessions dir     │
           │  exists?                │
           └────────┬────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
    [NO]                    [YES]
     │                       │
     ▼                       ▼
Show "No                Read all
sessions               .json files
directory"                 │
                           ▼
                    ┌──────────────┐
                    │  Any files?  │
                    └──────┬───────┘
                           │
                ┌──────────┴──────────┐
                │                     │
                ▼                     ▼
             [NO]                  [YES]
              │                     │
              ▼                     ▼
         Show "No            For each file:
         saved              1. Get stats
         sessions"          2. Load session
                           3. Count messages
                                   │
                                   ▼
                           ┌───────────────┐
                           │  Display:     │
                           │  - Name       │
                           │  - Modified   │
                           │  - Messages   │
                           └───────────────┘
```

## 2. Auto-Rotation Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  User in chat session (with --save sessionName)                  │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
           ┌─────────────────────────┐
           │  User sends message     │
           │  Session history grows  │
           └────────┬────────────────┘
                    │
                    ▼
           ┌─────────────────────────┐
           │  User exits (Ctrl+C     │
           │  or types exit/quit)    │
           └────────┬────────────────┘
                    │
                    ▼
           ┌─────────────────────────────┐
           │  rotateSessionIfNeeded()    │
           │  Check: history.length > 100│
           └────────┬────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
    [NO]                    [YES]
     │                       │
     ▼                       ▼
Save session        ┌───────────────────────────┐
normally            │ 1. Generate timestamp     │
                    │ 2. Create archive name    │
                    │    session_archived_TIME  │
                    └────────┬──────────────────┘
                             │
                             ▼
                    ┌───────────────────────────┐
                    │ 3. Save full history to   │
                    │    archived session file  │
                    └────────┬──────────────────┘
                             │
                             ▼
                    ┌───────────────────────────┐
                    │ 4. Save only system       │
                    │    prompt to original     │
                    │    session name           │
                    └────────┬──────────────────┘
                             │
                             ▼
                    ┌───────────────────────────┐
                    │ 5. Show rotation messages │
                    │    to user                │
                    └───────────────────────────┘
```

## 3. History Limit Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  User starts chat with --max-history 50                          │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
           ┌─────────────────────────┐
           │  Validate maxHistory    │
           │  1 <= value <= 1000     │
           └────────┬────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
    [INVALID]              [VALID]
        │                      │
        ▼                      ▼
Show error          Set maxHistory = 50
and exit            Continue to chat
                           │
                           ▼
           ┌─────────────────────────────────┐
           │  Session History (in memory):   │
           │  [0] System prompt              │
           │  [1-60] Various messages        │
           │  Total: 61 messages             │
           └────────┬────────────────────────┘
                    │
                    ▼
           ┌─────────────────────────────────┐
           │  User sends new message         │
           │  Added to session history       │
           └────────┬────────────────────────┘
                    │
                    ▼
           ┌─────────────────────────────────┐
           │  Prepare AI request             │
           │  Check: history.length > 51?    │
           │  (maxHistory + 1 for system)    │
           └────────┬────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
    [NO]                    [YES]
     │                       │
     ▼                       ▼
Send all           ┌────────────────────────────┐
messages           │ Truncate context window:   │
to AI              │ Keep: [0] System prompt    │
                   │       [12-61] Last 50 msgs │
                   │ Drop: [1-11] Old messages  │
                   └────────┬───────────────────┘
                            │
                            ▼
                   ┌────────────────────────────┐
                   │ Send truncated history     │
                   │ to AI provider             │
                   └────────┬───────────────────┘
                            │
                            ▼
                   ┌────────────────────────────┐
                   │ Save FULL session history  │
                   │ (all 62 messages)          │
                   │ to disk                    │
                   └────────────────────────────┘

Note: Full history always saved, maxHistory only affects AI context
```

## Combined Feature Interaction

```
┌──────────────────────────────────────────────────────────────────┐
│  dalton-cli shekinah chat --save project --max-history 30        │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
           ┌─────────────────────────┐
           │  Initialize chat        │
           │  - maxHistory = 30      │
           │  - sessionName = project│
           └────────┬────────────────┘
                    │
                    ▼
           ┌─────────────────────────────────┐
           │  Chat Loop                      │
           │                                 │
           │  Each message:                  │
           │  1. Add to session history      │
           │  2. Truncate to 30 for AI       │
           │  3. Send to provider            │
           │  4. Save full history to disk   │
           └────────┬────────────────────────┘
                    │
                    ▼
           ┌─────────────────────────────────┐
           │  After 100 messages             │
           │  Session history = 101          │
           └────────┬────────────────────────┘
                    │
                    ▼
           ┌─────────────────────────────────┐
           │  User exits                     │
           │  rotateSessionIfNeeded()        │
           └────────┬────────────────────────┘
                    │
                    ▼
           ┌─────────────────────────────────┐
           │  Rotation triggered!            │
           │                                 │
           │  Saved:                         │
           │  - project_archived_TIMESTAMP   │
           │    (101 messages)               │
           │  - project                      │
           │    (1 message - system prompt)  │
           └─────────────────────────────────┘
                    │
                    ▼
           ┌─────────────────────────────────┐
           │  Next session:                  │
           │  dalton-cli shekinah chat       │
           │    --list-sessions              │
           └────────┬────────────────────────┘
                    │
                    ▼
           ┌─────────────────────────────────┐
           │  Shows:                         │
           │  - project                      │
           │    Modified: Just now           │
           │    Messages: 1                  │
           │                                 │
           │  - project_archived_TIMESTAMP   │
           │    Modified: Just now           │
           │    Messages: 101                │
           └─────────────────────────────────┘
```

## Session Storage Structure

```
~/.dalton-cli/sessions/
│
├── my_session.json
│   └── [System prompt, 45 messages]
│
├── __last_session.json
│   └── [System prompt, 12 messages]
│
├── debugging.json
│   └── [System prompt, 78 messages]
│
├── project_archived_2025-10-20T14-30-45-123Z.json
│   └── [System prompt, 101 messages] ← Archived
│
└── project.json
    └── [System prompt] ← Fresh after rotation
```

## Context Window vs Full Session

```
┌────────────────────────────────────────────────────────────────┐
│                      Session on Disk (Full)                    │
│  ~/.dalton-cli/sessions/my_session.json                        │
│                                                                │
│  [0]  System: "You are a helpful assistant..."                │
│  [1]  User: "Hello"                                            │
│  [2]  Assistant: "Hi there!"                                   │
│  [3]  User: "What is recursion?"                               │
│  [4]  Assistant: "Recursion is..."                             │
│  [5]  User: "Show me code"                                     │
│  [6]  Assistant: "Here's an example..."                        │
│  [7]  User: "Explain more"                                     │
│  [8]  Assistant: "Sure, let me..."                             │
│  [9]  User: "Thanks"                                            │
│  [10] Assistant: "You're welcome"                              │
│                                                                │
│  Total: 11 messages saved                                      │
└────────────────────────────────────────────────────────────────┘

           With --max-history 5
                    │
                    ▼

┌────────────────────────────────────────────────────────────────┐
│                  Context Sent to AI (Truncated)                │
│                                                                │
│  [0]  System: "You are a helpful assistant..."  ← Always kept │
│  [6]  Assistant: "Here's an example..."         ┐              │
│  [7]  User: "Explain more"                      │              │
│  [8]  Assistant: "Sure, let me..."              ├─ Last 5      │
│  [9]  User: "Thanks"                            │              │
│  [10] Assistant: "You're welcome"               ┘              │
│                                                                │
│  Total: 6 messages (1 system + 5 history)                      │
└────────────────────────────────────────────────────────────────┘

Messages [1-5] are saved to disk but not sent to AI
```

## Error Handling Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  User input: dalton-cli shekinah chat --max-history 2000         │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
           ┌─────────────────────────┐
           │  Validate maxHistory    │
           │  Is 2000 in [1-1000]?   │
           └────────┬────────────────┘
                    │
                    ▼
                  [NO]
                    │
                    ▼
           ┌─────────────────────────────────┐
           │  Show error message:            │
           │  "Error: --max-history must be  │
           │   between 1 and 1000."          │
           └────────┬────────────────────────┘
                    │
                    ▼
           ┌─────────────────────────┐
           │  Exit (return early)    │
           │  No chat session starts │
           └─────────────────────────┘
```

## Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                        Session Lifecycle                         │
└─────────────────────────────────────────────────────────────────┘

1. CREATION
   └─→ dalton-cli shekinah chat --save my_session
       └─→ Creates my_session.json with system prompt

2. GROWTH (0-100 messages)
   └─→ User interacts, messages added
       └─→ Context truncated per --max-history
           └─→ Full history saved to disk

3. ROTATION (at 100+ messages)
   └─→ On exit, rotation triggered
       └─→ Archive: my_session_archived_TIMESTAMP.json (101 msgs)
           └─→ Fresh: my_session.json (1 msg - system prompt)

4. POST-ROTATION
   └─→ Next load of my_session starts fresh
       └─→ Old messages in archive, accessible via --load

5. MANAGEMENT
   └─→ --list-sessions shows both active and archived
       └─→ User can load either session
           └─→ Manual cleanup of old archives
```

## Best Practice Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    Recommended Workflow                          │
└──────────────────────────────────────────────────────────────────┘

START OF DAY:
│
├─→ List sessions
│   └─→ dalton-cli shekinah chat --list-sessions
│       └─→ Decide which to resume or start new
│
├─→ Start work session
│   └─→ dalton-cli shekinah chat --save daily_work --max-history 50
│       └─→ Appropriate context for your task
│
├─→ Work throughout the day
│   └─→ Messages accumulate
│       └─→ Context stays at 50 messages
│           └─→ Full history saved
│
├─→ Reach 100 messages (auto-rotation)
│   └─→ Session archived automatically
│       └─→ Fresh session continues
│           └─→ Work uninterrupted
│
└─→ End of day: exit naturally
    └─→ Session saved automatically (Ctrl+C)
        └─→ Ready to resume tomorrow

NEXT DAY:
│
└─→ Resume previous work
    └─→ dalton-cli shekinah chat --load daily_work --max-history 50
        └─→ Continues from where you left off
```

## Visual Legend

```
┌─────────────────────────────────────────────────────────────────┐
│  Legend for Diagrams                                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐                                                    │
│  │  Box    │  = Process or action                               │
│  └─────────┘                                                    │
│                                                                 │
│  [DECISION]  = Yes/No decision point                            │
│                                                                 │
│  ─→          = Flow direction                                   │
│                                                                 │
│  ┐ ┘ ┌ └     = Grouping brackets                                │
│                                                                 │
│  ▼           = Downward flow                                    │
└─────────────────────────────────────────────────────────────────┘
```
