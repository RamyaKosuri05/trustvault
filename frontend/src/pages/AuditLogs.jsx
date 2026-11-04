import React, { useState, useEffect } from 'react';
import { auditService } from '../services/auditService';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, Download, Lock } from 'lucide-react';

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
          <h1 className="text-xl font-bold text-slate-900">Tamper-Evident Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-1">
            Serialized SHA-256 hash chain covering authorized and denied operations
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportCheckpoint}
              className="inline-flex items-center space-x-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Checkpoint</span>
            </button>
            <button
              onClick={handleVerifyChain}
              disabled={verifying}
              className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
              <span>{verifying ? 'Verifying Hash Chain...' : 'Verify Cryptographic Chain'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Verification Status Banner */}
      {verificationResult && (
        <div
          className={`p-4 rounded-xl border flex items-start space-x-3 text-xs leading-relaxed ${
            verificationResult.valid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {verificationResult.valid ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <span className="font-bold">
              {verificationResult.valid
                ? `Hash Chain Fully Verified (${verificationResult.total_events} events checked)`
                : `CHAIN INTEGRITY FAILURE detected at sequence ${verificationResult.broken_at_sequence}!`}
            </span>
            <p className="mt-0.5 text-[11px] font-mono">
              Head Hash: {verificationResult.head_hash}
            </p>
            {verificationResult.reason && (
              <p className="mt-1 font-semibold text-rose-700">{verificationResult.reason}</p>
            )}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs">
          <span className="font-semibold text-slate-600">Status Filter:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700"
          >
            <option value="">All Events</option>
            <option value="success">Success Only</option>
            <option value="denied">Denied / Security Events</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading audit records...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs text-left">
              <thead className="bg-slate-50 text-slate-400 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Seq #</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Timestamp (UTC)</th>
                  <th className="py-2.5 px-3">SHA-256 Hash Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition font-mono">
                    <td className="py-3 px-3 font-bold text-slate-900 font-sans">
                      #{log.sequence_number}
                    </td>
                    <td className="py-3 px-3 font-sans font-semibold text-slate-800">
                      {log.action}
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.status === 'success'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-600">
                      {log.actor_name || log.actor_email || 'Anonymous / System'}
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-500">
                      {new Date(log.occurred_at).toISOString().replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="py-3 px-3 text-[10px] text-slate-400">
                      <div>prev: {log.previous_hash.substring(0, 10)}...</div>
                      <div className="text-blue-600">curr: {log.event_hash.substring(0, 10)}...</div>
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

