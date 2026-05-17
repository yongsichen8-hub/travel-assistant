import { FlightSearchParams, FlightResult } from './types';
import { fetchFliggyFlights } from './adapters/fliggyAdapter';
import { fetchVariflightFlights } from './adapters/variflightAdapter';
import { fetchCorporateFlights } from './adapters/corporateAdapter';

/**
 * 航班搜索路由中枢
 * 飞常准为主数据源（时刻表），飞猪为辅助补价源
 * 主从对照补价逻辑（Left Join 思维）
 */
export async function searchFlights(
  params: FlightSearchParams
): Promise<{ flights: FlightResult[] }> {
  const source = process.env.FLIGHT_DATA_SOURCE || 'variflight';
  
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
      // 默认：飞常准（主）+ 飞猪（辅助补价）并发查询
      const [variResult, fliggyResult] = await Promise.allSettled([
        fetchVariflightFlights(params),
        fetchFliggyFlights(params),
      ]);

      const masterFlights = variResult.status === 'fulfilled' ? variResult.value : [];
      const supplementFlights = fliggyResult.status === 'fulfilled' ? fliggyResult.value : [];

      if (variResult.status === 'rejected') {
        console.error('[FlightSearch] 飞常准请求失败:', variResult.reason);
      }
      if (fliggyResult.status === 'rejected') {
        console.error('[FlightSearch] 飞猪请求失败:', fliggyResult.reason);
      }

      // 构建飞猪价格字典
      const priceMap = new Map<string, number>();
      supplementFlights.forEach(f => {
        if (f.price > 0) priceMap.set(f.flightNo, f.price);
      });

      // 主从补价（Left Join 思维）
      if (masterFlights.length > 0) {
        // 飞常准有数据：以飞常准为主，飞猪补价
        rawFlights = masterFlights.map(flight => {
          const matchedPrice = priceMap.get(flight.flightNo);
          if (matchedPrice) {
            flight.price = matchedPrice;
          } else {
            flight.price = 1850;
            flight.priceTag = '企业协议价';
          }
          return flight;
        });
        console.log(`[FlightSearch] 飞常准 ${masterFlights.length} 趟(主) + 飞猪补价 ${priceMap.size} 条`);
      } else {
        // 飞常准无数据：降级使用飞猪全量
        rawFlights = supplementFlights;
        console.log(`[FlightSearch] 飞常准无数据，降级飞猪 ${supplementFlights.length} 趟`);
      }
    }
  } catch (error) {
    console.error('[FlightSearch] 数据获取异常:', error);
    rawFlights = [];
  }

  // ========== 数据清洗阀门 ==========
  const validFlights = rawFlights.filter(flight => {
    // price=-1 代表有效航班但需询价，允许通过
    const hasValidPrice = flight.price > 0 || flight.price === -1;
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
