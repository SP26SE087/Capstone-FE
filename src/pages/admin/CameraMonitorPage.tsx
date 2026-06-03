import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MainLayout from '@/layout/MainLayout';
import Modal from '@/components/common/Modal';
import { useAuth } from '@/hooks/useAuth';
import { useToastStore } from '@/store/slices/toastSlice';
import {
  cameraService,
  CameraLogEvent,
  DetectedFaceItem,
  FaceLabelFilter,
  GestureConfig,
  WhitelistByDate,
  WhitelistPassItem,
} from '@/services/cameraService';
import {
  Camera,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock3,
  UserCircle2,
  Sparkles,
  AlertTriangle,
  Trash2,
  Filter,
  ChevronLeft,
  ChevronRight,
  Save,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Users,
  CloudUpload,
  CalendarDays,
} from 'lucide-react';
import './CameraMonitorPage.css';

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

const PAGE_SIZE = 20;
const LOG_LIMIT = 120;

const typeLabel: Record<string, string> = {
  checkin: 'Check-in',
  checkout: 'Check-out',
  unknown: 'Unknown',
  registered: 'Registered',
  face_saved: 'Face Saved',
  face_deleted: 'Face Deleted',
  face_cleared: 'Face Cleared',
};

const typeClass: Record<string, string> = {
  checkin: 'success',
  checkout: 'info',
  unknown: 'danger',
  registered: 'neutral',
  face_saved: 'warning',
  face_deleted: 'danger',
  face_cleared: 'danger',
};

// Parse "20260510_211556_516907" → "10/05/2026 21:15:56"
const parseFaceTimestamp = (ts: string): string => {
  const m = ts.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (!m) return ts;
  const [, yyyy, mm, dd, hh, min, ss] = m;
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
};

// Format log event time from backend (HH:MM:SS) → DD/MM/YYYY HH:MM:SS using today's date
const parseLogTime = (time: string): string => {
  if (!time) return '--:--:--';
  // Already in YYYYMMDD_HHMMSS format (use shared parser)
  if (/^\d{8}_\d{6}/.test(time)) return parseFaceTimestamp(time);
  // HH:MM:SS — prepend today's date
  if (/^\d{2}:\d{2}:\d{2}/.test(time)) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `${dd}/${mm}/${yyyy} ${time}`;
  }
  return time;
};

const toSelectValue = (gesture: string | null | undefined): string => {
  if (!gesture || gesture === 'None') return 'None';
  return gesture;
};

const fromSelectValue = (value: string): string | null => {
  return value === 'None' ? null : value;
};

const GESTURE_EMOJI: Record<string, string> = {
  'None': '⛔ None',
  'Closed_Fist': '✊ Closed Fist',
  'Open_Palm': '🖐️ Open Palm',
  'Pointing_Up': '☝️ Pointing Up',
  'Thumb_Down': '👎 Thumb Down',
  'Thumb_Up': '👍 Thumb Up',
  'Victory': '✌️ Victory',
  'ILoveYou': '🤟 I Love You',
};

