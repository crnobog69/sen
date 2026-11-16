import { escapeHtml } from '../services/format.ts';
import { apiKeyFingerprint } from '../services/api-keys.ts';

type Notice = {
  text: string;
  error?: boolean;
  secret?: string;
};

type FolderView = {
  fileCount: number;
  id: number;
  ime: string;
  quotaMax: number;
  quotaUsed: number;
  rateLimitOverride: number | null;
};

type FileView = {
  id: number;
  publicId: string;
  serverskaPutanja: string;
  folderId: number;
  folderIme: string;
  velicina: number;
  contentHash: string | null;
  public: boolean;
  rateLimitOverride: number | null;
};

type ApiKeyView = {
  id: number;
  ime: string;
  key: string;
  canUpload: boolean;
  canDelete: boolean;
  rateLimitOverride: number | null;
};

type Assignment = {
  apiKeyId: number;
  folderId?: number;
  fileId?: number;
};

export type DashboardData = {
  notice?: Notice;
  settings: {
    globalRateLimit: number;
    globalDefaultQuota: number;
  };
  traffic: {
    totalRequests: number;
    minuteRequests: number;
    publicTotalRequests: number;
    publicMinuteRequests: number;
    publicWindows: {
      d1: number;
      m1: number;
      m3: number;
      m6: number;
      m12: number;
    };
    apiKeyStats: Array<{
      apiKeyId: number;
      totalRequests: number;
      minuteRequests: number;
      windows: {
        d1: number;
        m1: number;
        m3: number;
        m6: number;
        m12: number;
      };
    }>;
  };
  folders: FolderView[];
  selectedFolderId?: number;
  folderPage: { page: number; pages: number };
  catalogPage: { page: number; pages: number };
  folderFiles: FileView[];
  files: FileView[];
  apiKeys: ApiKeyView[];
  apiKeyFolders: Assignment[];
  apiKeyFiles: Assignment[];
};

const BYTES_IN_GB = 1024 ** 3;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatGb(bytes: number) {
  return (bytes / BYTES_IN_GB).toFixed(2);
}

function formatCount(value: number) {
  return new Intl.NumberFormat('sr-RS').format(Math.max(0, Math.floor(value)));
}

function keyLabel(storedKey: string) {
  return `fingerprint: ${apiKeyFingerprint(storedKey)}`;
}

function fileNameFromPath(serverPath: string) {
  const normalized = serverPath.replaceAll('\\', '/');
  const chunks = normalized.split('/');
  return chunks[chunks.length - 1] || serverPath;
}

function fileExt(fileName: string) {
  if (!fileName.includes('.')) {
    return 'FILE';
  }
  const ext = fileName.split('.').pop();
  return ext ? ext.toUpperCase() : 'FILE';
}

function previewKind(serverPath: string) {
  const name = fileNameFromPath(serverPath);
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() : '';

  if (!ext) return 'other';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mkv', 'mov', 'm4v'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) return 'audio';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['txt', 'md', 'json', 'csv', 'log', 'xml', 'yml', 'yaml', 'toml'].includes(ext)) return 'text';

  return 'other';
}

function iconForKind(kind: string) {
  switch (kind) {
    case 'image':
      return 'image';
    case 'video':
      return 'film';
    case 'audio':
      return 'music-2';
    case 'pdf':
      return 'file-text';
    case 'text':
      return 'file-type-2';
    default:
      return 'file';
  }
}

