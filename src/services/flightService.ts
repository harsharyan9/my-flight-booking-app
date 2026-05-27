/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Flight, SearchParams } from '../types';
import { AIRLINES, AIRPORTS } from '../constants';
import { addHours, format, addDays } from 'date-fns';
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export class FlightService {
  /**
   * Search for flights using Gemini AI to simulate a real-world API.
   * This provides realistic airlines, schedules, and pricing for any global route.
   */
  static async searchFlights(params: SearchParams): Promise<Flight[]> {
    if (!ai) {
      console.warn("GEMINI_API_KEY not found, falling back to mock data.");
      return this.generateMockFlights(params.origin, params.destination, params.departureDate, params.class);
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate 5-8 realistic flight options for a search from "${params.origin}" to "${params.destination}" on ${params.departureDate} in ${params.class} class.
        
        CRITICAL RULES:
        1. If the route is domestic (same country), strictly use airlines that operate in that country (e.g. for India use IndiGo, Air India, Vistara, Akasa, SpiceJet). NEVER use international-only carriers for domestic routes.
        2. If the route is international, use appropriate flag carriers or international airlines.
        3. Prices must be in INR and reflect realistic current market rates for the distance and class.
        4. Use realistic flight durations and reasonable departure/arrival times.
        5. Return ONLY a JSON array of objects.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                airline: { type: Type.STRING },
                flightNumber: { type: Type.STRING },
                origin: {
                  type: Type.OBJECT,
                  properties: {
                    code: { type: Type.STRING },
                    city: { type: Type.STRING },
                    airport: { type: Type.STRING }
                  },
                  required: ["code", "city", "airport"]
                },
                destination: {
                  type: Type.OBJECT,
                  properties: {
                    code: { type: Type.STRING },
                    city: { type: Type.STRING },
                    airport: { type: Type.STRING }
                  },
                  required: ["code", "city", "airport"]
                },
                departureTime: { type: Type.STRING, description: "ISO 8601 string" },
                arrivalTime: { type: Type.STRING, description: "ISO 8601 string" },
                price: { type: Type.NUMBER },
                currency: { type: Type.STRING },
                duration: { type: Type.STRING },
                class: { type: Type.STRING },
                stops: { type: Type.NUMBER },
                layoverDuration: { type: Type.NUMBER, description: "Total layover time in minutes, if any" }
              },
              required: ["id", "airline", "flightNumber", "origin", "destination", "departureTime", "arrivalTime", "price", "currency", "duration", "class", "stops"]
            }
          }
        }
      });

      const flights = JSON.parse(response.text) as Flight[];
      return flights.sort((a, b) => a.price - b.price);
    } catch (error) {
      console.error("Flight API Error:", error);
      return this.generateMockFlights(params.origin, params.destination, params.departureDate, params.class);
    }
  }

  /**
   * Generates a list of mock flights for a specific route and date.
   * Scales prices based on flight class and randomizes airlines.
   */
  private static generateMockFlights(origin: string, dest: string, date: string, flightClass: string): Flight[] {
    const flights: Flight[] = [];
    const count = Math.floor(Math.random() * 5) + 3; // 3-8 flights per day

    const originAirport = AIRPORTS.find(a => 
      a.code.toUpperCase() === origin.toUpperCase() || 
      a.city.toLowerCase() === origin.toLowerCase() ||
      a.name.toLowerCase() === origin.toLowerCase() ||
      origin.includes(`(${a.code})`)
    );
    const destAirport = AIRPORTS.find(a => 
      a.code.toUpperCase() === dest.toUpperCase() || 
      a.city.toLowerCase() === dest.toLowerCase() ||
      a.name.toLowerCase() === dest.toLowerCase() ||
      dest.includes(`(${a.code})`)
    );
    
    // Fallback search criteria if not found in our registry
    const effectiveOriginCode = originAirport?.code || origin.toUpperCase().substring(0, 3);
    const effectiveDestCode = destAirport?.code || dest.toUpperCase().substring(0, 3);
    
    // Determine if domestic (same country)
    const isDomestic = originAirport && destAirport && originAirport.country === destAirport.country;
    const isIndia = originAirport?.country === 'India' && destAirport?.country === 'India';

    // Filter airlines by region
    const availableAirlines = AIRLINES.filter(airline => {
      if (isIndia) return airline.regions.includes('India') || airline.regions.includes('Global');
      if (isDomestic) return airline.regions.includes('Global') || (!airline.regions.includes('India') && !airline.regions.includes('International'));
      return airline.regions.includes('International') || airline.regions.includes('Global');
    });
    
    // If no airlines found for region, just use all
    const flightAirlines = availableAirlines.length > 0 ? availableAirlines : AIRLINES;
    
    // Base duration: 1-3h for domestic, 6-14h for international
    const minDuration = isDomestic ? 1 : 6;
    const maxDurationOffset = isDomestic ? 3 : 10;

    for (let i = 0; i < count; i++) {
      const airline = flightAirlines[Math.floor(Math.random() * flightAirlines.length)];
      const hourOffset = 6 + i * 2;
      const departureTime = new Date(`${date}T${hourOffset.toString().padStart(2, '0')}:00:00`);
      
      const durationHours = Math.floor(Math.random() * maxDurationOffset) + minDuration;
      const arrivalTime = addHours(departureTime, durationHours);
      
      // Base price: ₹4,000-12,000 for domestic, ₹32,000-72,000 for international
      const minPrice = isDomestic ? 4000 : 32000;
      const maxPriceOffset = isDomestic ? 8000 : 40000;
      const basePrice = minPrice + Math.random() * maxPriceOffset;
      
      const classMultiplier = flightClass === 'Business' ? 2.5 : flightClass === 'First' ? 5 : 1;

      flights.push({
        id: `FL-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        airline: airline.name,
        flightNumber: `${airline.name.substring(0, 2).toUpperCase()}${Math.floor(100 + Math.random() * 899)}`,
        origin: {
          code: effectiveOriginCode,
          city: originAirport?.city || origin.split('(')[0].trim(),
          airport: originAirport?.name || `${origin.split('(')[0].trim()} Airport`
        },
        destination: {
          code: effectiveDestCode,
          city: destAirport?.city || dest.split('(')[0].trim(),
          airport: destAirport?.name || `${dest.split('(')[0].trim()} Airport`
        },
        departureTime: departureTime.toISOString(),
        arrivalTime: arrivalTime.toISOString(),
        price: Math.floor(basePrice * classMultiplier),
        currency: 'INR',
        duration: `${durationHours}h ${Math.floor(Math.random() * 60)}m`,
        class: flightClass as any,
        stops: isDomestic ? 0 : (Math.random() > 0.6 ? 1 : 0),
        layoverDuration: isDomestic ? 0 : (Math.random() > 0.6 ? Math.floor(Math.random() * 240) + 60 : 0)
      });
    }

    return flights.sort((a, b) => a.price - b.price);
  }
}
