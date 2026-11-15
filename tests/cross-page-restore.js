async (page) => {
    const context = await page.context().browser().newContext();
    page = await context.newPage();
    const files = (prefix, count = 30) => Array.from({ length: count }, (_, index) => ({
        name: `${prefix} 资料 ${String(index + 1).padStart(2, '0')}`,
        href: `/uploads/files/${prefix.toLowerCase()}-${index + 1}.pdf`,
    }));
    const localFiles = { 101: files('A'), 102: files('B'), 103: files('C') };
    const teachers = {
        101: [{ name: '乙老师', href: '/course/102/' }, { name: '丙老师', href: '/course/103/' }],
        102: [{ name: '甲老师', href: '/course/101/' }, { name: '丙老师', href: '/course/103/' }],
        103: [{ name: '甲老师', href: '/course/101/' }, { name: '乙老师', href: '/course/102/' }],
    };
    const cache = {
        version: 2,
        date: new Date().toDateString(),
        pages: [
            { href: '/course/102/', files: localFiles[102], links: [] },
            { href: '/course/103/', files: localFiles[103], links: [] },
        ],
    };
    const targetCache = {
        version: 2,
        date: new Date().toDateString(),
        pages: [{ href: '/course/101/', files: localFiles[101], links: [] }],
    };
    let failCourse = 0;
    const served = [];
    await page.context().route('https://icourse.club/course/**', async route => {
        const url = new URL(route.request().url());
        const id = Number(url.pathname.match(/\d+/)[0]);
        served.push(id);
        if (id === failCourse) {
            await route.fulfill({ status: 500, body: 'forced failure' });
            return;
        }
        const teacherLinks = teachers[id].map(t => `<a href="${t.href}">${t.name}</a>`).join('');
        const reviews = localFiles[id].map(item =>
            `<div class="review-content"><a href="${item.href}">${item.name}</a></div>`
        ).join('');
        await route.fulfill({
            contentType: 'text/html; charset=utf-8',
            body: `<!doctype html><html><head><meta charset="utf-8"><title>课程 ${id}</title></head><body>` +
                `<main>${reviews}</main><div class="col-md-4 rl-pd-lg"><div><h4>其他老师的课</h4>${teacherLinks}</div></div>` +
                `<script src="https://icourse.club/__uih.user.js"></script></body></html>`,
        });
    });
    await page.context().route('https://icourse.club/__uih.user.js', route => route.fulfill({
        contentType: 'application/javascript; charset=utf-8',
        path: 'USTC-Icourse-Helper.user.js',
    }));
    await page.context().addInitScript(values => {
        localStorage.setItem('ustc-icourse-hint-seen', '1');
        if (!localStorage.getItem('uih-test-cache-missing')) {
            localStorage.setItem('ustc-icourse-xc:101:authenticated', JSON.stringify(values.source));
        }
        if (localStorage.getItem('uih-test-target-cache')) {
            localStorage.setItem('ustc-icourse-xc:102:authenticated', JSON.stringify(values.target));
        }
    }, { source: cache, target: targetCache });

    await page.goto('https://icourse.club/course/101/');
    await page.locator('#uih-tab').click();
    await page.locator('#uih-more').click();
    await page.locator('[data-filter="files"]').click();
    await page.locator('#uih-search').fill('资料');
    await page.locator('#uih-body').evaluate(element => { element.scrollTop = 120; });
    served.length = 0;

    const opened = page.context().waitForEvent('page');
    await page.locator('.uih-item', { hasText: 'B 资料 01' }).locator('.uih-loc').evaluate(button => button.click());
    const target = await opened;
    await target.waitForLoadState('load');
    await target.locator('#ustc-icourse-helper').waitFor();

    const restored = await target.evaluate(() => ({
        open: !document.querySelector('#uih-panel').hidden,
        query: document.querySelector('#uih-search').value,
        filter: document.querySelector('[data-filter="files"]').getAttribute('aria-pressed'),
        scrollTop: document.querySelector('#uih-body').scrollTop,
        cachedRows: Array.from(document.querySelectorAll('.uih-item')).filter(row => row.textContent.includes('C 资料 01')).length,
    }));
    if (!restored.open) throw new Error('跨页定位后悬浮窗未自动展开');
    if (restored.query !== '资料') throw new Error(`搜索词未恢复: ${restored.query}`);
    if (restored.filter !== 'true') throw new Error('文件筛选状态未恢复');
    if (restored.scrollTop !== 120) throw new Error(`列表滚动位置未恢复: ${restored.scrollTop}`);
    if (restored.cachedRows !== 1) throw new Error('来源页的当日搜集缓存未恢复');
    if (served.join(',') !== '102') throw new Error(`恢复过程意外重新抓取了课程页: ${served.join(',')}`);

    await page.goto('https://icourse.club/course/102/');
    if (await page.locator('#uih-panel').isVisible()) throw new Error('普通打开课程页时不应自动展开悬浮窗');

    await page.evaluate(() => {
        localStorage.removeItem('ustc-icourse-xc:101:authenticated');
        localStorage.setItem('uih-test-cache-missing', '1');
    });
    const missing = await page.context().newPage();
    served.length = 0;
    const missingParams = new URLSearchParams({
        'uih-locate': 'files',
        'uih-name': 'B 资料 01',
        'uih-href': '/uploads/files/b-1.pdf',
        'uih-source': '101',
        'uih-filter': 'all',
        'uih-query': '',
        'uih-scroll': '0',
    });
    await missing.goto(`https://icourse.club/course/102/#${missingParams}`);
    await missing.locator('#ustc-icourse-helper').waitFor();
    if (!await missing.locator('#uih-panel').isVisible()) throw new Error('缓存缺失时也应展开悬浮窗');
    if (await missing.locator('#uih-more').isDisabled()) throw new Error('缓存缺失时仍应允许手动搜集');
    if ((await missing.locator('#uih-status').textContent()).includes('已恢复')) throw new Error('缓存缺失时不应误报已恢复');
    if (served.join(',') !== '102') throw new Error(`缓存缺失时意外抓取了课程页: ${served.join(',')}`);

    await missing.evaluate(() => {
        localStorage.removeItem('uih-test-cache-missing');
        localStorage.setItem('uih-test-target-cache', '1');
    });
    const merged = await page.context().newPage();
    await merged.goto(`https://icourse.club/course/102/#${missingParams}`);
    await merged.locator('#ustc-icourse-helper').waitFor();
    if (await merged.locator('#uih-more').isDisabled()) throw new Error('来源缓存恢复后不应禁用剩余老师的手动补搜集');
    failCourse = 101;
    served.length = 0;
    await merged.locator('#uih-more').evaluate(button => button.click());
    await merged.waitForFunction(() => /^(搜集完成|重试失败的)/.test(document.querySelector('#uih-more').textContent));
    const savedPages = await merged.evaluate(() => JSON.parse(localStorage.getItem('ustc-icourse-xc:102:authenticated')).pages.map(page => page.href).sort());
    if (savedPages.join(',') !== '/course/101/,/course/103/') throw new Error(`手动补搜集覆盖了目标页已有缓存: ${savedPages.join(',')}`);
    if (served.length) throw new Error(`目标页已有缓存的老师被重新请求: ${served.join(',')}`);
    await context.close();
    return '跨页恢复、缓存缺失、目标缓存合并与不自动抓取检查通过';
}