function shell(title: string, body: string) {
  return `<!doctype html>
<html lang="sr-Cyrl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>
      @font-face {
        font-family: "Geist Pixel Square";
        src: url('/assets/fonts/geist/square.woff2') format('woff2');
        font-display: swap;
      }

      :root {
        --bg: #0b0e14;
        --surface: #131824;
        --surface-2: #171d2b;
        --line: #2a3244;
        --line-soft: #21293a;
        --text: #edf2ff;
        --muted: #9aa5bc;
        --primary: #f3f7ff;
        --primary-text: #111726;
        --accent: #8fa2ff;
        --accent-strong: #c3d0ff;
        --danger: #ff9b9b;
        --ok: #89dbad;
        --shadow: 0 20px 45px rgba(0, 0, 0, 0.42);
      }

      :root { color-scheme: dark; }

      * { box-sizing: border-box; }
      * {
        scrollbar-width: thin;
        scrollbar-color: #34415f #0d1321;
      }

      *::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }

      *::-webkit-scrollbar-track {
        background: #0d1321;
      }

      *::-webkit-scrollbar-thumb {
        background: #34415f;
        border-radius: 999px;
        border: 2px solid #0d1321;
      }

      *::-webkit-scrollbar-thumb:hover {
        background: #435178;
      }

      html, body { margin: 0; padding: 0; }
      body {
        min-height: 100vh;
        font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 14px;
        color: var(--text);
        background:
          radial-gradient(760px 420px at 100% -10%, #1e283c 0%, rgba(30, 40, 60, 0) 60%),
          radial-gradient(720px 420px at -10% -20%, #1a2233 0%, rgba(26, 34, 51, 0) 60%),
          var(--bg);
      }

      body.modal-open { overflow: hidden; }

      .app {
        max-width: 1680px;
        margin: 0 auto;
        padding: .9rem;
      }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: .8rem;
        margin-bottom: .85rem;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: .6rem;
      }

      .brand-mark {
        width: .74rem;
        height: .74rem;
        border-radius: 999px;
        background: var(--primary);
        box-shadow: 0 0 18px rgba(243, 247, 255, .5);
      }

      .brand-title {
        margin: 0;
        font-size: 1rem;
      }

      .nav {
        display: flex;
        flex-wrap: wrap;
        gap: .45rem;
        margin-bottom: .9rem;
        padding: .45rem;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: rgba(19, 24, 36, .88);
        backdrop-filter: blur(8px);
      }

      .mobile-warning {
        display: none;
        margin-bottom: .9rem;
        border: 1px solid rgba(255, 155, 155, .42);
        border-radius: 11px;
        background: rgba(40, 17, 24, .46);
        color: #ffd6dc;
        padding: .62rem .7rem;
        font-size: .78rem;
      }

      .about-grid {
        display: grid;
        gap: .9rem;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }

      .about-lead {
        margin: 0;
        color: var(--muted);
        line-height: 1.55;
      }

      .app-footer {
        margin-top: 1rem;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: rgba(19, 24, 36, .78);
        padding: .58rem .72rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: .6rem;
        flex-wrap: wrap;
        color: var(--muted);
        font-size: .78rem;
      }

      .app-footer a {
        color: #d7e3ff;
        text-decoration: none;
      }

      .app-footer a:hover {
        text-decoration: underline;
      }

      .footer-made {
        display: inline-flex;
        align-items: center;
        gap: .3rem;
      }

      .footer-heart {
        color: #7ea7ff;
        width: 12px;
        height: 12px;
        stroke-width: 1.9;
        fill: currentColor;
        vertical-align: -1px;
      }

      button,
      .btn,
      .nav-btn,
      .folder-btn,
      .file-card {
        border: 1px solid var(--line);
        background: var(--surface-2);
        color: var(--text);
        border-radius: 10px;
        padding: .52rem .8rem;
        font: inherit;
        line-height: 1.15;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: .4rem;
      }

      button:hover,
      .btn:hover,
      .nav-btn:hover,
      .folder-btn:hover,
      .file-card:hover { border-color: #3a4660; }

      button:focus-visible,
      .btn:focus-visible,
      .nav-btn:focus-visible,
      .folder-btn:focus-visible,
      .icon-btn:focus-visible,
      .menu-item:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px rgba(143, 162, 255, .42);
      }

      button:disabled,
      .btn:disabled,
      .menu-item:disabled {
        opacity: .52;
        cursor: not-allowed;
      }

      .btn.primary,
      .nav-btn.active {
        background: var(--primary);
        color: var(--primary-text);
        border-color: transparent;
      }

      .btn.ghost { background: transparent; }
      .btn.small,
      .small {
        padding: .34rem .54rem;
        font-size: .81rem;
      }

      .btn.danger,
      .danger {
        color: #ffd4d4;
        border-color: rgba(255, 155, 155, .65);
      }

      .tab-section { display: none; }
      .tab-section.active { display: block; }

      .panel {
        border: 1px solid var(--line);
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(21, 27, 40, .98), rgba(15, 20, 30, .98));
        box-shadow: var(--shadow);
      }

      .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: .6rem;
        padding: .8rem .95rem;
        border-bottom: 1px solid var(--line-soft);
      }

      .panel-title {
        margin: 0;
        font-size: .92rem;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: .42rem;
        line-height: 1.15;
      }

      .panel-title .lucide {
        width: 16px;
        height: 16px;
        flex: 0 0 auto;
      }

      .panel-body { padding: .9rem; }

      .home-grid {
        display: grid;
        gap: .9rem;
        grid-template-columns: minmax(0, 1fr) minmax(320px, 430px);
      }

      .hero-tag {
        margin: 0;
        font-size: .74rem;
        color: var(--muted);
      }

      .pixel-title {
        margin: 0;
        font-family: "Geist Pixel Square", "JetBrains Mono", monospace;
        font-size: clamp(2.2rem, 7vw, 4.7rem);
        line-height: 1.02;
        letter-spacing: 0;
      }

      .kpi-grid {
        display: grid;
        gap: .64rem;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .kpi {
        border: 1px solid var(--line-soft);
        border-radius: 11px;
        padding: .62rem .7rem;
        background: #10182a;
        display: grid;
        gap: .28rem;
      }

      .kpi-label {
        color: var(--muted);
        font-size: .74rem;
      }

      .kpi-value {
        font-size: 1.08rem;
        font-weight: 800;
        line-height: 1.2;
      }

      .traffic-list {
        display: grid;
        gap: .58rem;
      }

      .traffic-row {
        border: 1px solid var(--line-soft);
        border-radius: 10px;
        padding: .55rem .58rem;
        background: #10182a;
        display: grid;
        gap: .36rem;
      }

      .traffic-row-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: .5rem;
      }

      .traffic-row-name {
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .traffic-meter {
        width: 100%;
        height: 8px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: #0f1422;
        overflow: hidden;
      }

      .traffic-meter-bar {
        height: 100%;
        width: 0;
        background: linear-gradient(90deg, #8ea0db, #d3ddff);
      }

      .traffic-row-meta {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        flex-wrap: wrap;
        gap: .5rem;
        color: var(--muted);
        font-size: .72rem;
      }

      .stack { display: grid; gap: .72rem; }
      .cluster {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: .45rem;
      }

      .field {
        display: grid;
        gap: .42rem;
      }

      label {
        color: var(--muted);
        font-size: .82rem;
      }

      label:has(input[type="checkbox"]) {
        display: inline-flex;
        align-items: center;
        gap: .35rem;
        color: var(--text);
      }

      input, select {
        width: 100%;
        border: 1px solid var(--line);
        background: #0d121e;
        color: var(--text);
        border-radius: 10px;
        padding: .55rem .62rem;
        font: inherit;
      }

      input[type="file"] { padding: .26rem .34rem; }
      input[type="file"]::file-selector-button {
        border: 1px solid var(--line);
        background: var(--surface-2);
        color: var(--text);
        border-radius: 8px;
        padding: .38rem .62rem;
        margin-right: .55rem;
        font: inherit;
        font-size: .81rem;
        font-weight: 600;
        cursor: pointer;
      }

      input[type="checkbox"] {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        margin: 0;
        padding: 0;
        border: 1px solid #425176;
        border-radius: 4px;
        background: #0d121e;
        display: inline-grid;
        place-items: center;
        vertical-align: middle;
        cursor: pointer;
        transition: border-color .12s ease, background .12s ease, box-shadow .12s ease;
      }

      input[type="checkbox"]::before {
        content: '';
        width: 6px;
        height: 10px;
        margin-top: -1px;
        border-right: 2px solid #0b1120;
        border-bottom: 2px solid #0b1120;
        transform: scale(0) rotate(45deg);
        transform-origin: center;
        transition: transform .12s ease;
      }

      input[type="checkbox"]:hover {
        border-color: #62739f;
      }

      input[type="checkbox"]:checked {
        background: var(--accent);
        border-color: var(--accent);
        box-shadow: 0 0 0 1px rgba(143, 162, 255, .3);
      }

      input[type="checkbox"]:checked::before {
        transform: scale(1) rotate(45deg);
      }

      .text-muted { color: var(--muted); }
      .code {
        font-size: .79rem;
        border: 1px solid var(--line-soft);
        border-radius: 6px;
        padding: .16rem .3rem;
        background: #0d121d;
        word-break: break-all;
      }

      .code-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: .45rem;
      }

      .hline { height: 1px; background: var(--line-soft); }

      .notice {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: .75rem .86rem;
        margin-bottom: .9rem;
        background: rgba(18, 23, 35, .88);
      }

      .notice.error { border-color: rgba(255, 155, 155, .72); }
      .notice.success { border-color: rgba(137, 219, 173, .72); }

      .manager {
        display: grid;
        gap: .9rem;
        grid-template-columns: 250px minmax(0, 1fr);
      }

      .folder-list {
        display: grid;
        gap: .4rem;
      }

      .folder-btn {
        width: 100%;
        justify-content: flex-start;
        background: #121829;
      }

      .folder-btn.active {
        background: var(--primary);
        color: var(--primary-text);
        border-color: transparent;
      }

      .folder-meta {
        margin-left: auto;
        font-size: .72rem;
        opacity: .8;
      }

      .folder-files { display: none; }
      .folder-files.active { display: block; }

      .manager-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: .6rem;
        margin-bottom: .85rem;
        flex-wrap: wrap;
      }

      .manager-title {
        margin: 0;
        font-size: .92rem;
      }

      .manager-meta {
        display: inline-flex;
        align-items: center;
        gap: .42rem;
        flex-wrap: wrap;
      }

      .quota-chip {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: .22rem .56rem;
        color: var(--muted);
        font-size: .75rem;
      }

      .layout-switch {
        display: inline-flex;
        align-items: center;
        gap: .3rem;
      }

      .icon-btn {
        width: 34px;
        height: 34px;
        border: 1px solid var(--line);
        border-radius: 9px;
        background: #12192a;
        color: var(--text);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        cursor: pointer;
      }

      .icon-btn:hover { border-color: #3a4660; }
      .icon-btn.small {
        width: 30px;
        height: 30px;
      }
      .icon-btn svg {
        width: 16px;
        height: 16px;
      }

      .layout-btn.active {
        background: #1e283e;
        border-color: #435178;
        color: var(--accent-strong);
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: .45rem;
        margin-bottom: .78rem;
      }

      .file-grid {
        display: grid;
        gap: .72rem;
        grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      }

      .file-grid.layout-list {
        display: grid;
        grid-template-columns: 1fr;
      }

      .file-card {
        border: 1px solid var(--line-soft);
        border-radius: 12px;
        background: #0f1626;
        padding: .52rem;
        text-align: left;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        gap: .2rem;
        white-space: normal;
        overflow: visible;
      }

      .file-card.active {
        border-color: #6074a8;
        background: #1a2234;
      }

      .thumb {
        height: 156px;
        border: 1px solid #2e3a57;
        border-radius: 9px;
        background: #0a111f;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        margin-bottom: .5rem;
      }

      .thumb-media {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        background: #0a111f;
      }

      .thumb-icon {
        color: #7f8eb1;
      }

      .file-info {
        display: grid;
        gap: .2rem;
        min-width: 0;
      }

      .file-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: .35rem;
        width: 100%;
        min-width: 0;
      }

      .file-name {
        display: block;
        width: 100%;
        min-width: 0;
        font-size: .8rem;
        font-weight: 700;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .file-actions {
        display: inline-flex;
        align-items: center;
        position: relative;
        flex: 0 0 auto;
        justify-self: end;
      }

      .file-menu {
        position: absolute;
        top: calc(100% + 6px);
        bottom: auto;
        right: 0;
        min-width: 200px;
        max-width: min(240px, calc(100vw - 1rem));
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #131b2b;
        box-shadow: var(--shadow);
        padding: .24rem;
        display: none;
        flex-direction: column;
        gap: .2rem;
        z-index: 30;
      }

      .file-menu.open { display: flex; }
      .file-menu.up {
        top: auto;
        bottom: calc(100% + 6px);
      }

      .menu-item {
        border: 1px solid transparent;
        background: transparent;
        color: var(--text);
        border-radius: 8px;
        text-align: left;
        justify-content: flex-start;
        gap: .36rem;
        font-size: .78rem;
        padding: .42rem .5rem;
      }

      .menu-item i {
        width: 14px;
        height: 14px;
        flex: 0 0 auto;
      }

      .menu-item:hover { border-color: #334160; }

      .menu-item.danger-item {
        color: #ffd4d4;
      }

      .menu-item.danger-item:hover {
        border-color: rgba(255, 155, 155, .55);
        background: rgba(77, 25, 33, .32);
      }

      .menu-item:disabled {
        opacity: .45;
        cursor: not-allowed;
      }

      .file-sub {
        display: block;
        width: 100%;
        color: var(--muted);
        font-size: .73rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .file-grid.layout-list .file-card {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 62px;
        align-items: center;
        gap: .55rem;
      }

      .file-grid.layout-list .thumb {
        order: 2;
        width: 62px;
        height: 62px;
        margin-bottom: 0;
      }

      .file-grid.layout-list .file-info {
        order: 1;
      }

      .toast {
        position: fixed;
        right: 1rem;
        bottom: 1rem;
        z-index: 160;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #12192b;
        color: var(--text);
        padding: .52rem .7rem;
        opacity: 0;
        transform: translateY(6px);
        pointer-events: none;
        transition: opacity .16s ease, transform .16s ease;
      }

      .toast.open {
        opacity: 1;
        transform: translateY(0);
      }

      .toast.error {
        border-color: rgba(255, 155, 155, .72);
        color: #ffd4d4;
      }

      .viewer-modal {
        position: fixed;
        inset: 0;
        z-index: 120;
        display: none;
        background: rgba(8, 11, 17, .78);
        backdrop-filter: blur(3px);
      }

      .viewer-modal.open {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: clamp(.35rem, 1.5vw, 1rem);
      }

      .viewer-shell {
        width: min(1500px, 100%);
        max-width: 100%;
        height: min(900px, calc(100vh - 2rem));
        max-height: calc(100vh - 2rem);
        border: 1px solid var(--line);
        border-radius: 14px;
        background: #0f141e;
        box-shadow: var(--shadow);
        display: grid;
        grid-template-rows: auto 1fr;
        overflow: hidden;
      }

      .viewer-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: .7rem;
        min-width: 0;
        padding: .72rem .9rem;
        border-bottom: 1px solid var(--line-soft);
      }

      .viewer-title {
        margin: 0;
        font-size: .9rem;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .viewer-body {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 360px;
        min-height: 0;
      }

      .viewer-stage {
        background: #0a0f17;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: .8rem;
        min-height: 0;
        overflow: hidden;
      }

      .viewer-stage.empty {
        color: var(--muted);
      }

      .viewer-media {
        width: auto;
        height: auto;
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        border: 0;
        border-radius: 10px;
        background: #05080e;
      }

      .viewer-frame {
        width: 100%;
        height: 100%;
        min-height: 320px;
        border: 0;
        border-radius: 10px;
        background: #05080e;
      }

      .viewer-side {
        border-left: 1px solid var(--line-soft);
        background: #101622;
        padding: .85rem;
        min-height: 0;
        overflow: auto;
      }

      .viewer-meta {
        display: grid;
        gap: .36rem;
        margin-bottom: .75rem;
      }

      .viewer-meta-row {
        color: var(--muted);
        overflow-wrap: anywhere;
      }

      .viewer-meta-row strong {
        color: var(--text);
        display: block;
        margin-top: .12rem;
        overflow-wrap: anywhere;
        word-break: break-word;
        line-height: 1.3;
      }

      .org-grid,
      .key-grid,
      .settings-grid {
        display: grid;
        gap: .9rem;
        grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
      }

      .org-file-list {
        display: grid;
        gap: .58rem;
      }

      .org-file-row {
        border: 1px solid var(--line-soft);
        border-radius: 10px;
        padding: .52rem .58rem;
        background: #101828;
        display: grid;
        gap: .35rem;
      }

      .org-file-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: .5rem;
      }

      .org-file-name {
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .status-chip {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: .16rem .5rem;
        font-size: .71rem;
        color: var(--muted);
        background: #101726;
      }

      .status-chip.ok {
        color: #c9f5dd;
        border-color: rgba(137, 219, 173, .58);
      }

      .status-chip.key-list {
        max-width: min(680px, 100%);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      details {
        border: 1px solid var(--line-soft);
        border-radius: 10px;
        padding: .58rem;
        background: #111829;
      }

      summary {
        cursor: pointer;
        font-weight: 700;
      }

      @media (max-width: 980px) {
        .mobile-warning {
          display: block;
        }

        .home-grid {
          grid-template-columns: 1fr;
        }

        .manager {
          grid-template-columns: 1fr;
        }

        .nav {
          gap: .34rem;
        }

        .nav-btn {
          flex: 1 1 calc(50% - .34rem);
        }
      }

      @media (max-width: 1260px) {
        .viewer-body {
          grid-template-columns: 1fr;
        }

        .viewer-stage {
          min-height: clamp(220px, 52vh, 520px);
        }

        .viewer-side {
          border-left: 0;
          border-top: 1px solid var(--line-soft);
          max-height: clamp(200px, 34vh, 360px);
        }
      }

      @media (max-width: 760px) {
        .app {
          padding: .65rem;
        }

        .app-footer {
          justify-content: center;
          text-align: center;
        }

        .viewer-modal.open {
          align-items: stretch;
          padding: .35rem;
        }

        .viewer-shell {
          width: 100%;
          height: calc(100vh - .7rem);
          max-height: calc(100vh - .7rem);
          border-radius: 12px;
        }

        .viewer-top {
          padding: .6rem .66rem;
          flex-wrap: wrap;
          gap: .52rem;
        }

        .viewer-top > .btn {
          margin-left: auto;
          padding: .38rem .56rem;
          font-size: .79rem;
        }

        .viewer-stage {
          padding: .5rem;
          min-height: 42vh;
        }

        .viewer-side {
          padding: .68rem;
          max-height: 45vh;
        }

        .viewer-meta-row {
          font-size: .78rem;
          word-break: break-word;
        }

        .viewer-side .cluster {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: .38rem;
        }

        .viewer-side .cluster > .btn {
          width: 100%;
        }

        .viewer-side form .btn.primary {
          width: 100%;
        }

        .toolbar > input[type="file"],
        .toolbar > input[type="number"],
        .toolbar > button {
          width: 100%;
          max-width: none !important;
        }

        .file-grid {
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        }

        .file-grid.layout-list .file-card {
          grid-template-columns: minmax(0, 1fr) 52px;
        }

        .file-grid.layout-list .thumb {
          width: 52px;
          height: 52px;
        }

        .file-menu {
          right: 0;
          min-width: 182px;
        }
      }

      @media (max-width: 480px) {
        .viewer-modal.open {
          padding: 0;
        }

        .viewer-shell {
          height: 100vh;
          max-height: 100vh;
          border-radius: 0;
          border-left: 0;
          border-right: 0;
        }
      }
    </style>
    <script src="https://unpkg.com/htmx.org@1.9.12"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
  </head>
  <body>
    ${body}
    <script>
      const TABS = ['home', 'folderi', 'organizacija', 'kljucevi', 'podesavanja', 'about'];
      const LAYOUTS = ['grid', 'list'];
      const LS_TAB_KEY = 'sen.admin.tab';
      const LS_LAYOUT_KEY = 'sen.admin.layout';

      const byId = (id) => document.getElementById(id);
      const safeGet = (key) => {
        try {
          return window.localStorage.getItem(key);
        } catch (_) {
          return null;
        }
      };
      const safeSet = (key, value) => {
        try {
          window.localStorage.setItem(key, value);
        } catch (_) {}
      };

      const activateTab = (tabName) => {
        const selected = TABS.includes(tabName) ? tabName : 'home';
        window.__senTab = selected;
        safeSet(LS_TAB_KEY, selected);

        document.querySelectorAll('[data-tab]').forEach((el) => {
          el.classList.toggle('active', el.dataset.tab === selected);
        });

        document.querySelectorAll('[data-tab-panel]').forEach((el) => {
          el.classList.toggle('active', el.dataset.tabPanel === selected);
        });
      };

      const activateLayout = (layoutName) => {
        const selected = LAYOUTS.includes(layoutName) ? layoutName : 'grid';
        window.__senLayout = selected;
        safeSet(LS_LAYOUT_KEY, selected);

        document.querySelectorAll('[data-layout-btn]').forEach((el) => {
          el.classList.toggle('active', el.dataset.layoutBtn === selected);
        });

        document.querySelectorAll('[data-file-grid]').forEach((el) => {
          el.classList.toggle('layout-grid', selected === 'grid');
          el.classList.toggle('layout-list', selected === 'list');
        });
      };

      const absoluteUrl = (rawPath) => {
        if (!rawPath) return '';
        if (/^https?:\\/\\//i.test(rawPath)) return rawPath;
        return window.location.origin + (rawPath.startsWith('/') ? rawPath : '/' + rawPath);
      };

      const showToast = (message, error = false) => {
        let toast = byId('sen-toast');
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'sen-toast';
          toast.className = 'toast';
          document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.toggle('error', Boolean(error));
        toast.classList.add('open');

        if (window.__senToastTimer) {
          window.clearTimeout(window.__senToastTimer);
        }
        window.__senToastTimer = window.setTimeout(() => {
          toast.classList.remove('open');
        }, 1700);
      };

      const copyText = async (value) => {
        try {
          await navigator.clipboard.writeText(value);
          return true;
        } catch (_) {
          const area = document.createElement('textarea');
          area.value = value;
          area.setAttribute('readonly', '');
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          const ok = document.execCommand('copy');
          area.remove();
          return ok;
        }
      };

      const closeMenus = () => {
        document.querySelectorAll('[data-file-menu].open').forEach((el) => el.classList.remove('open'));
        document.querySelectorAll('[data-file-menu].up').forEach((el) => el.classList.remove('up'));
      };

      const openMenu = (menu) => {
        if (!menu) return;
        menu.classList.add('open');
        menu.classList.remove('up');

        const downRect = menu.getBoundingClientRect();
        if (downRect.bottom <= window.innerHeight - 8) {
          return;
        }

        menu.classList.add('up');
        const upRect = menu.getBoundingClientRect();
        if (upRect.top < 8) {
          menu.classList.remove('up');
        }
      };

      const prepareThumbVideos = () => {
        document.querySelectorAll('.thumb video').forEach((video) => {
          const element = video;
          if (element.dataset.thumbPrepared === '1') {
            element.pause();
            return;
          }

          element.dataset.thumbPrepared = '1';
          element.muted = true;
          element.autoplay = false;
          element.loop = false;
          element.controls = false;
          element.playsInline = true;
          element.preload = 'metadata';
          element.pause();

          const seekFirstFrame = () => {
            try {
              const target = element.duration && Number.isFinite(element.duration)
                ? Math.min(0.05, element.duration / 2)
                : 0.01;
              element.currentTime = target;
            } catch (_) {}
          };

          if (element.readyState >= 1) {
            seekFirstFrame();
          } else {
            element.load();
            element.addEventListener('loadedmetadata', seekFirstFrame, { once: true });
          }

          element.addEventListener('seeked', () => {
            element.pause();
          }, { once: true });
        });
      };

      const clearViewer = () => {
        const title = byId('viewer-title');
        const pid = byId('viewer-public-id');
        const fname = byId('viewer-file-name');
        const fsize = byId('viewer-file-size');
        const fvis = byId('viewer-file-vis');
        const fext = byId('viewer-file-ext');
        const fhash = byId('viewer-file-hash');
        const open = byId('viewer-open');
        const del = byId('viewer-delete');
        const meta = byId('viewer-meta-form');
        const pcheck = byId('viewer-public-check');
        const prl = byId('viewer-rl');
        const stage = byId('viewer-stage');

        if (title) title.textContent = 'Преглед фајла';
        if (pid) pid.textContent = '-';
        if (fname) fname.textContent = '-';
        if (fsize) fsize.textContent = '-';
        if (fvis) fvis.textContent = '-';
        if (fext) fext.textContent = '-';
        if (fhash) fhash.textContent = '-';
        if (open) open.href = '#';
        if (del) del.setAttribute('hx-delete', '');
        if (meta) meta.setAttribute('hx-patch', '');
        if (pcheck) pcheck.checked = false;
        if (prl) prl.value = '';

        if (stage) {
          stage.classList.add('empty');
          stage.textContent = 'Изабери фајл за преглед.';
        }

        if (window.htmx) {
          if (del) window.htmx.process(del);
          if (meta) window.htmx.process(meta);
        }
      };

      const stopViewerMedia = () => {
        const stage = byId('viewer-stage');
        if (!stage) return;

        stage.querySelectorAll('video, audio').forEach((node) => {
          const media = node;
          try {
            media.pause();
            media.currentTime = 0;
          } catch (_) {}
          media.removeAttribute('src');
          try {
            media.load();
          } catch (_) {}
        });

        stage.querySelectorAll('iframe').forEach((frame) => {
          frame.src = 'about:blank';
        });
      };

      const closeViewer = () => {
        stopViewerMedia();
        clearViewer();
        const modal = byId('viewer-modal');
        if (modal) {
          modal.classList.remove('open');
        }
        document.body.classList.remove('modal-open');
      };

      const openViewer = (card) => {
        if (!card) return;

        const data = {
          id: card.dataset.fileId || '',
          name: card.dataset.fileName || 'Фајл',
          publicId: card.dataset.filePublicId || '-',
          size: card.dataset.fileSize || '-',
          vis: card.dataset.filePublic === '1' ? 'Јавно' : 'Приватно',
          kind: card.dataset.fileKind || 'other',
          ext: card.dataset.fileExt || 'FILE',
          hash: card.dataset.fileHash || '-',
          url: card.dataset.fileUrl || '',
          rl: card.dataset.fileRl || '',
          isPublic: card.dataset.filePublic === '1'
        };

        window.__senViewerFile = data.id;

        const title = byId('viewer-title');
        const pid = byId('viewer-public-id');
        const fname = byId('viewer-file-name');
        const fsize = byId('viewer-file-size');
        const fvis = byId('viewer-file-vis');
        const fext = byId('viewer-file-ext');
        const fhash = byId('viewer-file-hash');
        const open = byId('viewer-open');
        const del = byId('viewer-delete');
        const meta = byId('viewer-meta-form');
        const pcheck = byId('viewer-public-check');
        const prl = byId('viewer-rl');
        const stage = byId('viewer-stage');
        const modal = byId('viewer-modal');

        if (title) title.textContent = data.name;
        if (pid) pid.textContent = data.publicId;
        if (fname) fname.textContent = data.name;
        if (fsize) fsize.textContent = data.size;
        if (fvis) fvis.textContent = data.vis;
        if (fext) fext.textContent = data.ext;
        if (fhash) fhash.textContent = data.hash;
        if (open) open.href = data.url;
        if (del) del.setAttribute('hx-delete', '/admin/file/' + data.id);
        if (meta) meta.setAttribute('hx-patch', '/admin/file/' + data.id);
        if (pcheck) pcheck.checked = data.isPublic;
        if (prl) prl.value = data.rl;

        if (window.htmx) {
          if (del) window.htmx.process(del);
          if (meta) window.htmx.process(meta);
        }

        if (stage) {
          stage.classList.remove('empty');
          stage.innerHTML = '';

          if (data.kind === 'image') {
            const img = document.createElement('img');
            img.src = data.url;
            img.alt = data.name;
            img.className = 'viewer-media';
            stage.appendChild(img);
          } else if (data.kind === 'video') {
            const video = document.createElement('video');
            video.src = data.url;
            video.controls = true;
            video.preload = 'metadata';
            video.playsInline = true;
            video.className = 'viewer-media';
            stage.appendChild(video);
          } else if (data.kind === 'audio') {
            const audio = document.createElement('audio');
            audio.src = data.url;
            audio.controls = true;
            audio.style.width = '100%';
            stage.appendChild(audio);
          } else if (data.kind === 'pdf' || data.kind === 'text') {
            const frame = document.createElement('iframe');
            frame.src = data.url;
            frame.className = 'viewer-frame';
            frame.title = data.name;
            stage.appendChild(frame);
          } else {
            stage.classList.add('empty');
            stage.textContent = 'Нема директног прегледа за овај тип фајла.';
          }
        }

        if (modal) {
          modal.classList.add('open');
        }
        document.body.classList.add('modal-open');
      };

      const selectCard = (card) => {
        if (!card) return;
        window.__senFile = card.dataset.fileId || '';
        closeMenus();
        document.querySelectorAll('[data-file-card]').forEach((el) => el.classList.remove('active'));
        card.classList.add('active');
      };

      const activateFolder = (folderId) => {
        const folderButtons = Array.from(document.querySelectorAll('[data-folder-id]'));
        if (folderButtons.length === 0) {
          return;
        }

        let selected = String(folderId || '');
        if (!folderButtons.some((el) => el.dataset.folderId === selected)) {
          selected = folderButtons[0].dataset.folderId || '';
        }
        window.__senFolder = selected;

        folderButtons.forEach((el) => {
          el.classList.toggle('active', el.dataset.folderId === selected);
        });

        document.querySelectorAll('[data-folder-files]').forEach((el) => {
          el.classList.toggle('active', el.dataset.folderFiles === selected);
        });

        const savedCard = window.__senFile
          ? document.querySelector('[data-folder-files="' + selected + '"] [data-file-id="' + window.__senFile + '"]')
          : null;

        document.querySelectorAll('[data-file-card]').forEach((el) => el.classList.remove('active'));
        if (savedCard) {
          selectCard(savedCard);
          return;
        }

        window.__senFile = '';
        clearViewer();
      };

      const initState = () => {
        const linkedTab = window.location.hash.slice(1);
        activateTab(window.__senTab || (TABS.includes(linkedTab) ? linkedTab : safeGet(LS_TAB_KEY)) || 'home');
        activateFolder(document.querySelector('[data-folder-files]')?.dataset.folderFiles);
        activateLayout(window.__senLayout || safeGet(LS_LAYOUT_KEY) || 'grid');
        closeMenus();
        prepareThumbVideos();

        if (window.__senFile) {
          const saved = document.querySelector('[data-file-id="' + window.__senFile + '"]');
          if (saved) {
            selectCard(saved);
          }
        }

        clearViewer();

        if (window.lucide) {
          window.lucide.createIcons();
        }
      };

      document.addEventListener('click', (event) => {
        const copyControl = event.target.closest('[data-copy-value]');
        if (copyControl) {
          event.preventDefault();
          event.stopPropagation();
          const payload = copyControl.dataset.copyValue || '';
          const label = copyControl.dataset.copyLabel || 'Копирано.';
          if (!payload) {
            showToast('Нема податка за копирање.', true);
            return;
          }
          void copyText(payload).then((ok) => {
            showToast(ok ? label : 'Копирање није успело.', !ok);
          });
          return;
        }

        const layoutBtn = event.target.closest('[data-layout-btn]');
        if (layoutBtn) {
          event.preventDefault();
          activateLayout(layoutBtn.dataset.layoutBtn || 'grid');
          return;
        }

        const menuToggle = event.target.closest('[data-file-menu-toggle]');
        if (menuToggle) {
          event.preventDefault();
          event.stopPropagation();
          const menu = menuToggle.parentElement?.querySelector('[data-file-menu]');
          if (!menu) return;
          const shouldOpen = !menu.classList.contains('open');
          closeMenus();
          if (shouldOpen) {
            openMenu(menu);
          }
          return;
        }

        const menuAction = event.target.closest('[data-menu-action]');
        if (menuAction) {
          event.preventDefault();
          event.stopPropagation();
          const card = menuAction.closest('[data-file-card]');
          if (!card) return;

          const action = menuAction.dataset.menuAction || '';
          let payload = '';
          let successLabel = '';

          if (action === 'copy-public') {
            if (card.dataset.filePublic !== '1') {
              showToast('Фајл није јаван.', true);
              closeMenus();
              return;
            }
            payload = absoluteUrl(card.dataset.filePublicUrl || '');
            successLabel = 'Копиран јавни URL.';
          } else if (action === 'copy-private') {
            payload = absoluteUrl(card.dataset.filePrivateUrl || '');
            successLabel = 'Копиран приватни URL.';
          } else if (action === 'copy-id') {
            payload = card.dataset.fileId || '';
            successLabel = 'Копиран ID фајла.';
          } else if (action === 'delete-file') {
            const fileId = card.dataset.fileId || '';
            if (!fileId) {
              showToast('Нема ID фајла.', true);
              closeMenus();
              return;
            }

            const allow = window.confirm('Обрисати овај фајл?');
            if (!allow) {
              closeMenus();
              return;
            }

            if (window.htmx && typeof window.htmx.ajax === 'function') {
              window.htmx.ajax('DELETE', '/admin/file/' + fileId, {
                target: '#content',
                swap: 'outerHTML'
              });
              showToast('Фајл је послат на брисање.');
            } else {
              fetch('/admin/file/' + fileId, { method: 'DELETE' })
                .then(() => window.location.reload())
                .catch(() => showToast('Брисање није успело.', true));
            }
            closeMenus();
            return;
          }

          if (!payload) {
            showToast('Нема податка за копирање.', true);
            closeMenus();
            return;
          }

          void copyText(payload).then((ok) => {
            showToast(ok ? successLabel : 'Копирање није успело.', !ok);
          });
          closeMenus();
          return;
        }

        if (!event.target.closest('[data-file-menu]')) {
          closeMenus();
        }

        const tab = event.target.closest('[data-tab]');
        if (tab) {
          event.preventDefault();
          activateTab(tab.dataset.tab || 'home');
          return;
        }

        const fileCard = event.target.closest('[data-file-card]');
        if (fileCard) {
          if (event.target.closest('[data-file-menu]')) {
            return;
          }
          event.preventDefault();
          selectCard(fileCard);
          return;
        }

        if (event.target.closest('[data-viewer-close]')) {
          event.preventDefault();
          closeViewer();
          return;
        }

        const modal = byId('viewer-modal');
        if (modal && event.target === modal) {
          closeViewer();
        }
      });

      document.addEventListener('dblclick', (event) => {
        const fileCard = event.target.closest('[data-file-card]');
        if (!fileCard) return;
        if (event.target.closest('[data-file-menu]')) {
          return;
        }
        event.preventDefault();
        selectCard(fileCard);
        openViewer(fileCard);
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          closeMenus();
          closeViewer();
          return;
        }

        if (event.target.closest('[data-file-menu]')) return;
        const fileCard = event.target.closest('[data-file-card]');
        if (!fileCard) return;
        if (event.key === 'Enter' && event.target === fileCard) {
          event.preventDefault();
          selectCard(fileCard);
          openViewer(fileCard);
        }
      });

      document.addEventListener('DOMContentLoaded', initState);
      document.body.addEventListener('htmx:afterSwap', initState);
      window.addEventListener('resize', closeMenus);
      document.addEventListener('scroll', closeMenus, true);
    </script>
  </body>
</html>`;
}

