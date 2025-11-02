@echo off
REM Quick launcher for Dalton CLI chat with Azure OpenAI
cd /d "%~dp0"
node dist\src\index.js shekinah chat --provider openai --model gpt-5-nano
