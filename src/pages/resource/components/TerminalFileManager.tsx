import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Folder, FolderOpen, FileText, Download, Trash2, Upload, RefreshCw,
  ChevronRight, Loader2, AlertCircle, Home, X, Plus, FolderPlus,
  Edit3, Save, Eye, CheckCircle2,
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
  privateKey: string;
  /** Only initialise (fetch) the first time this becomes true — lazy loading */
  active?: boolean;
  /** Send a shell command through the live terminal WebSocket */
  onSendCommand?: (cmd: string) => void;
  /** Register a callback that refreshes the current directory listing */
  onRegisterRefresh?: (fn: () => void) => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function parentOf(path: string): string {
  const trimmed = path.replace(/\/$/, '');
  const idx = trimmed.lastIndexOf('/');
  if (idx <= 0) return '/';
  return trimmed.substring(0, idx);
}

function buildBreadcrumbs(path: string): { label: string; path: string }[] {
  const segments = path.replace(/\/$/, '').split('/').filter(Boolean);
  const crumbs: { label: string; path: string }[] = [{ label: 'root', path: '/' }];
  let accumulated = '';
  for (const seg of segments) {
    accumulated += '/' + seg;
    crumbs.push({ label: seg, path: accumulated });
  }
  return crumbs;
}

function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['py', 'js', 'ts', 'tsx', 'sh', 'bash', 'json', 'yaml', 'yml', 'toml', 'cfg', 'ini'].includes(ext)) return '#60a5fa';
  if (['csv', 'tsv', 'parquet', 'h5', 'hdf5', 'npy', 'npz'].includes(ext)) return '#34d399';
  if (['pt', 'pth', 'ckpt', 'safetensors', 'bin', 'onnx', 'pb'].includes(ext)) return '#a78bfa';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return '#f9a8d4';
  if (['zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar'].includes(ext)) return '#fbbf24';
  if (['log', 'txt', 'md'].includes(ext)) return '#94a3b8';
  return '#64748b';
}

/** Returns true for file types that can be opened and edited as plain text */
const TEXT_EXTENSIONS = new Set([
  'py', 'js', 'ts', 'tsx', 'jsx', 'sh', 'bash', 'zsh',
  'json', 'yaml', 'yml', 'toml', 'cfg', 'ini', 'conf', 'env',
  'txt', 'md', 'markdown', 'log', 'csv', 'tsv',
  'html', 'css', 'scss', 'xml', 'sql', 'r', 'jl', 'rs', 'go',
  'c', 'cpp', 'h', 'hpp', 'java', 'kt', 'swift', 'php', 'rb',
  'dockerfile', 'makefile', 'gitignore', 'editorconfig',
]);

function isTextFile(name: string): boolean {
  const lower = name.toLowerCase();
  // Files with no extension that are commonly text (Dockerfile, Makefile, etc.)
  const noExtNames = ['dockerfile', 'makefile', '.gitignore', '.env', '.editorconfig', '.bashrc', '.zshrc', 'readme', 'license'];
  if (noExtNames.some(n => lower.endsWith(n))) return true;
  const ext = lower.split('.').pop() ?? '';
  return TEXT_EXTENSIONS.has(ext);
}

/* -- File Editor Modal ---------------------------------- */
interface FileEditorModalProps {
  entry: SftpEntry;
  filesBase: string;
  authHeader: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}

