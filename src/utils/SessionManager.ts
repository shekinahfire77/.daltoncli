import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getChatLimits } from '../core/app_limits';

// Type definitions for session management
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  index?: number;
  function: {
    name: string;
    arguments: string;
  };
}

interface SessionMetadata {
  name: string;
  modified: Date;
  size: number;
  messageCount: number;
  error?: string;
}

interface SaveSessionResult {
  success: boolean;
  message: string;
  details?: {
    location: string;
    size: string;
    messageCount: number;
  };
}

interface LoadSessionResult {
  success: boolean;
  data: ChatMessage[] | null;
  message?: string;
}

interface ListSessionsResult {
  success: boolean;
  sessions: SessionMetadata[];
  message?: string;
}

interface DeleteSessionResult {
  success: boolean;
  message: string;
  sessionName: string;
}

interface RotateSessionResult {
  rotated: boolean;
  newSessionName: string;
  archivedName?: string;
}

/**
 * Custom error class for session management operations
 */
class SessionError extends Error {
  constructor(message: string, public sessionName?: string) {
    super(message);
    this.name = 'SessionError';
  }
}

/**
 * SessionManager handles all session-related operations
 * Separates business logic from UI concerns, returning result objects for flexible presentation
 */
export class SessionManager {
  private appDataDir: string;
  private sessionsDir: string;
  private lastSessionName: string = '__last_session';

  constructor(appDataDir?: string) {
    this.appDataDir = appDataDir || path.join(os.homedir(), '.dalton-cli');
    this.sessionsDir = path.join(this.appDataDir, 'sessions');
  }

  /**
   * Validates session name format and security constraints
   * @param name - The session name to validate
   * @returns true if valid, false otherwise
   */
  private validateSessionName(name: string): boolean {
    // Validate type and format
    if (typeof name !== 'string' || name.trim().length === 0) {
      return false;
    }
    // Prevent directory traversal and special characters
    if (name.includes('/') || name.includes('\\') || name.includes('\0')) {
      return false;
    }
    // Limit session name length to prevent filesystem issues
    if (name.length > 255) {
      return false;
    }
    return true;
  }

