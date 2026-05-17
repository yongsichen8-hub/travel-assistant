import { FlightSearchParams, FlightResult } from './types';
import { fetchFliggyFlights } from './adapters/fliggyAdapter';
import { fetchCorporateFlights } from './adapters/corporateAdapter';
import { fetchRapidFlights } from './adapters/rapidAdapter';

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
      // 默认：飞猪 + RapidAPI 并发查询，智能补价合并
      const [fliggyResult, rapidResult] = await Promise.allSettled([
        fetchFliggyFlights(params),
        fetchRapidFlights(params),
      ]);

      const fliggyFlights = fliggyResult.status === 'fulfilled' ? fliggyResult.value : [];
      const rapidFlights = rapidResult.status === 'fulfilled' ? rapidResult.value : [];

      if (fliggyResult.status === 'rejected') {
        console.error('[FlightSearch] 飞猪请求失败:', fliggyResult.reason);
      }
      if (rapidResult.status === 'rejected') {
        console.error('[FlightSearch] RapidAPI请求失败:', rapidResult.reason);
      }

      // 智能补价合并：以飞猪为主，RapidAPI 补充
      const mergedMap = new Map<string, FlightResult>();

      // 先放入飞猪数据
      for (const f of fliggyFlights) {
        mergedMap.set(f.flightNo, f);
      }

      // RapidAPI 数据：如果飞猪没有该航班则新增；如果有但价格为0或极低，用 rapid 的价格覆盖
      for (const r of rapidFlights) {
        const existing = mergedMap.get(r.flightNo);
        if (!existing) {
          mergedMap.set(r.flightNo, r);
        } else if (existing.price <= 0 && r.price > 0) {
          existing.price = r.price;
          existing.source = 'merged';
        }
      }

      rawFlights = Array.from(mergedMap.values());

      console.log(`[FlightSearch] 飞猪 ${fliggyFlights.length} 趟 + RapidAPI ${rapidFlights.length} 趟 → 合并 ${rawFlights.length} 趟`);
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

    // 国内直飞铁律：出发和到达城市都含中文 → 视为国内航线，强制只保留直飞
    const isDomestic =
      /[\u4e00-\u9fa5]/.test(flight.departureCity) &&
      /[\u4e00-\u9fa5]/.test(flight.arrivalCity);
    if (isDomestic && flight.stops > 0) {
      return false;
    }

    return hasValidPrice && isNotCancelled && hasValidTime;
  });

  // 全量返回，按起飞时间从早到晚排序
  validFlights.sort((a, b) => {
    const timeA = a.departureTime || '';
    const timeB = b.departureTime || '';
    return timeA.localeCompare(timeB);
  });

  console.log(`[FlightSearch] 原始 ${rawFlights.length} 趟 → 清洗后 ${validFlights.length} 趟有效航班`);

  return { flights: validFlights };
}
