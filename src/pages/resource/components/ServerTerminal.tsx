import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm, IDisposable } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { RefreshCw, AlertCircle, Wifi, WifiOff } from 'lucide-react';

interface ServerTerminalProps {
  wsUrl: string;
  token: string;
  onConnectionChange?: (connected: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
}

const ServerTerminal: React.FC<ServerTerminalProps> = ({
  wsUrl,
  token,
  onConnectionChange,
  className,
  style
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onDataDisposableRef = useRef<IDisposable | null>(null);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stableConnectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MAX_RECONNECT_ATTEMPTS = 5;

  const getCloseReason = (code: number, reason: string) => {
    if (code === 1008 || code === 4401 || code === 4001) {
      return 'Terminal token is invalid or expired.';
    }
    if (code === 4403 || code === 4003) {
      return 'You are not authorized to access this terminal.';
    }
    if (code === 1006) {
      return 'Connection was closed unexpectedly (network/proxy/server).';
    }
    if (reason) {
      return `Connection closed: ${reason}`;
    }
    return `Connection closed (code ${code}).`;
  };

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    setConnecting(true);
    setError(null);

    try {
      // Create WebSocket with token in URL or as subprotocol
      const url = new URL(wsUrl);
      if (!url.searchParams.get('token') && token) {
        url.searchParams.set('token', token);
      }
      
      const ws = new WebSocket(url.toString());
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setError(null);
        onConnectionChange?.(true);
        // Reset the retry counter only after the connection has been stable for 5s.
        // Resetting immediately would cause infinite reconnect if the server closes right after open.
        if (stableConnectionTimerRef.current) clearTimeout(stableConnectionTimerRef.current);
        stableConnectionTimerRef.current = setTimeout(() => {
          reconnectAttemptsRef.current = 0;
          setReconnectAttempts(0);
        }, 5_000);

        if (xtermRef.current) {
          // Send keyboard input as binary frames
          onDataDisposableRef.current = xtermRef.current.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(new TextEncoder().encode(data));
            }
          });
          xtermRef.current.focus();
          const textarea = terminalRef.current?.querySelector('textarea') as HTMLTextAreaElement | null;
          textarea?.focus();
        }
      };

      ws.onmessage = (event) => {
        if (!xtermRef.current) return;
        if (event.data instanceof ArrayBuffer) {
          const bytes = new Uint8Array(event.data);
          // Skip 1-byte 0x00 keepalive ping frames sent by backend every 30s
          if (bytes.length === 1 && bytes[0] === 0x00) return;
          xtermRef.current.write(bytes);
        } else {
          xtermRef.current.write(event.data as string);
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        onConnectionChange?.(false);
        // Cancel the stable-connection timer so the counter is NOT reset for a brief connection
        if (stableConnectionTimerRef.current) {
          clearTimeout(stableConnectionTimerRef.current);
          stableConnectionTimerRef.current = null;
        }
        if (onDataDisposableRef.current) {
          onDataDisposableRef.current.dispose();
          onDataDisposableRef.current = null;
        }

        const isAuthClose = event.code === 1008 || event.code === 4401 || event.code === 4403 || event.code === 4001 || event.code === 4003;
        if (isAuthClose) {
          setError(getCloseReason(event.code, event.reason));
          setConnecting(false);
          return;
        }

        // Normal server-initiated close (booking ended / session closed)
        if (event.code === 1000) {
          const reason = event.reason || 'Session closed.';
          xtermRef.current?.writeln(`\r\n\x1b[33m[${reason}]\x1b[0m`);
          setConnecting(false);
          return;
        }

        // Attempt reconnection if not intentional close
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const attempt = reconnectAttemptsRef.current;
          reconnectAttemptsRef.current += 1;
          setReconnectAttempts(reconnectAttemptsRef.current);
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          reconnectTimerRef.current = setTimeout(() => connect(), delay);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError(`Unable to connect after several attempts. ${getCloseReason(event.code, event.reason)}`);
          setConnecting(false);
        }
      };

      ws.onerror = () => {
        setError('Failed to connect to terminal server');
        setConnecting(false);
      };
    } catch (err) {
      setError('Invalid terminal URL');
      setConnecting(false);
    }
  }, [wsUrl, token, onConnectionChange]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (stableConnectionTimerRef.current) {
      clearTimeout(stableConnectionTimerRef.current);
      stableConnectionTimerRef.current = null;
    }
    reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS; // prevent further auto-reconnects
    if (onDataDisposableRef.current) {
      onDataDisposableRef.current.dispose();
      onDataDisposableRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000);
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    const xterm = new XTerm({
      theme: {
        background: '#1e293b',
        foreground: '#e2e8f0',
        cursor: '#f59e0b',
        cursorAccent: '#1e293b',
        selectionBackground: 'rgba(232, 114, 12, 0.3)',
        selectionForeground: '#ffffff',
        black: '#1e293b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f1f5f9',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff'
      },
      fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      disableStdin: false,
      scrollback: 5000,
      allowProposedApi: true
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    xterm.open(terminalRef.current);
    fitAddon.fit();
    xterm.focus();
    const textarea = terminalRef.current.querySelector('textarea') as HTMLTextAreaElement | null;
    textarea?.focus();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Welcome message
    xterm.writeln('\x1b[1;33m╭─────────────────────────────────────────╮\x1b[0m');
    xterm.writeln('\x1b[1;33m│\x1b[0m  \x1b[1;37mAITA Lab Compute Terminal\x1b[0m              \x1b[1;33m│\x1b[0m');
    xterm.writeln('\x1b[1;33m╰─────────────────────────────────────────╯\x1b[0m');
    xterm.writeln('');
    xterm.writeln('\x1b[90mConnecting to compute instance...\x1b[0m');
    xterm.writeln('');

    // Connect to WebSocket
    connect();

    // Handle resize — send JSON resize control message to backend
    const sendResize = () => {
      if (!fitAddonRef.current) return;
      const dims = fitAddonRef.current.proposeDimensions();
      if (dims && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
      }
    };
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        sendResize();
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      disconnect();
      xterm.dispose();
    };
  }, [connect, disconnect]);

  return (
    <div 
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#1e293b',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        ...style
      }}
    >
      {/* Terminal header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1rem',
        background: '#0f172a',
        borderBottom: '1px solid #334155'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Traffic lights */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }} />
          </div>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 }}>
            Terminal
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Connection status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            background: connected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: connected ? '#22c55e' : '#ef4444',
            fontSize: '0.7rem',
            fontWeight: 600
          }}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connecting ? 'Connecting...' : connected ? 'Connected' : 'Disconnected'}
          </div>

          {/* Reconnect button */}
          {!connected && !connecting && (
            <button
              onClick={connect}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="Reconnect"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && !connected && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          fontSize: '0.8rem'
        }}>
          <AlertCircle size={14} />
          {error}
          {reconnectAttempts > 0 && (
            <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>
              Attempt {reconnectAttempts}/{MAX_RECONNECT_ATTEMPTS}
            </span>
          )}
        </div>
      )}

      {/* Terminal container */}
      <div
        ref={terminalRef}
        tabIndex={0}
        onClick={() => {
          xtermRef.current?.focus();
          const textarea = terminalRef.current?.querySelector('textarea') as HTMLTextAreaElement | null;
          textarea?.focus();
        }}
        onFocus={() => {
          xtermRef.current?.focus();
          const textarea = terminalRef.current?.querySelector('textarea') as HTMLTextAreaElement | null;
          textarea?.focus();
        }}
        style={{
          flex: 1,
          padding: '0.75rem',
          minHeight: '300px',
          cursor: 'text',
          outline: 'none'
        }}
      />
    </div>
  );
};

export default ServerTerminal;
