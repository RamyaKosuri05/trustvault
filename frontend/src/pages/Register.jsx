import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Lock, Mail, User, AlertCircle, CheckCircle, HardDrive, Eye, EyeOff, Shield } from 'lucide-react';

const Register = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('viewer');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await register(fullName, email, password, role);
      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(
        err.response?.data?.detail || 
        err.response?.data?.message || 
        'Registration failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const roleInfo = {
    viewer: { label: 'Viewer', desc: 'Read documents shared with you', border: 'border-sky-500/30 text-sky-400 bg-sky-500/10' },
    owner: { label: 'Owner', desc: 'Upload, share & manage documents', border: 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10' },
  };

  return (
    <div className="min-h-screen flex bg-[#08090C] text-slate-100 relative overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Top ambient radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.12),rgba(0,0,0,0))] pointer-events-none" />

      {/* Left Panel — Hero */}
      <div className="hidden lg:flex lg:w-3/5 relative flex-col justify-center px-16 py-12 z-10 border-r border-white/[0.05]">
        <div className="max-w-xl">
          <div className="flex items-center space-x-3 mb-12">
            <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-white">TrustVault</span>
            <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              ZERO-TRUST
            </span>
          </div>

          <h1 className="text-4xl font-semibold text-white leading-tight mb-4 tracking-tight">
            Cryptographic guarantees.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-sky-400">
              Granular isolation.
            </span>
          </h1>
          <p className="text-slate-400 text-sm mb-10 leading-relaxed max-w-md">
            Register an account to publish confidential files with per-record access grants or access resources shared with you.
          </p>

          <div className="space-y-4">
            {[
              { icon: HardDrive, title: 'Document Owner', desc: 'Upload confidential records and control explicit access delegations.' },
              { icon: Eye, title: 'Document Viewer', desc: 'Securely inspect and download resources granted to your identity.' },
              { icon: Shield, title: 'System Administrator', desc: 'Tamper-evident audit chain inspection provisioned strictly via CLI.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start space-x-3.5 p-3 rounded-xl bg-white/[0.01] border border-white/[0.04]">
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">{title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Form Card */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center space-x-3 mb-8">
            <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="text-xl font-semibold text-white tracking-tight">TrustVault</span>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.06] rounded-2xl p-7 shadow-2xl hover:border-indigo-500/30 transition-all duration-300">
            <h2 className="text-lg font-semibold text-white mb-1 tracking-tight">Create Account</h2>
            <p className="text-xs text-slate-400 mb-6 font-mono">Self-register as Owner or Viewer</p>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-2.5 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start space-x-2.5 text-emerald-400 text-xs">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alice Smith"
                    className="block w-full pl-9 pr-3 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 text-xs transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alice@company.com"
                    className="block w-full pl-9 pr-3 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 text-xs transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">Password (min 10 chars)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={10}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="block w-full pl-9 pr-10 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 text-xs transition-all duration-200"
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

              {/* Role Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 font-mono">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(roleInfo).map(([key, { label, desc, border }]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRole(key)}
                      className={`py-2.5 px-3 border rounded-xl text-left transition-all duration-200 ${
                        role === key
                          ? border
                          : 'bg-white/[0.01] border-white/[0.06] text-slate-400 hover:border-white/15'
                      }`}
                    >
                      <p className="text-xs font-bold">{label}</p>
                      <p className="text-[10px] mt-0.5 leading-tight opacity-75">{desc}</p>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-slate-500 font-mono">Admin accounts are provisioned via secure CLI only.</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30 transition-all duration-200 disabled:opacity-50 mt-2"
              >
                {loading ? 'Creating Account...' : 'Complete Registration'}
              </button>
            </form>

            <div className="mt-5 text-center">
              <span className="text-xs text-slate-500">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                  Sign in here
                </Link>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
