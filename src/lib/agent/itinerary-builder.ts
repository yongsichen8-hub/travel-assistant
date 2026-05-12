import { ItinerarySchema } from './schemas';
import type { Itinerary } from './schemas';

/**
 * 校验并构建行程对象
 * 通过 Zod Schema 确保 LLM 输出的数据结构完整合法
 */
export function buildItinerary(raw: unknown): { success: true; data: Itinerary } | { success: false; error: string } {
  const result = ItinerarySchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return { success: false, error: `行程数据校验失败: ${issues}` };
  }

  return { success: true, data: result.data };
}
