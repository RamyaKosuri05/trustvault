import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import ThemeToggle from '../components/common/ThemeToggle';

const NotFound = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#08090C] text-slate-900 dark:text-slate-100 p-6 relative overflow-hidden font-sans transition-colors duration-200">
      {/* Ambient Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.12),rgba(0,0,0,0))] pointer-events-none dark:opacity-100 opacity-40" />

      {/* Theme Toggle in top-right */}
      <div className="absolute top-5 right-5 z-30">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md text-center bg-white/90 dark:bg-white/[0.02] backdrop-blur-2xl border border-slate-200 dark:border-white/[0.06] rounded-2xl p-8 shadow-xl dark:shadow-2xl relative z-10 space-y-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-indigo-500 dark:text-indigo-400 font-semibold mb-1">
            404 · Resource Not Found
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Unreachable Secure Route
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            The destination you requested does not exist or has been isolated under zero-trust authorization policies.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-200"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
          <Link
            to="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 transition-all duration-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Link>
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-white/[0.04]">
          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
            TrustVault Security Invariant #5: Anti-Enumeration & Uniform Error Handling
          </span>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
