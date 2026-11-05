import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/common/ThemeToggle';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, AlertCircle, Zap, Shield, FileCheck } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(
        err.response?.data?.detail || 
        err.response?.data?.message || 
        'Invalid email or password.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  const features = [
    { icon: Shield, title: 'Zero-Trust Authorization', desc: 'Every request server-verified on each call' },
    { icon: FileCheck, title: 'Tamper-Evident Audit Trail', desc: 'SHA-256 hash chain on every access event' },
    { icon: Zap, title: 'Instant Revocation', desc: 'Permissions enforced in real-time, no caching' },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#070d1f] text-slate-900 dark:text-slate-100 transition-colors duration-200 relative">
      {/* Theme Toggle in top-right */}
      <div className="absolute top-5 right-5 z-30">
        <ThemeToggle />
      </div>

      {/* Left Panel — Hero */}
      <div className="hidden lg:flex lg:w-3/5 relative overflow-hidden flex-col justify-center">
        {/* Background gradient orbs */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 dark:from-[#070d1f] dark:via-[#0d1a35] dark:to-[#070d1f]" />
        <div className="absolute top-20 left-16 w-80 h-80 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-20 right-16 w-96 h-96 bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 px-16 py-12">
          {/* Logo */}
          <div className="flex items-center space-x-3 mb-16">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/40 text-white">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">TrustVault</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-extrabold text-white leading-tight mb-4 tracking-tight">
            Share securely.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              Trust every access.
            </span>
          </h1>
          <p className="text-slate-300 dark:text-slate-400 text-lg mb-12 leading-relaxed max-w-md">
            Production-grade zero-trust document platform with server-enforced per-document authorization and cryptographic audit trails.
          </p>

          {/* Feature List */}
          <div className="space-y-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start space-x-4">
                <div className="p-2 bg-blue-500/15 rounded-lg border border-blue-500/20 text-blue-400 flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Chain indicator */}
          <div className="mt-14 inline-flex items-center space-x-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            <span>RISE Security Challenge Edition — Active</span>
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-8 relative bg-slate-50 dark:bg-[#0a1020] transition-colors duration-200">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/8 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center space-x-3 mb-8">
            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/40 text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">TrustVault</span>
          </div>

          <div className="bg-white dark:bg-white/[0.04] backdrop-blur-2xl border border-slate-200 dark:border-white/[0.08] rounded-2xl p-8 shadow-xl dark:shadow-2xl dark:shadow-black/40 transition-colors duration-200">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Sign in</h2>
            <p className="text-xs text-slate-500 mb-6">Secure session · HttpOnly cookie · Server-enforced</p>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-3 text-rose-600 dark:text-rose-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-sm transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="block w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-sm transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 disabled:opacity-50 shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30"
              >
                {loading ? 'Authenticating...' : 'Sign In Securely'}
              </button>
            </form>

            {/* Demo Credentials */}
            {isDemo && (
              <div className="mt-6 pt-5 border-t border-slate-200 dark:border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400/80 text-center mb-3">
                  RISE Judge Credentials
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickFill('admin@trustvault.demo', 'TrustVault#Admin2026!')}
                    className="px-2 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-lg border border-purple-500/20 transition-all duration-200"
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill('owner@trustvault.demo', 'TrustVault#Owner2026!')}
                    className="px-2 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-lg border border-blue-500/20 transition-all duration-200"
                  >
                    Owner
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill('viewer@trustvault.demo', 'TrustVault#Viewer2026!')}
                    className="px-2 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-500/20 transition-all duration-200"
                  >
                    Viewer
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5 text-center">
              <span className="text-xs text-slate-500 dark:text-slate-600">
                Need an account?{' '}
                <Link to="/register" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors">
                  Self-register here
                </Link>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

