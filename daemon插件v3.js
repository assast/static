// ==UserScript==
// @name         daemon插件v3
// @namespace    http://tampermonkey.net/
// @version      3.35
// @description  在右上角添加按钮并点击发布
// @author       Your name
// @match        http*://*/upload.php*
// @match        http*://*/details.php*
// @match        http*://*/edit.php*
// @match        http*://*/torrents.php*
// @match        https://kp.m-team.cc/*
// @match        https://*/torrent*
// @match        https://totheglory.im/t/*
// @match        http*://*/plugin_details.php*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download

// @license MIT
// @downloadURL https://update.greasyfork.org/scripts/531973/daemon%E6%8F%92%E4%BB%B6v3.user.js
// @updateURL https://update.greasyfork.org/scripts/531973/daemon%E6%8F%92%E4%BB%B6v3.meta.js
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
    width: 85vw;      /* 占据视口98%宽度 */
    max-width: none;   /* 移除最大宽度限制 */
    height: 90vh;
    background: white;
    box-shadow: 0 0 20px rgba(0,0,0,0.2);
    z-index: 10000;
    display: none;
    border-radius: 8px;
    overflow: hidden;
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
    gap: 5px;
    cursor: move;
    background: rgba(255, 255, 255, 0.1);
    padding: 0px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
}

