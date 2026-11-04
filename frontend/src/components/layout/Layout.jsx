import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  ShieldCheck, 
  FileText, 
  UploadCloud, 
  Users, 
  Activity, 
  Layers, 
  LogOut, 
  User, 
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

  const roleBadgeColor = {
    admin: 'bg-purple-100 text-purple-700 border-purple-200',
    owner: 'bg-blue-100 text-blue-700 border-blue-200',
    viewer: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  }[user?.role] || 'bg-slate-100 text-slate-700';

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col justify-between border-r border-slate-800 shadow-xl z-20">
        <div>
          {/* Logo */}
          <div className="p-6 flex items-center space-x-3 border-b border-slate-800/80">
            <div className="p-2 bg-blue-600 rounded-lg shadow-md shadow-blue-500/20 text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-tight">TrustVault</h1>
              <p className="text-xs text-slate-400 font-medium">Enterprise Security Edition</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
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
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-semibold border border-slate-700 text-xs flex-shrink-0">
                {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
                <span className={`inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border mt-0.5 ${roleBadgeColor}`}>
                  {user?.role}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10">
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>ZERO UNAUTHORIZED REACHABILITY ENGINE ACTIVE</span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-700">{user?.email}</p>
              <p className="text-[11px] text-slate-400">Strict TLS / HttpOnly Protected</p>
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
