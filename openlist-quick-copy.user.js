// ==UserScript==
// @name         OpenList Quick Copy
// @namespace    dream.openlist.quickcopy
// @version      0.2.1
// @description  在 OpenList 中一键复制选中文件到预设目录（支持多实例）
// @author       playboy
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @noframes
// ==/UserScript==

// 脚本现在使用 @match *://*/* 全局匹配，会自动检测当前页面是否为 OpenList。
// 检测逻辑（严格 DOM 检测，不会误判 B站/其他网站）：
//   1. 当前主机在已验证白名单中 → 直接挂载
//   2. 页面有 OpenList 文件列表项（.list-item / .viselect-item）→ 判定为 OpenList
//   3. 页面有 OpenList 登录表单 + Hope UI 框架标记 → 判定为 OpenList
// 非 OpenList 页面会在 8 秒超时后自动退出，不会持续占用资源。
// 首次通过验证的主机会自动加入白名单，后续访问秒挂载。
// 新增 OpenList 实例无需修改脚本，直接访问即可自动识别。

(function () {
  'use strict';

  // ========== DOM 选择器（如果 OpenList 升级后失效，改这里）==========
  const SELECTORS = {
    selectedFile: '.list-item.selected .filename-content',
    selectedFileFallback: '.viselect-item.selected .name',
    openListMarker: '.list-item, .viselect-item',
  };

  const STORAGE_KEY = 'configs';
  const CURRENT_HOST = window.location.host;

  // ========== 配置读写 ==========
  function loadConfigs() {
    const raw = GM_getValue(STORAGE_KEY, '{}');
    if (typeof raw === 'object' && raw !== null) return raw;
    try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
  }

  function saveConfigs(configs) {
    GM_setValue(STORAGE_KEY, JSON.stringify(configs));
  }

  function getHostPresets(host) {
    const configs = loadConfigs();
    return (configs[host] && configs[host].presets) || [];
  }

  function setHostPresets(host, presets) {
    const configs = loadConfigs();
    if (!configs[host]) configs[host] = {};
    configs[host].presets = presets;
    saveConfigs(configs);
  }

  // ========== 工具 ==========
  function normalizePath(p) {
    p = String(p || '').trim();
    if (!p) return '/';
    if (!p.startsWith('/')) p = '/' + p;
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p;
  }

  function getSelectedFileNames() {
    let nodes = document.querySelectorAll(SELECTORS.selectedFile);
    if (nodes.length === 0) {
      nodes = document.querySelectorAll(SELECTORS.selectedFileFallback);
    }
    return [...nodes].map(n => n.textContent.trim()).filter(Boolean);
  }

  function getCurrentPath() {
    return normalizePath(decodeURIComponent(window.location.pathname || '/'));
  }

  // 已验证的 OpenList 主机白名单（GM_setValue 持久化，首次验证通过后缓存）
  function getVerifiedHosts() {
    try {
      const raw = GM_getValue('verifiedHosts', '[]');
      const arr = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
      return new Set(arr);
    } catch (e) { return new Set(); }
  }

  function addVerifiedHost(host) {
    const s = getVerifiedHosts();
    s.add(host);
    GM_setValue('verifiedHosts', JSON.stringify([...s]));
  }

  function isOpenListPage() {
    // 1. 当前主机之前已验证过 → 秒过
    if (getVerifiedHosts().has(CURRENT_HOST)) return true;

    // 2. DOM 特征检测：查找 OpenList/AList 特有的文件列表项。
    //    只用 DOM，绝不用 localStorage.token（B站等网站也有 JWT token，会造成误判）
    //    .list-item 匹配 OpenList 文件列表行；.viselect-item 匹配备选结构
    if (document.querySelector(SELECTORS.openListMarker)) return true;

    // 3. 检查 OpenList 登录页特征（未登录但页面确实是 OpenList）
    //    OpenList 登录页有用户名+密码的登录表单
    const loginInputs = document.querySelectorAll('input[name="username"], input[type="text"][placeholder*="用户"], input[type="password"][placeholder*="密码"]');
    if (loginInputs.length >= 2) {
      // 确认不是在随便一个表单上——检查页面标题或特定框架标记
      const hopeUi = document.querySelector('.hope-c-PJLV, [class*="hope-ui"], [class*="hope-c-"]');
      if (hopeUi) return true;
    }

    return false;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ========== OpenList API ==========
  async function apiRequest(path, { method = 'POST', body = null } = {}) {
    const token = localStorage.getItem('token') || '';
    if (!token) throw new Error('未检测到登录 token，请先登录 OpenList');
    const headers = { 'Authorization': token };
    const options = {
      method: 'POST',
      headers,
    };
    options.method = method;
    if (method !== 'GET' && body !== null) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    const res = await fetch(path, options);
    if (res.status === 401) throw new Error('登录已过期，请重新登录');
    let data;
    try { data = await res.json(); } catch (e) {
      throw new Error(`HTTP ${res.status}：响应解析失败`);
    }
    return data;
  }

  async function apiCall(path, body) {
    return apiRequest(path, { method: 'POST', body });
  }

  async function apiGet(path) {
    return apiRequest(path, { method: 'GET' });
  }

  // 列出目标目录的文件/文件夹名，用于客户端预检冲突
  // 返回 null = 目录不存在或读取失败（这种情况就不预筛，让后端去处理）
  async function listDirNames(dirPath) {
    try {
      const data = await apiCall('/api/fs/list', {
        path: dirPath,
        password: '',
        refresh: true,
        page: 1,
        per_page: 0,  // AList/OpenList 约定 0 = 不分页，返回全部
      });
      if (data.code !== 200) return null;
      const content = (data.data && data.data.content) || [];
      const total = data.data && data.data.total;
      if (typeof total === 'number' && total > content.length) {
        console.warn(`[OpenList Quick Copy] 目标目录有 ${total} 项但只读到 ${content.length} 项，冲突检测可能不全`);
      }
      return content.map(item => item.name);
    } catch (e) {
      return null;
    }
  }

  // 复制：客户端先去重已存在的名字，再调用 /api/fs/copy
  // 返回 { copied, skipped, total }
  async function copyTo(dstDir, names) {
    dstDir = normalizePath(dstDir);
    const srcDir = getCurrentPath();
    if (srcDir === dstDir) throw new Error('源目录和目标目录相同');

    const existing = await listDirNames(dstDir);
    let toCopy = names;
    let skipped = [];
    if (existing !== null) {
      const existingSet = new Set(existing);
      toCopy = names.filter(n => !existingSet.has(n));
      skipped = names.filter(n => existingSet.has(n));
    }

    if (toCopy.length === 0) {
      return { copied: 0, skipped: skipped.length, total: names.length };
    }

    const data = await apiCall('/api/fs/copy', {
      src_dir: srcDir,
      dst_dir: dstDir,
      names: toCopy,
    });
    if (data.code !== 200) {
      throw new Error(data.message || '复制失败');
    }
    return { copied: toCopy.length, skipped: skipped.length, total: names.length };
  }

  // ========== OpenList 复制任务进度 ==========
  const TASK_API_PREFIXES = ['/api/task/copy', '/api/admin/task/copy'];
  let taskApiBase = null;

  async function taskApiGet(action) {
    const bases = taskApiBase
      ? [taskApiBase, ...TASK_API_PREFIXES.filter(base => base !== taskApiBase)]
      : TASK_API_PREFIXES;
    let lastError = null;
    for (const base of bases) {
      try {
        const data = await apiGet(`${base}/${action}`);
        if (data && data.code === 200) {
          taskApiBase = base;
          return data;
        }
        lastError = new Error((data && data.message) || `任务接口返回 ${data && data.code}`);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('无法读取复制任务');
  }

  async function fetchCopyTasks() {
    const undoneData = await taskApiGet('undone');
    let doneData = { data: [] };
    try {
      doneData = await taskApiGet('done');
    } catch (err) {
      console.warn('[OpenList Quick Copy] 读取已完成复制任务失败', err);
    }
    return {
      active: sortTasks(normalizeTaskList(undoneData)),
      done: sortTasks(normalizeTaskList(doneData)).slice(0, 8),
    };
  }

  function normalizeTaskList(data) {
    return Array.isArray(data && data.data) ? data.data : [];
  }

  function sortTasks(tasks) {
    return [...tasks].sort((a, b) => taskTimeValue(b) - taskTimeValue(a));
  }

  function taskTimeValue(task) {
    const value = Date.parse(task.end_time || task.start_time || '') || 0;
    return value;
  }

  function getTaskProgress(task) {
    const progress = Number(task.progress);
    if (!Number.isFinite(progress)) return 0;
    return Math.max(0, Math.min(100, progress));
  }

  function formatTaskPercent(task) {
    const progress = getTaskProgress(task);
    return progress % 1 === 0 ? `${progress}%` : `${progress.toFixed(1)}%`;
  }

  function formatTaskState(task) {
    if (task.error) return '失败';
    if (task.status) return task.status;
    const stateText = {
      pending: '等待中',
      running: '复制中',
      succeeded: '已完成',
      failed: '失败',
      canceled: '已取消',
    }[task.state];
    return stateText || task.state || '未知状态';
  }

  function formatTaskTime(task) {
    const raw = task.end_time || task.start_time;
    if (!raw) return '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  }

  // ========== UI（Shadow DOM 隔离）==========
  let shadowRoot = null;
  let uiRoot = null;

  const CSS = `
    :host { all: initial; }
    [hidden] { display: none !important; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }

    .fab-container {
      position: fixed; top: 50%; right: 24px;
      transform: translateY(-50%);
      display: flex; flex-direction: column; gap: 12px; align-items: center;
      z-index: 2147483647;
      user-select: none;
    }
    .fab-container.dragging,
    .fab-container.dragging .fab { cursor: grabbing !important; }
    .fab {
      border: none; cursor: pointer; color: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
      transition: transform .15s, box-shadow .15s;
      border-radius: 50%;
    }
    .fab:hover { transform: scale(1.08); box-shadow: 0 6px 16px rgba(0,0,0,0.3); }
    .fab:active { transform: scale(0.95); }
    .fab-main {
      width: 56px; height: 56px; font-size: 22px;
      background: linear-gradient(135deg, #4a8fff, #2a6fdf);
    }
    .fab-gear {
      width: 40px; height: 40px; font-size: 16px;
      background: linear-gradient(135deg, #6a7280, #4b5563);
    }
    .fab-progress {
      width: 44px; height: 44px; font-size: 17px;
      background: linear-gradient(135deg, #14b8a6, #0f766e);
    }

    .preset-menu {
      position: fixed;
      background: white; border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      min-width: 240px; max-width: 360px;
      overflow: hidden;
      z-index: 2147483647;
      animation: slideUp .2s ease;
    }
    @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .preset-menu-header {
      padding: 10px 14px; font-size: 12px; color: #6b7280;
      background: #f9fafb; border-bottom: 1px solid #e5e7eb;
    }
    .preset-item {
      display: flex; flex-direction: column; align-items: flex-start;
      width: 100%; padding: 10px 14px; border: none; background: white;
      cursor: pointer; text-align: left; gap: 2px;
      border-bottom: 1px solid #f3f4f6;
    }
    .preset-item:last-child { border-bottom: none; }
    .preset-item:hover { background: #eff6ff; }
    .preset-name { font-size: 14px; color: #111827; font-weight: 500; }
    .preset-path { font-size: 12px; color: #6b7280; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; word-break: break-all; }

    .config-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 2147483647;
    }
    .config-panel {
      background: white; border-radius: 12px;
      width: 600px; max-width: 92vw; max-height: 84vh;
      display: flex; flex-direction: column;
      box-shadow: 0 16px 48px rgba(0,0,0,0.3);
    }
    .config-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid #e5e7eb;
    }
    .config-title { font-size: 16px; font-weight: 600; color: #111827; }
    .config-hint { font-size: 12px; color: #9ca3af; margin-top: 2px; }
    .btn-close {
      background: none; border: none; font-size: 18px; color: #6b7280;
      cursor: pointer; padding: 4px 8px; border-radius: 4px;
    }
    .btn-close:hover { background: #f3f4f6; }
    .config-body { padding: 16px 20px; flex: 1; overflow-y: auto; }
    .host-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; font-size: 13px; color: #374151; }
    .host-row select {
      flex: 1; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px;
      font-size: 13px; background: white; font-family: inherit;
    }
    .preset-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .preset-list:empty::before {
      content: "（暂无预设，点下方按钮添加）";
      display: block; text-align: center; color: #9ca3af; font-size: 13px; padding: 12px 0;
    }
    .preset-row { display: flex; gap: 8px; align-items: center; }
    .preset-row input {
      padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 6px;
      font-size: 13px; min-width: 0; font-family: inherit;
    }
    .input-name { flex: 0 0 130px; }
    .input-path { flex: 1; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
    .preset-row input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.15); }
    .btn-del {
      background: #fee2e2; border: none; color: #b91c1c;
      width: 32px; height: 32px; border-radius: 6px;
      cursor: pointer; font-size: 14px; flex-shrink: 0;
    }
    .btn-del:hover { background: #fecaca; }
    .btn { padding: 7px 14px; border: 1px solid #d1d5db; background: white; border-radius: 6px; cursor: pointer; font-size: 13px; font-family: inherit; }
    .btn:hover { background: #f9fafb; }
    .btn-primary { background: #2563eb; color: white; border-color: #2563eb; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-add { width: 100%; color: #2563eb; border-style: dashed; padding: 8px; }
    .config-footer {
      display: flex; gap: 8px; justify-content: flex-end;
      padding: 12px 20px; border-top: 1px solid #e5e7eb;
    }

    .progress-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 2147483647;
    }
    .progress-panel {
      background: white; border-radius: 12px;
      width: 680px; max-width: 92vw; max-height: 84vh;
      display: flex; flex-direction: column;
      box-shadow: 0 16px 48px rgba(0,0,0,0.28);
    }
    .progress-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid #e5e7eb;
      gap: 12px;
    }
    .progress-title { font-size: 16px; font-weight: 600; color: #111827; }
    .progress-hint { font-size: 12px; color: #9ca3af; margin-top: 2px; }
    .progress-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .progress-body { padding: 14px 20px 18px; overflow-y: auto; }
    .progress-status { font-size: 13px; color: #4b5563; margin-bottom: 12px; }
    .task-section { margin-top: 14px; }
    .task-section:first-child { margin-top: 0; }
    .task-section-title {
      font-size: 12px; color: #6b7280; font-weight: 600;
      margin-bottom: 8px;
    }
    .task-list { display: flex; flex-direction: column; gap: 8px; }
    .task-empty {
      padding: 12px; border: 1px dashed #d1d5db; border-radius: 8px;
      color: #9ca3af; font-size: 13px; text-align: center;
    }
    .task-row {
      border: 1px solid #e5e7eb; border-radius: 8px;
      padding: 10px 12px; background: #fff;
    }
    .task-top {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 12px; margin-bottom: 5px;
    }
    .task-name {
      font-size: 13px; color: #111827; font-weight: 500;
      word-break: break-all; line-height: 1.35;
    }
    .task-percent { font-size: 12px; color: #0f766e; font-weight: 600; flex-shrink: 0; }
    .task-meta { display: flex; justify-content: space-between; gap: 12px; color: #6b7280; font-size: 12px; margin-bottom: 8px; }
    .task-state { word-break: break-word; }
    .task-time { flex-shrink: 0; color: #9ca3af; }
    .task-bar { height: 6px; border-radius: 999px; background: #e5e7eb; overflow: hidden; }
    .task-bar-fill { height: 100%; border-radius: inherit; background: #14b8a6; transition: width .2s ease; }
    .task-error { margin-top: 7px; color: #b91c1c; font-size: 12px; word-break: break-all; }

    .toast-container {
      position: fixed; top: 24px; right: 24px;
      display: flex; flex-direction: column; gap: 8px;
      z-index: 2147483647; pointer-events: none;
      align-items: flex-end;
    }
    .toast {
      padding: 10px 16px; border-radius: 8px; color: white;
      font-size: 13px; max-width: 360px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      animation: slideIn .2s ease;
      pointer-events: auto;
      word-break: break-all;
    }
    @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
    .toast-fadeout { opacity: 0; transition: opacity .4s; }
    .toast-info    { background: #3b82f6; }
    .toast-success { background: #10b981; }
    .toast-error   { background: #ef4444; }
  `;

  const HTML = `
    <style>${CSS}</style>
    <div class="fab-container">
      <button class="fab fab-gear" id="btn-gear" title="配置预设目录">⚙</button>
      <button class="fab fab-progress" id="btn-progress" title="查看复制进度">⏳</button>
      <button class="fab fab-main" id="btn-main" title="复制选中文件到预设目录">📋</button>
    </div>
    <div class="preset-menu" id="preset-menu" hidden></div>
    <div class="config-overlay" id="config-overlay" hidden>
      <div class="config-panel">
        <div class="config-header">
          <div>
            <div class="config-title">OpenList Quick Copy 配置</div>
            <div class="config-hint">每个 OpenList 实例（按 IP:端口 区分）维护自己的预设列表</div>
          </div>
          <button class="btn-close" id="btn-config-close" title="关闭">✕</button>
        </div>
        <div class="config-body">
          <label class="host-row">
            <span>实例：</span>
            <select id="host-select"></select>
          </label>
          <div class="preset-list" id="preset-list"></div>
          <button class="btn btn-add" id="btn-add-preset">+ 添加预设</button>
        </div>
        <div class="config-footer">
          <button class="btn" id="btn-config-cancel">取消</button>
          <button class="btn btn-primary" id="btn-config-save">保存</button>
        </div>
      </div>
    </div>
    <div class="progress-overlay" id="progress-overlay" hidden>
      <div class="progress-panel">
        <div class="progress-header">
          <div>
            <div class="progress-title">复制进度</div>
            <div class="progress-hint">读取 OpenList 后台复制任务，面板打开时每 3 秒自动刷新</div>
          </div>
          <div class="progress-actions">
            <button class="btn" id="btn-progress-goto">打开任务页</button>
            <button class="btn" id="btn-progress-refresh">刷新</button>
            <button class="btn-close" id="btn-progress-close" title="关闭">✕</button>
          </div>
        </div>
        <div class="progress-body">
          <div class="progress-status" id="progress-status">正在读取...</div>
          <div class="task-section">
            <div class="task-section-title">进行中</div>
            <div class="task-list" id="task-active-list"></div>
          </div>
          <div class="task-section">
            <div class="task-section-title">最近完成</div>
            <div class="task-list" id="task-done-list"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="toast-container" id="toast-container"></div>
  `;

  function mountUI() {
    if (uiRoot && document.body.contains(uiRoot)) return;

    uiRoot = document.createElement('div');
    uiRoot.id = 'openlist-quick-copy-root';
    uiRoot.style.cssText = 'all: initial;';
    shadowRoot = uiRoot.attachShadow({ mode: 'open' });
    shadowRoot.innerHTML = HTML;
    document.body.appendChild(uiRoot);

    shadowRoot.getElementById('btn-main').addEventListener('click', onMainButtonClick);
    shadowRoot.getElementById('btn-gear').addEventListener('click', openConfigPanel);
    shadowRoot.getElementById('btn-progress').addEventListener('click', openProgressPanel);
    shadowRoot.getElementById('btn-config-close').addEventListener('click', closeConfigPanel);
    shadowRoot.getElementById('btn-config-cancel').addEventListener('click', closeConfigPanel);
    shadowRoot.getElementById('btn-config-save').addEventListener('click', saveConfigFromPanel);
    shadowRoot.getElementById('btn-add-preset').addEventListener('click', () => addPresetRow('', ''));
    shadowRoot.getElementById('host-select').addEventListener('change', renderPresetList);
    shadowRoot.getElementById('btn-progress-close').addEventListener('click', closeProgressPanel);
    shadowRoot.getElementById('btn-progress-refresh').addEventListener('click', refreshProgressPanel);
    shadowRoot.getElementById('btn-progress-goto').addEventListener('click', gotoTaskPage);

    // 点 UI 外部关闭预设菜单
    document.addEventListener('click', (e) => {
      const menu = shadowRoot.getElementById('preset-menu');
      if (!menu.hidden && !uiRoot.contains(e.target)) {
        menu.hidden = true;
      }
    });

    // 拖动 + 位置记忆
    const fabContainer = shadowRoot.querySelector('.fab-container');
    restoreFabPosition(fabContainer);
    setupDrag(fabContainer);

    // 首次验证通过后缓存主机名，下次不用再检测 DOM
    if (!getVerifiedHosts().has(CURRENT_HOST)) {
      addVerifiedHost(CURRENT_HOST);
    }
  }

  // ========== FAB 拖动 + 位置记忆 ==========
  let fabDragJustEnded = false;

  function setupDrag(container) {
    let drag = null;

    container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const rect = container.getBoundingClientRect();
      drag = {
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        moved: false,
      };
    });

    document.addEventListener('mousemove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      if (!drag.moved) {
        drag.moved = true;
        container.classList.add('dragging');
      }
      let x = e.clientX - drag.offsetX;
      let y = e.clientY - drag.offsetY;
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      x = Math.max(0, Math.min(window.innerWidth - w, x));
      y = Math.max(0, Math.min(window.innerHeight - h, y));
      container.style.left = x + 'px';
      container.style.top = y + 'px';
      container.style.right = 'auto';
      container.style.bottom = 'auto';
      container.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => {
      if (!drag) return;
      if (drag.moved) {
        container.classList.remove('dragging');
        GM_setValue('fabPosition', JSON.stringify({
          left: container.style.left,
          top: container.style.top,
        }));
        fabDragJustEnded = true;
        setTimeout(() => { fabDragJustEnded = false; }, 0);
      }
      drag = null;
    });

    // 拖动结束后浏览器会补发一次 click，这里在 capture 阶段把它吞掉，避免误触按钮
    container.addEventListener('click', (e) => {
      if (fabDragJustEnded) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
  }

  function restoreFabPosition(container) {
    const raw = GM_getValue('fabPosition', null);
    if (!raw) return;
    let pos;
    try {
      pos = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) { return; }
    if (!pos || !pos.left || !pos.top) return;
    const left = parseInt(pos.left, 10);
    const top = parseInt(pos.top, 10);
    if (isNaN(left) || isNaN(top)) return;
    // 旧位置如果跑到视口外（窗口缩小过），就用默认位置
    const w = container.offsetWidth || 50;
    const h = container.offsetHeight || 50;
    if (left < 0 || left > window.innerWidth - w) return;
    if (top < 0 || top > window.innerHeight - h) return;
    container.style.left = pos.left;
    container.style.top = pos.top;
    container.style.right = 'auto';
    container.style.bottom = 'auto';
    container.style.transform = 'none';
  }

  // ========== 主按钮 ==========
  async function onMainButtonClick(e) {
    e.stopPropagation();
    const names = getSelectedFileNames();
    if (names.length === 0) {
      toast('请先在文件列表中勾选文件', 'info');
      return;
    }
    const presets = getHostPresets(CURRENT_HOST);
    if (presets.length === 0) {
      toast('当前实例还没有预设，点齿轮配置一下吧', 'info');
      return;
    }
    showPresetMenu(names, presets);
  }

  function showPresetMenu(names, presets) {
    const menu = shadowRoot.getElementById('preset-menu');
    menu.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'preset-menu-header';
    header.textContent = `复制 ${names.length} 个文件到：`;
    menu.appendChild(header);

    presets.forEach((p) => {
      const item = document.createElement('button');
      item.className = 'preset-item';
      item.innerHTML = `<span class="preset-name">${escapeHtml(p.name)}</span><span class="preset-path">${escapeHtml(p.path)}</span>`;
      item.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        menu.hidden = true;
        try {
          toast(`正在处理 ${names.length} 项 → ${p.path}`, 'info');
          const r = await copyTo(p.path, names);
          if (r.copied === 0) {
            toast(`ℹ 全部 ${r.total} 项已存在于 ${p.path}，未复制`, 'info');
          } else if (r.skipped === 0) {
            toast(`✓ 已提交 ${r.copied} 项 → ${p.path}，点 ⏳ 看进度`, 'success');
            refreshProgressPanelIfOpen();
          } else {
            toast(`✓ 已提交 ${r.copied} 项 / 跳过 ${r.skipped} 项已存在 → ${p.path}，点 ⏳ 看进度`, 'success');
            refreshProgressPanelIfOpen();
          }
        } catch (err) {
          toast(`✗ 复制失败：${err.message}`, 'error');
        }
      });
      menu.appendChild(item);
    });

    menu.hidden = false;
    positionMenuNearFab(menu);
  }

  function positionMenuNearFab(menu) {
    const fabContainer = shadowRoot.querySelector('.fab-container');
    if (!fabContainer) return;
    const fabRect = fabContainer.getBoundingClientRect();
    const menuW = menu.offsetWidth;
    const menuH = menu.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 默认放在 FAB 左侧、垂直居中
    let left = fabRect.left - menuW - 8;
    let top = fabRect.top + fabRect.height / 2 - menuH / 2;

    // 左边空间不够 → 放 FAB 右侧
    if (left < 8) left = fabRect.right + 8;
    // 右边也不够（FAB 在最右） → 改成上方对齐
    if (left + menuW > vw - 8) {
      left = Math.max(8, fabRect.right - menuW);
      top = fabRect.top - menuH - 8;
      if (top < 8) top = fabRect.bottom + 8; // 上方不够再放下方
    }

    left = Math.max(8, Math.min(vw - menuW - 8, left));
    top = Math.max(8, Math.min(vh - menuH - 8, top));

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.style.right = 'auto';
    menu.style.bottom = 'auto';
  }

  // ========== 配置面板 ==========
  function openConfigPanel() {
    shadowRoot.getElementById('preset-menu').hidden = true;
    populateHostSelect();
    renderPresetList();
    shadowRoot.getElementById('config-overlay').hidden = false;
  }

  function closeConfigPanel() {
    shadowRoot.getElementById('config-overlay').hidden = true;
  }

  function populateHostSelect() {
    const select = shadowRoot.getElementById('host-select');
    const configs = loadConfigs();
    const hosts = new Set(Object.keys(configs));
    hosts.add(CURRENT_HOST);

    select.innerHTML = '';
    [...hosts].sort().forEach((host) => {
      const opt = document.createElement('option');
      opt.value = host;
      opt.textContent = host === CURRENT_HOST ? `${host}  ← 当前` : host;
      select.appendChild(opt);
    });
    select.value = CURRENT_HOST;
  }

  function renderPresetList() {
    const list = shadowRoot.getElementById('preset-list');
    const host = shadowRoot.getElementById('host-select').value;
    const presets = getHostPresets(host);
    list.innerHTML = '';
    presets.forEach((p) => addPresetRow(p.name, p.path));
  }

  function addPresetRow(name, path) {
    const list = shadowRoot.getElementById('preset-list');
    const row = document.createElement('div');
    row.className = 'preset-row';

    const inputName = document.createElement('input');
    inputName.className = 'input-name';
    inputName.type = 'text';
    inputName.placeholder = '预设名（如 归档）';
    inputName.value = name || '';

    const inputPath = document.createElement('input');
    inputPath.className = 'input-path';
    inputPath.type = 'text';
    inputPath.placeholder = '目标路径（如 /archive）';
    inputPath.value = path || '';

    const btnDel = document.createElement('button');
    btnDel.className = 'btn-del';
    btnDel.textContent = '✕';
    btnDel.title = '删除';
    btnDel.addEventListener('click', () => row.remove());

    row.appendChild(inputName);
    row.appendChild(inputPath);
    row.appendChild(btnDel);
    list.appendChild(row);
  }

  function saveConfigFromPanel() {
    const host = shadowRoot.getElementById('host-select').value;
    const rows = shadowRoot.querySelectorAll('.preset-row');
    const presets = [];
    rows.forEach((row) => {
      const name = row.querySelector('.input-name').value.trim();
      const path = row.querySelector('.input-path').value.trim();
      if (name && path) presets.push({ name, path: normalizePath(path) });
    });
    setHostPresets(host, presets);
    toast(`已保存 ${presets.length} 个预设到 ${host}`, 'success');
    closeConfigPanel();
  }

  // ========== 复制进度面板 ==========
  let progressTimer = null;
  let progressRefreshSeq = 0;

  function openProgressPanel() {
    shadowRoot.getElementById('preset-menu').hidden = true;
    shadowRoot.getElementById('progress-overlay').hidden = false;
    refreshProgressPanel();
    startProgressAutoRefresh();
  }

  function closeProgressPanel() {
    shadowRoot.getElementById('progress-overlay').hidden = true;
    stopProgressAutoRefresh();
  }

  function gotoTaskPage() {
    const url = `${window.location.origin}/@manage/tasks/copy`;
    window.open(url, '_blank');
  }

  function startProgressAutoRefresh() {
    stopProgressAutoRefresh();
    progressTimer = setInterval(refreshProgressPanel, 3000);
  }

  function stopProgressAutoRefresh() {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  }

  function refreshProgressPanelIfOpen() {
    const overlay = shadowRoot && shadowRoot.getElementById('progress-overlay');
    if (overlay && !overlay.hidden) refreshProgressPanel();
  }

  async function refreshProgressPanel() {
    if (!shadowRoot) return;
    const seq = ++progressRefreshSeq;
    const status = shadowRoot.getElementById('progress-status');
    status.textContent = '正在读取复制任务...';
    try {
      const result = await fetchCopyTasks();
      if (seq !== progressRefreshSeq) return;
      renderTaskList('task-active-list', result.active, '当前没有未完成的复制任务');
      renderTaskList('task-done-list', result.done, '暂无最近完成的复制任务');
      status.textContent = result.active.length
        ? `当前 ${result.active.length} 个复制任务未完成`
        : '当前没有未完成的复制任务';
    } catch (err) {
      if (seq !== progressRefreshSeq) return;
      renderTaskList('task-active-list', [], '读取失败');
      renderTaskList('task-done-list', [], '读取失败');
      status.textContent = `读取复制任务失败：${err.message}`;
    }
  }

  function renderTaskList(listId, tasks, emptyText) {
    const list = shadowRoot.getElementById(listId);
    list.innerHTML = '';
    if (tasks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'task-empty';
      empty.textContent = emptyText;
      list.appendChild(empty);
      return;
    }
    tasks.forEach(task => list.appendChild(createTaskRow(task)));
  }

  function createTaskRow(task) {
    const row = document.createElement('div');
    const progress = getTaskProgress(task);
    row.className = 'task-row';
    row.innerHTML = `
      <div class="task-top">
        <div class="task-name" title="${escapeHtml(task.name || '')}">${escapeHtml(task.name || '(未命名复制任务)')}</div>
        <div class="task-percent">${formatTaskPercent(task)}</div>
      </div>
      <div class="task-meta">
        <span class="task-state">${escapeHtml(formatTaskState(task))}</span>
        <span class="task-time">${escapeHtml(formatTaskTime(task))}</span>
      </div>
      <div class="task-bar"><div class="task-bar-fill"></div></div>
      ${task.error ? `<div class="task-error">${escapeHtml(task.error)}</div>` : ''}
    `;
    row.querySelector('.task-bar-fill').style.width = `${progress}%`;
    return row;
  }

  // ========== Toast ==========
  function toast(msg, type = 'info') {
    if (!shadowRoot) return;
    const container = shadowRoot.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast-fadeout');
      setTimeout(() => el.remove(), 400);
    }, 3000);
  }

  // ========== 初始化 ==========
  function init() {
    if (isOpenListPage()) {
      mountUI();
      watchForRemount();
      return;
    }
    // OpenList SPA 还没渲染出文件列表，等一下（最多 8 秒）
    let timeoutId = null;
    const waitObs = new MutationObserver(() => {
      if (isOpenListPage()) {
        waitObs.disconnect();
        if (timeoutId) clearTimeout(timeoutId);
        mountUI();
        watchForRemount();
      }
    });
    waitObs.observe(document.body, { childList: true, subtree: true });
    // 8 秒后仍未检测到 OpenList 特征，断开观察器（避免在非 OpenList 站点持续占用资源）
    timeoutId = setTimeout(() => {
      waitObs.disconnect();
    }, 8000);
  }

  // SPA 路由切换时 OpenList 可能重渲染 body，确保 UI 不掉
  function watchForRemount() {
    const obs = new MutationObserver(() => {
      if (uiRoot && !document.body.contains(uiRoot)) {
        document.body.appendChild(uiRoot);
      }
    });
    obs.observe(document.body, { childList: true });
  }

  init();
})();
