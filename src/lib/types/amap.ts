export interface AmapResponse<T> {
  status: '1' | '0';
  info: string;
  infocode: string;
  count?: string;
  geocodes?: T[];
  pois?: T[];
  route?: T;
}

export interface GeocodingResult {
  formatted_address: string;
  location: string; // "lng,lat"
  level: string;
  city: string;
}

export interface POIResult {
  id: string;
  name: string;
  type: string;
  address: string;
  location: string; // "lng,lat"
  tel?: string;
  rating?: string;
  cost?: string;
  cityname: string;
}

export interface RouteResult {
  origin: string;
  destination: string;
  paths: Array<{
    distance: string;
    duration: string;
    steps: Array<{ instruction: string; distance: string }>;
  }>;
}

export interface TransitRouteResult {
  origin: string;
  destination: string;
  distance: string;
  transits: Array<{
    cost: string;
    duration: string;
    walking_distance: string;
    segments: Array<{
      bus?: { buslines: Array<{ name: string; departure_stop: { name: string }; arrival_stop: { name: string } }> };
      walking?: { distance: string };
    }>;
  }>;
}
