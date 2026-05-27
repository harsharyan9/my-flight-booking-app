/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Flight {
  id: string;
  airline: string;
  flightNumber: string;
  origin: {
    code: string;
    city: string;
    airport: string;
  };
  destination: {
    code: string;
    city: string;
    airport: string;
  };
  departureTime: string;
  arrivalTime: string;
  price: number;
  currency: string;
  duration: string; // e.g., "5h 30m"
  class: 'Economy' | 'Business' | 'First';
  stops: number;
  layoverDuration?: number; // Minutes
}

export interface Booking {
  id: string;
  userId: string;
  flightId: string;
  passengerName: string;
  seatNumber: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  bookedAt: string;
  flightDetails: Flight;
}

export interface MultiCitySegment {
  origin: string;
  destination: string;
  departureDate: string;
}

export interface SearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  class: 'Economy' | 'Business' | 'First';
  tripType: 'one-way' | 'round-trip' | 'multi-city';
  segments?: MultiCitySegment[];
}
