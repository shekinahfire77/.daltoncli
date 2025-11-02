@echo off
node --loader ts-node/esm "%~dp0src\index.ts" %*
