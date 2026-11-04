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
        Loading Live Metrics...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-6 rounded-2xl border border-slate-700/80 shadow-md text-white">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Welcome back, {user?.full_name}</h1>
            <p className="text-sm text-slate-400 mt-1">
              Active Role: <span className="text-blue-400 font-semibold uppercase">{user?.role}</span> — All access enforced via server-side authorization engine.
            </p>
          </div>
          <div className="hidden sm:flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Zero-Trust Enforced</span>
          </div>
        </div>
      </div>

      {/* ADMIN SECURITY COMMAND CENTER */}
      {isAdmin && data && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span>Admin Security & Governance Command Center</span>
            </h2>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                data.chain_valid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {data.chain_valid ? 'SHA-256 Chain Intact' : 'Chain Tampered / Broken!'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Total Users</span>
                <Users className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-800">{data.total_users}</div>
              <p className="text-xs text-slate-400 mt-1">{data.active_users} active accounts</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Managed Documents</span>
                <FileText className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-800">{data.total_documents}</div>
              <p className="text-xs text-purple-600 font-medium mt-1">Metadata inventory only</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Audit Events</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-slate-800">{data.total_audit_events}</div>
              <p className="text-xs text-emerald-600 font-medium mt-1">Hashed & serialized</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Security Alerts (24h)</span>
                <ShieldAlert className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-bold text-rose-600">{data.denied_events_last_24h}</div>
              <p className="text-xs text-rose-500 mt-1">{data.failed_logins_last_24h} failed logins</p>
            </div>
          </div>

          <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-900 leading-relaxed">
            <span className="font-bold">Governance Note:</span> As an Administrator, you have system oversight, user lifecycle control, and metadata visibility. In accordance with zero-trust principles, file bytes are cryptographically restricted from download unless an owner explicitly shares with you.
          </div>
        </div>
      )}

      {/* OWNER VAULT OVERVIEW */}
      {isOwner && data && (
        <div className="space-y-6">
          <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <HardDrive className="w-5 h-5 text-blue-600" />
            <span>Document Vault Overview</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Owned Documents</span>
                <FileText className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-800">{data.total_documents}</div>
              <p className="text-xs text-slate-400 mt-1">Across all categories</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Shared Documents</span>
                <Share2 className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-blue-600">{data.shared_documents}</div>
              <p className="text-xs text-slate-400 mt-1">With active permissions</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Active Grants</span>
                <Users className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-600">{data.total_permissions_granted}</div>
              <p className="text-xs text-slate-400 mt-1">Read & Edit combined</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Private Storage Used</span>
                <HardDrive className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-800">
                {(data.storage_used_bytes / (1024 * 1024)).toFixed(2)} MB
              </div>
              <p className="text-xs text-slate-400 mt-1">Encrypted on persistent volume</p>
            </div>
          </div>
        </div>
      )}

      {/* VIEWER SHARED WORKSPACE */}
      {isViewer && data && (
        <div className="space-y-6">
          <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <Share2 className="w-5 h-5 text-blue-600" />
            <span>Shared Workspace</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Accessible Docs</span>
                <FileText className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-800">{data.shared_with_me}</div>
              <p className="text-xs text-slate-400 mt-1">Directly granted to you</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Read Only Access</span>
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-blue-600">{data.read_access_count}</div>
              <p className="text-xs text-slate-400 mt-1">Download & view</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Edit Permissions</span>
                <Share2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-600">{data.edit_access_count}</div>
              <p className="text-xs text-slate-400 mt-1">Metadata & version upload</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

