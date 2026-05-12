import { createDeepSeek } from '@ai-sdk/deepseek';

export const deepseekProvider = createDeepSeek({
  baseURL: process.env.LLM_BASE_URL || undefined,
  apiKey: process.env.LLM_API_KEY || '',
});

export function getModel() {
  const modelId = process.env.LLM_MODEL || 'deepseek-chat';
  return deepseekProvider(modelId);
}
