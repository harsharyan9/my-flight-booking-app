/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Plane, Calendar, MapPin, Clock, Download, Trash2, ChevronRight, AlertCircle, Plus, Info, Loader2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../App';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: 'guest_user',
      email: 'guest@airgo.com',
      emailVerified: true,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface SavedBooking {
  id: string;
  flightDetails: any;
  passengerName: string;
  seatNumber: string;
  status: string;
  bookedAt: any;
  userId: string;
}

const Itinerary = () => {
  const { user, loading: authLoading, login } = useAuth();
  const [bookings, setBookings] = useState<SavedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const handleDownloadPDF = async (bookingId: string) => {
    const element = document.getElementById(`ticket-${bookingId}`);
    if (!element) return;
    
    setIsDownloading(bookingId);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            :root {
              --color-brand-600: #2563eb !important;
              --color-surface-50: #f8fafc !important;
              --color-surface-100: #f1f5f9 !important;
              --color-surface-200: #e2e8f0 !important;
              --color-ink-900: #0f172a !important;
              --color-ink-400: #94a3b8 !important;
            }
            body {
              background: white !important;
              color: #0f172a !important;
            }
            * {
              color-scheme: light !important;
            }
          `;
          clonedDoc.head.appendChild(style);
          
          // Recursively replace modern colors with RGB if they use oklch/oklab
          const elements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            const style = window.getComputedStyle(el);
            ['color', 'backgroundColor', 'borderColor'].forEach(prop => {
              const val = style[prop as any];
              if (val.includes('oklch') || val.includes('oklab')) {
                // If we hit an unsupported color, fallback to a safe default based on class
                if (el.classList.contains('text-brand-600')) el.style[prop as any] = '#2563eb';
                else if (el.classList.contains('bg-brand-600')) el.style[prop as any] = '#2563eb';
                else if (el.classList.contains('text-ink-400')) el.style[prop as any] = '#94a3b8';
                else el.style[prop as any] = prop === 'backgroundColor' ? '#ffffff' : '#0f172a';
              }
            });
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`AirGO_Booking_${bookingId}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsDownloading(null);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking and remove it from your itinerary?')) return;
    
    setCancellingId(bookingId);
    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
    } catch (err) {
      console.error('Cancellation failed:', err);
      try {
        handleFirestoreError(err, OperationType.DELETE, `bookings/${bookingId}`);
      } catch (e) {
        alert('Failed to remove the booking. Please try again.');
      }
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    
    setLoading(true);
    
    // 1. Load from LocalStorage (fastest)
    const localBookingsList = JSON.parse(localStorage.getItem('airgo_bookings') || '[]');
    
    // 2. Setup Firestore listener
    let unsubscribe = () => {};
    if (user) {
      const path = 'bookings';
      const q = query(collection(db, path), where('userId', '==', user.uid));
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        const firestoreResults: SavedBooking[] = [];
        snapshot.forEach((doc) => {
          firestoreResults.push({ ...doc.data() } as SavedBooking);
        });
        
        // Merge and remove duplicates by ID
        setBookings(prev => {
          const combined = [...firestoreResults, ...prev];
          const uniqueMap = new Map();
          combined.forEach(b => uniqueMap.set(b.id, b));
          const sorted = Array.from(uniqueMap.values()).sort((a, b) => 
            new Date(a.flightDetails.departureTime).getTime() - new Date(b.flightDetails.departureTime).getTime()
          );
          return sorted;
        });
        setLoading(false);
      }, (err) => {
        console.warn("Firestore sync failed:", err);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    // Set initial local bookings
    setBookings(localBookingsList.sort((a: any, b: any) => 
      new Date(a.flightDetails.departureTime).getTime() - new Date(b.flightDetails.departureTime).getTime()
    ));

    return () => unsubscribe();
  }, [user, authLoading]);



  if (loading || authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
        <p className="text-neutral-500 font-light tracking-widest uppercase text-xs">Retreiving your journeys...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-64px)] overflow-hidden">
      {/* Sidebar - Trip Categories */}
      <aside className="w-full md:w-80 bg-white border-r border-surface-200 p-8 flex flex-col gap-8 z-10 shrink-0">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink-400 mb-6">Trip Log</h2>
          <div className="space-y-2">
            {[
              { label: 'Upcoming journeys', count: bookings.filter(b => b.status !== 'cancelled' && new Date(b.flightDetails.arrivalTime) > new Date()).length, active: true },
              { label: 'Past travels', count: bookings.filter(b => b.status !== 'cancelled' && new Date(b.flightDetails.arrivalTime) < new Date()).length, active: false },
              { label: 'Revoked plans', count: bookings.filter(b => b.status === 'cancelled').length, active: false }
            ].map(cat => (
              <button 
                key={cat.label} 
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-sm transition-all text-left",
                  cat.active ? "bg-brand-600 text-white shadow-[0_10px_20px_rgba(37,99,235,0.15)]" : "hover:bg-surface-50 text-ink-900 font-medium"
                )}
              >
                <span className="text-[10px] uppercase tracking-widest font-bold">{cat.label}</span>
                <span className={cn("text-[10px] font-mono", cat.active ? "text-white/60" : "text-ink-400")}>{cat.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto hidden md:block">
           <Link 
             to="/" 
             className="w-full bg-ink-900 text-white font-bold py-4 rounded-sm hover:bg-brand-600 transition-colors uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
           >
             <Plus className="w-4 h-4" />
             Plan New Trip
           </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 md:p-12 overflow-y-auto bg-surface-50" style={{ perspective: "2500px", transformStyle: "preserve-3d" }}>
        <div className="max-w-4xl mx-auto" style={{ transformStyle: "preserve-3d" }}>
          <div className="flex items-center justify-between mb-12">
            <h1 className="text-3xl font-bold tracking-tight italic">My Itinerary</h1>
            <div className="flex items-center gap-3">
               <div className="w-10 h-[1px] bg-surface-200" />
               <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Digital Boarding Archive</p>
            </div>
          </div>

          {error && (
             <div className="mb-8 p-4 bg-red-500/5 border border-red-500/10 text-red-600 rounded-sm flex items-center gap-3">
               <Info className="w-5 h-5 font-bold" />
               <p className="text-xs font-bold uppercase tracking-wider">{error}</p>
             </div>
          )}

          <div className="space-y-6">
            {bookings.length === 0 ? (
              <div className="text-center py-24 bg-white border border-surface-200 rounded-sm">
                <Plane className="w-12 h-12 text-surface-200 mx-auto mb-4" />
                <h3 className="text-xl font-bold italic mb-2">No expeditions found</h3>
                <p className="text-ink-400 text-sm">Your digital archive is currently empty. Start booking to fill it!</p>
              </div>
            ) : (
              bookings.map((booking, idx) => {
                const f = booking.flightDetails;
                const isFinished = new Date(f.arrivalTime).getTime() < new Date().getTime();
                const isCancelled = booking.status === 'cancelled';

                return (
                  <motion.div
                    key={booking.id}
                    id={`ticket-${booking.id}`}
                    initial={{ opacity: 0, y: 30, rotateX: 10, scale: 0.95 }}
                    whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ 
                      duration: 0.8, 
                      delay: idx * 0.1,
                      ease: [0.16, 1, 0.3, 1]
                    }}
                    whileHover={{ 
                      scale: 1.01, 
                      translateZ: 10,
                      rotateX: 1,
                      rotateY: -1,
                      boxShadow: "0 20px 40px -10px rgba(0,0,0,0.1)",
                      transition: { duration: 0.3 }
                    }}
                    style={{ transformStyle: 'preserve-3d' }}
                    className={cn(
                      "bg-white border border-surface-200 transition-all group overflow-hidden",
                      (isFinished || isCancelled) && "opacity-60 grayscale bg-surface-50"
                    )}
                  >
                    <div className="p-8" style={{ transform: 'translateZ(20px)' }}>
                       <div className="flex flex-col md:flex-row md:items-start justify-between gap-10">
                          {/* Route Graphic */}
                          <div className="flex-1 flex items-center gap-8">
                             <div className="w-12 h-12 bg-white border border-surface-200 flex items-center justify-center font-bold text-[10px] uppercase tracking-tighter text-brand-600">
                                {f.airline.split(' ').map((n: string) => n[0]).join('')}
                             </div>
                             
                             <div className="flex items-center gap-6">
                                <div className="text-left leading-tight">
                                   <p className="text-2xl font-bold italic tracking-tighter">{f.origin.code}</p>
                                   <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">{format(new Date(f.departureTime), 'HH:mm')}</p>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                   <Plane className="w-3 h-3 text-brand-600 rotate-90 opacity-40 shrink-0" />
                                   <div className="w-12 h-[1px] bg-surface-200" />
                                </div>
                                <div className="text-left leading-tight">
                                   <p className="text-2xl font-bold italic tracking-tighter">{f.destination.code}</p>
                                   <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">{format(new Date(f.arrivalTime), 'HH:mm')}</p>
                                </div>
                             </div>
                          </div>

                          {/* Flight Details Details */}
                          <div className="grid grid-cols-2 md:flex items-start gap-8 md:gap-12 text-left">
                             <div>
                                <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-1">Date</p>
                                <p className="text-xs font-bold text-ink-900">{format(new Date(f.departureTime), 'MMM d, yyyy')}</p>
                             </div>
                             <div>
                                <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-1">Passenger / Seat</p>
                                <p className="text-xs font-bold text-ink-900">{booking.passengerName.split(' ')[0]} / {booking.seatNumber}</p>
                             </div>
                             <div>
                                <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-1">Reference</p>
                                <p className="text-xs font-bold text-brand-600 font-mono tracking-tighter">#{booking.id}</p>
                             </div>
                          </div>

                          {/* Status and Action */}
                          <div className="flex items-center md:flex-col justify-between md:items-end gap-6">
                             <div className={cn(
                               "px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded-sm",
                               isCancelled ? "bg-red-500 text-white" : (isFinished ? "bg-surface-200 text-ink-400" : "bg-brand-600 text-white")
                             )}>
                                {isCancelled ? 'Cancelled' : (isFinished ? 'Completed' : 'Confirmed')}
                             </div>
                             {!isFinished && !isCancelled && (
                               <button 
                                 onClick={() => handleCancelBooking(booking.id)}
                                 disabled={cancellingId === booking.id}
                                 className="text-[10px] font-bold text-red-600 uppercase tracking-widest border-b border-red-600 hover:text-red-900 hover:border-red-900 transition-colors disabled:opacity-50"
                               >
                                 {cancellingId === booking.id ? 'Cancelling...' : 'Cancel Seat'}
                               </button>
                             )}
                             {!isCancelled && (
                                <button 
                                  onClick={() => handleDownloadPDF(booking.id)}
                                  disabled={isDownloading === booking.id}
                                  className="ml-auto text-[10px] font-bold text-brand-600 uppercase tracking-widest border-b border-brand-600 disabled:opacity-50"
                                >
                                   {isDownloading === booking.id ? 'Starting...' : 'Download Ticket'}
                                </button>
                             )}
                          </div>
                       </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Assistant Promo */}
          <div className="mt-20 border border-surface-200 bg-white p-10 flex flex-col md:flex-row items-center justify-between gap-10">
             <div className="flex-1 space-y-4">
                <div className="w-10 h-10 border-2 border-brand-600 rotate-45 mb-4" />
                <h3 className="text-3xl font-bold tracking-tight italic">Travel with Precision.</h3>
                <p className="text-ink-400 font-medium leading-relaxed max-w-lg">
                  Enable Air GO Real-Time notifications to track gate changes, baggage claim carousel info, and geometric delay alerts directly on your device.
                </p>
             </div>
             <button className="px-10 py-5 bg-ink-900 text-white font-bold uppercase tracking-widest text-[10px] rounded-sm hover:bg-brand-600 transition-colors shrink-0">
               Enable Digital Assistant
             </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Itinerary;