const FileEditorModal: React.FC<FileEditorModalProps> = ({ entry, filesBase, authHeader, onClose, onSaved }) => {
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch file content on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${filesBase}/download?path=${encodeURIComponent(entry.fullPath)}`, { headers: authHeader })
      .then(async res => {
        if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
        const blob = await res.blob();
        const text = await blob.text();
        if (!cancelled) {
          setContent(text);
          setOriginalContent(text);
        }
      })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load file'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entry.fullPath]);

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [content]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const dir = entry.fullPath.substring(0, entry.fullPath.lastIndexOf('/') + 1) || '/';
      const blob = new Blob([content], { type: 'text/plain' });
      const file = new File([blob], entry.name, { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', dir);
      const res = await fetch(`${filesBase}/upload`, {
        method: 'POST',
        headers: authHeader,
        body: formData,
      });
      if (res.status === 401) throw new Error('Token expired.');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Save failed (${res.status})`);
      }
      setOriginalContent(content);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const isDirty = content !== originalContent;
  const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
  const lineCount = content.split('\n').length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#0d1b2e',
        border: '1px solid #1e3a5f',
        borderRadius: '14px',
        width: '100%', maxWidth: '860px',
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 18px',
          background: '#0a1525',
          borderBottom: '1px solid #1e293b',
          flexShrink: 0,
        }}>
          <Edit3 size={15} style={{ color: '#818cf8', flexShrink: 0 }} />
          <span style={{
            flex: 1, color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {entry.fullPath}
          </span>
          {isDirty && (
            <span style={{
              fontSize: '0.7rem', color: '#fbbf24', background: 'rgba(251,191,36,0.1)',
              padding: '2px 8px', borderRadius: '20px', fontWeight: 600, flexShrink: 0,
            }}>unsaved</span>
          )}
          {saveSuccess && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '0.7rem', color: '#34d399', background: 'rgba(52,211,153,0.1)',
              padding: '2px 8px', borderRadius: '20px', fontWeight: 600, flexShrink: 0,
            }}><CheckCircle2 size={11} /> saved</span>
          )}
          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || loading || !isDirty}
            title="Save (Ctrl+S)"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 14px', borderRadius: '7px',
              border: 'none',
              background: isDirty ? '#6366f1' : 'rgba(99,102,241,0.15)',
              color: isDirty ? '#fff' : '#4b5563',
              cursor: (saving || loading || !isDirty) ? 'not-allowed' : 'pointer',
              fontSize: '0.78rem', fontWeight: 600,
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            {saving
              ? <Loader2 size={12} style={{ animation: 'fmSpin 0.8s linear infinite' }} />
              : <Save size={12} />}
            Save
          </button>
          {/* Close button */}
          <button
            onClick={() => {
              if (isDirty && !window.confirm('You have unsaved changes. Close anyway?')) return;
              onClose();
            }}
            style={{
              display: 'flex', alignItems: 'center', padding: '5px',
              borderRadius: '6px', border: 'none',
              background: 'rgba(255,255,255,0.05)',
              color: '#64748b', cursor: 'pointer',
              transition: 'color 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
          >
            <X size={15} />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 18px',
            background: 'rgba(239,68,68,0.09)',
            borderBottom: '1px solid rgba(239,68,68,0.12)',
            color: '#f87171', fontSize: '0.78rem', flexShrink: 0,
          }}>
            <AlertCircle size={13} />
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>
              <X size={13} />
            </button>
          </div>
        )}

        {/* Editor area */}
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#334155' }}>
            <Loader2 size={18} style={{ animation: 'fmSpin 0.8s linear infinite' }} />
            <span style={{ fontSize: '0.85rem' }}>Loading file…</span>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
            {/* Line numbers */}
            <div style={{
              padding: '14px 10px 14px 14px',
              background: '#080f1c',
              borderRight: '1px solid #1e293b',
              color: '#1e3a5f',
              fontSize: '0.75rem',
              lineHeight: '1.6',
              fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
              userSelect: 'none',
              overflowY: 'hidden',
              textAlign: 'right',
              minWidth: '44px',
              flexShrink: 0,
            }}>
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i + 1}>{i + 1}</div>
              ))}
            </div>
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1,
                padding: '14px 18px',
                background: '#0d1b2e',
                color: '#e2e8f0',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
                fontSize: '0.82rem',
                lineHeight: '1.6',
                overflowY: 'auto',
                whiteSpace: 'pre',
                overflowX: 'auto',
                tabSize: 2,
              }}
              onKeyDown={e => {
                // Tab inserts spaces
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const start = e.currentTarget.selectionStart;
                  const end = e.currentTarget.selectionEnd;
                  const spaces = '  ';
                  setContent(prev => prev.substring(0, start) + spaces + prev.substring(end));
                  requestAnimationFrame(() => {
                    if (textareaRef.current) {
                      textareaRef.current.selectionStart = start + spaces.length;
                      textareaRef.current.selectionEnd = start + spaces.length;
                    }
                  });
                }
              }}
            />
          </div>
        )}

        {/* Footer / status bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 18px',
          background: '#0a1525',
          borderTop: '1px solid #0f172a',
          flexShrink: 0,
          color: '#1e3a5f', fontSize: '0.68rem',
        }}>
          <span>{ext.toUpperCase() || 'TEXT'}</span>
          <span>{lineCount} lines · {content.length} chars</span>
        </div>
      </div>
    </div>
  );
};

/* -- Inline name-input for create ---------------------- */
const InlineInput: React.FC<{
  placeholder: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  icon: React.ReactNode;
}> = ({ placeholder, onConfirm, onCancel, icon }) => {
  const [val, setVal] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '6px 14px', background: 'rgba(99,102,241,0.07)',
      borderBottom: '1px solid rgba(99,102,241,0.18)',
    }}>
      <span style={{ color: '#818cf8', flexShrink: 0 }}>{icon}</span>
      <input
        ref={ref}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && val.trim()) onConfirm(val.trim());
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={placeholder}
        style={{
          flex: 1, background: 'none', border: 'none', outline: 'none',
          color: '#e2e8f0', fontSize: '0.82rem', fontFamily: 'inherit',
        }}
      />
      <button
        onClick={() => val.trim() && onConfirm(val.trim())}
        disabled={!val.trim()}
        style={{
          background: '#6366f1', border: 'none', borderRadius: '5px',
          padding: '3px 10px', color: '#fff',
          cursor: val.trim() ? 'pointer' : 'not-allowed',
          fontSize: '0.75rem', fontWeight: 600, opacity: val.trim() ? 1 : 0.4,
        }}
      >Create</button>
      <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '3px' }}>
        <X size={13} />
      </button>
    </div>
  );
};