/* 单个按钮样式 */
.daemon-btn {
    padding: 8px 18px;
    background: linear-gradient(145deg, #e3f2fd, #bbdefb);
    color: #1976d2;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font: bold 12px 'Microsoft YaHei';
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
    width: 100%;
    min-height: 400px; /* 最小高度保证容器尺寸 */
    max-height: calc(90vh - 60px);
    display: block;
    overflow: auto;
    table-layout: fixed; /* 固定表格布局 */
    border-collapse: collapse;
}
/* 表头强制显示 */
.daemon-table thead {
    display: table-header-group; /* 始终显示表头 */
    width: 100%;
}
/* 数据行高度适配 */
.daemon-table tbody tr {
    height: 50px; /* 固定行高保持布局 */
}
.daemon-table th,
.daemon-table td {
  padding: 8px;
  border: 1px solid #ddd;
  text-align: left;
  font-size: 12px;
  vertical-align: top;
  text-align: center; /* 文本居中 */
  vertical-align: middle; /* 垂直居中 */
}

/* 响应式处理 */
.torrent-name {
    word-break: break-word;
    overflow-wrap: break-word;
    max-width: 400px;
}

/* 操作按钮适配 */
.action-buttons {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
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

/* 状态指示样式 */
.status-true {
    background: #e6ffed;          /* 浅绿色背景 */
    color: #00994d;              /* 深绿色文字 */
    font-weight: 500;
    border-left: 3px solid #00cc66; /* 左侧状态条 */
    position: relative;
}

.status-false {
    background: #fff0f0;         /* 浅红色背景 */
    color: #cc0000;              /* 深红色文字 */
    font-weight: 500;
    border-left: 3px solid #ff6666; /* 左侧状态条 */
    position: relative;
}

/* 状态标签增强 */
.status-true::after {
    content: "✓";
    position: absolute;
    right: 8px;
    color: #00994d;
    font-weight: bold;
}

/* 无数据状态样式 */
.no-data-cell {
    position: relative;
    height: 200px; /* 固定高度保证可视区域 */
}

.no-data-wrapper {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #999;
    font-size: 1.2em;
}

/* 移动端适配 */
@media (max-width: 768px) {
    .status-true, .status-false {
        font-size: 12px;
        padding: 4px 8px;
    }
    
    .status-true::after, 
    .status-false::after {
        right: 2px;
        font-size: 0.8em;
    }
    .no-data-cell {
        height: 150px; /* 移动端减少高度 */
    }
    
    .no-data-wrapper {
        font-size: 1em;
        padding: 0 15px;
        text-align: center;
    }
    .daemon-list {
        width: 100vw;
        height: 100vh;
        border-radius: 0;
    }
    
    .daemon-table {
        font-size: 12px;
        min-height: 300px; /* 适配移动端高度 */
    }
    
    .action-buttons button {
        padding: 3px 6px;
        font-size: 12px;
    }
}



`;
// daemon接口配置
var addapiurl = '';
var deployapiurl = '';
var listapiurl = '';
var deleteapiurl = '';
var forceapiurl = '';
var mediaapiurl = '';
var iyuuapi = '';
var rssapi = '';
var shellapiurl = '';

// 初始化配置
var config = {};
var currentGroup = {};
initconfig();

const container = createListContainer();

var atBottom = false;
// 页面加载完成后执行
var site_url = decodeURI(window.location.href);

function initconfig() {
    config = loadConfig();
    currentGroup = config.groups[config.activeGroup];

    addapiurl = `${currentGroup.apidomain}/add_torrent?apikey=${currentGroup.apikey}`;
    deployapiurl = `${currentGroup.apidomain}/force_deploy?apikey=${currentGroup.apikey}`;
    listapiurl = `${currentGroup.apidomain}/get_info?apikey=${currentGroup.apikey}`;
    deleteapiurl = `${currentGroup.apidomain}/del_torrent?apikey=${currentGroup.apikey}`;
    forceapiurl = `${currentGroup.apidomain}/force_deploy_torrents?apikey=${currentGroup.apikey}`;
    mediaapiurl = `${currentGroup.apidomain}/get_media?apikey=${currentGroup.apikey}`;
    iyuuapi = `${currentGroup.rssapidomain}/api/iyuu?apikey=${currentGroup.apikey}`;
    rssapi = `${currentGroup.rssapidomain}/api/autobrr/rss_announce_v2?apikey=${currentGroup.apikey}`;
    shellapiurl = `${currentGroup.apidomain}/start_script?apikey=${currentGroup.apikey}`;
}

// 配置管理部分
function loadConfig() {
    const defaultConfig = {
        activeGroup: 'default',
        groups: {
            default: {
                rssapidomain: 'https://xx.xx.xx:8443',
                apidomain: 'https://xx.xx.xx:8443',
                apikey: 'defaultKey',
                buttons: {
                    panel: true,
                    leechtorrent: false,
                    leechtorrent1: false,
                    media: false,
                    pjietu: false,
                    ijietu: false,
                    iyuu: false,
                    add2DB: false
                },
                isnotdownload: false,
                notautopush: []
            }
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
    if (!config.groups || !config.groups[config.activeGroup]) {
        addMsg('当前激活的配置组不存在，请检查 JSON 格式', 'error');
        return;
    }

    GM_setValue('daemon_config', JSON.stringify(config));
}


const used_site_info = {
    '1PTBA': {'url': 'https://1ptba.com/'},
    '52PT': {'url': 'https://52pt.site/'},
    'ACM': {'url': 'https://eiga.moi/'},
    'ANT': {'url': 'https://anthelion.me/'},
    'avz': {'url': 'https://avistaz.to/'},
    'Audiences': {'url': 'https://audiences.me/'},
    'BHD' : {'url': 'https://beyond-hd.me/'},
    'Aither': {'url': 'https://aither.cc/'},
    'BLU': {'url': 'https://blutopia.cc/'},
    'BTN': {'url': 'https://broadcasthe.net/'},
    'BYR': {'url': 'https://byr.pt/'},
    'BTSchool': {'url': 'https://pt.btschool.club/'},
    'CarPt': {'url': 'https://carpt.net/'},
    'CG': {'url': 'http://cinemageddon.net/'},
    'CMCT': {'url': "https://springsunday.net/"},
    'CNZ': {'url': 'https://cinemaz.to/'},
    'CHDBits': {'url': "https://ptchdbits.co/"},
    'DiscFan': {'url': 'https://discfan.net/'},
    'Dragon': {'url': 'https://www.dragonhd.xyz/'},
    'FreeFarm': {'url': 'https://pt.0ff.cc/'},
    'GPW': {'url': 'https://greatposterwall.com/'},
    'HaiDan': {'url': 'https://www.haidan.video/'},
    'HD4FANS': {'url': 'https://pt.hd4fans.org/'},
    'HDArea': {'url': 'https://hdarea.club/'},
    'HDAtmos': {'url': 'https://hdatmos.club/'},
    'HDB': {'url': 'https://hdbits.org/'},
    'HDCity': {'url': 'https://hdcity.city/'},
    'HDDolby': {'url': 'https://www.hddolby.com/'},
    'HDF': {'url': 'https://hdf.world/'},
    'HDfans': {'url': 'http://hdfans.org/'},
    'HDHome': {'url': 'https://hdhome.org/'},
    'HDPost': {'url': 'https://pt.hdpost.top/'},
    'DarkLand': {'url': 'https://darkland.top/'},
    'HDRoute': {'url': 'http://hdroute.org/'},
    'HDSky': {'url': 'https://hdsky.me/'},
    'HDSpace': {'url': 'https://hd-space.org/'},
    'HDT': {'url': 'https://hd-torrents.org/'},
    'HDTime': {'url': 'https://hdtime.org/'},
    'HDU': {'url': 'https://pt.hdupt.com/'},
    'HDVideo': {'url': 'https://hdvideo.one/'},
    'HD-Only': {'url': 'https://hd-only.org/'},
    'HITPT': {'url': 'https://www.hitpt.com/'},
    'HUDBT': {'url': 'https://hudbt.hust.edu.cn/'},
    'iTS': {'url': 'https://shadowthein.net/'},
    'JoyHD': {'url': 'https://www.joyhd.net/'},
    'KG': {'url': 'https://karagarga.in/'},
    'MTeam': {'url': 'https://kp.m-team.cc/'},
    'MTV': {'url': 'https://www.morethantv.me/'},
    'NanYang': {'url': 'https://nanyangpt.com/'},
    'NBL': {'url': 'https://nebulance.io/'},
    'NPUPT': {'url': 'https://npupt.com/'},
    'OpenCD': {'url': 'https://open.cd/'},
    'OPS': {'url': 'https://orpheus.network/'},
    'Oshen': {'url': 'http://www.oshen.win/'},
    'OurBits': {'url': 'https://ourbits.club/'},
    'PHD': {'url': 'https://privatehd.to/'},
    'PigGo': {'url': 'https://piggo.me/'},
    'PTCafe': {'url': 'https://ptcafe.club/'},
    'PTChina': {'url': 'https://ptchina.org/'},
    'PTer': {'url': 'https://pterclub.com/'},
    'PThome': {'url': 'https://www.pthome.net/'},
    'PTP': {'url': 'https://passthepopcorn.me/'},
    'PTsbao': {'url': 'https://ptsbao.club/'},
    'PTT': {'url': 'https://www.pttime.org/'},
    'PuTao': {'url': 'https://pt.sjtu.edu.cn/'},
    'RED': {'url': 'https://redacted.sh/'},
    'SC': {'url': 'https://secret-cinema.pw/'},
    'SoulVoice': {'url': 'https://pt.soulvoice.club/'},
    'TCCF': {'url': 'https://et8.org/'},
    'Tik': {'url': 'https://cinematik.net/'},
    'TJUPT': {'url': 'https://www.tjupt.org/'},
    'TLFbits': {'url': 'http://pt.eastgame.org/'},
    'TTG': {'url': 'https://totheglory.im/'},
    'TVV': {'url': 'http://tv-vault.me/'},
    'UHD': {'url': 'https://uhdbits.org/'},
    'UltraHD': {'url': 'https://ultrahd.net/'},
    'WT-Sakura': {'url': 'https://wintersakura.net/'},
    'xthor': {'url': 'https://xthor.tk/'},
    'YDY': {'url': 'https://pt.hdbd.us/'},
    'ITZMX': {'url': 'https://pt.itzmx.com/'},
    'HDPt': {'url': 'https://hdpt.xyz/'},
    'JPTV': {'url': 'https://jptv.club/'},
    'Monika': {'url': 'https://monikadesign.uk/'},
    'ZMPT': {'url': 'https://zmpt.cc/'},
    '红叶': {'url': 'https://leaves.red/'},
    'ICC': {'url': 'https://www.icc2022.com/'},
    'CyanBug': {'url': 'https://cyanbug.net/'},
    'ZHUQUE': {'url': 'https://zhuque.in/'},
    'YemaPT': {'url': 'https://www.yemapt.org/'},
    '海棠': {'url': 'https://www.htpt.cc/'},
    '杏林': {'url': 'https://xingtan.one/'},
    'UBits': {'url': 'https://ubits.club/'},
    'OKPT': {'url': 'https://www.okpt.net/'},
    'GGPT': {'url': 'https://www.gamegamept.com/'},
    'RS': {'url': 'https://resource.xidian.edu.cn/'},
    'Panda': {'url': 'https://pandapt.net/'},
    'KuFei': {'url': 'https://kufei.org/'},
    'RouSi': {'url': 'https://rousi.zip/'},
    '悟空': {'url': 'https://wukongwendao.top/'},
    'GTK': {'url': 'https://pt.gtk.pw/'},
    '象岛': {'url': 'https://ptvicomo.net/'},
    '麒麟': {'url': 'https://www.hdkyl.in/'},
    'AGSV': {'url': 'https://www.agsvpt.com/'},
    'ECUST': {'url': 'https://pt.ecust.pp.ua/'},
    'iloli': {'url': 'https://share.ilolicon.com/'},
    'CrabPt': {'url': 'https://crabpt.vip/'},
    'QingWa': {'url': 'https://qingwapt.com/'},
    'FNP': {'url': 'https://fearnopeer.com/'},
    'OnlyEncodes': {'url': 'https://onlyencodes.cc/'},
    'PTFans': {'url': 'https://ptfans.cc/'},
    '影': {'url': 'https://star-space.net/'},
    'PTzone': {'url': 'https://ptzone.xyz/'},
    '雨': {'url': 'https://raingfh.top/'},
    'PTLGS': {'url': 'https://ptlgs.org/'},
    'NJTUPT': {'url': 'https://njtupt.top/'},
    'LemonHD': {'url': 'https://lemonhd.club/'},
    'ReelFliX': {'url': 'https://reelflix.xyz/'},
    'HDClone': {'url': 'https://pt.hdclone.org/'}
};

//用来判断地址属于哪个站点（国内发布站点，国外源站点，或其他）
function find_origin_site(url){
    var domain; //域名
    var reg;    //正则匹配表达式
    var key;
    //先从发布站点找
    for (key in used_site_info){
        //获取域名
        domain = used_site_info[key].url.split('//')[1].replace('/', '');
        reg = new RegExp(domain, 'i');
        if (url.match(reg)){
            return key;
        }
    }
    return 'other';
}
var now_site = find_origin_site(site_url);

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
    if (currentGroup.notautopush && currentGroup.notautopush.includes(now_site)) {
        console.log('当前站点不自动推送');
    } else {
        // 等待目标元素加载完成
        waitForElement(processDownload);
    }
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
        if(currentGroup.isnotdownload){
            const requestUUID = generateUUID();
            const timestamp = Math.floor(Date.now() / 1000).toString();
            generateSignature(requestUUID, timestamp)
                .then((signature) => {
                    const payload = {
                        torrent_link: url,
                        forceadd: true,
                        leechtorrent: leechtorrent || false
                    };

                    GM_xmlhttpRequest({
                        method: "POST",
                        url: addapiurl,
                        headers: {
                            "Content-Type": "application/json",
                            "uuid": requestUUID,
                            "timestamp": timestamp,
                            "signature": signature
                        },
                        data: JSON.stringify(payload),
                        onload: function (response) {
                            console.log(response.responseText);
                            var result = JSON.parse(response.responseText);
                            if (response.status == 200 && result.status === 'success') {
                                var msg_str = [
                                    (result.isavailable ? '可用' : '不可用')+'/'+ result.tracker,
                                    result.torrent_name,
                                ].join('\n');
                                addMsg(msg_str);
                                resolve();
                            } else {
                                var msg = [
                                    '失败原因: ' + result.message
                                ].join('\n');
                                addMsg(msg, 'error');
                                reject(result.message);
                            }
                        }
                    });
                });
        } else {
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
        }
    });
}


function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function generateSignature(uuid, timestamp) {
    const signString = `${currentGroup.apikey}${uuid}${timestamp}`;
    return sha256(signString);
}

function sha256(str) {
    const buffer = new TextEncoder().encode(str);
    return crypto.subtle.digest('SHA-256', buffer).then(hash => {
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
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
                        torrent_bytesio: torrentBase64,
                        forceadd: true,
                        leechtorrent: leechtorrent || false
                    };

                    GM_xmlhttpRequest({
                        method: "POST",
                        url: addapiurl,
                        headers: {
                            "Content-Type": "application/json",
                            "uuid": requestUUID,
                            "timestamp": timestamp,
                            "signature": signature
                        },
                        data: JSON.stringify(payload),
                        onload: function (response) {
                            console.log(response.responseText);
                            const result = JSON.parse(response.responseText);
                            if (response.status == 200 && result.status === 'success') {
                                var msg_str = [
                                    (result.isavailable ? '可用' : '不可用')+'/'+ result.tracker,
                                    result.torrent_name,
                                ].join('\n');
                                addMsg(msg_str);
                                resolve();
                            } else {
                                var msg = [
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

async function add2DB(torrentLink) {
    return new Promise((resolve, reject) => {
        const payload = {
            TorrentUrl: torrentLink,
            delay_iyuu: 10
        };

        GM_xmlhttpRequest({
            method: "POST",
            url: rssapi,
            headers: {
                "Content-Type": "application/json"
            },
            data: JSON.stringify(payload),
            onload: function (response) {
                console.log(response.responseText);
                var result = JSON.parse(response.responseText);
                if (response.status == 200 && result.status === 'success') {
                    var msg = [
                        '添加到数据库成功'
                    ].join('\n');
                    addMsg(msg);
                    resolve();
                } else {
                    var msg = [
                        '添加到数据库成功失败',
                        '失败原因: ' + result.message
                    ].join('\n');
                    addMsg(msg, 'error');
                    reject(result.message);
                }
            }
        });
    });
}

async function listTorrent() {
    try {
        const requestUUID = generateUUID();
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = await generateSignature(requestUUID, timestamp);

        const payload = {
        };

        const response = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: listapiurl,
                headers: {
                    "Content-Type": "application/json",
                    "uuid": requestUUID,
                    "timestamp": timestamp,
                    "signature": signature
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
            if (data.status === "success") {
                const torrents = data.data;
                const tableHTML = generateTableHTML(torrents);

                displayTable(tableHTML);
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
                    <th style="width:6%">类型</th>
                    <th style="width:30%">名称</th>
                    <th style="width:6%">大小</th>
                    <th style="width:10%">Tracker</th>
                    <th style="width:8%">添加时间</th>
                    <th style="width:8%">修改时间</th>
                    <th style="width:6%">可用</th>
                    <th style="width:6%">已推</th>
                    <th style="width:6%">优先级</th>
                    <th style="width:10%">备注</th>
                    <th style="width:8%">操作</th>
                </tr>
            </thead>
            <tbody>`;

    if (!torrents || torrents.length === 0) {
        tableHTML += `
            <tr>
                <td colspan="11" class="no-data-cell">
                    <div class="no-data-wrapper">暂无数据</div>
                </td>
            </tr>`;
    } else {
        torrents.forEach(torrent => {
            // 新增样式类判断逻辑
            const typeClass = torrent.queue_type == '1' ? 'status-true' : 'status-false';
            const availableClass = torrent.isavailable ? 'status-true' : 'status-false';
            const pushedClass = torrent.ispushed ? 'status-true' : 'status-false';

            tableHTML += `
                <tr data-id="${torrent.id}" data-hash="${torrent.torrent_hash}" data-name="${torrent.torrent_name}" data-tracker="${torrent.torrent_tracker}" >
                    <td class="${typeClass}">${torrent.queue_type == '1' ? '发布' : '进货'}</td>
                    <td class="torrent-name">${torrent.torrent_name}</td>
                    <td>${torrent.torrent_size}</td>
                    <td>${torrent.torrent_tracker}</td>
                    <td>${torrent.create_time_str}</td>
                    <td>${torrent.modify_time_str}</td>
                    <td class="${availableClass}">${torrent.isavailable ? '可用' : '不可用'}</td>
                    <td class="${pushedClass}">${torrent.ispushed ? '已推' : '未推'}</td>
                    <td>${torrent.sort}</td>
                    <td>${torrent.remark ? torrent.remark : ""}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="delete-btn" title="删除">🗑️</button>
                            <button class="force-push-btn" title="强制推送">⚡</button>
                        </div>
                    </td>
                </tr>`;
        });
    }
    tableHTML += `</tbody></table>`;

    return tableHTML;
}

function displayTable(tableHTML) {
    // 关闭已有的容器
    const existingContainer = document.getElementById('daemon-list');
    if (existingContainer) {
        existingContainer.classList.remove('visible');
        existingContainer.innerHTML = ''; // 清空内容
    }

    // 创建或获取新的容器
    let container;
    if (!existingContainer) {
        container = createListContainer();
        document.body.appendChild(container);
    } else {
        container = existingContainer;
    }

    // 设置新内容
    container.innerHTML = `
        <div class="list-header">
            <strong style="font-size:1.2em">种子监控面板</strong>
            <button class="refresh-btn" title="刷新">🔄</button>
            <button class="close-btn" title="关闭">×</button>
        </div>
        <div class="list-content">
            ${tableHTML}
        </div>
    `;
    container.classList.add('visible');

    // 绑定关闭按钮事件
    const closeBtn = container.querySelector('.close-btn');
    if (closeBtn && !closeBtn.dataset.listenerAdded) {
        closeBtn.addEventListener('click', () => {
            container.classList.remove('visible');
        });
        closeBtn.dataset.listenerAdded = true;
    }

    // 绑定刷新按钮事件
    const refreshBtn = container.querySelector('.refresh-btn');
    if (refreshBtn && !refreshBtn.dataset.listenerAdded) {
        refreshBtn.addEventListener('click', () => {
            // 禁用按钮
            refreshBtn.disabled = true;
            refreshBtn.classList.add('loading');

            listTorrent()
                .then(() => {
                    refreshBtn.disabled = false;
                    refreshBtn.classList.remove('loading');
                })
                .catch((error) => {
                    console.error('操作失败:', error);
                    refreshBtn.disabled = false;
                    refreshBtn.classList.remove('loading');
                });
        });
        refreshBtn.dataset.listenerAdded = true;
    }

    // 为表格行绑定数据（使用事件委托）
    const tableBody = container.querySelector('.daemon-table tbody');
    if (tableBody && !tableBody.dataset.listenerAdded) {
        tableBody.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-btn');
            const forcePushBtn = e.target.closest('.force-push-btn');
            const row = e.target.closest('tr');

            if (row && (deleteBtn || forcePushBtn)) {
                const hash = row.dataset.hash;
                const md5 = row.dataset.md5;
                const tracker = row.dataset.tracker;
                const name = row.dataset.name;

                if (deleteBtn) {
                    deleteRelatedData(hash, md5, tracker, name);
                }

                if (forcePushBtn) {
                    forcePushRelatedData(hash, md5, tracker, name);
                }
            }
        });
        tableBody.dataset.listenerAdded = true;
    }
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
    msg = config.activeGroup + "\n" +msg;

    msgBox.value = msg.replace(/\\n/g, '\n');

    // 动态调整 textarea 的高度
    // msgBox.style.height = 'auto'; // 先设置为 auto，以便根据内容计算高度
    // msgBox.style.height = Math.min(msgBox.scrollHeight, 100) + 'px'; // 限制最大高度为 200px
    msgBox.style.height = '110px'; // 先设置为 auto，以便根据内容计算高度

    if (type && type == 'error') {
        msgBox.className = 'daemon-msg daemon-msg-fail';
    } else {
        msgBox.className = 'daemon-msg';
    }
}
async function deleteRelatedData(hash, md5, tracker, name) {
    if (!confirm(`确定要删除以下相关数据吗？\n种子名: ${name}\nTracker: ${tracker}\nHash: ${hash}`)) return;

    try {
        const requestUUID = generateUUID();
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = await generateSignature(requestUUID, timestamp);

        const payload = {
            torrent_hash: hash,
            torrent_md5: md5
        };

        GM_xmlhttpRequest({
            method: "POST",
            url: deleteapiurl,
            headers: {
                "Content-Type": "application/json",
                "uuid": requestUUID,
                "timestamp": timestamp,
                "signature": signature
            },
            data: JSON.stringify(payload),
            onload: function (response) {
                console.log("del torrent_hash:", hash);
                console.log("Status Code:", response.status);
                console.log(response.responseText);

                var result = JSON.parse(response.responseText);
                if (response.status == 200) {
                    addMsg(result.message);
                    // listTorrent(); // 刷新列表
                } else {
                    addMsg(result.message, 'error');
                }
            }
        });
    } catch (error) {
        console.error('失败:', error);
        addMsg('失败: ' + error.message, 'error');
    }
}
async function forcePushRelatedData(hash, md5, tracker, name) {
    if (!confirm(`确定要强制推送以下相关数据吗？\n种子名: ${name}\nTracker: ${tracker}\nHash: ${hash}`)) return;

    try {
        const requestUUID = generateUUID();
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = await generateSignature(requestUUID, timestamp);

        const payload = {
            torrent_hash: hash
        };

        GM_xmlhttpRequest({
            method: "POST",
            url: forceapiurl,
            headers: {
                "Content-Type": "application/json",
                "uuid": requestUUID,
                "timestamp": timestamp,
                "signature": signature
            },
            data: JSON.stringify(payload),
            onload: function (response) {
                console.log("force torrent_hash:", hash);
                console.log("Status Code:", response.status);
                console.log(response.responseText);
                var result = JSON.parse(response.responseText);
                if (response.status == 200) {
                    addMsg(result.message);
                    // listTorrent(); // 刷新列表
                } else {
                    addMsg(result.message, 'error');
                }
            }
        });
    } catch (error) {
        console.error('失败:', error);
        addMsg('失败: ' + error.message, 'error');
    }
}

