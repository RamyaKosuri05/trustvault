import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services/dashboardService';
import { 
  FileText, 
  Users, 
  ShieldAlert, 
  ShieldCheck, 
  Download, 
  HardDrive, 
  Clock, 
  Share2, 
  AlertTriangle 
} from 'lucide-react';

const StatCard = ({ label, value, sub, icon: Icon, color = 'blue', accent }) => {
  const colors = {
    blue: { bg: 'bg-blue-500/10', icon: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-500/20', val: 'text-blue-700 dark:text-blue-300' },
    emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/20', val: 'text-emerald-700 dark:text-emerald-300' },
    rose: { bg: 'bg-rose-500/10', icon: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-500/20', val: 'text-rose-700 dark:text-rose-300' },
    purple: { bg: 'bg-purple-500/10', icon: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-500/20', val: 'text-purple-700 dark:text-purple-300' },
    slate: { bg: 'bg-slate-100 dark:bg-white/5', icon: 'text-slate-500 dark:text-slate-400', border: 'border-slate-200 dark:border-white/[0.08]', val: 'text-slate-900 dark:text-white' },
  };
  const c = colors[color] || colors.slate;
  return (
    <div className={`bg-white dark:bg-white/[0.03] border ${c.border} rounded-xl p-5 hover:bg-slate-50/80 dark:hover:bg-white/[0.05] transition-all duration-200 shadow-sm dark:shadow-none`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</span>
        <div className={`p-1.5 ${c.bg} rounded-lg ${c.icon}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className={`text-2xl font-bold ${accent || c.val}`}>{value}</div>
      {sub && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{sub}</p>}
    </div>
  );
};

const Dashboard = () => {
  const { user, isAdmin, isOwner, isViewer } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        if (isAdmin) {
          const res = await dashboardService.getAdmin();
          setData(res);
        } else if (isOwner) {
          const res = await dashboardService.getOwner();
          setData(res);
        } else {
          const res = await dashboardService.getViewer();
          setData(res);
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [isAdmin, isOwner]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        <Clock className="w-5 h-5 animate-spin mr-2" />
        Loading live metrics...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-transparent dark:from-blue-600/20 dark:via-indigo-600/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-6 shadow-sm dark:shadow-none">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Welcome back, {user?.full_name}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Active Role:{' '}
              <span className="text-blue-600 dark:text-blue-400 font-semibold uppercase">{user?.role}</span>
              {' '}— Server-side authorization enforced on every request.
            </p>
          </div>
          <div className="hidden sm:flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            <span>Zero-Trust Active</span>
          </div>
        </div>
      </div>

      {/* ADMIN DASHBOARD */}
      {isAdmin && data && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-2 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Security Command Center</span>
            </h2>
            <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              data.chain_valid
                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                : 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/25 shadow-[0_0_10px_rgba(239,68,68,0.15)]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${data.chain_valid ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-rose-500 dark:bg-rose-400'}`} />
              <span>{data.chain_valid ? 'SHA-256 Chain Intact' : 'Chain Tampered!'}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={data.total_users} sub={`${data.active_users} active`} icon={Users} color="blue" />
            <StatCard label="Managed Documents" value={data.total_documents} sub="Metadata inventory only" icon={FileText} color="purple" />
            <StatCard label="Audit Events" value={data.total_audit_events} sub="Hashed & serialized" icon={ShieldCheck} color="emerald" />
            <StatCard label="Security Alerts (24h)" value={data.denied_events_last_24h} sub={`${data.failed_logins_last_24h} failed logins`} icon={ShieldAlert} color="rose" accent="text-rose-600 dark:text-rose-300" />
          </div>

          <div className="p-4 bg-purple-500/10 dark:bg-purple-500/8 rounded-xl border border-purple-500/20 dark:border-purple-500/15 text-xs text-purple-900 dark:text-purple-300/80 leading-relaxed">
            <span className="font-bold text-purple-700 dark:text-purple-300">Governance Note:</span> As an Administrator, you have system oversight, user lifecycle control, and metadata visibility. File bytes are cryptographically restricted from download unless an owner explicitly shares with you.
          </div>
        </div>
      )}

      {/* OWNER DASHBOARD */}
      {isOwner && data && (
        <div className="space-y-5">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-2 uppercase tracking-wider">
            <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Document Vault Overview</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Owned Documents" value={data.total_documents} sub="Across all categories" icon={FileText} color="slate" />
            <StatCard label="Shared Documents" value={data.shared_documents} sub="With active permissions" icon={Share2} color="blue" />
            <StatCard label="Active Grants" value={data.total_permissions_granted} sub="Read & Edit combined" icon={Users} color="emerald" />
            <StatCard
              label="Storage Used"
              value={`${(data.storage_used_bytes / (1024 * 1024)).toFixed(2)} MB`}
              sub="Encrypted on volume"
              icon={HardDrive}
              color="slate"
            />
          </div>
        </div>
      )}

      {/* VIEWER DASHBOARD */}
      {isViewer && data && (
        <div className="space-y-5">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-2 uppercase tracking-wider">
            <Share2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Shared Workspace</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Accessible Docs" value={data.shared_with_me} sub="Directly granted to you" icon={FileText} color="slate" />
            <StatCard label="Read Only Access" value={data.read_access_count} sub="Download & view" icon={Download} color="blue" />
            <StatCard label="Edit Permissions" value={data.edit_access_count} sub="Metadata & version upload" icon={Share2} color="emerald" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

