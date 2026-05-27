/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Plane, Calendar, User, LayoutDashboard, Search, Menu, X, LogIn, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { auth, signInWithGoogle, logout } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

// Pages
import Home from './pages/Home';
import SearchResults from './pages/SearchResults';
import Booking from './pages/Booking';
import Itinerary from './pages/Itinerary';

// Auth Context
interface AuthContextType {
  user: { uid: string; displayName: string; photoURL: string; email: string } | null;
  loading: boolean;
  login: () => Promise<void>;
  signout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: { 
    uid: 'guest_user', 
    displayName: 'Guest Traveller', 
    photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest',
    email: 'guest@airgo.com'
  },
  loading: false,
  login: async () => {},
  signout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user, login, signout } = useAuth();

  const navItems = [
    { name: 'Search', path: '/', icon: Search },
    { name: 'My Itinerary', path: '/itinerary', icon: Calendar },
  ];

  return (
    <nav className="fixed top-2 left-2 right-2 z-50 bg-white/70 backdrop-blur-xl border border-white/20 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] overflow-hidden" style={{ transformStyle: 'preserve-3d' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-12">
            <Link to="/" className="flex items-center gap-2 group" style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}>
              <motion.div 
                whileHover={{ rotateY: 180, scale: 1.1 }}
                transition={{ duration: 0.6, type: 'spring' }}
                className="w-8 h-8 bg-brand-600 rounded-sm flex items-center justify-center transition-all group-hover:shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
              >
                <div className="w-4 h-4 border-2 border-white rotate-45" />
              </motion.div>
              <span className="text-ink-900 font-bold text-xl tracking-tight uppercase group-hover:tracking-widest transition-all duration-300">Airgo</span>
            </Link>
            
            <div className="hidden md:flex items-center gap-8">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={cn(
                    "text-sm font-semibold transition-all py-5 border-b-2",
                    location.pathname === item.path
                      ? "text-brand-600 border-brand-600"
                      : "text-ink-400 border-transparent hover:text-ink-900"
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-2">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=guest" alt="" className="w-8 h-8 rounded-full bg-surface-200" />
                <span className="text-sm font-medium text-ink-900">Guest</span>
              </div>
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-ink-900 p-2"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-surface-200 overflow-hidden"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-3 rounded-md text-base font-medium transition-colors",
                    location.pathname === item.path
                      ? "text-brand-600 bg-brand-600/5"
                      : "text-ink-900 hover:bg-surface-100"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              ))}
              <div className="flex items-center gap-2 px-3 py-3 text-ink-900">
                <User className="w-5 h-5" />
                <span>Guest Traveller</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default function App() {
  const [user] = useState({ 
    uid: 'guest_user', 
    displayName: 'Guest Traveller', 
    photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest',
    email: 'guest@airgo.com'
  });
  const [loading] = useState(false);

  const login = async () => {};
  const signout = async () => {};

  return (
    <AuthContext.Provider value={{ user, loading, login, signout }}>
      <Router>
        <div className="min-h-screen bg-surface-50 text-ink-900 font-sans selection:bg-brand-600/10 selection:text-brand-600">
          <Navbar />
          <main className="pt-16">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/search" element={<SearchResults />} />
                <Route path="/booking/:flightId" element={<Booking />} />
                <Route path="/itinerary" element={<Itinerary />} />
              </Routes>
            </AnimatePresence>
          </main>
          
          <footer className="h-10 bg-white border-t border-surface-200 px-8 flex items-center justify-between shrink-0 fixed bottom-0 left-0 right-0 z-50">
            <div className="flex items-center gap-6">
              <span className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">System Status: Optimal</span>
              <span className="text-[10px] font-bold text-ink-400 uppercase tracking-widest hidden md:inline">Global Flights Live: 14,209</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Currency: INR (₹)</span>
              <span className="text-[10px] font-bold text-ink-400 uppercase tracking-widest hidden md:inline">Support: 24/7 Active</span>
            </div>
          </footer>
        </div>
      </Router>
    </AuthContext.Provider>
  );
}
