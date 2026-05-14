import type { FlightData } from '@/components/ui/FlightCard';

export interface FlightCandidateGroup {
  direction: 'outbound' | 'return' | 'unknown';
  departureCity: string;
  arrivalCity: string;
  date: string;
  flights: FlightData[];
}

export interface HotelCandidate {
  name: string;
  address: string;
  distance: string;
  price: string;
  rating: string;
}
