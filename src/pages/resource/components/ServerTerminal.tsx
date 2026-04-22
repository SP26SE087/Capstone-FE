import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { AttachAddon } from '@xterm/addon-attach';
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
  const attachAddonRef = useRef<AttachAddon | null>(null);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const MAX_RECONNECT_ATTEMPTS = 5;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    setConnecting(true);
    setError(null);

    try {
      // Create WebSocket with token in URL or as subprotocol
      const url = new URL(wsUrl);
      url.searchParams.set('token', token);
      
      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setReconnectAttempts(0);
        onConnectionChange?.(true);

        // Attach terminal to WebSocket
        if (xtermRef.current && !attachAddonRef.current) {
          const attachAddon = new AttachAddon(ws);
          attachAddonRef.current = attachAddon;
          xtermRef.current.loadAddon(attachAddon);
        }

        // Send initial terminal size
        if (xtermRef.current) {
          const { cols, rows } = xtermRef.current;
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        onConnectionChange?.(false);
        attachAddonRef.current = null;

        // Attempt reconnection if not intentional close
        if (event.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          setReconnectAttempts(prev => prev + 1);
          setTimeout(() => connect(), Math.min(1000 * Math.pow(2, reconnectAttempts), 10000));
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
  }, [wsUrl, token, onConnectionChange, reconnectAttempts]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000);
      wsRef.current = null;
    }
    attachAddonRef.current = null;
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
      scrollback: 5000,
      allowProposedApi: true
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    xterm.open(terminalRef.current);
    fitAddon.fit();

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

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        if (wsRef.current?.readyState === WebSocket.OPEN && xtermRef.current) {
          const { cols, rows } = xtermRef.current;
          wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
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

  // Demo mode - simulate terminal when no real connection
  useEffect(() => {
    if (!connected && xtermRef.current && !connecting && !error) {
      const xterm = xtermRef.current;
      
      // Simulate connection after delay
      const timer = setTimeout(() => {
        xterm.writeln('\x1b[32m✓ Connected to compute instance\x1b[0m');
        xterm.writeln('');
        xterm.writeln('\x1b[90m──────────────────────────────────────────\x1b[0m');
        xterm.writeln('');
        xterm.writeln('\x1b[1;36mSystem Information:\x1b[0m');
        xterm.writeln('  OS: Ubuntu 22.04.3 LTS');
        xterm.writeln('  GPU: NVIDIA RTX 4090 (24GB)');
        xterm.writeln('  CUDA: 12.2');
        xterm.writeln('  Python: 3.11.5');
        xterm.writeln('  PyTorch: 2.1.0');
        xterm.writeln('');
        xterm.writeln('\x1b[90m──────────────────────────────────────────\x1b[0m');
        xterm.writeln('');
        xterm.write('\x1b[1;32muser@compute-node\x1b[0m:\x1b[1;34m~\x1b[0m$ ');
        
        setConnected(true);
        onConnectionChange?.(true);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [connected, connecting, error, onConnectionChange]);

  // Handle local input in demo mode
  useEffect(() => {
    if (!xtermRef.current || !connected) return;

    let currentLine = '';

    const disposable = xtermRef.current.onKey(({ key, domEvent }) => {
      const xterm = xtermRef.current!;
      
      // If connected to real WebSocket, let AttachAddon handle it
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      // Demo mode input handling
      if (domEvent.key === 'Enter') {
        xterm.writeln('');
        
        if (currentLine.trim()) {
          // Simulate command responses
          const cmd = currentLine.trim().toLowerCase();
          if (cmd === 'ls') {
            xterm.writeln('datasets/  models/  notebooks/  scripts/  requirements.txt');
          } else if (cmd === 'nvidia-smi') {
            xterm.writeln('+-----------------------------------------------------------------------------+');
            xterm.writeln('| NVIDIA-SMI 535.104.05   Driver Version: 535.104.05   CUDA Version: 12.2    |');
            xterm.writeln('|-------------------------------+----------------------+----------------------+');
            xterm.writeln('| GPU  Name        Persistence-M| Bus-Id        Disp.A | Volatile Uncorr. ECC |');
            xterm.writeln('| Fan  Temp  Perf  Pwr:Usage/Cap|         Memory-Usage | GPU-Util  Compute M. |');
            xterm.writeln('|===============================+======================+======================|');
            xterm.writeln('|   0  NVIDIA RTX 4090     On   | 00000000:01:00.0 Off |                  Off |');
            xterm.writeln('| 30%   42C    P8    19W / 450W |    512MiB / 24564MiB |      0%      Default |');
            xterm.writeln('+-------------------------------+----------------------+----------------------+');
          } else if (cmd === 'python --version') {
            xterm.writeln('Python 3.11.5');
          } else if (cmd === 'pwd') {
            xterm.writeln('/home/user');
          } else if (cmd === 'whoami') {
            xterm.writeln('user');
          } else if (cmd === 'clear') {
            xterm.clear();
          } else if (cmd === 'help') {
            xterm.writeln('\x1b[1;36mAvailable commands:\x1b[0m');
            xterm.writeln('  ls, pwd, whoami, nvidia-smi, python --version, clear, help');
            xterm.writeln('');
            xterm.writeln('\x1b[90mNote: This is a demo terminal. Connect to a real instance for full access.\x1b[0m');
          } else {
            xterm.writeln(`\x1b[90m${currentLine}: command simulated in demo mode\x1b[0m`);
          }
        }
        
        xterm.write('\x1b[1;32muser@compute-node\x1b[0m:\x1b[1;34m~\x1b[0m$ ');
        currentLine = '';
      } else if (domEvent.key === 'Backspace') {
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          xterm.write('\b \b');
        }
      } else if (key.length === 1 && !domEvent.ctrlKey && !domEvent.altKey) {
        currentLine += key;
        xterm.write(key);
      }
    });

    return () => disposable.dispose();
  }, [connected]);

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
      {error && (
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
        style={{
          flex: 1,
          padding: '0.75rem',
          minHeight: '300px'
        }}
      />
    </div>
  );
};

export default ServerTerminal;
