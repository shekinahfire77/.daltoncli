import { FlowSchema } from '../src/core/flow_schemas';
import { z } from 'zod';

describe('Flow Schema Validation', () => {
  it('should validate a minimal valid flow', () => {
    const validFlow = {
      name: 'test-flow',
      steps: [
        { type: 'chat', prompt: 'Hello AI' },
      ],
    };
    expect(() => FlowSchema.parse(validFlow)).not.toThrow();
  });

  it('should validate a complex valid flow', () => {
    const validFlow = {
      name: 'complex-flow',
      description: 'A flow with various step types',
      steps: [
        { type: 'chat', prompt: 'Initial chat', model: 'gpt-4o', output_to: 'chat_output' },
        { type: 'tool_call', tool_name: 'shell_exec', args: { command: 'ls -l' }, output_to: 'ls_output' },
        { type: 'read_file', path: './README.md', output_to: 'readme_content' },
        { type: 'approval', message: 'Review changes', variable_to_approve: 'chat_output' },
        { type: 'chat', prompt: 'Final message based on ${ls_output}' },
      ],
    };
    expect(() => FlowSchema.parse(validFlow)).not.toThrow();
  });

  it('should throw an error for a flow missing a name', () => {
    const invalidFlow = {
      steps: [
        { type: 'chat', prompt: 'Hello AI' },
      ],
    };
    expect(() => FlowSchema.parse(invalidFlow)).toThrow(z.ZodError);
  });

  it('should throw an error for a flow with invalid step type', () => {
    const invalidFlow = {
      name: 'invalid-step-type',
      steps: [
        { type: 'invalid_type', prompt: 'Hello AI' },
      ],
    };
    expect(() => FlowSchema.parse(invalidFlow)).toThrow(z.ZodError);
  });

  it('should throw an error for a chat step missing prompt', () => {
    const invalidFlow = {
      name: 'invalid-chat-step',
      steps: [
        { type: 'chat' },
      ],
    };
    expect(() => FlowSchema.parse(invalidFlow)).toThrow(z.ZodError);
  });

  it('should throw an error for a tool_call step missing tool_name', () => {
    const invalidFlow = {
      name: 'invalid-tool-step',
      steps: [
        { type: 'tool_call', args: { command: 'ls' } },
      ],
    };
    expect(() => FlowSchema.parse(invalidFlow)).toThrow(z.ZodError);
  });

  it('should throw an error for a read_file step missing path', () => {
    const invalidFlow = {
      name: 'invalid-read-file-step',
      steps: [
        { type: 'read_file' },
      ],
    };
    expect(() => FlowSchema.parse(invalidFlow)).toThrow(z.ZodError);
  });
});
