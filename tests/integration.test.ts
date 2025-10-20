import { assembleStream, StreamChunk } from '../src/core/stream_assembler';

describe('Integration Tests with Fake Provider', () => {
  it('should correctly handle interleaved content and tool calls from a fake provider', async () => {
    // Mock a fake AI provider that emits interleaved content and tool call chunks
    const fakeProvider = {
      streamChat: async function* (): AsyncGenerator<StreamChunk> {
        yield { type: 'content' as const, value: 'Initial content.' };
        yield { type: 'tool_call' as const, name: 'fakeTool', args: { input: 'data' } };
        yield { type: 'content' as const, value: 'More content after tool call.' };
      },
    };

    const chunks: StreamChunk[] = [];
    for await (const chunk of fakeProvider.streamChat()) {
      chunks.push(chunk);
    }
    const result = assembleStream(chunks);

    expect(result.content).toBe('Initial content.More content after tool call.');
    expect(result.toolCalls).toEqual([
      { name: 'fakeTool', args: { input: 'data' } },
    ]);
  });

  it('should handle a stream with only content', async () => {
    const fakeProvider = {
      streamChat: async function* (): AsyncGenerator<StreamChunk> {
        yield { type: 'content' as const, value: 'Only text here.' };
        yield { type: 'content' as const, value: 'No tools.' };
      },
    };

    const chunks: StreamChunk[] = [];
    for await (const chunk of fakeProvider.streamChat()) {
      chunks.push(chunk);
    }
    const result = assembleStream(chunks);

    expect(result.content).toBe('Only text here.No tools.');
    expect(result.toolCalls).toEqual([]);
  });

  it('should handle a stream with only tool calls', async () => {
    const fakeProvider = {
      streamChat: async function* (): AsyncGenerator<StreamChunk> {
        yield { type: 'tool_call' as const, name: 'toolX', args: { id: 1 } };
        yield { type: 'tool_call' as const, name: 'toolY', args: { id: 2 } };
      },
    };

    const chunks: StreamChunk[] = [];
    for await (const chunk of fakeProvider.streamChat()) {
      chunks.push(chunk);
    }
    const result = assembleStream(chunks);

    expect(result.content).toBe('');
    expect(result.toolCalls).toEqual([
      { name: 'toolX', args: { id: 1 } },
      { name: 'toolY', args: { id: 2 } },
    ]);
  });

  it('should handle an empty stream', async () => {
    const fakeProvider = {
      streamChat: async function* (): AsyncGenerator<StreamChunk> {
        // Yield nothing
      },
    };

    const chunks: StreamChunk[] = [];
    for await (const chunk of fakeProvider.streamChat()) {
      chunks.push(chunk);
    }
    const result = assembleStream(chunks);

    expect(result.content).toBe('');
    expect(result.toolCalls).toEqual([]);
  });
});
