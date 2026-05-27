/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plane, ArrowRight, Loader2, Filter, ChevronRight, Clock, MapPin, Search, Grid, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FlightService } from '../services/flightService';
import { Flight, MultiCitySegment } from '../types';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { AIRLINES } from '../constants';

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Multi-city selection state
  const [currentLegIndex, setCurrentLegIndex] = useState(0);
  const [selectedFlights, setSelectedFlights] = useState<Flight[]>([]);
  const [isMultiCity, setIsMultiCity] = useState(searchParams.get('tripType') === 'multi-city');
  const [segments, setSegments] = useState<MultiCitySegment[]>(() => {
    const raw = searchParams.get('segments');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Advanced Filters State
  const [filters, setFilters] = useState({
    directOnly: false,
    maxLayover: 1440,
    alliance: 'All',
    departureWindow: 'Any',
    arrivalWindow: 'Any',
    sortBy: 'Price'
  });

  useEffect(() => {
    const fetchFlights = async () => {
      setLoading(true);
      try {
        let origin = '';
        let destination = '';
        let date = '';

        if (isMultiCity && segments.length > 0) {
          const s = segments[currentLegIndex];
          origin = s.origin;
          destination = s.destination;
          date = s.departureDate;
        } else {
          origin = searchParams.get('origin') || '';
          destination = searchParams.get('destination') || '';
          date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
        }

        const flightClass = searchParams.get('class') || 'Economy';
        const passengers = parseInt(searchParams.get('passengers') || '1');

        const results = await FlightService.searchFlights({
          origin,
          destination,
          departureDate: date,
          passengers,
          class: flightClass as any,
          tripType: isMultiCity ? 'multi-city' : 'one-way'
        } as any);
        setFlights(results);
      } catch (err) {
        setError('Failed to fetch flights. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchFlights();
  }, [searchParams, currentLegIndex, isMultiCity, segments]);

  const filteredFlights = useMemo(() => {
    let result = flights.filter(f => {
      if (filters.directOnly && f.stops > 0) return false;
      if (f.stops > 0 && f.layoverDuration && f.layoverDuration > filters.maxLayover) return false;
      if (filters.alliance !== 'All') {
        const airline = AIRLINES.find(a => a.name === f.airline);
        if (airline?.alliance !== filters.alliance) return false;
      }
      const checkTimeWindow = (timeStr: string, window: string) => {
        if (window === 'Any') return true;
        const hour = new Date(timeStr).getHours();
        if (window === 'Early Morning') return hour >= 0 && hour < 6;
        if (window === 'Morning') return hour >= 6 && hour < 12;
        if (window === 'Afternoon') return hour >= 12 && hour < 18;
        if (window === 'Evening') return hour >= 18 && hour < 24;
        return true;
      };
      if (!checkTimeWindow(f.departureTime, filters.departureWindow)) return false;
      if (!checkTimeWindow(f.arrivalTime, filters.arrivalWindow)) return false;
      return true;
    });

    if (filters.sortBy === 'Price') {
      result.sort((a, b) => a.price - b.price);
    } else if (filters.sortBy === 'Duration') {
      const getMin = (d: string) => {
        const match = d.match(/(\d+)h\s*(\d+)m/);
        if (!match) return 0;
        return parseInt(match[1]) * 60 + parseInt(match[2]);
      };
      result.sort((a, b) => getMin(a.duration) - getMin(b.duration));
    }
    return result;
  }, [flights, filters]);

  const handleSelectFlight = (flight: Flight) => {
    if (isMultiCity) {
      const newSelections = [...selectedFlights];
      newSelections[currentLegIndex] = flight;
      setSelectedFlights(newSelections);

      if (currentLegIndex < segments.length - 1) {
        setCurrentLegIndex(currentLegIndex + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // Multi-city completion - navigate to a custom booking state or just first flight
        // For simplicity, we'll proceed with the entire bundle
        navigate(`/booking/${selectedFlights[0].id}`, { 
          state: { 
            flight: selectedFlights[0],
            allFlights: [...selectedFlights.slice(0, currentLegIndex), flight],
            isMultiCity: true 
          } 
        });
      }
    } else {
      navigate(`/booking/${flight.id}`, { state: { flight } });
    }
  };

  const activeOrigin = isMultiCity ? segments[currentLegIndex]?.origin : searchParams.get('origin');
  const activeDestination = isMultiCity ? segments[currentLegIndex]?.destination : searchParams.get('destination');
  const activeDate = isMultiCity ? segments[currentLegIndex]?.departureDate : searchParams.get('date');

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-black text-white">
        <Loader2 className="w-12 h-12 text-brand-600 animate-spin mb-6" />
        <div className="text-center">
          <p className="text-gray-400 font-light tracking-[0.3em] uppercase text-[10px] mb-2">
            Leg {currentLegIndex + 1} of {segments.length || 1}
          </p>
          <p className="text-sm tracking-widest uppercase italic animate-pulse">Scanning Experimental Routes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-64px)] overflow-hidden">
      {/* Sidebar Filters */}
      <aside className="w-full md:w-96 bg-white border-r border-surface-200 overflow-y-auto z-10 shrink-0 custom-scrollbar">
        <div className="p-8 space-y-10">
          {isMultiCity && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-ink-900 mb-6 flex items-center gap-2">
                <Grid className="w-3.5 h-3.5 text-brand-600" />
                Trip Progress
              </h2>
              <div className="space-y-3">
                {segments.map((s, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "p-4 rounded-sm border transition-all flex items-center justify-between",
                      idx === currentLegIndex ? "bg-brand-600/5 border-brand-600 shadow-sm" : 
                      idx < currentLegIndex ? "bg-green-50 border-green-100" : "bg-surface-50 border-surface-200 opacity-60"
                    )}
                  >
                    <div>
                      <p className="text-[8px] font-bold uppercase tracking-widest mb-1 text-ink-400">Flight {idx + 1}</p>
                      <p className="text-[10px] font-bold text-ink-900 uppercase">
                        {s.origin.split('(')[1]?.replace(')', '') || s.origin} → {s.destination.split('(')[1]?.replace(')', '') || s.destination}
                      </p>
                    </div>
                    {idx < currentLegIndex ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : idx === currentLegIndex ? (
                      <div className="w-2 h-2 bg-brand-600 rounded-full animate-ping" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-ink-900 mb-6 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-brand-600" />
              {isMultiCity ? `Leg ${currentLegIndex + 1} Details` : 'Active Route'}
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-surface-50 border border-surface-200 rounded-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">From</span>
                  <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">To</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold tracking-tight">{activeOrigin}</span>
                  <ArrowRight className="w-4 h-4 text-brand-600" />
                  <span className="text-sm font-bold tracking-tight">{activeDestination}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-surface-50 border border-surface-200 rounded-sm text-[10px] font-bold text-ink-900 uppercase text-center">
                  {format(new Date(activeDate || new Date()), 'dd MMM yyyy')}
                </div>
                <div className="p-3 bg-surface-50 border border-surface-200 rounded-sm text-[10px] font-bold text-ink-900 uppercase text-center">
                  {searchParams.get('passengers')} Pass • {searchParams.get('class')}
                </div>
              </div>
              <button 
                onClick={() => navigate('/')}
                className="w-full py-3 text-[10px] font-bold uppercase tracking-widest text-brand-600 border border-brand-600/20 hover:bg-brand-600 hover:text-white transition-all rounded-sm"
              >
                Modify Search
              </button>
            </div>
          </div>

          <div className="space-y-8">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-ink-900 flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-brand-600" />
              Advanced Filters
            </h2>

            <div className="flex items-center justify-between p-4 bg-surface-50 rounded-sm border border-surface-100">
              <span className="text-[10px] font-bold text-ink-900 uppercase tracking-widest">Direct flights only</span>
              <button 
                onClick={() => setFilters(f => ({ ...f, directOnly: !f.directOnly }))}
                className={cn(
                  "w-10 h-5 rounded-full transition-colors relative",
                  filters.directOnly ? "bg-brand-600" : "bg-surface-200"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-3 h-3 bg-white rounded-full transition-transform",
                  filters.directOnly ? "left-6" : "left-1"
                )} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Airline Alliance</label>
              <div className="grid grid-cols-2 gap-2">
                {['All', 'Star Alliance', 'SkyTeam', 'Oneworld'].map(alliance => (
                  <button
                    key={alliance}
                    onClick={() => setFilters(f => ({ ...f, alliance }))}
                    className={cn(
                      "py-2 px-3 text-[10px] font-bold uppercase tracking-widest border transition-all rounded-sm",
                      filters.alliance === alliance 
                        ? "bg-ink-900 border-ink-900 text-white shadow-lg" 
                        : "bg-white border-surface-200 text-ink-400 hover:border-brand-600 hover:text-brand-600"
                    )}
                  >
                    {alliance}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Max Layover</label>
                <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">Up to {Math.floor(filters.maxLayover / 60)}h</span>
              </div>
              <input 
                type="range" 
                min="120" 
                max="1440" 
                step="60"
                value={filters.maxLayover}
                onChange={(e) => setFilters(f => ({ ...f, maxLayover: parseInt(e.target.value) }))}
                className="w-full accent-brand-600 h-1.5 bg-surface-200 rounded-full appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Departure Time</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Any', 'Early Morning', 'Morning', 'Afternoon', 'Evening'].map(win => (
                    <button
                      key={win}
                      onClick={() => setFilters(f => ({ ...f, departureWindow: win }))}
                      className={cn(
                        "py-2 px-3 text-[9px] font-bold uppercase tracking-widest border transition-all rounded-sm",
                        filters.departureWindow === win 
                          ? "bg-ink-900 border-ink-900 text-white" 
                          : "bg-white border-surface-200 text-ink-400 hover:border-brand-600 hover:text-brand-600"
                      )}
                    >
                      {win}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Results Main Area */}
      <main className="flex-1 p-8 md:p-12 overflow-y-auto bg-surface-50 custom-scrollbar" style={{ perspective: '2500px', transformStyle: 'preserve-3d' }}>
        <div className="max-w-4xl mx-auto" style={{ transformStyle: 'preserve-3d' }}>
          {isMultiCity && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-ink-900 text-white p-6 rounded-sm mb-12 flex items-center justify-between"
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-1">Choosing Leg {currentLegIndex + 1} of {segments.length}</p>
                <h3 className="text-xl font-bold italic tracking-tight">
                  {activeOrigin?.split('(')[0]} <ArrowRight className="inline-block w-4 h-4 mx-2" /> {activeDestination?.split('(')[0]}
                </h3>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-1">Total Trip Class</p>
                <p className="text-sm font-bold uppercase tracking-widest text-brand-600">{searchParams.get('class')}</p>
              </div>
            </motion.div>
          )}

          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tighter italic text-ink-900 mb-1">
                {isMultiCity ? `Leg ${currentLegIndex + 1} Options` : 'Recommended Flights'}
              </h1>
              <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Showing {filteredFlights.length} potential routes found</p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Sort:</span>
              <div className="flex bg-white border border-surface-200 rounded-sm p-1">
                {['Price', 'Duration'].map(s => (
                  <button
                    key={s}
                    onClick={() => setFilters(f => ({ ...f, sortBy: s }))}
                    className={cn(
                      "px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-sm transition-all",
                      filters.sortBy === s ? "bg-brand-600 text-white shadow-sm" : "text-ink-400 hover:text-ink-900"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {filteredFlights.length === 0 ? (
              <div className="text-center py-32 bg-white border border-surface-200 rounded-sm shadow-sm">
                <div className="w-16 h-16 bg-surface-50 border border-surface-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Plane className="w-8 h-8 text-surface-200" />
                </div>
                <h3 className="text-2xl font-bold italic mb-3">No matching flights</h3>
                <p className="text-ink-400 text-sm max-w-xs mx-auto mb-8">Try adjusting your filters for this leg.</p>
                <button 
                  onClick={() => setFilters({
                    directOnly: false,
                    maxLayover: 1440,
                    alliance: 'All',
                    departureWindow: 'Any',
                    arrivalWindow: 'Any',
                    sortBy: 'Price'
                  })}
                  className="px-8 py-3 bg-ink-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-brand-600 transition-all"
                >
                  Reset Leg Filters
                </button>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredFlights.map((flight, idx) => (
                  <motion.div
                    key={flight.id}
                    layout
                    initial={{ opacity: 0, y: 50, rotateX: 15, scale: 0.9 }}
                    whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ 
                      duration: 0.8, 
                      delay: idx * 0.05,
                      ease: [0.16, 1, 0.3, 1] 
                    }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ 
                      scale: 1.02,
                      translateY: -5,
                      rotateX: 2,
                      rotateY: -2,
                      z: 20,
                      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
                      transition: { duration: 0.4, ease: "easeOut" }
                    }}
                    style={{ transformStyle: 'preserve-3d' }}
                    className={cn(
                      "bg-white border border-surface-200 transition-all group overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-brand-600/10",
                      idx === 0 && "border-l-4 border-l-brand-600"
                    )}
                  >
                    <div className="p-8 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12" style={{ transform: 'translateZ(30px)' }}>
                      <div className="flex flex-col sm:flex-row items-center gap-8 lg:gap-10 w-full lg:w-auto">
                        <div className="w-16 h-16 bg-surface-50 border border-surface-100 flex items-center justify-center font-bold text-[10px] uppercase tracking-tighter text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-all transform group-hover:scale-105 duration-300">
                          {flight.airline.split(' ').map(n => n[0]).join('')}
                        </div>

                        <div className="text-center sm:text-left grow">
                          <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 mb-1">
                            <span className="text-2xl font-bold tracking-tight text-ink-900">
                              {format(new Date(flight.departureTime), 'HH:mm')} — {format(new Date(flight.arrivalTime), 'HH:mm')}
                            </span>
                            <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest font-mono">
                              {flight.flightNumber}
                            </span>
                          </div>
                          <p className="text-[10px] font-bold text-ink-400 uppercase tracking-[0.2em]">
                            {flight.airline} 
                            <span className="mx-2 text-surface-300">|</span> 
                            {flight.stops === 0 ? 'Non-stop' : `${flight.stops} Stop (${Math.floor((flight.layoverDuration || 0) / 60)}h layover)`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-12 lg:gap-16 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 border-surface-100 pt-6 lg:pt-0">
                        <div className="text-center hidden sm:block">
                          <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            Duration
                          </p>
                          <p className="text-sm font-bold tracking-tight text-ink-900">{flight.duration}</p>
                        </div>

                        <div className="text-right flex items-center lg:flex-col lg:items-end gap-6 lg:gap-1">
                          <p className="text-3xl font-bold tracking-tighter text-ink-900">
                            ₹{flight.price.toLocaleString()}
                          </p>
                          <button 
                            onClick={() => handleSelectFlight(flight)}
                            className="bg-ink-900 hover:bg-brand-600 text-white px-8 py-3 text-[10px] font-bold uppercase tracking-[0.2em] rounded-sm transition-all shadow-lg active:scale-95"
                          >
                            {isMultiCity ? (currentLegIndex === segments.length - 1 ? 'Finish Selection' : 'Select & Next Leg') : 'Book Seat'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SearchResults;
