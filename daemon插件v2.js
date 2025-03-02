// ==UserScript==
// @name         daemon插件v2
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  在右上角添加按钮并点击发布
// @author       Your name
// @match        http*://*/upload.php*
// @match        http*://*/details.php*
// @match        http*://*/edit.php*
// @match        http*://*/torrents.php*
// @match        https://kp.m-team.cc/detail/*
// @match        https://*/torrents*
// @match        https://totheglory.im/t/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download

// @license MIT
// ==/UserScript==

// 在脚本开头添加样式表
const style = document.createElement('style');
style.textContent = `
/* 消息框样式 */
.daemon-msg {
  position: fixed;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  width: 50%;
  padding: 5px;
  background: rgba(230, 247, 255, 0.8); /* 浅蓝色背景，透明度为 0.8 */
  border: 1px solid #000; /* 黑色边框 */
  border-radius: 4px;
  font: bold 14px/1.4 Arial;  /* 修改字体大小和加粗 */
  resize: none;
  overflow: auto;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow-wrap: break-word; /* 确保内容在边框宽度时换行 */
  margin: 0; /* 减少空白部分 */
   white-space: pre-wrap;  /* 保留换行和空白 */
   word-break: break-all;  /* 允许长单词换行 */
}

/* 失败/错误样式 */
.daemon-msg-fail {
  color: red;                 /* 新增字体颜色设置 */
  font: bold 18px/1.4 Arial;  /* 修改字体大小和加粗 */
}

/* 列表项样式 */
.list-item {
  margin-bottom: 10px;
}

.list-item h3 {
  font-size: 14px;
  margin: 0 0 5px;
}

.list-item p {
  margin: 0;
}

.status-flag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.8em;
}

.true-flag {
  background-color: #d4edda;
  color: #155724;
}

.false-flag {
  background-color: #f8d7da;
  color: #721c24;
}
`;
// 在样式表中添加新样式
style.textContent += `
/* 容器标题栏 */
.list-header {
  position: relative;
  padding: 8px 30px 8px 15px;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
}

/* 折叠按钮 */
.toggle-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 5px;
  border-radius: 3px;
  transition: 0.2s;
}

.toggle-btn:hover {
  background: rgba(0,0,0,0.1);
}

/* 内容区域过渡动画 */
.list-content {
  max-height: 500px;
  overflow: auto;
  transition: max-height 0.3s ease-out;
}

.list-content.collapsed {
  max-height: 0;
  overflow: hidden;
}
`;
// 在样式表中添加新样式
style.textContent += `
.daemon-list {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 70%;
//   max-width: 1000px;
  max-height: 80vh;
  background: white;
  box-shadow: 0 0 20px rgba(0,0,0,0.2);
  z-index: 10000;
  transition: all 0.3s ease;
  display: none; /* 默认隐藏 */
}

.daemon-list.visible {
  display: block;
}

.close-btn {
  position: absolute;
  right: 15px;
  top: 12px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.2s;
}

.close-btn:hover {
  background: #bb2d3b;
  transform: scale(1.1);
}
`;
// 在样式表中添加删除按钮样式
style.textContent += `
.delete-btn {
  padding: 4px 8px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: 0.2s;
  font-size: 12px;
}

.delete-btn:hover {
  background: #bb2d3b;
  transform: scale(1.05);
}

.loading {
  position: relative;
  pointer-events: none;
  opacity: 0.7;
}

.loading::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 16px;
  border: 2px solid #fff;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 0.8s linear infinite;
  transform: translate(-50%, -50%);
}

@keyframes spin {
  to { transform: translate(-50%, -50%) rotate(360deg); }
}
`;
style.textContent += `
/* 按钮容器样式 */
#daemon-btn-container {
    position: fixed;
    right: 20px;
    top: 250px;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: move;
    background: rgba(255,255,255,0.1);
    padding: 10px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    transition: all 0.3s ease;
}

/* 单个按钮样式 */
.daemon-btn {
    padding: 12px 20px;
    background: linear-gradient(145deg, #e3f2fd, #bbdefb);
    color: #1976d2;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font: bold 14px 'Microsoft YaHei';
    box-shadow: 0 2px 4px rgba(25,118,210,0.2);
    transition: all 0.2s ease;
    position: relative;
}

/* 按钮悬停效果 */
.daemon-btn:hover {
    background: linear-gradient(145deg, #bbdefb, #90caf9);
    box-shadow: 0 4px 8px rgba(25,118,210,0.3);
    transform: translateY(-2px);
}

/* 拖拽手柄样式 */
.drag-handle {
    position: absolute;
    left: 4px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 24px;
    opacity: 0.5;
    cursor: move;
    background:
        linear-gradient(to bottom,
            #666 20%,
            transparent 20%,
            transparent 40%,
            #666 40%,
            #666 60%,
            transparent 60%,
            transparent 80%,
            #666 80%
        );
}
`;
// 在样式表中添加边界限制提示
style.textContent += `
#daemon-btn-container.boundary-hit {
  animation: boundary-shake 0.4s ease;
}

@keyframes boundary-shake {
  0%, 100% { transform: translate(0, 0); }
  20% { transform: translate(-5px, 0); }
  40% { transform: translate(5px, 0); }
  60% { transform: translate(-3px, 0); }
  80% { transform: translate(3px, 0); }
}
`;

