export interface StreamChunk {
  type: 'content' | 'tool_call';
  value?: string; // For content chunks
  name?: string; // For tool_call chunks
  args?: any; // For tool_call chunks
}

export interface AssembledStream {
  content: string;
  toolCalls: Array<{ name: string; args: any }>;
}

export function assembleStream(chunks: StreamChunk[]): AssembledStream {
  let assembledContent = '';
  const assembledToolCalls: Array<{ name: string; args: any }> = [];

  chunks.forEach(chunk => {
    if (chunk.type === 'content' && chunk.value !== undefined) {
      assembledContent += chunk.value;
    } else if (chunk.type === 'tool_call' && chunk.name !== undefined && chunk.args !== undefined) {
      assembledToolCalls.push({ name: chunk.name, args: chunk.args });
    }
  });

  return { content: assembledContent, toolCalls: assembledToolCalls };
}
