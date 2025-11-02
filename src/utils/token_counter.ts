import { get_encoding, encoding_for_model } from 'tiktoken';

/**
 * Counts tokens for a given text and model using tiktoken.
 * @param text The text to tokenize.
 * @param modelName The name of the model (e.g., 'gpt-4', 'gpt-3.5-turbo').
 * @returns The number of tokens.
 */
export function countTokens(text: string, modelName: string): number {
  try {
    let encoding;
    try {
      encoding = encoding_for_model(modelName as any); // Cast to any to satisfy TypeScript
    } catch (error) {
      // Fallback to a common encoding if model-specific one is not found
      encoding = get_encoding("cl100k_base");
    }
    const tokens = encoding.encode(text);
    encoding.free(); // Free the encoding to prevent memory leaks
    return tokens.length;
  } catch (error) {
    console.error(`Error counting tokens for model ${modelName}:`, error);
    return text.length / 4; // Fallback: rough estimate (4 chars per token)
  }
}
