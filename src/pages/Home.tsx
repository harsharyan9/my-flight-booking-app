/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, Users, ArrowRight, Plus, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useMotionValue } from 'motion/react';
import { AIRPORTS, FLIGHT_CLASSES } from '../constants';
import { cn } from '../lib/utils';
import { format, addDays } from 'date-fns';

const FeatureCard: React.FC<{ dest: any, i: number, onClick: () => void }> = ({ dest, i, onClick }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { stiffness: 150, damping: 20 };
  const mouseXSpring = useSpring(x, springConfig);
  const mouseYSpring = useSpring(y, springConfig);

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["12deg", "-12deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-12deg", "12deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ 
        type: "spring",
        stiffness: 100,
        damping: 20,
        delay: i * 0.05
      }}
      style={{
        rotateX: isHovered ? rotateX : 0,
        rotateY: isHovered ? rotateY : 0,
        perspective: "1000px",
        transformStyle: "preserve-3d"
      }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative h-96 bg-white border border-surface-200 p-2 overflow-hidden cursor-pointer will-change-transform"
      onClick={onClick}
    >
      <div className="relative h-full w-full overflow-hidden" style={{ transform: "translateZ(30px)", transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}>
        <img 
          src={dest.img} 
          alt={dest.city}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-ink-900/40 group-hover:bg-ink-900/20 transition-colors duration-500" />
        <div className="absolute bottom-6 left-6 right-6 text-white" style={{ transform: "translateZ(40px)" }}>
          <p className="text-[10px] uppercase tracking-widest font-bold mb-1 opacity-80">{dest.country}</p>
          <h3 className="text-3xl font-bold italic mb-1 drop-shadow-lg">{dest.city}</h3>
          <div className="flex items-center justify-between border-t border-white/20 pt-3">
            <span className="text-xs font-bold font-mono">FROM ₹{dest.price.toLocaleString()}</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-2" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const Home = () => {
  const navigate = useNavigate();
  const [tripType, setTripType] = useState<'one-way' | 'multi-city'>('one-way');
  const [searchParams, setSearchParams] = useState({
    origin: '',
    destination: '',
    departureDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    passengers: 1,
    flightClass: 'Economy'
  });

  const heroScrollRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  
  // Smoother springs for all animations
  const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 };
  
  const rawY = useTransform(scrollYProgress, [0, 0.4], [0, -120]);
  const heroY = useSpring(rawY, springConfig);
  
  const rawScale = useTransform(scrollYProgress, [0, 0.4], [1, 0.92]);
  const heroScale = useSpring(rawScale, springConfig);
  
  const rawRotate = useTransform(scrollYProgress, [0, 0.4], [0, -3]);
  const heroRotate = useSpring(rawRotate, springConfig);

  const destRotateRaw = useTransform(scrollYProgress, [0.2, 0.6], [5, 0]);
  const destRotate = useSpring(destRotateRaw, springConfig);
  
  const contentOpacity = useTransform(scrollYProgress, [0, 0.2, 0.5], [1, 0.9, 0.6]);

  const featuredDestinations = [
    { city: 'Tokyo', code: 'HND', country: 'Japan', price: 68400, img: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&q=80&w=800' },
    { city: 'Delhi', code: 'DEL', country: 'India', price: 4200, img: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&q=80&w=800' },
    { city: 'Dubai', code: 'DXB', country: 'UAE', price: 56100, img: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&q=80&w=800' },
    { city: 'Paris', code: 'CDG', country: 'France', price: 72000, img: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&q=80&w=800' },
    { city: 'Singapore', code: 'SIN', country: 'Singapore', price: 34500, img: 'https://images.unsplash.com/photo-1525183995014-bd94c0750cd5?auto=format&fit=crop&w=800&q=80' },
    { city: 'New York', code: 'JFK', country: 'USA', price: 89000, img: 'https://images.unsplash.com/photo-1522083165195-3424ed129620?auto=format&fit=crop&w=800&q=80' },
    { city: 'London', code: 'LHR', country: 'UK', price: 65000, img: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&q=80&w=800' },
    { city: 'Sydney', code: 'SYD', country: 'Australia', price: 78000, img: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&q=80&w=800' },
    { city: 'Rome', code: 'FCO', country: 'Italy', price: 54000, img: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&q=80&w=800' }
  ];

  const [visibleStartIndex, setVisibleStartIndex] = useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setVisibleStartIndex(current => (current + 1) % featuredDestinations.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [featuredDestinations.length]);

  const visibleDestinations = featuredDestinations.slice(visibleStartIndex, visibleStartIndex + 3);
  // Handle wrapping
  if (visibleDestinations.length < 3) {
    visibleDestinations.push(...featuredDestinations.slice(0, 3 - visibleDestinations.length));
  }

  const [multiCitySegments, setMultiCitySegments] = useState([
    { origin: '', destination: '', date: format(addDays(new Date(), 7), 'yyyy-MM-dd') },
    { origin: '', destination: '', date: format(addDays(new Date(), 10), 'yyyy-MM-dd') }
  ]);

  const addSegment = () => {
    if (multiCitySegments.length < 5) {
      const lastSegment = multiCitySegments[multiCitySegments.length - 1];
      setMultiCitySegments([
        ...multiCitySegments,
        { 
          origin: lastSegment.destination, 
          destination: '', 
          date: format(addDays(new Date(lastSegment.date), 3), 'yyyy-MM-dd') 
        }
      ]);
    }
  };

  const removeSegment = (index: number) => {
    if (multiCitySegments.length > 2) {
      setMultiCitySegments(multiCitySegments.filter((_, i) => i !== index));
    }
  };

  const updateSegment = (index: number, field: string, value: string) => {
    const newSegments = [...multiCitySegments];
    newSegments[index] = { ...newSegments[index], [field]: value };
    setMultiCitySegments(newSegments);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (tripType === 'multi-city') {
      const query = new URLSearchParams({
        tripType: 'multi-city',
        segments: JSON.stringify(multiCitySegments),
        passengers: searchParams.passengers.toString(),
        class: searchParams.flightClass
      }).toString();
      navigate(`/search?${query}`);
    } else {
      const query = new URLSearchParams({
        origin: searchParams.origin,
        destination: searchParams.destination,
        date: searchParams.departureDate,
        passengers: searchParams.passengers.toString(),
        class: searchParams.flightClass
      }).toString();
      navigate(`/search?${query}`);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-64px)] overflow-hidden" style={{ perspective: "2500px" }}>
      {/* Sidebar Search Panel */}
      <motion.aside 
        className="w-full md:w-96 bg-white border-r border-surface-200 overflow-y-auto z-10 shrink-0 custom-scrollbar"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-ink-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-brand-600" />
              Book Flight
            </h2>
            <div className="flex bg-surface-50 border border-surface-200 rounded-sm p-1">
              {[
                { id: 'one-way', label: 'One Way' },
                { id: 'multi-city', label: 'Multi-City' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTripType(t.id as any)}
                  className={cn(
                    "px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-sm transition-all",
                    tripType === t.id ? "bg-ink-900 text-white shadow-sm" : "text-ink-400 hover:text-ink-900"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSearch} className="space-y-8">
            {tripType === 'one-way' ? (
              <div className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">From</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-600" />
                    <input
                      type="text"
                      placeholder="Origin Airport"
                      list="origins"
                      required
                      className="w-full p-4 pl-10 bg-surface-50 border border-surface-200 rounded-sm text-sm font-medium focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600 transition-all"
                      value={searchParams.origin}
                      onChange={(e) => setSearchParams({ ...searchParams, origin: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">To</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-600" />
                    <input
                      type="text"
                      placeholder="Destination Airport"
                      list="destinations"
                      required
                      className="w-full p-4 pl-10 bg-surface-50 border border-surface-200 rounded-sm text-sm font-medium focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600 transition-all"
                      value={searchParams.destination}
                      onChange={(e) => setSearchParams({ ...searchParams, destination: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">Departure Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      className="w-full p-4 bg-surface-50 border border-surface-200 rounded-sm text-xs font-medium focus:outline-none focus:border-brand-600 transition-all"
                      value={searchParams.departureDate}
                      onChange={(e) => setSearchParams({ ...searchParams, departureDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {multiCitySegments.map((segment, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-surface-50 border border-surface-200 rounded-sm relative group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">Flight {idx + 1}</span>
                      {multiCitySegments.length > 2 && (
                        <button 
                          type="button"
                          onClick={() => removeSegment(idx)}
                          className="p-1.5 hover:bg-white hover:text-red-600 transition-all rounded-sm text-ink-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          placeholder="From"
                          list="origins"
                          required
                          className="w-full p-3 bg-white border border-surface-200 rounded-sm text-xs font-medium focus:outline-none focus:border-brand-600 transition-all"
                          value={segment.origin}
                          onChange={(e) => updateSegment(idx, 'origin', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          placeholder="To"
                          list="destinations"
                          required
                          className="w-full p-3 bg-white border border-surface-200 rounded-sm text-xs font-medium focus:outline-none focus:border-brand-600 transition-all"
                          value={segment.destination}
                          onChange={(e) => updateSegment(idx, 'destination', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <input
                          type="date"
                          required
                          className="w-full p-3 bg-white border border-surface-200 rounded-sm text-xs font-medium focus:outline-none focus:border-brand-600 transition-all"
                          value={segment.date}
                          onChange={(e) => updateSegment(idx, 'date', e.target.value)}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}

                <button 
                  type="button"
                  onClick={addSegment}
                  disabled={multiCitySegments.length >= 5}
                  className="w-full py-4 border border-dashed border-surface-300 text-ink-400 hover:border-brand-600 hover:text-brand-600 rounded-sm flex items-center justify-center gap-2 transition-all group disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Add Another Flight</span>
                </button>
              </div>
            )}

            <div className="pt-8 border-t border-surface-100 grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-ink-400 uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-3 h-3" />
                  Passengers
                </label>
                <input 
                  type="number"
                  min="1"
                  max="9"
                  className="w-full p-3 bg-surface-50 border border-surface-200 rounded-sm text-xs font-bold focus:outline-none focus:border-brand-600 transition-all"
                  value={searchParams.passengers}
                  onChange={(e) => setSearchParams({ ...searchParams, passengers: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Class</label>
                <select
                  className="w-full p-3 bg-surface-50 border border-surface-200 rounded-sm text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-brand-600 transition-all appearance-none"
                  value={searchParams.flightClass}
                  onChange={(e) => setSearchParams({ ...searchParams, flightClass: e.target.value })}
                >
                  {FLIGHT_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <motion.button
              type="submit"
              whileHover={{ 
                scale: 1.02,
                translateY: -2,
                boxShadow: "0 20px 40px rgba(37, 99, 235, 0.2)"
              }}
              whileTap={{ 
                scale: 0.98,
                translateY: 1,
                boxShadow: "0 5px 10px rgba(0, 0, 0, 0.1)"
              }}
              className="w-full bg-ink-900 text-white font-bold py-5 rounded-sm hover:bg-brand-600 transition-all uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3 active:scale-95"
            >
              Search Available Routes
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </form>

          <datalist id="origins">
            {AIRPORTS.map(a => <option key={a.code} value={`${a.city} (${a.code})`}>{a.name}</option>)}
          </datalist>
          <datalist id="destinations">
            {AIRPORTS.map(a => <option key={a.code} value={`${a.city} (${a.code})`}>{a.name}</option>)}
          </datalist>
        </div>

        <div className="mt-auto hidden md:block">
          <div className="p-5 bg-brand-600/5 border border-brand-600/10 rounded-sm mb-4">
            <p className="text-[10px] text-brand-600 font-bold uppercase tracking-widest mb-2">Data Security</p>
            <p className="text-xs text-ink-900 leading-relaxed font-medium">
              Your bookings are stored securely in your private cloud profile. Access all your data anytime in the <strong>Itinerary</strong> section.
            </p>
          </div>
          <div className="p-5 bg-surface-50 border border-surface-200 rounded-sm">
            <p className="text-[10px] text-brand-600 font-bold uppercase tracking-widest mb-2">Pro Tip</p>
            <p className="text-xs text-ink-900 leading-relaxed font-medium">
              Booking 21 days in advance can save you up to 15% on transatlantic routes.
            </p>
          </div>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 md:p-12 overflow-y-auto bg-surface-50" style={{ perspective: "2500px", transformStyle: "preserve-3d" }}>
        <div className="max-w-6xl mx-auto" style={{ transformStyle: "preserve-3d" }}>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            style={{ 
              y: heroY, 
              rotateX: heroRotate,
              scale: heroScale,
              opacity: contentOpacity,
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
              willChange: "transform"
            }}
            className="mb-16"
          >
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight italic mb-6">
              Glide through <br />the <span className="text-brand-600">skies.</span>
            </h1>
            <p className="text-ink-400 text-lg md:text-xl max-w-xl font-medium leading-relaxed">
              Luxury travel redefined. Experience seamless booking and 
              geometric precision in every itinerary.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="mb-8"
          >
             <div className="flex items-center gap-4 mb-8">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-ink-400">Featured Destinations</h2>
                <div className="flex-1 h-[1px] bg-surface-200" />
             </div>
             
              <motion.div 
                layout
                className="grid grid-cols-1 md:grid-cols-3 gap-8 min-h-[400px] relative" 
                style={{ perspective: "2500px", transformStyle: "preserve-3d" }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                 {visibleDestinations.map((dest, i) => (
                   <FeatureCard 
                     key={dest.city}
                     dest={dest}
                     i={i}
                     onClick={() => setSearchParams(prev => ({ ...prev, destination: `${dest.city} (${dest.code})` }))}
                   />
                 ))}
                </AnimatePresence>
              </motion.div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Home;
