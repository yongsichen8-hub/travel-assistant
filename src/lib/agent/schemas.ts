import { z } from 'zod';

// === 基础类型 ===

export const LocationSchema = z.object({
  name: z.string().describe('地点名称'),
  address: z.string().describe('详细地址'),
  coordinates: z.object({
    lng: z.number().describe('经度'),
    lat: z.number().describe('纬度'),
  }),
});

export const RouteInfoSchema = z.object({
  mode: z.enum(['driving', 'transit', 'walking']).describe('交通方式'),
  distance: z.number().describe('距离（米）'),
  duration: z.number().describe('时长（秒）'),
});

export const FlightInfoSchema = z.object({
  flightNo: z.string().describe('航班号'),
  airline: z.string().describe('航空公司'),
  departureCity: z.string().describe('出发城市'),
  arrivalCity: z.string().describe('到达城市'),
  departureTime: z.string().describe('起飞时间 (HH:mm)'),
  arrivalTime: z.string().describe('到达时间 (HH:mm)'),
  price: z.number().optional().describe('参考价格（元）'),
  cabinClass: z.enum(['economy', 'business', 'first']).optional().describe('舱位'),
});

// === 活动类型 ===

export const ActivitySchema = z.object({
  id: z.string().describe('活动唯一ID'),
  time: z.string().describe('开始时间 (HH:mm)'),
  endTime: z.string().optional().describe('结束时间 (HH:mm)'),
  title: z.string().describe('活动标题'),
  description: z.string().describe('活动描述'),
  location: LocationSchema,
  type: z.enum(['transport', 'flight', 'attraction', 'meal', 'hotel', 'meeting', 'free_time']).describe('活动类型'),
  duration: z.number().describe('持续时间（分钟）'),
  route: RouteInfoSchema.optional().describe('从上一个活动到此处的路线信息'),
  flight: FlightInfoSchema.optional().describe('航班信息（仅 type=flight 时）'),
  tips: z.string().optional().describe('小贴士'),
});

// === 日计划 ===

export const DayPlanSchema = z.object({
  dayNumber: z.number().describe('第几天'),
  date: z.string().describe('日期 (YYYY-MM-DD)'),
  theme: z.string().describe('当日主题'),
  activities: z.array(ActivitySchema).describe('当日活动列表'),
});

// === 预算估算 ===

export const BudgetEstimateSchema = z.object({
  transportation: z.number().describe('交通费用（元）'),
  accommodation: z.number().describe('住宿费用（元）'),
  food: z.number().describe('餐饮费用（元）'),
  tickets: z.number().describe('门票/娱乐费用（元）'),
  total: z.number().describe('总预算（元）'),
});

// === 完整行程 ===

export const ItinerarySchema = z.object({
  title: z.string().describe('行程标题'),
  summary: z.string().describe('行程摘要'),
  startDate: z.string().describe('开始日期 (YYYY-MM-DD)'),
  endDate: z.string().describe('结束日期 (YYYY-MM-DD)'),
  origin: LocationSchema.describe('出发地'),
  destination: LocationSchema.describe('目的地'),
  days: z.array(DayPlanSchema).describe('每日行程计划'),
  totalDistance: z.number().describe('总行程距离（公里）'),
  estimatedBudget: BudgetEstimateSchema.optional().describe('预算估算'),
  tips: z.array(z.string()).optional().describe('出行提示'),
});

// === TypeScript 类型导出 (从 Zod schema 推导) ===

export type Location = z.infer<typeof LocationSchema>;
export type RouteInfo = z.infer<typeof RouteInfoSchema>;
export type FlightInfo = z.infer<typeof FlightInfoSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type DayPlan = z.infer<typeof DayPlanSchema>;
export type BudgetEstimate = z.infer<typeof BudgetEstimateSchema>;
export type Itinerary = z.infer<typeof ItinerarySchema>;
