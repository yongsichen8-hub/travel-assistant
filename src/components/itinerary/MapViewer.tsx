'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { DayPlan, Activity } from '@/lib/types/itinerary';

interface MapViewerProps {
  days: DayPlan[];
  selectedDay: number; // 0-based index
}

// 高德 JS API 动态加载后的模块类型
interface AMapModule {
  Map: typeof AMap.Map;
  Marker: typeof AMap.Marker;
  Polyline: typeof AMap.Polyline;
  InfoWindow: typeof AMap.InfoWindow;
  LngLat: typeof AMap.LngLat;
  Pixel: typeof AMap.Pixel;
}

// 交通方式中文映射
const modeLabels: Record<string, string> = {
  driving: '驾车',
  transit: '公交',
  walking: '步行',
};

// 格式化秒为分钟/小时
function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
}

// 过滤出有有效坐标的活动
function getValidActivities(activities: Activity[]): Activity[] {
  return activities.filter(
    (a) =>
      a.location?.coordinates?.lng != null &&
      a.location?.coordinates?.lat != null &&
      isFinite(a.location.coordinates.lng) &&
      isFinite(a.location.coordinates.lat)
  );
}

export function MapViewer({ days, selectedDay }: MapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<AMap.Map | null>(null);
  const amapRef = useRef<AMapModule | null>(null);
  const markersRef = useRef<(AMap.Marker | AMap.Polyline)[]>([]);
  const infoWindowRef = useRef<AMap.InfoWindow | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 初始化地图
  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      try {
        // 设置安全密钥（高德 JS API 2.0 要求）
        const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE;
        if (securityCode) {
          (window as unknown as Record<string, unknown>)._AMapSecurityConfig = {
            securityJsCode: securityCode,
          };
        }

        const AMapLoader = (await import('@amap/amap-jsapi-loader')).default;
        const AMapModule = await AMapLoader.load({
          key: process.env.NEXT_PUBLIC_AMAP_KEY || '',
          version: '2.0',
        }) as unknown as AMapModule;

        if (cancelled || !containerRef.current) return;

        const map = new AMapModule.Map(containerRef.current, {
          zoom: 12,
          viewMode: '2D',
          features: ['bg', 'road', 'building'],
        });

        mapInstanceRef.current = map;
        amapRef.current = AMapModule;
        infoWindowRef.current = new AMapModule.InfoWindow({
          isCustom: true,
          offset: new AMapModule.Pixel(0, -36),
        });

        setMapLoaded(true);
      } catch (err: unknown) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : '地图加载失败');
        }
      }
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 清除所有覆盖物（使用 clearMap 整体清除，保证视野干净）
  const clearOverlays = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.clearMap();
    markersRef.current = [];

    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }
  }, []);

  // 渲染当天的 Markers 和 Polylines
  const renderDayOverlays = useCallback(
    (dayIndex: number) => {
      const map = mapInstanceRef.current;
      const A = amapRef.current;
      if (!map || !A || !days[dayIndex]) return;

      clearOverlays();

      const dayPlan = days[dayIndex];
      const validActivities = getValidActivities(dayPlan.activities);

      if (validActivities.length === 0) return;

      // 创建带编号的 Markers
      validActivities.forEach((activity, idx) => {
        const { lng, lat } = activity.location.coordinates;
        const label = String.fromCharCode(65 + idx); // A, B, C, ...

        const markerContent = document.createElement('div');
        markerContent.innerHTML = `
          <div style="
            width: 28px; height: 28px;
            background: #2563eb;
            border: 2px solid #fff;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            color: #fff; font-size: 13px; font-weight: 700;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            cursor: pointer;
          ">${label}</div>
        `;

        const marker = new A.Marker({
          position: new A.LngLat(lng, lat),
          content: markerContent,
          anchor: 'center',
        });

        marker.on('click', () => {
          const infoContent = `
            <div style="
              background: #fff;
              border-radius: 8px;
              padding: 12px 16px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              max-width: 220px;
              font-family: system-ui, sans-serif;
            ">
              <div style="font-weight: 600; font-size: 14px; color: #1f2937; margin-bottom: 4px;">
                ${label}. ${activity.title}
              </div>
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">
                ${activity.time}${activity.endTime ? ' - ' + activity.endTime : ''}
              </div>
              <div style="font-size: 12px; color: #4b5563;">
                ${activity.description || activity.location.name}
              </div>
              ${activity.route ? `
                <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af;">
                  ${modeLabels[activity.route.mode] || activity.route.mode} · ${formatDuration(activity.route.duration)}
                </div>
              ` : ''}
            </div>
          `;
          infoWindowRef.current?.setContent(infoContent);
          infoWindowRef.current?.open(map, new A.LngLat(lng, lat));
        });

        map.add(marker);
        markersRef.current.push(marker);
      });

      // 绘制折线连接各点
      if (validActivities.length > 1) {
        const path = validActivities.map(
          (a) => new A.LngLat(a.location.coordinates.lng, a.location.coordinates.lat)
        );

        const polyline = new A.Polyline({
          path,
          strokeColor: '#2563eb',
          strokeWeight: 4,
          strokeOpacity: 0.7,
          strokeStyle: 'solid',
          lineJoin: 'round',
          lineCap: 'round',
          showDir: true,
        });

        map.add(polyline);
        markersRef.current.push(polyline);

        // 在折线中点添加路段标注
        for (let i = 0; i < validActivities.length - 1; i++) {
          const curr = validActivities[i];
          const next = validActivities[i + 1];

          if (next.route) {
            const midLng = (curr.location.coordinates.lng + next.location.coordinates.lng) / 2;
            const midLat = (curr.location.coordinates.lat + next.location.coordinates.lat) / 2;

            const routeLabel = document.createElement('div');
            routeLabel.innerHTML = `
              <div style="
                background: rgba(255,255,255,0.95);
                border: 1px solid #e5e7eb;
                border-radius: 4px;
                padding: 2px 6px;
                font-size: 11px;
                color: #4b5563;
                white-space: nowrap;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              ">${modeLabels[next.route.mode] || next.route.mode} ${formatDuration(next.route.duration)}</div>
            `;

            const routeMarker = new A.Marker({
              position: new A.LngLat(midLng, midLat),
              content: routeLabel,
              anchor: 'center',
              zIndex: 80,
            });

            map.add(routeMarker);
            markersRef.current.push(routeMarker);
          }
        }
      }

      // 自适应视野：聚焦到当天所有覆盖物，maxZoom=14 防止过度放大
      map.setFitView(null, false, [60, 60, 60, 60], 14);
    },
    [days, clearOverlays]
  );

  // 当 selectedDay 或地图加载完毕时渲染覆盖物
  useEffect(() => {
    if (mapLoaded) {
      renderDayOverlays(selectedDay);
    }
  }, [mapLoaded, selectedDay, renderDayOverlays]);

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-500">
        地图加载失败: {loadError}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
          <div className="text-sm text-zinc-500">地图加载中...</div>
        </div>
      )}
    </div>
  );
}
