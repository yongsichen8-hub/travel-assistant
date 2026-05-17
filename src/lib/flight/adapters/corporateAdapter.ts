import { FlightSearchParams, FlightResult } from '../types';

/**
 * 企业商旅 ToB API 适配器（占位）
 * 未来接入携程商旅等企业级接口时在此实现
 */
export async function fetchCorporateFlights(params: FlightSearchParams): Promise<FlightResult[]> {
  console.warn(
    '[CorporateAdapter] 企业商旅 API 未配置，使用公开数据源。',
    `查询: ${params.departure_city} → ${params.arrival_city}, ${params.date}`
  );
  return [];
}
