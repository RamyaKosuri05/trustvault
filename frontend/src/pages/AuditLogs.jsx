import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { auditService } from '../services/auditService';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, CheckCircle, RefreshCw, Download, Link as LinkIcon, ShieldAlert, X } from 'lucide-react';

const statusBadge = {
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
  denied: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20',
  failed: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
};

const AuditLogs = () => {
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const actionParam = searchParams.get('action') || '';
  const userParam = searchParams.get('user') || searchParams.get('actor_id') || '';
  const filterParam = searchParams.get('filter') || '';
  const initialStatus = searchParams.get('status') || '';

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  useEffect(() => {
    const s = searchParams.get('status');
    if (s !== null) {
      setStatusFilter(s);
    } else {
      setStatusFilter('');
    }
  }, [searchParams]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (actionParam) params.action = actionParam;
      if (userParam) params.user = userParam;
      if (filterParam) params.filter = filterParam;

      const data = await auditService.getLogs(params);
      setLogs(data.items || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [statusFilter, actionParam, userParam, filterParam]);

  const handleFilterClick = (val) => {
    setStatusFilter(val);
    const next = new URLSearchParams(searchParams);
    if (val) {
      next.set('status', val);
    } else {
      next.delete('status');
    }
    setSearchParams(next);
  };

  const handleClearAllFilters = () => {
    setStatusFilter('');
    setSearchParams({});
  };

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await auditService.verifyChain();
      setVerificationResult(res);
    } catch (err) {
      alert('Verification request failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleExportCheckpoint = async () => {
    try {
      const checkpoint = await auditService.exportCheckpoint();
      const blob = new Blob([JSON.stringify(checkpoint, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `trustvault_checkpoint_seq_${checkpoint.sequence_number}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Checkpoint export failed.');
    }
  };

  const hasActiveFilters = Boolean(statusFilter || actionParam || filterParam || userParam);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Tamper-Evident Audit Trail
          </h1>
          <p className="text-xs text-[#334155] dark:text-slate-400 mt-1 font-mono">
            SHA-256 hash chain · Serialized sequence · Cryptographically linked · Append-only
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleExportCheckpoint}
              className="inline-flex items-center space-x-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 transition-all duration-200"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Checkpoint</span>
            </button>
            <button
              onClick={handleVerifyChain}
              disabled={verifying}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-300 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
              <span>{verifying ? 'Verifying Chain...' : 'Verify Chain'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Verification Banner */}
      {verificationResult && (
        <div
          className={`p-4 rounded-2xl border flex items-start space-x-3 text-xs leading-relaxed transition-all duration-300 ${
            verificationResult.valid
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 shadow-sm'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300 shadow-sm'
          }`}
        >
          {verificationResult.valid ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <span className="font-bold">
              {verificationResult.valid
                ? `✓ Cryptographic Chain Fully Intact — ${verificationResult.total_events} events checked`
                : `✗ CHAIN TAMPERING DETECTED at sequence #${verificationResult.broken_at_sequence}`}
            </span>
            <p className="mt-1 text-[11px] font-mono text-slate-600 dark:text-slate-400">
              Head Hash: <span className="text-slate-900 dark:text-slate-300 font-semibold">{verificationResult.head_hash || '—'}</span>
            </p>
            {verificationResult.reason && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-semibold">{verificationResult.reason}</p>
            )}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white dark:bg-white/[0.02] backdrop-blur-2xl border border-slate-200 dark:border-white/[0.06] rounded-2xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm dark:shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-[#0f172a] dark:text-slate-400 uppercase tracking-wider text-[10px] font-mono">
            Filter
          </span>
          <div className="flex space-x-1.5">
            {[['', 'All Events'], ['success', 'Success'], ['denied', 'Denied']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => handleFilterClick(val)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  statusFilter === val
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Active Contextual Filter Badges */}
          {actionParam && (
            <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 font-semibold inline-flex items-center space-x-1">
              <span>Action: {actionParam}</span>
              <button
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('action');
                  setSearchParams(next);
                }}
                className="ml-1 text-slate-500 hover:text-rose-500"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {filterParam === 'recent' && (
            <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 font-semibold inline-flex items-center space-x-1">
              <span>Past 7 Days</span>
              <button
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('filter');
                  setSearchParams(next);
                }}
                className="ml-1 text-slate-500 hover:text-rose-500"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {hasActiveFilters && (
            <button
              onClick={handleClearAllFilters}
              className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 underline ml-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        <span className="font-mono text-xs text-slate-800 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.03] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/5 font-semibold whitespace-nowrap self-start md:self-auto">
          {logs.length} logged events
        </span>
      </div>

      {/* Audit Log Table Container */}
      <div className="bg-white dark:bg-white/[0.02] backdrop-blur-2xl border border-slate-200 dark:border-white/[0.06] rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#475569] dark:text-slate-400 font-mono">
            Loading verifiable records...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No audit events found
            </p>
            <p className="text-xs text-[#475569] dark:text-slate-500 font-mono">
              {actionParam === 'download'
                ? 'No download events have been logged for this account.'
                : filterParam === 'recent'
                ? 'No audit activity recorded in the past 7 days.'
                : statusFilter
                ? `No audit events with status "${statusFilter}" found.`
                : 'No recorded audit trail events found.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleClearAllFilters}
                className="mt-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition duration-200"
              >
                View All Audit Events
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/[0.04] bg-slate-50 dark:bg-white/[0.01]">
                  <th className="py-3.5 px-5 text-[10px] font-bold uppercase tracking-widest text-[#0f172a] dark:text-slate-400 font-mono">
                    Seq
                  </th>
                  <th className="py-3.5 px-5 text-[10px] font-bold uppercase tracking-widest text-[#0f172a] dark:text-slate-400 font-mono">
                    Action
                  </th>
                  <th className="py-3.5 px-5 text-[10px] font-bold uppercase tracking-widest text-[#0f172a] dark:text-slate-400 font-mono">
                    Status
                  </th>
                  <th className="py-3.5 px-5 text-[10px] font-bold uppercase tracking-widest text-[#0f172a] dark:text-slate-400 font-mono">
                    Actor
                  </th>
                  <th className="py-3.5 px-5 text-[10px] font-bold uppercase tracking-widest text-[#0f172a] dark:text-slate-400 font-mono">
                    Timestamp (UTC)
                  </th>
                  <th className="py-3.5 px-5 text-[10px] font-bold uppercase tracking-widest text-[#0f172a] dark:text-slate-400 font-mono">
                    SHA-256 Chain Link
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {logs.map((log, idx) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors duration-150"
                  >
                    {/* Seq with connected chain */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center space-x-2">
                        <div className="relative flex flex-col items-center">
                          {idx < logs.length - 1 && (
                            <div className="absolute top-5 w-px h-full bg-indigo-500/20" />
                          )}
                          <div className="w-6 h-6 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-[10px] font-mono font-bold text-indigo-700 dark:text-indigo-400 z-10">
                            {log.sequence_number}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-slate-200">{log.action}</td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${statusBadge[log.status] || statusBadge.failed}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-800 dark:text-slate-300 font-medium">
                      {log.actor_name || log.actor_email || <span className="text-slate-400 italic">Anonymous</span>}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-[#334155] dark:text-slate-400">
                      {new Date(log.occurred_at).toISOString().replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="space-y-1 font-mono text-[10px]">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-500">prev:</span>
                          <span className="text-[#334155] dark:text-slate-400 font-mono text-xs bg-slate-100 dark:bg-white/[0.03] px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/5">
                            {log.previous_hash.substring(0, 12)}…
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <LinkIcon className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                          <span className="text-indigo-700 dark:text-indigo-400 font-mono text-xs bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                            {log.event_hash.substring(0, 12)}…
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
