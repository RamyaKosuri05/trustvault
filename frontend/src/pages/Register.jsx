import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/common/ThemeToggle';
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
    viewer: { label: 'Viewer', desc: 'Read documents shared with you', color: 'emerald' },
    owner: { label: 'Owner', desc: 'Upload, share & manage documents', color: 'blue' },
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#070d1f] text-slate-900 dark:text-slate-100 transition-colors duration-200 relative">
      {/* Theme Toggle */}
      <div className="absolute top-5 right-5 z-30">
        <ThemeToggle />
      </div>

      {/* Left Panel — Hero */}
      <div className="hidden lg:flex lg:w-3/5 relative overflow-hidden flex-col justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 dark:from-[#070d1f] dark:via-[#0d1a35] dark:to-[#070d1f]" />
        <div className="absolute top-20 left-16 w-80 h-80 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-20 right-16 w-96 h-96 bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />

        <div className="relative z-10 px-16 py-12">
          <div className="flex items-center space-x-3 mb-16">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/40 text-white">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">TrustVault</span>
          </div>

          <h1 className="text-5xl font-extrabold text-white leading-tight mb-4 tracking-tight">
            Your vault.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">
              Your rules.
            </span>
          </h1>
          <p className="text-slate-300 dark:text-slate-400 text-lg mb-12 leading-relaxed max-w-md">
            Create a free account to start sharing documents securely, or request read-only access to documents shared with you.
          </p>

          <div className="space-y-5">
            {[
              { icon: HardDrive, title: 'Owner', desc: 'Upload confidential documents and control who accesses them.' },
              { icon: Eye, title: 'Viewer', desc: 'View and download documents shared exclusively with you.' },
              { icon: Shield, title: 'Zero Trust', desc: 'Admin accounts provisioned exclusively via secure CLI.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start space-x-4">
                <div className="p-2 bg-indigo-500/15 rounded-lg border border-indigo-500/20 text-indigo-400 flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-8 relative bg-slate-50 dark:bg-[#0a1020] transition-colors duration-200">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/8 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center space-x-3 mb-8">
            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/40 text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">TrustVault</span>
          </div>

          <div className="bg-white dark:bg-white/[0.04] backdrop-blur-2xl border border-slate-200 dark:border-white/[0.08] rounded-2xl p-8 shadow-xl dark:shadow-2xl dark:shadow-black/40 transition-colors duration-200">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Create Account</h2>
            <p className="text-xs text-slate-500 mb-6">Self-register as Owner or Viewer</p>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-3 text-rose-600 dark:text-rose-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start space-x-3 text-emerald-600 dark:text-emerald-400 text-sm">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alice Smith"
                    className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-sm transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alice@company.com"
                    className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-sm transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">Password (min 10 chars)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={10}
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

              {/* Role Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(roleInfo).map(([key, { label, desc, color }]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRole(key)}
                      className={`py-3 px-3 border rounded-lg text-left transition-all duration-200 ${
                        role === key
                          ? `bg-${color}-500/15 border-${color}-500/40 text-${color}-700 dark:text-white`
                          : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.07] text-slate-500 dark:text-slate-500 hover:border-slate-300 dark:hover:border-white/15'
                      }`}
                    >
                      <p className={`text-xs font-bold ${role === key ? `text-${color}-600 dark:text-${color}-300` : 'text-slate-700 dark:text-slate-300'}`}>{label}</p>
                      <p className="text-[10px] mt-0.5 leading-tight text-slate-500">{desc}</p>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-slate-500">Admin accounts are provisioned via secure CLI only.</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 disabled:opacity-50 shadow-lg shadow-blue-600/20 mt-2"
              >
                {loading ? 'Creating Account...' : 'Complete Registration'}
              </button>
            </form>

            <div className="mt-5 text-center">
              <span className="text-xs text-slate-500 dark:text-slate-600">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors">
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

