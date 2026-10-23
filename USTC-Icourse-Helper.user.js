// ==UserScript==
// @name         USTC Icourse Helper
// @name:zh-CN   USTC 评课社区助手
// @license      gpl-3.0
// @namespace    ustc-icourse-helper
// @version      1.3.0
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
    const courseId = (location.pathname.match(/^\/course\/(\d+)\/?$/) || [])[1];
    if (!courseId || !sideBar || document.getElementById('ustc-icourse-helper')) return;

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
    const otherBlockTitle = Array.from(sideBar.querySelectorAll('h4'))
        .find(h => h.textContent.includes('其他老师'));
    const teachers = otherBlockTitle ? Array.from(new Map(
        Array.from(otherBlockTitle.parentElement.querySelectorAll('a[href^="/course/"]'))
            .filter(a => a.getAttribute('href').replace(/\/$/, '') !== `/course/${courseId}`)
            .map(a => [a.getAttribute('href'), { name: a.textContent.trim(), href: a.getAttribute('href') }])
    ).values()) : [];

    function flash(ele) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        ele.animate([
            { backgroundColor: '#fff0ad' }, { backgroundColor: 'transparent' }
        ], { duration: 1600 });
    }

    const style = document.head.appendChild(document.createElement('style'));
    style.id = 'ustc-icourse-helper-style';
    style.textContent = `
#ustc-icourse-helper { --uih-blue: #28679c; --uih-muted: #596b7a; --uih-line: #dce5ed; position: fixed; right: 0; top: 40%; z-index: 10000; color: #243746; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; text-align: left; }
#ustc-icourse-helper :where(aside, header, footer, div, ul, li, a, button, input, p, h2, span) { box-sizing: border-box; }
#ustc-icourse-helper [hidden] { display: none !important; }
#ustc-icourse-helper button { font: inherit; cursor: pointer; min-height: 34px; border: 1px solid var(--uih-line); border-radius: 6px; background: #fff; color: var(--uih-blue); padding: 5px 10px; }
#ustc-icourse-helper button:hover:not(:disabled) { background: #edf4fa; }
#ustc-icourse-helper :is(a, button, input):focus-visible { outline: 2px solid var(--uih-blue); outline-offset: 2px; }
#ustc-icourse-helper #uih-tab { width: 42px; padding: 10px 5px; border: 0; border-radius: 8px 0 0 8px; background: var(--uih-blue); color: #fff; box-shadow: 0 2px 8px #20364d26; }
#uih-tab span { display: block; font-size: 12px; margin-top: 4px; }
#uih-hint { position: absolute; right: 52px; top: 0; width: max-content; margin: 0; padding: 8px 12px; background: #fff; border: 1px solid var(--uih-line); border-radius: 8px; box-shadow: 0 2px 8px #20364d20; color: var(--uih-blue); }
#uih-panel { position: fixed; right: 54px; top: 50%; transform: translateY(-50%); width: 368px; max-width: calc(100vw - 68px); max-height: min(720px, calc(100vh - 32px)); max-height: min(720px, calc(100dvh - 32px)); display: flex; flex-direction: column; background: #fff; border: 1px solid var(--uih-line); border-radius: 12px; box-shadow: 0 8px 32px #20364d26; overflow: hidden; }
#uih-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px 8px; flex: none; }
#uih-title { margin: 0; font-family: inherit; font-size: 17px; font-weight: 600; line-height: 1.5; color: #243746; }
#ustc-icourse-helper #uih-close { min-width: 36px; min-height: 36px; padding: 0; font-size: 22px; color: var(--uih-muted); border-color: transparent; }
#uih-tools { padding: 0 14px 10px; flex: none; border-bottom: 1px solid var(--uih-line); }
#uih-filters { display: flex; gap: 6px; margin-bottom: 10px; }
#uih-filters button { flex: 1; padding-inline: 4px; white-space: nowrap; }
#uih-filters button[aria-pressed="true"] { background: #eaf3fb; border-color: var(--uih-blue); font-weight: 600; }
#uih-search-row { display: flex; gap: 6px; align-items: center; }
#uih-search { width: 100%; min-width: 0; height: 36px; border: 1px solid #aebfcd; border-radius: 6px; padding: 6px 9px; background: #fff; color: #243746; font: inherit; }
#uih-search::placeholder { color: var(--uih-muted); }
#uih-clear { flex: none; }
#uih-summary { margin: 7px 0 0; color: var(--uih-muted); font-size: 12px; }
#uih-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 14px; }
#uih-list { margin: 0; padding: 0; list-style: none; }
#uih-list .uih-item { padding: 11px 0; }
#uih-list .uih-item + .uih-item { border-top: 1px solid #edf1f5; }
#uih-list .uih-link { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; color: var(--uih-blue); text-decoration: none; line-height: 1.55; min-height: 24px; }
#uih-list a:hover { text-decoration: underline; }
#uih-list .uih-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin-top: 5px; color: var(--uih-muted); font-size: 12px; }
#uih-list .uih-kind { background: #f0f4f7; border-radius: 4px; padding: 1px 5px; }
#uih-list .uih-teacher { color: var(--uih-muted); min-height: 24px; display: inline-flex; align-items: center; overflow-wrap: anywhere; }
#uih-list .uih-loc { margin-left: auto; font-size: 12px; min-height: 32px; padding: 3px 9px; }
#uih-empty { margin: 0; padding: 28px 4px; color: var(--uih-muted); text-align: center; }
#uih-foot { padding: 10px 14px 12px; flex: none; border-top: 1px solid var(--uih-line); background: #f8fafc; }
#uih-status { margin: 0; color: var(--uih-muted); font-size: 12px; overflow-wrap: anywhere; }
#uih-status.uih-warning { color: #92520a; }
#ustc-icourse-helper #uih-more { width: 100%; margin-top: 8px; border-color: var(--uih-blue); background: var(--uih-blue); color: #fff; }
#ustc-icourse-helper #uih-more:hover:not(:disabled) { background: #205580; }
#ustc-icourse-helper #uih-more:disabled { background: #e9eef3; border-color: #dce5ed; color: #596b7a; cursor: default; }
#ustc-icourse-helper .uih-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (max-width: 480px) {
    #uih-panel { right: 12px; left: 12px; width: auto; max-width: none; max-height: calc(100vh - 24px); max-height: calc(100dvh - 24px); }
    #ustc-icourse-helper.uih-open #uih-tab { visibility: hidden; }
}
@media (pointer: coarse) {
    #ustc-icourse-helper :is(button, #uih-close, #uih-search, .uih-loc, .uih-teacher, .uih-link) { min-height: 44px; }
}
`;

    const root = document.body.appendChild(document.createElement('div'));
    root.id = 'ustc-icourse-helper';
    root.innerHTML =
        `<button id="uih-tab" type="button" aria-expanded="false" aria-controls="uih-panel">资料<span>0</span></button>` +
        `<p id="uih-hint" hidden>课程资料在这里</p>` +
        `<aside id="uih-panel" aria-labelledby="uih-title" hidden>` +
        `<header id="uih-head"><h2 id="uih-title">课程资料</h2><button id="uih-close" type="button" aria-label="收起课程资料" title="收起（Esc）">×</button></header>` +
        `<div id="uih-tools"><div id="uih-filters" role="group" aria-label="资料类型">` +
        `<button type="button" data-filter="all" aria-pressed="true">全部 0</button>` +
        `<button type="button" data-filter="files" aria-pressed="false">文件 0</button>` +
        `<button type="button" data-filter="links" aria-pressed="false">链接 0</button></div>` +
        `<div id="uih-search-row"><label class="uih-sr-only" for="uih-search">搜索文件名、链接或老师</label>` +
        `<input id="uih-search" type="search" placeholder="搜索文件名、链接或老师" autocomplete="off">` +
        `<button id="uih-clear" type="button" hidden>清空</button></div><p id="uih-summary"></p></div>` +
        `<div id="uih-body"><ul id="uih-list" role="list"></ul><p id="uih-empty" hidden></p></div>` +
        `<footer id="uih-foot"><p id="uih-status" role="status" aria-live="polite" aria-atomic="true"></p>` +
        `<button id="uih-more" type="button">搜集其他老师资料</button></footer></aside>`;

    const tab = root.querySelector('#uih-tab');
    const panel = root.querySelector('#uih-panel');
    const closeBtn = root.querySelector('#uih-close');
    const search = root.querySelector('#uih-search');
    const clearBtn = root.querySelector('#uih-clear');
    const list = root.querySelector('#uih-list');
    const empty = root.querySelector('#uih-empty');
    const status = root.querySelector('#uih-status');
    const moreBtn = root.querySelector('#uih-more');
    const state = { files: [...local.files], links: [...local.links], filter: 'all' };

    function addRow(item, downloadable) {
        const row = document.createElement('li');
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
            a.addEventListener('click', () => setOpen(false, false));
        }
        const meta = row.appendChild(document.createElement('div'));
        meta.className = 'uih-meta';
        const kind = meta.appendChild(document.createElement('span'));
        kind.className = 'uih-kind';
        kind.textContent = downloadable ? ((item.name.match(/\.([a-z0-9]{1,8})$/i) || [])[1] || '文件').toUpperCase() : '链接';
        if (!item.href) {
            const note = meta.appendChild(document.createElement('span'));
            note.textContent = '登录后下载';
        }
        if (item.teacher) {
            const t = meta.appendChild(document.createElement('a'));
            t.className = 'uih-teacher';
            t.textContent = item.teacher;
            t.href = item.teacherHref;
            t.target = '_blank';
            t.rel = 'noopener';
            t.title = `前往 ${item.teacher} 老师的课程页`;
        } else {
            meta.appendChild(document.createElement('span')).textContent = '本页点评';
        }
        if (item.ele) {
            const loc = meta.appendChild(document.createElement('button'));
            loc.type = 'button';
            loc.className = 'uih-loc';
            loc.textContent = '定位';
            loc.title = '定位到原点评';
            loc.setAttribute('aria-label', `定位：${item.name}`);
            loc.addEventListener('click', () => {
                // 窄屏上先收起遮挡正文的面板,桌面上保留连续浏览。
                if (window.matchMedia('(max-width: 480px)').matches) setOpen(false);
                item.ele.scrollIntoView({ block: 'center' });
                setTimeout(() => flash(item.ele), 300);
            });
        }
        return row;
    }

    function render() {
        const total = state.files.length + state.links.length;
        tab.querySelector('span').textContent = total;
        tab.setAttribute('aria-label', `课程资料，共 ${total} 项`);
        const labels = { all: `全部 ${total}`, files: `文件 ${state.files.length}`, links: `链接 ${state.links.length}` };
        root.querySelectorAll('[data-filter]').forEach(btn => {
            btn.textContent = labels[btn.dataset.filter];
            btn.setAttribute('aria-pressed', String(btn.dataset.filter === state.filter));
        });
        const query = search.value.trim().toLocaleLowerCase();
        const fragment = document.createDocumentFragment();
        let count = 0;
        for (const type of ['files', 'links']) {
            if (state.filter !== 'all' && state.filter !== type) continue;
            for (const item of state[type]) {
                if (query && !`${item.name} ${item.teacher || '本页点评'} ${item.href || ''}`.toLocaleLowerCase().includes(query)) continue;
                fragment.appendChild(addRow(item, type === 'files'));
                count++;
            }
        }
        list.replaceChildren(fragment);
        clearBtn.hidden = !search.value;
        empty.hidden = count > 0;
        empty.textContent = query ? '没有匹配的资料，试试其他关键词或清空搜索。' :
            !total ? (teachers.length ? '本页暂无资料，可以搜集其他老师的同课程资料。' : '本页暂未发现文件或链接。') :
            state.filter === 'files' ? '暂无文件，可以切换到链接或搜集其他老师资料。' : '暂无链接，可以切换到文件查看资料。';
        root.querySelector('#uih-summary').textContent = query ? `找到 ${count} 项 · 共 ${total} 项资料` : `显示 ${count} 项资料`;
    }

    root.querySelectorAll('[data-filter]').forEach(btn => btn.addEventListener('click', () => {
        state.filter = btn.dataset.filter;
        render();
        root.querySelector('#uih-body').scrollTop = 0;
    }));
    search.addEventListener('input', render);
    clearBtn.addEventListener('click', () => {
        search.value = '';
        render();
        search.focus();
    });
    render();
    log(`本页: 文件 ${local.files.length}, 链接 ${local.links.length}.`);

    // ---- 搜集其他老师的同课程资料 ----
    if (!teachers.length) {
        moreBtn.hidden = true;
        status.textContent = '本页未列出其他老师的同课程页面。';
    } else {
        status.textContent = `还可搜集 ${teachers.length} 位老师的同课程资料。`;
        const cacheKey = `ustc-icourse-xc:${courseId}`;
        const collected = new Map();
        let loadedCache = false;
        let busy = false;
        function readCache() {
            try {
                const c = JSON.parse(localStorage.getItem(cacheKey));
                if (c?.version !== 2 || c.date !== new Date().toDateString() || !Array.isArray(c.pages)) return;
                for (const page of c.pages) {
                    if (!teachers.some(t => t.href === page.href) || !Array.isArray(page.files) || !Array.isArray(page.links)) continue;
                    const validFile = f => f && typeof f.name === 'string' && (f.href === null || (typeof f.href === 'string' && f.href.startsWith('/uploads/files/')));
                    const validLink = l => l && typeof l.name === 'string' && typeof l.href === 'string' && /^https?:\/\//i.test(l.href);
                    if (page.files.every(validFile) && page.links.every(validLink)) {
                        const plain = items => items.map(({ name, href }) => ({ name, href }));
                        collected.set(page.href, { href: page.href, files: plain(page.files), links: plain(page.links) });
                    }
                }
            } catch (e) { /* 忽略损坏的缓存 */ }
        }

        function merge() {
            state.files = [...local.files];
            state.links = [...local.links];
            // 按侧栏老师顺序显示,不受网络响应先后或重试影响。
            for (const teacher of teachers) {
                const page = collected.get(teacher.href);
                if (!page) continue;
                for (const type of ['files', 'links']) {
                    state[type].push(...page[type].map(item => ({ ...item, teacher: teacher.name, teacherHref: teacher.href })));
                }
            }
            render();
        }

        moreBtn.addEventListener('click', async () => {
            if (busy) return;
            busy = true;
            moreBtn.disabled = true;
            moreBtn.textContent = '正在搜集…';
            status.classList.remove('uih-warning');
            if (!loadedCache) {
                readCache();
                loadedCache = true;
                merge();
            }
            const queue = teachers.filter(t => !collected.has(t.href));
            const fromCache = !queue.length;
            let done = collected.size;
            status.textContent = `已检查 ${done}/${teachers.length} 位老师…`;
            const run = async teacher => {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 15000);
                try {
                    const response = await fetch(teacher.href, { signal: controller.signal });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
                    if (!doc.querySelector('div.col-md-4.rl-pd-lg')) throw new Error('未获取到课程页面');
                    const data = collectFromDoc(doc, false);
                    collected.set(teacher.href, { href: teacher.href, files: data.files, links: data.links });
                } catch (e) {
                    log(`抓取 ${teacher.name} (${teacher.href}) 失败:`, e);
                } finally {
                    clearTimeout(timeout);
                    status.textContent = `已检查 ${++done}/${teachers.length} 位老师…`;
                }
            };
            try {
                await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
                    while (queue.length) await run(queue.shift());
                }));
            } finally {
                busy = false;
                merge();
                const failed = teachers.length - collected.size;
                const files = state.files.length - local.files.length;
                const links = state.links.length - local.links.length;
                status.classList.toggle('uih-warning', failed > 0);
                status.textContent = failed ? `已获取 ${collected.size} 位老师的资料，${failed} 位未成功。已找到 ${files} 个文件、${links} 个链接。` :
                    `已检查 ${teachers.length} 位老师，${files + links ? `找到 ${files} 个文件、${links} 个链接。` : '暂未发现其他资料。'}${fromCache ? '（今日缓存）' : ''}`;
                moreBtn.textContent = failed ? `重试失败的 ${failed} 位老师` : '搜集完成';
                moreBtn.disabled = !failed;
                try {
                    localStorage.setItem(cacheKey, JSON.stringify({ version: 2, date: new Date().toDateString(), pages: [...collected.values()] }));
                } catch (e) { /* 存储不可用时仍可在当前页面重试 */ }
            }
        });
    }

    function setOpen(open, focus = true) {
        panel.hidden = !open;
        root.classList.toggle('uih-open', open);
        tab.setAttribute('aria-expanded', String(open));
        root.querySelector('#uih-hint').hidden = true;
        if (focus) (open ? closeBtn : tab).focus({ preventScroll: true });
    }
    tab.addEventListener('click', () => setOpen(panel.hidden));
    closeBtn.addEventListener('click', () => setOpen(false));
    root.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !event.isComposing && !panel.hidden) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
        }
    });

    // 只提示入口位置,不自动展开或定时收起用户正在阅读的面板。
    try {
        if (!localStorage.getItem('ustc-icourse-hint-seen')) {
            root.querySelector('#uih-hint').hidden = false;
            localStorage.setItem('ustc-icourse-hint-seen', '1');
            setTimeout(() => { root.querySelector('#uih-hint').hidden = true; }, 6000);
        }
    } catch (e) { /* 存储不可用时不重复显示提示 */ }
})();
