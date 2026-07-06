// ==UserScript==
// @name         ktnbytes PT 对比图代码提取器
// @namespace    https://ktnbytes.com/
// @version      1.1.0
// @description  无需等待图片加载，直接从页面或网页源码提取 Source / Encode Compare 原图链接并生成 PT 标签。
// @author       ChatGPT
// @match        https://ktnbytes.com/*
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      ktnbytes.com
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const BUTTON_CLASS = 'ktn-pt-compare-button';
    const IMAGE_EXT_RE = /\.(?:png|jpe?g|webp|avif|bmp|gif)(?:$|[?#])/i;
    const IMAGE_HOST_RE = /(?:slow\.pics|picx\.|imgbox\.|ptpimg\.|imageban\.|pixhost\.)/i;

    function cleanText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function headingLevel(element) {
        const match = /^H([1-6])$/.exec(element?.tagName || '');
        return match ? Number(match[1]) : 6;
    }

    function isCompareHeading(element) {
        const text = cleanText(element?.textContent);
        return /compare/i.test(text) && /source/i.test(text);
    }

    function getSectionNodes(heading) {
        const nodes = [];
        const level = headingLevel(heading);
        let current = heading.nextElementSibling;

        while (current) {
            if (/^H[1-6]$/.test(current.tagName) && headingLevel(current) <= level) break;
            nodes.push(current);
            current = current.nextElementSibling;
        }
        return nodes;
    }

    function ownText(element) {
        return Array.from(element?.childNodes || [])
            .filter((node) => node.nodeType === 3)
            .map((node) => cleanText(node.textContent))
            .filter(Boolean)
            .join(' ');
    }

    function parseLabels(text) {
        const cleaned = cleanText(text)
            .replace(/\bcompare\b/ig, '')
            .replace(/^[\s:：\-–—]+|[\s:：\-–—]+$/g, '');

        if (!cleaned.includes('/')) return [];

        const labels = cleaned
            .split('/')
            .map((item) => cleanText(item))
            .filter((item) => item && item.length <= 50 && !/^\d+$/.test(item));

        return labels.length >= 2 && labels.length <= 10 ? labels : [];
    }

    function detectLabels(heading, sectionNodes) {
        const candidates = [];
        const addCandidate = (text, priority = 0) => {
            const labels = parseLabels(text);
            if (labels.length >= 2) candidates.push({ labels, priority });
        };

        addCandidate(heading?.textContent, 20);

        for (const root of sectionNodes || []) {
            addCandidate(ownText(root), 10);
            for (const element of root.querySelectorAll?.('*') || []) {
                const text = ownText(element);
                if (text && text.length <= 300) addCandidate(text, 10);
            }
        }

        candidates.sort((a, b) =>
            b.labels.length - a.labels.length || b.priority - a.priority
        );
        return candidates[0]?.labels || ['Source', 'Encode'];
    }

    function decodeHtmlEntities(text) {
        const area = document.createElement('textarea');
        area.innerHTML = String(text || '');
        return area.value;
    }

    function normalizeUrl(value, baseUrl = location.href) {
        if (!value) return '';

        let candidate = decodeHtmlEntities(String(value).trim())
            .replace(/\\u002f/ig, '/')
            .replace(/\\\//g, '/')
            .replace(/^['"(\s]+|['")\s]+$/g, '');

        if (/^(?:data|blob|javascript):/i.test(candidate)) return '';

        try {
            return new URL(candidate, baseUrl).href;
        } catch {
            return '';
        }
    }

    function looksLikeImageUrl(value, baseUrl = location.href) {
        const url = normalizeUrl(value, baseUrl);
        if (!url) return false;

        try {
            const parsed = new URL(url);
            return IMAGE_EXT_RE.test(`${parsed.pathname}${parsed.search}`) ||
                IMAGE_HOST_RE.test(parsed.hostname);
        } catch {
            return false;
        }
    }

    function makeCollector(baseUrl = location.href) {
        const urls = [];
        const seen = new Set();

        const add = (value) => {
            const url = normalizeUrl(value, baseUrl);
            if (!url || !looksLikeImageUrl(url, baseUrl) || seen.has(url)) return;
            seen.add(url);
            urls.push(url);
        };

        return { urls, add };
    }

    function addSrcset(collector, value) {
        String(value || '').split(',').forEach((part) => {
            const url = part.trim().split(/\s+/)[0];
            if (url) collector.add(url);
        });
    }

    function extractUrlsFromText(text, baseUrl = location.href) {
        const collector = makeCollector(baseUrl);
        const normalized = decodeHtmlEntities(String(text || ''))
            .replace(/\\u002f/ig, '/')
            .replace(/\\\//g, '/');

        const absoluteRe = /https?:\/\/[^\s'"<>]+/gi;
        for (const match of normalized.matchAll(absoluteRe)) {
            collector.add(match[0].replace(/[),;]+$/g, ''));
        }
        return collector.urls;
    }

    function extractImageUrls(sectionNodes, baseUrl = location.href) {
        const collector = makeCollector(baseUrl);

        const scanElement = (element) => {
            if (!element || element.nodeType !== 1) return;

            // 读取所有属性，因此 data-href、data-src、data-original 等懒加载字段也能识别。
            for (const attribute of Array.from(element.attributes || [])) {
                const name = attribute.name.toLowerCase();
                const value = attribute.value;

                if (name === 'srcset' || name.endsWith('srcset')) {
                    addSrcset(collector, value);
                } else if (
                    name === 'href' || name === 'src' || name === 'poster' ||
                    name.includes('src') || name.includes('href') ||
                    name.includes('url') || name.includes('original') ||
                    name.includes('lazy')
                ) {
                    collector.add(value);
                }

                // 某些组件把完整 URL 放在 style 或 JSON 型属性中。
                if (/https?:|\\u002f|\\\//i.test(value)) {
                    extractUrlsFromText(value, baseUrl).forEach(collector.add);
                }
            }
        };

        for (const root of sectionNodes || []) {
            scanElement(root);
            for (const element of root.querySelectorAll?.('*') || []) scanElement(element);

            // 最后再扫描这一区域的原始 HTML，兼容 script/JSON 中的链接。
            extractUrlsFromText(root.outerHTML || '', baseUrl).forEach(collector.add);
        }

        return collector.urls;
    }

    function findCompareDataInDocument(doc, baseUrl = location.href) {
        const headings = Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,h6'))
            .filter(isCompareHeading);

        for (const heading of headings) {
            const sectionNodes = getSectionNodes(heading);
            const labels = detectLabels(heading, sectionNodes);
            const urls = extractImageUrls(sectionNodes, baseUrl);
            if (urls.length) return { labels, urls };
        }

        // 结构异常时，截取“Compare”到下一个同级主题之间的源码进行正则扫描。
        const html = doc.documentElement?.innerHTML || '';
        const marker = html.search(/source\s*(?:\/|&(?:#x2F|sol);)\s*encode[^<]{0,80}compare|source[^<]{0,80}encode[^<]{0,80}compare/i);
        if (marker >= 0) {
            const after = html.slice(marker);
            const endMatch = after.slice(200).search(/<h[1-6]\b/i);
            const segment = endMatch >= 0 ? after.slice(0, endMatch + 200) : after.slice(0, 150000);
            const urls = extractUrlsFromText(segment, baseUrl);
            if (urls.length) return { labels: ['Source', 'Encode'], urls };
        }

        return { labels: ['Source', 'Encode'], urls: [] };
    }

    function requestPageSource() {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: location.href,
                    headers: { 'Cache-Control': 'no-cache' },
                    onload: (response) => {
                        if (response.status >= 200 && response.status < 400) {
                            resolve(response.responseText);
                        } else {
                            reject(new Error(`HTTP ${response.status}`));
                        }
                    },
                    onerror: () => reject(new Error('读取网页源码失败')),
                    ontimeout: () => reject(new Error('读取网页源码超时')),
                    timeout: 20000
                });
                return;
            }

            fetch(location.href, { credentials: 'include', cache: 'no-store' })
                .then((response) => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.text();
                })
                .then(resolve, reject);
        });
    }

    function buildPtCode(labels, urls) {
        const title = labels.join(', ');
        const rows = [];

        for (let index = 0; index < urls.length; index += labels.length) {
            rows.push(urls.slice(index, index + labels.length).join('\n'));
        }

        return [
            '[b]Screenshot Comparison[/b]',
            `[spoiler=${title}][comparison=${title}]`,
            rows.join('\n\n'),
            '',
            '[/comparison][/spoiler]'
        ].join('\n');
    }

    async function copyText(text) {
        if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(text, 'text');
            return;
        }
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
    }

    function showToast(message, isError = false) {
        document.getElementById('ktn-pt-compare-toast')?.remove();
        const toast = document.createElement('div');
        toast.id = 'ktn-pt-compare-toast';
        toast.textContent = message;
        Object.assign(toast.style, {
            position: 'fixed', right: '24px', bottom: '24px', zIndex: '2147483647',
            maxWidth: '460px', padding: '12px 16px', borderRadius: '8px',
            background: isError ? '#b42318' : '#16794a', color: '#fff',
            fontSize: '14px', lineHeight: '1.5', boxShadow: '0 6px 22px rgba(0,0,0,.25)'
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), isError ? 5500 : 2800);
    }

    function showResultDialog(initialLabels, urls) {
        document.getElementById('ktn-pt-compare-dialog')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ktn-pt-compare-dialog';
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0', zIndex: '2147483646', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '24px',
            background: 'rgba(0,0,0,.55)'
        });

        const panel = document.createElement('div');
        Object.assign(panel.style, {
            width: 'min(820px, 96vw)', maxHeight: '90vh', overflow: 'auto',
            padding: '20px', borderRadius: '12px', background: '#fff', color: '#222',
            boxShadow: '0 20px 60px rgba(0,0,0,.35)', fontFamily: 'system-ui, sans-serif'
        });

        const title = document.createElement('div');
        title.textContent = 'PT 对比图代码';
        Object.assign(title.style, { marginBottom: '14px', fontSize: '20px', fontWeight: '700' });

        const labelTitle = document.createElement('label');
        labelTitle.textContent = '版本名称（用英文逗号分隔，可修改后重新生成）';
        Object.assign(labelTitle.style, { display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600' });

        const labelInput = document.createElement('input');
        labelInput.value = initialLabels.join(', ');
        Object.assign(labelInput.style, {
            boxSizing: 'border-box', width: '100%', marginBottom: '12px', padding: '9px 10px',
            border: '1px solid #bbb', borderRadius: '6px', fontSize: '14px'
        });

        const info = document.createElement('div');
        Object.assign(info.style, { marginBottom: '8px', color: '#555', fontSize: '13px' });

        const textarea = document.createElement('textarea');
        Object.assign(textarea.style, {
            boxSizing: 'border-box', width: '100%', minHeight: '380px', padding: '12px',
            border: '1px solid #bbb', borderRadius: '6px', resize: 'vertical',
            font: '13px/1.55 Consolas, Monaco, monospace', whiteSpace: 'pre'
        });

        const buttonRow = document.createElement('div');
        Object.assign(buttonRow.style, {
            display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end',
            gap: '10px', marginTop: '14px'
        });

        const makeButton = (text, background) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = text;
            Object.assign(button.style, {
                padding: '9px 15px', border: '0', borderRadius: '6px', background,
                color: '#fff', cursor: 'pointer', fontWeight: '600'
            });
            return button;
        };

        const closeButton = makeButton('关闭', '#666');
        const generateButton = makeButton('重新生成', '#2563eb');
        const copyButton = makeButton('复制代码', '#16794a');

        function getLabelsFromInput() {
            return labelInput.value.split(/[,，]/).map(cleanText).filter(Boolean);
        }

        function regenerate() {
            const labels = getLabelsFromInput();
            if (labels.length < 2) {
                info.textContent = '至少需要两个版本名称。';
                info.style.color = '#b42318';
                return false;
            }
            if (urls.length % labels.length !== 0) {
                info.textContent = `共有 ${urls.length} 张图，不能按 ${labels.length} 个版本平均分组。请检查版本名称数量。`;
                info.style.color = '#b42318';
                return false;
            }

            textarea.value = buildPtCode(labels, urls);
            info.textContent = `已识别 ${labels.length} 个版本、${urls.length / labels.length} 组截图，共 ${urls.length} 张原图。`;
            info.style.color = '#555';
            return true;
        }

        generateButton.addEventListener('click', regenerate);
        copyButton.addEventListener('click', async () => {
            if (!regenerate()) return;
            try {
                await copyText(textarea.value);
                showToast('PT 对比代码已复制到剪贴板');
            } catch (error) {
                console.error(error);
                showToast('复制失败，请在文本框中手动复制。', true);
            }
        });
        closeButton.addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) overlay.remove();
        });

        buttonRow.append(closeButton, generateButton, copyButton);
        panel.append(title, labelTitle, labelInput, info, textarea, buttonRow);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        regenerate();
        textarea.focus();
        textarea.select();
    }

    async function handleExtract(heading, button) {
        const oldText = button.textContent;
        button.disabled = true;
        button.textContent = '正在读取链接…';
        button.style.opacity = '0.7';

        try {
            const sectionNodes = getSectionNodes(heading);
            let labels = detectLabels(heading, sectionNodes);
            let urls = extractImageUrls(sectionNodes);

            if (!urls.length) {
                showToast('当前页面尚未生成图片节点，正在直接读取网页源码……');
                const html = await requestPageSource();
                const sourceDoc = new DOMParser().parseFromString(html, 'text/html');
                const sourceData = findCompareDataInDocument(sourceDoc, location.href);
                labels = sourceData.labels.length ? sourceData.labels : labels;
                urls = sourceData.urls;
            }

            if (!urls.length) {
                showToast('网页源码中也没有找到 Compare 原图链接。页面结构可能已经改变。', true);
                return;
            }

            if (urls.length % labels.length !== 0) {
                showResultDialog(labels, urls);
                showToast(`找到了 ${urls.length} 张图，但版本数量可能未正确识别，请在窗口中修改。`, true);
                return;
            }

            const code = buildPtCode(labels, urls);
            try {
                await copyText(code);
                showToast(`已复制：${urls.length / labels.length} 组、共 ${urls.length} 张原图；无需等待图片加载`);
            } catch (error) {
                console.error(error);
                showToast('自动复制失败，请在弹出的窗口中手动复制。', true);
            }
            showResultDialog(labels, urls);
        } catch (error) {
            console.error('[ktnbytes PT Compare]', error);
            showToast(`读取失败：${error.message || error}`, true);
        } finally {
            button.disabled = false;
            button.textContent = oldText;
            button.style.opacity = '1';
        }
    }

    function installButtons() {
        const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
            .filter(isCompareHeading);

        for (const heading of headings) {
            if (heading.dataset.ktnPtCompareInstalled === '1') continue;
            heading.dataset.ktnPtCompareInstalled = '1';

            const button = document.createElement('button');
            button.type = 'button';
            button.className = BUTTON_CLASS;
            button.textContent = '提取并复制 PT 对比代码';
            Object.assign(button.style, {
                display: 'inline-block', margin: '8px 0 14px', padding: '9px 14px',
                border: '0', borderRadius: '7px', background: '#16794a', color: '#fff',
                cursor: 'pointer', fontSize: '14px', fontWeight: '700',
                boxShadow: '0 2px 8px rgba(0,0,0,.18)'
            });
            button.addEventListener('click', () => handleExtract(heading, button));
            heading.insertAdjacentElement('afterend', button);
        }
    }

    installButtons();
    const observer = new MutationObserver(installButtons);
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
