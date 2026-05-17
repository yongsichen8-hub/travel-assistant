import { tool } from 'ai';
import { z } from 'zod';
import { ItinerarySchema } from '@/lib/agent/schemas';
import { geocode } from '@/lib/amap/geocoding';
import { searchPOI } from '@/lib/amap/poi-search';
import { searchNearbyHotels } from '@/lib/amap/hotel-search';
import { planRoute } from '@/lib/amap/route-planning';
import { searchFlights } from '@/lib/flight/search';
import { getWeather } from '@/lib/weather/client';

export const allTools = {
  geocode: tool({
    description: '将地点名称或地址转换为经纬度坐标。用于获取精确位置信息。',
    inputSchema: z.object({
      address: z.string().describe('地点名称或详细地址'),
      city: z.string().optional().describe('所在城市名，用于缩小搜索范围'),
    }),
    execute: async ({ address, city }) => {
      try {
        return await geocode(address, city);
      } catch (error) {
        return { error: `地理编码查询失败: ${error instanceof Error ? error.message : '未知错误'}` };
      }
    },
  }),

  search_poi: tool({
    description: '搜索兴趣点（景点、酒店、餐厅、商圈等）。返回名称、地址、坐标、评分等信息。',
    inputSchema: z.object({
      keyword: z.string().describe('搜索关键词，如"故宫"、"火锅"、"五星酒店"'),
      city: z.string().optional().describe('限定搜索的城市'),
      location: z.string().optional().describe('搜索中心点坐标 "lng,lat"，用于附近搜索'),
      radius: z.number().optional().describe('搜索半径（米），默认5000'),
      type: z.string().optional().describe('POI类型编码，如"010000"(汽车服务)'),
    }),
    execute: async ({ keyword, city, location, radius, type }) => {
      try {
        return await searchPOI({ keyword, city, location, radius, type });
      } catch (error) {
        return { error: `POI搜索失败: ${error instanceof Error ? error.message : '未知错误'}` };
      }
    },
  }),

  plan_route: tool({
    description: '规划两点之间的路线，返回距离和预计用时。支持驾车、公交、步行三种方式。',
    inputSchema: z.object({
      origin: z.string().describe('出发点坐标 "lng,lat"'),
      destination: z.string().describe('目的地坐标 "lng,lat"'),
      mode: z.enum(['driving', 'transit', 'walking']).describe('交通方式：driving(驾车)、transit(公交)、walking(步行)'),
    }),
    execute: async ({ origin, destination, mode }) => {
      try {
        return await planRoute(origin, destination, mode);
      } catch (error) {
        return { error: `路线规划失败: ${error instanceof Error ? error.message : '未知错误'}` };
      }
    },
  }),

  search_flights: tool({
    description: '搜索两个城市之间的真实航班信息。【前置条件】调用此工具前必须已经调用过 check_schedule 获取用户日程，选择航班时必须避开日程冲突时段。返回全天所有航班的极简视图，你需要结合用户日程和偏好从中挑选最合适的航班。绝对禁止编造任何不在结果中的航班号。',
    inputSchema: z.object({
      departure_city: z.string().describe('出发城市（中文名，如"北京"、"广州"）'),
      arrival_city: z.string().describe('到达城市（中文名，如"上海"、"深圳"）'),
      date: z.string().describe('出发日期 (YYYY-MM-DD)'),
      cabin_class: z.enum(['economy', 'business', 'first']).optional().describe('舱位等级'),
    }),
    execute: async ({ departure_city, arrival_city, date, cabin_class }) => {
      try {
        const result = await searchFlights({ departure_city, arrival_city, date, cabin_class });
        const flights = result.flights;
        if (flights.length > 0) {
          const count = flights.length;
          // 极简脱水格式：航班号 | 航司 | 起降时间 | 出发机场-到达机场 | 价格 | 经停
          const flightLines = flights.map(f =>
            `${f.flightNo} | ${f.airline} | ${f.departureTime}-${f.arrivalTime} | ${f.departureAirport}-${f.arrivalAirport} | ¥${f.price} | ${f.stops === 0 ? '直飞' : `经停${f.stops}`}`
          ).join('\n');
          return `【航班数据】${departure_city}→${arrival_city} ${date} 共${count}趟航班（全量，已去重代码共享）格式：航班号 | 航司 | 起降时间 | 机场 | 价格 | 经停。请结合用户的飞书日历和偏好从中挑选最符合要求的航班，注意价格和经停信息。不同机场到目的地的通勤时间不同（如北京首都vs大兴、上海浦东vs虹桥），请优先推荐离用户办事地点更近的机场。绝对禁止编造不在此列表中的航班号。\n\n${flightLines}`;
        }
        return '【航班查询结果】未查询到该航线的航班数据。请告知用户暂无航班信息，绝对不要编造航班号。';
      } catch (error) {
        return `航班搜索失败: ${error instanceof Error ? error.message : '未知错误'}`;
      }
    },
  }),

  search_nearby_hotels: tool({
    description: '搜索酒店住宿。优先根据用户的办事地点/游玩目标搜索周边2公里内的酒店；如果不知道具体地点则搜索城市热门酒店。使用前应先了解用户在目的地的主要活动区域。',
    inputSchema: z.object({
      city: z.string().describe('城市名称（必填）'),
      target_location: z.string().optional().describe('用户的主要活动地点/办事处/景点名称（选填，提供后会搜索该地标步行范围内的酒店）'),
    }),
    execute: async ({ city, target_location }) => {
      // searchNearbyHotels 内部已有 8s 超时 + try-catch，永不 throw，直接返回 JSON 字符串
      return await searchNearbyHotels(city, target_location);
    },
  }),

  check_schedule: tool({
    description: '【必须最先调用】查询用户飞书日历在指定日期的已有日程安排。在规划任何行程之前必须先调用此工具获取用户的日程冲突信息，然后才能调用 search_flights。（降级模式：飞书日历未授权时返回提示）',
    inputSchema: z.object({
      dates: z.array(z.string()).describe('需要检查的日期列表，格式为 YYYY-MM-DD'),
    }),
    execute: async () => {
      return {
        error: '飞书日历未授权，无法查询真实日程。请提醒用户先通过飞书登录授权日历权限。',
        conflicts: [],
        available_dates: [],
      };
    },
  }),

  get_weather: tool({
    description: '查询指定城市在特定日期的天气预报，帮助规划行程时考虑天气因素。',
    inputSchema: z.object({
      city: z.string().describe('城市名称'),
      dates: z.array(z.string()).describe('查询日期列表，格式为 YYYY-MM-DD'),
    }),
    execute: async ({ city, dates }) => {
      try {
        return await getWeather(city, dates);
      } catch (error) {
        return { error: `天气查询失败: ${error instanceof Error ? error.message : '未知错误'}` };
      }
    },
  }),

  generate_final_itinerary: tool({
    description: '当你已收集完所有必要信息并生成了完整行程方案时，调用此工具输出最终行程。这是行程规划的最终步骤，必须在所有信息收集完毕后调用。',
    inputSchema: ItinerarySchema,
    execute: async (itinerary) => {
      return itinerary;
    },
  }),
};
