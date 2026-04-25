import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Folder, FileText, Download, Trash2, Upload, RefreshCw,
  ChevronRight, Loader2, AlertCircle, Home, X
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

interface SftpEntry {
  name: string;
  fullPath: string;
  isDirectory: boolean;
  size: number;
  lastModified: string;
}

interface TerminalFileManagerProps {
  bookingId: string;
  terminalToken: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function parentOf(path: string): string {
  const trimmed = path.replace(/\/$/, '');
  const idx = trimmed.lastIndexOf('/');
  if (idx <= 0) return '/';
  return trimmed.substring(0, idx);
}

function buildBreadcrumbs(path: string): { label: string; path: string }[] {
  const segments = path.replace(/\/$/, '').split('/').filter(Boolean);
  const crumbs: { label: string; path: string }[] = [{ label: '/', path: '/' }];
  let accumulated = '';
  for (const seg of segments) {
    accumulated += '/' + seg;
    crumbs.push({ label: seg, path: accumulated });
  }
  return crumbs;
}

const TerminalFileManager: React.FC<TerminalFileManagerProps> = ({ bookingId, terminalToken }) => {
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<SftpEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SftpEntry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const baseUrl = (API_BASE_URL || '').replace(/\/$/, '');
  const filesBase = `${baseUrl}/api/terminal/bookings/${bookingId}/files`;
  const authHeader = { Authorization: `Bearer ${terminalToken}` };

  const listDir = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${filesBase}?path=${encodeURIComponent(path)}`, { headers: authHeader });
      if (res.status === 401) throw new Error('Token expired — please close and reopen the terminal.');
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const json = await res.json();
      // Normalize: backend may wrap in { data: [...] } or return array directly
      const data: SftpEntry[] = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
      setEntries(data);
      setCurrentPath(path);
    } catch (err: any) {
      setError(err.message || 'Failed to list directory');
    } finally {
      setLoading(false);
    }
  }, [filesBase, terminalToken]);

  useEffect(() => {
    if (terminalToken) listDir('/');
  }, [terminalToken, listDir]);

  const handleNavigate = (path: string) => listDir(path);

  const handleDownload = async (entry: SftpEntry) => {
    setDownloadingPath(entry.fullPath);
    try {
      const res = await fetch(
        `${filesBase}/download?path=${encodeURIComponent(entry.fullPath)}`,
        { headers: authHeader }
      );
      if (res.status === 401) { setError('Token expired — please close and reopen the terminal.'); return; }
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = entry.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Download failed');
    } finally {
      setDownloadingPath(null);
    }
  };

  const handleDelete = async (entry: SftpEntry) => {
    setConfirmDelete(null);
    setDeletingPath(entry.fullPath);
    try {
      const res = await fetch(
        `${filesBase}?path=${encodeURIComponent(entry.fullPath)}`,
        { method: 'DELETE', headers: authHeader }
      );
      if (res.status === 401) { setError('Token expired — please close and reopen the terminal.'); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Delete failed (${res.status})`);
      }
      await listDir(currentPath);
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    } finally {
      setDeletingPath(null);
    }
  };

  const handleUpload = async (file: File) => {
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', currentPath.endsWith('/') ? currentPath : currentPath + '/');

    try {
      // Use XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${filesBase}/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${terminalToken}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status === 401) reject(new Error('Token expired — please close and reopen the terminal.'));
          else if (xhr.status >= 200 && xhr.status < 300) resolve();
          else {
            try { reject(new Error(JSON.parse(xhr.responseText)?.message || `Upload failed (${xhr.status})`)); }
            catch { reject(new Error(`Upload failed (${xhr.status})`)); }
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed — network error'));
        xhr.send(formData);
      });
      await listDir(currentPath);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const breadcrumbs = buildBreadcrumbs(currentPath);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0f172a',
      color: '#e2e8f0',
      fontSize: '0.82rem',
      overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        flexShrink: 0,
      }}>
        {/* Breadcrumb */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '2px', flexWrap: 'wrap', minWidth: 0 }}>
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.path}>
              {i > 0 && <ChevronRight size={12} style={{ color: '#475569', flexShrink: 0 }} />}
              <button
                onClick={() => handleNavigate(crumb.path)}
                style={{
                  background: 'none', border: 'none', padding: '2px 4px',
                  color: i === breadcrumbs.length - 1 ? '#e2e8f0' : '#64748b',
                  cursor: 'pointer', fontSize: '0.78rem', fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
                  display: 'flex', alignItems: 'center', gap: '3px',
                  borderRadius: '4px',
                }}
                title={crumb.path}
              >
                {i === 0 ? <Home size={12} /> : crumb.label}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Actions */}
        <button
          onClick={() => listDir(currentPath)}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '5px 10px', borderRadius: '6px', border: 'none',
            background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
            cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.75rem',
          }}
          title="Refresh"
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadProgress !== null}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '5px 12px', borderRadius: '6px', border: 'none',
            background: uploadProgress !== null ? 'rgba(14,165,233,0.15)' : '#0ea5e9',
            color: uploadProgress !== null ? '#0ea5e9' : '#fff',
            cursor: uploadProgress !== null ? 'not-allowed' : 'pointer',
            fontWeight: 600, fontSize: '0.75rem',
          }}
        >
          <Upload size={13} />
          {uploadProgress !== null ? `${uploadProgress}%` : 'Upload'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }}
        />
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '7px 12px', background: 'rgba(239,68,68,0.12)',
          borderBottom: '1px solid rgba(239,68,68,0.2)',
          color: '#f87171', fontSize: '0.78rem', flexShrink: 0,
        }}>
          <AlertCircle size={13} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0 2px' }}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* Upload progress bar */}
      {uploadProgress !== null && (
        <div style={{ height: '3px', background: '#1e293b', flexShrink: 0 }}>
          <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#0ea5e9', transition: 'width 0.2s' }} />
        </div>
      )}

      {/* File list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', color: '#475569' }}>
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Loading…</span>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#475569', flexDirection: 'column', gap: '6px' }}>
            <Folder size={28} style={{ opacity: 0.4 }} />
            <span>Empty folder</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, background: '#0f172a', zIndex: 1 }}>
                <th style={{ textAlign: 'left', padding: '6px 12px', color: '#475569', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
                <th style={{ textAlign: 'right', padding: '6px 12px', color: '#475569', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', width: '80px' }}>Size</th>
                <th style={{ textAlign: 'right', padding: '6px 12px', color: '#475569', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', width: '44px' }}></th>
              </tr>
            </thead>
            <tbody>
              {currentPath !== '/' && (
                <tr
                  style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onClick={() => handleNavigate(parentOf(currentPath))}
                >
                  <td style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                    <Folder size={15} style={{ color: '#64748b', flexShrink: 0 }} />
                    <span>..</span>
                  </td>
                  <td />
                  <td />
                </tr>
              )}
              {entries.map((entry) => {
                const isDownloading = downloadingPath === entry.fullPath;
                const isDeleting = deletingPath === entry.fullPath;
                return (
                  <tr
                    key={entry.fullPath}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '7px 12px' }}>
                      <button
                        onClick={() => entry.isDirectory ? handleNavigate(entry.fullPath) : handleDownload(entry)}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          display: 'flex', alignItems: 'center', gap: '8px',
                          color: entry.isDirectory ? '#60a5fa' : '#e2e8f0',
                          cursor: 'pointer', fontSize: '0.82rem',
                          textAlign: 'left', width: '100%',
                        }}
                        title={entry.isDirectory ? `Open ${entry.name}` : `Download ${entry.name}`}
                      >
                        {entry.isDirectory
                          ? <Folder size={15} style={{ color: '#60a5fa', flexShrink: 0 }} />
                          : <FileText size={15} style={{ color: '#94a3b8', flexShrink: 0 }} />
                        }
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.name}
                        </span>
                        {isDownloading && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', marginLeft: 4, flexShrink: 0, color: '#0ea5e9' }} />}
                      </button>
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: '#475569', whiteSpace: 'nowrap' }}>
                      {entry.isDirectory ? '—' : formatSize(entry.size)}
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                      <button
                        onClick={() => setConfirmDelete(entry)}
                        disabled={isDeleting}
                        style={{
                          background: 'none', border: 'none', padding: '3px',
                          color: isDeleting ? '#475569' : '#64748b', cursor: isDeleting ? 'not-allowed' : 'pointer',
                          borderRadius: '4px', display: 'flex', alignItems: 'center',
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => { if (!isDeleting) (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = isDeleting ? '#475569' : '#64748b'; }}
                        title={`Delete ${entry.name}`}
                      >
                        {isDeleting
                          ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                          : <Trash2 size={13} />
                        }
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete confirm dialog */}
      {confirmDelete && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 10,
        }}>
          <div style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: '10px',
            padding: '1.5rem', maxWidth: '340px', width: '90%',
          }}>
            <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: '8px' }}>Delete {confirmDelete.isDirectory ? 'folder' : 'file'}?</div>
            <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '1.2rem', wordBreak: 'break-all' }}>
              {confirmDelete.fullPath}
              {confirmDelete.isDirectory && <div style={{ color: '#f59e0b', marginTop: '6px', fontSize: '0.78rem' }}>Only empty folders can be deleted.</div>}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid #334155', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default TerminalFileManager;
