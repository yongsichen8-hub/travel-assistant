import { amapRequest } from './client';
import type { AmapResponse, RouteResult, TransitRouteResult } from '@/lib/types/amap';

export async function planRoute(
  origin: string,
  destination: string,
  mode: 'driving' | 'transit' | 'walking'
) {
  if (mode === 'transit') {
    return await planTransitRoute(origin, destination);
  }

  const endpoint = mode === 'driving' ? '/direction/driving' : '/direction/walking';

  const data = await amapRequest<{ route: RouteResult }>( endpoint, {
    origin,
    destination,
    extensions: 'base',
  });

  const route = data.route;
  if (!route || !route.paths || route.paths.length === 0) {
    return { error: `未找到从 ${origin} 到 ${destination} 的${mode === 'driving' ? '驾车' : '步行'}路线` };
  }

  const path = route.paths[0];
  return {
    mode,
    distance: Number(path.distance),
    duration: Number(path.duration),
    steps: path.steps.map((s) => s.instruction).slice(0, 5),
  };
}

async function planTransitRoute(origin: string, destination: string) {
  const originCity = '全国';

  const data = await amapRequest<{ route: TransitRouteResult }>('/direction/transit/integrated', {
    origin,
    destination,
    city: originCity,
    cityd: originCity,
  });

  const route = data.route;
  if (!route || !route.transits || route.transits.length === 0) {
    return { error: `未找到从 ${origin} 到 ${destination} 的公交路线` };
  }

  const transit = route.transits[0];
  return {
    mode: 'transit' as const,
    distance: Number(route.distance),
    duration: Number(transit.duration),
    cost: transit.cost,
    walking_distance: Number(transit.walking_distance),
  };
}