function noticeBlock(notice: Notice) {
  const klass = notice.error ? 'error' : 'success';
  return `<section class="notice ${klass}">
    <div class="stack">
      <strong>${escapeHtml(notice.text)}</strong>
      ${
        notice.secret
          ? `<span class="text-muted">Нови кључ (приказује се само једном):</span>
             <div class="code-row">
               <span class="code">${escapeHtml(notice.secret)}</span>
               <button
                 class="icon-btn small"
                 type="button"
                 data-copy-value="${escapeHtml(notice.secret)}"
                 data-copy-label="Копиран нови АПИ кључ."
                 aria-label="Копирај нови АПИ кључ"
                 title="Копирај нови АПИ кључ"
               >
                 <i data-lucide="copy"></i>
               </button>
             </div>`
          : ''
      }
    </div>
  </section>`;
}

export function renderAdminLogin(error?: string) {
  return shell(
    'Сен · Пријава',
    `<main class="app">
      <section class="panel" style="max-width:460px;margin:11vh auto 0;">
        <header class="panel-head">
          <h2 class="panel-title"><i data-lucide="shield"></i> Админ пријава</h2>
        </header>
        <div class="panel-body stack">
          ${error ? `<section class="notice error"><strong>${escapeHtml(error)}</strong></section>` : ''}
          <form action="/admin" method="post" class="stack">
            <div class="field">
              <label for="lozinka">Лозинка</label>
              <input id="lozinka" name="lozinka" type="password" required />
            </div>
            <button type="submit" class="btn primary">Уђи у контролну таблу</button>
          </form>
        </div>
      </section>
    </main>`
  );
}

