import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // 1. 解析请求体
  const { flightNo, date } = await request.json();

  if (!flightNo) {
    return NextResponse.json({ error: 'flightNo is required' }, { status: 400 });
  }

  try {
    // 2. 调用 FR24 API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(
      `https://api.flightradar24.com/common/v1/flight/list.json?query=${encodeURIComponent(flightNo)}&fetchBy=flight&page=1&limit=25`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Origin: 'https://www.flightradar24.com',
          Referer: 'https://www.flightradar24.com/',
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({});
    }

    const data = await response.json();

    // 3. 解析 FR24 响应提取机型信息
    // FR24 响应结构：data.result.response.data 数组，每个元素含航班信息
    // 尝试从中提取 aircraft_type 字段
    // 具体解析逻辑需根据实际响应结构调整

    let aircraft: string | undefined;
    let status: string | undefined;
    let delayMinutes: number | undefined;

    // FR24 的响应可能在 result.response.data 或 result.response.item.data
    const flightData =
      data?.result?.response?.data || data?.result?.response?.item?.data;

    if (Array.isArray(flightData) && flightData.length > 0) {
      // 找到最近的航班记录
      const latestFlight = flightData[0];
      aircraft =
        latestFlight?.aircraft?.model?.text ||
        latestFlight?.aircraft?.text ||
        '';
      status = latestFlight?.status?.text || '';

      // 计算延误
      if (
        latestFlight?.time?.scheduled?.departure &&
        latestFlight?.time?.real?.departure
      ) {
        delayMinutes = Math.round(
          (latestFlight.time.real.departure -
            latestFlight.time.scheduled.departure) /
            60
        );
      }
    }

    return NextResponse.json({
      aircraft: aircraft || undefined,
      status: status || undefined,
      delayMinutes: delayMinutes ?? undefined,
    });
  } catch (error) {
    // 超时或网络错误，静默返回空对象
    console.error(
      '[FR24 enrich] Error:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({});
  }
}