const CameraMonitorPage: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToastStore();

  const [streamToken, setStreamToken] = useState<number>(() => Date.now());
  const [logState, setLogState] = useState<ConnectionState>('connecting');
  const [logs, setLogs] = useState<CameraLogEvent[]>([]);

  const [faces, setFaces] = useState<DetectedFaceItem[]>([]);
  const [facesLoading, setFacesLoading] = useState<boolean>(false);
  const [facesTotal, setFacesTotal] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [labelFilter, setLabelFilter] = useState<FaceLabelFilter | 'all'>('all');
  const [selectedFace, setSelectedFace] = useState<DetectedFaceItem | null>(null);

  const [gestureConfig, setGestureConfig] = useState<GestureConfig | null>(null);
  const [gestureLoading, setGestureLoading] = useState<boolean>(true);
  const [gestureSaving, setGestureSaving] = useState<boolean>(false);
  const [checkinGesture, setCheckinGesture] = useState<string>('None');
  const [checkoutGesture, setCheckoutGesture] = useState<string>('None');
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  // ── Whitelist state ────────────────────────────────────────────────────────
  const [whitelist, setWhitelist] = useState<WhitelistByDate>({});
  const [wlLoading, setWlLoading] = useState(false);
  const [wlSyncing, setWlSyncing] = useState(false);

  const cameraBase = useMemo(() => {
    return cameraService.getVideoFeedUrl().replace(/\/video_feed$/, '');
  }, []);

  const isGestureDirty = useMemo(() => {
    if (!gestureConfig) return false;
    return (
      checkinGesture !== toSelectValue(gestureConfig.mapping?.checkin) ||
      checkoutGesture !== toSelectValue(gestureConfig.mapping?.checkout)
    );
  }, [gestureConfig, checkinGesture, checkoutGesture]);

  const videoFeedUrl = useMemo(() => {
    return `${cameraBase}/video_feed?t=${streamToken}`;
  }, [cameraBase, streamToken]);

  const facesGridClassName = useMemo(() => 'faces-grid custom-scrollbar', []);

  const loadGestureConfig = useCallback(async () => {
    setGestureLoading(true);
    try {
      const config = await cameraService.getGestures();
      const available = config.available?.length
        ? config.available
        : ['None', 'Closed_Fist', 'Open_Palm', 'Pointing_Up', 'Thumb_Down', 'Thumb_Up', 'Victory', 'ILoveYou'];

      const normalized: GestureConfig = {
        mapping: {
          checkin: config.mapping?.checkin ?? null,
          checkout: config.mapping?.checkout ?? null,
        },
        available,
      };

      setGestureConfig(normalized);
      setCheckinGesture(toSelectValue(normalized.mapping.checkin));
      setCheckoutGesture(toSelectValue(normalized.mapping.checkout));
      setLastCheckedAt(new Date());
    } catch (error: any) {
      addToast(error?.message || 'Failed to load gesture config.', 'error');
    } finally {
      setGestureLoading(false);
    }
  }, [addToast]);

  const loadFaces = useCallback(async () => {
    setFacesLoading(true);
    try {
      const data = await cameraService.getFaces({
        label: labelFilter === 'all' ? undefined : labelFilter,
        limit: PAGE_SIZE,
        offset,
      });
      setFaces(data.faces || []);
      setFacesTotal(data.total || 0);
    } catch (error: any) {
      addToast(error?.message || 'Failed to load detected faces.', 'error');
    } finally {
      setFacesLoading(false);
    }
  }, [addToast, labelFilter, offset]);

  useEffect(() => {
    loadGestureConfig();
  }, [loadGestureConfig]);

  useEffect(() => {
    loadFaces();
  }, [loadFaces]);

  useEffect(() => {
    setOffset(0);
  }, [labelFilter]);

  useEffect(() => {
    const eventSource = new EventSource(`${cameraBase}/logs/stream`);

    setLogState('connecting');

    eventSource.onopen = () => {
      setLogState('connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as CameraLogEvent;
        setLogs((prev) => [payload, ...prev].slice(0, LOG_LIMIT));
      } catch {
        // Ignore malformed event payloads.
      }
    };

    eventSource.onerror = () => {
      setLogState('disconnected');
    };

    return () => {
      eventSource.close();
      setLogState('disconnected');
    };
  }, [cameraBase]);

  // ── Whitelist handlers ─────────────────────────────────────────────────────
  const loadWhitelist = useCallback(async () => {
    setWlLoading(true);
    try {
      const data = await cameraService.getWhitelist();
      setWhitelist(data);
    } catch (err: any) {
      addToast(err?.message || 'Failed to load whitelist.', 'error');
    } finally {
      setWlLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadWhitelist(); }, [loadWhitelist]);

  const handleSyncVisitors = async () => {
    setWlSyncing(true);
    try {
      const res = await cameraService.syncVisitors();
      addToast(res.message || 'Visitors synced successfully.', 'success');
      await loadWhitelist();
    } catch (err: any) {
      addToast(err?.message || 'Sync failed.', 'error');
    } finally {
      setWlSyncing(false);
    }
  };

  const handleDeletePass = async (id: string) => {
    try {
      await cameraService.deleteWhitelistPass(id);
      addToast('Pass deleted.', 'success');
      await loadWhitelist();
    } catch (err: any) {
      addToast(err?.message || 'Failed to delete pass.', 'error');
    }
  };

  const handleClearWhitelist = async (date?: string) => {
    const confirmMessage = date
      ? `Are you sure you want to clear all day-passes for ${date}?`
      : 'Are you sure you want to clear ALL day-passes? This action cannot be undone.';
    if (!window.confirm(confirmMessage)) return;

    try {
      const res = await cameraService.clearWhitelist(date);
      addToast(res.message || (date ? `Cleared passes for ${date}.` : 'All passes cleared.'), 'success');
      await loadWhitelist();
    } catch (err: any) {
      addToast(err?.message || 'Failed to clear whitelist.', 'error');
    }
  };

  const handleSaveGestures = async () => {
    if (!gestureConfig) return;

    if (checkinGesture !== 'None' && checkinGesture === checkoutGesture) {
      addToast('Check-in and check-out gestures must be different.', 'warning');
      return;
    }

    setGestureSaving(true);
    try {
      const updated = await cameraService.setGestures({
        checkin: fromSelectValue(checkinGesture),
        checkout: fromSelectValue(checkoutGesture),
      });

      const normalized: GestureConfig = {
        mapping: {
          checkin: updated.mapping?.checkin ?? null,
          checkout: updated.mapping?.checkout ?? null,
        },
        available: updated.available?.length ? updated.available : gestureConfig.available,
      };

      setGestureConfig(normalized);
      setCheckinGesture(toSelectValue(normalized.mapping.checkin));
      setCheckoutGesture(toSelectValue(normalized.mapping.checkout));
      setLastCheckedAt(new Date());
      addToast('Gesture config updated successfully.', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Failed to update gesture config.', 'error');
    } finally {
      setGestureSaving(false);
    }
  };

  const handleDeleteFace = async (filename: string) => {
    try {
      await cameraService.deleteFace(filename);
      addToast('Face image deleted.', 'success');
      await loadFaces();
    } catch (error: any) {
      addToast(error?.message || 'Failed to delete face image.', 'error');
    }
  };

  const handleClearFaces = async () => {
    try {
      await cameraService.clearFaces(labelFilter === 'all' ? undefined : labelFilter);
      addToast('Face list cleared successfully.', 'success');
      setOffset(0);
      await loadFaces();
    } catch (error: any) {
      addToast(error?.message || 'Failed to clear face list.', 'error');
    }
  };

  return (
    <MainLayout role={user.role} userName={user.name}>
      <div className="page-container camera-page">
        <div className="camera-page-header">
          <div>
            <h1>Camera Monitor</h1>
            <p>Realtime stream, activity events, detected faces, and gesture mapping controls.</p>
          </div>
          <div className="camera-header-actions">
            <button className="btn btn-secondary" onClick={() => setStreamToken(Date.now())}>
              <RefreshCw size={16} />
              Refresh Stream
            </button>
            <button className="btn btn-secondary" onClick={loadGestureConfig} disabled={gestureLoading}>
              <RotateCcw size={16} />
              Re-check Config
            </button>
          </div>
        </div>

        <div className="camera-grid-top">
          <section className="camera-card live-card">
            <header className="camera-card-head">
              <div>
                <h2><Camera size={17} /> Live Camera Stream</h2>
                <p>Direct MJPEG feed from camera backend.</p>
              </div>
            </header>
            <div className="live-frame">
              <img src={videoFeedUrl} alt="Live camera stream" />
            </div>
          </section>

          <section className="camera-card logs-card">
            <header className="camera-card-head">
              <div>
                <h2><Sparkles size={17} /> Activity Log</h2>
                <p>Realtime events from /logs/stream (SSE).</p>
              </div>
              <span className={`log-state ${logState}`}>
                {logState === 'connected' ? <Wifi size={13} /> : <WifiOff size={13} />}
                {logState}
              </span>
            </header>

            <div className="logs-list custom-scrollbar">
              {logs.length === 0 && (
                <div className="empty-state">
                  <Clock3 size={20} />
                  <span>No events yet. Waiting for stream data...</span>
                </div>
              )}

              {logs.map((entry, idx) => (
                <article key={`${entry.time}-${entry.student_id}-${idx}`} className="log-item">
                  <div className="log-item-main">
                    <div className="log-meta-row">
                      <span className={`log-type ${typeClass[entry.type] || 'neutral'}`}>
                        {typeLabel[entry.type] || entry.type}
                      </span>
                      <span className="log-time">{parseLogTime(entry.time)}</span>
                    </div>
                    <div className="log-student">
                      <UserCircle2 size={14} />
                      {entry.student_id || 'N/A'}
                    </div>
                  </div>
                  {entry.photo_url && (
                    <img className="log-face-thumb" src={entry.photo_url} alt="Detected face" />
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="camera-grid-bottom">
          <section className="camera-card faces-card">
            <header className="camera-card-head">
              <div>
                <h2><Filter size={17} /> Detected Faces</h2>
                <p>Paginated Cloudinary face captures.</p>
              </div>
              <div className="faces-toolbar">
                <select
                  value={labelFilter}
                  onChange={(e) => setLabelFilter(e.target.value as FaceLabelFilter | 'all')}
                >
                  <option value="all">All</option>
                  <option value="detected">Detected</option>
                  <option value="unknown">Unknown</option>
                </select>
                <button className="btn btn-secondary" onClick={loadFaces} disabled={facesLoading}>
                  <RefreshCw size={14} /> Refresh
                </button>
                <button className="btn btn-secondary danger-soft" onClick={handleClearFaces}>
                  <Trash2 size={14} /> Clear Filtered
                </button>
              </div>
            </header>

            <div className={facesGridClassName}>
              {facesLoading && <div className="empty-state">Loading faces...</div>}
              {!facesLoading && faces.length === 0 && (
                <div className="empty-state">
                  <AlertTriangle size={18} />
                  <span>No face images found for this filter.</span>
                </div>
              )}

              {!facesLoading && faces.map((face) => (
                <article
                  key={face.filename}
                  className="face-card face-card-full"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedFace(face)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedFace(face);
                    }
                  }}
                >
                  <img src={face.url} alt={face.filename} />
                  <div className="face-card-body">
                    <div className="face-card-top">
                      <span className={`log-type ${face.label === 'unknown' ? 'danger' : 'success'}`}>
                        {face.label.toUpperCase()}
                      </span>
                      <button
                        className="icon-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteFace(face.filename);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="face-card-meta" title={face.timestamp}>{parseFaceTimestamp(face.timestamp)}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="faces-pagination">
              <span>
                Showing {Math.min(facesTotal, offset + 1)}-{Math.min(facesTotal, offset + PAGE_SIZE)} of {facesTotal}
              </span>
              <div className="pager-actions">
                <button
                  className="btn btn-secondary"
                  disabled={offset === 0 || facesLoading}
                  onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={offset + PAGE_SIZE >= facesTotal || facesLoading}
                  onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </section>

          <section className="camera-card gestures-card">
            <header className="camera-card-head">
              <div>
                <h2><ShieldCheck size={17} /> Gesture Config</h2>
                <p>Review, validate, and update check-in/out gesture mapping.</p>
              </div>
              {lastCheckedAt && (
                <span className="last-checked">Checked at {lastCheckedAt.toLocaleTimeString()}</span>
              )}
            </header>

            {gestureLoading ? (
              <div className="empty-state">Loading gesture config...</div>
            ) : (
              <>
                <div className="gesture-panel">
                  <label>
                    Check-in Gesture
                    <select value={checkinGesture} onChange={(e) => setCheckinGesture(e.target.value)}>
                      {(gestureConfig?.available || []).map((item) => (
                        <option key={item} value={item}>{GESTURE_EMOJI[item] ?? item}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Check-out Gesture
                    <select value={checkoutGesture} onChange={(e) => setCheckoutGesture(e.target.value)}>
                      {(gestureConfig?.available || []).map((item) => (
                        <option key={item} value={item}>{GESTURE_EMOJI[item] ?? item}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="gesture-summary">
                  <div>
                    <h4>Server Mapping</h4>
                    <p>checkin: {gestureConfig?.mapping?.checkin || 'None'}</p>
                    <p>checkout: {gestureConfig?.mapping?.checkout || 'None'}</p>
                  </div>
                  <div>
                    <h4>Pending Mapping</h4>
                    <p>checkin: {fromSelectValue(checkinGesture) || 'None'}</p>
                    <p>checkout: {fromSelectValue(checkoutGesture) || 'None'}</p>
                  </div>
                </div>

                <div className="gesture-notes">
                  {checkinGesture !== 'None' && checkinGesture === checkoutGesture ? (
                    <span className="warn"><AlertTriangle size={14} /> Check-in and check-out should not use the same gesture.</span>
                  ) : (
                    <span className="ok"><CheckCircle2 size={14} /> Mapping is valid.</span>
                  )}
                </div>

                <div className="gesture-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      if (!gestureConfig) return;
                      setCheckinGesture(toSelectValue(gestureConfig.mapping.checkin));
                      setCheckoutGesture(toSelectValue(gestureConfig.mapping.checkout));
                    }}
                    disabled={!isGestureDirty || gestureSaving}
                  >
                    <RotateCcw size={14} /> Reset Draft
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveGestures}
                    disabled={!isGestureDirty || gestureSaving || (checkinGesture !== 'None' && checkinGesture === checkoutGesture)}
                  >
                    <Save size={14} /> {gestureSaving ? 'Saving...' : 'Save Mapping'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        {/* ── Whitelist (Day-Pass Visitors) ──────────────────────────────── */}
        <section className="camera-card" style={{ marginTop: '1.5rem' }}>
          <header className="camera-card-head">
            <div>
              <h2><Users size={17} /> Whitelist — Day-Pass Visitors</h2>
              <p>Temporary access passes grouped by date. Synced from LabSync visitor approvals.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={loadWhitelist} disabled={wlLoading}>
                <RefreshCw size={14} /> Refresh
              </button>
              <button className="btn btn-secondary" onClick={handleSyncVisitors} disabled={wlSyncing}>
                <CloudUpload size={14} /> {wlSyncing ? 'Syncing…' : 'Sync Visitors'}
              </button>
              <button className="btn btn-secondary danger-soft" onClick={() => handleClearWhitelist()}>
                <Trash2 size={14} /> Clear All
              </button>
            </div>
          </header>

          {/* Passes list */}
          <div style={{ padding: '1rem 1.25rem' }}>
            {wlLoading ? (
              <div className="empty-state"><RefreshCw size={18} className="animate-spin" /><span>Loading passes…</span></div>
            ) : Object.keys(whitelist).length === 0 ? (
              <div className="empty-state"><CalendarDays size={20} /><span>No day-passes found. Sync visitors or add a manual pass.</span></div>
            ) : (
              Object.entries(whitelist)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, passes]) => (
                  <div key={date} style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CalendarDays size={14} style={{ color: 'var(--accent-color)' }} />
                        {date}
                        <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.78rem' }}>({passes.length} pass{passes.length !== 1 ? 'es' : ''})</span>
                      </h4>
                      <button
                        className="btn btn-secondary danger-soft"
                        style={{ fontSize: '0.75rem', padding: '3px 10px', height: 'auto' }}
                        onClick={() => handleClearWhitelist(date)}
                      >
                        <Trash2 size={12} /> Clear {date}
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                      {passes.map((pass: WhitelistPassItem) => (
                        <div key={pass.id} style={{ border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card, white)', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ position: 'relative' }}>
                            <img
                              src={pass.photo_url}
                              alt={pass.full_name || 'Visitor'}
                              style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            <button
                              onClick={() => handleDeletePass(pass.id)}
                              title="Delete pass"
                              style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 6, padding: '3px 5px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <div style={{ padding: '8px 10px', flex: 1 }}>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.83rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {pass.full_name || <em style={{ color: 'var(--text-muted)' }}>Unknown</em>}
                            </p>
                            <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {new Date(pass.active_from).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              {' – '}
                              {new Date(pass.active_until).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
            )}
          </div>
        </section>

        <Modal
          isOpen={Boolean(selectedFace)}
          onClose={() => setSelectedFace(null)}
          title="Face Preview"
          maxWidth="520px"
        >
          {selectedFace && (
            <div className="face-preview-wrap">
              <img src={selectedFace.url} alt={selectedFace.filename} className="face-preview-image" />
              <div className="face-preview-meta">
                <p><strong>Filename:</strong> {selectedFace.filename}</p>
                <p><strong>Label:</strong> {selectedFace.label}</p>
                <p><strong>Timestamp:</strong> {parseFaceTimestamp(selectedFace.timestamp)}</p>
                <p><strong>Cloudinary ID:</strong> {selectedFace.public_id}</p>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </MainLayout>
  );
};

export default CameraMonitorPage;
