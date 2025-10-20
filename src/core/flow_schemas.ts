import { z } from 'zod';

export const ChatStepSchema = z.object({
  type: z.literal('chat'),
  prompt: z.string(),
  model: z.string().optional(),
  output_to: z.string().optional(), // Variable to store chat response
});

export const ToolCallStepSchema = z.object({
  type: z.literal('tool_call'),
  tool_name: z.string(),
  args: z.record(z.any()).optional(), // Arguments for the tool
  output_to: z.string().optional(), // Variable to store tool output
});

export const ReadFileStepSchema = z.object({
  type: z.literal('read_file'),
  path: z.string(),
  output_to: z.string().optional(), // Variable to store file content
});

export const ApprovalStepSchema = z.object({
  type: z.literal('approval'),
  message: z.string().optional(),
  variable_to_approve: z.string().optional(), // Variable whose content needs approval
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

export type ChatStep = z.infer<typeof ChatStepSchema>;
export type ToolCallStep = z.infer<typeof ToolCallStepSchema>;
export type ReadFileStep = z.infer<typeof ReadFileStepSchema>;
export type ApprovalStep = z.infer<typeof ApprovalStepSchema>;
export type FlowStep = z.infer<typeof FlowStepSchema>;
export type Flow = z.infer<typeof FlowSchema>;
