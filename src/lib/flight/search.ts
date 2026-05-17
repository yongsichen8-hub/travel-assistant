import { FlightSearchParams, FlightResult } from './types';
import { fetchFliggyFlights } from './adapters/fliggyAdapter';
import { fetchCorporateFlights } from './adapters/corporateAdapter';

/**
 * 航班搜索路由中枢
 * 根据环境变量选择数据源，并对结果执行数据清洗
 */
export async function searchFlights(
  params: FlightSearchParams
): Promise<{ flights: FlightResult[] }> {
  const source = process.env.FLIGHT_DATA_SOURCE || 'fliggy';
  
  console.log(`[FlightSearch] 数据源: ${source}, 查询: ${params.departure_city} → ${params.arrival_city}, ${params.date}`);
  
  let rawFlights: FlightResult[] = [];

  try {
    if (source === 'corporate') {
      // 企业接口优先，空结果降级到飞猪
      rawFlights = await fetchCorporateFlights(params);
      if (rawFlights.length === 0) {
        console.log('[FlightSearch] 企业接口无结果，降级到飞猪');
        rawFlights = await fetchFliggyFlights(params);
      }
    } else {
      // 默认使用飞猪
      rawFlights = await fetchFliggyFlights(params);
    }
  } catch (error) {
    console.error('[FlightSearch] 数据获取异常:', error);
    rawFlights = [];
  }

  // ========== 数据清洗阀门 ==========
  const validFlights = rawFlights.filter(flight => {
    const hasValidPrice = flight.price > 0;
    const isNotCancelled = !flight.status || 
      (flight.status !== 'Cancelled' && flight.status !== '已取消');
    const hasValidTime = Boolean(flight.departureTime && flight.arrivalTime);
    return hasValidPrice && isNotCancelled && hasValidTime;
  });

  console.log(`[FlightSearch] 原始 ${rawFlights.length} 趟 → 清洗后 ${validFlights.length} 趟有效航班`);

  return { flights: validFlights };
}
