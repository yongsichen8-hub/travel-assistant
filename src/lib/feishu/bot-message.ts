/**
 * 飞书 Bot 消息发送：构建 interactive card + 发送给用户
 */

import type { Itinerary } from '@/lib/types/itinerary';

/**
 * 发送行程卡片消息给指定用户
 */
export async function sendItineraryCard(
  tenantToken: string,
  openId: string,
  itinerary: Itinerary
): Promise<{ success: boolean; error?: string }> {
  const card = buildCardContent(itinerary);

  const res = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${tenantToken}`,
    },
    body: JSON.stringify({
      receive_id: openId,
      msg_type: 'interactive',
      content: JSON.stringify(card),
    }),
  });

  const data = await res.json();

  if (data.code !== 0) {
    return { success: false, error: data.msg || `发送失败 (code=${data.code})` };
  }

  return { success: true };
}

/**
 * 构建飞书 interactive card JSON
 */
function buildCardContent(itinerary: Itinerary) {
  const budget = itinerary.estimatedBudget;

  // 每天行程摘要
  const dayElements = itinerary.days.map(day => {
    const activities = day.activities.map(a => {
      const icon = a.type === 'flight' ? '✈️' : a.type === 'hotel' ? '🏨' : a.type === 'meal' ? '🍽️' : a.type === 'attraction' ? '🏛️' : '📍';
      const flight = a.flight ? ` (${a.flight.airline} ${a.flight.flightNo})` : '';
      return `${icon} ${a.time} ${a.title}${flight}`;
    }).join('\n');

    return {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**Day ${day.dayNumber} | ${day.date} | ${day.theme}**\n${activities}`,
      },
    };
  });

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `📋 ${itinerary.title}` },
      template: 'blue',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `📅 **${itinerary.startDate} ~ ${itinerary.endDate}**\n🗺️ ${itinerary.origin.name} → ${itinerary.destination.name}${budget ? `\n💰 预算: ¥${budget.total}` : ''}`,
        },
      },
      { tag: 'hr' },
      ...dayElements,
      ...(itinerary.tips && itinerary.tips.length > 0
        ? [
            { tag: 'hr' },
            {
              tag: 'div',
              text: {
                tag: 'lark_md',
                content: `💡 **出行提示**\n${itinerary.tips.map(t => `• ${t}`).join('\n')}`,
              },
            },
          ]
        : []),
      {
        tag: 'note',
        elements: [
          { tag: 'plain_text', content: '由差旅规划助手生成' },
        ],
      },
    ],
  };
}
