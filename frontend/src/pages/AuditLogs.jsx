import React, { useState, useEffect } from 'react';
import { auditService } from '../services/auditService';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, Download, Link as LinkIcon, Shield } from 'lucide-react';

const statusBadge = {
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  denied: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  failed: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
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
          <h1 className="text-2xl font-semibold text-white tracking-tight">Tamper-Evident Audit Trail</h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            SHA-256 hash chain · Serialized sequence · Cryptographically linked · Append-only
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleExportCheckpoint}
              className="inline-flex items-center space-x-2 px-3.5 py-2 bg-white/[0.03] hover:bg-white/[0.06] text-slate-300 text-xs font-semibold rounded-xl border border-white/10 transition-all duration-200"
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
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300 shadow-[0_0_20px_rgba(239,68,68,0.1)]'
          }`}
        >
          {verificationResult.valid ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <span className="font-bold">
              {verificationResult.valid
                ? `✓ Cryptographic Chain Fully Intact — ${verificationResult.total_events} events checked`
                : `✗ CHAIN TAMPERING DETECTED at sequence #${verificationResult.broken_at_sequence}`}
            </span>
            <p className="mt-1 text-[11px] font-mono text-slate-400">
              Head Hash: <span className="text-slate-300">{verificationResult.head_hash || '—'}</span>
            </p>
            {verificationResult.reason && (
              <p className="mt-1 text-xs text-rose-400 font-semibold">{verificationResult.reason}</p>
            )}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.06] rounded-2xl p-3 flex items-center justify-between shadow-2xl">
        <div className="flex items-center space-x-3 text-xs">
          <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] font-mono">Filter</span>
          <div className="flex space-x-1.5">
            {[['', 'All Events'], ['success', 'Success'], ['denied', 'Denied']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setStatusFilter(val)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  statusFilter === val
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <span className="font-mono text-xs text-slate-300 bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/5">
          {logs.length} logged events
        </span>
      </div>

      {/* Audit Log Table Container */}
      <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 font-mono">Loading verifiable records...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                  <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-mono">Seq</th>
                  <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-mono">Action</th>
                  <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-mono">Status</th>
                  <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-mono">Actor</th>
                  <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-mono">Timestamp (UTC)</th>
                  <th className="py-3.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-mono">SHA-256 Chain Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {logs.map((log, idx) => (
                  <tr
                    key={log.id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors duration-150"
                  >
                    {/* Seq with connected chain */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center space-x-2">
                        <div className="relative flex flex-col items-center">
                          {idx < logs.length - 1 && (
                            <div className="absolute top-5 w-px h-full bg-indigo-500/20" />
                          )}
                          <div className="w-6 h-6 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-[10px] font-mono font-bold text-indigo-400 z-10">
                            {log.sequence_number}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-slate-200">{log.action}</td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${statusBadge[log.status] || statusBadge.failed}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-300">
                      {log.actor_name || log.actor_email || <span className="text-slate-500 italic">Anonymous</span>}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-slate-400">
                      {new Date(log.occurred_at).toISOString().replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="space-y-1 font-mono text-[10px]">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-500">prev:</span>
                          <span className="text-slate-400 font-mono text-xs bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/5">
                            {log.previous_hash.substring(0, 12)}…
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <LinkIcon className="w-2.5 h-2.5 text-indigo-400" />
                          <span className="text-indigo-400 font-mono text-xs bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
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
