// ==UserScript==
// @name         iyuu插件
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  在右上角添加按钮并点击发布
// @author       Your name
// @match        http*://*/upload.php*
// @match        http*://*/details.php*
// @match        http*://*/edit.php*
// @match        http*://*/torrents.php*
// @match        https://kp.m-team.cc/*
// @match        https://*/torrents*
// @match        https://totheglory.im/t/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download

// @license MIT

// ==/UserScript==
// 接口配置
// var iyuuapi = '替换成自己的域名+端口/api/iyuu';
var iyuuapi = 'https://nc.timi.pp.ua:8443/mac/api/iyuu';
var apikey = '11jshgakdahdk1sdddff';
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
//   max-height: 500px;
  max-height: 90vh;
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
  max-height: 90vh;
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
    z-index: 99999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: move;
    background: rgba(255, 255, 255, 0.1);
    padding: 10px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
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
  max-height:60%
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
  background-color: #f8f9fa;
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
  background-color: #f8f9fa;
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
const container = createListContainer();

var atBottom = false;
// 页面加载完成后执行
var site_url = decodeURI(window.location.href);

// ==================== 拖拽 开始 ====================
// 创建可拖拽容器
const btnContainer = document.createElement('div');
btnContainer.id = 'daemon-btn-container';

// 初始化位置
const savedPosition = GM_getValue('btn_position', null);
const defaultPosition = { x: 20, y: 250 }; // 默认位置（px）

// 将默认位置转换为 vw 和 vh
const defaultVW = (defaultPosition.x / window.innerWidth) * 100;
const defaultVH = (defaultPosition.y / window.innerHeight) * 100;

// 应用初始位置
if (savedPosition) {
    btnContainer.style.left = `${savedPosition.x}vw`;
    btnContainer.style.top = `${savedPosition.y}vh`;
} else {
    btnContainer.style.left = `${defaultVW}vw`;
    btnContainer.style.top = `${defaultVH}vh`;
}

// 拖拽功能实现
let isDragging = false;
let startX, startY;
let initialVW, initialVH;

btnContainer.addEventListener('mousedown', function (e) {
    startX = e.clientX;
    startY = e.clientY;
    initialVW = parseFloat(btnContainer.style.left) || defaultVW;
    initialVH = parseFloat(btnContainer.style.top) || defaultVH;
    isDragging = false;
});

document.addEventListener('mousemove', function (e) {
    if (startX === undefined) return;

    const deltaX = Math.abs(e.clientX - startX);
    const deltaY = Math.abs(e.clientY - startY);

    if (!isDragging && (deltaX > 5 || deltaY > 5)) {
        isDragging = true;
        btnContainer.style.transition = 'none';
    }

    if (isDragging) {
        // 计算新的 vw 和 vh 值
        const deltaVW = ((startX - e.clientX) / window.innerWidth) * 100;
        const deltaVH = ((e.clientY - startY) / window.innerHeight) * 100;

        let newVW = initialVW - deltaVW;
        let newVH = initialVH + deltaVH;

        // 边界限制
        newVW = Math.max(0, Math.min(newVW, 100 - (btnContainer.offsetWidth / window.innerWidth) * 100));
        newVH = Math.max(0, Math.min(newVH, 100 - (btnContainer.offsetHeight / window.innerHeight) * 100));

        // 应用新的位置
        btnContainer.style.left = `${newVW}vw`;
        btnContainer.style.top = `${newVH}vh`;
    }
});

document.addEventListener('mouseup', function () {
    if (isDragging) {
        // 保存位置（以 vw 和 vh 为单位）
        GM_setValue('btn_position', {
            x: parseFloat(btnContainer.style.left),
            y: parseFloat(btnContainer.style.top)
        });
        btnContainer.style.transition = 'all 0.3s ease';
    }
    startX = startY = undefined;
    isDragging = false;
});

