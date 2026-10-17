// ==UserScript==
// @name         USTC Icourse Helper
// @name:zh-CN   USTC 评课社区助手
// @license      gpl-3.0
// @namespace    ustc-icourse-helper
// @version      1.2.0
// @description  Auto-collect attachments and links from course reviews on icourse.club into a floating panel, with one-click collection from other teachers' pages of the same course. Works for anonymous users too (attachments shown as login-required). Based on PRO's USTC Helper (GPL-3.0) icourse module, no external dependencies.
// @description:zh-CN  自动收集评课社区课程点评区的附件和链接,在页面右侧生成悬浮汇总面板,支持快速定位到原点评;可一键搜集同课程其他老师页面的资料(当日缓存)。未登录也能用:附件显示名称并提示登录后下载。基于 PRO 的 USTC Helper (GPL-3.0) icourse 模块提取,无任何外部依赖。
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
    // 未登录时附件链接被服务端替换为登录弹窗链接,但文件名保留
    const isAnonFile = (a) =>
        a.getAttribute('data-target') === '#signin' && /\.[a-z0-9]{2,5}$/i.test(a.textContent.trim());

    // 同一页面内同一附件/链接可能被多条点评重复引用,按地址(匿名时按文件名)去重
    function dedupe(items) {
        const seen = new Set();
        return items.filter(it => {
            const key = it.href || it.name;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    // 从(本页或 fetch 来的)文档中收集附件与外链;withEle 时附带元素引用用于「定位」
    function collectFromDoc(doc, withEle) {
        const fileLinks = Array.from(doc.querySelectorAll(`${reviewSel} a[href^='/uploads/files/']`));
        const anonFileLinks = fileLinks.length ? [] :
            Array.from(doc.querySelectorAll(`${reviewSel} a[data-target='#signin']`)).filter(isAnonFile);
        const files = (fileLinks.length ? fileLinks : anonFileLinks).map(a => ({
            name: a.textContent.trim(),
            href: fileLinks.length ? a.getAttribute('href') : null,
            ele: withEle ? a : null,
        }));
        const links = Array.from(doc.querySelectorAll(`${reviewSel} a[href^='http']`))
            .filter(a => !a.href.includes('/uploads/files/') && a.getAttribute('data-target') !== '#signin')
            .map(a => ({ name: a.textContent.trim() || a.href, href: a.href, ele: withEle ? a : null }));
        return { files: dedupe(files), links: dedupe(links) };
    }

    const local = collectFromDoc(document, true);
    if (!local.files.length && !local.links.length) return; // 没有可收集的资料

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
.uih-teacher { flex: none; font-size: 12px; color: #999; text-decoration: none; }
.uih-teacher:hover { color: #337ab7; }
.uih-loc { flex: none; color: #999; cursor: pointer; font-size: 12px; }
.uih-loc:hover { color: #337ab7; }
#uih-foot { padding: 6px 0 4px; border-top: 1px dashed #ddd; text-align: center; margin-top: 6px; }
#uih-more { background: none; border: 1px solid #337ab7; color: #337ab7; border-radius: 4px; padding: 3px 10px; font-size: 12px; cursor: pointer; }
#uih-more:hover:not(:disabled) { background: #337ab7; color: #fff; }
#uih-more:disabled { border-color: #ccc; color: #999; cursor: default; }
`;

    const root = document.body.appendChild(document.createElement('div'));
    root.id = 'ustc-icourse-helper';
    root.innerHTML =
        `<button id="uih-tab" type="button">资料<span></span></button>` +
        `<div id="uih-panel">` +
        `<div id="uih-head">课程资料<button id="uih-close" type="button" title="收起">×</button></div>` +
        `<div id="uih-body"></div>` +
        `</div>`;

    const body = root.querySelector('#uih-body');
    const foot = body.appendChild(document.createElement('div'));
    foot.id = 'uih-foot';
    const moreBtn = foot.appendChild(document.createElement('button'));
    moreBtn.id = 'uih-more';
    moreBtn.type = 'button';
    moreBtn.textContent = '搜集其他老师的同课程资料';

    const state = { files: [...local.files], links: [...local.links] };
    const secs = {};

    function addRow(sec, item, { downloadable = false } = {}) {
        const row = sec.appendChild(document.createElement('div'));
        row.className = 'uih-item';
        const a = row.appendChild(document.createElement('a'));
        a.className = 'uih-link';
        a.textContent = item.name;
        if (item.href) {
            a.href = item.href;
            a.target = '_blank';
            a.rel = 'noopener';
            a.title = item.name;
            if (downloadable) {
                const ext = item.href.split('.').pop();
                if (item.name.toLowerCase().endsWith(ext.toLowerCase())) a.download = item.name;
            }
        } else { // 未登录:只有文件名,点击弹登录框
            a.href = '#';
            a.setAttribute('data-toggle', 'modal');
            a.setAttribute('data-target', '#signin');
            a.title = item.name + '（登录后可下载）';
        }
        if (item.teacher) {
            const t = row.appendChild(document.createElement('a'));
            t.className = 'uih-teacher';
            t.textContent = item.teacher;
            t.href = item.teacherHref;
            t.target = '_blank';
            t.rel = 'noopener';
            t.title = `前往 ${item.teacher} 老师的课程页`;
        }
        if (item.ele) {
            const loc = row.appendChild(document.createElement('span'));
            loc.className = 'uih-loc';
            loc.textContent = '定位';
            loc.title = '定位到原点评';
            loc.addEventListener('click', () => {
                item.ele.scrollIntoView({ block: 'center' });
                setTimeout(() => flash(item.ele), 300);
            });
        }
    }

    function createSection(titleText) {
        const sec = body.insertBefore(document.createElement('div'), foot);
        const title = sec.appendChild(document.createElement('div'));
        title.className = 'uih-sec-title';
        title.textContent = titleText;
        return sec;
    }

    function updateFileTitle() {
        if (!secs.files) return;
        const allAnon = state.files.every(f => !f.href);
        secs.files.querySelector('.uih-sec-title').textContent = '文件列表' + (allAnon ? '（登录后下载）' : '');
    }

    function updateTab() {
        root.querySelector('#uih-tab span').textContent = `${state.files.length}+${state.links.length}`;
    }

    if (local.files.length) {
        secs.files = createSection('文件列表');
        local.files.forEach(it => addRow(secs.files, it, { downloadable: true }));
    }
    if (local.links.length) {
        secs.links = createSection('链接列表');
        local.links.forEach(it => addRow(secs.links, it));
    }
    updateFileTitle();
    updateTab();
    log(`本页: 文件 ${local.files.length}, 链接 ${local.links.length}.`);

    // ---- 搜集其他老师的同课程资料 ----
    const courseId = (location.pathname.match(/\/course\/(\d+)/) || [])[1];
    const otherBlockTitle = Array.from(sideBar.querySelectorAll('h4'))
        .find(h => h.textContent.includes('其他老师'));
    const teachers = otherBlockTitle ?
        Array.from(otherBlockTitle.parentElement.querySelectorAll('a[href^="/course/"]'))
            .map(a => ({ name: a.textContent.trim(), href: a.getAttribute('href') })) : [];

    if (!courseId || !teachers.length) {
        foot.remove();
    } else {
        const cacheKey = `ustc-icourse-xc:${courseId}`;
        const today = new Date().toDateString();
        const readCache = () => {
            try {
                const c = JSON.parse(localStorage.getItem(cacheKey));
                if (c && c.date === today) return c.data;
            } catch (e) { /* 忽略损坏的缓存 */ }
            return null;
        };

        function merge(data) {
            for (const f of data.files) {
                if (!secs.files) secs.files = createSection('文件列表');
                addRow(secs.files, f, { downloadable: true });
            }
            for (const l of data.links) {
                if (!secs.links) secs.links = createSection('链接列表');
                addRow(secs.links, l);
            }
            state.files.push(...data.files);
            state.links.push(...data.links);
            updateFileTitle();
            updateTab();
        }

        moreBtn.addEventListener('click', async () => {
            moreBtn.disabled = true;
            let data = readCache();
            if (data) {
                log('使用今日缓存的其他老师资料.');
            } else {
                data = { files: [], links: [] };
                let done = 0;
                const run = async (t) => {
                    try {
                        const html = await (await fetch(t.href)).text();
                        const doc = new DOMParser().parseFromString(html, 'text/html');
                        const c = collectFromDoc(doc, false);
                        c.files.forEach(f => data.files.push({ ...f, teacher: t.name, teacherHref: t.href }));
                        c.links.forEach(l => data.links.push({ ...l, teacher: t.name, teacherHref: t.href }));
                    } catch (e) {
                        log(`抓取 ${t.name} (${t.href}) 失败:`, e);
                    }
                    moreBtn.textContent = `搜集中… (${++done}/${teachers.length})`;
                };
                const queue = [...teachers];
                await Promise.all(Array.from({ length: 4 }, async () => {
                    while (queue.length) await run(queue.shift());
                }));
                try {
                    localStorage.setItem(cacheKey, JSON.stringify({ date: today, data }));
                } catch (e) { /* 存储满时放弃缓存 */ }
            }
            merge(data);
            const contributed = new Set([...data.files, ...data.links].map(x => x.teacher)).size;
            moreBtn.textContent = `已收录 ${contributed} 位老师的资料（${data.files.length} 文件 / ${data.links.length} 链接）`;
            log(`其他老师: 文件 ${data.files.length}, 链接 ${data.links.length}.`);
        });
    }

    root.querySelector('#uih-tab').addEventListener('click', () => root.classList.toggle('uih-open'));
    root.querySelector('#uih-close').addEventListener('click', () => root.classList.remove('uih-open'));

    // 首次进入自动展开几秒,提示面板存在
    root.classList.add('uih-open');
    setTimeout(() => root.classList.remove('uih-open'), 3000);
})();