function getBlob(url, fileapiurl, callback) {
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
function showConfigSwitcher() {
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
    modal.style.width = '300px';

    const title = document.createElement('h3');
    title.textContent = '切换配置组';
    title.style.marginTop = '0';
    modal.appendChild(title);

    const list = document.createElement('div');
    list.style.maxHeight = '300px';
    list.style.overflowY = 'auto';

    const configGroups = Object.keys(config.groups);
    configGroups.forEach(groupName => {
        const btn = document.createElement('button');
        btn.textContent = groupName;
        btn.style.display = 'block';
        btn.style.width = '100%';
        btn.style.marginBottom = '8px';
        btn.style.padding = '8px 12px';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.backgroundColor = config.activeGroup === groupName ? '#007bff' : '#f1f1f1';
        btn.style.color = config.activeGroup === groupName ? '#fff' : '#333';
        btn.style.cursor = 'pointer';
        btn.style.fontWeight = config.activeGroup === groupName ? 'bold' : 'normal';
        btn.style.transition = 'all 0.2s ease';

        btn.addEventListener('click', () => {
            config.activeGroup = groupName;
            saveConfig(config);
            initconfig();
            updateSwitchButtonLabel(groupName);
            addMsg(`已切换到配置组：${groupName}`);
            document.body.removeChild(modal);
        });

        list.appendChild(btn);
    });

    modal.appendChild(list);

    // 关闭按钮
    const closeButton = document.createElement('button');
    closeButton.textContent = '关闭';
    closeButton.style.marginTop = '10px';
    closeButton.style.padding = '8px 16px';
    closeButton.style.backgroundColor = '#dc3545';
    closeButton.style.color = '#fff';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '4px';
    closeButton.style.cursor = 'pointer';

    closeButton.addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    modal.appendChild(closeButton);

    document.body.appendChild(modal);
}
function updateSwitchButtonLabel(groupName) {
    const switchBtn = [...btnContainer.children].find(el => el.textContent.startsWith('切换配置'));
    if (switchBtn) {
        switchBtn.textContent = `${groupName}`;
    }
}
async function start_script(command) {
    return new Promise((resolve, reject) => {
        var torrentBase64 ;
        const element = document.getElementById('tBlob');
        if (element) {
            torrentBase64 =  element.value;
        }
        const payload = {
            torrent_bytesio: torrentBase64,
            command: command,
            torrent_link: getUrl()
        };

        GM_xmlhttpRequest({
            method: "POST",
            url: shellapiurl,
            headers: {
                "Content-Type": "application/json",
            },
            data: JSON.stringify(payload),
            onload: function (response) {
                console.log(response.responseText);
                const result = JSON.parse(response.responseText);
                if (response.status == 200 && result.status === 'success') {
                    var msg = [
                        result.data.output,
                    ].join('\n');

                    if (command == 'media'){
                        if (now_site == 'Audiences') {
                            msg = [
                                '[Mediainfo]',
                                result.data.output,
                                '[/Mediainfo]'
                            ].join('\n');
                        } else if (now_site == 'OurBits' || now_site == 'CHDBits') {
                            msg = [
                                '[quote]',
                                result.data.output,
                                '[/quote]'
                            ].join('\n');
                        } else if (now_site == 'PTer') {
                            msg = [
                                '[hide=mediainfo]',
                                result.data.output,
                                '[/hide]'
                            ].join('\n');
                        }
                    }
                    showMediaInfo(msg); // 使用 showMediaInfo 展示结果
                    resolve();
                } else {
                    var errmsg = [
                        '获取媒体信息失败',
                        '失败原因: ' + result.message
                    ].join('\n');
                    addMsg(errmsg, 'error');
                    reject(result.message);
                }
            },
            onerror: function (error) {
                console.error('获取媒体信息失败:', error);
                addMsg('获取媒体信息失败','error');
                reject(error);
            }
        });
    });
}

async function get_media(command) {
    return new Promise((resolve, reject) => {
        const requestUUID = generateUUID();
        const timestamp = Math.floor(Date.now() / 1000).toString();

        generateSignature(requestUUID, timestamp)
            .then((signature) => {
                var torrentBase64 ;
                const element = document.getElementById('tBlob');
                if (element) {
                    torrentBase64 =  element.value;
                }

                const payload = {
                    torrent_bytesio: torrentBase64,
                    command: command,
                    torrent_link: getUrl()
                };

                GM_xmlhttpRequest({
                    method: "POST",
                    url: mediaapiurl,
                    headers: {
                        "Content-Type": "application/json",
                        "uuid": requestUUID,
                        "timestamp": timestamp,
                        "signature": signature
                    },
                    data: JSON.stringify(payload),
                    onload: function (response) {
                        console.log(response.responseText);
                        const result = JSON.parse(response.responseText);
                        if (response.status == 200 && result.status === 'success') {
                            var msg = [
                                result.data.output,
                            ].join('\n');

                            if (command == 'media'){
                                if (now_site == 'Audiences') {
                                    msg = [
                                        '[Mediainfo]',
                                        result.data.output,
                                        '[/Mediainfo]'
                                    ].join('\n');
                                } else if (now_site == 'OurBits' || now_site == 'CHDBits') {
                                    msg = [
                                        '[quote]',
                                        result.data.output,
                                        '[/quote]'
                                    ].join('\n');
                                } else if (now_site == 'PTer') {
                                    msg = [
                                        '[hide=mediainfo]',
                                        result.data.output,
                                        '[/hide]'
                                    ].join('\n');
                                }
                            }
                            showMediaInfo(msg); // 使用 showMediaInfo 展示结果
                            resolve();
                        } else {
                            var errmsg = [
                                '获取媒体信息失败',
                                '失败原因: ' + result.message
                            ].join('\n');
                            addMsg(errmsg, 'error');
                            reject(result.message);
                        }
                    },
                    onerror: function (error) {
                        console.error('获取媒体信息失败:', error);
                        addMsg('获取媒体信息失败','error');
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

if (site_url.match(/upload.php/) || site_url.match(/upload#separator/)) {
    addButton('发布', () => {
        var publishButton = document.querySelector('input[value="发布"]');
        if (!publishButton) {
            publishButton = document.querySelector('button.ant-btn-primary[type="submit"]');
            if(publishButton){
            }
        }
        if (!publishButton) {
            addMsg('未找到发布按钮！');
            return;
        }
        publishButton.click();
    });
}
// 添加按钮
if (site_url.match(/torrent/) || site_url.match(/detail\//) || site_url.match(/details.php/) || site_url.match(/totheglory.im\/t\//)) {
    addButton('编辑', () => {

        const editButton = document.querySelector('a[href*="edit.php"]');
        if (editButton) {
            window.location.assign(editButton.href);
        } else {
            addMsg('未找到编辑按钮！');
        }
    });
    addButton('发|推', () => {
        return getFile(getUrl()); // 返回 Promise
    });
    addButton('发|本', () => {
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
    if(currentGroup.buttons.leechtorrent){
        addButton('进|推', () => {
            if (!confirm(`确定进货？`)) return new Promise((resolve) => { });
            return getFile(getUrl(), true);
        });
    }
    if(currentGroup.buttons.leechtorrent1){
        addButton('进|本', () => {
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
if (site_url.match(/edit.php/)) {
    addButton('编辑', () => {
        var editButton = document.querySelector('input[id="qr"]');
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
if(currentGroup.buttons.media){
    addButton('media', () => {
        return get_media('media'); // 返回 Promise
    });
}
if(currentGroup.buttons.pjietu){
    addButton('截ptp', () => {
        return get_media('pjietu'); // 返回 Promise
    });
}
if(currentGroup.buttons.ijietu){
    addButton('截img', () => {
        return get_media('ijietu'); // 返回 Promise
    });
}
if(currentGroup.buttons.iyuu){
    addButton('IYUU', async() => {
        await getBlob(getUrl(), iyuuapi, iyuuQuery)
    });
}
if(currentGroup.buttons.add2DB){
    addButton('入库', async() => {
        await add2DB(getUrl())
    });
}
if(currentGroup.buttons.panel){
    addButton('面板', () => {
        return listTorrent(); // 返回 Promise
    });
}
addButton('设置', handleSettings);
addButton(`组|${config.activeGroup}`, () => {
    showConfigSwitcher();
});



