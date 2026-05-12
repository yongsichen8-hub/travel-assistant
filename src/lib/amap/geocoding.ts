import { amapRequest } from './client';
import type { AmapResponse, GeocodingResult } from '@/lib/types/amap';

export async function geocode(address: string, city?: string) {
  const data = await amapRequest<AmapResponse<GeocodingResult>>('/geocode/geo', {
    address,
    city,
  });

  const results = data.geocodes || [];

  if (results.length === 0) {
    return { error: `未找到地址 "${address}" 的地理编码结果` };
  }

  const top = results[0];
  return {
    formatted_address: top.formatted_address,
    location: top.location,
    city: top.city,
    level: top.level,
  };
}
