import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import {
  Server, ChevronDown, ChevronRight, Copy, Check, Terminal,
  Shield, Cpu, HardDrive, Zap, Settings, CheckCircle2,
  AlertTriangle, Info, BookOpen, ArrowRight, ExternalLink,
  Clock, User, ToggleLeft, Package, Wrench, RefreshCw,
  Network, Lock, Monitor,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Phase {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  time: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  content: React.ReactNode;
}

// ─── Code Block Component ────────────────────────────────────────────────────
const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language = 'bash' }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{
      background: '#0f172a', borderRadius: '10px', overflow: 'hidden',
      border: '1px solid #1e293b', margin: '10px 0',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 14px', background: '#1e293b', borderBottom: '1px solid #334155',
      }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          {language}
        </span>
        <button
          onClick={handleCopy}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: copied ? '#065f46' : '#334155',
            border: 'none', borderRadius: '6px', padding: '3px 10px',
            color: copied ? '#6ee7b7' : '#94a3b8', cursor: 'pointer',
            fontSize: '0.7rem', fontWeight: 700, transition: 'all 0.2s',
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre style={{
        margin: 0, padding: '14px 16px', overflowX: 'auto',
        fontSize: '0.78rem', lineHeight: 1.65, color: '#e2e8f0',
        fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
      }}>
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
};

