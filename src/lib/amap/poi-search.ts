import { amapRequest } from './client';
import type { AmapResponse, POIResult } from '@/lib/types/amap';

interface SearchPOIParams {
  keyword: string;
  city?: string;
  location?: string;
  radius?: number;
  type?: string;
}

export async function searchPOI(params: SearchPOIParams) {
  const { keyword, city, location, radius, type } = params;

  const data = await amapRequest<AmapResponse<POIResult>>('/place/text', {
    keywords: keyword,
    city,
    location,
    radius: radius || 5000,
    types: type,
    extensions: 'all',
    offset: '10',
  });

  const pois = data.pois || [];

  if (pois.length === 0) {
    return { results: [], message: `未找到与 "${keyword}" 相关的地点` };
  }

  return {
    results: pois.slice(0, 8).map((poi) => ({
      name: poi.name,
      address: poi.address,
      location: poi.location,
      type: poi.type,
      city: poi.cityname,
      tel: poi.tel || undefined,
      rating: poi.rating || undefined,
    })),
  };
}
