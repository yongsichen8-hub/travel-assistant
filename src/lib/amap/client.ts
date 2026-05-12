const AMAP_BASE_URL = 'https://restapi.amap.com/v3';
const TIMEOUT_MS = 10000;

export async function amapRequest<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>
): Promise<T> {
  const apiKey = process.env.AMAP_API_KEY;
  if (!apiKey) {
    throw new Error('AMAP_API_KEY 未配置');
  }

  const searchParams = new URLSearchParams();
  searchParams.set('key', apiKey);
  searchParams.set('output', 'json');

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  }

  const url = `${AMAP_BASE_URL}${endpoint}?${searchParams.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`高德 API 请求失败: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.status === '0') {
      throw new Error(`高德 API 错误: ${data.info} (code: ${data.infocode})`);
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('高德 API 请求超时 (10s)');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