style.textContent += `
/* 主表格样式 */
.daemon-table {
  width: 98%;
  border-collapse: collapse;
  margin-top: 10px;
  color: #000;
}

.daemon-table th,
.daemon-table td {
  padding: 8px;
  border: 1px solid #ddd;
  text-align: left;
  font-size: 12px;
  vertical-align: top;
  color: #000 !important; /* 新增强制黑色字体 */
  text-align: center; /* 文本居中 */
  vertical-align: middle; /* 垂直居中 */
}

.daemon-table th {
  background-color: #f8f9fa;
}

/* 嵌套表格样式 */
.nested-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 5px;
  color: #000;
}

.nested-table th,
.nested-table td {
  padding: 5px;
  border: 1px solid #ccc;
  text-align: left;
  font-size: 10px;
  vertical-align: top;
  color: #000 !important; /* 新增强制黑色字体 */
  text-align: center; /* 文本居中 */
  vertical-align: middle; /* 垂直居中 */
}

.nested-table th {
  background-color: #e9ecef;
}

/* 操作按钮样式 */
.action-buttons {
  display: flex;
  gap: 5px;
}

.delete-btn, .force-push-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.delete-btn {
  background-color: #dc3545;
  color: white;
}

.delete-btn:hover {
  background-color: #bb2d3b;
}

.force-push-btn {
  background-color: #28a745;
  color: white;
}

.force-push-btn:hover {
  background-color: #218838;
}

/* 刷新按钮样式 */
.refresh-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2em;
  margin-left: 10px;
}

.refresh-btn:hover {
  color: #007bff;
}

`;
// daemon接口配置
var apiurl = '';
var deployapiurl = '';
var listapiurl = '';
var deleteapiurl = '';
var mediaapiurl = '';


// 初始化配置
var config = {};
initconfig();

const container = createListContainer();

var atBottom = false;
// 页面加载完成后执行
var site_url = decodeURI(window.location.href);

function initconfig() {
    config = loadConfig();
    debugger;
    apiurl = `${config.apidomain}/add_torrent`;
    deployapiurl = `${config.apidomain}/force_deploy`;
    listapiurl = `${config.apidomain}/get_info`;
    deleteapiurl = `${config.apidomain}/del_torrent`;
    mediaapiurl = `${config.apidomain}/get_media`;
}
// 配置管理部分
function loadConfig() {
    const defaultConfig = {
        apidomain: 'https://xx.xx.xx:8443',
        apikey: 'defaultKey',
        buttons: {
            panel: true,
            leechtorrent: true
        }
    };

    const saved = GM_getValue('daemon_config', '');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (error) {
            console.error('配置解析失败，使用默认配置:', error);
            return defaultConfig;
        }
    }
    return defaultConfig;
}

function saveConfig(config) {
    GM_setValue('daemon_config', JSON.stringify(config));
}


