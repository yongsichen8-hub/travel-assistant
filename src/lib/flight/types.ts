export interface FlightSearchParams {
  departure_city: string;
  arrival_city: string;
  date: string;
  cabin_class?: 'economy' | 'business' | 'first';
}

export interface FlightSegment {
  flightNo: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  duration: number; // 分钟
}

export interface FlightResult {
  flightNo: string;
  airline: string;
  departureCity: string;
  arrivalCity: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;        // HH:mm
  arrivalTime: string;          // HH:mm
  duration: string;             // "2h30min" 格式
  price: number;                // 票价（人民币元），飞猪直接提供
  cabinClass: string;           // 舱位（经济舱/商务舱/头等舱）
  aircraft: string;             // 机型，FR24 前端异步补充
  stops: number;                // 经停数，0=直飞
  source: string;               // 数据来源标记（fliggy/corporate）
  currency: 'CNY';              // 币种，固定人民币
  status?: string;              // 航班状态（用于清洗过滤）
  segments?: FlightSegment[];   // 经停段详情
  onTimeRate?: string;          // 准点率（可选）
  priceTag?: string;           // 价格标签（如'企业协议价'）
}