export function renderDashboardPage(content: string) {
  const currentYear = new Date().getFullYear();
  return shell(
    'Сен · Контролна табла',
    `<main class="app">
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark"></span>
          <h1 class="brand-title">Сен · Контролна табла</h1>
        </div>
        <form action="/admin/logout" method="post">
          <button class="btn ghost" type="submit"><i data-lucide="log-out"></i> Одјава</button>
        </form>
      </header>

      <nav class="nav">
        <button type="button" class="nav-btn active" data-tab="home"><i data-lucide="house"></i> Админ</button>
        <button type="button" class="nav-btn" data-tab="folderi"><i data-lucide="folders"></i> Фолдери</button>
        <button type="button" class="nav-btn" data-tab="organizacija"><i data-lucide="layout-grid"></i> Организација</button>
        <button type="button" class="nav-btn" data-tab="kljucevi"><i data-lucide="key-round"></i> АПИ кључеви</button>
        <button type="button" class="nav-btn" data-tab="podesavanja"><i data-lucide="settings"></i> Подешавања</button>
        <button type="button" class="nav-btn" data-tab="about"><i data-lucide="info"></i> О Сен</button>
      </nav>

      <section class="mobile-warning">
        Мобилни приказ је ограничен. Нису све UI функције подржане на телефону; за пун рад користи десктоп.
      </section>

      ${content}

      <footer class="app-footer">
        <span>© ${currentYear} Sen</span>
        <span class="footer-made">
          Made in Serbia · Са <i data-lucide="heart" class="footer-heart"></i> од
          <a href="https://crnbg.org" target="_blank" rel="noopener noreferrer">crnbg.org</a>
        </span>
      </footer>
    </main>`
  );
}