// 设置按钮处理函数
function handleSettings() {
    // 创建弹出框容器
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.backgroundColor = '#fff';
    modal.style.padding = '20px';
    modal.style.borderRadius = '8px';
    modal.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    modal.style.zIndex = '10000';
    modal.style.width = '400px';

    // 创建标题
    const title = document.createElement('h3');
    title.textContent = '配置设置';
    title.style.marginTop = '0';
    modal.appendChild(title);

    // 创建配置输入框
    const textarea = document.createElement('textarea');
    textarea.style.width = '100%';
    textarea.style.height = '200px';
    textarea.style.marginBottom = '10px';
    textarea.style.padding = '8px';
    textarea.style.border = '1px solid #ddd';
    textarea.style.borderRadius = '4px';
    textarea.style.fontFamily = 'Arial, sans-serif';
    textarea.style.fontSize = '14px';

    // 加载当前配置
    textarea.value = JSON.stringify(config, null, 2);
    modal.appendChild(textarea);

    // 创建保存按钮
    const saveButton = document.createElement('button');
    saveButton.textContent = '保存';
    saveButton.style.padding = '8px 16px';
    saveButton.style.backgroundColor = '#007bff';
    saveButton.style.color = '#fff';
    saveButton.style.border = 'none';
    saveButton.style.borderRadius = '4px';
    saveButton.style.cursor = 'pointer';
    saveButton.style.marginRight = '10px';

    // 创建取消按钮
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消';
    cancelButton.style.padding = '8px 16px';
    cancelButton.style.backgroundColor = '#dc3545';
    cancelButton.style.color = '#fff';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '4px';
    cancelButton.style.cursor = 'pointer';

    // 保存配置
    saveButton.addEventListener('click', () => {
        try {
            const config = JSON.parse(textarea.value);

            // 保存配置到存储
            saveConfig(config);
            initconfig();
            addMsg('配置已保存！请刷新界面');

            // 关闭弹出框
            document.body.removeChild(modal);
        } catch (error) {
            addMsg('配置格式错误，请检查 JSON 格式', 'error');
        }
    });

    // 取消操作
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    // 添加按钮到弹出框
    const buttonContainer = document.createElement('div');
    buttonContainer.style.textAlign = 'right';
    buttonContainer.appendChild(saveButton);
    buttonContainer.appendChild(cancelButton);
    modal.appendChild(buttonContainer);

    // 添加弹出框到页面
    document.body.appendChild(modal);
}

// ==================== 拖拽 开始 ====================
// 创建可拖拽容器
const btnContainer = document.createElement('div');
btnContainer.id = 'daemon-btn-container';

// 修改初始化位置加载部分
const savedPosition = GM_getValue('btn_position', null);
const containerRect = btnContainer.getBoundingClientRect();
const defaultPosition = { x: 20, y: 250 };

// 拖拽功能实现
let isDragging = false;
let startX, startY;
let initialX, initialY;
let dragThreshold = 5; // 触发拖拽的阈值

// 新增位置修正函数
function validatePosition(pos) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const containerWidth = btnContainer.offsetWidth;
    const containerHeight = btnContainer.offsetHeight;

    return {
        x: Math.min(Math.max(pos.x, 0), viewportWidth - containerWidth - 10),
        y: Math.min(Math.max(pos.y, 10), viewportHeight - containerHeight - 10)
    };
}

// 应用初始位置
if (savedPosition) {
    const validPos = validatePosition(savedPosition);
    btnContainer.style.right = `${validPos.x}px`;
    btnContainer.style.top = `${validPos.y}px`;
} else {
    btnContainer.style.right = `${defaultPosition.x}px`;
    btnContainer.style.top = `${defaultPosition.y}px`;
}


btnContainer.addEventListener('mousedown', function (e) {
    startX = e.clientX;
    startY = e.clientY;
    initialX = parseFloat(this.style.right) || 20;
    initialY = parseFloat(this.style.top) || 250;
    isDragging = false;
});


// 修改拖拽事件处理
document.addEventListener('mousemove', function (e) {
    if (startX === undefined) return;

    const deltaX = Math.abs(e.clientX - startX);
    const deltaY = Math.abs(e.clientY - startY);

    if (!isDragging && (deltaX > dragThreshold || deltaY > dragThreshold)) {
        isDragging = true;
        btnContainer.style.transition = 'none';
    }

    if (isDragging) {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const containerRect = btnContainer.getBoundingClientRect();

        // 计算边界限制
        let newX = initialX + (startX - e.clientX);
        let newY = initialY + (e.clientY - startY);

        // X轴边界检查
        newX = Math.max(10, Math.min(newX, viewportWidth - containerRect.width - 10));

        // Y轴边界检查
        newY = Math.max(10, Math.min(newY, viewportHeight - containerRect.height - 10));

        // 应用限制后的位置
        btnContainer.style.right = `${newX}px`;
        btnContainer.style.top = `${newY}px`;

        // 边界碰撞提示
        if (newX <= 10 || newX >= viewportWidth - containerRect.width - 10) {
            btnContainer.classList.add('boundary-hit');
            setTimeout(() => btnContainer.classList.remove('boundary-hit'), 400);
        }
    }
});

// 添加窗口resize监听
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        const currentX = parseFloat(btnContainer.style.right) || 20;
        const currentY = parseFloat(btnContainer.style.top) || 250;
        const validPos = validatePosition({ x: currentX, y: currentY });

        btnContainer.style.transition = 'all 0.3s ease';
        btnContainer.style.right = `${validPos.x}px`;
        btnContainer.style.top = `${validPos.y}px`;
    }, 200);
});

