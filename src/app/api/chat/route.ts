import { streamText, stepCountIs, convertToModelMessages, type ToolSet } from 'ai';
import type { UIMessage } from 'ai';
import { getModel } from '@/lib/ai/provider';
import { allTools } from '@/lib/ai/tools';
import { getSystemPrompt } from '@/lib/ai/prompts';
import { getValidAccessToken } from '@/lib/auth/feishu-tokens';
import { createCalendarTools } from '@/lib/feishu/calendar-tools';
import type { ResolvedTravelConfig } from '@/lib/types/travel-config';

export async function POST(req: Request) {
  try {
    const { messages, travelConfig } = await req.json() as {
      messages: UIMessage[];
      travelConfig?: ResolvedTravelConfig;
    };

    // Trap 1：token 刷新必须在 streamText() 之前完成，流开始后无法设置 cookie
    const tokenResult = await getValidAccessToken();
    let tools: ToolSet = allTools;
    let setCookieHeader: string | undefined;

    if (tokenResult?.accessToken) {
      const calendarTools = createCalendarTools(tokenResult.accessToken);
      tools = { ...allTools, ...calendarTools };

      // 如果 token 被刷新了，准备好新的 cookie 值（在 response header 中写回）
      if (tokenResult.newCookieValue) {
        setCookieHeader = `feishu_tokens=${tokenResult.newCookieValue}; Path=/; Max-Age=${7 * 24 * 3600}; HttpOnly; SameSite=Lax`;
      }
    }

    // useChat 发送 UIMessage 格式 (parts[])，streamText 需要 ModelMessage 格式 (content)
    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
      model: getModel(),
      system: getSystemPrompt(travelConfig),
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(Number(process.env.MAX_AGENT_ITERATIONS) || 8),
      temperature: Number(process.env.LLM_TEMPERATURE) || 0.7,
    });

    const response = result.toUIMessageStreamResponse();

    // 如果 token 被刷新，将新的加密 token 写回 cookie
    if (setCookieHeader) {
      response.headers.set('Set-Cookie', setCookieHeader);
    }

    return response;
  } catch (error) {
    console.error('[/api/chat] Error:', error);
    return new Response(
      JSON.stringify({ error: '服务暂时不可用，请稍后重试' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
