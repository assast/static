// ==UserScript==
// @name         PT站点种子下载链接提取器
// @author       Extracted from auto_feed_516182
// @description  提取PT站点的种子下载链接
// @namespace    torrent_download_link_extractor
// @match        http*://*/*detail*.php*
// @match        http*://*/detail*.php*
// @match        http*://*/details.php*
// @match        https://hdsky.me/details.php*
// @match        http*://*/offer*php*
// @match        http*://*php?id=*&torrentid=*
// @match        http*://*/*php?id=*&torrentid=*
// @match        https://*php?torrentid=*&id=*
// @match        http*://*/torrents/*
// @match        https://*/torrents?imdb*
// @match        https://totheglory.im/*
// @match        https://kp.m-team.cc/detail/*
// @match        https://next.m-team.cc/detail*
// @match        https://iptorrents.com/torrent.php?id=*
// @match        http*://hd-space.org/index.php?page=torrent-details*
// @match        https://digitalcore.club/torrent/*
// @match        https://nebulance.io/torrents.php?id=*
// @match        https://hd-only.org/*
// @match        https://passthepopcorn.me/*
// @match        https://hd-torrents.org/torrents.php*
// @match        https://broadcasthe.net/*.php*
// @match        https://backup.landof.tv/*.php*
// @match        https://beyond-hd.me/library/*
// @match        https://uhdbits.org/torrents.php*
// @match        http*://totheglory.im/t/*
// @match        http*://privatehd.to/torrent/*
// @match        http*://avistaz.to/torrent/*
// @match        http*://cinemaz.to/torrent/*
// @match        https://zhuque.in/torrent/*
// @match        https://www.yemapt.org/*
// @match        https://beyond-hd.me/download_check/*
// @match        http*://passthepopcorn.me/torrents.php?id*
// @match        http*://www.morethantv.me/torrents.php?id=*
// @match        https://hdbits.org/details.php?id=*
// @match        https://hdf.world/torrents.php*
// @match        http*://beyond-hd.me/torrents/*
// @match        http*://www.torrentleech.org/torrent/*
// @match        http*://www.torrentleech.me/torrent/*
// @match        http*://www.torrentleech.cc/torrent/*
// @match        http*://www.tlgetin.cc/torrent/*
// @match        https://blutopia.cc/torrents*
// @match        https://secret-cinema.pw/torrents.php?id=*
// @match        https://filelist.io/*
// @match        https://bluebird-hd.org/*
// @match        https://hdcity.city/*
// @match        https://hdbits.org/browse*
// @match        https://jpopsuki.eu/torrents.php*
// @match        https://greatposterwall.com/torrents.php*
// @match        https://eiga.moi/upload/*
// @match        https://star-space.net/*
// @match        http*://*redacted.sh/torrents.php*
// @require      https://greasyfork.org/scripts/453166-jquery/code/jquery.js?version=1105525
// @icon         https://kp.m-team.cc//favicon.ico
// @run-at       document-end
// @version      1.2
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @license      GPL-3.0 License
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    console.log('[种子提取] 脚本开始加载...');

    // 等待 jQuery 加载
    function waitForJQuery(callback) {
        if (typeof jQuery !== 'undefined' || typeof window.jQuery !== 'undefined' || typeof window.$ !== 'undefined') {
            console.log('[种子提取] jQuery 已就绪');
            callback();
        } else {
            console.log('[种子提取] 等待 jQuery 加载...');
            setTimeout(function() {
                waitForJQuery(callback);
            }, 100);
        }
    }

    // 主函数
    function main() {
        // 安全地获取 jQuery
        const $ = window.jQuery || window.$ || (typeof jQuery !== 'undefined' ? jQuery : null);
        
        if (!$) {
            console.error('[种子提取] 无法找到 jQuery！');
            return;
        }

        console.log('[种子提取] jQuery 版本:', $.fn.jquery);

        // 通用下载链接提取函数
        function extractDownloadLink(callback) {
            let torrentUrl = null;
            let torrentName = null;
            let siteName = 'Unknown';

            // 检测当前站点
            const currentUrl = window.location.href;
            const hostname = window.location.hostname;

            // 识别站点名称
            if (hostname.includes('hdsky')) {
                siteName = 'HDSky';
            } else if (hostname.includes('m-team')) {
                siteName = 'M-Team';
            } else if (hostname.includes('totheglory')) {
                siteName = 'TTG';
            } else if (hostname.includes('hdbits')) {
                siteName = 'HDBits';
            } else if (hostname.includes('hd-torrents')) {
                siteName = 'HD-Torrents';
            }

            console.log('[种子提取] 当前站点:', siteName, '| URL:', currentUrl);

            // M-Team 特殊处理 - 使用 API 获取下载链接
            if (siteName === 'M-Team' && currentUrl.match(/detail\/(\d+)/)) {
                const torrentId = currentUrl.match(/detail\/(\d+)/)[1];
                console.log('[种子提取] M-Team 种子ID:', torrentId);
                
                fetch('https://api.m-team.io/api/torrent/genDlToken', {
                    method: 'POST',
                    headers: {
                        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                        "ts": Math.floor(Date.now() / 1000).toString(),
                        "authorization": localStorage.getItem("auth") || ""
                    },
                    body: new URLSearchParams({"id": torrentId}).toString()
                })
                .then(response => response.json())
                .then(data => {
                    console.log('[种子提取] M-Team API 响应:', data);
                    if (data.data) {
                        torrentUrl = data.data;
                        // 获取种子名称
                        const nameElem = $('h1.ant-typography');
                        if (nameElem.length) {
                            torrentName = nameElem.text().trim();
                        }
                        callback({
                            url: torrentUrl,
                            name: torrentName || '未知种子',
                            site: siteName
                        });
                    } else {
                        console.error('[种子提取] M-Team API 返回错误:', data);
                        callback({ url: null, name: null, site: siteName });
                    }
                })
                .catch(error => {
                    console.error('[种子提取] M-Team API 请求失败:', error);
                    callback({ url: null, name: null, site: siteName });
                });
                
                return; // 异步处理，直接返回
            }

            // 尝试通用选择器（按优先级排序）
            const selectors = [
                // 中文站点常见选择器
                { selector: 'a[href*="download.php"]:contains(下载地址)', type: 'link' },
                { selector: 'td:contains(种子链接)', type: 'td-next' },
                { selector: 'td:contains(下载直链)', type: 'td-next' },
                { selector: 'td:contains(下载链接)', type: 'td-next' },
                { selector: 'td:contains(下載鏈接)', type: 'td-next' },
                { selector: 'a[href*="download.php"]:contains(下载种子)', type: 'link' },
                { selector: 'a[href*="download.php"]:contains(torrent)', type: 'link' },
                // 通用选择器
                { selector: 'a[href*="download.php?id="]', type: 'link' },
                { selector: 'a[href*="download.php"]', type: 'link' },
                { selector: 'a[href*="getdownload.php"]', type: 'link' },
                { selector: 'a[href*="/download/"]', type: 'link' },
                { selector: 'a[href*="torrents/download"]', type: 'link' },
                { selector: 'a.download', type: 'link' },
                { selector: 'a[title*="下载"]', type: 'link' },
                { selector: 'a[title*="Download"]', type: 'link' }
            ];

            for (let item of selectors) {
                const $elem = $(item.selector);
                console.log(`[种子提取] 尝试选择器: ${item.selector}, 找到: ${$elem.length} 个元素`);
                
                if ($elem.length) {
                    if (item.type === 'link') {
                        torrentUrl = $elem.first().attr('href');
                        torrentName = $elem.first().text().trim() || $elem.first().attr('title');
                    } else if (item.type === 'td-next') {
                        torrentUrl = $elem.first().next().find('a').attr('href');
                        if (!torrentUrl) {
                            torrentUrl = $elem.first().next().text().trim();
                        }
                    }
                    
                    if (torrentUrl) {
                        console.log(`[种子提取] 成功提取链接: ${torrentUrl}`);
                        break;
                    }
                }
            }

            // 如果还是没找到，尝试查找所有包含 download 的链接
            if (!torrentUrl) {
                console.log('[种子提取] 使用备用方案，查找所有下载链接...');
                $('a').each(function() {
                    const href = $(this).attr('href');
                    if (href && (href.includes('download') || href.includes('getdownload'))) {
                        console.log('[种子提取] 发现可能的下载链接:', href);
                        if (!torrentUrl) {
                            torrentUrl = href;
                            torrentName = $(this).text().trim() || $(this).attr('title');
                        }
                    }
                });
            }

            // 处理相对路径
            if (torrentUrl && !torrentUrl.match(/^http/)) {
                if (torrentUrl.match(/^\//)) {
                    torrentUrl = window.location.origin + torrentUrl;
                } else {
                    const baseUrl = currentUrl.match(/^(https?:\/\/.*?)\//)[1];
                    torrentUrl = baseUrl + '/' + torrentUrl;
                }
            }

            console.log('[种子提取] 最终结果:', { url: torrentUrl, name: torrentName, site: siteName });

            // 同步返回结果
            callback({
                url: torrentUrl,
                name: torrentName || '未知种子',
                site: siteName
            });
        }

        // 创建UI界面
        function createUI() {
            console.log('[种子提取] 开始创建UI...');
            
            // 使用回调函数处理异步结果
            extractDownloadLink(function(result) {
                if (!result.url) {
                    console.log('[种子提取] ❌ 未找到下载链接，显示调试按钮');
                    // 即使没找到链接，也显示一个调试按钮
                    const $debugButton = $('<div>')
                        .css({
                            position: 'fixed',
                            top: '100px',
                            right: '20px',
                            zIndex: 10000,
                            padding: '10px 20px',
                            backgroundColor: '#f44336',
                            color: 'white',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                            fontWeight: 'bold'
                        })
                        .text('❌ 未找到下载链接')
                        .appendTo('body')
                        .click(function() {
                            alert('未找到下载链接！\n请打开浏览器控制台查看调试信息。\n\n提示：按 F12 打开控制台，查看 [种子提取] 开头的日志。');
                        });
                    return;
                }

                console.log('[种子提取] ✅ 找到下载链接，创建操作按钮');

                // 创建浮动按钮
                const $button = $('<div>')
                    .css({
                        position: 'fixed',
                        top: '100px',
                        right: '20px',
                        zIndex: 10000,
                        padding: '10px 20px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                        fontWeight: 'bold'
                    })
                    .text('📥 复制下载链接')
                    .appendTo('body');

                // 创建信息面板
                const $panel = $('<div>')
                    .css({
                        position: 'fixed',
                        top: '150px',
                        right: '20px',
                        zIndex: 10000,
                        padding: '15px',
                        backgroundColor: 'white',
                        border: '2px solid #4CAF50',
                        borderRadius: '5px',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                        maxWidth: '400px',
                        display: 'none'
                    })
                    .html(`
                        <div style="margin-bottom: 10px;">
                            <strong>站点:</strong> ${result.site}
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>种子名:</strong> ${result.name}
                        </div>
                        <div style="margin-bottom: 10px;">
                            <strong>下载链接:</strong><br>
                            <input type="text" value="${result.url}" readonly style="width: 100%; padding: 5px; margin-top: 5px;">
                        </div>
                        <div style="text-align: center;">
                            <button id="copyBtn" style="padding: 8px 20px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; margin-right: 10px;">复制链接</button>
                            <button id="downloadBtn" style="padding: 8px 20px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer;">直接下载</button>
                        </div>
                    `)
                    .appendTo('body');

                // 按钮点击事件
                $button.click(function() {
                    $panel.toggle();
                });

                // 复制按钮
                $('#copyBtn').click(function() {
                    GM_setClipboard(result.url);
                    $(this).text('已复制!').css('background', '#45a049');
                    setTimeout(() => {
                        $(this).text('复制链接').css('background', '#4CAF50');
                    }, 2000);
                });

                // 下载按钮
                $('#downloadBtn').click(function() {
                    window.open(result.url, '_blank');
                });

                // 点击外部关闭面板
                $(document).click(function(e) {
                    if (!$(e.target).closest($button).length && !$(e.target).closest($panel).length) {
                        $panel.hide();
                    }
                });

                console.log('[种子提取] 下载链接提取成功:', result);
            });
        }

        // 等待页面加载完成后创建UI
        $(document).ready(function() {
            console.log('[种子提取] 页面加载完成，1秒后创建UI');
            setTimeout(createUI, 1000);
        });
    }

    // 等待 jQuery 加载后启动
    waitForJQuery(main);

    console.log('[种子提取] 脚本已加载');

})();
