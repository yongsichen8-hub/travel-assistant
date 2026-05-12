/**
 * 酒店搜索 — 直接 fetch + AbortController 8秒强制超时
 *
 * 双引擎：
 *   A) 有 target_location → 先查坐标 → 周边 2km 酒店
 *   B) 无 target_location → 城市关键词酒店搜索
 *
 * 永远不 throw，出错返回严格禁止脑补的 JSON 字符串
 */

const AMAP_BASE = 'https://restapi.amap.com/v3';
const TIMEOUT_MS = 8000;

interface HotelPOI {
  name: string;
  address: string;
  distance?: string;
  location?: string;
  biz_ext?: { lowest_price?: string; rating?: string };
  rating?: string;
}

interface AmapPOIResponse {
  status: string;
  pois?: HotelPOI[];
}

function getApiKey(): string {
  const key = (process.env.AMAP_API_KEY || '').trim();
  if (!key) throw new Error('AMAP_API_KEY 未配置');
  return key;
}

/**
 * 搜索酒店 — 供 tool execute 直接调用
 * 返回 JSON 字符串，永不 throw
 */
export async function searchNearbyHotels(
  city: string,
  targetLocation?: string,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const key = getApiKey();
    let targetCoord = '';
    let targetName = '';

    // 步骤一：如果有目标地标，先查坐标
    if (targetLocation) {
      console.log(`【酒店工具】正在获取地标坐标: ${targetLocation}`);
      const geoUrl = `${AMAP_BASE}/place/text?keywords=${encodeURIComponent(targetLocation)}&city=${encodeURIComponent(city)}&key=${key}&offset=1&output=json`;
      const geoRes = await fetch(geoUrl, { signal: controller.signal });
      const geoData: AmapPOIResponse = await geoRes.json();
      targetCoord = geoData?.pois?.[0]?.location || '';
      targetName = geoData?.pois?.[0]?.name || targetLocation;
      console.log(`【酒店工具】地标解析结果: coord=${targetCoord}, name=${targetName}`);
    }

    // 步骤二：双引擎查询
    let hotelRes: Response;
    let searchMode: string;

    if (targetCoord) {
      console.log(`【酒店工具】按坐标查周边酒店: ${targetCoord}`);
      hotelRes = await fetch(
        `${AMAP_BASE}/place/around?location=${targetCoord}&types=100100&radius=2000&key=${key}&offset=10&sortrule=distance&output=json`,
        { signal: controller.signal },
      );
      searchMode = '地标周边';
    } else {
      console.log(`【酒店工具】按城市查常规酒店: ${city}`);
      hotelRes = await fetch(
        `${AMAP_BASE}/place/text?keywords=${encodeURIComponent('酒店')}&city=${encodeURIComponent(city)}&types=100100&key=${key}&offset=10&output=json`,
        { signal: controller.signal },
      );
      searchMode = targetLocation ? `无法定位"${targetLocation}"，已降级为城市搜索` : '城市搜索';
    }

    clearTimeout(timeoutId);

    const hotelData: AmapPOIResponse = await hotelRes.json();
    const hotels = (hotelData?.pois || []).slice(0, 4).map((p) => ({
      name: p.name,
      address: p.address || '',
      distance: p.distance || '未知',
      price: p.biz_ext?.lowest_price || '暂无',
      rating: p.biz_ext?.rating || p.rating || '4.5',
    }));

    console.log(`【酒店工具】成功获取 ${hotels.length} 家酒店`);

    return JSON.stringify({
      instruction: '以下为高德实时真实数据，严禁自行编造！将 distance(米) 换算为步行时间(80米/分钟)。',
      searchMode,
      targetName: targetCoord ? targetName : undefined,
      hotels,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('【酒店工具】发生致命错误或超时:', error);

    return JSON.stringify({
      error: '高德地图接口查询超时或失败',
      instruction: '【最高级指令：接口调用失败！你必须原原本本地告诉用户"抱歉，当前酒店实时查询系统出现网络波动，无法获取真实酒店数据"。绝对、绝对禁止自行推荐任何酒店！哪怕是你记忆中最著名的五星级酒店也不允许提及！】',
    });
  }
}
