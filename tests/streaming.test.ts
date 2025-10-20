import { assembleStream, StreamChunk } from '../src/core/stream_assembler';

describe('Streaming Assembly Tests', () => {
  it('should correctly assemble interleaved content and tool calls', () => {
    const mockStream: StreamChunk[] = [
      { type: 'content' as const, value: 'Hello, ' },
      { type: 'content' as const, value: 'this is a test.\n' },
      { type: 'tool_call' as const, name: 'tool1', args: { param1: 'value1' } },
      { type: 'content' as const, value: 'Here is some more content.' },
      { type: 'tool_call' as const, name: 'tool2', args: { param2: 'value2' } },
    ];

    const result = assembleStream(mockStream);
    expect(result).toMatchInlineSnapshot(`
{
  "content": "Hello, this is a test.
Here is some more content.",
  "toolCalls": [
    {
      "args": {
        "param1": "value1",
      },
      "name": "tool1",
    },
    {
      "args": {
        "param2": "value2",
      },
      "name": "tool2",
    },
  ],
}
`);
  });

  it('should handle content only streams', () => {
    const mockStream: StreamChunk[] = [
      { type: 'content' as const, value: 'Just some text. ' },
      { type: 'content' as const, value: 'No tools here.' },
    ];
    const result = assembleStream(mockStream);
    expect(result).toMatchInlineSnapshot(`
{
  "content": "Just some text. No tools here.",
  "toolCalls": [],
}
`);
  });

  it('should handle tool calls only streams', () => {
    const mockStream: StreamChunk[] = [
      { type: 'tool_call' as const, name: 'toolA', args: { id: 1 } },
      { type: 'tool_call' as const, name: 'toolB', args: { id: 2 } },
    ];
    const result = assembleStream(mockStream);
    expect(result).toMatchInlineSnapshot(`
{
  "content": "",
  "toolCalls": [
    {
      "args": {
        "id": 1,
      },
      "name": "toolA",
    },
    {
      "args": {
        "id": 2,
      },
      "name": "toolB",
    },
  ],
}
`);
  });

  it('should handle empty streams', () => {
    const mockStream: StreamChunk[] = [];
    const result = assembleStream(mockStream);
    expect(result).toMatchInlineSnapshot(`
{
  "content": "",
  "toolCalls": [],
}
`);
  });

  it('should handle tool calls at the beginning and end', () => {
    const mockStream: StreamChunk[] = [
      { type: 'tool_call' as const, name: 'startTool', args: {} },
      { type: 'content' as const, value: 'Middle content.' },
      { type: 'tool_call' as const, name: 'endTool', args: {} },
    ];
    const result = assembleStream(mockStream);
    expect(result).toMatchInlineSnapshot(`
{
  "content": "Middle content.",
  "toolCalls": [
    {
      "args": {},
      "name": "startTool",
    },
    {
      "args": {},
      "name": "endTool",
    },
  ],
}
`);
  });
});