  /**
   * Formats byte size to human-readable format
   * @param bytes - Size in bytes
   * @returns Formatted size string (e.g., "1.5 MB")
   */
  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i];
  }

  /**
   * Ensures the sessions directory exists, creating it if necessary
   * @throws {SessionError} If directory creation fails
   */
  private ensureSessionsDirectory(): void {
    try {
      if (!fs.existsSync(this.appDataDir)) {
        fs.mkdirSync(this.appDataDir, { recursive: true });
      }
      if (!fs.existsSync(this.sessionsDir)) {
        fs.mkdirSync(this.sessionsDir, { recursive: true });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new SessionError(
        `Failed to create sessions directory: ${errorMsg}`
      );
    }
  }

  /**
   * Saves a chat session to a JSON file
   * Returns a result object with success status and metadata for UI display
   * @param name - The session name
   * @param history - The chat history to save
   * @returns SaveSessionResult with success status and metadata
   */
  saveSession(name: string, history: ChatMessage[]): SaveSessionResult {
    // Validate inputs
    if (!this.validateSessionName(name)) {
      return {
        success: false,
        message: 'Invalid session name format',
      };
    }

    if (!Array.isArray(history)) {
      return {
        success: false,
        message: 'Chat history must be an array',
      };
    }

    try {
      // Ensure directories exist
      this.ensureSessionsDirectory();

      // Write file
      const filePath = path.join(this.sessionsDir, `${name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(history, null, 2), {
        encoding: 'utf-8',
        flag: 'w',
      });

      // Get file metadata for result
      const stats = fs.statSync(filePath);
      const fileSize = this.formatSize(stats.size);

      return {
        success: true,
        message: `Session saved as '${name}'`,
        details: {
          location: filePath,
          size: fileSize,
          messageCount: history.length,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Failed to save session: ${errorMsg}`,
      };
    }
  }

  /**
   * Loads a chat session from a JSON file
   * @param name - The session name
   * @returns LoadSessionResult with success status and data
   */
  loadSession(name: string): LoadSessionResult {
    // Validate session name
    if (!this.validateSessionName(name)) {
      return {
        success: false,
        data: null,
        message: `Invalid session name format: ${name}`,
      };
    }

    try {
      const filePath = path.join(this.sessionsDir, `${name}.json`);

      // Check file existence
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          data: null,
          message: `Session '${name}' not found`,
        };
      }

      // Read and parse file
      const rawData = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(rawData);

      // Validate parsed data is array
      if (!Array.isArray(parsed)) {
        return {
          success: false,
          data: null,
          message: `Session file is invalid (not an array)`,
        };
      }

      return {
        success: true,
        data: parsed as ChatMessage[],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        data: null,
        message: `Failed to load session: ${errorMsg}`,
      };
    }
  }

  /**
   * Lists all available chat sessions with metadata
   * @returns ListSessionsResult with sessions array and status
   */
  listSessions(): ListSessionsResult {
    // Check sessions directory exists
    if (!fs.existsSync(this.sessionsDir)) {
      return {
        success: true,
        sessions: [],
        message: 'No sessions directory found',
      };
    }

    try {
      const files = fs
        .readdirSync(this.sessionsDir, { encoding: 'utf-8' })
        .filter((f) => f.endsWith('.json'));

      if (files.length === 0) {
        return {
          success: true,
          sessions: [],
          message: 'No sessions found',
        };
      }

      // Collect session metadata
      const sessions: SessionMetadata[] = [];

      files.forEach((file) => {
        const sessionPath = path.join(this.sessionsDir, file);
        const sessionName = file.replace('.json', '');

        try {
          // Get file stats
          const stats = fs.statSync(sessionPath);

          // Try to load session for message count
          let messageCount = 0;
          let error: string | undefined;

          try {
            const result = this.loadSession(sessionName);
            messageCount = result.data ? result.data.length : 0;
          } catch (err) {
            error = 'Error loading session';
          }

          sessions.push({
            name: sessionName,
            modified: stats.mtime,
            size: stats.size,
            messageCount,
            error,
          });
        } catch (err) {
          // Silently skip sessions with read errors
        }
      });

      // Sort by most recent first
      sessions.sort(
        (a, b) => b.modified.getTime() - a.modified.getTime()
      );

      return {
        success: true,
        sessions,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        sessions: [],
        message: `Failed to list sessions: ${errorMsg}`,
      };
    }
  }

  /**
   * Deletes a session file
   * @param sessionName - Name of session to delete
   * @returns DeleteSessionResult with success status and message
   */
  deleteSession(sessionName: string): DeleteSessionResult {
    // Validate session name
    if (!this.validateSessionName(sessionName)) {
      return {
        success: false,
        message: `Invalid session name: '${sessionName}'`,
        sessionName,
      };
    }

    const sessionPath = path.join(this.sessionsDir, `${sessionName}.json`);

    // Check if session exists
    if (!fs.existsSync(sessionPath)) {
      return {
        success: false,
        message: `Session '${sessionName}' does not exist`,
        sessionName,
      };
    }

    try {
      fs.unlinkSync(sessionPath);
      return {
        success: true,
        message: `Session '${sessionName}' deleted successfully`,
        sessionName,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Failed to delete session: ${errorMsg}`,
        sessionName,
      };
    }
  }

  /**
   * Rotates a session if it exceeds the maximum size threshold
   * Archives the current session and returns a rotation result
   * @param sessionName - The current session name
   * @param history - The current chat history
   * @returns RotateSessionResult indicating if rotation occurred
   */
  rotateSessionIfNeeded(
    sessionName: string,
    history: ChatMessage[]
  ): RotateSessionResult {
    const chatLimits = getChatLimits();

    if (history.length > chatLimits.maxSessionSize) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archivedName = `${sessionName}_archived_${timestamp}`;

      // Archive the current session
      const saveResult = this.saveSession(archivedName, history);

      if (saveResult.success) {
        return {
          rotated: true,
          newSessionName: sessionName,
          archivedName,
        };
      } else {
        // Still signal rotation even if archival failed, but include the error
        return {
          rotated: true,
          newSessionName: sessionName,
        };
      }
    }

    return {
      rotated: false,
      newSessionName: sessionName,
    };
  }

  /**
   * Gets a preview of session content (first and last messages)
   * @param history - The chat history
   * @returns Preview object with truncated first and last messages
   */
  getSessionPreview(
    history: ChatMessage[]
  ): { first?: string; last?: string } {
    const preview: { first?: string; last?: string } = {};

    if (history.length > 0) {
      // Find first user message
      const firstUserMessage = history.find((msg) => msg.role === 'user');
      if (firstUserMessage && firstUserMessage.content) {
        const content = firstUserMessage.content;
        preview.first =
          content.substring(0, 60) + (content.length > 60 ? '...' : '');
      }

      // Find last message
      const lastMessage = history[history.length - 1];
      if (lastMessage && lastMessage.content) {
        const content = lastMessage.content;
        preview.last =
          content.substring(0, 60) + (content.length > 60 ? '...' : '');
      }
    }

    return preview;
  }

  /**
   * Gets session metadata without loading full content
   * @param sessionName - Name of session to get info for
   * @returns Session metadata or null if not found
   */
  getSessionInfo(sessionName: string): SessionMetadata | null {
    if (!this.validateSessionName(sessionName)) {
      return null;
    }

    const sessionPath = path.join(this.sessionsDir, `${sessionName}.json`);

    if (!fs.existsSync(sessionPath)) {
      return null;
    }

    try {
      const stats = fs.statSync(sessionPath);
      const result = this.loadSession(sessionName);

      return {
        name: sessionName,
        modified: stats.mtime,
        size: stats.size,
        messageCount: result.data ? result.data.length : 0,
      };
    } catch (error) {
      return null;
    }
  }
}

export { SessionError, ChatMessage, SessionMetadata };
