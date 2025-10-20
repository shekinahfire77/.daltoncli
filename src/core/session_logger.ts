import * as fs from 'fs/promises'; // Use fs.promises for async operations
import * as path from 'path';
// import { createSign, createVerify } from 'crypto'; // For actual signing
import { redactSecrets } from './secret_manager'; // Import redactSecrets

const SESSION_DIR = path.join(process.cwd(), '.daltoncli_sessions');

interface SessionLogEntry {
  timestamp: string;
  eventType: string;
  details: any;
  // signature?: string; // For actual signing
}

let sessionFilePath: string | null = null;

export async function startSession(sessionName?: string): Promise<void> {
  try {
    await fs.mkdir(SESSION_DIR, { recursive: true });
  } catch (error) {
    console.error(`Error creating session directory ${SESSION_DIR}:`, error);
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = sessionName ? `session-${sessionName}-${timestamp}.log` : `session-${timestamp}.log`;
  sessionFilePath = path.join(SESSION_DIR, fileName);
  try {
    await fs.writeFile(sessionFilePath, `# Dalton CLI Session Log - ${timestamp}\n`, { encoding: 'utf8' });
    console.log(`Session log started: ${sessionFilePath}`);
  } catch (error) {
    console.error(`Error starting session log file ${sessionFilePath}:`, error);
    sessionFilePath = null; // Ensure sessionFilePath is null if file creation fails
  }
}

export async function logSession(eventType: string, details: any): Promise<void> {
  if (!sessionFilePath) {
    console.warn("Session not started. Log entry will not be recorded.");
    return;
  }

  const logEntry: SessionLogEntry = {
    timestamp: new Date().toISOString(),
    eventType,
    details,
  };

  let logEntryString = JSON.stringify(logEntry);
  logEntryString = await redactSecrets(logEntryString); // Redact secrets before logging

  // In a real implementation, you would sign the logEntry here.
  // const signer = createSign('sha256');
  // signer.update(logEntryString);
  // logEntry.signature = signer.sign(privateKey, 'hex');

  try {
    await fs.appendFile(sessionFilePath, logEntryString + '\n', { encoding: 'utf8' });
  } catch (error) {
    console.error(`Error appending to session log file ${sessionFilePath}:`, error);
  }
}

export async function endSession(): Promise<void> {
  if (sessionFilePath) {
    try {
      await fs.appendFile(sessionFilePath, '# End of Session\n', { encoding: 'utf8' });
      console.log(`Session log ended: ${sessionFilePath}`);
    } catch (error) {
      console.error(`Error ending session log file ${sessionFilePath}:`, error);
    } finally {
      sessionFilePath = null;
    }
  }
}
