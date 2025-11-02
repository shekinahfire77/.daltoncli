import * as fs from 'fs/promises';
import * as path from 'path';
import { redactSecrets } from './secret_manager';

/**
 * Directory where session logs are stored
 */
const SESSION_DIR = path.join(process.cwd(), '.daltoncli_sessions');

/**
 * Type for session event details
 */
type SessionEventDetails = Record<string, string | number | boolean | null | undefined | Record<string, unknown>>;

/**
 * Structure of a session log entry
 */
interface SessionLogEntry {
  timestamp: string;
  eventType: string;
  details: SessionEventDetails;
}

/**
 * Path to the current session log file
 */
let sessionFilePath: string | null = null;

/**
 * Initializes a new session and creates a log file
 * @param sessionName - Optional name for the session
 */
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

/**
 * Logs a session event with details and redacts secrets
 * @param eventType - Type of event being logged
 * @param details - Event details to log
 */
export async function logSession(eventType: string, details: SessionEventDetails): Promise<void> {
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
  logEntryString = await redactSecrets(logEntryString);

  try {
    await fs.appendFile(sessionFilePath, logEntryString + '\n', { encoding: 'utf8' });
  } catch (error) {
    console.error(`Error appending to session log file ${sessionFilePath}:`, error);
  }
}

/**
 * Ends the current session and closes the log file
 */
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
