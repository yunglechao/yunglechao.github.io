(() => {
  const stats = document.querySelector('[data-site-stats]');
  const production = 'https://yunglechao.github.io';
  const optedOut = navigator.globalPrivacyControl === true ||
    [navigator.doNotTrack, window.doNotTrack, navigator.msDoNotTrack].some(value => value === '1' || value === 'yes');
  if (!stats || location.origin !== production || optedOut || stats.dataset.countStarted) return;

  const endpoint = 'https://events.vercount.one/api/v2/log';
  const cookieKey = 'vercount_uv_yunglechao_github_io';
  const fields = ['site_pv', 'site_uv', 'page_pv'];
  const format = new Intl.NumberFormat(document.documentElement.lang || 'zh-CN');

  function publicUrl(path) {
    if (typeof path !== 'string' || !/^\/(?:research\/(?:[a-z0-9-]+\/)?)?$/.test(path)) return null;
    return location.origin + path;
  }

  const url = publicUrl(stats.dataset.countPath);
  if (!url) return;
  stats.dataset.countStarted = 'true';

  function readCounts(target) {
    return fetchCounts(endpoint + '?' + new URLSearchParams({url: target}), {method: 'GET'});
  }

  async function fetchCounts(target, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch(target, {
        ...options,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Counter request failed');
      const {status, data} = await response.json();
      if (status !== 'success' || !fields.every(key => Number.isSafeInteger(data?.[key]) && data[key] >= 0)) {
        throw new Error('Invalid counter response');
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  function visitorCookie() {
    return document.cookie.split(';').map(part => part.trim())
      .find(part => part.startsWith(cookieKey + '='))?.slice(cookieKey.length + 1);
  }

  function setCookie(value, maxAge) {
    document.cookie = `${cookieKey}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;
  }

  async function recordVisit() {
    let firstVisit = false;
    // The short claim also limits duplicate visitors in browsers without Web Locks.
    try {
      const marker = visitorCookie();
      if (marker !== '1' && marker !== 'pending') {
        setCookie('pending', 15);
        firstVisit = visitorCookie() === 'pending';
      }
    } catch { /* Without first-party cookie access, count only the page view. */ }

    let accepted = false;
    try {
      const data = await fetchCounts(endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({url, isNewUv: firstVisit}),
      });
      accepted = true;
      return data;
    } finally {
      if (firstVisit) {
        try {
          if (visitorCookie() === 'pending') setCookie(accepted ? '1' : '', accepted ? 31536000 : 0);
        } catch { /* The browser may have changed cookie permissions during the request. */ }
      }
    }
  }

  function showCardViews(page) {
    const pending = new Map([[url, page]]);
    for (const card of document.querySelectorAll('[data-views-for]')) {
      const target = publicUrl(card.dataset.viewsFor);
      const count = card.querySelector('[data-view-total]');
      if (!target || !count) continue;
      if (!pending.has(target)) {
        pending.set(target, readCounts(target));
      }
      pending.get(target).then(data => {
        count.textContent = format.format(data.page_pv);
        card.querySelector('[data-as-of]').hidden = true;
      }).catch(() => { /* Keep the dated count rendered in the card. */ });
    }
  }

  async function start() {
    const visit = navigator.locks?.request
      ? navigator.locks.request(cookieKey, recordVisit)
      : recordVisit();
    const page = visit.catch(() => readCounts(url));
    showCardViews(page);
    try {
      const data = await page;
      for (const item of stats.querySelectorAll('[data-count]')) {
        if (fields.includes(item.dataset.count)) item.textContent = format.format(data[item.dataset.count]);
      }
      stats.querySelector('[data-as-of]').hidden = true;
    } catch {
      // The static counts and their timestamp remain visible.
    }
  }
  if (document.prerendering) document.addEventListener('prerenderingchange', start, {once: true});
  else start();
})();
