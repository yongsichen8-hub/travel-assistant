/**
 * 工具描述生成 + 标准流程管道定义
 * 被 ThinkingProcess 和 ToolCallIndicator 共同使用
 */

export const TOOL_LABELS: Record<string, string> = {
  geocode: '查询位置信息',
  search_poi: '搜索兴趣点',
  plan_route: '规划路线',
  search_flights: '搜索航班',
  search_nearby_hotels: '搜索酒店',
  check_schedule: '查询飞书日历',
  create_calendar_event: '创建日历日程',
  get_weather: '查询天气',
  generate_final_itinerary: '生成行程方案',
};

export const STANDARD_PIPELINE = [
  { key: 'check_schedule', label: '查日历' },
  { key: 'search_flights', label: '搜航班' },
  { key: 'get_weather', label: '查天气' },
  { key: 'search_nearby_hotels', label: '搜酒店' },
  { key: 'generate_final_itinerary', label: '生成行程' },
];

/**
 * 根据工具名和输入参数生成动态上下文描述
 * input 为 undefined 或字段缺失时，fallback 到静态标签
 */
export function getToolDescription(toolName: string, input?: Record<string, unknown>): string {
  if (!input) {
    return TOOL_LABELS[toolName] || toolName;
  }

  switch (toolName) {
    case 'check_schedule': {
      const dates = input.dates as string[] | undefined;
      if (dates && dates.length > 0) {
        const range = dates.length === 1
          ? dates[0]
          : `${dates[0]}~${dates[dates.length - 1]}`;
        return `正在查询 ${range} 的飞书日程...`;
      }
      return TOOL_LABELS[toolName];
    }

    case 'search_flights': {
      const dep = input.departure_city as string | undefined;
      const arr = input.arrival_city as string | undefined;
      const date = input.date as string | undefined;
      if (dep && arr) {
        return `正在搜索 ${dep}→${arr}${date ? ` ${date}` : ''} 的航班...`;
      }
      return TOOL_LABELS[toolName];
    }

    case 'get_weather': {
      const city = input.city as string | undefined;
      const dates = input.dates as string[] | undefined;
      if (city) {
        const dayCount = dates?.length || '';
        return `正在查询${city}${dayCount ? `未来${dayCount}天` : ''}天气...`;
      }
      return TOOL_LABELS[toolName];
    }

    case 'search_nearby_hotels': {
      const city = input.city as string | undefined;
      const target = input.target_location as string | undefined;
      if (city) {
        return `正在搜索${city}${target ? `${target}附近` : ''}酒店...`;
      }
      return TOOL_LABELS[toolName];
    }

    case 'geocode': {
      const address = input.address as string | undefined;
      if (address) {
        return `正在定位「${address}」...`;
      }
      return TOOL_LABELS[toolName];
    }

    case 'search_poi': {
      const keyword = input.keyword as string | undefined;
      const city = input.city as string | undefined;
      if (keyword) {
        return `正在搜索${city ? city : ''}${keyword}...`;
      }
      return TOOL_LABELS[toolName];
    }

    case 'plan_route': {
      const mode = input.mode as string | undefined;
      const modeMap: Record<string, string> = {
        driving: '驾车',
        transit: '公交',
        walking: '步行',
      };
      return `正在规划${mode ? modeMap[mode] || mode : ''}路线...`;
    }

    case 'generate_final_itinerary':
      return '正在生成完整行程方案...';

    case 'create_calendar_event': {
      const summary = input.summary as string | undefined;
      if (summary) {
        return `正在创建日程「${summary}」...`;
      }
      return TOOL_LABELS[toolName];
    }

    default:
      return TOOL_LABELS[toolName] || toolName;
  }
}
