/**
 * Arguments for a tool call
 */
export interface ToolCallArgs {
  [key: string]: string | number | boolean | null | undefined | Record<string, unknown>;
}

/**
 * A chunk in a stream containing either content or a tool call
 */
export interface StreamChunk {
  type: 'content' | 'tool_call';
  value?: string;
  name?: string;
  args?: ToolCallArgs;
}

/**
 * An assembled stream with complete content and tool calls
 */
export interface AssembledStream {
  content: string;
  toolCalls: Array<{ name: string; args: ToolCallArgs }>;
}

/**
 * A delta chunk from an AI provider stream
 */
export interface DeltaChunk {
  choices: Array<{
    delta?: {
      content?: string;
      tool_calls?: ToolCallDelta[];
    };
  }>;
}

/**
 * A delta representing part of a tool call in a streaming response
 */
export interface ToolCallDelta {
  index: number;
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

/**
 * A complete tool call
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Assembles stream chunks into a complete response
 * @param chunks - Array of stream chunks
 * @returns AssembledStream with complete content and tool calls
 */
export function assembleStream(chunks: StreamChunk[]): AssembledStream {
  let assembledContent = '';
  const assembledToolCalls: Array<{ name: string; args: ToolCallArgs }> = [];

  chunks.forEach(chunk => {
    if (chunk.type === 'content' && chunk.value !== undefined) {
      assembledContent += chunk.value;
    } else if (chunk.type === 'tool_call' && chunk.name !== undefined && chunk.args !== undefined) {
      assembledToolCalls.push({ name: chunk.name, args: chunk.args });
    }
  });

  return { content: assembledContent, toolCalls: assembledToolCalls };
}

/**
 * Assembles a real-time streaming response from an AI provider into a complete response.
 * Processes delta chunks incrementally, accumulating content and tool calls.
 *
 * @param stream - AsyncIterable of DeltaChunk objects from the AI provider
 * @param onContent - Optional callback function called for each content chunk (useful for real-time display)
 * @returns Promise resolving to an AssembledStream with complete content and toolCallsRaw array
 */
export async function assembleDeltaStream(
  stream: AsyncIterable<DeltaChunk>,
  onContent?: (content: string) => void
): Promise<AssembledStream & { toolCallsRaw: ToolCall[] }> {
  let assembledContent = '';
  const toolCallsMap = new Map<number, Partial<ToolCall>>();

  // Iterate through the async stream
  for await (const deltaChunk of stream) {
    // Process each choice in the delta chunk
    if (deltaChunk.choices && Array.isArray(deltaChunk.choices)) {
      for (const choice of deltaChunk.choices) {
        if (choice.delta) {
          // Accumulate content chunks
          if (choice.delta.content) {
            assembledContent += choice.delta.content;

            // Call the callback for real-time content display if provided
            if (onContent) {
              onContent(choice.delta.content);
            }
          }

          // Process tool call deltas
          if (choice.delta.tool_calls && Array.isArray(choice.delta.tool_calls)) {
            for (const toolCallDelta of choice.delta.tool_calls) {
              const index = toolCallDelta.index;

              // Initialize or update the tool call at this index
              if (!toolCallsMap.has(index)) {
                toolCallsMap.set(index, {});
              }

              const toolCall = toolCallsMap.get(index)!;

              // Accumulate tool call properties
              if (toolCallDelta.id) {
                toolCall.id = toolCallDelta.id;
              }

              if (toolCallDelta.function) {
                if (!toolCall.function) {
                  toolCall.function = { name: '', arguments: '' };
                }

                if (toolCallDelta.function.name) {
                  toolCall.function.name = toolCallDelta.function.name;
                }

                if (toolCallDelta.function.arguments) {
                  toolCall.function.arguments += toolCallDelta.function.arguments;
                }
              }
            }
          }
        }
      }
    }
  }

  // Convert the tool calls map to an array and ensure all required fields are present
  const toolCallsRaw: ToolCall[] = Array.from(toolCallsMap.values())
    .filter((tc): tc is ToolCall => {
      return (
        tc.id !== undefined &&
        tc.function !== undefined &&
        tc.function.name !== undefined &&
        tc.function.arguments !== undefined
      );
    })
    .map((tc) => ({
      id: tc.id!,
      type: 'function' as const,
      function: {
        name: tc.function!.name,
        arguments: tc.function!.arguments,
      },
    }))
    .sort((a, b) => {
      // Sort by tool call id for consistent ordering
      return a.id.localeCompare(b.id);
    });

  return {
    content: assembledContent,
    toolCalls: [], // Keep compatible with AssembledStream interface
    toolCallsRaw,
  };
}