function assignedFolder(set: Assignment[], apiKeyId: number, folderId: number) {
  return set.some((row) => row.apiKeyId === apiKeyId && row.folderId === folderId);
}

function assignedFile(set: Assignment[], apiKeyId: number, fileId: number) {
  return set.some((row) => row.apiKeyId === apiKeyId && row.fileId === fileId);
}

export function renderDashboardContent(data: DashboardData) {
  const notice = data.notice ? noticeBlock(data.notice) : '';

  const folderAccess = new Map<number, Set<number>>();
  const apiKeyNameById = new Map<number, string>(data.apiKeys.map((row) => [row.id, row.ime]));
  for (const row of data.apiKeyFolders) {
    if (row.folderId === undefined) continue;
    const set = folderAccess.get(row.folderId) ?? new Set<number>();
    set.add(row.apiKeyId);
    folderAccess.set(row.folderId, set);
  }

  const fileAccess = new Map<number, Set<number>>();
  for (const row of data.apiKeyFiles) {
    if (row.fileId === undefined) continue;
    const set = fileAccess.get(row.fileId) ?? new Set<number>();
    set.add(row.apiKeyId);
    fileAccess.set(row.fileId, set);
  }
  for (const file of data.files) {
    const folderSet = folderAccess.get(file.folderId);
    if (!folderSet || folderSet.size === 0) continue;
    const set = fileAccess.get(file.id) ?? new Set<number>();
    for (const apiId of folderSet) {
      set.add(apiId);
    }
    fileAccess.set(file.id, set);
  }

  const trafficByApi = new Map(data.traffic.apiKeyStats.map((row) => [row.apiKeyId, row]));
  const homeTrafficRows = data.apiKeys
    .map((key) => {
      const row = trafficByApi.get(key.id);
      return {
        id: key.id,
        ime: key.ime,
        totalRequests: row?.totalRequests ?? 0,
        minuteRequests: row?.minuteRequests ?? 0,
        windows: row?.windows ?? {
          d1: 0,
          m1: 0,
          m3: 0,
          m6: 0,
          m12: 0
        }
      };
    })
    .sort((a, b) => b.totalRequests - a.totalRequests || b.minuteRequests - a.minuteRequests || a.ime.localeCompare(b.ime));

  const maxApiTraffic = Math.max(1, ...homeTrafficRows.map((row) => row.totalRequests));
  const homeTraffic = homeTrafficRows
    .map((row) => {
      const width = Math.max(4, Math.round((row.totalRequests / maxApiTraffic) * 100));
      return `<article class="traffic-row">
        <div class="traffic-row-top">
          <strong class="traffic-row-name">${escapeHtml(row.ime)}</strong>
          <span class="text-muted">#${row.id}</span>
        </div>
        <div class="traffic-meter">
          <div class="traffic-meter-bar" style="width:${width}%"></div>
        </div>
        <div class="traffic-row-meta">
          <span>мин: ${formatCount(row.minuteRequests)}</span>
          <span>укупно: ${formatCount(row.totalRequests)}</span>
        </div>
        <div class="traffic-row-meta">
          <span>1д: ${formatCount(row.windows.d1)}</span>
          <span>1м: ${formatCount(row.windows.m1)}</span>
          <span>3м: ${formatCount(row.windows.m3)}</span>
          <span>6м: ${formatCount(row.windows.m6)}</span>
          <span>12м: ${formatCount(row.windows.m12)}</span>
        </div>
      </article>`;
    })
    .join('');

  const globalQuotaUsed = data.folders.reduce((sum, folder) => sum + folder.quotaUsed, 0);
  const globalQuotaMax = data.folders.reduce((sum, folder) => sum + folder.quotaMax, 0);
  const globalQuotaPercent = globalQuotaMax > 0 ? (globalQuotaUsed / globalQuotaMax) * 100 : 0;

  const dashboardLink = (folder = data.selectedFolderId, page = data.folderPage.page, catalog = data.catalogPage.page) =>
    `/admin/dash?folder=${folder ?? ''}&amp;page=${page}&amp;catalog=${catalog}`;
  function pagination(tab: 'folderi' | 'organizacija' | 'kljucevi') {
    const { page, pages } = tab === 'folderi' ? data.folderPage : data.catalogPage;
    if (pages < 2) return '';
    const href = (n: number) => (tab === 'folderi'
      ? dashboardLink(data.selectedFolderId, n) : dashboardLink(data.selectedFolderId, data.folderPage.page, n)) + '#' + tab;
    return `<nav class="cluster" aria-label="Странице фајлова">
      ${page > 1 ? `<a class="btn small" href="${href(page - 1)}">Претходна</a>` : ''}
      <form class="cluster" action="/admin/dash#${tab}" method="get">
        <input type="hidden" name="folder" value="${data.selectedFolderId ?? ''}" />
        <input type="hidden" name="${tab === 'folderi' ? 'catalog' : 'page'}" value="${tab === 'folderi' ? data.catalogPage.page : data.folderPage.page}" />
        <label>Страница <input type="number" name="${tab === 'folderi' ? 'page' : 'catalog'}"
          min="1" max="${pages}" value="${page}" required style="width:5rem" /> од ${pages}</label>
        <button class="btn small" type="submit">Иди</button>
      </form>
      ${page < pages ? `<a class="btn small" href="${href(page + 1)}">Следећа</a>` : ''}
    </nav>`;
  }

  const folderButtons = data.folders
    .map((folder) => {
      return `<a href="${dashboardLink(folder.id, 1)}#folderi" class="folder-btn" data-folder-id="${folder.id}">
        <i data-lucide="folder"></i>
        <span>${escapeHtml(folder.ime)}</span>
        <span class="folder-meta">${folder.fileCount}</span>
      </a>`;
    })
    .join('');

  const folderFilePanels = data.folders
    .filter((folder) => folder.id === data.selectedFolderId)
    .map((folder) => {
      const cards = data.folderFiles
        .map((file) => {
          const fileName = fileNameFromPath(file.serverskaPutanja);
          const ext = fileExt(fileName);
          const kind = previewKind(file.serverskaPutanja);
          const icon = iconForKind(kind);
          const rawUrl = `/admin/file/${file.id}/raw`;
          const publicUrl = `/f/${file.publicId}`;
          const privateUrl = `/private/file/${file.id}`;

          const thumb =
            kind === 'image'
              ? `<div class="thumb"><img class="thumb-media" src="${rawUrl}" alt="${escapeHtml(fileName)}" loading="lazy" /></div>`
              : kind === 'video'
                ? `<div class="thumb"><video class="thumb-media" src="${rawUrl}" muted playsinline preload="metadata"></video></div>`
              : `<div class="thumb"><i class="thumb-icon" data-lucide="${icon}"></i></div>`;

          return `<article
            class="file-card"
            tabindex="0"
            role="button"
            data-file-card
            data-file-id="${file.id}"
            data-file-name="${escapeHtml(fileName)}"
            data-file-public-id="${escapeHtml(file.publicId)}"
            data-file-size="${escapeHtml(formatBytes(file.velicina))}"
            data-file-public="${file.public ? '1' : '0'}"
            data-file-kind="${kind}"
            data-file-ext="${ext}"
            data-file-hash="${escapeHtml(file.contentHash ?? '-')}"
            data-file-url="${rawUrl}"
            data-file-rl="${file.rateLimitOverride ?? ''}"
            data-file-public-url="${publicUrl}"
            data-file-private-url="${privateUrl}"
          >
            ${thumb}
            <div class="file-info">
              <div class="file-row">
                <div class="file-name" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</div>
                <div class="file-actions">
                  <button type="button" class="icon-btn small" data-file-menu-toggle aria-label="Акције фајла">
                    <i data-lucide="more-horizontal"></i>
                  </button>
                  <div class="file-menu" data-file-menu>
                    <button class="menu-item" type="button" data-menu-action="copy-public" ${file.public ? '' : 'disabled'}>
                      <i data-lucide="copy"></i> Јавни URL
                    </button>
                    <button class="menu-item" type="button" data-menu-action="copy-private">
                      <i data-lucide="copy"></i> Приватни URL
                    </button>
                    <button class="menu-item" type="button" data-menu-action="copy-id">
                      <i data-lucide="hash"></i> ID фајла
                    </button>
                    <button class="menu-item danger-item" type="button" data-menu-action="delete-file">
                      <i data-lucide="trash-2"></i> Trash Обриши
                    </button>
                  </div>
                </div>
              </div>
              <div class="file-sub">${ext} · ${formatBytes(file.velicina)}</div>
            </div>
          </article>`;
        })
        .join('');

      return `<section class="folder-files" data-folder-files="${folder.id}">
        <div class="manager-header">
          <h3 class="manager-title">${escapeHtml(folder.ime)}</h3>
          <div class="manager-meta">
            <span class="quota-chip">${formatGb(folder.quotaUsed)} / ${formatGb(folder.quotaMax)} GB</span>
            <div class="layout-switch" aria-label="Приказ фајлова">
              <button type="button" class="icon-btn layout-btn active" data-layout-btn="grid" title="Grid приказ">
                <i data-lucide="grid-3x3"></i>
              </button>
              <button type="button" class="icon-btn layout-btn" data-layout-btn="list" title="Листа">
                <i data-lucide="list"></i>
              </button>
            </div>
          </div>
        </div>

        <form hx-post="/admin/upload" hx-encoding="multipart/form-data" hx-target="#content" hx-swap="outerHTML" class="toolbar">
          <input type="hidden" name="folder_id" value="${folder.id}" />
          <input type="file" name="file" required style="max-width:320px;" />
          <label><input type="checkbox" name="public" value="1" /> Јавно</label>
          <input type="number" min="0" name="rate_limit_override" placeholder="Локални лимит/мин" style="max-width:220px;" />
          <button class="btn primary" type="submit"><i data-lucide="upload"></i> Отпреми</button>
        </form>

        <div class="file-grid layout-grid" data-file-grid>
          ${cards || '<div class="text-muted">Нема фајлова у овом фолдеру.</div>'}
        </div>
        ${pagination('folderi')}
      </section>`;
    })
    .join('');

  const orgCards = data.folders
    .map((folder) => {
      const assignedCount = folderAccess.get(folder.id)?.size ?? 0;
      const status = assignedCount > 0
        ? `Додељен API кључевима: ${assignedCount}`
        : 'Није додељен ниједном API кључу';
      return `<article class="panel">
        <header class="panel-head">
          <h3 class="panel-title">${escapeHtml(folder.ime)} <span class="text-muted">#${folder.id}</span></h3>
          <span class="quota-chip">${formatGb(folder.quotaUsed)} / ${formatGb(folder.quotaMax)} GB</span>
        </header>
        <div class="panel-body">
          <div class="cluster" style="margin-bottom:.68rem;">
            <span class="status-chip ${assignedCount > 0 ? 'ok' : ''}">${status}</span>
          </div>
          <form hx-patch="/admin/folder/${folder.id}" hx-target="#content" hx-swap="outerHTML" class="stack">
            <div class="field">
              <label>Максимална квота (GB)</label>
              <input type="number" step="0.1" min="0" name="quota_max_gb" value="${formatGb(folder.quotaMax)}" />
            </div>
            <div class="field">
              <label>Локални лимит у минути</label>
              <input type="number" min="0" name="rate_limit_override" value="${folder.rateLimitOverride ?? ''}" />
            </div>
            <div class="cluster">
              <button class="btn" type="submit">Сачувај</button>
              <button class="btn danger" type="button" hx-delete="/admin/folder/${folder.id}" hx-target="#content" hx-swap="outerHTML">Обриши</button>
            </div>
          </form>
        </div>
      </article>`;
    })
    .join('');

  const orgFilesRows = data.files
    .map((file) => {
      const fileName = fileNameFromPath(file.serverskaPutanja);
      const apiIds = [...(fileAccess.get(file.id) ?? new Set<number>())].sort((a, b) => a - b);
      const apiCount = apiIds.length;
      const assigned = apiCount > 0;
      const apiNames = apiIds.map((id) => apiKeyNameById.get(id) ?? `#${id}`);
      const apiNamesLabel = apiNames.join(', ');
      return `<article class="org-file-row">
        <div class="org-file-head">
          <strong class="org-file-name" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</strong>
          <span class="text-muted">#${file.id}</span>
        </div>
        <div class="cluster">
          <span class="status-chip ${assigned ? 'ok' : ''}">
            ${assigned ? `Доступно API кључевима: ${apiCount}` : 'Ниједан API кључ нема приступ'}
          </span>
          ${
            assigned
              ? `<span class="status-chip key-list" title="${escapeHtml(apiNamesLabel)}">Кључеви: ${escapeHtml(apiNamesLabel)}</span>`
              : ''
          }
          <span class="status-chip">${escapeHtml(file.folderIme)}</span>
          <span class="status-chip">${file.public ? 'Јавно' : 'Приватно'}</span>
          <span class="status-chip">${escapeHtml(formatBytes(file.velicina))}</span>
          <a class="btn small" href="/admin/file/${file.id}/raw" target="_blank" rel="noopener noreferrer">
            <i data-lucide="eye"></i> View
          </a>
        </div>
      </article>`;
    })
    .join('');

  const keyCards = data.apiKeys
    .map((key) => {
      const folderAssign = data.folders
        .map((folder) => {
          const has = assignedFolder(data.apiKeyFolders, key.id, folder.id);
          return `<form ${has ? `hx-delete="/admin/apikey/${key.id}/folder/${folder.id}"` : `hx-post="/admin/apikey/${key.id}/folder/${folder.id}"`} hx-target="#content" hx-swap="outerHTML">
            <button class="btn small ${has ? 'danger' : ''}" type="submit">${has ? 'Одузми' : 'Додели'} ${escapeHtml(folder.ime)}</button>
          </form>`;
        })
        .join('');

      const fileAssign = data.files
        .map((file) => {
          const has = assignedFile(data.apiKeyFiles, key.id, file.id);
          return `<form ${has ? `hx-delete="/admin/apikey/${key.id}/file/${file.id}"` : `hx-post="/admin/apikey/${key.id}/file/${file.id}"`} hx-target="#content" hx-swap="outerHTML">
            <button class="btn small ${has ? 'danger' : ''}" type="submit">${has ? 'Одузми' : 'Додели'} #${file.id}</button>
          </form>`;
        })
        .join('');

      return `<article class="panel">
        <header class="panel-head">
          <h3 class="panel-title">${escapeHtml(key.ime)} <span class="text-muted">#${key.id}</span></h3>
        </header>
        <div class="panel-body stack">
          <div class="code-row">
            <span class="code">${escapeHtml(keyLabel(key.key))}</span>
            <span class="status-chip">Кључ је хеширан</span>
          </div>
          <span class="text-muted">Пуни АПИ кључ можеш копирати само после креирања или регенерације.</span>

          <form hx-patch="/admin/apikey/${key.id}" hx-target="#content" hx-swap="outerHTML" class="stack">
            <input type="hidden" name="can_upload" value="0" />
            <label><input type="checkbox" name="can_upload" value="1" ${key.canUpload ? 'checked' : ''}/> Дозволи отпремање</label>
            <input type="hidden" name="can_delete" value="0" />
            <label><input type="checkbox" name="can_delete" value="1" ${key.canDelete ? 'checked' : ''}/> Дозволи брисање</label>
            <div class="field">
              <label>Локални лимит у минути</label>
              <input type="number" min="0" name="rate_limit_override" value="${key.rateLimitOverride ?? ''}" />
            </div>
            <div class="cluster">
              <button class="btn" type="submit">Сачувај</button>
              <button class="btn" type="button" hx-post="/admin/apikey/${key.id}/revoke" hx-target="#content" hx-swap="outerHTML">Регенериши</button>
              <button class="btn danger" type="button" hx-delete="/admin/apikey/${key.id}" hx-target="#content" hx-swap="outerHTML">Обриши</button>
            </div>
          </form>

          <details>
            <summary>Доделе фолдера</summary>
            <div class="cluster" style="margin-top:.7rem;">${folderAssign || '<span class="text-muted">Нема фолдера.</span>'}</div>
          </details>

          <details>
            <summary>Доделе фајлова</summary>
            <div class="cluster" style="margin-top:.7rem;">${fileAssign || '<span class="text-muted">Нема фајлова.</span>'}</div>
          </details>
        </div>
      </article>`;
    })
    .join('');

  return `<section id="content" class="stack">
    ${notice}

    <section class="tab-section active" data-tab-panel="home">
      <div class="home-grid">
        <article class="panel">
          <header class="panel-head">
            <h3 class="panel-title"><i data-lucide="layout-dashboard"></i> Админ</h3>
            <span class="quota-chip">Проток уживо</span>
          </header>
          <div class="panel-body stack">
            <p class="hero-tag">СЕН MONITOR</p>
            <h2 class="pixel-title">Crnijada returns!</h2>
            <div class="kpi-grid">
              <article class="kpi">
                <span class="kpi-label">Укупно захтева</span>
                <strong class="kpi-value">${formatCount(data.traffic.totalRequests)}</strong>
              </article>
              <article class="kpi">
                <span class="kpi-label">Тренутни минут</span>
                <strong class="kpi-value">${formatCount(data.traffic.minuteRequests)}</strong>
              </article>
              <article class="kpi">
                <span class="kpi-label">Јавни захтеви (укупно)</span>
                <strong class="kpi-value">${formatCount(data.traffic.publicTotalRequests)}</strong>
              </article>
              <article class="kpi">
                <span class="kpi-label">Јавни захтеви (минут)</span>
                <strong class="kpi-value">${formatCount(data.traffic.publicMinuteRequests)}</strong>
              </article>
              <article class="kpi">
                <span class="kpi-label">Глобално заузеће</span>
                <strong class="kpi-value">${formatGb(globalQuotaUsed)} / ${formatGb(globalQuotaMax)} GB</strong>
                <span class="kpi-label">
                  ${globalQuotaMax > 0 ? `${globalQuotaPercent.toFixed(2)}% искоришћено` : 'Нема дефинисане квоте'}
                </span>
              </article>
            </div>
            <div class="cluster">
              <span class="status-chip">Јавно 1д: ${formatCount(data.traffic.publicWindows.d1)}</span>
              <span class="status-chip">Јавно 1м: ${formatCount(data.traffic.publicWindows.m1)}</span>
              <span class="status-chip">Јавно 3м: ${formatCount(data.traffic.publicWindows.m3)}</span>
              <span class="status-chip">Јавно 6м: ${formatCount(data.traffic.publicWindows.m6)}</span>
              <span class="status-chip">Јавно 12м: ${formatCount(data.traffic.publicWindows.m12)}</span>
            </div>
          </div>
        </article>

        <article class="panel">
          <header class="panel-head">
            <h3 class="panel-title"><i data-lucide="activity"></i> По API кључу</h3>
          </header>
          <div class="panel-body traffic-list">
            ${homeTraffic || '<span class="text-muted">Нема саобраћаја по API кључевима.</span>'}
          </div>
        </article>
      </div>
    </section>

    <section class="tab-section" data-tab-panel="folderi">
      <div class="manager">
        <aside class="panel">
          <header class="panel-head">
            <h3 class="panel-title"><i data-lucide="folder-tree"></i> Фолдери</h3>
          </header>
          <div class="panel-body folder-list">
            ${folderButtons || '<span class="text-muted">Нема фолдера.</span>'}
          </div>
        </aside>

        <section class="panel">
          <div class="panel-body">
            ${folderFilePanels || '<span class="text-muted">Нема фајлова.</span>'}
          </div>
        </section>
      </div>
    </section>

    <section class="tab-section" data-tab-panel="organizacija">
      <div class="org-grid">
        <article class="panel">
          <header class="panel-head">
            <h3 class="panel-title"><i data-lucide="folder-plus"></i> Нови фолдер</h3>
          </header>
          <div class="panel-body">
            <form hx-post="/admin/folder" hx-target="#content" hx-swap="outerHTML" class="stack">
              <div class="field">
                <label>Име фолдера</label>
                <input type="text" name="ime" required />
              </div>
              <div class="field">
                <label>Квота (GB, опционо)</label>
                <input type="number" step="0.1" min="0" name="quota_max_gb" />
              </div>
              <div class="field">
                <label>Локални лимит у минути (опционо)</label>
                <input type="number" min="0" name="rate_limit_override" />
              </div>
              <button class="btn primary" type="submit">Креирај фолдер</button>
            </form>
          </div>
        </article>

        <article class="panel" style="grid-column:1 / -1;">
          <header class="panel-head">
            <h3 class="panel-title"><i data-lucide="files"></i> Фајлови · assignment + view</h3>
          </header>
          <div class="panel-body org-file-list">
            ${pagination('organizacija')}
            ${orgFilesRows || '<span class="text-muted">Нема фајлова.</span>'}
          </div>
        </article>

        ${orgCards || '<article class="panel"><div class="panel-body text-muted">Нема фолдера.</div></article>'}
      </div>
    </section>

    <section class="tab-section" data-tab-panel="kljucevi">
      ${pagination('kljucevi')}
      <div class="key-grid">
        <article class="panel">
          <header class="panel-head">
            <h3 class="panel-title"><i data-lucide="key-round"></i> Нови АПИ кључ</h3>
          </header>
          <div class="panel-body">
            <form hx-post="/admin/apikey" hx-target="#content" hx-swap="outerHTML" class="stack">
              <div class="field">
                <label>Име кључа</label>
                <input type="text" name="ime" required />
              </div>
              <label><input type="checkbox" name="can_upload" value="1" /> Дозволи отпремање</label>
              <label><input type="checkbox" name="can_delete" value="1" /> Дозволи брисање</label>
              <div class="field">
                <label>Локални лимит у минути (опционо)</label>
                <input type="number" min="0" name="rate_limit_override" />
              </div>
              <button class="btn primary" type="submit">Креирај АПИ кључ</button>
            </form>
          </div>
        </article>

        ${keyCards || '<article class="panel"><div class="panel-body text-muted">Нема АПИ кључева.</div></article>'}
      </div>
    </section>

    <section class="tab-section" data-tab-panel="podesavanja">
      <div class="settings-grid">
        <article class="panel">
          <header class="panel-head">
            <h3 class="panel-title"><i data-lucide="settings"></i> Глобална подешавања</h3>
          </header>
          <div class="panel-body">
            <form hx-patch="/admin/settings" hx-target="#content" hx-swap="outerHTML" class="stack">
              <div class="field">
                <label>Глобални лимит захтева по минуту</label>
                <input type="number" min="1" name="global_rate_limit" value="${data.settings.globalRateLimit}" />
              </div>
              <div class="field">
                <label>Подразумевана квота фолдера (GB)</label>
                <input type="number" min="0" step="0.1" name="global_default_quota_gb" value="${formatGb(data.settings.globalDefaultQuota)}" />
              </div>
              <button class="btn primary" type="submit">Сачувај подешавања</button>
            </form>
          </div>
        </article>
      </div>
    </section>

    <section class="tab-section" data-tab-panel="about">
      <div class="about-grid">
        <article class="panel">
          <header class="panel-head">
            <h3 class="panel-title"><i data-lucide="shield-check"></i> О Сен-у</h3>
          </header>
          <div class="panel-body stack">
            <p class="about-lead">
              Сен је self-hosted CDN за Raspberry Pi: чување фајлова на локалном диску,
              јавни/приватни приступ, квоте по фолдеру и rate-limit хијерархија.
            </p>
            <p class="about-lead">Назив „Сен“ је изведен из српске речи „сенка“.</p>
            <p class="about-lead">Производ: <strong>CRNBG.ORG</strong>.</p>
            <p class="about-lead">
              Власништво: <strong>crnobog / crnijada / vltc</strong> је иста особа.
            </p>
            <p class="about-lead">
              Изворни код је на Gitcrn (приватни Gitea сервер). За преглед кода јавите се на <strong>admin@crnbg.org</strong>.
            </p>
            <p class="about-lead">Овај систем је намењен искључиво за приватне сврхе.</p>
            <div class="cluster">
              <span class="status-chip">Порт: 9995</span>
              <span class="status-chip">Bun + Hono</span>
              <span class="status-chip">libSQL + Drizzle</span>
              <span class="status-chip">Redis</span>
            </div>
          </div>
        </article>

        <article class="panel">
          <header class="panel-head">
            <h3 class="panel-title"><i data-lucide="book-open"></i> Брзи линкови</h3>
          </header>
          <div class="panel-body stack">
            <a class="btn" href="/admin/dash" target="_self"><i data-lucide="layout-dashboard"></i> Контролна табла</a>
            <a class="btn" href="/admin/dash/content" target="_self"><i data-lucide="refresh-cw"></i> Освежи content</a>
            <a class="btn" href="/" target="_blank" rel="noopener noreferrer"><i data-lucide="server"></i> API статус</a>
          </div>
        </article>
      </div>
    </section>

    <section id="viewer-modal" class="viewer-modal" aria-hidden="true">
      <div class="viewer-shell" role="dialog" aria-modal="true" aria-label="Преглед фајла">
        <header class="viewer-top">
          <h2 id="viewer-title" class="viewer-title">Преглед фајла</h2>
          <button class="btn ghost" type="button" data-viewer-close><i data-lucide="x"></i> Затвори</button>
        </header>

        <div class="viewer-body">
          <div id="viewer-stage" class="viewer-stage empty">Изабери фајл за преглед.</div>

          <aside class="viewer-side">
            <div class="viewer-meta">
              <div class="viewer-meta-row">Име: <strong id="viewer-file-name">-</strong></div>
              <div class="viewer-meta-row">public_id: <strong id="viewer-public-id">-</strong></div>
              <div class="viewer-meta-row">Величина: <strong id="viewer-file-size">-</strong></div>
              <div class="viewer-meta-row">Тип: <strong id="viewer-file-ext">-</strong></div>
              <div class="viewer-meta-row">Статус: <strong id="viewer-file-vis">-</strong></div>
              <div class="viewer-meta-row">SHA-256: <strong id="viewer-file-hash">-</strong></div>
            </div>

            <div class="cluster">
              <a id="viewer-open" href="#" class="btn" target="_blank" rel="noopener noreferrer">Отвори</a>
              <button id="viewer-delete" class="btn danger" type="button" hx-target="#content" hx-swap="outerHTML" hx-confirm="Обрисати овај фајл?">Обриши</button>
            </div>

            <div class="hline"></div>

            <form id="viewer-meta-form" hx-target="#content" hx-swap="outerHTML" class="stack">
              <input type="hidden" name="public" value="0" />
              <label><input id="viewer-public-check" type="checkbox" name="public" value="1" /> Јавно</label>
              <div class="field">
                <label>Локални лимит у минути</label>
                <input id="viewer-rl" type="number" min="0" name="rate_limit_override" />
              </div>
              <button class="btn primary" type="submit">Сачувај измене</button>
            </form>
          </aside>
        </div>
      </div>
    </section>
  </section>`;
}
