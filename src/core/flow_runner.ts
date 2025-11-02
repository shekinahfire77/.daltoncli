import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { FlowSchema, FlowStep, ChatStep, ToolCallStep, ReadFileStep, ApprovalStep } from './flow_schemas';
import { logSession } from './session_logger';
import { determineModel, validateToolCall } from './policy_engine';
import { ChatMessage } from './schemas';
import { toolRegistry } from './tool_registry';
import { modelRegistry } from '../model_registry';

type FlowContextValue = string | number | boolean | object | null | undefined;

interface FlowContext {
  [key: string]: FlowContextValue;
}

async function executeChatStep(step: ChatStep, context: FlowContext, dryRun: boolean): Promise<void> {
  console.log(`Executing Chat Step: ${step.prompt}`);
  logSession('chat_step_attempt', { prompt: step.prompt, dryRun });

  // Determine model based on policy
  const dummyChatMessage: ChatMessage = { role: 'user', content: step.prompt };
  const modelToUse = determineModel(dummyChatMessage, await modelRegistry);
  console.log(`Using model: ${modelToUse} for chat step.`);

  if (dryRun) {
    console.log(`[DRY-RUN] Would initiate AI chat with prompt: ${step.prompt} using model: ${modelToUse}`);
    if (step.output_to) {
      console.log(`[DRY-RUN] Would store AI response in variable: ${step.output_to}`);
    }
    return;
  }

  // Placeholder for actual AI chat interaction
  const chatResponse = `AI response to: ${step.prompt} (using ${modelToUse})`;
  if (step.output_to) {
    context[step.output_to] = chatResponse;
    console.log(`Stored chat response in variable: ${step.output_to}`);
  }
  logSession('chat_step_complete', { prompt: step.prompt, response: chatResponse.substring(0, 100) + '...', model: modelToUse });
}