// 窗口 resize 时重新计算边界
window.addEventListener('resize', () => {
    const currentVW = parseFloat(btnContainer.style.left) || defaultVW;
    const currentVH = parseFloat(btnContainer.style.top) || defaultVH;

    // 确保按钮不超出视口
    const maxVW = 100 - (btnContainer.offsetWidth / window.innerWidth) * 100;
    const maxVH = 100 - (btnContainer.offsetHeight / window.innerHeight) * 100;

    const newVW = Math.min(currentVW, maxVW);
    const newVH = Math.min(currentVH, maxVH);

    btnContainer.style.left = `${newVW}vw`;
    btnContainer.style.top = `${newVH}vh`;
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
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function generateSignature(uuid, timestamp) {
    const signString = `${apikey}${uuid}${timestamp}`;
    return sha256(signString);
}

function sha256(str) {
    const buffer = new TextEncoder().encode(str);
    return crypto.subtle.digest('SHA-256', buffer).then(hash => {
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
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

function getBlob(url, fileapiurl, callback) {
    debugger;
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            overrideMimeType: "text/plain; charset=x-user-defined",
            onload: async(xhr) => {
                try {
                    // 转换数据
                    var raw = xhr.responseText;
                    var bytes = new Uint8Array(raw.length);
                    for (var i = 0; i < raw.length; i++) {
                        bytes[i] = raw.charCodeAt(i) & 0xff;
                    }
                    // 创建 Blob
                    var blob = new Blob([bytes], { type: 'application/x-bittorrent' });
                    // 获取文件名
                    const filename = 'file.torrent';
                    // 创建 FormData
                    var formData = new FormData();
                    formData.append('file', blob, filename);
                    
                    // 上传文件
                    await callback(fileapiurl, formData);
                    resolve();
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

async function iyuuQuery(fileapiurl, formData) {
    const requestUUID = generateUUID();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await generateSignature(requestUUID, timestamp);
        
    GM_xmlhttpRequest({
        method: "POST",
        url: fileapiurl,  // 替换为实际的上传接口
        data: formData,
        headers: {
            "uuid": requestUUID,
            "timestamp": timestamp,
            "signature": signature
        },
        onload: function (response) {
            try {
                var result = JSON.parse(response.responseText);
                if (result.status === 'success') {
                    addMsg('查询辅种成功: ' + result.message);
                } else {
                    addMsg('查询辅种失败：' + result.message, 'error');
                }
            } catch (error) {
                addMsg('解析响应失败: ' + error.message, 'error');
            }
        },
        onerror: function (error) {
            addMsg('失败: 网络错误', 'error');
        }
    });
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

// 新增 showMediaInfo 方法
function showMediaInfo(content) {
    // 创建容器
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '100px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.zIndex = '9999';
    container.style.width = '60%';
    container.style.padding = '10px';
    container.style.backgroundColor = 'rgba(230, 247, 255, 0.8)';
    container.style.border = '1px solid #000';
    container.style.borderRadius = '4px';
    container.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'flex-end';

    // 创建 textarea
    const textarea = document.createElement('textarea');
    textarea.style.width = '100%';
    textarea.style.height = '70vh';

    textarea.style.padding = '8px';
    textarea.style.border = '1px solid #ddd';
    textarea.style.borderRadius = '4px';
    textarea.style.fontFamily = 'Arial, sans-serif';
    textarea.style.fontSize = '14px';
    textarea.style.resize = 'none';
    textarea.style.whiteSpace = 'pre-wrap';
    textarea.style.wordBreak = 'break-all';
    textarea.value = content;

    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '10px';

    // 创建复制按钮
    const copyButton = document.createElement('button');
    copyButton.textContent = '复制';
    copyButton.style.padding = '6px 12px';
    copyButton.style.backgroundColor = '#007bff';
    copyButton.style.color = '#fff';
    copyButton.style.border = 'none';
    copyButton.style.borderRadius = '4px';
    copyButton.style.cursor = 'pointer';
    copyButton.style.marginRight = '10px';

    copyButton.addEventListener('click', () => {
        textarea.select();
        document.execCommand('copy');
        addMsg('内容已复制到剪贴板');
        document.body.removeChild(container);
    });

    // 创建关闭按钮
    const closeButton = document.createElement('button');
    closeButton.textContent = '关闭';
    closeButton.style.padding = '6px 12px';
    closeButton.style.backgroundColor = '#dc3545';
    closeButton.style.color = '#fff';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '4px';
    closeButton.style.cursor = 'pointer';

    closeButton.addEventListener('click', () => {
        document.body.removeChild(container);
    });

    // 添加按钮到容器
    buttonContainer.appendChild(copyButton);
    buttonContainer.appendChild(closeButton);

    // 添加 textarea 和按钮到容器
    container.appendChild(textarea);
    container.appendChild(buttonContainer);

    // 添加容器到页面
    document.body.appendChild(container);
}

// ==================== 按钮控制 ====================
addButton('IYUU', async() => {
    await getBlob(getUrl(), iyuuapi, iyuuQuery)
});

function getUrl() {
    debugger;
    // 获取所有包含 "torrents/download" 的链接
    const links = document.querySelectorAll('a[title*="下载种子"]');
    if (links) {
        // 获取 href 属性
        return links[0].getAttribute('href');
    }
    return null;
}