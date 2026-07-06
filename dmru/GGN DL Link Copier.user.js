// ==UserScript==
// @name         GazelleGames DL Link Copier
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  复制页面上所有 DL 按钮的链接到剪切板 (一行一个)
// @author       You
// @match        https://gazellegames.net/torrents.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gazellegames.net
// @grant        GM_setClipboard
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // 创建一个按钮
    const btn = document.createElement('button');
    btn.innerText = '复制全部 DL 链接';
    btn.id = 'copy-dl-links-btn';

    // 设置按钮样式 (固定在右上角)
    Object.assign(btn.style, {
        position: 'fixed',
        top: '50px',
        right: '20px',
        zIndex: '9999',
        padding: '10px 15px',
        backgroundColor: '#4CAF50',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontWeight: 'bold',
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
    });

    // 鼠标悬停效果
    btn.onmouseover = function() {
        this.style.backgroundColor = '#45a049';
    };
    btn.onmouseout = function() {
        this.style.backgroundColor = '#4CAF50';
    };

    // 绑定点击事件
    btn.onclick = function() {
        // 1. 查找所有带有 action=download 的 a 标签
        // 2. 过滤出文本内容确实是 "DL" 的链接 (防止误判)
        const dlLinks = Array.from(document.querySelectorAll('a[href*="action=download"]'))
            .filter(link => link.textContent.trim() === 'DL')
            .map(link => link.href); // 获取绝对链接

        if (dlLinks.length === 0) {
            alert('未在当前页面找到任何 DL 链接！');
            return;
        }

        // 使用换行符连接所有链接
        const clipboardText = dlLinks.join('\n');

        // 使用 GM_setClipboard 将内容写入剪切板
        GM_setClipboard(clipboardText);

        // 临时改变按钮文字作为反馈
        const originalText = btn.innerText;
        btn.innerText = `已复制 ${dlLinks.length} 个链接!`;
        btn.style.backgroundColor = '#2196F3';

        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.backgroundColor = '#4CAF50';
        }, 2000);
    };

    // 将按钮添加到页面
    document.body.appendChild(btn);

})();