const TerminalFileManager: React.FC<TerminalFileManagerProps> = ({ bookingId, terminalToken, privateKey, active, onSendCommand, onRegisterRefresh }) => {
  const [initialized, setInitialized] = useState(false);
  const [currentPath, setCurrentPath] = useState('/home');
  const [entries, setEntries] = useState<SftpEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SftpEntry | null>(null);
  const [creating, setCreating] = useState<'folder' | null>(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<SftpEntry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);

  const baseUrl = (API_BASE_URL || '').replace(/\/$/, '');
  const filesBase = `${baseUrl}/api/terminal/bookings/${bookingId}/files`;
  // Replace actual newlines with literal \n as required by the X-Private-Key header spec
  const authHeader = {
    Authorization: `Bearer ${terminalToken}`,
    'X-Private-Key': privateKey.replace(/\n/g, '\\n'),
  };

  // -- Lazy init: only start on first active=true --------
  useEffect(() => {
    if (active && !initialized) setInitialized(true);
  }, [active]);

  // -- Close new-menu on outside click ------------------
  useEffect(() => {
    if (!newMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) setNewMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [newMenuOpen]);

  // -- List directory ------------------------------------
  const listDir = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setCreating(null);
    try {
      const res = await fetch(`${filesBase}?path=${encodeURIComponent(path)}`, { headers: authHeader });
      if (res.status === 401) throw new Error('Token expired -- please reopen the terminal.');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Server error (${res.status})`);
      }
      const json = await res.json();
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
    if (initialized) listDir('/home');
  }, [initialized]);

  // Register refresh callback for parent
  useEffect(() => {
    onRegisterRefresh?.(() => listDir(currentPath));
  }, [currentPath, listDir]);

  // -- Upload helper -------------------------------------
  const doUpload = useCallback(async (file: File, destPath: string) => {
    if (file.size === 0) { setError('Cannot upload an empty file (0 bytes).'); return; }
    setUploadProgress(0);
    const formData = new FormData();
    const uploadPath = destPath.endsWith('/') ? destPath : destPath + '/';
    formData.append('file', file);
    formData.append('path', uploadPath);
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${filesBase}/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${terminalToken}`);
        xhr.setRequestHeader('X-Private-Key', privateKey.replace(/\n/g, '\\n'));
        xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100)); };
        xhr.onload = () => {
          if (xhr.status === 401) reject(new Error('Token expired.'));
          else if (xhr.status >= 200 && xhr.status < 300) resolve();
          else {
            try { reject(new Error(JSON.parse(xhr.responseText)?.message || `Upload failed (${xhr.status})`)); }
            catch { reject(new Error(`Upload failed (${xhr.status})`)); }
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed -- network error'));
        xhr.send(formData);
      });
      await listDir(currentPath);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [filesBase, terminalToken, privateKey, currentPath, listDir]);

  // -- Folder Upload ------------------------------------
  const doFolderUpload = useCallback(async (files: FileList) => {
    if (!files.length) return;
    setUploadProgress(0);
    const dest = currentPath.endsWith('/') ? currentPath : currentPath + '/';
    const formData = new FormData();
    formData.append('destination', dest);
    for (const file of Array.from(files)) {
      formData.append('files', file);
      formData.append('paths', (file as any).webkitRelativePath || file.name);
    }
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${filesBase}/upload-folder`);
        xhr.setRequestHeader('Authorization', `Bearer ${terminalToken}`);
        xhr.setRequestHeader('X-Private-Key', privateKey.replace(/\n/g, '\\n'));
        xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100)); };
        xhr.onload = () => {
          if (xhr.status === 401) reject(new Error('Token expired.'));
          else if (xhr.status >= 200 && xhr.status < 300) resolve();
          else {
            try { reject(new Error(JSON.parse(xhr.responseText)?.message || `Upload failed (${xhr.status})`)); }
            catch { reject(new Error(`Upload failed (${xhr.status})`)); }
          }
        };
        xhr.onerror = () => reject(new Error('Folder upload failed -- network error'));
        xhr.send(formData);
      });
      await listDir(currentPath);
    } catch (err: any) {
      setError(err.message || 'Folder upload failed');
    } finally {
      setUploadProgress(null);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  }, [filesBase, terminalToken, privateKey, currentPath, listDir]);

  // -- Download ------------------------------------------
  const handleDownload = async (entry: SftpEntry) => {
    setDownloadingPath(entry.fullPath);
    try {
      const res = await fetch(`${filesBase}/download?path=${encodeURIComponent(entry.fullPath)}`, { headers: authHeader });
      if (res.status === 401) { setError('Token expired.'); return; }
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const rawBlob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const fileName = disposition.match(/filename="?([^";\n]+)"?/)?.[1] ?? entry.name;
      const blob = entry.isDirectory ? new Blob([rawBlob], { type: 'application/zip' }) : rawBlob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Download failed');
    } finally {
      setDownloadingPath(null);
    }
  };

  // -- Delete --------------------------------------------
  const handleDelete = async (entry: SftpEntry) => {
    setConfirmDelete(null);
    setDeletingPath(entry.fullPath);
    try {
      const res = await fetch(`${filesBase}?path=${encodeURIComponent(entry.fullPath)}`, { method: 'DELETE', headers: authHeader });
      if (res.status === 401) { setError('Token expired.'); return; }
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

  // - Create folder: send mkdir via terminal -
  const handleCreateFolder = (name: string) => {
    setCreating(null);
    const folderPath = (currentPath.endsWith('/') ? currentPath : currentPath + '/') + name;
    if (onSendCommand) {
      onSendCommand(`mkdir -p ${folderPath}\n`);
    }
  };

  const crumbs = buildBreadcrumbs(currentPath);

  // -- Not activated yet ---------------------------------
  if (!initialized) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '10px', color: '#334155', background: '#0c1628', width: '100%',
      }}>
        <FolderOpen size={36} style={{ opacity: 0.25 }} />
        <span style={{ fontSize: '0.8rem' }}>Click the Files tab to browse</span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', width: '100%',
      background: '#0c1628', color: '#e2e8f0', fontSize: '0.82rem', overflow: 'hidden',
      position: 'relative',
    }}>
      {/* -- Toolbar ---------------------------------------- */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '7px 12px', background: '#0a111f',
        borderBottom: '1px solid #1e293b', flexShrink: 0,
      }}>
        {/* Breadcrumb */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1px', minWidth: 0, overflow: 'hidden' }}>
          {crumbs.map((crumb, i) => (
            <React.Fragment key={crumb.path}>
              {i > 0 && <ChevronRight size={10} style={{ color: '#1e293b', flexShrink: 0 }} />}
              <button
                onClick={() => listDir(crumb.path)}
                title={crumb.path}
                style={{
                  background: 'none', border: 'none', padding: '2px 5px',
                  color: i === crumbs.length - 1 ? '#7dd3fc' : '#334155',
                  cursor: 'pointer', fontSize: '0.75rem',
                  fontWeight: i === crumbs.length - 1 ? 600 : 400,
                  display: 'flex', alignItems: 'center', gap: '3px',
                  borderRadius: '4px', whiteSpace: 'nowrap',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
                onMouseLeave={e => (e.currentTarget.style.color = i === crumbs.length - 1 ? '#7dd3fc' : '#334155')}
              >
                {i === 0 ? <Home size={11} /> : crumb.label}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={() => listDir(currentPath)} disabled={loading} title="Refresh"
          style={{
            display: 'flex', alignItems: 'center', padding: '5px 7px',
            borderRadius: '6px', border: 'none', background: 'rgba(255,255,255,0.04)',
            color: '#334155', cursor: loading ? 'not-allowed' : 'pointer', transition: 'color 0.15s',
          }}
          onMouseEnter={e => { if (!loading) (e.currentTarget.style.color = '#94a3b8'); }}
          onMouseLeave={e => (e.currentTarget.style.color = '#334155')}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'fmSpin 0.8s linear infinite' : 'none' }} />
        </button>

        {/* + New dropdown */}
        <div style={{ position: 'relative' }} ref={newMenuRef}>
          <button
            onClick={() => setNewMenuOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 11px', borderRadius: '6px',
              border: '1px solid rgba(99,102,241,0.25)',
              background: newMenuOpen ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.08)',
              color: '#818cf8', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem',
              transition: 'all 0.15s',
            }}
          >
            <Plus size={13} /> New
          </button>
          {newMenuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', right: 0,
              background: '#1e293b', border: '1px solid #334155', borderRadius: '8px',
              minWidth: '158px', zIndex: 50, overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              <button onClick={() => { setCreating('folder'); setNewMenuOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', padding: '8px 13px', background: 'none', border: 'none',
                color: '#e2e8f0', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left',
                transition: 'background 0.1s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ color: '#818cf8' }}><FolderPlus size={13} /></span> New Folder
              </button>
              <div style={{ height: '1px', background: '#334155', margin: '2px 8px' }} />
              <button onClick={() => { fileInputRef.current?.click(); setNewMenuOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', padding: '8px 13px', background: 'none', border: 'none',
                color: '#e2e8f0', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left',
                transition: 'background 0.1s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ color: '#0ea5e9' }}><Upload size={13} /></span> Upload File
              </button>
              <button onClick={() => { folderInputRef.current?.click(); setNewMenuOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', padding: '8px 13px', background: 'none', border: 'none',
                color: '#e2e8f0', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'left',
                transition: 'background 0.1s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ color: '#a78bfa' }}><FolderOpen size={13} /></span> Upload Folder
              </button>
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.[0]) doUpload(e.target.files[0], currentPath); }} />
        <input ref={folderInputRef} type="file" style={{ display: 'none' }}
          // @ts-ignore — webkitdirectory is non-standard but widely supported
          webkitdirectory=""
          onChange={e => { if (e.target.files?.length) doFolderUpload(e.target.files); }} />
      </div>

      {/* Upload progress bar */}
      {uploadProgress !== null && (
        <div style={{ height: '2px', background: '#1e293b', flexShrink: 0 }}>
          <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'linear-gradient(90deg,#6366f1,#0ea5e9)', transition: 'width 0.2s' }} />
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px',
          background: 'rgba(239,68,68,0.09)', borderBottom: '1px solid rgba(239,68,68,0.12)',
          color: '#f87171', fontSize: '0.78rem', flexShrink: 0,
        }}>
          <AlertCircle size={13} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* Inline create inputs */}
      {creating === 'folder' && (
        <InlineInput placeholder="Folder name" icon={<FolderPlus size={14} />}
          onConfirm={handleCreateFolder} onCancel={() => setCreating(null)} />
      )}

      {/* -- Column headers -------------------------------- */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 90px 140px 64px',
        padding: '5px 14px', borderBottom: '1px solid #1e293b',
        color: '#1e293b', fontSize: '0.68rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0,
        background: '#0a111f',
      }}>
        <span>Name</span>
        <span style={{ textAlign: 'right' }}>Size</span>
        <span style={{ textAlign: 'right' }}>Modified</span>
        <span />
      </div>

      {/* -- File list ------------------------------------- */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', gap: '8px', color: '#334155' }}>
            <Loader2 size={16} style={{ animation: 'fmSpin 0.8s linear infinite' }} />
            <span>Loading…</span>
          </div>
        ) : entries.length === 0 && currentPath === '/' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', color: '#1e293b', flexDirection: 'column', gap: '8px' }}>
            <Folder size={28} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: '0.8rem' }}>Empty folder</span>
          </div>
        ) : (
          <>
            {currentPath !== '/' && (
              <div
                onClick={() => listDir(parentOf(currentPath))}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 90px 140px 64px',
                  alignItems: 'center', padding: '6px 14px',
                  cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.02)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: '#334155' }}>
                  <Folder size={14} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem' }}>..</span>
                </div>
              </div>
            )}
            {entries.map(entry => {
              const isDownloading = downloadingPath === entry.fullPath;
              const isDeleting    = deletingPath === entry.fullPath;
              const isHovered     = hoveredPath === entry.fullPath;
              return (
                <div
                  key={entry.fullPath}
                  onMouseEnter={() => setHoveredPath(entry.fullPath)}
                  onMouseLeave={() => setHoveredPath(null)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 90px 140px 64px',
                    alignItems: 'center', padding: '6px 14px',
                    background: isHovered ? 'rgba(255,255,255,0.035)' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.025)',
                    transition: 'background 0.1s',
                  }}
                >
                  {/* Name */}
                  <button
                    onClick={() => {
                      if (entry.isDirectory) { listDir(entry.fullPath); return; }
                      if (isTextFile(entry.name)) { setEditingEntry(entry); return; }
                      handleDownload(entry);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '9px',
                      background: 'none', border: 'none', padding: 0, textAlign: 'left',
                      color: entry.isDirectory ? '#e2e8f0' : '#94a3b8',
                      cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit',
                      minWidth: 0,
                    }}
                    title={
                      entry.isDirectory
                        ? `Open ${entry.fullPath}`
                        : isTextFile(entry.name)
                          ? `Edit ${entry.name}`
                          : `Download ${entry.name}`
                    }
                  >
                    {entry.isDirectory
                      ? (isHovered
                          ? <FolderOpen size={15} style={{ color: '#fbbf24', flexShrink: 0 }} />
                          : <Folder    size={15} style={{ color: '#d97706', flexShrink: 0 }} />)
                      : <FileText size={15} style={{ color: getFileColor(entry.name), flexShrink: 0 }} />
                    }
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.name}
                    </span>
                    {isDownloading && <Loader2 size={11} style={{ animation: 'fmSpin 0.8s linear infinite', color: '#0ea5e9', flexShrink: 0, marginLeft: 4 }} />}
                  </button>

                  {/* Size */}
                  <span style={{ textAlign: 'right', color: '#334155', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                    {entry.isDirectory ? '' : formatSize(entry.size)}
                  </span>

                  {/* Modified */}
                  <span style={{ textAlign: 'right', color: '#1e3a5f', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                    {formatDate(entry.lastModified)}
                  </span>

                  {/* Actions */}
                  <div style={{
                    display: 'flex', gap: '4px', justifyContent: 'flex-end',
                    opacity: isHovered ? 1 : 0, transition: 'opacity 0.12s',
                  }}>
                    {/* Open/Edit button for text files */}
                    {!entry.isDirectory && isTextFile(entry.name) && (
                      <button
                        onClick={() => setEditingEntry(entry)}
                        title="Edit file"
                        style={{
                          display: 'flex', alignItems: 'center', padding: '3px 5px',
                          borderRadius: '5px', border: 'none',
                          background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                          cursor: 'pointer',
                        }}
                      >
                        <Edit3 size={11} />
                      </button>
                    )}
                    {/* Download button */}
                    <button
                      onClick={() => handleDownload(entry)} disabled={isDownloading} title={entry.isDirectory ? 'Download as zip' : 'Download'}
                      style={{
                        display: 'flex', alignItems: 'center', padding: '3px 5px',
                        borderRadius: '5px', border: 'none',
                        background: 'rgba(14,165,233,0.12)', color: '#38bdf8',
                        cursor: isDownloading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isDownloading
                        ? <Loader2 size={11} style={{ animation: 'fmSpin 0.8s linear infinite' }} />
                        : <Download size={11} />
                      }
                    </button>
                    <button
                      onClick={() => setConfirmDelete(entry)} disabled={isDeleting} title="Delete"
                      style={{
                        display: 'flex', alignItems: 'center', padding: '3px 5px',
                        borderRadius: '5px', border: 'none',
                        background: 'rgba(239,68,68,0.1)', color: '#f87171',
                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isDeleting
                        ? <Loader2 size={11} style={{ animation: 'fmSpin 0.8s linear infinite' }} />
                        : <Trash2 size={11} />
                      }
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '3px 14px', background: '#0a111f',
        borderTop: '1px solid #0f172a', flexShrink: 0,
        color: '#1e3a5f', fontSize: '0.68rem',
      }}>
        <span>{entries.length} item{entries.length !== 1 ? 's' : ''}</span>
        {uploadProgress !== null && <span style={{ color: '#6366f1' }}>Uploading {uploadProgress}%…</span>}
      </div>

      {/* -- File Editor Modal ----------------------------- */}
      {editingEntry && (
        <FileEditorModal
          entry={editingEntry}
          filesBase={filesBase}
          authHeader={authHeader}
          onClose={() => setEditingEntry(null)}
          onSaved={() => listDir(currentPath)}
        />
      )}

      {/* -- Delete confirm overlay ------------------------- */}
      {confirmDelete && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30,
        }}>
          <div style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
            padding: '1.4rem 1.6rem', maxWidth: '360px', width: '90%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={15} style={{ color: '#ef4444' }} />
              </div>
              <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.9rem' }}>
                Delete {confirmDelete.isDirectory ? 'folder' : 'file'}?
              </span>
            </div>
            <code style={{ display: 'block', background: 'rgba(255,255,255,0.05)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.76rem', color: '#94a3b8', wordBreak: 'break-all', marginBottom: 8 }}>
              {confirmDelete.fullPath}
            </code>
            {confirmDelete.isDirectory && (
              <p style={{ color: '#fbbf24', fontSize: '0.75rem', margin: '6px 0 0' }}>
                Warning: Only empty folders can be deleted.
              </p>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '6px 16px', borderRadius: '7px', border: '1px solid #334155', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem' }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ padding: '6px 16px', borderRadius: '7px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes fmSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default TerminalFileManager;