document.addEventListener('mouseup', function () {
    if (isDragging) {
        GM_setValue('btn_position', {
            x: parseFloat(btnContainer.style.right),
            y: parseFloat(btnContainer.style.top)
        });
        btnContainer.style.transition = 'all 0.3s ease';
    }
    startX = startY = undefined;
    isDragging = false;
});

// 创建带拖拽手柄的按钮
function createDragHandle() {
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    return handle;
}

// ==================== 拖拽 结束 ====================

// ==================== 只添加到最外层 start ====================
debugger;
// 获取最外层文档的body
if (window.self === window.top) {
    const rootBody = document.body;
    const rootHead = rootBody.ownerDocument.head;
    if (!rootBody.querySelector('#daemon-btn-container')) {
        rootBody.appendChild(btnContainer);
    }
    if (!rootHead.querySelector('#daemon-style')) {
        style.id = 'daemon-style';
        rootHead.appendChild(style);
    }
}

// ==================== 只添加到最外层 end ====================


// 初始化函数
function init() {
    // 等待目标元素加载完成
    waitForElement(processDownload);
}
// 等待元素出现的函数
function waitForElement(callback, maxTries = 30, interval = 1000) {
    let tries = 0;

    function check() {


        if (getUrl()) {
            callback();
            return;
        }

        tries++;
        if (tries < maxTries) {
            setTimeout(check, interval);
        }
    }

    check();
}
function getUrl() {
    if (site_url.match(/torrents\/download_check/)) {
        // 获取所有包含 "torrents/download" 的链接
        const links = document.querySelectorAll('a[href*="torrents/download"]');
        if (links) {
            // 筛选包含 i 标签的链接
            const targetLink = Array.from(links).find(link => link.querySelector('i'));
            // 获取 href 属性
            return targetLink ? targetLink.getAttribute('href') : null;
        }


    } else {
        const element = document.getElementById('tDownUrl');
        if (element && element.value) {
            return element.value;
        }
    }
    return null;
}
// 主处理函数
function processDownload() {

    // 检查是否同域
    try {
        const currentDomain = new URL(window.location.href).hostname;
        const urlDomain = new URL(getUrl()).hostname;

        if (currentDomain === urlDomain) {
            // 同域直接下载
            getFile(getUrl());
        } else {
            addMsg('请刷新界面后重试！');
        }
    } catch (error) {
        console.error('URL解析错误:', error);
    }
}

function getFile(url, leechtorrent) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            overrideMimeType: "text/plain; charset=x-user-defined",
            onload: (xhr) => {
                try {
                    // 转换数据
                    var raw = xhr.responseText;
                    var bytes = new Uint8Array(raw.length);
                    for (var i = 0; i < raw.length; i++) {
                        bytes[i] = raw.charCodeAt(i) & 0xff;
                    }
                    // 创建 file
                    var file = new File([bytes], 'tmp.torrent', { type: 'application/x-bittorrent' });
                    // 上传文件
                    sendTorrentFile(file, leechtorrent).then(resolve).catch(reject);
                } catch (error) {
                    console.error('Error processing torrent:', error);
                    addMsg('处理种子文件失败: ' + error.message);
                    reject(error);
                }
            },
            onerror: function (res) {
                console.error('Download failed:', res);
                addMsg('下载种子文件失败');
                reject(res);
            }
        });
    });
}


function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function generateSignature(uuid, timestamp) {
    const signString = `${config.apikey}${uuid}${timestamp}`;
    return sha256(signString);
}

function sha256(str) {
    const buffer = new TextEncoder().encode(str);
    return crypto.subtle.digest('SHA-256', buffer).then(hash => {
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    });
}

async function sendTorrentLink(torrentLink, leechtorrent) {
    const requestUUID = generateUUID();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await generateSignature(requestUUID, timestamp);

    const payload = {
        torrent_link: torrentLink,
        uuid: requestUUID,
        timestamp: timestamp,
        signature: signature,
        forceadd: true,
        leechtorrent: leechtorrent || false
    };

    GM_xmlhttpRequest({
        method: "POST",
        url: apiurl,
        headers: {
            "Content-Type": "application/json"
        },
        data: JSON.stringify(payload),
        onload: function (response) {
            console.log(response.responseText);
            var result = JSON.parse(response.responseText);
            if (response.status == 200 && result.status === 'success') {
                var msg = [
                    '种子链接推送成功',
                    '种 子 名: ' + result.torrent_name,
                    'tracker: ' + result.tracker
                ].join('\n');
                addMsg(msg);
            } else {
                var msg = [
                    '种子链接推送失败',
                    '失败原因: ' + result.message
                ].join('\n');
                addMsg(msg, 'error');
            }
        }
    });
}

