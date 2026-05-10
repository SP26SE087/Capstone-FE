import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

const toSelectValue = (gesture: string | null | undefined): string => {
  if (!gesture || gesture === 'None') return 'None';
  return gesture;
};

const fromSelectValue = (value: string): string | null => {
  return value === 'None' ? null : value;
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

  const facesGridClassName = useMemo(() => {
    const count = faces.length;
    if (count === 1) return 'faces-grid few-1 custom-scrollbar';
    if (count === 2) return 'faces-grid few-2 custom-scrollbar';
    if (count === 3) return 'faces-grid few-3 custom-scrollbar';
    return 'faces-grid custom-scrollbar';
  }, [faces.length]);

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
                      <span className="log-time">{entry.time || '--:--:--'}</span>
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
                  className="face-card"
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
                        {face.label}
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
                    <p title={face.filename}>{face.filename}</p>
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
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Check-out Gesture
                    <select value={checkoutGesture} onChange={(e) => setCheckoutGesture(e.target.value)}>
                      {(gestureConfig?.available || []).map((item) => (
                        <option key={item} value={item}>{item}</option>
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

        <Modal
          isOpen={Boolean(selectedFace)}
          onClose={() => setSelectedFace(null)}
          title="Face Preview"
          maxWidth="880px"
        >
          {selectedFace && (
            <div className="face-preview-wrap">
              <img src={selectedFace.url} alt={selectedFace.filename} className="face-preview-image" />
              <div className="face-preview-meta">
                <p><strong>Filename:</strong> {selectedFace.filename}</p>
                <p><strong>Label:</strong> {selectedFace.label}</p>
                <p><strong>Timestamp:</strong> {selectedFace.timestamp}</p>
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
