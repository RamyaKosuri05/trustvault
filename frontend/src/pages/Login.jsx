import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <div className="inline-flex p-3 bg-blue-600/20 text-blue-400 rounded-2xl mb-4 border border-blue-500/30 shadow-inner">
          <ShieldCheck className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">TrustVault</h2>
        <p className="mt-2 text-sm text-slate-400">
          Share securely. Track everything. Trust every access.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-slate-800/80 backdrop-blur-md py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-700/80">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-400 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Email Address
              </label>
              <div className="mt-1.5 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Password
              </label>
              <div className="mt-1.5 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-slate-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Sign In with Secure Session'}
              </button>
            </div>
          </form>

          {/* Quick-fill Demo Credentials (Judges) */}
          {isDemo && (
            <div className="mt-8 pt-6 border-t border-slate-700/60">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-400 text-center mb-3">
                RISE Judge Quick-Fill Credentials
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickFill('admin@trustvault.demo', 'TrustVault#Admin2026!')}
                  className="px-2 py-1.5 bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 text-xs font-semibold rounded border border-purple-800/60 transition"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('owner@trustvault.demo', 'TrustVault#Owner2026!')}
                  className="px-2 py-1.5 bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 text-xs font-semibold rounded border border-blue-800/60 transition"
                >
                  Owner
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('viewer@trustvault.demo', 'TrustVault#Viewer2026!')}
                  className="px-2 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300 text-xs font-semibold rounded border border-emerald-800/60 transition"
                >
                  Viewer
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <span className="text-xs text-slate-400">
              Need an account?{' '}
              <Link to="/register" className="font-semibold text-blue-400 hover:text-blue-300">
                Self-register here
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