async function sendTorrentFile(torrentFile, leechtorrent) {
    return new Promise((resolve, reject) => {
        const requestUUID = generateUUID();
        const timestamp = Math.floor(Date.now() / 1000).toString();

        generateSignature(requestUUID, timestamp)
            .then((signature) => {
                const reader = new FileReader();
                reader.onload = function (event) {
                    const torrentBase64 = btoa(event.target.result);
                    const payload = {
                        uuid: requestUUID,
                        timestamp: timestamp,
                        signature: signature,
                        torrent_bytesio: torrentBase64,
                        forceadd: true,
                        leechtorrent: leechtorrent || false
                    };

                    GM_xmlhttpRequest({
                        method: "POST",
                        url: apiurl,
                        headers: {
                            "Content-Type": "application/json"
                        },
                        data: JSON.stringify(payload),
                        onload: function (response) {
                            console.log(response.responseText);
                            const result = JSON.parse(response.responseText);
                            if (response.status == 200 && result.status === 'success') {
                                const msg = [
                                    '种子文件推送成功',
                                    '种 子 名: ' + result.torrent_name,
                                    'tracker: ' + result.tracker
                                ].join('\n');
                                addMsg(msg);
                                resolve();
                            } else {
                                const msg = [
                                    '种子文件推送失败',
                                    '失败原因: ' + result.message
                                ].join('\n');
                                addMsg(msg, 'error');
                                reject(result.message);
                            }
                        },
                        onerror: function (error) {
                            console.error('上传失败:', error);
                            addMsg('上传种子文件失败');
                            reject(error);
                        }
                    });
                };
                reader.onerror = function (error) {
                    console.error('文件读取失败:', error);
                    addMsg('文件读取失败');
                    reject(error);
                };
                reader.readAsBinaryString(torrentFile);
            })
            .catch((error) => {
                console.error('生成签名失败:', error);
                addMsg('生成签名失败: ' + error.message, 'error');
                reject(error);
            });
    });
}


async function listTorrent() {
    try {
        const requestUUID = generateUUID();
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = await generateSignature(requestUUID, timestamp);

        const payload = {
            uuid: requestUUID,
            timestamp: timestamp,
            signature: signature,
            forceadd: true
        };

        const response = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: listapiurl,
                headers: {
                    "Content-Type": "application/json"
                },
                data: JSON.stringify(payload),
                onload: resolve,
                onerror: reject
            });
        });

        console.log("Status Code:", response.status);
        console.log(response.responseText);
        if (response.status == 200) {
            const data = JSON.parse(response.responseText);
            if (data.status === "success" && data.action === "GETINFO") {
                const torrents = data.data.deployment_torrents_queue;
                const tableHTML = generateTableHTML(torrents);

                const pre_leech_torrents = data.data.pre_leech_torrents;
                const leechTableHTML = generatLeechTableHTML(pre_leech_torrents);

                displayTable(tableHTML, leechTableHTML);
            } else {
                addMsg('查询成功，但数据格式不正确', 'error');
                throw new Error('数据格式不正确');
            }
        } else {
            const result = JSON.parse(response.responseText);
            addMsg('查询失败: ' + result.message, 'error');
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('查询失败:', error);
        addMsg('查询失败: ' + error.message, 'error');
        throw error;
    }
}

