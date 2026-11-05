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

const StatCard = ({ label, value, sub, icon: Icon, color = 'indigo', accent }) => {
  const iconColors = {
    indigo: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  };
  const iconStyle = iconColors[color] || iconColors.indigo;

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl border border-white/[0.07] rounded-2xl p-5 hover:border-indigo-500/40 hover:shadow-[0_0_25px_rgba(99,102,241,0.12)] transition-all duration-300 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <div className={`p-1.5 rounded-lg ${iconStyle}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className={`text-3xl font-semibold tracking-tight ${accent || 'text-white'}`}>{value}</div>
      {sub && <p className="font-mono text-xs text-slate-400 mt-1.5">{sub}</p>}
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
      <div className="flex items-center justify-center h-64 text-slate-400 text-xs font-mono">
        <Clock className="w-4 h-4 animate-spin mr-2 text-indigo-400" />
        Synchronizing live security metrics...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Ambient Banner */}
      <div className="relative overflow-hidden bg-slate-900/50 backdrop-blur-xl border border-white/[0.07] rounded-2xl p-6 shadow-xl hover:border-indigo-500/40 transition-all duration-300">
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Welcome back, {user?.full_name}</h1>
            <p className="text-sm text-slate-400 mt-1">
              Active Security Role:{' '}
              <span className="font-mono text-xs text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 uppercase font-semibold">
                {user?.role}
              </span>
              {' '}— All transactions verified by server-side authorization engine.
            </p>
          </div>
          <div className="inline-flex items-center space-x-2 bg-slate-950/60 border border-white/5 px-3 py-1.5 rounded-xl text-xs font-mono text-emerald-400">
            <span className="relative flex h-2 w-2 mr-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Zero-Trust Active</span>
          </div>
        </div>
      </div>

      {/* ADMIN GOVERNANCE COMMAND CENTER */}
      {isAdmin && data && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center space-x-2 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Security Governance & Audit Center</span>
            </h2>
            <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              data.chain_valid
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${data.chain_valid ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span>{data.chain_valid ? 'SHA-256 Chain Intact' : 'Chain Tampered!'}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={data.total_users} sub={`${data.active_users} active accounts`} icon={Users} color="indigo" />
            <StatCard label="Managed Documents" value={data.total_documents} sub="Metadata inventory only" icon={FileText} color="purple" />
            <StatCard label="Audit Events" value={data.total_audit_events} sub="Cryptographically serialized" icon={ShieldCheck} color="emerald" />
            <StatCard label="Security Alerts (24h)" value={data.denied_events_last_24h} sub={`${data.failed_logins_last_24h} failed login attempts`} icon={ShieldAlert} color="rose" accent="text-rose-400" />
          </div>

          <div className="p-4 bg-slate-900/40 rounded-2xl border border-white/[0.07] text-xs text-slate-300 leading-relaxed font-mono">
            <span className="text-indigo-400 font-semibold font-sans uppercase">Governance Invariant:</span> As an Administrator, your role encompasses user lifecycle control and document metadata oversight. In accordance with zero-trust isolation, document bytes are cryptographically restricted from download unless explicitly granted by the document owner.
          </div>
        </div>
      )}

      {/* OWNER VAULT OVERVIEW */}
      {isOwner && data && (
        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-white flex items-center space-x-2 uppercase tracking-wider">
            <HardDrive className="w-4 h-4 text-indigo-400" />
            <span>Document Vault Overview</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Owned Documents" value={data.total_documents} sub="Across all categories" icon={FileText} color="indigo" />
            <StatCard label="Shared Documents" value={data.shared_documents} sub="With active permissions" icon={Share2} color="blue" />
            <StatCard label="Active Grants" value={data.total_permissions_granted} sub="Read & Edit combined" icon={Users} color="emerald" />
            <StatCard
              label="Storage Used"
              value={`${(data.storage_used_bytes / (1024 * 1024)).toFixed(2)} MB`}
              sub="Encrypted private storage"
              icon={HardDrive}
              color="indigo"
            />
          </div>
        </div>
      )}

      {/* VIEWER SHARED WORKSPACE */}
      {isViewer && data && (
        <div className="space-y-5">
          <h2 className="text-sm font-semibold text-white flex items-center space-x-2 uppercase tracking-wider">
            <Share2 className="w-4 h-4 text-indigo-400" />
            <span>Shared Workspace</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Accessible Docs" value={data.shared_with_me} sub="Directly granted to you" icon={FileText} color="indigo" />
            <StatCard label="Read-Only Access" value={data.read_access_count} sub="Download & inspect" icon={Download} color="blue" />
            <StatCard label="Edit Permissions" value={data.edit_access_count} sub="Metadata & version upload" icon={Share2} color="emerald" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

