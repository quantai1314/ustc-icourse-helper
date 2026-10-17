// ==UserScript==
// @name         USTC Icourse Helper
// @name:zh-CN   USTC 评课社区助手
// @license      gpl-3.0
// @namespace    ustc-icourse-helper
// @version      1.0.0
// @description  Auto-collect attachments and links from course reviews on icourse.club into a sidebar list. Works for anonymous users too (attachments shown as login-required). Based on PRO's USTC Helper (GPL-3.0) icourse module, no external dependencies.
// @description:zh-CN  自动收集评课社区课程点评区的附件和链接,在侧边栏生成汇总列表,支持快速定位到原点评。未登录也能用:附件显示名称并提示登录后下载。基于 PRO 的 USTC Helper (GPL-3.0) icourse 模块提取,无任何外部依赖。
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

    // 外部链接:只收 http(s) 直链,排除锚点、登录弹窗和附件
    const extLinks = Array.from(document.querySelectorAll(`${reviewSel} a[href^='http']`))
        .filter(a => !a.href.includes('/uploads/files/') && a.getAttribute('data-target') !== '#signin');

    function flash(ele) {
        ele.animate([
            { opacity: '1' }, { opacity: '0' }, { opacity: '1' },
            { opacity: '0' }, { opacity: '1' }
        ], { duration: 1000, iterations: 2 });
    }

    function generateList(name, items, { downloadable = false, needLogin = false } = {}) {
        if (!items.length) return;
        const list = sideBar.appendChild(document.createElement('div'));
        list.classList.add('ud-pd-md', 'dashed');
        const title = list.appendChild(document.createElement('h4'));
        title.classList.add('blue');
        title.textContent = name + (needLogin ? '（登录后下载）' : '');

        for (const ele of items) {
            const name2 = ele.textContent.trim();
            const div = list.appendChild(document.createElement('div'));
            div.classList.add('ud-pd-sm');
            const a = div.appendChild(document.createElement('a'));
            a.textContent = name2;
            if (needLogin) {
                a.href = '#';
                a.setAttribute('data-toggle', 'modal');
                a.setAttribute('data-target', '#signin');
                a.title = '登录后可下载';
            } else {
                a.href = ele.href;
                if (downloadable) {
                    const ext = ele.href.split('.').pop();
                    if (name2.toLowerCase().endsWith(ext.toLowerCase())) {
                        a.download = name2;
                        ele.download = name2;
                    }
                }
            }
            const span = div.appendChild(document.createElement('span'));
            span.classList.add('grey', 'float-right');
            span.style.cursor = 'pointer';
            span.title = '定位到原点评';
            span.innerHTML = '<span class="glyphicon glyphicon-share-alt grey"></span>定位';
            span.addEventListener('click', (e) => {
                e.preventDefault();
                ele.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => flash(ele), 300);
            });
        }
        log(`${name}: collected ${items.length} item(s).`);
    }

    generateList('文件列表', fileLinks.length ? fileLinks : anonFileLinks,
        { downloadable: true, needLogin: !fileLinks.length && anonFileLinks.length > 0 });
    generateList('链接列表', extLinks);
})();