function generateTableHTML(torrents) {
    let tableHTML = `
        <table class="daemon-table">
            <thead>
                <tr>
                    <th style="width:30%">发布列表</th>
                    <th>可用</th>
                    <th>添加时间</th>
                    <th>相关数据</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (!torrents || torrents.length === 0) {
        tableHTML += `
            <tr>
                <td colspan="4">无发布列表</td>
            </tr>
        `;
    } else {
        torrents.forEach(torrent => {
            tableHTML += `
                <tr>
                    <td style="width:30%; word-wrap:break-word;">${torrent.torrent_name}</td>
                    <td>${torrent.isavailable ? '是' : '否'}</td>
                    <td>${new Date(torrent.added * 1000).toLocaleString()}</td>
                    <td>${generateRelatedDataTable(torrent.related_data)}</td>
                </tr>
            `;
        });
    }

    tableHTML += `
            </tbody>
        </table>
    `;

    return tableHTML;
}
function generatLeechTableHTML(torrents) {
    let tableHTML = `
        <table class="daemon-table">
            <thead>
                <tr>
                    <th style="width:70%">进货列表</th>
                    <th>添加时间</th>
                </tr>
            </thead>
            <tbody>
    `;
    if (!torrents || torrents.length === 0) {
        tableHTML += `
            <tr>
                <td colspan="2">无进货列表</td>
            </tr>
        `;
    } else {
        torrents.forEach(torrent => {
            tableHTML += `
                <tr>
                    <td style="width:30%; word-wrap:break-word;">${torrent.torrent_name}</td>
                    <td>${new Date(torrent.added * 1000).toLocaleString()}</td>
                </tr>
            `;
        });
    }

    tableHTML += `
            </tbody>
        </table>
    `;

    return tableHTML;
}
function generateRelatedDataTable(relatedData) {
    if (!relatedData || relatedData.length === 0) {
        return '无相关数据';
    }

    let nestedTableHTML = `
        <table class="nested-table">
            <thead>
                <tr>
                    <th>Tracker</th>
                    <th>已推</th>
                    <th>优先级</th>
                    <th>添加时间</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
    `;

    relatedData.forEach(data => {
        nestedTableHTML += `
            <tr data-hash="${data[1]}" data-md5="${data[1]}">
                <td>${data[2]}</td>
                <td>${data[3] ? '是' : '否'}</td>
                <td>${data[4]}</td>
                <td>${new Date(data[5] * 1000).toLocaleString()}</td>
                <td>
                    <div class="action-buttons">
                        <button class="delete-btn">删除</button>
                        <button class="force-push-btn">强推</button>
                    </div>
                </td>
            </tr>
        `;
    });

    nestedTableHTML += `
            </tbody>
        </table>
    `;

    return nestedTableHTML;
}


function displayTable(tableHTML, leechTableHTML) {
    const container = document.getElementById('daemon-list');
    if (!container) {
        const newContainer = createListContainer();
        document.body.appendChild(newContainer);
        newContainer.innerHTML = `
            <div class="list-header">
                <strong style="font-size:1.2em">种子监控面板</strong>
                <button class="refresh-btn" title="刷新">🔄</button>
                <button class="close-btn" title="关闭">×</button>
            </div>
            
            <div class="list-content">
                ${leechTableHTML}
            </div>
            <div class="list-content">
                ${tableHTML}
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="list-header">
                <strong style="font-size:1.2em">种子监控面板</strong>
                <button class="refresh-btn" title="刷新">🔄</button>
                <button class="close-btn" title="关闭">×</button>
            </div>

            <div class="list-content">
                ${leechTableHTML}
            </div>
            <div class="list-content">
                ${tableHTML}
            </div>
        `;
        container.classList.add('visible');
    }

    // 绑定关闭按钮事件
    const closeBtn = container.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        container.classList.remove('visible');
    });

    // 绑定刷新按钮事件
    const refreshBtn = container.querySelector('.refresh-btn');
    refreshBtn.addEventListener('click', () => {
        // 禁用按钮
        refreshBtn.disabled = true;
        refreshBtn.classList.add('loading');

        listTorrent()
            .then(() => {
                btn.disabled = false;
                btn.classList.remove('loading');
            })
            .catch((error) => {
                console.error('操作失败:', error);
                btn.disabled = false;
                btn.classList.remove('loading');
            });
    });

    // 绑定嵌套表格中的删除和强推按钮事件
    container.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-btn');
        const forcePushBtn = e.target.closest('.force-push-btn');
        const row = e.target.closest('tr');

        if (deleteBtn || forcePushBtn) {
            const hash = row.dataset.hash;
            const md5 = row.dataset.md5;
            const tracker = row.querySelector('td:nth-child(1)').textContent; // 获取 Tracker
            const addedTime = row.querySelector('td:nth-child(4)').textContent; // 获取嵌套表格的添加时间

            if (deleteBtn) {
                deleteRelatedData(hash, md5, tracker, addedTime);
            }

            if (forcePushBtn) {
                forcePushRelatedData(hash, md5, tracker, addedTime);
            }
        }
    });
}

function addMsg(msg, type) {
    let msgBox = document.getElementById('daemon-msg');

    // 如果元素不存在，则创建一个新的 textarea 元素
    if (!msgBox) {
        msgBox = document.createElement('textarea');
        msgBox.id = 'daemon-msg'; // 设置 id
        msgBox.readOnly = true; // 设置为只读
        document.body.appendChild(msgBox); // 添加到页面中
    }

    // 设置 textarea 的内容为传入的 msg 参数，并确保换行符生效
    msgBox.value = msg.replace(/\\n/g, '\n');

    // 动态调整 textarea 的高度
    // msgBox.style.height = 'auto'; // 先设置为 auto，以便根据内容计算高度
    // msgBox.style.height = Math.min(msgBox.scrollHeight, 100) + 'px'; // 限制最大高度为 200px
    msgBox.style.height = '100px'; // 先设置为 auto，以便根据内容计算高度

    if (type && type == 'error') {
        msgBox.className = 'daemon-msg daemon-msg-fail';
    } else {
        msgBox.className = 'daemon-msg';
    }
}
async function deleteRelatedData(hash, md5, tracker, addedTime) {
    if (!confirm(`确定要删除以下相关数据吗？\nTracker: ${tracker}\n添加时间: ${addedTime}\nHash: ${hash}`)) return;

    try {
        const requestUUID = generateUUID();
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = await generateSignature(requestUUID, timestamp);

        const payload = {
            uuid: requestUUID,
            timestamp: timestamp,
            signature: signature,
            torrent_hash: hash,
            nodropqbit: true
        };

        GM_xmlhttpRequest({
            method: "POST",
            url: deleteapiurl,
            headers: {
                "Content-Type": "application/json"
            },
            data: JSON.stringify(payload),
            onload: function (response) {
                console.log("del torrent_hash:", hash);
                console.log("Status Code:", response.status);
                console.log(response.responseText);
                if (response.status == 200) {
                    addMsg('删除成功: \n' + response.responseText);
                    listTorrent(); // 刷新列表
                } else {
                    var result = JSON.parse(response.responseText);
                    var msg = [
                        '删除失败',
                        '失败原因: ' + result.message
                    ].join('\n');
                    addMsg(msg, 'error');
                }
            }
        });
    } catch (error) {
        console.error('删除失败:', error);
        addMsg('删除失败: ' + error.message, 'error');
    }
}

async function forcePushRelatedData(hash, md5, tracker, addedTime) {
    if (!confirm(`确定要强制推送以下相关数据吗？\nTracker: ${tracker}\n添加时间: ${addedTime}\nHash: ${hash}`)) return;

    // try {
    //     await doPostJson(deployapiurl, {
    //         torrent_hash: hash,
    //         torrent_md5: md5
    //     });
    //     addMsg('强制推送成功');
    // } catch (error) {
    //     console.error('强制推送失败:', error);
    //     addMsg('强制推送失败: ' + error.message, 'error');
    // }
}
var idx = 0;
// 修改按钮创建方式，使用addEventListener
function addButton(label, callback) {
    const btn = document.createElement('button');
    btn.className = 'daemon-btn';
    btn.textContent = label;

    btn.addEventListener('click', function (e) {
        if (!isDragging && typeof callback === 'function') {
            // 禁用按钮
            btn.disabled = true;
            btn.classList.add('loading');

            // 执行回调函数
            const result = callback();

            // 如果回调函数返回 Promise，则在 Promise 完成后启用按钮
            if (result && typeof result.then === 'function') {
                result
                    .then(() => {
                        btn.disabled = false;
                        btn.classList.remove('loading');
                    })
                    .catch((error) => {
                        console.error('操作失败:', error);
                        btn.disabled = false;
                        btn.classList.remove('loading');
                    });
            } else {
                // 否则立即启用按钮
                btn.disabled = false;
                btn.classList.remove('loading');
            }
        }
    });

    btn.appendChild(createDragHandle());
    btnContainer.appendChild(btn);
    idx++;
}


// 简化的容器创建函数
function createListContainer() {
    const container = document.createElement('div');
    container.id = 'daemon-list';
    container.className = 'daemon-list';
    document.body.appendChild(container);
    return container;
}


async function get_media(command) {
    return new Promise((resolve, reject) => {
        const requestUUID = generateUUID();
        const timestamp = Math.floor(Date.now() / 1000).toString();

        generateSignature(requestUUID, timestamp)
            .then((signature) => {
                debugger;
                const element = document.getElementById('tBlob');
                if (!element) {
                    throw new Error('种子文件未加载，请稍等');
                }
                const torrentBase64 =  element.value;

                const payload = {
                    uuid: requestUUID,
                    timestamp: timestamp,
                    signature: signature,
                    torrent_bytesio: torrentBase64,
                    command: command
                };

                GM_xmlhttpRequest({
                    method: "POST",
                    url: mediaapiurl,
                    headers: {
                        "Content-Type": "application/json"
                    },
                    data: JSON.stringify(payload),
                    onload: function (response) {
                        console.log(response.responseText);
                        const result = JSON.parse(response.responseText);
                        if (response.status == 200 && result.status === 'success') {
                            const msg = [
                                result.data.output
                            ].join('\n');
                            addMsg(msg);
                            resolve();
                        } else {
                            var msg = [
                                '获取媒体信息失败',
                                '失败原因: ' + result.message
                            ].join('\n');
                            addMsg(msg, 'error');
                            reject(result.message);
                        }
                    },
                    onerror: function (error) {
                        console.error('获取媒体信息失败:', error);
                        addMsg('获取媒体信息失败');
                        reject(error);
                    }
                });
            })
            .catch((error) => {
                console.error('获取媒体信息失败:', error);
                addMsg('获取媒体信息失败: ' + error.message, 'error');
                reject(error);
            });
    });
}

// ==================== 按钮控制 ====================
if (site_url.match(/details.php\?id=\d+&uploaded=1/) || site_url.match(/torrents\/download_check/)) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
if (site_url.match(/upload.php/)) {
    addButton('点击发布', () => {
        const publishButton = document.querySelector('input[value="发布"]');
        if (publishButton) {
            publishButton.click();
        } else {
            addMsg('未找到发布按钮！');
        }
    });

    if(config.buttons.test){
        addButton('获取媒体信息', () => {
            return get_media('media'); // 返回 Promise
        });
        addButton('截图ptpimg', () => {
            return get_media('pjietu'); // 返回 Promise
        });
        addButton('截图imgbox', () => {
            return get_media('ijietu'); // 返回 Promise
        });
    }
    
}
// 添加按钮
else if (site_url.match(/torrents/) || site_url.match(/details.php/) || site_url.match(/totheglory.im\/t\//)) {
    addButton('编辑种子', () => {

        const editButton = document.querySelector('a[href*="edit.php"]');
        if (editButton) {
            window.location.assign(editButton.href);
        } else {
            addMsg('未找到编辑按钮！');
        }
    });
    addButton('发|推送种子', () => {
        return getFile(getUrl()); // 返回 Promise
    });
    addButton('发|本地种子', () => {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
    
            // 文件选择事件
            input.onchange = async (e) => {
                try {
                    const file = e.target.files[0];
                    if (!file) {
                        throw new Error('未选择文件');
                    }
                    console.log('选择的文件:', file.name);
                    await sendTorrentFile(file); // 等待文件上传完成
                    resolve();
                } catch (error) {
                    console.error('文件上传失败:', error);
                    addMsg('文件上传失败: ' + error, 'error');
                    reject(error);
                }
            };
    
            // 文件选择取消事件
            input.oncancel = () => {
                console.log('文件选择已取消');
                reject(new Error('文件选择已取消'));
            };
    
            input.click();
        });
    });
    if(config.buttons.leechtorrent){
        addButton('进|推送种子', () => {
            if (!confirm(`确定进货？`)) return new Promise((resolve) => { });
            return getFile(getUrl(), true);
        });
        addButton('进|本地种子', () => {
            return new Promise((resolve, reject) => {
                const input = document.createElement('input');
                input.type = 'file';
        
                // 文件选择事件
                input.onchange = async (e) => {
                    try {
                        const file = e.target.files[0];
                        if (!file) {
                            throw new Error('未选择文件');
                        }
                        console.log('选择的文件:', file.name);
                        await sendTorrentFile(file, true); // 等待文件上传完成
                        resolve();
                    } catch (error) {
                        console.error('文件上传失败:', error);
                        addMsg('文件上传失败: ' + error, 'error');
                        reject(error);
                    }
                };
        
                // 文件选择取消事件
                input.oncancel = () => {
                    console.log('文件选择已取消');
                    reject(new Error('文件选择已取消'));
                };
        
                input.click();
            });
        });
    }
}
else if (site_url.match(/edit.php/)) {
    addButton('编辑完成', () => {
        debugger;
        const editButton = document.querySelector('input[id="qr"]');
        if(!editButton){
            editButton = document.querySelector('input[value="编辑"]');
        }
        if(!editButton){
            editButton = document.querySelector('input[type*="submit"]');
        }
        if (editButton) {
            editButton.click();
            return;
        }
        addMsg('未找到编辑按钮！');
    });
}
// addButton('推送链接', () => {
//     sendTorrentLink(getUrl())
// });

if(config.buttons.panel){
    addButton('面板', () => {
        return listTorrent(); // 返回 Promise
    });
}
addButton('设置', handleSettings);
