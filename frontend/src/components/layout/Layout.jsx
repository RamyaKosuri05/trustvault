import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../common/ThemeToggle';
import { 
  ShieldCheck, 
  FileText, 
  UploadCloud, 
  Users, 
  Activity, 
  Layers, 
  LogOut, 
  Lock
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Strict role segregation: Upload Document is EXCLUSIVELY for owner role
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Activity, roles: ['admin', 'owner', 'viewer'] },
    { name: 'My Documents', path: '/documents', icon: FileText, roles: ['owner', 'admin'] },
    { name: 'Shared With Me', path: '/shared', icon: Lock, roles: ['viewer', 'owner'] },
    { name: 'Upload Document', path: '/upload', icon: UploadCloud, roles: ['owner'] },
    { name: 'Audit Trail', path: '/audit', icon: ShieldCheck, roles: ['admin', 'owner'] },
    { name: 'User Management', path: '/users', icon: Users, roles: ['admin'] },
    { name: 'Categories', path: '/categories', icon: Layers, roles: ['admin'] },
  ];

  const filteredNav = navItems.filter(item => item.roles.includes(user?.role));

  const roleBadge = {
    admin: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    owner: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    viewer: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  }[user?.role] || 'bg-slate-500/10 text-slate-400 border border-slate-500/20';

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#08090C] text-slate-900 dark:text-slate-100 overflow-hidden relative transition-colors duration-200">
      {/* Top Ambient Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.12),rgba(0,0,0,0))] pointer-events-none z-0 dark:opacity-100 opacity-40" />

      {/* Sidebar - Linear Transparent Aesthetic */}
      <aside className="w-64 bg-white/80 dark:bg-white/[0.02] backdrop-blur-2xl flex flex-col justify-between border-r border-slate-200 dark:border-white/[0.06] shadow-xl dark:shadow-2xl z-20 transition-colors duration-200">
        <div>
          {/* Logo */}
          <div className="p-6 flex items-center space-x-3 border-b border-slate-200 dark:border-white/[0.06]">
            <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-xl shadow-lg shadow-indigo-500/20 text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white leading-tight">TrustVault</h1>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Zero-Trust v1.0</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 mt-2">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-indigo-600/80 text-white shadow-lg shadow-indigo-600/25 border border-indigo-500/40'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-slate-200 dark:border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-300 font-bold border border-indigo-500/30 text-xs flex-shrink-0">
                {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{user?.full_name}</p>
                <span className={`inline-block font-mono text-[9px] uppercase font-semibold px-2 py-0.5 rounded mt-0.5 ${roleBadge}`}>
                  {user?.role}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden z-10">
        {/* Top Header */}
        <header className="h-14 bg-white/70 dark:bg-white/[0.01] backdrop-blur-md border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between px-8 z-10 transition-colors duration-200">
          <div className="flex items-center text-xs text-slate-400 font-mono">
            <span className="relative flex h-2 w-2 mr-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-500 dark:text-emerald-400 font-semibold tracking-wider text-[11px]">ZERO-TRUST ENGINE ACTIVE</span>
          </div>

          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{user?.email}</p>
              <p className="text-[10px] font-mono text-slate-500">HttpOnly · TLS · Server-Enforced</p>
            </div>
          </div>
        </header>

        {/* Body Container */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
