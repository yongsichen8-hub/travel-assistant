/**
 * 和风天气 (QWeather) API 客户端
 * 1. 城市搜索 → 获取 LocationID
 * 2. 3日天气预报 → 获取真实天气数据
 *
 * 新版和风天气使用项目专属 API Host（格式: xxx.qweatherapi.com）
 * 通过环境变量 QWEATHER_API_HOST 配置
 */

function getApiHost(): string {
  const host = process.env.QWEATHER_API_HOST;
  if (!host) throw new Error('QWEATHER_API_HOST 未配置，请在控制台「设置」中查看你的 API Host');
  return host.replace(/\/$/, ''); // 去除末尾斜杠
}

function getApiKey(): string {
  const key = process.env.QWEATHER_API_KEY;
  if (!key) throw new Error('QWEATHER_API_KEY 未配置');
  return key;
}

interface WeatherDayForecast {
  fxDate: string;
  textDay: string;
  tempMax: string;
  tempMin: string;
}

interface CityLookupResult {
  code: string;
  location?: { id: string; name: string }[];
}

interface WeatherForecastResult {
  code: string;
  daily?: WeatherDayForecast[];
}

// 精简后返回给 LLM 的天气数据结构
export interface WeatherForecast {
  date: string;
  weather: string;
  temperature_high: number;
  temperature_low: number;
}

export interface WeatherResponse {
  city: string;
  forecasts: WeatherForecast[];
}

/**
 * 步骤1: 城市搜索，将中文城市名转换为 LocationID
 */
async function lookupCity(city: string): Promise<{ id: string } | { error: string }> {
  const host = getApiHost();
  const key = getApiKey();
  const url = `https://${host}/geo/v2/city/lookup?location=${encodeURIComponent(city)}&number=1`;

  const res = await fetch(url, {
    headers: { 'X-QW-Api-Key': key },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { error: `城市搜索API调用失败。状态码: ${res.status}，返回详情: ${text}` };
  }

  const data = (await res.json()) as CityLookupResult;

  if (data.code !== '200' || !data.location || data.location.length === 0) {
    return { error: `城市搜索失败。API返回code: ${data.code}，城市「${city}」未匹配到结果` };
  }

  return { id: data.location[0].id };
}

/**
 * 步骤2: 获取未来3天天气预报
 */
async function fetchForecast(locationId: string): Promise<{ daily: WeatherDayForecast[] } | { error: string }> {
  const host = getApiHost();
  const key = getApiKey();
  const url = `https://${host}/v7/weather/3d?location=${locationId}`;

  const res = await fetch(url, {
    headers: { 'X-QW-Api-Key': key },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { error: `天气预报API调用失败。状态码: ${res.status}，返回详情: ${text}` };
  }

  const data = (await res.json()) as WeatherForecastResult;

  if (data.code !== '200' || !data.daily) {
    return { error: `天气预报失败。API返回code: ${data.code}，locationId: ${locationId}` };
  }

  return { daily: data.daily };
}

/**
 * 计算目标日期相对于今天的天数差
 * daily[0]=今天, daily[1]=明天, daily[2]=后天
 * 如果解析失败，返回 1（默认取明天）
 */
function getDayOffset(dateStr: string): number {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    // 限制在 0-2 范围内，超出则兜底取 1（明天）
    if (diffDays >= 0 && diffDays <= 2) return diffDays;
    return 1; // 兜底：返回明天
  } catch {
    return 1; // 解析失败，兜底返回明天
  }
}

/**
 * 对外暴露的天气查询函数
 * 使用相对天数索引匹配：daily[0]=今天, daily[1]=明天, daily[2]=后天
 * 绝不返回"超出预报范围"，兜底返回 daily[1]
 */
export async function getWeather(city: string, dates: string[]): Promise<WeatherResponse | { error: string }> {
  try {
    // 城市搜索
    const cityResult = await lookupCity(city);
    if ('error' in cityResult) {
      return { error: cityResult.error };
    }

    // 获取3天预报
    const forecastResult = await fetchForecast(cityResult.id);
    if ('error' in forecastResult) {
      return { error: forecastResult.error };
    }

    const daily = forecastResult.daily;

    // 基于相对天数索引匹配，不做字符串对比
    const forecasts: WeatherForecast[] = dates.map((date) => {
      const offset = getDayOffset(date);
      const entry = daily[offset] ?? daily[1] ?? daily[0]; // 兜底链
      return {
        date,
        weather: entry.textDay,
        temperature_high: Number(entry.tempMax),
        temperature_low: Number(entry.tempMin),
      };
    });

    return { city, forecasts };
  } catch (err) {
    return {
      error: `天气查询失败: ${err instanceof Error ? err.message : '网络异常，请稍后重试'}`,
    };
  }
}
