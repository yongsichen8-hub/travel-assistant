/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 高德地图 JS API 2.0 基础类型声明
 * 仅声明项目中用到的类和方法，非完整类型。
 */
declare namespace AMap {
  class LngLat {
    constructor(lng: number, lat: number);
    getLng(): number;
    getLat(): number;
  }

  class Pixel {
    constructor(x: number, y: number);
  }

  class Bounds {
    constructor(southWest?: LngLat, northEast?: LngLat);
    extend(lnglat: LngLat): void;
  }

  interface MapOptions {
    zoom?: number;
    center?: LngLat | [number, number];
    viewMode?: '2D' | '3D';
    features?: string[];
  }

  class Map {
    constructor(container: HTMLElement, options?: MapOptions);
    add(overlay: any): void;
    remove(overlay: any): void;
    clearMap(): void;
    setFitView(overlays?: any[] | null, immediately?: boolean, padding?: number[], maxZoom?: number): void;
    setBounds(bounds: Bounds, immediately?: boolean, padding?: number[]): void;
    destroy(): void;
  }

  interface MarkerOptions {
    position?: LngLat | [number, number];
    content?: string | HTMLElement;
    anchor?: string;
    zIndex?: number;
  }

  class Marker {
    constructor(options?: MarkerOptions);
    on(event: string, handler: (...args: any[]) => void): void;
  }

  interface PolylineOptions {
    path?: LngLat[] | [number, number][];
    strokeColor?: string;
    strokeWeight?: number;
    strokeOpacity?: number;
    strokeStyle?: string;
    lineJoin?: string;
    lineCap?: string;
    showDir?: boolean;
  }

  class Polyline {
    constructor(options?: PolylineOptions);
  }

  interface InfoWindowOptions {
    isCustom?: boolean;
    offset?: Pixel;
    content?: string | HTMLElement;
  }

  class InfoWindow {
    constructor(options?: InfoWindowOptions);
    setContent(content: string | HTMLElement): void;
    open(map: Map, position: LngLat | [number, number]): void;
    close(): void;
  }
}
