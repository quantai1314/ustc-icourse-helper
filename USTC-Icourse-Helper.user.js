// ==UserScript==
// @name         USTC Icourse Helper
// @name:zh-CN   USTC 评课社区助手
// @license      gpl-3.0
// @namespace    ustc-icourse-helper
// @version      1.1.0
// @description  Auto-collect attachments and links from course reviews on icourse.club into a floating panel. Works for anonymous users too (attachments shown as login-required). Based on PRO's USTC Helper (GPL-3.0) icourse module, no external dependencies.
// @description:zh-CN  自动收集评课社区课程点评区的附件和链接,在页面右侧生成悬浮汇总面板,支持快速定位到原点评,面板不随页面滚动消失。未登录也能用:附件显示名称并提示登录后下载。基于 PRO 的 USTC Helper (GPL-3.0) icourse 模块提取,无任何外部依赖。
// @match        https://icourse.club/*
// @icon         https://icourse.club/favicon.ico
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';
    const log = console.log.bind(console, "[USTC Icourse Helper]");

    const sideBar = document.querySelector('div.col-md-4.rl-pd-lg');
    if (!sideBar) return; // 非课程页面

    const reviewSel = 'div.review-content';

    // 附件链接:登录后是 /uploads/files/ 直链;未登录时被服务端替换为登录弹窗链接,但文件名保留
    const fileLinks = Array.from(document.querySelectorAll(`${reviewSel} a[href^='/uploads/files/']`));
    const isAnonFile = (a) =>
        a.getAttribute('data-target') === '#signin' && /\.[a-z0-9]{2,5}$/i.test(a.textContent.trim());
    const anonFileLinks = fileLinks.length ? [] :
        Array.from(document.querySelectorAll(`${reviewSel} a[data-target='#signin']`)).filter(isAnonFile);
    const needLogin = !fileLinks.length && anonFileLinks.length > 0;
    const files = fileLinks.length ? fileLinks : anonFileLinks;

    // 外部链接:只收 http(s) 直链,排除锚点、登录弹窗和附件
    const extLinks = Array.from(document.querySelectorAll(`${reviewSel} a[href^='http']`))
        .filter(a => !a.href.includes('/uploads/files/') && a.getAttribute('data-target') !== '#signin');

    if (!files.length && !extLinks.length) return; // 没有可收集的资料

    function flash(ele) {
        ele.animate([
            { opacity: '1' }, { opacity: '0' }, { opacity: '1' },
            { opacity: '0' }, { opacity: '1' }
        ], { duration: 1000, iterations: 2 });
    }

    const style = document.head.appendChild(document.createElement('style'));
    style.id = 'ustc-icourse-helper-style';
    style.textContent = `
#ustc-icourse-helper { position: fixed; right: 0; top: 40%; z-index: 10000; font-size: 13px; }
#uih-tab { display: block; writing-mode: vertical-rl; padding: 10px 6px; background: #337ab7; color: #fff; border: none; border-radius: 6px 0 0 6px; cursor: pointer; font-size: 13px; letter-spacing: 2px; box-shadow: 0 1px 4px rgba(0,0,0,.3); }
#uih-tab:hover { background: #286090; }
#uih-tab span { letter-spacing: 0; margin-top: 4px; opacity: .85; }
#uih-panel { position: absolute; right: calc(100% + 8px); top: 50%; transform: translateY(-50%) translateX(10px); width: 260px; max-height: 70vh; display: flex; flex-direction: column; background: #fff; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,.18); opacity: 0; visibility: hidden; transition: all .2s ease; }
#ustc-icourse-helper.uih-open #uih-panel { opacity: 1; visibility: visible; transform: translateY(-50%) translateX(0); }
#uih-head { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; font-weight: bold; color: #337ab7; border-bottom: 1px dashed #ddd; }
#uih-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #999; line-height: 1; padding: 0 2px; }
#uih-close:hover { color: #333; }
#uih-body { overflow-y: auto; padding: 4px 10px 8px; }
.uih-sec-title { font-weight: bold; color: #337ab7; margin: 6px 0 2px; }
.uih-item { display: flex; align-items: baseline; gap: 6px; padding: 3px 0; }
.uih-link { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #337ab7; text-decoration: none; }
.uih-link:hover { text-decoration: underline; }
.uih-loc { flex: none; color: #999; cursor: pointer; font-size: 12px; }
.uih-loc:hover { color: #337ab7; }
`;

    const root = document.body.appendChild(document.createElement('div'));
    root.id = 'ustc-icourse-helper';
    root.innerHTML =
        `<button id="uih-tab" type="button">资料<span>${files.length}+${extLinks.length}</span></button>` +
        `<div id="uih-panel">` +
        `<div id="uih-head">课程资料<button id="uih-close" type="button" title="收起">×</button></div>` +
        `<div id="uih-body"></div>` +
        `</div>`;

    const body = root.querySelector('#uih-body');

    function addSection(name, items, { downloadable = false, needLogin: nl = false } = {}) {
        if (!items.length) return;
        const sec = body.appendChild(document.createElement('div'));
        const title = sec.appendChild(document.createElement('div'));
        title.className = 'uih-sec-title';
        title.textContent = name + (nl ? '（登录后下载）' : '');
        for (const ele of items) {
            const name2 = ele.textContent.trim();
            const row = sec.appendChild(document.createElement('div'));
            row.className = 'uih-item';
            const a = row.appendChild(document.createElement('a'));
            a.className = 'uih-link';
            a.textContent = name2;
            if (nl) {
                a.href = '#';
                a.setAttribute('data-toggle', 'modal');
                a.setAttribute('data-target', '#signin');
                a.title = name2 + '（登录后可下载）';
            } else {
                a.href = ele.href;
                a.target = '_blank';
                a.rel = 'noopener';
                a.title = name2;
                if (downloadable) {
                    const ext = ele.href.split('.').pop();
                    if (name2.toLowerCase().endsWith(ext.toLowerCase())) {
                        a.download = name2;
                        ele.download = name2;
                    }
                }
            }
            const loc = row.appendChild(document.createElement('span'));
            loc.className = 'uih-loc';
            loc.textContent = '定位';
            loc.title = '定位到原点评';
            loc.addEventListener('click', () => {
                ele.scrollIntoView({ block: 'center' });
                setTimeout(() => flash(ele), 300);
            });
        }
        log(`${name}: collected ${items.length} item(s).`);
    }

    addSection('文件列表', files, { downloadable: true, needLogin });
    addSection('链接列表', extLinks);

    root.querySelector('#uih-tab').addEventListener('click', () => root.classList.toggle('uih-open'));
    root.querySelector('#uih-close').addEventListener('click', () => root.classList.remove('uih-open'));

    // 首次进入自动展开几秒,提示面板存在
    root.classList.add('uih-open');
    setTimeout(() => root.classList.remove('uih-open'), 3000);
})();
