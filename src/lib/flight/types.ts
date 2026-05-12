export interface FlightSearchParams {
  departure_city: string;
  arrival_city: string;
  date: string;
  cabin_class?: 'economy' | 'business' | 'first';
}

export interface FlightResult {
  flightNo: string;
  airline: string;
  departureCity: string;
  arrivalCity: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  price: number;
  cabinClass: 'economy' | 'business' | 'first';
  aircraft: string;
  onTimeRate?: string;
}
