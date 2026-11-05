import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/common/ThemeToggle';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, AlertCircle, Zap, Shield, FileCheck, RefreshCw, Sparkles } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, serverColdStart } = useAuth();
  const navigate = useNavigate();

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
    { icon: Zap, title: 'Instant Revocation', desc: 'Permissions enforced in real-time, zero cache' },
  ];

  return (
    <div className="min-h-screen flex bg-[#08090C] text-slate-100 transition-colors duration-200 relative overflow-hidden">
      {/* Ambient Top Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(0,0,0,0))] pointer-events-none" />

      {/* Theme Toggle in top-right */}
      <div className="absolute top-5 right-5 z-30">
        <ThemeToggle />
      </div>

      {/* Left Panel — Hero */}
      <div className="hidden lg:flex lg:w-3/5 relative overflow-hidden flex-col justify-center">
        <div className="absolute top-20 left-16 w-80 h-80 bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-20 right-16 w-96 h-96 bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="relative z-10 px-16 py-12">
          {/* Logo */}
          <div className="flex items-center space-x-3 mb-16">
            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/30 text-white">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <span className="text-2xl font-semibold tracking-tight text-white">TrustVault</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-semibold text-white leading-tight mb-4 tracking-tight">
            Share securely.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-indigo-300">
              Trust every access.
            </span>
          </h1>
          <p className="text-slate-400 text-lg mb-12 leading-relaxed max-w-md font-normal">
            Enterprise zero-trust confidential document platform with strict per-document authorization and tamper-evident SHA-256 audit trails.
          </p>

          {/* Feature List */}
          <div className="space-y-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start space-x-4">
                <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400 flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Chain indicator */}
          <div className="mt-14 inline-flex items-center space-x-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400 font-semibold">
            <span className="relative flex h-2 w-2 mr-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>RISE Security Evaluation Edition — Active</span>
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-6 sm:p-8 relative z-10">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center space-x-3 mb-8">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/30 text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="text-xl font-semibold text-white">TrustVault</span>
          </div>

          {/* Cold-Start Notice Banner */}
          {serverColdStart && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start space-x-2.5 text-amber-300 text-xs shadow-lg">
              <Zap className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400 animate-pulse" />
              <span>⚡ Cloud backend is initializing secure context (~30s). Please sign in using the demo pills below.</span>
            </div>
          )}

          {/* Form Card */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/[0.07] rounded-2xl p-7 sm:p-8 shadow-2xl hover:border-indigo-500/40 hover:shadow-[0_0_25px_rgba(99,102,241,0.12)] transition-all duration-300">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-semibold tracking-tight text-white">Sign in</h2>
              <span className="font-mono text-[10px] text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded border border-white/5">v1.0-prod</span>
            </div>
            <p className="text-xs text-slate-400 mb-6 font-normal">Secure session · HttpOnly cookie · Server-enforced</p>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-3 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="block w-full pl-9 pr-3 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-sm transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="block w-full pl-9 pr-10 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-sm transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-300 disabled:opacity-50 shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/40"
              >
                {loading ? (
                  <span className="flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Authenticating...</span>
                  </span>
                ) : (
                  'Sign In Securely'
                )}
              </button>
            </form>

            {/* Prominent Evaluator Quick-Fill Credentials */}
            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-indigo-400 mr-1" />
                  <span>1-Click Evaluator Credentials</span>
                </p>
                <span className="font-mono text-[9px] text-slate-500">Auto-fill</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickFill('owner@trustvault.demo', 'TrustVault#Owner2026!')}
                  className="px-2 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-semibold rounded-xl border border-blue-500/20 hover:border-blue-500/40 transition-all duration-200 flex flex-col items-center justify-center shadow-sm"
                >
                  <span>Owner</span>
                  <span className="text-[9px] text-blue-400/80 font-normal mt-0.5">Upload/Share</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('viewer@trustvault.demo', 'TrustVault#Viewer2026!')}
                  className="px-2 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold rounded-xl border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-200 flex flex-col items-center justify-center shadow-sm"
                >
                  <span>Viewer</span>
                  <span className="text-[9px] text-emerald-400/80 font-normal mt-0.5">Read-Only</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('admin@trustvault.demo', 'TrustVault#Admin2026!')}
                  className="px-2 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-semibold rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all duration-200 flex flex-col items-center justify-center shadow-sm"
                >
                  <span>Admin</span>
                  <span className="text-[9px] text-purple-400/80 font-normal mt-0.5">Audit/Gov</span>
                </button>
              </div>
            </div>

            <div className="mt-5 text-center">
              <span className="text-xs text-slate-400">
                Need an account?{' '}
                <Link to="/register" className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
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

