import { z } from 'zod';

/**
 * Schema for retry configuration in flow steps
 */
export const RetryConfigSchema = z.object({
  /** Maximum number of retry attempts (1-10) */
  maxAttempts: z.number().min(1).max(10).optional(),

  /** Initial delay before first retry in milliseconds (0-60000) */
  delayMs: z.number().min(0).max(60000).optional(),

  /** Continue flow execution even if all retries fail */
  continueOnFailure: z.boolean().optional(),
}).optional();

export const ChatStepSchema = z.object({
  type: z.literal('chat'),
  prompt: z.string(),
  model: z.string().optional(),
  output_to: z.string().optional(), // Variable to store chat response
  retry: RetryConfigSchema,
});

export const ToolCallStepSchema = z.object({
  type: z.literal('tool_call'),
  tool_name: z.string(),
  args: z.record(z.any()).optional(), // Arguments for the tool
  output_to: z.string().optional(), // Variable to store tool output
  retry: RetryConfigSchema,
});

export const ReadFileStepSchema = z.object({
  type: z.literal('read_file'),
  path: z.string(),
  output_to: z.string().optional(), // Variable to store file content
  retry: RetryConfigSchema,
});

export const ApprovalStepSchema = z.object({
  type: z.literal('approval'),
  message: z.string().optional(),
  variable_to_approve: z.string().optional(), // Variable whose content needs approval
  retry: RetryConfigSchema,
});

export const FlowStepSchema = z.discriminatedUnion('type', [
  ChatStepSchema,
  ToolCallStepSchema,
  ReadFileStepSchema,
  ApprovalStepSchema,
]);

export const FlowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  steps: z.array(FlowStepSchema),
});

export type RetryConfig = z.infer<typeof RetryConfigSchema>;
export type ChatStep = z.infer<typeof ChatStepSchema>;
export type ToolCallStep = z.infer<typeof ToolCallStepSchema>;
export type ReadFileStep = z.infer<typeof ReadFileStepSchema>;
export type ApprovalStep = z.infer<typeof ApprovalStepSchema>;
export type FlowStep = z.infer<typeof FlowStepSchema>;
export type Flow = z.infer<typeof FlowSchema>;