// ─── Alert Component ─────────────────────────────────────────────────────────
const Alert: React.FC<{ type: 'info' | 'warning' | 'success' | 'danger'; title?: string; children: React.ReactNode }> = ({ type, title, children }) => {
  const cfg = {
    info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: <Info size={15} />, titleColor: '#1e40af' },
    warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: <AlertTriangle size={15} />, titleColor: '#78350f' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', icon: <CheckCircle2 size={15} />, titleColor: '#14532d' },
    danger:  { bg: '#fef2f2', border: '#fecaca', color: '#dc2626', icon: <AlertTriangle size={15} />, titleColor: '#b91c1c' },
  }[type];
  return (
    <div style={{
      display: 'flex', gap: '10px', padding: '10px 14px',
      background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: '10px',
      margin: '10px 0', color: cfg.color,
    }}>
      <span style={{ flexShrink: 0, marginTop: '1px' }}>{cfg.icon}</span>
      <div>
        {title && <div style={{ fontWeight: 800, fontSize: '0.78rem', color: cfg.titleColor, marginBottom: '3px' }}>{title}</div>}
        <div style={{ fontSize: '0.78rem', lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
};

// ─── Simple Table Component ───────────────────────────────────────────────────
const SimpleTable: React.FC<{ headers: string[]; rows: string[][] }> = ({ headers, rows }) => (
  <div style={{ overflowX: 'auto', margin: '10px 0' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
      <thead>
        <tr style={{ background: '#f1f5f9' }}>
          {headers.map((h, i) => (
            <th key={i} style={{
              padding: '8px 12px', textAlign: 'left', fontWeight: 800,
              color: '#475569', borderBottom: '2px solid #e2e8f0',
              fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>
            {row.map((cell, ci) => (
              <td key={ci} style={{
                padding: '8px 12px', borderBottom: '1px solid #f1f5f9', color: '#374151', lineHeight: 1.5,
                fontFamily: ci === 0 ? '"Fira Code", monospace' : 'inherit',
                fontSize: ci === 0 ? '0.72rem' : '0.78rem',
              }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Phase Panel ─────────────────────────────────────────────────────────────
const PhasePanel: React.FC<{ phase: Phase; defaultOpen?: boolean }> = ({ phase, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={phase.id} style={{
      border: `1px solid ${phase.border}`, borderRadius: '16px', overflow: 'hidden',
      marginBottom: '12px', transition: 'box-shadow 0.2s',
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', background: phase.bg, border: 'none', cursor: 'pointer',
          padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px',
          textAlign: 'left',
        }}
      >
        <div style={{
          width: '42px', height: '42px', borderRadius: '12px', background: phase.color,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: `0 4px 12px ${phase.color}40`,
        }}>
          {phase.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: phase.color, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Phase {phase.number}
            </span>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={10} /> {phase.time}
            </span>
          </div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', marginTop: '1px' }}>{phase.title}</div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>{phase.subtitle}</div>
        </div>
        <div style={{ color: '#94a3b8', flexShrink: 0 }}>
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>
      </button>
      {open && (
        <div style={{ padding: '20px', background: '#fff', borderTop: `1px solid ${phase.border}` }}>
          {phase.content}
        </div>
      )}
    </div>
  );
};

// ─── Section Heading ──────────────────────────────────────────────────────────
const SectionH: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e293b', margin: '20px 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
    {children}
  </h3>
);

const SubH: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: '14px 0 6px' }}>{children}</h4>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.7, margin: '6px 0' }}>{children}</p>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const ServerSetupGuidePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = String(user?.role ?? '');
  const isAdmin = Number(role) === 1 || role === 'Admin';
  // Admin → /admin/compute, Lab Director → /admin/servers (LabResourceAdmin servers tab)
  const serverRoute = isAdmin ? '/admin/compute' : '/admin/servers';
  const [activeToc, setActiveToc] = useState('phase-1');
  const contentRef = useRef<HTMLDivElement>(null);

  const tocItems = [
    { id: 'phase-1', label: 'Prepare the System', icon: <Settings size={13} /> },
    { id: 'phase-2', label: 'Install Docker', icon: <Package size={13} /> },
    { id: 'phase-3', label: 'System Limits & Hardening', icon: <Shield size={13} /> },
    { id: 'phase-4', label: 'GPU Passthrough', icon: <Zap size={13} /> },
    { id: 'phase-5', label: 'Storage Strategy', icon: <HardDrive size={13} /> },
    { id: 'phase-6', label: 'Register in LabSync', icon: <Monitor size={13} /> },
    { id: 'phase-7', label: 'Verify Setup', icon: <CheckCircle2 size={13} /> },
    { id: 'maintenance', label: 'Maintenance', icon: <Wrench size={13} /> },
    { id: 'troubleshoot', label: 'Troubleshooting', icon: <RefreshCw size={13} /> },
    { id: 'security', label: 'Security Notes', icon: <Lock size={13} /> },
  ];

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveToc(id);
    }
  };

  const phases: Phase[] = [
    {
      id: 'phase-1',
      number: '1',
      title: 'Prepare the System',
      subtitle: 'Update OS, verify cgroup v2, install prerequisites, configure UID/GID ranges',
      time: '5 min',
      icon: <Settings size={20} />,
      color: '#7c3aed',
      bg: '#faf5ff',
      border: '#e9d5ff',
      content: (
        <>
          <SectionH>1.1 Update the system</SectionH>
          <CodeBlock code={`sudo apt update && sudo apt upgrade -y
sudo apt install -y curl ca-certificates gnupg lsb-release`} />

          <SectionH>1.2 Verify cgroup v2 is enabled</SectionH>
          <Alert type="info" title="Why cgroup v2?">
            Rootless Docker requires cgroup v2 for proper resource limits. Most modern distros (Ubuntu 22.04+) have this by default.
          </Alert>
          <CodeBlock code={`mount | grep cgroup`} />
          <P>You should see lines containing <code style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>cgroup2</code>. If you only see <code style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>cgroup</code> (v1), enable v2:</P>
          <CodeBlock code={`sudo sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="\\(.*\\)"/GRUB_CMDLINE_LINUX_DEFAULT="\\1 systemd.unified_cgroup_hierarchy=1"/' /etc/default/grub
sudo update-grub
sudo reboot`} />
          <P>After reboot, re-verify with <code style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>mount | grep cgroup</code>.</P>

          <SectionH>1.3 Install rootless-mode prerequisites</SectionH>
          <CodeBlock code={`sudo apt install -y \\
    uidmap \\
    dbus-user-session \\
    fuse-overlayfs \\
    slirp4netns \\
    iptables`} />
          <SimpleTable
            headers={['Package', 'Purpose']}
            rows={[
              ['uidmap', 'Provides newuidmap / newgidmap — required for user namespacing'],
              ['dbus-user-session', 'Per-user systemd services (Docker auto-restart)'],
              ['fuse-overlayfs', 'Filesystem driver for rootless containers'],
              ['slirp4netns', 'User-mode networking'],
              ['iptables', 'Network rules for container networking'],
            ]}
          />

          <SectionH>1.4 Configure UID/GID subordinate ranges</SectionH>
          <P>Each user needs a 65,536-wide UID/GID range for namespacing. Verify the default policy is in place:</P>
          <CodeBlock code={`cat /etc/login.defs | grep -E "^SUB_(UID|GID)_COUNT|^SUB_(UID|GID)_MIN"`} />
          <P>If those settings are missing or different, set them:</P>
          <CodeBlock code={`sudo tee -a /etc/login.defs > /dev/null <<EOF
SUB_UID_MIN  100000
SUB_UID_MAX  600100000
SUB_UID_COUNT 65536
SUB_GID_MIN  100000
SUB_GID_MAX  600100000
SUB_GID_COUNT 65536
EOF`} />
          <Alert type="success" title="Automatic provisioning">
            New users automatically get a subuid/subgid range — no manual <code style={{ fontFamily: 'monospace' }}>usermod</code> per user required.
          </Alert>
        </>
      ),
    },
    {
      id: 'phase-2',
      number: '2',
      title: 'Install Docker',
      subtitle: 'Install official Docker, disable root daemon, verify rootless extras',
      time: '5 min',
      icon: <Package size={20} />,
      color: '#0369a1',
      bg: '#f0f9ff',
      border: '#bae6fd',
      content: (
        <>
          <SectionH>2.1 Install the official Docker package</SectionH>
          <CodeBlock code={`curl -fsSL https://get.docker.com | sudo sh`} />

          <SectionH>2.2 Disable the root-mode Docker daemon</SectionH>
          <Alert type="warning" title="Important — security risk">
            In rootless mode, every user runs their own Docker daemon. The system-wide root daemon would conflict and is a security risk.
          </Alert>
          <CodeBlock code={`sudo systemctl disable --now docker.service docker.socket
sudo systemctl mask docker.service docker.socket`} />
          <SubH>Verify it's stopped:</SubH>
          <CodeBlock code={`sudo systemctl status docker.service
# Should show: "Active: inactive (dead)" or "masked"`} />

          <SectionH>2.3 Verify rootless extras are available</SectionH>
          <CodeBlock code={`which dockerd-rootless-setuptool.sh
# Should print: /usr/bin/dockerd-rootless-setuptool.sh`} />
          <P>If empty, install the rootless extras package:</P>
          <CodeBlock code={`sudo apt install -y docker-ce-rootless-extras`} />
        </>
      ),
    },
    {
      id: 'phase-3',
      number: '3',
      title: 'System Limits & Hardening',
      subtitle: 'Raise file descriptors, enable user namespaces, configure IP forwarding, optionally lock down access',
      time: '5 min',
      icon: <Shield size={20} />,
      color: '#059669',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      content: (
        <>
          <SectionH>3.1 Raise file-descriptor limits</SectionH>
          <P>Rootless Docker plus many small containers can hit the default <code style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>nofile</code> ceiling.</P>
          <CodeBlock code={`sudo tee /etc/security/limits.d/99-rootless-docker.conf > /dev/null <<EOF
*    soft    nofile    65536
*    hard    nofile    1048576
root soft    nofile    65536
root hard    nofile    1048576
EOF`} />

          <SectionH>3.2 Allow unprivileged user namespaces</SectionH>
          <P>Some distros disable unprivileged user namespaces by default:</P>
          <CodeBlock code={`echo 'kernel.unprivileged_userns_clone=1' | sudo tee /etc/sysctl.d/99-rootless-docker.conf
sudo sysctl --system`} />

          <SectionH>3.3 Enable IP forwarding</SectionH>
          <P>Required so containers can reach the internet:</P>
          <CodeBlock code={`echo 'net.ipv4.ip_forward=1' | sudo tee -a /etc/sysctl.d/99-rootless-docker.conf
sudo sysctl --system`} />

          <SectionH>3.4 (Optional) Lock down which users can use rootless Docker</SectionH>
          <Alert type="info" title="Recommended for LabSync environments">
            Restrict the setup tool to a group so only LabSync-provisioned users can run rootless Docker.
          </Alert>
          <CodeBlock code={`sudo groupadd labsync-docker-users
sudo chgrp labsync-docker-users /usr/bin/dockerd-rootless-setuptool.sh
sudo chmod 750 /usr/bin/dockerd-rootless-setuptool.sh`} />
          <P>Then your LinuxProvisioningService should add new users to this group:</P>
          <CodeBlock code={`sudo usermod -aG labsync-docker-users <username>`} />
        </>
      ),
    },
    {
      id: 'phase-4',
      number: '4',
      title: 'GPU Passthrough',
      subtitle: 'NVIDIA driver, Container Toolkit, rootless GPU support — skip if no GPU',
      time: '5 min (optional)',
      icon: <Zap size={20} />,
      color: '#d97706',
      bg: '#fffbeb',
      border: '#fde68a',
      content: (
        <>
          <Alert type="info" title="Skip this phase if the server has no GPU.">
            Only follow this phase if this server has NVIDIA GPUs and you want users to access them inside containers.
          </Alert>

          <SectionH>4.1 Install the NVIDIA driver</SectionH>
          <CodeBlock code={`sudo apt install -y nvidia-driver-535  # or whichever version matches your GPU
sudo reboot`} />
          <P>After reboot, verify:</P>
          <CodeBlock code={`nvidia-smi`} />

          <SectionH>4.2 Install the NVIDIA Container Toolkit</SectionH>
          <CodeBlock code={`curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \\
  | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \\
  | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#' \\
  | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt update
sudo apt install -y nvidia-container-toolkit`} />

          <SectionH>4.3 Enable rootless GPU support</SectionH>
          <Alert type="warning" title="Required flag for rootless mode">
            The <code style={{ fontFamily: 'monospace' }}>--no-cgroups</code> flag is required for rootless mode. Without it, users cannot pass <code style={{ fontFamily: 'monospace' }}>--gpus</code>.
          </Alert>
          <CodeBlock code={`sudo nvidia-ctk runtime configure --runtime=docker --config=$HOME/.config/docker/daemon.json
sudo nvidia-ctk config --set nvidia-container-cli.no-cgroups --in-place`} />
          <P>Users will then be able to run:</P>
          <CodeBlock code={`docker run --rm --gpus all nvidia/cuda:12.2.0-base nvidia-smi`} />
        </>
      ),
    },
    {
      id: 'phase-5',
      number: '5',
      title: 'Storage & Image Cache Strategy',
      subtitle: 'Per-user disk quotas and optional shared image pre-warming',
      time: '3 min',
      icon: <HardDrive size={20} />,
      color: '#6366f1',
      bg: '#eef2ff',
      border: '#c7d2fe',
      content: (
        <>
          <Alert type="warning" title="Disk usage can balloon quickly">
            By default, each user has their own Docker storage at <code style={{ fontFamily: 'monospace' }}>~/.local/share/docker</code>. Large images (e.g. PyTorch ≈ 7 GB) can consume disk fast.
          </Alert>

          <SectionH>5.1 Set a per-user disk quota (recommended)</SectionH>
          <P>If <code style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>/home</code> is on an XFS or ext4 filesystem with quotas enabled:</P>
          <CodeBlock code={`sudo apt install -y quota
sudo setquota -u <username> 50000000 60000000 0 0 /home   # 50 GB soft, 60 GB hard`} />

          <SectionH>5.2 (Optional) Pre-warm a shared image cache</SectionH>
          <P>Pre-pull common images to speed up the first <code style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>docker run</code> for new users. Rootless users still pull their own copies, but you can maintain a list of "blessed" images.</P>
          <CodeBlock code={`docker pull python:3.11
docker pull pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime
docker pull jupyter/scipy-notebook
docker pull tensorflow/tensorflow:latest-gpu`} />
        </>
      ),
    },
    {
      id: 'phase-6',
      number: '6',
      title: 'Register the Server in LabSync',
      subtitle: 'Add the server as a resource via the Admin panel — the platform auto-provisions users',
      time: '2 min',
      icon: <Monitor size={20} />,
      color: '#0ea5e9',
      bg: '#f0f9ff',
      border: '#bae6fd',
      content: (
        <>
          <Alert type="success" title="You're almost done!">
            After completing the OS setup above, the final step is to register this server inside LabSync so bookings can be made against it.
          </Alert>

          <SectionH>Steps to register</SectionH>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '10px 0' }}>
            {[
              { step: '1', label: 'Go to Compute Servers', desc: 'Navigate to Admin → Compute Servers in the sidebar.' },
              { step: '2', label: 'Create a ServerCompute Type (Step 1)', desc: 'Under the "Resource Types" tab, create a type with category = ServerCompute.' },
              { step: '3', label: 'Register the Server (Step 2)', desc: 'Click "+ Register Server". Fill in name, SSH host, SSH port, SSH username, and the server\'s private key.' },
              { step: '4', label: 'Fill hardware specs', desc: 'GPU count, CPU cores, RAM (GB), max concurrent users, model series — all optional but recommended.' },
              { step: '5', label: 'Save', desc: 'The private key is AES-256 encrypted before storage and never returned via the API.' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: '12px', padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{
                  width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.72rem', fontWeight: 800, flexShrink: 0,
                }}>{s.step}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>{s.label}</div>
                  <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <P>LabSync will automatically provision Linux users + SSH keys for each booking via the existing <code style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>LinuxProvisioningService</code>. Users follow the user-side setup guide the first time they log in.</P>
        </>
      ),
    },
    {
      id: 'phase-7',
      number: '7',
      title: 'Verify Everything Works',
      subtitle: 'Create a test user, run the user-side setup, and confirm hello-world',
      time: '2 min',
      icon: <CheckCircle2 size={20} />,
      color: '#16a34a',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      content: (
        <>
          <SectionH>Create and switch to a test user</SectionH>
          <CodeBlock code={`# As root
sudo useradd -m -s /bin/bash testuser
sudo passwd testuser    # set a temp password

# Switch to testuser
sudo -i -u testuser`} />

          <SectionH>Run the user-side setup</SectionH>
          <CodeBlock code={`dockerd-rootless-setuptool.sh install
echo 'export PATH=/usr/bin:$PATH' >> ~/.bashrc
echo "export DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock" >> ~/.bashrc
source ~/.bashrc
sudo loginctl enable-linger $USER   # needs root, just for testing
systemctl --user start docker
docker run --rm hello-world`} />

          <Alert type="success" title="✅ Setup is complete!">
            If <code style={{ fontFamily: 'monospace' }}>hello-world</code> runs and prints its message, the rootless Docker setup is working correctly.
          </Alert>

          <SectionH>Clean up the test user</SectionH>
          <CodeBlock code={`exit  # back to root shell
sudo userdel -r testuser`} />
        </>
      ),
    },
  ];

  return (
    <MainLayout>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* ── Hero ── */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          borderRadius: '20px', padding: '32px 36px', marginBottom: '24px', position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative orbs */}
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.3) 0%, transparent 70%)' }} />
          <div style={{ position: 'absolute', bottom: '-30px', left: '60px', width: '150px', height: '150px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ padding: '5px 12px', background: 'rgba(37,99,235,0.3)', borderRadius: '20px', border: '1px solid rgba(59,130,246,0.4)' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Lab Director &amp; Admin Guide
                </span>
              </div>
              <div style={{ padding: '5px 12px', background: 'rgba(22,163,74,0.25)', borderRadius: '20px', border: '1px solid rgba(34,197,94,0.3)' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#86efac', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  One-time per server
                </span>
              </div>
            </div>
            <h1 style={{ margin: '0 0 8px', fontSize: '1.8rem', fontWeight: 900, color: '#f1f5f9', lineHeight: 1.2 }}>
              First-Time Rootless Docker<br />
              <span style={{ background: 'linear-gradient(90deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Server Setup Guide
              </span>
            </h1>
            <p style={{ margin: '0 0 20px', fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.6, maxWidth: '560px' }}>
              After this one-time setup, every user provisioned through LabSync can run their own isolated rootless Docker without any further admin work.
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
              {[
                { icon: <Clock size={13} />, label: '15–25 min per server' },
                { icon: <User size={13} />, label: 'Requires sudo / root' },
                { icon: <Server size={13} />, label: 'Ubuntu 22.04 / 24.04 LTS' },
              ].map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ color: '#60a5fa' }}>{m.icon}</span>
                  <span style={{ fontSize: '0.73rem', color: '#cbd5e1', fontWeight: 600 }}>{m.label}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate(serverRoute)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '9px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: '#fff',
                  fontWeight: 700, fontSize: '0.83rem', boxShadow: '0 4px 16px rgba(37,99,235,0.35)',
                }}
              >
                <Server size={14} />
                Go to Compute Servers
                <ArrowRight size={13} />
              </button>
              <a
                href="https://docs.docker.com/engine/security/rootless/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '9px 20px', borderRadius: '10px', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.15)',
                  fontWeight: 700, fontSize: '0.83rem', textDecoration: 'none',
                }}
              >
                <BookOpen size={14} />
                Docker Docs
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>

        {/* ── Body: TOC + Content ── */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

          {/* ── Sticky TOC ── */}
          <div style={{ width: '200px', flexShrink: 0, position: 'sticky', top: '20px' }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                Contents
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {tocItems.map(t => (
                  <button
                    key={t.id}
                    onClick={() => scrollToSection(t.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      padding: '6px 9px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left',
                      background: activeToc === t.id ? '#eff6ff' : 'transparent',
                      color: activeToc === t.id ? '#2563eb' : '#64748b',
                      fontWeight: activeToc === t.id ? 700 : 500,
                      fontSize: '0.73rem', transition: 'all 0.15s', width: '100%',
                    }}
                  >
                    <span style={{ flexShrink: 0, opacity: 0.7 }}>{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick reference card */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '14px', marginTop: '12px' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                Quick Ref
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {[
                  { label: 'Setup tool', val: 'dockerd-rootless-setuptool.sh' },
                  { label: 'Socket', val: '/run/user/$UID/docker.sock' },
                  { label: 'Storage', val: '~/.local/share/docker' },
                  { label: 'Logs', val: 'journalctl --user -u docker' },
                  { label: 'Linger', val: 'loginctl enable-linger' },
                ].map((r, i) => (
                  <div key={i}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{r.label}</div>
                    <div style={{ fontSize: '0.67rem', color: '#94a3b8', fontFamily: '"Fira Code", monospace', marginTop: '1px', wordBreak: 'break-all' }}>{r.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Main Content ── */}
          <div ref={contentRef} style={{ flex: 1, minWidth: 0 }}>

            {/* Phases */}
            {phases.map((phase, i) => (
              <PhasePanel key={phase.id} phase={phase} defaultOpen={i === 0} />
            ))}

            {/* ── Maintenance Checklist ── */}
            <div id="maintenance" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #f97316)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wrench size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Maintenance Checklist</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Monthly tasks to keep servers healthy</div>
                </div>
              </div>
              <SimpleTable
                headers={['Task', 'Command']}
                rows={[
                  ['Check daemon health for all active users', 'loginctl list-users'],
                  ['Disk space used by Docker per user', 'sudo du -sh /home/*/.local/share/docker | sort -h'],
                  ['Clean unused images globally', 'Tell users to run: docker system prune -af'],
                  ['Update Docker engine', 'sudo apt update && sudo apt upgrade docker-ce'],
                  ['Update NVIDIA toolkit (GPU servers only)', 'sudo apt update && sudo apt upgrade nvidia-container-toolkit'],
                  ['Review failed systemctl --user for any user', 'sudo journalctl _UID=$(id -u USER) --since "1 hour ago"'],
                ]}
              />
            </div>

            {/* ── Troubleshooting ── */}
            <div id="troubleshoot" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Common Server-Side Issues</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Diagnose and fix the most common problems</div>
                </div>
              </div>
              <SimpleTable
                headers={['Symptom', 'Cause', 'Fix']}
                rows={[
                  ["User's docker command hangs forever", "Their daemon socket not present", "Tell them to run: systemctl --user restart docker"],
                  ["Error: failed to start daemon: cgroups mountpoint does not exist", "cgroup v2 not enabled", "See Phase 1.2 — enable cgroup v2"],
                  ["Server runs out of disk after a few users", "No per-user quota", "See Phase 5.1 — set disk quotas"],
                  ["Users can suddenly affect each other", "Someone got added to the root docker group", "Remove with: sudo gpasswd -d USER docker"],
                  ["nvidia-smi works on host but not in container", "Forgot Phase 4.3 (--no-cgroups flag)", "Re-run Phase 4.3 commands"],
                  ["Containers can't reach internet", "IP forwarding disabled", "See Phase 3.3 — enable IP forwarding"],
                ]}
              />
            </div>

            {/* ── Security Notes ── */}
            <div id="security" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #059669, #16a34a)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Security Notes</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Understand the security model of rootless Docker</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { ok: true, text: 'No user has access to sudo docker — there\'s no Docker daemon to attack as root.' },
                  { ok: true, text: 'Each user\'s containers are namespaced — they can\'t see or signal each other.' },
                  { ok: true, text: 'A compromised user can\'t escape to root — rootless Docker has no privileged daemon to exploit.' },
                  { ok: false, text: 'Users can still consume server resources — keep an eye on htop if you don\'t set quotas.' },
                  { ok: false, text: 'Users CAN still listen on ports >1024 — coordinate via LabSync booking to avoid clashes, or pick free ports automatically.' },
                ].map((n, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: '10px', padding: '10px 14px',
                    background: n.ok ? '#f0fdf4' : '#fffbeb',
                    border: `1px solid ${n.ok ? '#bbf7d0' : '#fde68a'}`, borderRadius: '10px',
                  }}>
                    <span style={{ flexShrink: 0, marginTop: '1px' }}>
                      {n.ok
                        ? <CheckCircle2 size={15} style={{ color: '#16a34a' }} />
                        : <AlertTriangle size={15} style={{ color: '#d97706' }} />}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: n.ok ? '#166534' : '#92400e', lineHeight: 1.6 }}>{n.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── CTA ── */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a, #1e293b)',
              borderRadius: '16px', padding: '24px 28px', marginBottom: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#f1f5f9', marginBottom: '5px' }}>
                  Ready to register your server?
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Once the OS is set up, head to Compute Servers to register it in LabSync.
                </div>
              </div>
              <button
                onClick={() => navigate(serverRoute)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '11px 24px', borderRadius: '11px', border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: '#fff',
                  fontWeight: 700, fontSize: '0.88rem', boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
                  flexShrink: 0,
                }}
              >
                <Server size={16} />
                Register Server Now
                <ArrowRight size={14} />
              </button>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', padding: '12px', fontSize: '0.72rem', color: '#94a3b8' }}>
              Last updated: 2026-05-20 · Owner: LabSync Platform team ·{' '}
              <a href="https://docs.docker.com/engine/security/rootless/" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }}>
                Upstream rootless Docker docs ↗
              </a>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </MainLayout>
  );
};

export default ServerSetupGuidePage;
