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
  const { user, logout, isAdmin, isOwner } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

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
    admin: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    owner: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    viewer: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  }[user?.role] || 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30';

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#070d1f] text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-[#0d1424]/90 backdrop-blur-xl flex flex-col justify-between border-r border-slate-200 dark:border-white/5 shadow-sm dark:shadow-2xl z-20 transition-colors duration-200">
        <div>
          {/* Logo */}
          <div className="p-6 flex items-center space-x-3 border-b border-slate-200 dark:border-white/5">
            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30 text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight">TrustVault</h1>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Enterprise Edition</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-0.5 mt-2">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
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
        <div className="p-4 border-t border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-blue-600/15 dark:bg-blue-600/20 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold border border-blue-500/30 text-sm flex-shrink-0">
                {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.full_name}</p>
                <span className={`inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border mt-0.5 ${roleBadge}`}>
                  {user?.role}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-14 bg-white/90 dark:bg-[#0d1424]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-8 z-10 transition-colors duration-200">
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.6)]"></span>
            <span className="text-emerald-600 dark:text-emerald-500/80 font-semibold tracking-wider">ZERO-TRUST ENGINE ACTIVE</span>
          </div>

          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-300">{user?.email}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-600">HttpOnly · TLS · Server-Enforced</p>
            </div>
          </div>
        </header>

        {/* Body Container */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-[#070d1f] transition-colors duration-200">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;