async function executeToolCallStep(step: ToolCallStep, context: FlowContext, dryRun: boolean, allowNetwork: boolean): Promise<void> {
  console.log(`Executing Tool Call Step: ${step.tool_name} with args: ${JSON.stringify(step.args)}`);
  logSession('tool_call_attempt', { tool_name: step.tool_name, args: step.args, dryRun, allowNetwork, retry: step.retry });

  const dummyAssistantMessage: ChatMessage = {
    role: 'assistant',
    content: `I am requesting a tool call to ${step.tool_name} with args ${JSON.stringify(step.args)}.`, // Simulate rationale
    tool_calls: [{
      id: 'dummy-id',
      function: { name: step.tool_name, arguments: JSON.stringify(step.args) }
    }]
  };

  if (!validateToolCall(dummyAssistantMessage)) {
    console.warn(`Tool call to ${step.tool_name} blocked by policy.`);
    logSession('tool_call_blocked', { tool_name: step.tool_name, reason: 'Policy violation' });
    return;
  }

  const tool = toolRegistry[step.tool_name];
  if (!tool) {
    console.error(`Tool '${step.tool_name}' not found in registry.`);
    logSession('tool_call_error', { tool_name: step.tool_name, error: 'Tool not found' });
    return;
  }

  if (tool.isNetworkTool && !allowNetwork) {
    console.warn(`Tool '${step.tool_name}' requires --allow-network flag to be set.`);
    logSession('tool_call_blocked', { tool_name: step.tool_name, reason: 'Network access not allowed' });
    return;
  }

  if (dryRun) {
    console.log(`[DRY-RUN] Would call tool: ${step.tool_name} with args: ${JSON.stringify(step.args)}`);
    if (step.retry) {
      console.log(`[DRY-RUN] With retry config: ${JSON.stringify(step.retry)}`);
    }
    if (step.output_to) {
      console.log(`[DRY-RUN] Would store tool output in variable: ${step.output_to}`);
    }
    return;
  }

  let toolOutput: FlowContextValue;
  try {
    // Merge retry options into args if this is shell_exec
    const toolArgs = step.tool_name === 'shell_exec' && step.retry
      ? { ...step.args, retry: step.retry }
      : step.args;

    const result = await tool.func(toolArgs);
    // Ensure the result is a valid FlowContextValue
    if (result === null || result === undefined || typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean' || typeof result === 'object') {
      toolOutput = result;
    } else {
      toolOutput = String(result);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error executing tool '${step.tool_name}': ${errorMessage}`);

    // Check if we should continue on failure
    if (step.retry?.continueOnFailure) {
      console.log(`[Flow Runner] Continuing despite error (continueOnFailure=true)`);
      toolOutput = `Error: ${errorMessage}`;
    } else {
      toolOutput = `Error: ${errorMessage}`;
      // Re-throw the error if not in continueOnFailure mode
      throw error;
    }
  }

  if (step.output_to) {
    context[step.output_to] = toolOutput;
    console.log(`Stored tool output in variable: ${step.output_to}`);
  }
  logSession('tool_call_complete', { tool_name: step.tool_name, output: String(toolOutput).substring(0, 100) + '...' });
}

async function executeReadFileStep(step: ReadFileStep, context: FlowContext, dryRun: boolean): Promise<void> {
  console.log(`Executing Read File Step: ${step.path}`);
  logSession('read_file_attempt', { path: step.path, dryRun });

  if (dryRun) {
    console.log(`[DRY-RUN] Would read file: ${step.path}`);
    try {
      const fileContent = fs.readFileSync(step.path, 'utf8');
      console.log(`[DRY-RUN] File content preview:\n${fileContent.substring(0, 200)}...`);
      if (step.output_to) {
        console.log(`[DRY-RUN] Would store file content in variable: ${step.output_to}`);
      }
    } catch (error) {
      console.error(`[DRY-RUN] Error reading file ${step.path}:`, error);
    }
    return;
  }

  // Placeholder for actual file read
  try {
    const fileContent = fs.readFileSync(step.path, 'utf8');
    if (step.output_to) {
      context[step.output_to] = fileContent;
      console.log(`Stored file content from ${step.path} in variable: ${step.output_to}`);
    }
  } catch (error) {
    console.error(`Error reading file ${step.path}:`, error);
    throw error;
  }
  const contentPreview = step.output_to && context[step.output_to]
    ? String(context[step.output_to]).substring(0, 100) + '...'
    : '';
  logSession('read_file_complete', { path: step.path, content_preview: contentPreview });
}

async function executeApprovalStep(step: ApprovalStep, context: FlowContext, dryRun: boolean, nonInteractive: boolean): Promise<void> {
  console.log(`Executing Approval Step. Message: ${step.message || 'Please approve.'}`);
  logSession('approval_step_attempt', { message: step.message, variable_to_approve: step.variable_to_approve, dryRun, nonInteractive });

  if (dryRun) {
    console.log(`[DRY-RUN] Would request approval. Message: ${step.message || 'Please approve.'}`);
    if (step.variable_to_approve) {
      console.log(`[DRY-RUN] Content to approve for ${step.variable_to_approve}:\n${context[step.variable_to_approve]}`);
    }
    return;
  }

  if (nonInteractive) {
    console.log("[NON-INTERACTIVE] Auto-approving due to --non-interactive flag.");
    logSession('approval_step_auto_approved', { message: step.message });
    return;
  }

  if (step.variable_to_approve) {
    console.log(`Content to approve for ${step.variable_to_approve}:\n${context[step.variable_to_approve]}`);
  }
  // Placeholder for actual user approval mechanism (e.g., prompt for input)
  console.log("Approval required. (Simulated approval)");
  // In a real scenario, this would block until user input is received.
  logSession('approval_step_complete', { message: step.message, status: 'simulated_approved' });
}

/**
 * Custom error class for flow execution errors
 */
class FlowExecutionError extends Error {
  constructor(
    message: string,
    public stepType?: string,
    public stepIndex?: number
  ) {
    super(message);
    this.name = 'FlowExecutionError';
  }
}

/**
 * Validates flow YAML path
 * @param flowPath - Path to the flow YAML file
 * @returns true if valid, false otherwise
 */
const validateFlowPath = (flowPath: string): boolean => {
  // DEFENSIVE: Validate path type and format
  if (typeof flowPath !== 'string' || flowPath.trim().length === 0) {
    return false;
  }

  // DEFENSIVE: Check for null bytes and control characters
  if (flowPath.includes('\0') || flowPath.includes('\r') || flowPath.includes('\n')) {
    return false;
  }

  return true;
};

export async function runFlow(flowYamlPath: string, dryRun: boolean = false, nonInteractive: boolean = false, allowNetwork: boolean = false): Promise<void> {
  // DEFENSIVE: Validate input parameters
  if (!validateFlowPath(flowYamlPath)) {
    throw new FlowExecutionError('Invalid flow path provided');
  }

  if (typeof dryRun !== 'boolean' || typeof nonInteractive !== 'boolean' || typeof allowNetwork !== 'boolean') {
    throw new FlowExecutionError('Boolean parameters must be of type boolean');
  }

  console.log(`Running flow from: ${flowYamlPath} (Dry Run: ${dryRun}, Non-Interactive: ${nonInteractive}, Allow Network: ${allowNetwork})`);

  // DEFENSIVE: Read flow file with error handling
  let flowContent: string;
  try {
    if (!fs.existsSync(flowYamlPath)) {
      throw new FlowExecutionError(`Flow file not found: ${flowYamlPath}`);
    }
    flowContent = fs.readFileSync(flowYamlPath, 'utf8');
  } catch (error) {
    if (error instanceof FlowExecutionError) {
      throw error;
    }
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new FlowExecutionError(`Failed to read flow file: ${errorMsg}`);
  }

  // DEFENSIVE: Parse YAML with error handling
  let parsedFlow: unknown;
  try {
    parsedFlow = yaml.load(flowContent);
    if (!parsedFlow || typeof parsedFlow !== 'object') {
      throw new FlowExecutionError('Flow file must contain a valid YAML object');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new FlowExecutionError(`Failed to parse YAML: ${errorMsg}`);
  }

  // DEFENSIVE: Validate flow schema
  let flow: ReturnType<typeof FlowSchema.parse>;
  try {
    flow = FlowSchema.parse(parsedFlow);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new FlowExecutionError(`Flow validation failed: ${errorMsg}`);
  }

  // DEFENSIVE: Validate flow has steps
  if (!flow.steps || !Array.isArray(flow.steps) || flow.steps.length === 0) {
    throw new FlowExecutionError('Flow must contain at least one step');
  }

  const context: FlowContext = {};

  // DEFENSIVE: Execute steps with error handling and recovery
  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i];

    try {
      // DEFENSIVE: Validate step has type property
      if (!step || typeof step !== 'object' || !('type' in step)) {
        throw new FlowExecutionError(`Invalid step at index ${i}: missing type property`, undefined, i);
      }

      switch (step.type) {
        case 'chat':
          await executeChatStep(step, context, dryRun);
          break;
        case 'tool_call':
          await executeToolCallStep(step, context, dryRun, allowNetwork);
          break;
        case 'read_file':
          await executeReadFileStep(step, context, dryRun);
          break;
        case 'approval':
          await executeApprovalStep(step, context, dryRun, nonInteractive);
          break;
        default:
          console.warn(`Unknown step type at index ${i}: ${(step as FlowStep).type}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const stepType = 'type' in step ? String(step.type) : 'unknown';

      console.error(`Error executing step ${i} (${stepType}): ${errorMsg}`);

      // DEFENSIVE: Allow continuing on non-critical errors in dry-run mode
      if (dryRun) {
        console.warn(`[DRY-RUN] Continuing despite error in step ${i}`);
        continue;
      }

      throw new FlowExecutionError(`Step ${i} (${stepType}) failed: ${errorMsg}`, stepType, i);
    }
  }

  console.log("Flow execution complete.");
  console.log("Final Context:", context);
}
