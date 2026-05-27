/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Info, CheckCircle, CreditCard, Shield, User, Loader2, Plane, Armchair, Download, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Flight } from '../types';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { db, auth } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../App';
import { QRCodeCanvas } from 'qrcode.react';
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
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: 'guest_user',
      email: 'guest@airgo.com',
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const Booking = () => {
  const { flightId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);
  const [showUPIQR, setShowUPIQR] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  // Fallback if accessed without state
  const flight: Flight | undefined = location.state?.flight;
  const allFlights: Flight[] = location.state?.allFlights || (flight ? [flight] : []);
  const isMultiCity = location.state?.isMultiCity || false;

  const totalPrice = allFlights.reduce((sum, f) => sum + f.price, 0);

  const [formData, setFormData] = useState({
    firstName: user?.displayName?.split(' ')[0] || '',
    lastName: user?.displayName?.split(' ')[1] || '',
    email: user?.email || '',
    phone: '',
    identityType: 'Passport' as 'Passport' | 'Aadhaar',
    identityNumber: '',
    seat: '',
    paymentMethod: 'Card' as 'Card' | 'UPI',
    upiId: ''
  });

  // Mock taken seats
  const [takenSeats] = useState(() => {
    const seats = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const row = Math.floor(Math.random() * 20) + 1;
      const col = ['A', 'B', 'C', 'D', 'E', 'F'][Math.floor(Math.random() * 6)];
      seats.add(`${row}${col}`);
    }
    return seats;
  });

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (step === 1) {
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!formData.seat) {
        setError("Please select a seat to continue.");
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      if (formData.paymentMethod === 'UPI' && !formData.upiId) {
        setError("Please enter a valid UPI ID.");
        return;
      }
    }

    setIsProcessing(true);
    const bookingPath = 'bookings';
    const bookingId = `BK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Simulate UPI Intent/QR flow if UPI is selected
    if (formData.paymentMethod === 'UPI' && !showUPIQR) {
      setTimeout(() => {
        setShowUPIQR(true);
        setIsProcessing(false);
        
        // Auto-complete after simulation
        setTimeout(() => {
          const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
          handleBooking(fakeEvent);
        }, 3000);
      }, 1000); // Faster simulation
      return;
    }

    const bookingData = {
      id: bookingId,
      userId: user.uid,
      flightDetails: flight, // Main leg or first leg
      allFlights: isMultiCity ? allFlights : null,
      passengerName: `${formData.firstName} ${formData.lastName}`,
      seatNumber: formData.seat,
      identityType: formData.identityType,
      identityNumber: formData.identityNumber,
      status: 'confirmed',
      bookedAt: new Date().toISOString(),
      isMultiCity,
      totalPrice,
      paymentMethod: formData.paymentMethod
    };

    try {
      // Try Firestore
      await setDoc(doc(db, bookingPath, bookingId), {
        ...bookingData,
        bookedAt: serverTimestamp()
      });
    } catch (err: any) {
      console.warn("Firestore sync failed, saving locally only:", err);
    } finally {
      // ALWAYS save locally as backup/offline support
      const localBookings = JSON.parse(localStorage.getItem('airgo_bookings') || '[]');
      localStorage.setItem('airgo_bookings', JSON.stringify([bookingData, ...localBookings]));
      
      setConfirmedBookingId(bookingId);
      setIsProcessing(false);
      setStep(4); // Confirmation
      setShowUPIQR(false);
    }
  };

  if (!flight) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-2xl font-light mb-4 text-orange-500">Flight information missing</h2>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-white/10 rounded-full">Back to Search</button>
      </div>
    );
  }

  const handleDownloadPDF = async () => {
    if (!ticketRef.current) return;
    
    setIsProcessing(true);
    // Small delay to ensure any dynamic content or fonts are ready
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const canvas = await html2canvas(ticketRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: ticketRef.current.scrollWidth,
        windowHeight: ticketRef.current.scrollHeight,
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
      pdf.save(`AirGO_Booking_${confirmedBookingId}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const SeatMap = () => {
    const rows = Array.from({ length: 20 }, (_, i) => i + 1);
    const cols = ['A', 'B', 'C', 'D', 'E', 'F'];

    return (
      <div className="flex flex-col items-center py-8">
        <div className="mb-8 flex flex-wrap justify-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-surface-200 rounded-sm border border-surface-300"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-ink-900 rounded-sm border border-ink-900"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Taken</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-brand-600 rounded-sm border border-brand-600"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Selected</span>
          </div>
        </div>

        <div className="relative bg-white border border-surface-200 rounded-[4rem] p-12 shadow-sm max-w-full overflow-x-auto">
          {/* Plane Nose Indicator */}
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-white border-t border-x border-surface-200 rounded-full"></div>
          
          <div className="space-y-4 min-w-max">
            <div className="flex justify-center gap-4 mb-2">
              <div className="w-6" /> {/* Row label spacer */}
              {cols.map((col, i) => (
                <React.Fragment key={col}>
                  <div className="w-10 text-center text-[10px] font-bold text-ink-400">{col}</div>
                  {i === 2 && <div className="w-12" />}
                </React.Fragment>
              ))}
            </div>

            {rows.map(row => (
              <div key={row} className="flex items-center gap-4">
                <div className="w-6 text-[10px] font-bold text-ink-400 text-center">{row}</div>
                {cols.map((col, i) => {
                  const seatId = `${row}${col}`;
                  const isTaken = takenSeats.has(seatId);
                  const isSelected = formData.seat === seatId;
                  
                  return (
                    <React.Fragment key={col}>
                      <button
                        type="button"
                        disabled={isTaken}
                        onClick={() => setFormData({ ...formData, seat: seatId })}
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center transition-all border",
                          isTaken ? "bg-ink-900 text-white/20 border-ink-900 cursor-not-allowed" : 
                          isSelected ? "bg-brand-600 text-white border-brand-600 shadow-[0_10px_25px_-5px_rgba(37,99,235,0.4),0_8px_10px_-6px_rgba(37,99,235,0.3)] scale-125 z-20" : 
                          "bg-surface-50 text-ink-400 border-surface-200 hover:border-brand-600 hover:text-brand-600"
                        )}
                      >
                        <Armchair className="w-4 h-4" />
                      </button>
                      {i === 2 && (
                        <div className="w-12 flex items-center justify-center">
                          <div className="h-10 w-[1px] bg-surface-100" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 pb-24">
      {/* Workflow Stepper */}
      <div className="flex items-center gap-4 mb-16 overflow-x-auto whitespace-nowrap pb-4 scrollbar-hide border-b border-surface-200">
        {[
          { icon: User, label: 'Passenger Info' },
          { icon: Armchair, label: 'Seat' },
          { icon: CreditCard, label: 'Payment' },
          { icon: CheckCircle, label: 'Confirmation' }
        ].map((s, idx) => (
          <div key={s.label} className="flex items-center gap-3 py-5">
            <div className={cn(
              "w-7 h-7 rounded-sm flex items-center justify-center text-[10px] font-bold transition-all",
              step === idx + 1 ? "bg-brand-600 text-white shadow-[0_5px_15px_rgba(37,99,235,0.3)]" : "bg-surface-200 text-ink-400",
              step > idx + 1 ? "bg-green-600 text-white" : ""
            )}>
              {step > idx + 1 ? <CheckCircle className="w-4 h-4" /> : idx + 1}
            </div>
            <span className={cn(
              "text-[10px] uppercase tracking-[0.2em] font-bold",
              step >= idx + 1 ? "text-ink-900" : "text-ink-400"
            )}>
              {s.label}
            </span>
            {idx < 3 && <div className="w-8 h-[1px] bg-surface-200 mx-2" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12" style={{ perspective: "2500px", transformStyle: "preserve-3d" }}>
        <div className="lg:col-span-8" style={{ transformStyle: "preserve-3d" }}>
          {error && (
             <motion.div 
               initial={{ opacity: 0, y: -20, rotateX: -10 }}
               animate={{ opacity: 1, y: 0, rotateX: 0 }}
               className="mb-8 p-4 bg-red-500/5 border border-red-500/10 text-red-600 rounded-sm flex items-center gap-3"
             >
               <Info className="w-5 h-5 font-bold" />
               <p className="text-xs font-bold uppercase tracking-wider">{error}</p>
             </motion.div>
          )}
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -50, rotateY: 10 }}
                animate={{ opacity: 1, x: 0, rotateY: 0 }}
                exit={{ opacity: 0, x: 50, rotateY: -10 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <div style={{ transform: "translateZ(20px)" }}>
                  <h2 className="text-2xl font-bold tracking-tight italic mb-8">Passenger Details</h2>
                  <form onSubmit={handleBooking} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">First Name</label>
                      <input 
                        required
                        className="w-full bg-white border border-surface-200 rounded-sm px-4 py-3 text-sm font-medium focus:outline-none focus:border-brand-600"
                        value={formData.firstName}
                        onChange={e => setFormData({...formData, firstName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Last Name</label>
                      <input 
                        required
                        className="w-full bg-white border border-surface-200 rounded-sm px-4 py-3 text-sm font-medium focus:outline-none focus:border-brand-600"
                        value={formData.lastName}
                        onChange={e => setFormData({...formData, lastName: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Email Address</label>
                    <input 
                      type="email"
                      required
                      className="w-full bg-white border border-surface-200 rounded-sm px-4 py-3 text-sm font-medium focus:outline-none focus:border-brand-600"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5 outline-none">
                      <label className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Identity Type</label>
                      <select 
                        className="w-full bg-white border border-surface-200 rounded-sm px-4 py-3 text-sm font-medium focus:outline-none focus:border-brand-600 appearance-none"
                        value={formData.identityType}
                        onChange={e => setFormData({...formData, identityType: e.target.value as any})}
                      >
                        <option value="Passport">Passport</option>
                        <option value="Aadhaar">Aadhaar Card</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">
                        {formData.identityType === 'Passport' ? 'Passport Number' : 'Aadhaar Number'}
                      </label>
                      <input 
                        required
                        placeholder={formData.identityType === 'Passport' ? 'L1234567' : '1234 5678 9012'}
                        className="w-full bg-white border border-surface-200 rounded-sm px-4 py-3 text-sm font-medium focus:outline-none focus:border-brand-600"
                        value={formData.identityNumber}
                        onChange={e => setFormData({...formData, identityNumber: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="pt-6">
                    <button 
                      type="submit" 
                      className="w-full py-4 bg-ink-900 border border-ink-900 text-white rounded-sm font-bold uppercase tracking-widest text-[10px] hover:bg-brand-600 hover:border-brand-600 transition-all"
                    >
                      Continue to Payment
                    </button>
                  </div>
                </form>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -50, rotateY: 10 }}
                animate={{ opacity: 1, x: 0, rotateY: 0 }}
                exit={{ opacity: 0, x: 50, rotateY: -10 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <div style={{ transform: "translateZ(20px)" }}>
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold tracking-tight italic">Select Your Preferred Seat</h2>
                    <div className="px-3 py-1 bg-brand-600/10 text-brand-600 text-[10px] font-bold uppercase tracking-widest rounded-full">
                      {formData.seat ? `Selected: ${formData.seat}` : 'None Selected'}
                    </div>
                  </div>
                  
                  <SeatMap />

                  <div className="pt-8 border-t border-surface-100 flex gap-4">
                    <button 
                      type="button" 
                      onClick={() => setStep(1)}
                      className="flex-1 py-4 border border-surface-200 text-ink-400 rounded-sm font-bold uppercase tracking-widest text-[10px] hover:text-ink-900 transition-all"
                    >
                      Back
                    </button>
                    <button 
                      type="button" 
                      disabled={!formData.seat}
                      onClick={() => setStep(3)}
                      className="flex-[2] py-4 bg-ink-900 border border-ink-900 text-white rounded-sm font-bold uppercase tracking-widest text-[10px] hover:bg-brand-600 hover:border-brand-600 disabled:opacity-50 transition-all"
                    >
                      Confirm Seat & Continue
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: -50, rotateY: 10 }}
                animate={{ opacity: 1, x: 0, rotateY: 0 }}
                exit={{ opacity: 0, x: 50, rotateY: -10 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <div style={{ transform: "translateZ(20px)" }}>
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold tracking-tight italic">Secure Payment</h2>
                    <div className="flex bg-surface-100 border border-surface-200 rounded-sm p-1">
                      {[
                        { id: 'Card', label: 'Card' },
                        { id: 'UPI', label: 'UPI' }
                      ].map(method => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, paymentMethod: method.id as any })}
                          className={cn(
                            "px-6 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-sm transition-all",
                            formData.paymentMethod === method.id ? "bg-ink-900 text-white shadow-sm" : "text-ink-400 hover:text-ink-900"
                          )}
                        >
                          {method.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <form onSubmit={handleBooking} className="space-y-6">
                  <AnimatePresence mode="wait">
                    {formData.paymentMethod === 'Card' ? (
                      <motion.div 
                        key="card"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-white border border-surface-200 rounded-sm p-8 space-y-6"
                      >
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Card Number</label>
                            <input 
                              disabled={isProcessing}
                              placeholder="•••• •••• •••• ••••"
                              className="w-full bg-surface-50 border border-surface-200 rounded-sm px-4 py-3 text-sm font-medium focus:outline-none focus:border-brand-600"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Expiry</label>
                              <input 
                                disabled={isProcessing}
                                placeholder="MM / YY"
                                className="w-full bg-surface-50 border border-surface-200 rounded-sm px-4 py-3 text-sm font-medium focus:outline-none focus:border-brand-600"
                              />
                          </div>
                          <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">CVC</label>
                              <input 
                                disabled={isProcessing}
                                placeholder="•••"
                                className="w-full bg-surface-50 border border-surface-200 rounded-sm px-4 py-3 text-sm font-medium focus:outline-none focus:border-brand-600"
                              />
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="upi"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-white border border-surface-200 rounded-sm p-8 space-y-6"
                      >
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">UPI ID</label>
                          <input 
                            required
                            disabled={isProcessing}
                            placeholder="username@bank"
                            className="w-full bg-surface-50 border border-surface-200 rounded-sm px-4 py-3 text-sm font-medium focus:outline-none focus:border-brand-600"
                            value={formData.upiId}
                            onChange={e => setFormData({ ...formData, upiId: e.target.value })}
                          />
                        </div>
                        <div className="flex items-center gap-4 p-4 bg-surface-50 rounded-sm">
                          <div className="w-12 h-12 bg-white border border-surface-200 rounded-sm flex items-center justify-center font-bold text-xs uppercase tracking-tighter">UPI</div>
                          <p className="text-[10px] text-ink-400 uppercase font-bold tracking-widest leading-relaxed">
                            Generate a secure QR code below to pay via any UPI app (GPay, PhonePe, Paytm).
                          </p>
                        </div>

                        {showUPIQR && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center gap-6 p-8 border border-dashed border-surface-200 rounded-sm"
                          >
                            <div className="p-4 bg-white border border-surface-200 rounded-lg shadow-inner">
                              <QRCodeCanvas 
                                value={`upi://pay?pa=merchant-demo@airgo&pn=AirGO_Travel&am=${totalPrice}&cu=INR`} 
                                size={180}
                                level="H"
                              />
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-bold uppercase tracking-widest mb-1">Scan to Pay</p>
                              <p className="text-[10px] text-ink-400 font-mono">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalPrice)}</p>
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-start gap-3 p-5 bg-brand-600/5 border border-brand-600/10 rounded-sm">
                    <Info className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-ink-900 leading-relaxed font-medium uppercase tracking-wide">
                      Your payment information is encrypted and processed via our secure banking gateway. 
                      Air GO does not store full credit card data.
                    </p>
                  </div>

                  <div className="pt-6">
                    <button 
                      type="submit" 
                      disabled={isProcessing}
                      className="w-full py-4 bg-ink-900 border border-ink-900 text-white rounded-sm font-bold uppercase tracking-widest text-[10px] hover:bg-brand-600 hover:border-brand-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <>
                          {formData.paymentMethod === 'UPI' && !showUPIQR ? (
                            <QrCode className="w-4 h-4" />
                          ) : (
                            <CreditCard className="w-4 h-4" />
                          )}
                          {formData.paymentMethod === 'UPI' && !showUPIQR 
                            ? 'Generate Payment QR' 
                            : `Complete Transaction — ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalPrice)}`
                          }
                        </>
                      )}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setStep(1)}
                      className="w-full mt-6 text-[10px] font-bold uppercase tracking-widest text-ink-400 hover:text-ink-900 transition-colors"
                    >
                      Back to Passenger Info
                    </button>
                  </div>
                </form>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
              >
                <div className="text-center mb-12">
                  <div className="w-20 h-20 bg-green-600/10 border border-green-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h2 className="text-4xl font-bold tracking-tight italic mb-3">Booking Confirmed</h2>
                  <p className="text-ink-400 font-medium uppercase tracking-[0.2em] text-[10px]">
                    Confirmation Number: <span className="text-brand-600 font-mono">{confirmedBookingId}</span>
                  </p>
                </div>

                <div ref={ticketRef} className="bg-white border border-surface-200 rounded-sm overflow-hidden shadow-xl shadow-ink-900/5 mb-8">
                  <div className="bg-surface-50 px-8 py-4 border-b border-surface-200 flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400">
                      {isMultiCity ? "Multi-City Electronic Itinerary" : "Electronic Ticket"}
                    </span>
                    <span className="text-[10px] font-mono text-brand-600 font-bold">{flight.flightNumber}</span>
                  </div>
                  
                  <div className="p-8">
                    <div className="grid grid-cols-2 gap-12 mb-10">
                      <div>
                        <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-1.5">Passenger</p>
                        <p className="text-lg font-bold italic tracking-tight">{formData.firstName} {formData.lastName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest mb-1.5">Seat Map Applied</p>
                        <p className="text-lg font-bold italic tracking-tight">{formData.seat}</p>
                      </div>
                    </div>

                    <div className="space-y-8">
                      {allFlights.map((f, i) => (
                        <div key={f.id} className={cn("flex items-center justify-between py-6", i !== 0 && "border-t border-dashed border-surface-200")}>
                          <div className="text-center w-24">
                            <p className="text-2xl font-bold italic tracking-tighter mb-1">{f.origin.code}</p>
                            <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">{f.origin.city}</p>
                          </div>
                          
                          <div className="flex flex-col items-center gap-2 grow px-8">
                            <div className="w-full flex items-center gap-2">
                              <div className="h-0.5 grow bg-surface-100 rounded-full" />
                              <div className="flex flex-col items-center">
                                <span className="text-[8px] font-bold text-brand-600 uppercase tracking-widest mb-1">Leg {i+1}</span>
                                <Plane className="w-4 h-4 text-brand-600 rotate-90" />
                              </div>
                              <div className="h-0.5 grow bg-surface-100 rounded-full" />
                            </div>
                            <p className="text-[9px] font-bold text-ink-400 uppercase tracking-widest">
                               {format(new Date(f.departureTime), 'dd MMM')} • {f.duration}
                            </p>
                          </div>

                          <div className="text-center w-24">
                            <p className="text-2xl font-bold italic tracking-tighter mb-1">{f.destination.code}</p>
                            <p className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">{f.destination.city}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-ink-900 text-white p-8">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Status</p>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <p className="text-xs font-bold uppercase tracking-widest">Confirmed & Synchronized</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Total Trip Value</p>
                        <p className="text-xl font-bold font-mono tracking-tighter">
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalPrice)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                    onClick={() => navigate('/itinerary')}
                    className="group bg-brand-600 hover:bg-brand-700 text-white py-5 rounded-sm font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-3 shadow-lg shadow-brand-600/20"
                  >
                    View Full Itinerary
                    <ChevronLeft className="w-4 h-4 rotate-180 transition-transform group-hover:translate-x-1" />
                  </button>
                  <button 
                    onClick={handleDownloadPDF}
                    disabled={isProcessing}
                    className="bg-white border border-surface-200 text-ink-900 hover:bg-surface-50 py-5 rounded-sm font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Download PDF Receipt
                  </button>
                </div>
                
                <button 
                  onClick={() => navigate('/')}
                  className="w-full mt-8 text-[10px] font-bold uppercase tracking-widest text-ink-400 hover:text-ink-900 transition-colors"
                >
                  Return to Home
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Geometric Balance Summary Sidebar */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 space-y-6">
             <div className="bg-white border border-surface-200 overflow-hidden">
               <div className="p-6 border-b border-surface-200 bg-surface-50 flex items-center justify-between">
                 <h3 className="text-[10px] uppercase tracking-widest font-bold text-ink-900">
                    {isMultiCity ? "Full Trip Summary" : "Flight Summary"}
                 </h3>
                 <span className="text-[10px] font-mono text-ink-400 uppercase">{allFlights.length} Leg{allFlights.length > 1 ? 's' : ''}</span>
               </div>
               <div className="p-8 space-y-8">
                 {allFlights.map((f, idx) => (
                   <div key={f.id} className={cn("space-y-6", idx !== 0 && "pt-8 border-t border-surface-100")}>
                     <div className="flex items-center gap-6">
                        <div className="w-10 h-10 bg-white border border-surface-200 flex items-center justify-center font-bold text-[10px] uppercase tracking-tighter text-brand-600">
                          {f.airline.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider">{f.airline}</p>
                          <p className="text-[8px] font-bold text-ink-400 uppercase tracking-widest">Leg {idx + 1} • {f.class}</p>
                        </div>
                     </div>

                     <div className="relative pl-6 space-y-8">
                        <div className="absolute left-[7px] top-1 bottom-1 w-[1px] bg-surface-100"></div>
                        <div className="relative">
                          <div className="absolute -left-[23px] top-1 w-2.5 h-2.5 bg-brand-600 rounded-full border-2 border-white"></div>
                          <p className="text-[9px] font-bold text-ink-400 uppercase tracking-wider mb-1">{format(new Date(f.departureTime), 'MMM d, HH:mm')}</p>
                          <p className="text-xs font-bold italic">{f.origin.city} ({f.origin.code})</p>
                        </div>
                        <div className="relative">
                          <div className="absolute -left-[23px] top-1 w-2.5 h-2.5 bg-surface-200 rounded-full border-2 border-white"></div>
                          <p className="text-[9px] font-bold text-ink-400 uppercase tracking-wider mb-1">{format(new Date(f.arrivalTime), 'MMM d, HH:mm')}</p>
                          <p className="text-xs font-bold italic">{f.destination.city} ({f.destination.code})</p>
                        </div>
                     </div>
                   </div>
                 ))}

                 <div className="pt-8 border-t border-surface-200 space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-ink-400">Total Base Fare</span>
                      <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalPrice - (800 * allFlights.length))}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-ink-400">Service Fees ({allFlights.length} legs)</span>
                      <span>₹{800 * allFlights.length}</span>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-surface-100">
                      <span className="text-xs font-bold uppercase tracking-[0.2em] text-ink-900">Grand Total</span>
                      <span className="text-2xl font-bold tracking-tighter text-brand-600">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalPrice)}</span>
                    </div>
                 </div>
               </div>
            </div>

            <div className="p-6 bg-ink-900 text-white rounded-sm">
                <p className="text-[10px] uppercase font-bold tracking-widest text-brand-600 mb-2">Air GO Assurance</p>
                <p className="text-xs italic leading-relaxed text-slate-300">
                  "Your travel is protected by our geometric precision guarantee. Flexible rebooking included."
                </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Booking;
