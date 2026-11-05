import React, { useState, useEffect } from 'react';
import { auditService } from '../services/auditService';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, Download, Link as LinkIcon } from 'lucide-react';

const statusBadge = {
  success: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 shadow-[0_0_8px_rgba(16,185,129,0.2)]',
  denied: 'bg-rose-500/15 text-rose-300 border border-rose-500/25 shadow-[0_0_8px_rgba(239,68,68,0.2)]',
  failed: 'bg-orange-500/15 text-orange-300 border border-orange-500/25 shadow-[0_0_6px_rgba(249,115,22,0.15)]',
};

const AuditLogs = () => {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
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
  }, [statusFilter]);

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Tamper-Evident Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            SHA-256 hash chain · Serialized sequence · Cryptographically linked
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCheckpoint}
              className="inline-flex items-center space-x-2 px-3 py-1.5 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg border border-slate-200 dark:border-white/[0.08] transition-all duration-200 shadow-sm dark:shadow-none"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Checkpoint</span>
            </button>
            <button
              onClick={handleVerifyChain}
              disabled={verifying}
              className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-blue-600/20 transition-all duration-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
              <span>{verifying ? 'Verifying...' : 'Verify Chain'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Verification Banner */}
      {verificationResult && (
        <div
          className={`p-4 rounded-xl border flex items-start space-x-3 text-xs leading-relaxed transition-all duration-300 ${
            verificationResult.valid
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300 shadow-[0_0_20px_rgba(239,68,68,0.1)]'
          }`}
        >
          {verificationResult.valid ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <span className={`font-bold ${verificationResult.valid ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
              {verificationResult.valid
                ? `✓ Hash Chain Fully Verified — ${verificationResult.total_events} events checked`
                : `✗ CHAIN INTEGRITY FAILURE at sequence #${verificationResult.broken_at_sequence}`}
            </span>
            <p className="mt-1 text-[11px] font-mono text-slate-600 dark:text-slate-400">
              Head: {verificationResult.head_hash || '—'}
            </p>
            {verificationResult.reason && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-semibold">{verificationResult.reason}</p>
            )}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl p-3 flex items-center justify-between shadow-sm dark:shadow-none">
        <div className="flex items-center space-x-3 text-xs">
          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Filter</span>
          <div className="flex space-x-1">
            {[['', 'All'], ['success', 'Success'], ['denied', 'Denied']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setStatusFilter(val)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
                  statusFilter === val
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-[10px] text-slate-500 dark:text-slate-600 font-mono">{logs.length} events</span>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden shadow-sm dark:shadow-none">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading audit records...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-transparent">
                  <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Seq</th>
                  <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Action</th>
                  <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Status</th>
                  <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Actor</th>
                  <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Timestamp (UTC)</th>
                  <th className="py-3 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Hash Chain</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-100 dark:border-white/[0.04] hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-all duration-150"
                  >
                    {/* Seq with chain connector */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center space-x-2">
                        <div className="relative flex flex-col items-center">
                          {idx < logs.length - 1 && (
                            <div className="absolute top-4 w-px h-full bg-blue-500/20" />
                          )}
                          <div className="w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-[9px] font-bold text-blue-600 dark:text-blue-400 z-10">
                            {log.sequence_number}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-slate-800 dark:text-slate-300">{log.action}</td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${statusBadge[log.status] || statusBadge.failed}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 dark:text-slate-400">
                      {log.actor_name || log.actor_email || <span className="text-slate-400 dark:text-slate-600 italic">Anonymous</span>}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-slate-500">
                      {new Date(log.occurred_at).toISOString().replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="space-y-0.5 font-mono text-[10px]">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-400 dark:text-slate-600">prev</span>
                          <span className="text-slate-600 dark:text-slate-500">{log.previous_hash.substring(0, 12)}…</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <LinkIcon className="w-2.5 h-2.5 text-blue-500/50" />
                          <span className="text-blue-600 dark:text-blue-400/80">{log.event_hash.substring(0, 12)}…</span>
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

