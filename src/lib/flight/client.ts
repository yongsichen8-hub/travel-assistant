const AMAP_BASE_URL = 'https://restapi.amap.com/v3';
const TIMEOUT_MS = 10000;

/**
 * 航班 API 客户端
 * MVP 阶段仅为框架占位，实际调用走 mock
 * 后续接入真实 API 时在此实现 HTTP 请求逻辑
 */
export async function flightApiRequest<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>
): Promise<T> {
  const apiKey = process.env.FLIGHT_API_KEY;
  if (!apiKey) {
    throw new Error('FLIGHT_API_KEY 未配置，使用 mock 模式');
  }

  // TODO: 替换为真实航班 API 的基础 URL 和请求逻辑
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // 占位：真实 API 调用
    throw new Error('真实航班 API 尚未实现');
  } finally {
    clearTimeout(timeout);
  }
}
