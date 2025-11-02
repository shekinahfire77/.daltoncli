# Quick Start - Environment Configuration

**TL;DR** - Get started in 3 minutes

## Step 1: Copy Template (30 seconds)

```bash
cd C:\Users\deadm\Desktop\.daltoncli
cp .env.example .env
```

## Step 2: Add Your API Keys (2 minutes)

Edit `.env` with your actual API keys:

```bash
# Windows
code .env

# Or use any text editor
notepad .env
```

Fill in at least ONE of these:

```env
# Option A: OpenAI
OPENAI_API_KEY=sk-your-key-from-https://platform.openai.com/api-keys

# Option B: Google Gemini
GOOGLE_API_KEY=your-key-from-https://aistudio.google.com/app/apikey

# Option C: Mistral
MISTRAL_API_KEY=your-key-from-https://console.mistral.ai/api-keys/

# Option D: Groq
GROQ_API_KEY=your-key-from-https://console.groq.com/keys

# Option E: Azure OpenAI
AZURE_OPENAI_API_KEY=your-key-from-azure-portal
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
```

## Step 3: Test (30 seconds)

```bash
npm install  # If needed
npm run dev -- chat "Hello, are you working?"
```

## Done!

Your Dalton CLI is now configured. All environment variables have secure defaults.

---

## Optional Configuration

### Use More Chat History

```env
DALTON_CHAT_HISTORY_LIMIT=50  # Instead of default 10
```

### Increase Timeout (for slow networks)

```env
DALTON_API_TIMEOUT_DEFAULT=60000  # 60 seconds instead of 30
```

### Add More Retries (for unstable connections)

```env
DALTON_MAX_RETRIES=5  # Instead of default 3
```

---

## Common Issues

**Q: "API key not found"**
- Is `.env` file created? Check: `ls -la .env`
- Does it have a value? Check: `grep OPENAI_API_KEY .env`
- Correct format? OpenAI keys start with `sk-`

**Q: "Permission denied"**
- Create `.env` first: `cp .env.example .env`

**Q: "Timeout waiting for response"**
- Increase timeout: `DALTON_API_TIMEOUT_DEFAULT=60000`

---

## Important Notes

✓ `.env` is automatically ignored by git (see `.gitignore`)
✓ Never share or commit your `.env` file
✓ All values can be plain text, quotes optional
✓ Comments in `.env.example` are just for reference

---

## Need Help?

- **Setup Guide**: `ENV_CONFIGURATION_GUIDE.md`
- **Security Details**: `SECURITY_AUDIT_ENV.md`
- **Full Summary**: `ENV_SETUP_SUMMARY.md`
- **Completion Report**: `CONFIGURATION_COMPLETION_REPORT.md`

---

## All Environment Variables (for reference)

### API Keys (choose at least one)
```env
OPENAI_API_KEY=
GOOGLE_API_KEY=
MISTRAL_API_KEY=
GROQ_API_KEY=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
```

### Chat Configuration
```env
DALTON_CHAT_HISTORY_LIMIT=10
DALTON_MAX_SESSION_SIZE=100
DALTON_MAX_HISTORY_UPPER_BOUND=1000
DALTON_MAX_HISTORY_LOWER_BOUND=1
```

### File & Shell Limits
```env
DALTON_MAX_READ_BYTES=50000
DALTON_FILE_WARNING_THRESHOLD=50000
DALTON_SHELL_TIMEOUT=15000
DALTON_MAX_COMMAND_LENGTH=10000
```

### API & Retry Settings
```env
DALTON_API_TIMEOUT_DEFAULT=30000
DALTON_API_TIMEOUT_MIN=1000
DALTON_API_TIMEOUT_MAX=600000
DALTON_MAX_RETRIES=3
DALTON_RETRY_INITIAL_DELAY=1000
DALTON_RETRY_MAX_DELAY=10000
DALTON_RETRY_BACKOFF_MULTIPLIER=2
DALTON_RETRY_JITTER_FACTOR=0.1
DALTON_CODE_BLOCK_THRESHOLD=10
```

---

**Start now**: Copy `.env.example` to `.env` and add your API key!
