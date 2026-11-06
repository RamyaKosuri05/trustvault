import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services/dashboardService';
import { documentService } from '../services/documentService';
import { 
  FileText, 
  Users, 
  ShieldAlert, 
  ShieldCheck, 
  Download, 
  Clock, 
  Share2, 
  ArrowUpRight 
} from 'lucide-react';

const StatCard = ({ label, value, sub, icon: Icon, color = 'indigo', accent, to, onClick }) => {
  const navigate = useNavigate();

  const iconColors = {
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
  };
  const iconStyle = iconColors[color] || iconColors.indigo;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    }
  };

  const isInteractive = Boolean(to || onClick);

  return (
    <div
      onClick={isInteractive ? handleClick : undefined}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && isInteractive) {
          e.preventDefault();
          handleClick();
        }
      }}
      className={`bg-white dark:bg-white/[0.02] backdrop-blur-2xl border border-slate-200 dark:border-white/[0.06] rounded-2xl p-5 shadow-sm dark:shadow-2xl transition-all duration-300 relative overflow-hidden group ${
        isInteractive
          ? 'cursor-pointer hover:border-indigo-500/40 hover:shadow-md dark:hover:shadow-[0_0_25px_rgba(99,102,241,0.12)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40'
          : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#0f172a] dark:text-slate-400 font-mono stat-card-title transition-colors">
          {label}
        </span>
        <div className="flex items-center space-x-1.5">
          {isInteractive && (
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
          )}
          <div className={`p-1.5 rounded-lg ${iconStyle} transition-transform group-hover:scale-110 duration-200`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </div>
      <div className={`text-3xl font-bold tracking-tight stat-card-value transition-colors ${accent || 'text-[#08090C] dark:text-white'}`}>
        {value}
      </div>
      {sub && (
        <p className="font-mono text-xs text-[#334155] dark:text-slate-400 mt-1.5 stat-card-sub transition-colors">
          {sub}
        </p>
      )}
    </div>
  );
};

const Dashboard = () => {
  const { user, isAdmin, isOwner, isViewer } = useAuth();
  const [data, setData] = useState(null);
  const [docCount, setDocCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [dashRes, docsRes] = await Promise.allSettled([
          isAdmin
            ? dashboardService.getAdmin()
            : isOwner
            ? dashboardService.getOwner()
            : dashboardService.getViewer(),
          documentService.list(),
        ]);

        if (dashRes.status === 'fulfilled') {
          setData(dashRes.value);
        }
        if (docsRes.status === 'fulfilled') {
          const val = docsRes.value;
          const count = Array.isArray(val)
            ? val.length
            : (val?.items?.length ?? val?.total ?? 0);
          setDocCount(count);
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [isAdmin, isOwner, isViewer]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#475569] dark:text-slate-400 text-xs font-mono">
        <Clock className="w-4 h-4 animate-spin mr-2 text-indigo-500 dark:text-indigo-400" />
        Synchronizing live security metrics...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Ambient Banner */}
      <div className="relative overflow-hidden bg-white dark:bg-white/[0.02] backdrop-blur-2xl border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-sm dark:shadow-2xl hover:border-indigo-500/30 transition-all duration-300">
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Welcome back, {user?.full_name}
            </h1>
            <p className="text-xs text-[#334155] dark:text-slate-400 mt-1">
              Active Security Role:{' '}
              <span className="font-mono text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 uppercase font-semibold">
                {user?.role}
              </span>
              {' '}— All transactions verified by server-side authorization engine.
            </p>
          </div>
          <div className="inline-flex items-center space-x-2 bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] px-3 py-1.5 rounded-xl text-xs font-mono text-emerald-600 dark:text-emerald-400">
            <span className="relative flex h-2 w-2 mr-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Zero-Trust Active</span>
          </div>
        </div>
      </div>

      {/* Admin View */}
      {isAdmin && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard 
              label="Total Users" 
              value={data?.total_users || 0} 
              sub="Active system accounts" 
              icon={Users} 
              color="blue" 
              to="/user-management" 
            />
            <StatCard 
              label="Total Documents" 
              value={docCount || data?.total_documents || 0} 
              sub="Per-record isolated" 
              icon={FileText} 
              color="indigo" 
              to="/documents" 
            />
            <StatCard 
              label="Active Grants" 
              value={data?.total_active_grants || 0} 
              sub="Explicit delegations" 
              icon={Share2} 
              color="emerald" 
              to="/documents?filter=grants" 
            />
            <StatCard
              label="Access Denied"
              value={data?.total_access_denials || 0}
              sub="Zero-trust blocks logged"
              icon={ShieldAlert}
              color="rose"
              accent={data?.total_access_denials > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-[#08090C] dark:text-white'}
              to="/audit?status=denied"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-white/[0.02] backdrop-blur-2xl border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-sm dark:shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#0f172a] dark:text-slate-400 font-mono">
                  Hash Chain Integrity
                </span>
                <span className={`font-mono text-xs px-2.5 py-0.5 rounded-md border font-semibold ${
                  data?.chain_integrity === 'VERIFIED'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                }`}>
                  {data?.chain_integrity || 'UNCHECKED'}
                </span>
              </div>
              <p className="text-xs text-[#334155] dark:text-slate-400 leading-relaxed">
                TrustVault's tamper-evident audit log utilizes a cryptographic SHA-256 hash chain with exclusive database advisory lock serialization.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/[0.04] flex items-center justify-between text-xs font-mono text-[#475569] dark:text-slate-400">
                <span>Total Audit Events:</span>
                <span className="font-bold text-slate-900 dark:text-slate-200">{data?.total_audit_events || 0}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-white/[0.02] backdrop-blur-2xl border border-slate-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-sm dark:shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#0f172a] dark:text-slate-400 font-mono">
                  Storage Subsystem
                </span>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.03] text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 font-semibold">
                  PRIVATE UUID
                </span>
              </div>
              <p className="text-xs text-[#334155] dark:text-slate-400 leading-relaxed">
                Files are stored outside web roots using unguessable UUIDv4 keys and validated with strict magic byte inspection and SHA-256 checksums.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/[0.04] flex items-center justify-between text-xs font-mono text-[#475569] dark:text-slate-400">
                <span>Storage Utilization:</span>
                <span className="font-bold text-slate-900 dark:text-slate-200">{((data?.storage_used_bytes || 0) / 1024).toFixed(1)} KB</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Owner View */}
      {isOwner && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard 
              label="My Documents" 
              value={docCount || data?.my_documents_count || 0} 
              sub="Under your custody" 
              icon={FileText} 
              color="indigo" 
              to="/documents" 
            />
            <StatCard 
              label="Active Grants" 
              value={data?.active_grants_count || 0} 
              sub="Delegated permissions" 
              icon={Share2} 
              color="emerald" 
              to="/documents?filter=grants" 
            />
            <StatCard 
              label="Recent Access" 
              value={data?.recent_events_count || 0} 
              sub="Past 7 days activity" 
              icon={Download} 
              color="blue" 
              to="/audit" 
            />
          </div>
        </div>
      )}

      {/* Viewer View */}
      {isViewer && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard 
              label="Accessible Documents" 
              value={docCount || data?.accessible_documents_count || 0} 
              sub="Explicitly shared with you" 
              icon={FileText} 
              color="emerald" 
              to="/shared" 
            />
            <StatCard 
              label="Downloads Logged" 
              value={data?.downloads_count || 0} 
              sub="Audited download actions" 
              icon={Download} 
              color="blue" 
              to="/audit" 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
