'use strict';

    /* ==================== STATE & STORAGE ==================== */
    const $ = id => document.getElementById(id);
    const K = {
      pl: 'tv3_playlists',
      meta: 'tv3_meta',
      hist: 'tv3_history',
      notes: 'tv3_notes',
      set: 'tv3_settings',
      subs: 'tv3_subs',
      sess: 'tv3_sessions',
      av: 'tv3_av',
      usage: 'tv3_usage',
      cid: 'tv3_cid',
      cache: 'tv3_cache',
      nsum: 'tv3_nsum',
      subfeed: 'tv3_subfeed',
      sched: 'tv3_sched',
      q: 'tv3_q'
    };
    const DEF_TOPICS = ['JEE', 'Physics', 'Maths', 'Chemistry', 'Coding', 'AI', 'Finance', 'Cybersecurity', 'Biology', 'Economics'];
    /* Learning-only guard rails: anything matching BAD (and not clearly a lecture) is never recommended. */
    const BAD_RX = /\b(lofi|lo-fi|music|song|songs|remix|official video|lyrics|trailer|movie|film|web series|episode|gaming|gameplay|walkthrough|minecraft|gta|comedy|funny|prank|meme|vlog|reaction|asmr|celebrity|bollywood|cricket|ipl|football|news|breaking|live stream|podcast|motivation|motivational|roast|shorts?|tiktok|reels?)\b/i;
    const GOOD_RX = /\b(lecture|tutorial|course|class|chapter|lesson|explained|learn|learning|how to|crash course|full course|masterclass|jee|neet|physics|chemistry|maths?|math|calculus|algebra|coding|programming|python|javascript|react|dsa|algorithm|machine learning|deep learning|llm|ai|data science|finance|accounting|economics|investing|statistics|biology|cyber|security|linux|engineering|science|history|english|grammar|design|marketing|startup|sql|cloud|devops|electronics)\b/i;

    const S = {
      playlists: [],
      meta: {},
      hist: [],
      notes: {},
      nsum: {},
      usage: {},
      subs: [],
      sessions: [],
      set: {
        theme: null,
        playerMode: 'mini',
        topics: DEF_TOPICS.slice(),
        autoStudy: true,
        autoplay: true,
        ui: 'auto',
        apiKey: '',
        seek: 10,
        goal: 120,
        hideWatched: true,
        hits: {},
        name: 'Student',
        handle: '@tubevault'
      },
      tab: 'home',
      chip: 'All',
      queue: [],
      cur: null,
      pmode: 'none',
      playing: false,
      t: 0,
      d: 0,
      rate: 1,
      sub: null,
      scroll: { home: 0, subs: 0, library: 0 },
      reordering: false,
      directTouch: false
    };

    const H = { ids: [], recs: [], loading: false, err: false };
    const ctxLists = {};
    const ld = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
    const sv = (k, v) => { if (window.__wiped) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const _ta = document.createElement('textarea');
    const dec = s => { s = String(s == null ? '' : s); if (s.indexOf('&') < 0) return s; _ta.innerHTML = s.replace(/</g, '&lt;'); return _ta.value; };
    function ago(ts) {
      const d = (Date.now() - ts) / 1000;
      if (!(ts > 0) || d < 0) return '';
      const u = [[31536000, 'year'], [2592000, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
      for (const [n, l] of u) if (d >= n) { const v = Math.floor(d / n); return v + ' ' + l + (v > 1 ? 's' : '') + ' ago'; }
      return 'just now';
    }
    function fmt(s) {
      s = Math.max(0, Math.floor(s || 0));
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
      return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
    }
    function fmtDurHuman(s) {
      s = Math.max(0, Math.floor(s || 0));
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
      if (h > 0) return `${h}h ${m}m`;
      if (m > 0) return `${m}m ${s % 60}s`;
      return `${s}s`;
    }
    function fmtViews(n) {
      n = +n;
      if (!(n >= 0)) return '';
      if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.0', '') + 'M views';
      if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace('.0', '') + 'K views';
      return n + ' views';
    }
    const thumb = id => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
    const hue = s => { let h = 0; for (const c of String(s || 'x')) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

    const AV = ld(K.av, {});
    let avT = null;
    const normAv = u => String(u || '').replace(/^https?:\/\/[^/]+\/ggpht\//, 'https://yt3.ggpht.com/').replace(/^http:\/\//, 'https://');
    function setAv(ch, url) {
      url = normAv(url);
      if (!ch || !url || AV[ch] === url) return;
      AV[ch] = url;
      clearTimeout(avT);
      avT = setTimeout(() => sv(K.av, AV), 700);
    }
    const avImg = u => `<img class="avimg" src="${esc(u)}" referrerpolicy="no-referrer" loading="lazy" onerror="avErr(this)" alt="">`;
    window.avErr = function (img) {
      if (!img.dataset.r) { img.dataset.r = '1'; img.src = 'https://wsrv.nl/?w=120&h=120&fit=cover&url=' + encodeURIComponent(img.getAttribute('src')); }
      else img.remove();
    };
    function avatar(name, sizeCls = '') {
      const n = (name || '?').trim() || '?';
      const c = [...n][0];
      const u = AV[n];
      if (!u) queueAv(n);
      return `<div class="avatar ${sizeCls}" data-n="${esc(n)}" style="background:hsl(${hue(n)} 48% 38%)">${esc(c.toUpperCase())}${u ? avImg(u) : ''}</div>`;
    }
    /* Channel logos are looked up in the background the first time a channel is shown. */
    const avTried = {}, avQ = [];
    let avRun = 0;
    function queueAv(n) {
      if (!n || n === 'YouTube' || n === '?' || AV[n]) return;
      if (avTried[n] && Date.now() - avTried[n] < 120000) return;
      avTried[n] = Date.now();
      avQ.push(n);
      setTimeout(pumpAv, 0);
    }
    function pumpAv() {
      while (avRun < 2 && avQ.length) {
        const n = avQ.shift();
        avRun++;
        resolveAvatar(n).finally(() => { avRun--; pumpAv(); });
      }
    }
    async function resolveAvatar(n) {
      try { await resolveCid(n); } catch (e) {}
      if (!AV[n]) { try { const a = await channelAbout(n); if (a && a.av) setAv(n, a.av); } catch (e) {} }
      if (AV[n]) paintAv(n);
    }
    function paintAv(n) {
      document.querySelectorAll('.avatar[data-n]').forEach(el => {
        if (el.dataset.n === n && !el.querySelector('.avimg')) el.insertAdjacentHTML('beforeend', avImg(AV[n]));
      });
    }
    function profAvatar(big) {
      const ph = S.set.photo;
      if (ph) return `<div class="avatar pf${big ? ' big' : ''}"><img class="avimg" src="${ph}" alt=""></div>`;
      return `<div class="avatar pf${big ? ' big' : ''}"><svg viewBox="0 0 24 24" style="width:${big ? 2.25 : 1.375}rem;height:${big ? 2.25 : 1.375}rem" fill="currentColor"><circle cx="12" cy="8.2" r="4.2"/><path d="M3.8 21c0-4.5 3.7-7.3 8.2-7.3s8.2 2.8 8.2 7.3z"/></svg></div>`;
    }

    function tfetch(url, ms = 7500) {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), ms);
      return fetch(url, { signal: c.signal })
        .then(r => { if (!r.ok) throw new Error('http'); return r.json(); })
        .finally(() => clearTimeout(t));
    }

    /* ==================== ICONS ==================== */
    const P = {
      home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
      subs: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M6 3h12"/><path d="M10 11v5l4.5-2.5z" fill="currentColor"/>',
      library: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 4h10M5 6h14"/><path d="M10.5 11.5v5l4-2.5z" fill="currentColor"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
      close: '<path d="M18 6L6 18M6 6l12 12"/>',
      more: '<circle cx="12" cy="5" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="19" r="1.7" fill="currentColor"/>',
      play: '<path d="M7 4v16l13-8z" fill="currentColor"/>',
      pause: '<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>',
      prev: '<path d="M6 5v14"/><path d="M19 5v14L8 12z" fill="currentColor"/>',
      next: '<path d="M18 5v14"/><path d="M5 5v14l11-7z" fill="currentColor"/>',
      rew: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><text x="12" y="15.5" font-size="7.5" text-anchor="middle" fill="currentColor" stroke="none" font-weight="700">10</text>',
      fwd: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/><text x="12" y="15.5" font-size="7.5" text-anchor="middle" fill="currentColor" stroke="none" font-weight="700">10</text>',
      chev: '<path d="M6 9l6 6 6-6"/>',
      chevr: '<path d="M9 6l6 6-6 6"/>',
      like: '<path d="M7 11v9H4v-9h3zM7 11l4-8a2 2 0 0 1 3 2v4h5a2 2 0 0 1 2 2l-1.5 7a2 2 0 0 1-2 1.6H7"/>',
      save: '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
      share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13"/>',
      note: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
      trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
      gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
      chart: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
      list: '<path d="M3 6h13M3 12h13M3 18h8M19 14v6M16 17h6"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
      check: '<path d="M5 12l5 5 9-10"/>',
      fs: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
      shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
      fill: '<path d="M17 17L7 7"/><path d="M7 15V7h8"/>',
      hand: '<path d="M18 11V6a2 2 0 0 0-4 0v4M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8l-1.6-1.6a2 2 0 0 0-2.8 2.8l5.8 5.8A6 6 0 0 0 11.7 23H15a6 6 0 0 0 6-6v-5a2 2 0 0 0-4 0"/>',
      theater: '<rect x="2" y="4" width="20" height="16" rx="3"/><rect x="4" y="8.5" width="16" height="7" fill="currentColor" opacity="0.35"/><path d="M4 8.5h16v7H4z"/>',
      queue: '<path d="M3 6h14M3 12h14M3 18h10"/><path d="M17 15v6l5-3z" fill="currentColor"/>',
      star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
      collapse: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>',
      flame: '<path d="M13.2 2.5L4.6 13.6a.6.6 0 0 0 .5 1h5.3l-1 6.4a.4.4 0 0 0 .7.3l8.9-11.5a.6.6 0 0 0-.5-1h-5.2l1.1-6.1a.4.4 0 0 0-.7-.2z" fill="currentColor" stroke-width="1.4"/>',
      coffee: '<path d="M10 2v2M14 2v2M6 2v2"/><path d="M16 8h1a4 4 0 1 1 0 8h-1"/><path d="M4 8h12v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/>',
      target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
      eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
      shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
      calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
      bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
      trend: '<path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
      trendd: '<path d="M22 17l-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
      book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
      bul: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>',
      task: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><path d="M5 6.5l1.5 1.5L9 5.5"/><path d="M14 6h7M14 17h7"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
      quote: '<path d="M3 21c3 0 7-1 7-8V5H3v8h4c0 3-2 4-4 4zM14 21c3 0 7-1 7-8V5h-7v8h4c0 3-2 4-4 4z"/>',
      hl: '<path d="M9 11l-6 6v3h9l3-3"/><path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
      layers: '<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
      sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17v4M17 19h4"/>',
      timer: '<path d="M10 2h4"/><path d="M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
      chevu: '<path d="M18 15l-6-6-6 6"/>',
      brain: '<path d="M9.5 2A2.5 2.5 0 0 0 7 4.5v0A2.5 2.5 0 0 0 4.5 7 3 3 0 0 0 4 12.5 3 3 0 0 0 6 17.5a3 3 0 0 0 3 2.5 2.5 2.5 0 0 0 2.5-2.5v-13A2.5 2.5 0 0 0 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 1 17 4.5 2.5 2.5 0 0 1 19.5 7a3 3 0 0 1 .5 5.5 3 3 0 0 1-2 5 3 3 0 0 1-3 2.5 2.5 2.5 0 0 1-2.5-2.5"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>'
    };
    const flameIc = (sz = 20) => ic('flame', sz).replace('<svg ', '<svg class="flame" ');
    const ic = (n, sz = 24) => `<svg viewBox="0 0 24 24" style="width:${sz / 16}rem;height:${sz / 16}rem" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[n] || ''}</svg>`;

    /* ==================== DATA & PERSISTENCE ==================== */
    const SYS = [
      { id: 'wl', name: 'Watch later', sys: true, items: [] },
      { id: 'liked', name: 'Liked videos', sys: true, items: [] }
    ];

    function load() {
      Object.assign(S.set, ld(K.set, {}));
      if (!Array.isArray(S.set.topics) || !S.set.topics.length) S.set.topics = DEF_TOPICS.slice();
      S.set.topics = S.set.topics.filter(t => !/^(lofi|motivation|podcasts?|gaming|music|movies?|news|shorts|entertainment|comedy|vlogs?)$/i.test(t));
      if (!S.set.topics.length) S.set.topics = DEF_TOPICS.slice();
      ['blockV'].forEach(k => { if (!Array.isArray(S.set[k])) S.set[k] = []; });
      ['blockCh', 'blockCat', 'favCh', 'favCat'].forEach(k => { if (!S.set[k] || typeof S.set[k] !== 'object') S.set[k] = {}; });
      const pl = ld(K.pl, null);
      if (!pl) {
        S.playlists = SYS.map(x => ({ ...x, items: [] }));
        sv(K.pl, S.playlists);
      } else {
        S.playlists = pl;
      }
      S.meta = ld(K.meta, {});
      S.hist = ld(K.hist, []);
      S.notes = ld(K.notes, {});
      S.subs = ld(K.subs, []);
      S.sessions = ld(K.sess, []);
      S.nsum = ld(K.nsum, {});
      S.usage = ld(K.usage, {});
      if (!S.set.hits || typeof S.set.hits !== 'object') S.set.hits = {};
      if (!Array.isArray(S.hist)) S.hist = [];
      if (!Array.isArray(S.subs)) S.subs = [];
      if (!Array.isArray(S.sessions)) S.sessions = [];
      if (!S.playlists.some(p => p.id === 'liked')) S.playlists.unshift({ ...SYS[1], items: [] });
      if (!S.playlists.some(p => p.id === 'wl')) S.playlists.unshift({ ...SYS[0], items: [] });
      const wl = S.playlists.find(p => p.id === 'wl');
      const lk = S.playlists.find(p => p.id === 'liked');
      S.playlists = [wl, lk, ...S.playlists.filter(p => p !== wl && p !== lk)];
    }

    let mt = null;
    const CID = ld(K.cid, {});
    function setCid(name, id) { if (name && id && CID[name] !== id) { CID[name] = id; clearTimeout(setCid.t); setCid.t = setTimeout(() => sv(K.cid, CID), 800); } }
    function setMeta(id, o) {
      const m = S.meta[id] || (S.meta[id] = {});
      for (const k in o) {
        let v = o[k];
        if (v === undefined || v === null || v === '') continue;
        if (k === 'title' || k === 'channel' || k === 'desc') v = dec(v);
        if (k === 'desc') v = String(v).slice(0, 2500);
        m[k] = v;
      }
      if (o.cid && o.channel) setCid(dec(o.channel), o.cid);
      clearTimeout(mt);
      mt = setTimeout(() => sv(K.meta, S.meta), 500);
    }

    const cleanTitle = t => String(t || '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]/gu, '').replace(/(?:\s*#[\w-]+)+\s*$/g, '').replace(/\s{2,}/g, ' ').replace(/^[\s|•·\-–—]+|[\s|•·\-–—]+$/g, '').trim();
    const M = id => {
      const m = S.meta[id] || {};
      return {
        title: cleanTitle(m.title) || (m.title ? String(m.title).slice(0, 90) : 'YouTube Video'),
        channel: m.channel || 'YouTube',
        cid: m.cid || CID[m.channel] || '',
        dur: m.dur || 0,
        views: m.views || '',
        pub: m.ts ? ago(m.ts) : (m.pub || ''),
        ts: m.ts || 0,
        desc: m.desc || '',
        cat: m.cat || detectCategory((m.title || '') + ' ' + (m.channel || ''))
      };
    };

    const subline = m => [m.channel, m.views, m.pub].filter(Boolean).join(' • ');
    const PL = id => S.playlists.find(p => p.id === id);
    const inPl = (pid, vid) => { const p = PL(pid); return !!p && p.items.includes(vid); };

    function togglePl(pid, vid) {
      const p = PL(pid);
      if (!p) return false;
      const i = p.items.indexOf(vid);
      if (i > -1) p.items.splice(i, 1);
      else { p.items.unshift(vid); ensureMeta(vid); }
      sv(K.pl, S.playlists);
      return i === -1;
    }

    const histMap = () => { const m = {}; S.hist.forEach(h => { m[h.v] = h; }); return m; };
    const pctOf = h => (h && h.t > 0 ? Math.min(100, Math.round((h.w / h.t) * 100)) : 0);

    const SUBJ = {
      Physics: /\b(physics|mechanics|electrostatics|optics|thermodynamics|quantum|kinematics|magnetism|electromagnetic|newton|laws of motion|rotational|gravitation|current electricity|semiconductor|wave motion|oscillations|ray optics|work energy)\b/gi,
      Chemistry: /\b(chemistry|organic|inorganic|mole concept|reaction|reactions|periodic table|chemical|equilibrium|electrochemistry|stoichiometry|hydrocarbons?|alkanes?|alkenes?|coordination|thermochemistry|atomic structure|chemical bonding|salt analysis|p block|d block|isomerism)\b/gi,
      Maths: /\b(maths?|mathematics|calculus|algebra|trigonometry|integration|differentiation|geometry|matrices|determinants?|probability|vectors?|limits|permutations?|combinations?|combinatorics|conic sections?|quadratic|complex numbers|statistics|sequence and series|binomial)\b/gi,
      Biology: /\b(biology|botany|zoology|genetics|anatomy|cell|cells|physiology|ecology|evolution|photosynthesis|dna|rna|plant kingdom|biomolecules|reproduction|cytology|neet biology|human physiology|morphology)\b/gi
    };
    function subjOf(text) {
      const t = String(text || '').toLowerCase();
      let best = null, bn = 0;
      Object.keys(SUBJ).forEach(k => { const n = (t.match(SUBJ[k]) || []).length; if (n > bn) { bn = n; best = k; } });
      return best;
    }
    /* Study-only filter: entertainment / low-value videos never get in. */
    const STRONG_BAD = /\b(lofi|lo-fi|music videos?|songs?|remix|lyrics|official video|trailer|movies?|full movie|film songs?|web series|gaming|gameplay|walkthrough|minecraft|gta|comedy|funny|prank|memes?|vlogs?|blogs?|vlogger|travel vlog|travelling|trip vlog|road ?trip|riding|rider|motovlog|bike ride|village life|day in my life|mukbang|storytime|reaction|asmr|bollywood|cricket|ipl|football|roast|tiktok|reels?|shorts?|dance|whatsapp status|bgmi|pubg|free fire|netflix|anime|cartoons?|bigg boss|gossip|match highlights|unboxing|bhajan|ringtone|status video)\b/i;
    const LECT_RX = /\b(lecture|tutorial|course|class|chapter|lesson|revision|explained|crash course|full course|masterclass|jee|neet|dpp|pyq|ncert)\b/i;
    /* Blocklist only: low-value entertainment is blocked, everything else (podcasts, documentaries, news, finance...) is allowed. */
    function eduOK(title, channel, desc) {
      if (!title) return true;
      const t = title + ' ' + (channel || '');
      if (STRONG_BAD.test(t) && !(LECT_RX.test(t) && subjOf(t))) return false;
      return true;
    }
    const NOT_ALLOWED_MSG = `<div class="empty"><b>Not available here.</b><br><br>Entertainment videos (music, movies, vlogs, gaming, comedy and similar) are blocked in Vaultube. Search for something to learn instead.</div>`;
    function detectCategory(text) {
      const t = (text || '').toLowerCase();
      { const sb = subjOf(t); if (sb) return sb; }
      if (/\b(jee|iit|neet|mains|advanced)\b/.test(t)) return 'JEE';
      if (/\b(physics|mechanics|electrostatics|optics|thermodynamics|quantum)\b/.test(t)) return 'Physics';
      if (/\b(math|calculus|algebra|trigonometry|integration|geometry)\b/.test(t)) return 'Maths';
      if (/\b(chemistry|organic|inorganic|mole|reaction|periodic)\b/.test(t)) return 'Chemistry';
      if (/\b(code|coding|programming|javascript|python|react|java|dsa|algorithm|web dev)\b/.test(t)) return 'Coding';
      if (/\b(cyber|security|hacking|linux|network|pentest|ctf)\b/.test(t)) return 'Cybersecurity';
      if (/\b(ai|artificial intelligence|machine learning|deep learning|llm|neural|chatgpt|gpt|data science)\b/.test(t)) return 'AI';
      if (/\b(finance|stock|stocks|invest|investing|accounting|trading|mutual fund|banking)\b/.test(t)) return 'Finance';
      if (/\b(economics|economy|macro|micro economics)\b/.test(t)) return 'Economics';
      if (/\b(biology|botany|zoology|genetics|anatomy|cell)\b/.test(t)) return 'Biology';
      return S.chip !== 'All' ? S.chip : 'General';
    }

    /* ==================== ONLINE METADATA & MULTI-MIRROR SEARCH ==================== */
    const INV = ['https://inv.nadeko.net', 'https://yewtu.be', 'https://invidious.nerdvpn.de', 'https://invidious.fdn.fr'];
    const PIPED = ['https://pipedapi.kavin.rocks', 'https://pipedapi.adminforge.de', 'https://pipedapi.r4fo.com'];
    const fixU = (u, b) => (!u ? '' : u.startsWith('//') ? 'https:' + u : u.startsWith('/') ? b + u : u);

    const STARTER = {
      physics: ['ZihywtRxkYk'],
      maths: ['WUvTyaaNkzM', 'fNk_zzaMoSs'],
      chemistry: ['FSyAehMdpyI'],
      coding: ['PkZNo7MFNFg', 'rfscVS0vtbw']
    };
    const ACAD = ['ai', 'finance', 'jee', 'physics', 'maths', 'chemistry', 'coding', 'cybersecurity', 'biology', 'neet', 'science', 'history', 'economics', 'english', 'programming', 'math', 'dsa', 'python', 'javascript'];
    function starterFor(key) {
      const out = [];
      Object.keys(STARTER).forEach(k => { if (key.includes(k)) STARTER[k].forEach(id => out.push({ id, title: '', channel: '', dur: 0, views: '', pub: '', desc: '' })); });
      return out;
    }

    /* ---- Optional YouTube Data API v3 (free key). Without a key, public Invidious/Piped mirrors are used. ---- */
    const API = 'https://www.googleapis.com/youtube/v3';
    const hasKey = () => !!(S.set.apiKey && S.set.apiKey.trim().length >= 30);
    let apiDead = 0;
    const API_ST = { msg: '' };
    async function apiGet(path, params) {
      const u = new URLSearchParams(Object.assign({}, params, { key: S.set.apiKey.trim() }));
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 9000);
      try {
        const r = await fetch(`${API}/${path}?${u}`, { signal: c.signal });
        const d = await r.json();
        if (d.error) {
          const e = new Error((d.error.message || 'API error').replace(/<[^>]+>/g, ''));
          e.code = d.error.code;
          e.reason = (d.error.errors && d.error.errors[0] && d.error.errors[0].reason) || '';
          throw e;
        }
        API_ST.msg = '';
        return d;
      } finally { clearTimeout(t); }
    }
    function apiFail(e) {
      API_ST.msg = e && e.reason === 'quotaExceeded' ? 'Daily API quota used up — using public mirrors until tomorrow.' : (e && e.message) || 'API request failed';
      if (e && (e.code === 403 || e.code === 429 || e.code === 400)) apiDead = Date.now() + 36e5;
    }
    const isoDur = s => { const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(s || ''); return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : 0; };
    async function apiDecorate(items) {
      const ids = items.map(x => x.id).filter(Boolean).slice(0, 50);
      if (!ids.length) return [];
      const d = await apiGet('videos', { part: 'snippet,contentDetails,statistics', id: ids.join(',') });
      const map = {};
      (d.items || []).forEach(v => { map[v.id] = v; });
      const cids = [...new Set((d.items || []).map(v => v.snippet.channelId))];
      const av = {};
      if (cids.length) {
        try {
          const c = await apiGet('channels', { part: 'snippet', id: cids.slice(0, 50).join(',') });
          (c.items || []).forEach(ch => { const t = ch.snippet.thumbnails || {}; av[ch.id] = (t.default || t.medium || {}).url || ''; });
        } catch (e) {}
      }
      return ids.map(id => map[id]).filter(Boolean).map(v => {
        const sn = v.snippet;
        return { id: v.id, title: sn.title, channel: sn.channelTitle, cid: sn.channelId, dur: isoDur(v.contentDetails && v.contentDetails.duration), views: v.statistics && v.statistics.viewCount != null ? fmtViews(v.statistics.viewCount) : '', ts: Date.parse(sn.publishedAt) || 0, desc: sn.description || '', av: av[sn.channelId] || '' };
      });
    }
    async function apiSearchVideos(q) {
      const d = await apiGet('search', { part: 'snippet', type: 'video', maxResults: '24', q, videoEmbeddable: 'true', safeSearch: 'moderate' });
      return apiDecorate((d.items || []).filter(i => i.id && i.id.videoId).map(i => ({ id: i.id.videoId })));
    }

    /* ---- Persistent search cache (saves quota, gives instant + offline results) ---- */
    const PC = ld(K.cache, {});
    const pcGet = (k, ttl) => { const e = PC[k]; return e && Date.now() - e.t < ttl ? e.r : null; };
    const slim = x => Object.assign({}, x, { desc: String(x.desc || '').slice(0, 300) });
    function pcSet(k, r) {
      PC[k] = { t: Date.now(), r: r.map(slim) };
      const ks = Object.keys(PC);
      if (ks.length > 36) ks.sort((a, b) => PC[a].t - PC[b].t).slice(0, ks.length - 36).forEach(x => delete PC[x]);
      sv(K.cache, PC);
    }

    function mirrorSearch(q) {
      const e = encodeURIComponent(q);
      const tasks = [
        ...INV.map(b =>
          tfetch(`${b}/api/v1/search?q=${e}&type=video`, 7000).then(d => {
            const a = (Array.isArray(d) ? d : []).filter(x => x.videoId && x.title).map(x => {
              const t = x.authorThumbnails || [];
              return { id: x.videoId, title: x.title, channel: x.author, cid: x.authorId || '', dur: x.lengthSeconds || 0, views: fmtViews(x.viewCount), ts: (x.published || 0) * 1000, pub: x.publishedText || '', desc: x.description || '', av: fixU((t[1] || t[t.length - 1] || {}).url, b) };
            });
            if (!a.length) throw 0;
            return a;
          })
        ),
        ...PIPED.map(b =>
          tfetch(`${b}/search?q=${e}&filter=videos`, 7000).then(d => {
            const a = ((d && d.items) || []).filter(x => x.url && x.url.includes('watch?v=')).map(x => ({
              id: x.url.split('v=')[1].split('&')[0], title: x.title, channel: x.uploaderName, cid: (x.uploaderUrl || '').split('/channel/')[1] || '', dur: x.duration > 0 ? x.duration : 0, views: x.views >= 0 ? fmtViews(x.views) : '', ts: x.uploaded > 0 ? x.uploaded : 0, pub: x.uploadedDate || '', desc: x.shortDescription || '', av: x.uploaderAvatar || ''
            }));
            if (!a.length) throw 0;
            return a;
          })
        )
      ];
      return Promise.any(tasks);
    }

    const scache = new Map();
    async function onlineSearch(q, opts) {
      opts = opts || {};
      const key = q.toLowerCase().trim();
      const c = scache.get(key);
      if (c && Date.now() - c.t < 6e5 && !opts.fresh) return c.r;
      const pc = !opts.fresh && pcGet('s:' + key, hasKey() ? 6 * 36e5 : 36e5);
      if (pc) { scache.set(key, { t: Date.now(), r: pc }); return pc; }
      let r = null, lastErr = null;
      if (hasKey() && Date.now() > apiDead) {
        try { r = await apiSearchVideos(q); } catch (e) { lastErr = e; apiFail(e); }
      }
      if (!r || !r.length) { try { r = await mirrorSearch(q); } catch (e) { lastErr = lastErr || e; r = null; } }
      if (!r || !r.length) {
        const stale = PC['s:' + key];
        if (stale) return Object.assign(stale.r.slice(), { stale: true });
        const st = starterFor(key);
        if (st.length) return Object.assign(st.slice(), { starter: true });
        throw lastErr || new Error('search failed');
      }
      scache.set(key, { t: Date.now(), r });
      pcSet('s:' + key, r);
      return r;
    }

    /* ---- Shorts never exist here ---- */
    const isShortItem = x => !!x && ((x.dur > 0 && x.dur < 120) || (x.lengthSeconds > 0 && x.lengthSeconds < 120) || /#shorts?\b|\bshorts?\b/i.test(x.title || '') || x.short === true);
    const isShort = id => { const m = S.meta[id]; return !!m && ((m.dur > 0 && m.dur < 120) || /#shorts?\b|\byoutube shorts?\b/i.test(m.title || '')); };
    const isLearning = id => {
      const m = M(id);
      if (!eduOK(m.title, m.channel, m.desc)) return false;
      return !/^(lofi|gaming|podcasts|music|motivation|entertainment|vlog|comedy)$/i.test(m.cat);
    };
    const isBlocked = id => {
      const set = S.set, m = M(id);
      if ((set.blockV || []).includes(id)) return true;
      if ((set.blockCh[m.channel] || 0) >= 1) return true;
      if ((set.blockCat[m.cat] || 0) >= 3) return true;
      return false;
    };
    const okForFeed = id => !isShort(id) && !isBlocked(id) && isLearning(id);

    function ingest(list, catHint) {
      return list
        .filter(x => /^[\w-]{11}$/.test(x.id) && !isShortItem(x) && eduOK(x.title, x.channel, x.desc))
        .map(x => {
          const o = { cat: catHint || undefined };
          ['title', 'channel', 'cid', 'dur', 'views', 'pub', 'ts', 'desc'].forEach(k => { if (x[k]) o[k] = x[k]; });
          if (!o.cat && x.title) o.cat = detectCategory((x.title || '') + ' ' + (x.channel || ''));
          setMeta(x.id, o);
          if (x.av && x.channel) { setAv(dec(x.channel), x.av); setTimeout(() => paintAv(dec(x.channel)), 0); }
          return x.id;
        });
    }

    /* ---- Channels: resolve id, latest videos, about ---- */
    async function resolveCid(name) {
      if (CID[name]) return CID[name];
      for (const id in S.meta) { const m = S.meta[id]; if (m.channel === name && m.cid) { setCid(name, m.cid); return m.cid; } }
      const e = encodeURIComponent(name), tasks = [];
      if (hasKey() && Date.now() > apiDead) tasks.push(apiGet('search', { part: 'snippet', type: 'channel', maxResults: '3', q: name }).then(d => { const i = (d.items || [])[0]; if (!i) throw 0; return { id: i.snippet.channelId || (i.id && i.id.channelId), av: ((i.snippet.thumbnails || {}).default || {}).url }; }));
      INV.slice(0, 3).forEach(b => tasks.push(tfetch(`${b}/api/v1/search?q=${e}&type=channel`, 6500).then(d => { const c = (Array.isArray(d) ? d : []).find(x => x.authorId); if (!c) throw 0; const t = c.authorThumbnails || []; return { id: c.authorId, av: fixU((t[1] || t[t.length - 1] || {}).url, b) }; })));
      PIPED.slice(0, 2).forEach(b => tasks.push(tfetch(`${b}/search?q=${e}&filter=channels`, 6500).then(d => { const c = ((d && d.items) || []).find(x => x.url && x.url.includes('/channel/')); if (!c) throw 0; return { id: c.url.split('/channel/')[1], av: c.thumbnail || '' }; })));
      const r = await Promise.any(tasks);
      setCid(name, r.id);
      if (r.av) setAv(name, r.av);
      return r.id;
    }

    async function channelVideos(name) {
      const key = 'c:' + name.toLowerCase();
      const pc = pcGet(key, 18e5);
      if (pc) return pc;
      let r = null, cid = '';
      try { cid = await resolveCid(name); } catch (e) {}
      if (cid && hasKey() && Date.now() > apiDead) {
        try {
          const d = await apiGet('playlistItems', { part: 'snippet', playlistId: 'UU' + cid.slice(2), maxResults: '24' });
          r = await apiDecorate((d.items || []).map(i => ({ id: i.snippet.resourceId.videoId })));
        } catch (e) { apiFail(e); }
      }
      if ((!r || !r.length) && cid) {
        const tasks = [
          ...INV.slice(0, 3).map(b => tfetch(`${b}/api/v1/channels/${cid}/videos`, 7000).then(d => {
            const a = (d.videos || (Array.isArray(d) ? d : [])).filter(x => x.videoId).map(x => ({ id: x.videoId, title: x.title, channel: x.author || name, cid, dur: x.lengthSeconds || 0, views: fmtViews(x.viewCount), ts: (x.published || 0) * 1000, desc: x.description || '' }));
            if (!a.length) throw 0;
            return a;
          })),
          ...PIPED.slice(0, 2).map(b => tfetch(`${b}/channel/${cid}`, 7000).then(d => {
            const a = ((d && d.relatedStreams) || []).filter(x => x.url && x.url.includes('v=')).map(x => ({ id: x.url.split('v=')[1].split('&')[0], title: x.title, channel: name, cid, dur: x.duration > 0 ? x.duration : 0, views: x.views >= 0 ? fmtViews(x.views) : '', ts: x.uploaded > 0 ? x.uploaded : 0 }));
            if (!a.length) throw 0;
            return a;
          })),
          tfetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent('https://www.youtube.com/feeds/videos.xml?channel_id=' + cid), 9000).then(d => {
            if (!d || d.status !== 'ok') throw 0;
            const a = (d.items || []).map(i => ({ id: extractId(i.link || ''), title: i.title, channel: name, cid, ts: Date.parse(String(i.pubDate || '').replace(' ', 'T') + 'Z') || 0 })).filter(x => x.id);
            if (!a.length) throw 0;
            return a;
          })
        ];
        try { r = await Promise.any(tasks); } catch (e) { r = null; }
      }
      if (!r || !r.length) { r = await onlineSearch(name); r = r.filter(x => (x.channel || '').toLowerCase() === name.toLowerCase()).concat(r.filter(x => (x.channel || '').toLowerCase() !== name.toLowerCase()).slice(0, 0)); }
      if (!r.length) throw new Error('no videos');
      pcSet(key, r);
      return r;
    }

    async function channelAbout(name) {
      const cid = await resolveCid(name);
      const tasks = [];
      if (hasKey() && Date.now() > apiDead) tasks.push(apiGet('channels', { part: 'snippet,statistics,brandingSettings', id: cid }).then(d => {
        const c = (d.items || [])[0];
        if (!c) throw 0;
        const t = c.snippet.thumbnails || {};
        return { desc: c.snippet.description || '', subs: c.statistics && !c.statistics.hiddenSubscriberCount ? fmtCount(c.statistics.subscriberCount) + ' subscribers' : '', handle: c.snippet.customUrl || '', banner: (c.brandingSettings && c.brandingSettings.image && c.brandingSettings.image.bannerExternalUrl) || '', av: (t.medium || t.default || {}).url || '' };
      }));
      INV.slice(0, 2).forEach(b => tasks.push(tfetch(`${b}/api/v1/channels/${cid}?fields=description,subCount,authorBanners,authorThumbnails,authorUrl`, 7000).then(d => {
        if (!d) throw 0;
        const t = d.authorThumbnails || [], bn = d.authorBanners || [];
        return { desc: d.description || '', subs: d.subCount ? fmtCount(d.subCount) + ' subscribers' : '', handle: '', banner: fixU((bn[0] || {}).url, b), av: fixU((t[2] || t[t.length - 1] || {}).url, b) };
      })));
      return Promise.any(tasks);
    }
    function fmtCount(n) { n = +n; if (!(n >= 0)) return ''; if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.0', '') + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace('.0', '') + 'K'; return String(n); }

    const metaPending = new Set();
    const infoQ = [];
    let infoRun = 0, refreshT = null;

    function ensureMeta(id, force = false) {
      const m = S.meta[id];
      if (!force && m && m.title && m.desc && AV[m.channel]) return;
      if (metaPending.has(id)) return;
      metaPending.add(id);
      infoQ.push(id);
      pumpInfo();
    }

    function pumpInfo() {
      while (infoRun < 2 && infoQ.length) {
        const id = infoQ.shift();
        infoRun++;
        fetchInfo(id).finally(() => {
          infoRun--;
          metaPending.delete(id);
          pumpInfo();
        });
      }
    }

    async function fetchInfo(id) {
      try {
        let r = null;
        if (hasKey() && Date.now() > apiDead) {
          try { r = (await apiDecorate([{ id }]))[0]; } catch (e) { apiFail(e); }
        }
        if (!r) {
          const tasks = [
            ...INV.slice(0, 2).map(b =>
              tfetch(`${b}/api/v1/videos/${id}?fields=title,author,authorId,authorThumbnails,viewCount,published,publishedText,lengthSeconds,description`, 7500).then(d => {
                if (!d || !d.title) throw 0;
                const t = d.authorThumbnails || [];
                return { title: d.title, channel: d.author, cid: d.authorId, dur: d.lengthSeconds, views: fmtViews(d.viewCount), ts: (d.published || 0) * 1000, pub: d.publishedText, desc: d.description || '', av: fixU((t[1] || t[t.length - 1] || {}).url, b) };
              })
            ),
            tfetch(`${PIPED[0]}/streams/${id}`, 8000).then(d => {
              if (!d || !d.title) throw 0;
              return { title: d.title, channel: d.uploader, cid: (d.uploaderUrl || '').split('/channel/')[1] || '', dur: d.duration, views: d.views >= 0 ? fmtViews(d.views) : '', ts: Date.parse(d.uploadDate) || 0, pub: '', desc: d.description || '', av: d.uploaderAvatar || '' };
            })
          ];
          r = await Promise.any(tasks);
        }
        setMeta(id, { title: r.title, channel: r.channel, cid: r.cid, dur: r.dur, views: r.views, pub: r.pub, ts: r.ts, desc: r.desc, tav: Date.now() });
        if (r.av && r.channel) { setAv(dec(r.channel), r.av); paintAv(dec(r.channel)); }
      } catch (e) {
        try {
          const d = await tfetch('https://noembed.com/embed?url=https://www.youtube.com/watch?v=' + id, 8000);
          if (d && d.title) setMeta(id, { title: d.title, channel: d.author_name, tav: Date.now() });
        } catch (x) {
          setMeta(id, { tav: Date.now() });
        }
      }
      refreshViews();
    }

    function patchMeta() {
      document.querySelectorAll('[data-t]').forEach(e => {
        const t = M(e.dataset.t).title;
        if (e.textContent !== t) e.textContent = t;
      });
      document.querySelectorAll('[data-c]').forEach(e => {
        const m = M(e.dataset.c);
        const v = subline(m);
        if (e.textContent !== v) e.textContent = v;
      });
    }

    function refreshViews() {
      clearTimeout(refreshT);
      refreshT = setTimeout(() => {
        patchMeta();
        if (S.cur) updateWatchPage();
        if (clipCand && $('clip').classList.contains('on')) showClip();
      }, 300);
    }

    function histUpsert(id, w, t) {
      const now = Date.now();
      const i = S.hist.findIndex(h => h.v === id);
      let e;
      if (i > -1) {
        e = S.hist[i];
        if (i > 0) { S.hist.splice(i, 1); S.hist.unshift(e); }
      } else {
        e = { v: id, w: 0, t: 0, at: now, studySec: 0, breakSec: 0 };
        S.hist.unshift(e);
        if (S.hist.length > 350) S.hist.length = 350;
      }
      if (w != null) e.w = Math.floor(w);
      if (t > 0) e.t = Math.floor(t);
      e.at = now;
      sv(K.hist, S.hist);
      lastSave = now;
    }

    function extractId(s) {
      if (!s) return null;
      s = s.trim();
      if (/^[\w-]{11}$/.test(s)) return s;
      const r = [/[?&]v=([\w-]{11})/, /youtu\.be\/([\w-]{11})/, /youtube\.com\/(?:embed|live)\/([\w-]{11})/];
      for (const x of r) { const m = s.match(x); if (m) return m[1]; }
      return null;
    }
    function extractPlaylistId(s) {
      if (!s) return null;
      s = s.trim();
      const m = s.match(/[?&]list=([\w-]{10,})/);
      if (m) return m[1];
      if (/^(PL|UU|OLAK5uy_|RD|FL|LL)[\w-]{10,}$/.test(s)) return s;
      return null;
    }

    /* ==================== LECTURE STOPWATCH & BREAK TRACKER ==================== */
    const ST = {
      running: false,
      mode: 'lecture',
      lectureSec: 0,
      breakSec: 0,
      videoId: null,
      dateKey: ''
    };
    let stInterval = null;

    function todayKey(ts = Date.now()) {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function startStudyTimer(vid) {
      if (ST.videoId !== vid) {
        flushStudySession();
        ST.videoId = vid;
        ST.lectureSec = 0;
        ST.breakSec = 0;
        ST.mode = 'lecture';
        ST.dateKey = todayKey();
      }
      ST.running = S.set.autoStudy !== false;
      updateStudyBarUI();
      if (!stInterval) {
        stInterval = setInterval(() => {
          if (!S.cur || !ST.running || S.ad) return;
          if (ST.mode === 'lecture') ST.lectureSec++;
          else ST.breakSec++;
          updateStudyBarUI();
          if ((ST.lectureSec + ST.breakSec) % 10 === 0) persistStudyStats();
        }, 1000);
      }
    }

    function persistStudyStats() {
      if (!ST.videoId || (ST.lectureSec === 0 && ST.breakSec === 0)) return;
      const dk = ST.dateKey || todayKey();
      const cat = M(ST.videoId).cat || 'General';
      let rec = S.sessions.find(x => x.v === ST.videoId && x.d === dk);
      if (!rec) {
        rec = { v: ST.videoId, d: dk, cat, lectureSec: 0, breakSec: 0, baseL: 0, baseB: 0, at: Date.now() };
        S.sessions.unshift(rec);
      }
      rec.lectureSec = (rec.baseL || 0) + ST.lectureSec;
      rec.breakSec = (rec.baseB || 0) + ST.breakSec;
      rec.cat = cat;
      rec.at = Date.now();
      sv(K.sess, S.sessions);

      const h = S.hist.find(x => x.v === ST.videoId);
      if (h) {
        const mine = S.sessions.filter(x => x.v === ST.videoId);
        h.studySec = mine.reduce((a, x) => a + (x.lectureSec || 0), 0);
        h.breakSec = mine.reduce((a, x) => a + (x.breakSec || 0), 0);
        sv(K.hist, S.hist);
      }
    }

    function flushStudySession() {
      if (!ST.videoId) return;
      persistStudyStats();
      const dk = ST.dateKey || todayKey();
      const rec = S.sessions.find(x => x.v === ST.videoId && x.d === dk);
      if (rec) {
        rec.baseL = rec.lectureSec;
        rec.baseB = rec.breakSec;
      }
      ST.lectureSec = 0;
      ST.breakSec = 0;
      sv(K.sess, S.sessions);
    }

    function updateStudyBarUI() {
      const bar = $('study-bar');
      if (!bar) return;
      const isBreak = ST.mode === 'break';
      bar.classList.toggle('break-mode', isBreak);
      bar.classList.toggle('paused', !ST.running);
      $('st-main-time').textContent = fmt(ST.lectureSec);
      $('st-break-time').textContent = fmt(ST.breakSec);
      $('sc-lec').classList.toggle('act', !isBreak);
      $('sc-brk').classList.toggle('act', isBreak);
      const tog = $('st-toggle-btn'), brk = $('st-break-btn');
      tog.innerHTML = ic(ST.running ? 'pause' : 'play', 15);
      tog.title = ST.running ? 'Pause' : 'Resume'; tog.setAttribute('aria-label', tog.title);
      brk.innerHTML = ic(isBreak ? 'book' : 'coffee', 15);
      brk.title = isBreak ? 'Back to lecture' : 'Take a break'; brk.setAttribute('aria-label', brk.title);
      brk.classList.toggle('brk', isBreak);
      const ico = $('st-ic'); if (ico && !ico.firstChild) ico.innerHTML = ic('timer', 15);
      const thChip = $('th-study-btn');
      if (thChip) {
        thChip.textContent = isBreak ? `Break ${fmt(ST.breakSec)}` : fmt(ST.lectureSec);
        thChip.classList.toggle('brk', isBreak);
      }
    }

    /* ==================== SUBSCRIPTIONS & CHANNEL PAGES ==================== */
    const isSubscribed = ch => !!ch && S.subs.some(x => x.toLowerCase() === ch.toLowerCase());
    function toggleSubscribe(ch) {
      if (!ch || ch === 'YouTube') return false;
      const idx = S.subs.findIndex(x => x.toLowerCase() === ch.toLowerCase());
      if (idx > -1) S.subs.splice(idx, 1);
      else S.subs.unshift(ch);
      sv(K.subs, S.subs);
      return idx === -1;
    }

    let subsTok = 0;
    async function renderSubscriptions(force) {
      const el = $('view-subs');
      if (!S.subs.length) {
        el.innerHTML = `
          <div class="empty" style="padding-top:4rem">
            <div class="emp-ic">${ic('subs', 30)}</div>
            <h2 style="margin:0 0 0.4rem;color:var(--tx);font-size:1.2rem">Don't miss new videos</h2>
            <p style="margin:0 0 1.1rem">Subscribe to your favourite educators to see their latest uploads here — no account needed, saved on this device.</p>
            <button class="btn pri" data-act="search">${ic('search', 18)} Find channels</button>
          </div>`;
        return;
      }
      const strip = S.subs.map(ch => `<div class="sub-pill" data-act="open-channel" data-ch="${esc(ch)}">${avatar(ch, 'big')}<span>${esc(ch)}</span></div>`).join('');
      const sig = S.subs.join('|');
      const cache = ld(K.subfeed, null);
      const fresh = cache && cache.sig === sig && Date.now() - cache.t < 20 * 6e4 && !force;
      const hm = histMap();
      el.innerHTML = `
        <div class="subs-strip">${strip}<div class="sub-pill" data-act="manage-subs"><div class="avatar big mng">${ic('list', 22)}</div><span>All</span></div></div>
        <div class="sechead"><span>Latest from your channels</span><button class="link" data-act="subs-refresh">Refresh</button></div>
        <div id="subs-feed" class="feed">${cache && cache.sig === sig ? cache.ids.map(id => cardHtml(id, 'subs', hm)).join('') : skelCards(4)}</div>`;
      ctxLists.subs = cache && cache.sig === sig ? cache.ids : [];
      if (fresh) return;
      const my = ++subsTok;
      const targets = S.subs.slice(0, 12);
      const res = await Promise.allSettled(targets.map(ch => channelVideos(ch)));
      if (my !== subsTok) return;
      const items = [];
      res.forEach((r, i) => { if (r.status === 'fulfilled') ingest(r.value.slice(0, 6), undefined).forEach((id, k) => items.push({ id, ts: (r.value[k] && r.value[k].ts) || 0, k })); });
      items.sort((a, b) => (b.ts - a.ts) || (a.k - b.k));
      const ids = [...new Set(items.map(x => x.id))].slice(0, 40);
      const feedEl = $('subs-feed');
      if (!feedEl || S.tab !== 'subs') return;
      if (ids.length) sv(K.subfeed, { t: Date.now(), sig, ids });
      ctxLists.subs = ids;
      const hm2 = histMap();
      feedEl.innerHTML = ids.length ? ids.map(id => cardHtml(id, 'subs', hm2)).join('') : `<div class="empty" style="grid-column:1/-1">Couldn't fetch new uploads right now.<br><small>${API_ST.msg ? esc(API_ST.msg) : 'Tap a channel above to open its page.'}</small><br><br><button class="btn pri" data-act="subs-refresh">Try again</button></div>`;
    }

    function manageSubsSheet() {
      openSheet(`<div class="shead">Subscriptions (${S.subs.length})</div>` + S.subs.map(ch => `<div class="mi" style="gap:0.8rem">${avatar(ch)}<span style="flex:1;min-width:0" data-act="open-channel" data-ch="${esc(ch)}">${esc(ch)}</span><button class="btn sm" data-act="unsub" data-ch="${esc(ch)}">Unsubscribe</button></div>`).join(''));
    }

    async function openChannelPage(chName) {
      if (!chName) return;
      const subbed = isSubscribed(chName);
      if (sheetOpen) closeSheet();
      openSub({ kind: 'channel', ch: chName, tab: 'videos' }, `
        ${subHeader(esc(chName))}
        <div class="ch-banner" id="ch-banner" style="--ch-h:${hue(chName)}"></div>
        <div class="ch-head">
          <span id="ch-av">${avatar(chName, 'big')}</span>
          <div style="flex:1;min-width:0">
            <h1>${esc(chName)}</h1>
            <p id="ch-meta">Channel</p>
          </div>
          <button class="sub-btn${subbed ? ' on' : ''}" id="ch-sub-btn" data-act="toggle-ch-sub" data-ch="${esc(chName)}">${subbed ? 'Subscribed' : 'Subscribe'}</button>
        </div>
        <div class="seg ch-tabs"><button class="on" data-act="ch-tab" data-v="videos">Videos</button><button data-act="ch-tab" data-v="about">About</button></div>
        <div id="ch-videos" class="feed">${skelCards(4)}</div>
        <div id="ch-about" hidden class="ch-about"></div>
      `);

      channelAbout(chName).then(a => {
        if (!$('ch-meta') || !S.sub || S.sub.ch !== chName) return;
        S.sub.about = a;
        $('ch-meta').textContent = [a.handle, a.subs].filter(Boolean).join(' • ') || 'Channel';
        if (a.banner) $('ch-banner').style.backgroundImage = `url("${a.banner}")`;
        if (a.av) { setAv(chName, a.av); $('ch-av').innerHTML = avatar(chName, 'big'); }
        if ($('ch-about')) $('ch-about').innerHTML = a.desc ? `<p>${esc(dec(a.desc))}</p>` : '<p class="hint">No description available.</p>';
      }).catch(() => { if ($('ch-about')) $('ch-about').innerHTML = '<p class="hint">Channel details are not available right now.</p>'; });

      try {
        const list = await channelVideos(chName);
        const ids = ingest(list);
        ctxLists.channel = ids;
        const hm = histMap();
        const box = $('ch-videos');
        if (box && S.sub && S.sub.ch === chName) box.innerHTML = ids.length ? ids.map(id => cardHtml(id, 'channel', hm)).join('') : `<div class="empty">No videos found for this channel.</div>`;
      } catch (e) {
        const box = $('ch-videos');
        if (box) box.innerHTML = `<div class="empty">Could not load channel videos right now.<br><small>${API_ST.msg ? esc(API_ST.msg) : 'Public servers are busy — try again in a moment.'}</small></div>`;
      }
    }

    /* ==================== LAYERS & ANDROID BACK STACK ==================== */
    const stack = [];
    let sentinel = false, ignorePop = 0, sTimer = null;
    function pushLayer(close, kind) {
      stack.push({ close, kind });
      if (!sentinel) {
        try { history.pushState({ tv: 1 }, ''); sentinel = true; } catch (e) {}
      }
    }
    function purgeKind(kind) { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].kind === kind) stack.splice(i, 1); }
    function dropLayer(kind) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].kind === kind) { const l = stack.splice(i, 1)[0]; try { l.close(); } catch (e) {} break; }
      }
      if (!stack.length && sentinel) {
        clearTimeout(sTimer);
        sTimer = setTimeout(() => { if (!stack.length && sentinel) { sentinel = false; ignorePop++; history.back(); } }, 150);
      }
    }
    function closeTopLayer() {
      const l = stack.pop();
      if (!l) return;
      try { l.close(); } catch (e) {}
      if (!stack.length && sentinel) {
        clearTimeout(sTimer);
        sTimer = setTimeout(() => {
          if (!stack.length && sentinel) { sentinel = false; ignorePop++; history.back(); }
        }, 150);
      }
    }
    window.addEventListener('popstate', () => {
      if (ignorePop > 0) { ignorePop--; return; }
      sentinel = false;
      const l = stack.pop();
      if (l) {
        try { l.close(); } catch (e) {}
        if (stack.length) {
          try { history.pushState({ tv: 1 }, ''); sentinel = true; } catch (e) {}
        }
      }
    });

    /* ==================== SHEETS & TOASTS ==================== */
    let sheetOpen = false, confirmFn = null;
    function openSheet(html) {
      const r = $('sheet-root');
      if (sheetOpen && !r.classList.contains('on')) { sheetOpen = false; purgeKind('sheet'); }
      if (!sheetOpen) {
        sheetOpen = true;
        r.classList.add('on');
        pushLayer(() => { sheetOpen = false; r.classList.remove('on'); r.innerHTML = ''; if (sheetHook) { const f = sheetHook; sheetHook = null; try { f(); } catch (e) {} } }, 'sheet');
      }
      r.innerHTML = `<div class="sbackdrop" data-act="sheet-close"></div><div class="spanel">${html}</div>`;
    }
    function closeSheet() { if (sheetOpen) dropLayer('sheet'); }

    let toastT = null;
    function toast(msg, actionLabel, actionAct) {
      const t = $('toast');
      t.innerHTML = `<div><span>${esc(msg)}</span>${actionLabel ? `<button class="link" style="color:#60a5fa" data-act="${actionAct}">${esc(actionLabel)}</button>` : ''}</div>`;
      clearTimeout(toastT);
      toastT = setTimeout(() => { t.innerHTML = ''; }, actionLabel ? 4200 : 2500);
    }
    let wipeI = 0;
    const WIPE = [
      { t: 'Do you really want to delete everything?', m: 'This permanently erases ALL Vaultube data on this device: playlists, notes, history, study sessions, analytics, subscriptions, settings and caches. You will be asked to confirm 4 times.', w: '', b: 'Continue' },
      { t: 'Confirm (1 of 2)', m: 'Type CONFIRM to continue.', w: 'CONFIRM', b: 'Next' },
      { t: 'Confirm (2 of 2)', m: 'Type CONFIRM once more.', w: 'CONFIRM', b: 'Next' },
      { t: 'Verify (1 of 2)', m: 'Type VERIFY to continue.', w: 'VERIFY', b: 'Next' },
      { t: 'Verify (2 of 2)', m: 'Last step. Type VERIFY to delete everything permanently. You will get 10 seconds to undo.', w: 'VERIFY', b: 'Delete everything' }
    ];
    function wipeStep(i) {
      wipeI = i;
      if (i >= WIPE.length) { closeSheet(); wipeAll(); return; }
      const s = WIPE[i];
      openSheet(`<div class="shead">${esc(s.t)}</div><p class="hint" style="font-size:0.875rem">${esc(s.m)}</p>${s.w ? `<input id="wz-in" class="wz-in" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${s.w}" oninput="document.getElementById('wz-ok').disabled = this.value.trim() !== '${s.w}'">` : ''}<div class="srow"><button class="btn grow" data-act="sheet-close">Cancel</button><button id="wz-ok" class="btn red grow" data-act="wipe-next" ${s.w ? 'disabled' : ''}>${s.b}</button></div>`);
    }
    function wipeAll() {
      const snap = [];
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); snap.push([k, localStorage.getItem(k)]); } } catch (e) {}
      window.__wiped = true;
      try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
      const ov = document.createElement('div');
      ov.id = 'wipe-ov';
      let left = 10;
      const draw = () => { ov.innerHTML = `<div class="wo-card"><div class="wo-ic">${ic('trash', 28)}</div><h3>Everything was deleted</h3><p>All data is gone.</p><div class="wo-bar"><i style="animation-duration:10s"></i></div><button class="btn red" id="wo-undo">Undo (${left}s)</button></div>`; $('wo-undo').onclick = undo; };
      const finish = () => {
        clearInterval(tm);
        try { localStorage.clear(); } catch (e) {}
        const done = () => location.reload();
        Promise.all([window.caches ? caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))) : 0, navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister()))) : 0]).then(done, done);
      };
      const undo = () => {
        clearInterval(tm);
        try { snap.forEach(([k, v]) => localStorage.setItem(k, v)); } catch (e) {}
        window.__wiped = false;
        location.reload();
      };
      document.body.appendChild(ov); draw();
      const tm = setInterval(() => { left--; if (left <= 0) { finish(); return; } const b = $('wo-undo'); if (b) { b.textContent = `Undo (${left}s)`; ov.querySelector('b').textContent = left; } }, 1000);
    }
    function confirmSheet(title, msg, ok, fn) {
      confirmFn = fn;
      openSheet(`<div class="shead">${esc(title)}</div><p class="hint" style="font-size:0.875rem">${esc(msg)}</p><div class="srow"><button class="btn grow" data-act="sheet-close">Cancel</button><button class="btn red grow" data-act="confirm-ok">${esc(ok)}</button></div>`);
    }

    /* ==================== SUB-PAGES ==================== */
    let subOpen = false;
    function openSub(kind, html, full) {
      const r = $('sub');
      r.className = 'on' + (full ? ' full' : '');
      r.innerHTML = html;
      r.scrollTop = 0;
      if (!subOpen) {
        subOpen = true;
        pushLayer(() => { subOpen = false; r.className = ''; r.innerHTML = ''; S.sub = null; S.reordering = false; }, 'sub');
      }
      S.sub = Object.assign({}, kind);
    }
    function closeSub() { if (subOpen) dropLayer('sub'); }
    const subHeader = (title, right) => `<div class="subhead"><button class="ib" data-act="sub-back" aria-label="Back">${ic('back')}</button><h2>${title}</h2>${right || ''}</div>`;

    /* ==================== CARD RENDERERS ==================== */
    function thumbBox(id, m, h, cls = 'thumb', resume) {
      const pct = pctOf(h), dur = m.dur || (h && h.t) || 0;
      return `<div class="${cls}"><img src="${thumb(id)}" loading="lazy" decoding="async" alt="">${resume && h && pct > 0 && pct < 95 ? `<span class="resume tnum">${ic('play', 11)} Resume ${fmt(h.w)}</span>` : ''}${dur ? `<span class="dur tnum">${fmt(dur)}</span>` : ''}${pct > 0 ? `<div class="prog"><i style="width:${pct}%"></i></div>` : ''}</div>`;
    }

    /* YouTube-style card: rounded edge-to-edge thumbnail, round channel logo, 2-line title, one meta line, vertical dots. */
    function cardHtml(id, ctx, hm, resume) {
      const m = M(id), h = hm[id], vw = String(m.views || '').replace(/\s*views?$/i, '');
      return `
        <article class="card yt" data-act="play" data-id="${id}" data-ctx="${ctx}">
          ${thumbBox(id, m, h, 'thumb', resume)}
          <h3 class="ctitle ytt" data-t="${id}">${esc(m.title)}</h3>
          <div class="ytm">
            <span class="cav" data-act="open-channel" data-ch="${esc(m.channel)}">${avatar(m.channel)}</span>
            <div class="ct"><p class="ytch">${esc(m.channel)}</p><p class="csub">${vw ? '\u25B7 ' + esc(vw) : ''}${m.pub ? ' &nbsp;' + esc(m.pub) : ''}</p></div>
            <div class="yta">
              <button class="ib${inPl('liked', id) ? ' on' : ''}" data-act="q-like" data-id="${id}" aria-label="Like">${ic('like', 22)}</button>
              <button class="ib${inPl('wl', id) ? ' on' : ''}" data-act="q-save" data-id="${id}" aria-label="Watch later">${ic('save', 22)}</button>
              <button class="ib mnu" data-act="menu" data-id="${id}" aria-label="More">${ic('more', 22)}</button>
            </div>
          </div>
        </article>`;
    }

    function rowHtml(id, ctx, hm, pl, idx = 0, total = 0) {
      const m = M(id), h = hm[id];
      const isPlaylist = ctx === 'pl' && pl;
      const inner = `
        <div class="row" data-act="play" data-id="${id}" data-ctx="${ctx}"${pl ? ` data-pl="${pl}"` : ''} data-idx="${idx}">
          ${thumbBox(id, m, h, 'rthumb')}
          <div class="ct">
            <h3 data-t="${id}">${esc(m.title)}</h3>
            <p data-c="${id}">${esc(subline(m))}</p>
            ${h && (h.studySec || h.breakSec) ? `<p class="tlog">Total ${fmtDurHuman((h.studySec || 0) + (h.breakSec || 0))} · Lecture ${fmtDurHuman(h.studySec || 0)} · Break ${fmtDurHuman(h.breakSec || 0)}</p>` : ''}
          </div>
          ${isPlaylist && S.reordering ? `
            <div class="reord-btns">
              <button data-act="pl-move" data-dir="-1" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} aria-label="Move up">${ic('chevu', 14)}</button>
              <button data-act="pl-move" data-dir="1" data-idx="${idx}" ${idx === total - 1 ? 'disabled' : ''} aria-label="Move down">${ic('chev', 14)}</button>
            </div>` : ''}
          <button class="ib" data-act="menu" data-id="${id}" aria-label="More">${ic('more', 20)}</button>
        </div>`;

      if (isPlaylist) {
        return `<div class="pl-item-wrap" data-pl-row="${id}" data-pl-id="${pl}" data-idx="${idx}"><div class="pl-del-bg">${ic('trash', 18)} Remove</div>${inner}</div>`;
      }
      return inner;
    }

    const skelCards = n => Array.from({ length: n }, () => `<div class="card"><div class="thumb sk"></div><div class="cbody"><div class="cav"><div class="avatar sk"></div></div><div class="ct"><div class="sk line"></div><div class="sk line s"></div></div></div></div>`).join('');
    const skelRows = n => Array.from({ length: n }, () => `<div class="row"><div class="rthumb sk"></div><div class="ct"><div class="sk line"></div><div class="sk line s"></div></div></div>`).join('');

    /* ==================== HOME & SMART RECOMMENDATIONS ==================== */
    let homeTok = 0;
    const learnCat = c => !['general', 'lofi', 'gaming', 'podcasts', 'music', 'motivation', 'entertainment', 'vlog', 'comedy', 'news', 'movies'].includes(String(c || '').toLowerCase());
    const chipQuery = c => (ACAD.includes(String(c).toLowerCase()) ? `${c} lecture` : c);
    const jit = id => (hue(id) / 360) * 0.4;
    const isDone = h => !!h && pctOf(h) >= 90;

    /* Interest profile: what you watch (recency + completion + study time), like, save, note, subscribe and tap on. */
    function profile() {
      const cat = {}, ch = {}, now = Date.now();
      const add = (o, k, v) => { if (k && k !== 'General' && k !== 'YouTube') o[k] = (o[k] || 0) + v; };
      S.hist.slice(0, 150).forEach(h => {
        const m = M(h.v), rec = Math.exp(-(now - h.at) / (21 * 864e5)), comp = h.t > 0 ? Math.min(1, h.w / h.t) : 0.3;
        const w = rec * (0.5 + comp) + Math.min(1, (h.studySec || 0) / 1800) * rec;
        add(cat, m.cat, w); add(ch, m.channel, w);
      });
      (PL('liked') || { items: [] }).items.slice(0, 60).forEach(id => { const m = M(id); add(cat, m.cat, 1.2); add(ch, m.channel, 1.2); });
      S.playlists.filter(p => p.id !== 'liked').forEach(p => p.items.slice(0, 40).forEach(id => { const m = M(id); add(cat, m.cat, 0.6); add(ch, m.channel, 0.6); }));
      Object.keys(S.notes).forEach(id => { const m = M(id), n = Math.min(2, (S.notes[id] || []).length * 0.3); add(cat, m.cat, n); add(ch, m.channel, n); });
      S.subs.forEach(c => add(ch, c, 2.5));
      Object.entries(S.set.hits || {}).forEach(([c, n]) => add(cat, c, Math.min(3, n * 0.4)));
      Object.entries(S.set.favCat || {}).forEach(([c, n]) => add(cat, c, Math.min(6, n * 2)));
      Object.entries(S.set.favCh || {}).forEach(([c, n]) => add(ch, c, Math.min(6, n * 2)));
      Object.keys(cat).forEach(c => { if (!learnCat(c) || (S.set.blockCat[c] || 0) >= 3) delete cat[c]; });
      Object.keys(ch).forEach(c => { if ((S.set.blockCh[c] || 0) >= 1) delete ch[c]; });
      return { cat, ch };
    }
    function scoreVideo(id, pf, hm) {
      const m = M(id), h = hm[id];
      let sc = (pf.cat[m.cat] || 0) + (pf.ch[m.channel] || 0) * 1.3 - (S.set.blockCat[m.cat] || 0) * 3;
      if (h) { const p = pctOf(h); if (p >= 90) sc -= 6; else if (p > 0) sc += 2; }
      if (m.ts) sc += Math.max(0, 1.2 - (Date.now() - m.ts) / 864e5 / 400);
      if (!S.meta[id] || !S.meta[id].title) sc -= 1;
      return sc + jit(id);
    }
    function rankIds(ids, limit) {
      const pf = profile(), hm = histMap();
      const sc = [...new Set(ids)].filter(id => !isShort(id) && !isBlocked(id)).map(id => [id, scoreVideo(id, pf, hm)]).sort((a, b) => b[1] - a[1]);
      const out = [], rest = [];
      sc.forEach(([id]) => {
        const c = M(id).channel, n = out.slice(-2).filter(x => M(x).channel === c).length;
        (n >= 2 ? rest : out).push(id);
      });
      return out.concat(rest).slice(0, limit || 60);
    }
    function continueList() {
      return S.hist.filter(h => h.t > 0 && h.w >= 10 && h.w / h.t < 0.95).slice(0, 5).map(h => h.v);
    }
    const MODS = ['lecture', 'explained', 'revision', 'one shot', 'crash course', 'important questions', 'concept', 'chapter', 'tricks', 'previous year', 'full course', 'doubt'];
    const pick = a => a[Math.floor(Math.random() * a.length)];
    function shuffleTop(ids) { const a = ids.slice(), n = Math.min(a.length, 14); const top = a.slice(0, n).sort(() => Math.random() - 0.5); return top.concat(a.slice(n)); }
    function refreshHome() {
      if (S.tab !== 'home') return;
      window.scrollTo({ top: 0 });
      toast('Refreshing\u2026');
      loadHome(true);
    }
    /* ===== Interest engine: learns topic phrases, channels & subjects from what you watch/like/save, never repeats what it already showed ===== */
    let SEEN = new Set(ld('tv3_seen', []));
    function markSeen(ids) { ids.forEach(i => SEEN.add(i)); const a = [...SEEN].slice(-400); SEEN = new Set(a); sv('tv3_seen', a); }
    const STOPW = new Set('the and for with from that this your you are how what why not all can will new best full free live one shot class lecture chapter part video videos hindi english explained complete batch lec ep episode official channel'.split(' '));
    function titleTerms(t) {
      const w = String(t || '').toLowerCase().replace(/[^a-z0-9\u0900-\u097f ]+/g, ' ').split(/\s+/).filter(x => x.length > 2 && !STOPW.has(x) && !/^\d+$/.test(x)), o = [];
      for (let i = 0; i < w.length - 1; i++) o.push(w[i] + ' ' + w[i + 1]);
      return o;
    }
    function interestTerms() {
      const now = Date.now(), t = {};
      const add = (id, w) => new Set(titleTerms(M(id).title)).forEach(b => { const e = t[b] || (t[b] = { w: 0, n: 0 }); e.w += w; e.n++; });
      S.hist.slice(0, 100).forEach(h => { const rec = Math.exp(-(now - h.at) / (21 * 864e5)), comp = h.t > 0 ? Math.min(1, h.w / h.t) : 0.3; add(h.v, rec * (0.5 + comp) + Math.min(1, (h.studySec || 0) / 1800) * rec); });
      (PL('liked') || { items: [] }).items.slice(0, 40).forEach(id => add(id, 1.2));
      S.playlists.filter(p => p.id !== 'liked').forEach(p => p.items.slice(0, 30).forEach(id => add(id, 0.6)));
      return Object.entries(t).filter(([k, e]) => e.n >= 2 || subjOf(k)).map(([k, e]) => [k, e.w]).sort((a, b) => b[1] - a[1]).slice(0, 40);
    }
    function engineQueries(n) {
      const pf = profile(), src = [];
      Object.entries(pf.cat).forEach(([c, w]) => src.push([chipQuery(c), w * 1.2]));
      Object.entries(pf.ch).forEach(([c, w]) => src.push([c, w]));
      interestTerms().forEach(([k, w]) => src.push([k, w]));
      if (src.length < 3) S.set.topics.forEach(t => { if (!(S.set.blockCat[t] >= 3)) src.push([chipQuery(t), 1]); });
      const out = [], pool = src.slice();
      while (out.length < n && pool.length) {
        let r = Math.random() * pool.reduce((a, x) => a + x[1] + 0.05, 0), i = 0;
        for (; i < pool.length; i++) { r -= pool[i][1] + 0.05; if (r <= 0) break; }
        const q = pool.splice(Math.min(i, pool.length - 1), 1)[0][0].trim();
        if (q && !out.includes(q)) out.push(q);
      }
      return out;
    }
    function relevant(id, pf, terms) {
      const m = M(id), has = Object.keys(pf.cat).length || Object.keys(pf.ch).length;
      if (!has) return true;
      const t = String(m.title || '').toLowerCase(), sb = subjOf(t + ' ' + (m.channel || ''));
      if ((pf.cat[m.cat] || 0) > 0.3 || (pf.ch[m.channel] || 0) > 0.3 || (sb && (pf.cat[sb] || 0) > 0.3)) return true;
      if ((pf.cat.JEE || pf.cat.NEET) && /\b(jee|neet|ncert|class 1[12])\b/.test(t)) return true;
      return terms.slice(0, 30).some(([k]) => t.includes(k));
    }
    function freshRank(ids, limit) { const r = rankIds(ids, 200).filter(id => !SEEN.has(id)); return r.length >= Math.min(6, ids.length) ? r.slice(0, limit) : rankIds(ids, limit); }
    function vaultPool() {
      const set = new Set(), hm = histMap();
      Object.keys(S.meta).forEach(id => { if (S.meta[id].title) set.add(id); });
      S.playlists.forEach(p => p.items.forEach(id => set.add(id)));
      return [...set].filter(id => !isShort(id) && !isBlocked(id) && !(S.set.hideWatched !== false && isDone(hm[id])));
    }
    function buildAllFeed() {
      H.cont = continueList();
      H.ids = freshRank(vaultPool().filter(id => !H.cont.includes(id)), 30);
    }
    function personalFeed() {
      return continueList().concat(rankIds(vaultPool(), 40)).filter((x, i, a) => a.indexOf(x) === i);
    }
    function interestQueries(n) {
      const pf = profile();
      const cats = Object.entries(pf.cat).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => chipQuery(x[0]));
      const chs = Object.entries(pf.ch).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
      let q = [...cats, ...chs];
      if (q.length < 3) q = q.concat(S.set.topics.filter(t => !(S.set.blockCat[t] >= 3)).sort(() => Math.random() - 0.5).slice(0, 3).map(chipQuery));
      return [...new Set(q)].slice(0, n || 4);
    }

    function renderChips() {
      $('chips').innerHTML = ['All', ...S.set.topics]
        .map(c => `<button class="chip${c === S.chip ? ' on' : ''}" data-act="chip" data-v="${esc(c)}">${esc(c)}</button>`)
        .join('');
    }

    function emptyFeedHtml() {
      const why = API_ST.msg ? esc(API_ST.msg) : 'Public search servers are busy or offline.';
      return `<div class="empty" style="grid-column:1/-1">Couldn't load videos right now.<br><small>${why}</small><br><br>
        <button class="btn pri" data-act="retry">Try again</button>
        ${hasKey() ? '' : '<button class="btn" data-act="goto-api">Add free API key</button>'}</div>`;
    }

    function renderFeed() {
      const el = $('feed');
      if (H.loading && !H.ids.length) { el.innerHTML = skelCards(5); return; }
      if (H.err && !H.ids.length) { el.innerHTML = emptyFeedHtml(); return; }
      ctxLists.home = (H.cont || []).concat(H.ids, H.recs || []);
      const hm = histMap();
      const head = t => `<div class="sechead" style="grid-column:1/-1;padding:0.5rem 0.875rem 0"><span>${t}</span></div>`;
      let html = '';
      if (S.chip === 'All' && H.cont && H.cont.length) html += head('Continue watching') + H.cont.map(id => cardHtml(id, 'home', hm, true)).join('');
      if (H.ids.length) html += (S.chip === 'All' && H.cont && H.cont.length ? head('From your vault') : '') + H.ids.map(id => cardHtml(id, 'home', hm)).join('');
      el.innerHTML = html || (S.chip === 'All' ? '' : `<div class="empty" style="grid-column:1/-1">Nothing here yet.<br>Tap + to add a YouTube link.</div>`);
    }

    async function loadHome(force) {
      const my = ++homeTok;
      H.err = false;
      H.recs = [];
      H.cont = [];
      $('feed-more').innerHTML = '';
      moreN = 0;

      if (S.chip === 'All') {
        buildAllFeed();
        if (force) H.ids = shuffleTop(H.ids);
        $('feed-extra').innerHTML = '';
        H.loading = false;
        renderFeed();
        loadSmartRecommendations(my, force);
        return;
      }

      $('feed-extra').innerHTML = '';
      const chip = S.chip;
      const vault = rankIds(vaultPool().filter(id => M(id).cat === chip), 12);
      H.ids = vault;
      H.loading = true;
      renderFeed();
      try {
        const r = await onlineSearch(force ? chipQuery(chip) + ' ' + pick(MODS) : chipQuery(chip), { fresh: !!force });
        if (my !== homeTok) return;
        const online = ingest(r, chip);
        H.ids = rankIds(online.filter(okForFeed).concat(vault), 60);
        H.loading = false;
      } catch (e) {
        if (my !== homeTok) return;
        H.loading = false;
        H.err = !vault.length;
      }
      renderFeed();
    }

    async function loadSmartRecommendations(my, force) {
      const ex = $('feed-extra');
      ex.innerHTML = `<div class="sechead"><span>Recommended for you</span><span style="font-size:0.78rem;color:var(--tx2)">Finding videos…</span></div><div class="feed">${skelCards(3)}</div>`;
      const pf = profile(), terms = interestTerms(), hm = histMap(), seen = new Set(H.ids.concat(H.cont || [])), pool = [];
      let live = 0;
      for (let round = 0; round < 2; round++) {
        const qs = engineQueries(round ? 4 : 5).map(q => (force && Math.random() < 0.5 ? q + ' ' + pick(MODS) : q));
        const rs = await Promise.allSettled(qs.map(q => onlineSearch(q, { fresh: !!force || round > 0 })));
        if (my !== homeTok || S.chip !== 'All') return;
        rs.forEach(r => { if (r.status === 'fulfilled') { if (!r.value.starter && !r.value.stale) live++; ingest(r.value).forEach(id => { if (!seen.has(id)) { seen.add(id); pool.push(id); } }); } });
        if (pool.filter(id => !isDone(hm[id]) && okForFeed(id) && relevant(id, pf, terms) && !SEEN.has(id)).length >= 10) break;
      }
      let cand = pool.filter(id => !isDone(hm[id]) && okForFeed(id) && relevant(id, pf, terms));
      const fresh = cand.filter(id => !SEEN.has(id)); if (fresh.length >= 4) cand = fresh;
      const ids = rankIds(cand, 40);
      if (!live && fresh.length < 4) {
        const why = API_ST.msg ? esc(API_ST.msg) : 'YouTube search servers are not responding.';
        ex.innerHTML = `<div class="empty" style="margin:.75rem">No new videos could be loaded.<br><small>${why}</small><br><br><button class="btn pri" data-act="retry">Try again</button> ${hasKey() ? '' : '<button class="btn" data-act="goto-api">Add free API key</button>'}</div>`;
        if (force) toast('No new videos \u2014 search servers unreachable');
        return;
      }
      if (!ids.length) {
        ex.innerHTML = H.ids.length || (H.cont && H.cont.length) ? '' : `<div class="empty">${emptyFeedHtml().replace('grid-column:1/-1', '')}</div>`;
        return;
      }
      H.recs = ids;
      markSeen(H.ids.concat(ids));
      ctxLists.home = (H.cont || []).concat(H.ids, ids);
      ex.innerHTML = `<div class="sechead"><span>Recommended for you</span><span style="font-size:0.78rem;color:var(--tx2)">Personalised</span></div><div class="feed">${ids.map(id => cardHtml(id, 'home', hm)).join('')}</div>`;
    }

    /* ==================== LIBRARY ("YOU" TAB) ==================== */
    S.libChip = 'all';
    function renderLibrary() {
      const hm = histMap();
      const hs = S.hist.slice(0, 12).map(h => h.v);
      ctxLists.hist = hs;

      const saved = new Set();
      S.playlists.forEach(p => p.items.forEach(i => saved.add(i)));
      const nn = Object.values(S.notes).reduce((a, l) => a + l.length, 0);
      const totalStudy = S.sessions.reduce((a, x) => a + (x.lectureSec || 0), 0);

      const pls = S.playlists.map(p => {
        const first = p.items[0], n = p.items.length;
        return `
          <div class="prow" data-act="open-pl" data-id="${p.id}">
            <div class="pthumb">${first ? `<img src="${thumb(first)}" loading="lazy" alt="">` : ic(p.id === 'liked' ? 'like' : p.id === 'wl' ? 'clock' : 'list', 28)}</div>
            <div class="ct" style="flex:1">
              <h3>${esc(p.name)}</h3>
              <p>${p.sys ? 'Private' : 'Playlist'} • ${n} video${n === 1 ? '' : 's'}</p>
            </div>
            ${p.sys ? '' : `<button class="ib" data-act="pl-row-menu" data-id="${p.id}">${ic('more', 20)}</button>`}
          </div>`;
      }).join('');

      $('view-library').innerHTML = `
        <div class="prof">
          ${profAvatar(true)}
          <div class="sp" style="min-width:0">
            <h1>${esc(S.set.name || 'Student')}</h1>
            <p>${esc(S.set.handle || '@tubevault')} \u2022 ${saved.size} saved</p>
          </div>
          <button class="ib" data-act="open-analytics" aria-label="Study insights" title="Insights">${ic('chart')}</button>
          <button class="ib" data-act="settings" aria-label="Settings" title="Settings">${ic('gear')}</button>
        </div>

        <div class="hscroll" style="padding-top:0.25rem;padding-bottom:0.375rem">
          <button class="btn pri" data-act="add">${ic('plus', 18)} Add video</button>
          <button class="btn" data-act="import">${ic('download', 18)} Import playlist</button>
          <button class="btn" data-act="open-analytics">${flameIc(18)} Insights \u00b7 ${fmtDurHuman(totalStudy)}</button>
          <button class="btn" data-act="new-playlist">${ic('list', 18)} New playlist</button>
        </div>

        <div class="sec"><h2 data-act="open-history" style="display:flex;align-items:center;gap:0.25rem">History ${ic('chevr', 20)}</h2><button class="link" data-act="open-history">View all</button></div>
        ${hs.length ? `<div class="hscroll">${hs.map(id => {
          const m = M(id), h = hm[id], pct = pctOf(h), dur = m.dur || (h && h.t) || 0;
          return `<div class="hcard" data-act="play" data-id="${id}" data-ctx="hist"><div class="thumb"><img src="${thumb(id)}" loading="lazy" alt="">${dur ? `<span class="dur tnum">${fmt(dur)}</span>` : ''}${pct > 0 ? `<div class="prog"><i style="width:${pct}%"></i></div>` : ''}</div><h3>${esc(m.title)}</h3><p>${esc(m.channel)}</p></div>`;
        }).join('')}</div>` : `<div class="empty" style="padding:1.125rem">Videos you watch appear here with lecture & break time logs.</div>`}

        <div class="sec"><h2>Playlists</h2><button class="link" data-act="new-playlist">+ New</button></div>
        ${pls}

        <div class="prow" data-act="open-notes">
          <div class="pthumb">${ic('note', 28)}</div>
          <div class="ct" style="flex:1"><h3>Your notes</h3><p>${nn} pinned timestamped note${nn === 1 ? '' : 's'}</p></div>
        </div>
      `;
    }

    /* ==================== USAGE TRACKING & ANALYTICS ==================== */
    const dayRec = dk => S.usage[dk] || (S.usage[dk] = { app: 0, watch: 0, cats: {}, vids: {} });
    let usageDirty = false, usageN = 0;
    function saveUsage() { if (usageDirty) { usageDirty = false; sv(K.usage, S.usage); } }
    function initUsage() {
      const cut = todayKey(Date.now() - 400 * 864e5);
      Object.keys(S.usage).forEach(k => { if (k < cut) delete S.usage[k]; });
      setInterval(() => {
        if (document.hidden) return;
        const r = dayRec(todayKey());
        r.app++;
        if (S.playing && S.cur && !S.ad) {
          r.watch++;
          const cm = M(S.cur), c = subjOf((cm.title || '') + ' ' + (cm.channel || '') + ' ' + String(cm.desc || '').slice(0, 300)) || cm.cat || 'General';
          r.cats[c] = (r.cats[c] || 0) + 1;
          r.vids[S.cur] = (r.vids[S.cur] || 0) + 1;
          if (learnCat(c)) { const hh = new Date().getHours(); r.hrs = r.hrs || {}; r.hrs[hh] = (r.hrs[hh] || 0) + 1; }
        }
        usageDirty = true;
        if (++usageN % 10 === 0) saveUsage();
      }, 1000);
    }
    const dayKeys = n => Array.from({ length: n }, (_, i) => todayKey(Date.now() - (n - 1 - i) * 864e5));
    const learnOf = r => Object.entries(r.cats || {}).reduce((a, [c, v]) => a + (learnCat(c) ? v : 0), 0);

    function streakInfo() {
      let cur = 0, best = 0, run = 0, prev = null;
      for (let i = 0; i < 400; i++) {
        const r = S.usage[todayKey(Date.now() - i * 864e5)];
        if (r && learnOf(r) >= 60) cur++; else if (i > 0) break;
      }
      Object.keys(S.usage).sort().forEach(k => {
        if (learnOf(S.usage[k]) >= 60) {
          run = prev && Math.round((new Date(k + 'T12:00:00') - new Date(prev + 'T12:00:00')) / 864e5) === 1 ? run + 1 : 1;
          prev = k; best = Math.max(best, run);
        }
      });
      return { cur, best: Math.max(best, cur) };
    }

    let tgDraft = { t: '', h: 10 };
    function tgSheet() {
      const cs = [...new Set(S.set.topics.concat(['Physics', 'Chemistry', 'Maths', 'Coding', 'AI', 'Finance']).filter(learnCat))].slice(0, 14);
      openSheet(`<div class="shead">Monthly target</div><p class="hint" style="font-size:0.8125rem;margin:0 0 0.5rem">Pick a subject</p><div class="tg-chips">${cs.map(c => `<button class="${tgDraft.t === c ? 'on' : ''}" data-act="tg-pick" data-t="${esc(c)}">${esc(c)}</button>`).join('')}</div><p class="hint" style="font-size:0.8125rem;margin:0.75rem 0 0.5rem">Hours this month</p><div class="seg">${[5, 10, 20, 40, 60].map(v => `<button class="${tgDraft.h === v ? 'on' : ''}" data-act="tg-h" data-v="${v}">${v}h</button>`).join('')}</div><div class="srow"><button class="btn grow" data-act="sheet-close">Cancel</button><button class="btn red grow" data-act="tg-save">Save target</button></div>`);
    }
    S.anRange = '7d';
    function openAnalytics() {
      openSub({ kind: 'analytics' }, '<div id="an-page" class="an"></div>');
      renderAnalytics();
    }
    const axisFmt = s => (s >= 3600 ? (s / 3600).toFixed(s % 3600 ? 1 : 0) + 'h' : Math.round(s / 60) + 'm');
    function renderAnalytics() {
      const el = $('an-page');
      if (!el) return;
      saveUsage();
      const range = S.anRange || '7d';
      const n = range === '1d' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 365;
      const emp = () => ({ app: 0, watch: 0, cats: {}, vids: {} });
      const U = k => S.usage[k] || emp();
      const keys = dayKeys(n), set = new Set(keys);
      const sumOf = ks => { const o = { app: 0, watch: 0, learn: 0 }; ks.forEach(k => { const r = U(k); o.app += r.app; o.watch += r.watch; o.learn += learnOf(r); }); return o; };
      const cur = sumOf(keys);
      const prev = range === 'all' ? null : sumOf(Array.from({ length: n }, (_, i) => todayKey(Date.now() - (2 * n - 1 - i) * 864e5)));
      const sess = S.sessions.filter(x => set.has(x.d));
      const lecture = sess.reduce((a, x) => a + (x.lectureSec || 0), 0);
      const brk = sess.reduce((a, x) => a + (x.breakSec || 0), 0);
      const longest = sess.reduce((a, x) => Math.max(a, x.lectureSec || 0), 0);
      const vidMap = {}, catMap = {};
      keys.forEach(k => {
        const r = U(k);
        Object.entries(r.vids || {}).forEach(([id, v]) => { (vidMap[id] = vidMap[id] || { w: 0, l: 0, b: 0, s: 0 }).w += v; });
        Object.entries(r.cats || {}).forEach(([c, v]) => { catMap[c] = (catMap[c] || 0) + v; });
      });
      sess.forEach(x => { const o = (vidMap[x.v] = vidMap[x.v] || { w: 0, l: 0, b: 0, s: 0 }); o.l += x.lectureSec || 0; o.b += x.breakSec || 0; o.s++; });
      const vids = Object.entries(vidMap).sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l)).slice(0, 10);
      const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
      const st = streakInfo();
      const today = U(todayKey()), goal = (S.set.goal || 120) * 60, tl = learnOf(today), gp = Math.min(100, Math.round((tl / goal) * 100));
      const focus = lecture + brk ? Math.round((lecture / (lecture + brk)) * 100) : 0;
      const activeDays = keys.filter(k => U(k).watch > 0).length;

      const delta = (a, b) => {
        if (!prev || !(b > 0)) return '';
        const pc = Math.round(((a - b) / b) * 100);
        return pc === 0 ? '<em class="dl">same</em>' : `<em class="dl ${pc > 0 ? 'up' : 'dn'}">${ic(pc > 0 ? 'trend' : 'trendd', 12)}${Math.abs(pc)}%</em>`;
      };
      const kpi = (icon, col, val, label, sub, dl) => `<div class="an-k" style="--c:${col}"><div class="k-top"><span class="k-ic">${ic(icon, 17)}</span>${dl || ''}</div><b class="tnum">${val}</b><small>${label}</small><span class="k-sub">${sub}</span></div>`;

      // week flame dots
      const wk = dayKeys(7).map(k => {
        const hit = learnOf(U(k)) >= 60, d = new Date(k + 'T12:00:00');
        return `<span class="wd${hit ? ' on' : ''}${k === todayKey() ? ' td' : ''}"><i>${hit ? flameIc(15) : ''}</i><small>${'SMTWTFS'[d.getDay()]}</small></span>`;
      }).join('');

      // activity chart
      const chartN = range === '30d' || range === 'all' ? 30 : 7;
      const cd = dayKeys(chartN).map(k => { const r = U(k), l = learnOf(r), o = Math.max(0, r.watch - l); return { k, l, o, t: l + o }; });
      const mx = Math.max(...cd.map(d => d.t), 1);
      const tops = [900, 1800, 3600, 5400, 7200, 10800, 14400, 21600, 28800, 43200, 86400];
      const top = tops.find(v => v >= mx) || 86400;
      const avgLine = cd.reduce((a, d) => a + d.t, 0) / chartN;
      const lbl = (k, i) => { const d = new Date(k + 'T12:00:00'); return chartN === 7 ? d.toLocaleDateString('en-US', { weekday: 'short' }) : (i % 5 === 0 || i === chartN - 1 ? String(d.getDate()) : ''); };
      const tipOf = d => `${new Date(d.k + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · Learning ${fmtDurHuman(d.l)} · Other ${fmtDurHuman(d.o)}`;
      const best = cd.reduce((a, d) => (d.t > a.t ? d : a), { t: 0 });
      const lastD = cd[cd.length - 1];

      // heatmap (12 weeks, Monday-first columns)
      const HW = 12, hd = new Date(); const dow = (hd.getDay() + 6) % 7;
      const hkeys = Array.from({ length: HW * 7 }, (_, i) => todayKey(Date.now() - (HW * 7 - 1 - i + (6 - dow)) * 864e5));
      const hv = hkeys.map(k => learnOf(U(k)));
      const hmx = Math.max(1, ...hv);
      const lvl = (v, k) => (k > todayKey() ? -1 : v < 60 ? 0 : v < hmx * 0.25 ? 1 : v < hmx * 0.5 ? 2 : v < hmx * 0.75 ? 3 : 4);
      const heat = hkeys.map((k, i) => `<i class="hc l${lvl(hv[i], k)}" title="${k}: ${fmtDurHuman(hv[i])}"></i>`).join('');
      const hdays = hkeys.filter((k, i) => hv[i] >= 60 && k <= todayKey()).length;

      // donut
      const tot = cats.reduce((a, x) => a + x[1], 0);
      const topC = cats.slice(0, 5), restC = cats.slice(5).reduce((a, x) => a + x[1], 0);
      const shades = ['#F4503A', '#FF8A78', '#C73A27', '#FFB4A8', '#FFD9D2'];
      const segs = topC.map(([c, v], i) => ({ c, v, col: shades[i] }));
      if (restC) segs.push({ c: 'Other topics', v: restC, col: '#D9DAE3' });
      let acc = 0;
      const grad = segs.map(x => { const a0 = acc; acc += (x.v / (tot || 1)) * 360; return `${x.col} ${a0.toFixed(1)}deg ${acc.toFixed(1)}deg`; }).join(',');

      const chips = [['1d', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['all', 'All time']].map(([v, l]) => `<button class="${range === v ? 'on' : ''}" data-act="an-range" data-v="${v}">${l}</button>`).join('');
      const tile = (i, v, l, dl, sub) => `<div class="ax-t t${i}"><b class="tnum">${v}</b><span>${l}</span><em>${sub}</em>${dl || ''}</div>`;
      const maxV = vids.length ? Math.max(1, ...vids.map(([, v]) => v.w + v.l)) : 1;

      /* ---- best study time ---- */
      const hrs = Array(24).fill(0);
      keys.forEach(k => { const o = U(k).hrs || {}; Object.keys(o).forEach(x => { hrs[+x] += o[x]; }); });
      if (!hrs.some(Boolean)) sess.forEach(x => { if (x.at) hrs[new Date(x.at).getHours()] += x.lectureSec || 0; });
      const hrMax = Math.max(...hrs), peakH = hrMax ? hrs.indexOf(hrMax) : -1;
      const fmtHr = h => (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? ' AM' : ' PM');
      const BLK = [['Morning', '5 AM – 12 PM', 5, 12], ['Afternoon', '12 – 5 PM', 12, 17], ['Evening', '5 – 9 PM', 17, 21], ['Night', '9 PM – 5 AM', 21, 29]];
      const inBlk = (h, b) => (h >= b[2] && h < b[3]) || (b[3] > 24 && h + 24 < b[3] && h + 24 >= b[2]);
      const blocks = BLK.map(b => {
        const time = hrs.reduce((a, v, h) => a + (inBlk(h, b) ? v : 0), 0);
        const ss = sess.filter(x => x.at && inBlk(new Date(x.at).getHours(), b));
        const l = ss.reduce((a, x) => a + (x.lectureSec || 0), 0), br = ss.reduce((a, x) => a + (x.breakSec || 0), 0);
        return { n: b[0], r: b[1], time, foc: l + br ? Math.round((l / (l + br)) * 100) : null, ns: ss.length };
      });
      const bestBlk = blocks.filter(b => b.foc !== null).sort((a, b) => b.foc - a.foc || b.time - a.time)[0] || blocks.slice().sort((a, b) => b.time - a.time)[0];
      const goodS = sess.filter(x => (x.lectureSec || 0) >= 300 && x.lectureSec / ((x.lectureSec || 0) + (x.breakSec || 0)) >= 0.85);
      const sweet = goodS.length ? Math.round(goodS.reduce((a, x) => a + x.lectureSec, 0) / goodS.length / 60) : 0;
      /* ---- goals & targets ---- */
      const dg = dayKeys(7).map(k => ({ k, l: learnOf(U(k)) }));
      const hit7 = dg.filter(d => d.l >= goal).length;
      const hit30 = dayKeys(30).filter(k => learnOf(U(k)) >= goal).length;
      const wkTot = dg.reduce((a, d) => a + d.l, 0);
      const mKey = todayKey().slice(0, 7), mCats = {};
      Object.keys(S.usage).filter(k => k.startsWith(mKey)).forEach(k => Object.entries(S.usage[k].cats || {}).forEach(([c, v]) => { mCats[c.toLowerCase()] = (mCats[c.toLowerCase()] || 0) + v; }));
      const dNow = new Date(), daysLeft = new Date(dNow.getFullYear(), dNow.getMonth() + 1, 0).getDate() - dNow.getDate();
      const TGC = ['#F4503A', '#FFB020', '#1FA463', '#C73A27', '#8A8FA0'];

      const gh = (icon, title, sub, right) => `<div class="gh"><span class="ixt">${ic(icon, 18)}</span><div class="gh-t"><b>${title}</b><small>${sub}</small></div>${right ? `<div class="gh-r">${right}</div>` : ''}</div>`;
      const rowP = (dot, label, val, sub, pctv) => `<div class="pr"><div class="pr-h"><span><i style="background:${dot}"></i>${label}</span><b class="tnum">${val}</b></div><div class="pr-b"><u style="width:${Math.max(2, Math.min(100, pctv))}%;background:${dot}"></u></div><small>${sub}</small></div>`;
      const gt = (cls, v, l, ico, dl) => `<div class="gt ${cls}"><span class="gt-ic">${ic(ico, 64)}</span><b class="tnum">${v}</b><span>${l}</span>${dl || ''}</div>`;
      const topTotal = segs.reduce((a, x) => a + x.v, 0) || 1;
      const lrnShare = tot ? Math.round((cats.filter(([c]) => learnCat(c)).reduce((a, x) => a + x[1], 0) / tot) * 100) : 0;
      const SB = ['Physics', 'Chemistry', 'Maths', 'Biology'], sbSec = {}; SB.forEach(x => { sbSec[x] = 0; });
      cats.forEach(([c, v]) => { const k = SB.find(x => x.toLowerCase() === String(c).toLowerCase()); if (k) sbSec[k] += v; });
      const sbTot = SB.reduce((a, x) => a + sbSec[x], 0), sbCol = { Physics: '#F4503A', Chemistry: '#FFB020', Maths: '#1FA463', Biology: '#8A5CF6' };
      const subjCard = `<section class="gc">${gh('book', 'Study time by subject', 'Detected from lecture title & description', `<span class="chip">Total ${fmtDurHuman(tot)}</span>`)}${SB.map(x => rowP(sbCol[x], x, fmtDurHuman(sbSec[x]), '', sbTot ? (sbSec[x] / sbTot) * 100 : 0)).join('')}</section>`;
      const dRange = { '1d': 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days', all: 'All time' }[range];

      el.innerHTML = `
        <div class="subhead"><button class="ib rnd" data-act="sub-back" aria-label="Back">${ic('back')}</button><h2>Analytics</h2><span class="rng">${ic('calendar', 15)}${dRange}</span></div>
        <div class="an-seg">${chips}</div>

        <section class="gc">
          <div class="kick">WHERE YOU STAND</div>
          <h3 class="gc-h">${tl ? fmtDurHuman(tl) + ' learned today' : 'Nothing learned yet today'}</h3>
          <p class="gc-p">${gp}% of your ${fmtDurHuman(goal)} daily goal. <button class="link" data-act="goto-goal">Change goal</button></p>
          <div class="pr-b big"><u style="width:${Math.max(2, gp)}%;background:linear-gradient(90deg,#FF8A78,#F4503A)"></u></div>
        </section>

        <div class="gts">
          ${gt('g1', fmtDurHuman(cur.watch), 'Watch time', 'eye', delta(cur.watch, prev && prev.watch))}
          ${gt('g2', fmtDurHuman(cur.learn), 'Learning', 'brain', delta(cur.learn, prev && prev.learn))}
          ${gt('g3', focus + '%', 'Focus', 'target')}
        </div>

        <section class="gc">${gh('clock', 'Screen time in Vaultube', range === 'all' ? 'All time' : dRange, `<span class="chip">All time ${fmtDurHuman(totalAppSec())}</span>`)}<div class="gts" style="margin-top:.6rem"><div class="gt g1"><b class="tnum">${fmtDurHuman(cur.app)}</b><span>Time in app</span></div><div class="gt g2"><b class="tnum">${fmtDurHuman(Math.round(cur.app / Math.max(1, keys.filter(k => (S.usage[k] || {}).app).length)))}</b><span>Avg per active day</span></div></div></section>
        ${subjCard}
        <section class="gc">
          ${gh('chart', 'Daily activity', `${dRange} · learning vs other`, `<span class="chip">avg ${fmtDurHuman(Math.round(avgLine))}</span>`)}
          <div class="an-tip" id="an-tip">${tipOf(lastD)}</div>
          <div class="an-chart${chartN > 7 ? ' dense' : ''}">
            <div class="grid">${[3, 2, 1].map(i => `<div style="bottom:${(i / 3) * 100}%"><span>${axisFmt(Math.round((top / 3) * i))}</span></div>`).join('')}<div class="avg" style="bottom:${Math.min(100, (avgLine / top) * 100)}%"><span>avg</span></div></div>
            <div class="bars">${cd.map((d, i) => `<button class="bc${d.k === todayKey() ? ' sel' : ''}" data-act="an-bar" data-tip="${esc(tipOf(d))}"><div class="bs" style="height:${Math.max(1.5, (d.t / top) * 100)}%"><i class="bo" style="flex:${d.o} 0 0"></i><i class="bl" style="flex:${d.l} 0 0"></i></div><small>${lbl(d.k, i)}</small></button>`).join('')}</div>
          </div>
          <div class="an-leg"><span><i></i>Learning</span><span><i></i>Other</span><span><i class="ln"></i>Average</span></div>
          ${best.t ? `<p class="an-note">${ic('bolt', 14)} Best day: <b>${new Date(best.k + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}</b> with ${fmtDurHuman(best.t)} watched.</p>` : ''}
        </section>

        <section class="gc">
          ${gh('timer', 'Study timer', `${sess.length} session${sess.length === 1 ? '' : 's'} in this period`, `<span class="big">${focus}%</span>`)}
          ${lecture + brk ? `<div class="stack"><i style="flex:${lecture};background:#F4503A"></i><i style="flex:${brk};background:#FFB020"></i></div>
          <div class="pr-list">
            ${rowP('#F4503A', 'Lecture', fmtDurHuman(lecture), `Longest ${fmtDurHuman(longest)} · avg ${sess.length ? fmtDurHuman(Math.round(lecture / sess.length)) : '0s'} per session`, (lecture / (lecture + brk)) * 100)}
            ${rowP('#FFB020', 'Break', fmtDurHuman(brk), `${100 - focus}% of study time`, (brk / (lecture + brk)) * 100)}
          </div>` : '<p class="hint">Start a video and use the study timer. Your lecture and break split shows up here.</p>'}
        </section>

        <section class="gc">
          ${gh('clock', 'Best time to study', hrMax ? `Your learning is strongest in the ${bestBlk.n.toLowerCase()}` : 'Needs a few study sessions', hrMax ? `<span class="big">${fmtHr(peakH)}<em>peak hour</em></span>` : '')}
          ${hrMax ? `<div class="hrs">${hrs.map((v, h) => `<i class="${h === peakH ? 'pk' : ''}" style="height:${Math.max(4, Math.round((v / hrMax) * 100))}%" title="${fmtHr(h)}: ${fmtDurHuman(v)}"></i>`).join('')}</div>
          <div class="hrs-ax"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span></div>
          <div class="pr-list">${blocks.map((b, i) => rowP(TGC[i % 4], b.n, b.foc !== null ? b.foc + '% focus' : (b.time ? fmtDurHuman(b.time) : '\u2014'), `${b.r} · ${fmtDurHuman(b.time)} learning${b.ns ? ` · ${b.ns} session${b.ns === 1 ? '' : 's'}` : ''}`, hrMax ? (b.time / Math.max(1, ...blocks.map(x => x.time))) * 100 : 0)).join('')}</div>
          ${sweet ? `<p class="an-note">${ic('bolt', 14)} Sessions of about <b>${sweet} min</b> give you the highest focus. Plan your lectures around that.</p>` : ''}` : '<p class="hint">Watch a few learning videos and your best hours of the day show up here.</p>'}
        </section>

        <section class="gc">
          ${gh('target', 'Goal progress', `Daily goal ${fmtDurHuman(goal)}`, `<span class="big">${hit7}/7<em>days hit</em></span>`)}
          <div class="gbars">${dg.map(d => `<div><i style="height:${Math.max(4, Math.min(100, Math.round((d.l / goal) * 100)))}%" class="${d.l >= goal ? 'hit' : ''}"></i><small>${'SMTWTFS'[new Date(d.k + 'T12:00:00').getDay()]}</small></div>`).join('')}<u style="bottom:calc(1.25rem + (100% - 1.25rem) * 1)"></u></div>
          <div class="pr-list">
            ${rowP('#F4503A', 'This week', fmtDurHuman(wkTot), `of ${fmtDurHuman(goal * 7)} weekly goal`, (wkTot / (goal * 7)) * 100)}
            ${rowP('#1FA463', 'Last 30 days', `${hit30}/30 days`, `${Math.round((hit30 / 30) * 100)}% goal hit rate`, (hit30 / 30) * 100)}
            ${rowP('#FFB020', 'Learning vs other', `${lrnShare}%`, 'of your watch time is learning', lrnShare)}
          </div>
        </section>

        <section class="gc">
          ${gh('book', 'Topic targets', 'Monthly study goals per subject', `<button class="chip btn" data-act="tg-add">+ Add</button>`)}
          ${(S.set.targets || []).length ? `<div class="pr-list" style="margin-top:0">${S.set.targets.map((t, i) => { const done = mCats[t.t.toLowerCase()] || 0, need = t.h * 3600; return `<div data-act="tg-del" data-t="${esc(t.t)}" style="cursor:pointer">${rowP(TGC[i % 5], esc(t.t), `${(done / 3600).toFixed(1)} / ${t.h}h`, done >= need ? 'Target reached ✓' : `${((need - done) / 3600).toFixed(1)}h to go · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left this month · tap to remove`, (done / need) * 100)}</div>`; }).join('')}</div>` : '<p class="hint" style="margin-top:0">Set a monthly target, for example "Physics 20h", and track how much of it you have finished.</p>'}
        </section>

        <section class="gc">
          ${gh('calendar', 'Study days', `${hdays} learning day${hdays === 1 ? '' : 's'} in the last 12 weeks`, `<span class="big">${hdays}<em>days</em></span>`)}
          <div class="heat"><div class="hdow"><span>M</span><span></span><span>W</span><span></span><span>F</span><span></span><span>S</span></div><div class="hgrid">${heat}</div></div>
          <div class="heat-leg">Less <i class="hc l0"></i><i class="hc l1"></i><i class="hc l2"></i><i class="hc l3"></i><i class="hc l4"></i> More</div>
        </section>

        <section class="gc">
          ${gh('layers', 'Where your time goes', tot ? `${fmtDurHuman(tot)} across ${cats.length} topic${cats.length === 1 ? '' : 's'}` : 'By topic', tot ? `<span class="big">${lrnShare}%<em>learning</em></span>` : '')}
          ${segs.length ? `<div class="stack">${segs.map(x => `<i style="flex:${x.v};background:${x.col}"></i>`).join('')}</div>
          <div class="kvl">${segs.map(x => `<div><span class="clamp1"><i style="background:${x.col}"></i>${esc(x.c)}</span><b class="tnum">${fmtDurHuman(x.v)}</b><em>${Math.round((x.v / topTotal) * 100)}%</em></div>`).join('')}</div>` : '<p class="hint">Watch a video to see where your time goes.</p>'}
        </section>

        <section class="gc">
          ${gh('play', 'Most-watched videos', vids.length ? `Top ${vids.length} in this period` : 'Nothing tracked yet')}
          ${vids.length ? vids.map(([id, v], i) => {
            const m = M(id);
            return `<div class="rr" data-act="play" data-id="${id}" data-ctx="x"><span class="bdg b${Math.min(i, 3)}">${i + 1}</span><div class="rr-t"><b class="clamp2">${esc(m.title)}</b><small>${esc(m.channel || '')}${v.s ? ` · Lecture ${fmtDurHuman(v.l)}` : ''}</small></div><b class="rr-v tnum">${fmtDurHuman(v.w + v.l)}</b></div>`;
          }).join('') : '<p class="hint">No videos tracked in this period.</p>'}
        </section>

        <div class="gnote">Tracked on this device only. Time pauses during ads and when the app is in the background.</div>
      `;
    }

    /* ==================== HISTORY & PLAYLIST PAGES ==================== */
    function openHistory() {
      openSub({ kind: 'hist' }, subHeader('History', `<button class="ib" data-act="hist-menu">${ic('more')}</button>`) + `<div class="sbox">${ic('search', 20)}<input id="hist-q" placeholder="Search watch history" autocomplete="off"></div><div id="hist-list"></div>`);
      renderHistList();
    }

    function renderHistList() {
      const el = $('hist-list');
      if (!el) return;
      const q = ($('hist-q') && $('hist-q').value || '').toLowerCase().trim(), hm = histMap();
      const items = S.hist.filter(h => {
        const m = M(h.v);
        return !q || m.title.toLowerCase().includes(q) || m.channel.toLowerCase().includes(q);
      });
      ctxLists.histpage = items.map(h => h.v);
      if (!items.length) { el.innerHTML = `<div class="empty">${q ? 'No matching videos' : 'No watch history yet'}</div>`; return; }
      const now = new Date(), t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(), y0 = t0 - 864e5;
      const g = { Today: [], Yesterday: [], Earlier: [] };
      items.forEach(h => (h.at >= t0 ? g.Today : h.at >= y0 ? g.Yesterday : g.Earlier).push(h.v));
      el.innerHTML = Object.entries(g).filter(x => x[1].length).map(([k, l]) => `<div class="glabel">${k}</div>${l.map(id => rowHtml(id, 'histpage', hm)).join('')}`).join('');
    }

    function openPlaylist(id) {
      S.reordering = false;
      openSub({ kind: 'pl', id }, '<div id="plpage"></div>');
      renderPlPage();
    }

    function renderPlPage() {
      const p = PL(S.sub && S.sub.id), el = $('plpage');
      if (!el) return;
      if (!p) { closeSub(); return; }
      const hm = histMap(), n = p.items.length;
      ctxLists.pl = p.items.slice();
      el.innerHTML = `
        <div class="plbg" style="--ph:${hue(p.items[0] || p.name)}">
          ${subHeader(esc(p.name), `<button class="btn sm" data-act="pl-toggle-reord">${S.reordering ? 'Done' : 'Reorder'}</button><button class="ib" data-act="pl-menu">${ic('more')}</button>`)}
          <div class="plbig">${n ? `<img src="${thumb(p.items[0])}" alt="">` : ic('list', 44)}</div>
          <h1 class="pltitle">${esc(p.name)}</h1>
          <div class="plby">${profAvatar(false)}<b>by ${esc(S.set.name || 'Student')}</b></div>
          <p class="plmeta">${p.sys ? 'Private' : 'Playlist'} • ${n} video${n === 1 ? '' : 's'} • Swipe left to delete, long-press or tap Reorder to move</p>
          <div class="plbtns">
            <button class="pbig" data-act="pl-play">${ic('play', 20)} Play all</button>
            <button class="cbtn" data-act="pl-shuffle" aria-label="Shuffle">${ic('shuffle', 20)}</button>
            <button class="cbtn" data-act="pl-add" aria-label="Add video">${ic('plus', 20)}</button>
          </div>
        </div>
        <div id="pl-rows">${n ? p.items.map((id, i) => rowHtml(id, 'pl', hm, p.id, i, n)).join('') : `<div class="empty">No videos in this playlist yet.</div>`}</div>
      `;
    }

    /* ==================== PLAYLIST SWIPE-LEFT DELETE & LONG-PRESS REORDER ==================== */
    (function () {
      let sw = null, lpTimer = null, lastRemoved = null, lpFired = false;
      document.addEventListener('click', e => { if (lpFired) { lpFired = false; e.stopPropagation(); e.preventDefault(); } }, true);
      window.undoPlRemove = () => {
        if (!lastRemoved) return;
        const p = PL(lastRemoved.plId);
        if (p && !p.items.includes(lastRemoved.vid)) {
          p.items.splice(lastRemoved.idx, 0, lastRemoved.vid);
          sv(K.pl, S.playlists);
          renderVisible();
        }
        lastRemoved = null;
      };

      document.addEventListener('touchstart', e => {
        lpFired = false;
        const wrap = e.target.closest('.pl-item-wrap');
        if (!wrap || e.touches.length !== 1) return;
        const row = wrap.querySelector('.row');
        const t = e.touches[0];
        sw = { wrap, row, x0: t.clientX, y0: t.clientY, dx: 0, moved: false };
        clearTimeout(lpTimer);
        lpTimer = setTimeout(() => {
          if (sw && !sw.moved) {
            lpFired = true;
            S.reordering = true;
            if (navigator.vibrate) navigator.vibrate(25);
            renderPlPage();
            toast('Reorder mode on \u2014 use the arrows to move');
          }
        }, 520);
      }, { passive: true });

      document.addEventListener('touchmove', e => {
        if (!sw) return;
        const t = e.touches[0];
        const dx = t.clientX - sw.x0;
        const dy = t.clientY - sw.y0;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          sw.moved = true;
          clearTimeout(lpTimer);
        }
        if (dx < -12 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          sw.dx = Math.max(-160, dx);
          sw.row.style.transition = 'none';
          sw.row.style.transform = `translateX(${sw.dx}px)`;
        }
      }, { passive: true });

      document.addEventListener('touchend', () => {
        clearTimeout(lpTimer);
        if (!sw) return;
        const { wrap, row, dx } = sw;
        sw = null;
        if (dx < -95) {
          const plId = wrap.dataset.plId;
          const vid = wrap.dataset.plRow;
          const idx = +wrap.dataset.idx;
          const p = PL(plId);
          if (p) {
            row.style.transition = 'transform 0.16s ease';
            row.style.transform = 'translateX(-100%)';
            setTimeout(() => {
              p.items = p.items.filter(x => x !== vid);
              sv(K.pl, S.playlists);
              lastRemoved = { plId, vid, idx };
              renderVisible();
              toast('Removed from playlist', 'Undo', 'undo-pl-rm');
            }, 160);
          }
        } else if (dx < 0) {
          row.style.transition = 'transform 0.18s ease';
          row.style.transform = '';
        }
      }, { passive: true });
    })();

    /* ==================== SEARCH PAGE ==================== */
    let searchTok = 0;
    function openSearch() {
      openSub({ kind: 'search' }, `<form class="shead2" data-form="search"><button type="button" class="ib" data-act="sub-back">${ic('back')}</button><input id="sq" class="sqi" placeholder="Search YouTube or your library" enterkeyhint="search" autocomplete="off"><button class="ib" type="submit">${ic('search')}</button></form><div id="sbody"></div>`, true);
      renderSearchRecent('');
      setTimeout(() => { const i = $('sq'); i && i.focus(); }, 60);
    }
    function renderSearchRecent(q) {
      const list = ld('tv3_q', []).filter(x => !q || x.toLowerCase().includes(q.toLowerCase())).slice(0, 10);
      $('sbody').innerHTML = list.map(x => `<div class="qrow" data-act="q-go" data-v="${esc(x)}">${ic('clock', 20)}<span class="qt">${esc(x)}</span><button class="ib" data-act="q-fill" data-v="${esc(x)}">${ic('fill', 20)}</button></div>`).join('') || `<div class="empty">Search any YouTube video, lecture, channel or saved item.</div>`;
    }
    function localMatches(q) {
      q = q.toLowerCase();
      const ids = new Set();
      S.playlists.forEach(p => p.items.forEach(i => ids.add(i)));
      S.hist.forEach(h => ids.add(h.v));
      return [...ids].filter(id => {
        const m = M(id);
        return m.title.toLowerCase().includes(q) || m.channel.toLowerCase().includes(q);
      }).slice(0, 8);
    }
    async function runSearch(q) {
      q = (q || '').trim();
      if (!q) return;
      if (!eduOK(q, '')) { const b = $('sbody'); if (b) b.innerHTML = NOT_ALLOWED_MSG; const i = $('sq'); if (i) i.blur(); return; }
      const rec = ld('tv3_q', []).filter(x => x.toLowerCase() !== q.toLowerCase());
      rec.unshift(q);
      sv('tv3_q', rec.slice(0, 14));
      const inp = $('sq');
      if (inp) { inp.value = q; inp.blur(); }
      const my = ++searchTok, hm = histMap(), local = localMatches(q).filter(okForFeed);
      ctxLists.search = local.slice();
      $('sbody').innerHTML = (local.length ? `<div class="sechead">In your library</div>${local.map(id => rowHtml(id, 'search', hm)).join('')}` : '') + `<div class="sechead">From YouTube</div><div id="sonline">${skelRows(6)}</div>`;
      try {
        const r = await onlineSearch(q);
        if (my !== searchTok) return;
        const ids = ingest(r).filter(id => !local.includes(id));
        ctxLists.search = local.concat(ids);
        $('sonline').innerHTML = ids.map(id => rowHtml(id, 'search', hm)).join('') || `<div class="empty">No results</div>`;
        refreshViews();
      } catch (e) {
        if (my !== searchTok) return;
        $('sonline').innerHTML = `<div class="empty">Search mirrors are busy.<br><br><button class="btn pri" data-act="q-go" data-v="${esc(q)}">Retry</button></div>`;
      }
    }

    /* ==================== MENUS, ADD VIDEO & BULK PLAYLIST IMPORT ==================== */
    let menuCtx = null, NM = null;
    function openMenu(id, ctx, pl) {
      menuCtx = { id, ctx, pl };
      const wl = inPl('wl', id);
      const m = M(id);
      const items = [
        ['save', 'list', 'Save to playlist'],
        ['wl', wl ? 'check' : 'clock', wl ? 'Remove from Watch later' : 'Save to Watch later'],
        ['channel', 'subs', `Go to ${m.channel}`],
        ['share', 'share', 'Share video'],
        ['sched', 'clock', 'Schedule to watch'],
        ['int', 'check', 'Interested'],
        ['noint', 'close', 'Not interested']
      ];
      if (ctx === 'hist' || ctx === 'histpage') items.push(['rmhist', 'trash', 'Remove from history']);
      if (ctx === 'pl' && pl) items.push(['rmpl', 'trash', 'Remove from this playlist']);
      openSheet(`<div class="shead clamp2">${esc(m.title)}</div>` + items.map(i => `<button class="mi" data-act="mi" data-k="${i[0]}">${ic(i[1])}<span>${i[2]}</span></button>`).join(''));
    }

    let lastNoInt = null;
    function markInterest(id, yes) {
      const m = M(id), s = S.set, bump = (o, k) => { if (k && k !== 'General' && k !== 'YouTube') o[k] = (o[k] || 0) + 1; };
      if (yes) {
        bump(s.favCat, m.cat); bump(s.favCh, m.channel);
        if (s.blockV.includes(id)) s.blockV = s.blockV.filter(x => x !== id);
        sv(K.set, S.set); toast('Got it \u2014 you\u2019ll see more like this');
        if (S.tab === 'home') loadHome();
        return;
      }
      lastNoInt = { id, ch: m.channel, cat: m.cat };
      if (!s.blockV.includes(id)) s.blockV.push(id);
      bump(s.blockCh, m.channel); bump(s.blockCat, m.cat);
      sv(K.set, S.set);
      H.ids = (H.ids || []).filter(x => !isBlocked(x)); H.recs = (H.recs || []).filter(x => !isBlocked(x)); H.cont = (H.cont || []).filter(x => !isBlocked(x));
      document.querySelectorAll('.card[data-id]').forEach(c => { if (isBlocked(c.dataset.id)) c.style.display = 'none'; });
      toast('Hidden. Fewer videos like this', 'Undo', 'undo-noint');
    }
    function saveSheet(id) {
      menuCtx = Object.assign(menuCtx || {}, { id });
      openSheet(`<div class="shead">Save to playlist…</div>` + S.playlists.filter(p => p.id !== 'liked').map(p => `<button class="mi" data-act="savepl" data-id="${p.id}">${ic(p.items.includes(id) ? 'check' : 'list')}<span style="flex:1">${esc(p.name)}</span><small style="color:var(--tx2)">${p.items.length}</small></button>`).join('') + `<button class="mi" data-act="savepl-new" style="color:var(--blue)">${ic('plus')}<span>Create new playlist</span></button><div class="srow"><button class="btn pri grow" data-act="sheet-close">Done</button></div>`);
    }

    function newPlaylistSheet(thenId) {
      menuCtx = Object.assign(menuCtx || {}, { thenId: thenId || null });
      openSheet(`<div class="shead">New playlist</div><form data-form="newpl"><input id="pl-name" placeholder="Playlist name (e.g. JEE Organic Chemistry)" autocomplete="off" maxlength="60"><textarea id="pl-links" rows="2" style="margin-top:0.5rem" placeholder="Optional: paste video links to add right away"></textarea><div class="srow"><button type="button" class="btn grow" data-act="sheet-close">Cancel</button><button type="submit" class="btn pri grow">Create</button></div></form>`);
      setTimeout(() => { const i = $('pl-name'); i && i.focus(); }, 80);
    }

    function renameSheet(id) {
      const p = PL(id);
      if (!p) return;
      menuCtx = { plid: id };
      openSheet(`<div class="shead">Rename playlist</div><form data-form="rename"><input id="pl-name" value="${esc(p.name)}" maxlength="60"><div class="srow"><button type="button" class="btn grow" data-act="sheet-close">Cancel</button><button type="submit" class="btn pri grow">Save</button></div></form>`);
    }

    function plMenuSheet(id) {
      const p = PL(id);
      if (!p) return;
      menuCtx = { plid: id };
      const it = p.sys ? (p.items.length ? [['pl-clear', 'trash', 'Clear all videos']] : []) : [['pl-rename', 'note', 'Rename playlist'], ['pl-delete', 'trash', 'Delete playlist']];
      if (!it.length) { toast('Nothing to change here'); return; }
      openSheet(`<div class="shead">${esc(p.name)}</div>` + it.map(i => `<button class="mi" data-act="mi2" data-k="${i[0]}">${ic(i[1])}<span>${i[2]}</span></button>`).join(''));
    }

    async function shareVideo(id) {
      const url = 'https://youtu.be/' + id;
      if (navigator.share) { try { await navigator.share({ title: M(id).title, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(url); toast('Link copied to clipboard'); } catch (e) { toast(url); }
    }

    /* ==================== ADD TO VAULT (video · playlist · search) ==================== */
    let ADD = { tab: 'video' };
    function plOptions(sel) {
      return S.playlists.filter(p => p.id !== 'liked').map(p => `<option value="${p.id}"${p.id === sel ? ' selected' : ''}>${esc(p.name)} (${p.items.length})</option>`).join('');
    }
    function openAdd(prefill, tab, plId) {
      ADD = { tab: tab || 'video', plId: plId || 'wl' };
      if (!sheetOpen || !$('add-body')) {
        openSheet(`
          <div class="add-h"><span class="add-ic">${ic('plus', 22)}</span><div><h3>Add to your vault</h3><p>Save a video, import a playlist, or search</p></div></div>
          <div class="seg add-tabs" id="add-tabs">
            <button data-act="add-tab" data-v="video">Link</button>
            <button data-act="add-tab" data-v="playlist">Playlist</button>
            <button data-act="add-tab" data-v="search">Search</button>
          </div>
          <div id="add-body"></div>`);
      }
      renderAddTab(prefill);
    }
    function renderAddTab(prefill) {
      document.querySelectorAll('#add-tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === ADD.tab));
      const b = $('add-body');
      if (ADD.tab === 'video') {
        b.innerHTML = `
          <div class="inrow"><input id="add-url" placeholder="Paste a YouTube link or video ID" autocomplete="off" autocapitalize="off" inputmode="url"><button class="btn" data-act="paste">Paste</button></div>
          <p class="hint" id="add-hint">Works with watch, live and youtu.be links.</p>
          <div class="prev" id="add-prev" hidden>
            <img id="add-img" alt="">
            <div style="min-width:0;flex:1"><h4 id="add-title" class="clamp2"></h4><p id="add-chan"></p><p id="add-stat" class="tnum"></p></div>
          </div>
          <span class="lbl">Save to</span>
          <select id="add-pl">${plOptions(ADD.plId)}<option value="__new">＋ New playlist…</option></select>
          <input id="add-newpl" placeholder="New playlist name" maxlength="60" hidden style="margin-top:0.5rem">
          <div class="srow"><button class="btn grow" data-act="add-save">Save</button><button class="btn red grow" data-act="add-play">${ic('play', 17)} Save &amp; play</button></div>`;
        if (prefill) { $('add-url').value = prefill; onAddInput(prefill); }
        else setTimeout(() => { const i = $('add-url'); i && i.focus(); }, 80);
      } else if (ADD.tab === 'playlist') {
        b.innerHTML = importHtml();
        if (prefill) { $('imp-text').value = prefill; loadImport(); }
      } else {
        b.innerHTML = `
          <form class="inrow" data-form="addsearch"><input id="as-q" placeholder="Search YouTube, e.g. Rotational motion JEE" enterkeyhint="search" autocomplete="off"><button class="btn pri" type="submit">${ic('search', 18)}</button></form>
          <span class="lbl">Add results to</span>
          <select id="as-pl">${plOptions(ADD.plId)}</select>
          <div id="as-res" class="as-res"><p class="hint">Tap + to add a result to the playlist. Add as many as you like, then press Done.</p></div>
          <div class="srow"><button class="btn pri grow" data-act="sheet-close">Done</button></div>`;
        setTimeout(() => { const i = $('as-q'); i && i.focus(); }, 80);
      }
    }
    function importHtml() {
      imp = { items: [], name: '' };
      return `
        <textarea id="imp-text" rows="3" placeholder="Paste a public or unlisted playlist link, or several video links (one per line)"></textarea>
        <div class="srow" style="margin-top:0.5rem"><button class="btn" data-act="imp-paste">Paste</button><button class="btn pri grow" data-act="imp-load" id="imp-load">Fetch videos</button></div>
        <p class="hint" id="imp-status">Tip: set your YouTube playlist to <b>Unlisted</b>, copy its share link and paste it here to import every video.</p>
        <div id="imp-results" hidden></div>`;
    }
    async function addSearch(q) {
      q = (q || '').trim();
      const box = $('as-res');
      if (!q || !box) return;
      box.innerHTML = skelRows(4);
      try {
        const r = await onlineSearch(q);
        const ids = ingest(r).slice(0, 20);
        const pid = $('as-pl') ? $('as-pl').value : 'wl';
        const p = PL(pid);
        box.innerHTML = ids.map(id => { const m = M(id), on = p && p.items.includes(id); return `<div class="row"><div class="rthumb"><img src="${thumb(id)}" alt="">${m.dur ? `<span class="dur tnum">${fmt(m.dur)}</span>` : ''}</div><div class="ct"><h3 class="clamp2" data-t="${id}">${esc(m.title)}</h3><p data-c="${id}">${esc(subline(m))}</p></div><button class="ib as-btn${on ? ' on' : ''}" data-act="as-add" data-id="${id}" aria-label="Add">${ic(on ? 'check' : 'plus', 20)}</button></div>`; }).join('') || '<p class="hint">No results.</p>';
      } catch (e) {
        box.innerHTML = `<p class="hint">Search failed.${API_ST.msg ? ' ' + esc(API_ST.msg) : ' Public servers are busy.'}</p>`;
      }
    }
    let addTok = 0, addMeta = null;
    function fillAddPreview(id) {
      if (!$('add-title')) return;
      const m = M(id), has = S.meta[id] && S.meta[id].title;
      $('add-title').textContent = has ? m.title : 'Fetching video details…';
      $('add-chan').textContent = has ? m.channel : '';
      $('add-stat').textContent = [m.dur ? fmt(m.dur) : '', m.views, m.pub].filter(Boolean).join(' • ');
    }
    async function onAddInput(v) {
      const id = extractId(v), pid = extractPlaylistId(v), prev = $('add-prev'), hint = $('add-hint');
      if (!prev) return;
      addMeta = null;
      if (pid && (!id || /playlist\?/.test(v))) {
        prev.hidden = true;
        hint.innerHTML = `Playlist detected! <button class="link" data-act="open-import-link">Import all its videos →</button>`;
        return;
      }
      if (!id) {
        prev.hidden = true;
        hint.textContent = v.trim() ? 'That doesn’t look like a YouTube link.' : 'Works with watch, live and youtu.be links.';
        return;
      }
      hint.textContent = 'Video found';
      prev.hidden = false;
      $('add-img').src = thumb(id);
      addMeta = { id };
      fillAddPreview(id);
      const my = ++addTok;
      if (S.meta[id] && S.meta[id].title && S.meta[id].views) return;
      try { await fetchInfo(id); } catch (e) {}
      if (my === addTok) fillAddPreview(id);
    }
    function addSubmit(play) {
      const id = extractId($('add-url').value);
      if (!id) { toast('Please enter a valid YouTube link'); return; }
      let pid = $('add-pl').value || 'wl';
      if (pid === '__new') {
        const n = ($('add-newpl').value || '').trim();
        if (!n) { toast('Name your new playlist'); $('add-newpl').focus(); return; }
        const np = { id: 'pl-' + Date.now(), name: n, items: [] };
        S.playlists.push(np);
        pid = np.id;
      }
      const p = PL(pid);
      if (p && !p.items.includes(id)) p.items.unshift(id);
      sv(K.pl, S.playlists);
      ensureMeta(id, true);
      closeSheet();
      renderVisible();
      if (play) playVideo(id, { queue: [id] });
      else toast('Saved to ' + (p ? p.name : 'Watch later'));
    }
    function openImport(prefill) { openAdd(prefill, 'playlist'); }

    /* Upgraded Bulk Playlist Importer */
    let imp = { items: [], name: '' };

    async function fetchPlaylist(pid) {
      const rss = (async () => {
        try {
          const d = await tfetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent('https://www.youtube.com/feeds/videos.xml?playlist_id=' + pid), 9000);
          if (d && d.status === 'ok') {
            return {
              title: ((d.feed && d.feed.title) || '').replace(/\s*-\s*YouTube$/i, ''),
              items: (d.items || []).map(i => ({ id: extractId(i.link || ''), title: i.title, channel: i.author })).filter(i => i.id)
            };
          }
        } catch (e) {}
        return { title: '', items: [] };
      })();

      const web = (async () => {
        try {
          const r = await tfetch('https://api.allorigins.win/get?url=' + encodeURIComponent('https://www.youtube.com/playlist?list=' + pid), 12000);
          const html = (r && r.contents) || '';
          const items = [];
          let title = '';
          const tm = html.match(/<title>([^<]+)<\/title>/i);
          if (tm) title = tm[1].replace(/\s*-\s*YouTube$/i, '').trim();
          const re = /"playlistVideoRenderer":\{"videoId":"([\w-]{11})"[\s\S]*?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"\}\]/g;
          let m;
          while ((m = re.exec(html))) {
            let t = m[2];
            try { t = JSON.parse('"' + t + '"'); } catch (e) {}
            items.push({ id: m[1], title: t, channel: '' });
          }
          return { title, items };
        } catch (e) {}
        return { title: '', items: [] };
      })();

      const [a, b] = await Promise.all([rss, web]);
      const map = new Map();
      b.items.concat(a.items).forEach(i => { if (!map.has(i.id)) map.set(i.id, i); });
      return { title: b.title || a.title, items: [...map.values()] };
    }

    async function loadImport() {
      const text = $('imp-text').value, st = $('imp-status'), btn = $('imp-load');
      const ids = [...new Set(text.split(/[\s,]+/).filter(Boolean).map(extractId).filter(Boolean))];
      const pid = extractPlaylistId(text);

      if (pid && (ids.length <= 1 || /playlist\?/.test(text))) {
        btn.disabled = true;
        btn.textContent = 'Reading Playlist...';
        st.textContent = 'Fetching videos from playlist...';
        const r = await fetchPlaylist(pid);
        if (!$('imp-text')) return;
        btn.disabled = false;
        btn.textContent = 'Fetch Videos';
        if (!r.items.length) {
          st.textContent = 'Could not read that playlist. Ensure it is Public or Unlisted (not Private).';
          return;
        }
        imp = { items: r.items.map(i => ({ ...i, on: true })), name: r.title || 'Imported Playlist' };
        st.textContent = `Found ${r.items.length} videos.`;
        showImpResults();
        return;
      }

      if (ids.length) {
        imp = {
          items: ids.map(id => ({ id, title: (S.meta[id] || {}).title || '', channel: (S.meta[id] || {}).channel || '', on: true })),
          name: `Imported (${ids.length})`
        };
        st.textContent = `Found ${ids.length} video${ids.length === 1 ? '' : 's'}.`;
        showImpResults();
        imp.items.forEach(i => {
          if (!i.title) {
            tfetch('https://noembed.com/embed?url=https://www.youtube.com/watch?v=' + i.id, 8000)
              .then(d => { if (d && d.title) { i.title = d.title; i.channel = d.author_name || ''; if ($('imp-list')) renderImpList(); } })
              .catch(() => {});
          }
        });
        return;
      }
      st.textContent = 'No YouTube links found in the text box.';
    }

    function showImpResults() {
      const el = $('imp-results');
      el.hidden = false;
      el.innerHTML = `
        <span class="lbl">Destination Playlist</span>
        <select id="imp-dest"><option value="new">+ Create New Playlist</option>${S.playlists.filter(p => p.id !== 'liked').map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
        <input id="imp-name" style="margin-top:0.5rem" value="${esc(imp.name)}" placeholder="New playlist name">
        <div style="display:flex;align-items:center;margin-top:0.75rem"><b id="imp-sum" style="flex:1"></b><button class="link" data-act="imp-all">Select all</button><button class="link" style="margin-left:0.875rem;color:var(--tx2)" data-act="imp-none">Clear</button></div>
        <div id="imp-list"></div>
        <div class="srow"><button class="btn red grow" id="imp-go" data-act="imp-go">Import</button></div>
      `;
      renderImpList();
    }

    function renderImpList() {
      const n = imp.items.filter(i => i.on).length;
      $('imp-sum').textContent = `${n} of ${imp.items.length} selected`;
      $('imp-go').disabled = !n;
      $('imp-go').textContent = `Import ${n} video${n === 1 ? '' : 's'}`;
      $('imp-list').innerHTML = imp.items.map((i, x) => `<label class="chk"><input type="checkbox" data-i="${x}" ${i.on ? 'checked' : ''}><img src="${thumb(i.id)}" loading="lazy" alt=""><span>${esc(i.title || 'YouTube Video')}</span></label>`).join('');
    }

    function executeImport() {
      const sel = imp.items.filter(i => i.on);
      if (!sel.length) return;
      const dest = $('imp-dest').value;
      let p;
      if (dest === 'new') {
        p = { id: 'pl-' + Date.now(), name: ($('imp-name').value.trim() || 'Imported Playlist'), items: [] };
        S.playlists.push(p);
      } else p = PL(dest);
      sel.forEach(i => setMeta(i.id, { title: i.title, channel: i.channel }));
      const ids = sel.map(i => i.id);
      p.items = [...ids, ...p.items.filter(x => !ids.includes(x))];
      sv(K.pl, S.playlists);
      closeSheet();
      renderVisible();
      toast(`Imported ${ids.length} video${ids.length === 1 ? '' : 's'} to “${p.name}”`);
      ids.forEach(id => ensureMeta(id, true));
    }

    /* ==================== SETTINGS PAGE ==================== */
    let deferredInstallPrompt = null;
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstallPrompt = e; });
    window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; toast('Vaultube installed'); });

    function downloadTextFile(filename, text, mime = 'text/plain') {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    const tog = (k, on) => `<button class="sw${on ? ' on' : ''}" data-act="set-tog" data-k="${k}" role="switch" aria-checked="${on}"><i></i></button>`;
    const srow = (t, sub, right) => `<div class="srow2"><div class="st"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</div>${right}</div>`;

    document.addEventListener('toggle', e => { if (e.target && e.target.id === 'learned') S.learnedOpen = e.target.open; }, true);
    function openSettings(focus) {
      openSub({ kind: 'settings' }, '<div id="setpage"></div>', false);
      renderSettings();
      if (focus) setTimeout(() => { const t = $('set-' + focus); if (t) t.scrollIntoView({ block: 'start' }); }, 60);
    }
    function learnedHtml() {
      const pf = profile(), hm = histMap();
      const topCats = Object.entries(pf.cat).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const topChs = Object.entries(pf.ch).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const cmax = topCats.length ? topCats[0][1] : 1, hmax = topChs.length ? topChs[0][1] : 1;
      const hits = Object.entries(S.set.hits || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const qs = ld('tv3_q', []).slice(0, 8);
      const recent = S.hist.slice(0, 6);
      const watchSec = Object.values(S.usage).reduce((a, r) => a + (r.watch || 0), 0);
      const likes = (PL('liked') || { items: [] }).items.length;
      const saved = new Set(); S.playlists.filter(p => p.id !== 'liked').forEach(p => p.items.forEach(i => saved.add(i)));
      const nn = Object.values(S.notes).reduce((a, l) => a + l.length, 0);
      const stat = (l, v) => `<div class="lr-s"><b class="tnum">${v}</b><small>${l}</small></div>`;
      const bars = (arr, mx, col) => arr.length ? arr.map(([k, v]) => `<div class="lr-b"><span class="clamp1">${esc(k)}</span><div><i style="width:${Math.max(6, Math.round((v / mx) * 100))}%;background:${col || `hsl(${hue(k)} 72% 58%)`}"></i></div></div>`).join('') : '<p class="hint">Nothing learned yet.</p>';
      return `
        <div class="lr-stats">${stat('Videos watched', S.hist.length)}${stat('Watch time', fmtDurHuman(watchSec))}${stat('Liked', likes)}${stat('Saved', saved.size)}${stat('Notes', nn)}${stat('Channels followed', S.subs.length)}</div>
        <h5>Topics you like</h5>${bars(topCats, cmax)}
        <h5>Favourite channels</h5>${bars(topChs, hmax, 'var(--a2)')}
        <h5>Topic chips you tapped</h5>${hits.length ? `<div class="lr-tags">${hits.map(([k, v]) => `<span>${esc(k)} <b>${v}</b></span>`).join('')}</div>` : '<p class="hint">None yet.</p>'}
<h5>Hidden by you</h5>${(S.set.blockV.length || Object.keys(S.set.blockCh).length) ? `<div class="lr-tags">${Object.keys(S.set.blockCh).map(k => `<span>${esc(k)} <b>channel</b></span>`).join('')}${Object.keys(S.set.blockCat).map(k => `<span>${esc(k)} <b>topic</b></span>`).join('')}<span>${S.set.blockV.length} <b>videos</b></span></div><button class="link" data-act="unblock-all" style="margin-top:.4rem">Restore all</button>` : '<p class="hint">Nothing hidden. Use \u22EE \u2192 Not interested on any video.</p>'}
        <h5>Recent searches</h5>${qs.length ? `<div class="lr-tags">${qs.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : '<p class="hint">None yet.</p>'}
        <h5>Recently watched</h5>${recent.length ? recent.map(h => `<div class="lr-v"><img src="${thumb(h.v)}" alt=""><span class="clamp2">${esc(M(h.v).title)}</span><small>${pctOf(h)}%</small></div>`).join('') : '<p class="hint">Nothing watched yet.</p>'}
        <p class="hint" style="margin-top:.7rem">Your playlists, notes and subscriptions also feed recommendations. Remove them from the Library if you want them gone too.</p>`;
    }
    function renderSettings() {
      const el = $('setpage');
      if (!el) return;
      const sc = $('sub').scrollTop;
      const th = S.set.theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      const pm = S.set.playerMode;
      const ui = typeof S.set.ui === 'number' ? S.set.ui : null;
      const curUi = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1;
      const seg = (act, cur, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" data-act="${act}" data-v="${v}">${l}</button>`).join('')}</div>`;
      el.innerHTML = subHeader('Settings') + `
        <div class="set-sec"><h4>Profile</h4>
          <div class="inrow" style="align-items:center">${profAvatar(true)}<button class="btn" data-act="pick-photo">Change photo</button>${S.set.photo ? '<button class="btn" data-act="rm-photo">Remove</button>' : ''}<input id="photo-in" type="file" accept="image/*" hidden></div>
          <div class="inrow" style="margin-top:0.6rem"><input id="name-in" value="${esc(S.set.name || 'Student')}" placeholder="Your name"><input id="handle-in" value="${esc(S.set.handle || '@tubevault')}" placeholder="@handle"></div>
        </div>

        <div class="set-sec"><h4>Appearance</h4>
          ${seg('set-theme', th, [['dark', 'Dark'], ['amoled', 'AMOLED'], ['light', 'Light']])}
          <div class="ui-row"><span>Display size</span><b class="tnum">${ui === null ? 'Auto' : Math.round(ui * 100) + '%'} <small>(now ${Math.round(curUi * 100)}%)</small></b></div>
          <input type="range" id="ui-range" min="0.85" max="1.5" step="0.05" value="${ui === null ? curUi.toFixed(2) : ui}" aria-label="Display size">
          <div class="ui-ends"><span>Smaller</span><button class="link" data-act="ui-auto">${ui === null ? 'Auto (on)' : 'Use Auto'}</button><span>Larger</span></div>
        </div>

        <div class="set-sec"><h4>Player</h4>
          <button class="opt${pm === 'mini' ? ' on' : ''}" data-act="set-pm" data-v="mini"><b>Watch page + mini player</b><span>Video on top with description, notes and Up Next below. Swipe down to minimise.</span></button>
          <button class="opt${pm === 'theater' ? ' on' : ''}" data-act="set-pm" data-v="theater"><b>Portrait cinema</b><span>Black screen with the video centred and controls around it.</span></button>
          <button class="opt${pm === 'full' ? ' on' : ''}" data-act="set-pm" data-v="full"><b>Full-screen only</b><span>Player fills the screen; closing it stops playback.</span></button>
          ${srow('Autoplay next video', 'Plays the next video in your playlist or Up Next', tog('autoplay', S.set.autoplay !== false))}
          <div class="srow2"><div class="st"><b>Double-tap seek</b><small>Seconds to skip on a double-tap</small></div></div>
          ${seg('set-seek', S.set.seek || 10, [[5, '5s'], [10, '10s'], [15, '15s'], [30, '30s']])}
        </div>

        <div class="set-sec"><h4>Study</h4>
          ${srow('Auto-start lecture stopwatch', 'Starts the top timer when a video opens', tog('autoStudy', S.set.autoStudy !== false))}
          <div class="srow2" id="set-goal"><div class="st"><b>Daily learning goal</b><small>Shown on your Analytics page</small></div></div>
          ${seg('set-goal', S.set.goal || 120, [[30, '30m'], [60, '1h'], [120, '2h'], [180, '3h'], [240, '4h']])}
          <div class="srow2"><div class="st"><b>Custom goal (hours)</b><small>Type any number, like 5 or 6.5</small></div><div class="goal-c"><input id="goal-in" type="number" inputmode="decimal" min="0.25" max="24" step="0.25" value="${+((S.set.goal || 120) / 60).toFixed(2)}"><button class="btn sm" data-act="goal-custom">Set</button></div></div>
        </div>

        <div class="set-sec"><h4>Home &amp; recommendations</h4>
          <div class="srow2"><div class="st"><b>Topic chips</b><small>Shown at the top of Home. Tap × to remove.</small></div></div>
          <div class="topic-edit">${S.set.topics.map(t => `<span class="chip on">${esc(t)}<button data-act="topic-del" data-v="${esc(t)}" aria-label="Remove ${esc(t)}">×</button></span>`).join('')}</div>
          <form class="inrow" data-form="topic" style="margin-top:0.5rem"><input id="topic-in" placeholder="Add a topic, e.g. Biology" maxlength="24"><button class="btn pri" type="submit">Add</button></form>
          ${srow('Hide finished videos', 'Videos you watched to the end disappear from Home', tog('hideWatched', S.set.hideWatched !== false))}
          <button class="btn" style="margin-top:0.6rem" data-act="reset-interests">Reset what the app learned about me</button>
        </div>

        <div class="set-sec" id="set-api"><h4>Better search &amp; channel data (optional)</h4>
          <p class="hint" style="margin:0 0 0.6rem">Without a key Vaultube uses free public servers, which are often busy. A free YouTube Data API key makes topic chips, search, channel logos, views, upload dates and subscriptions reliable. It stays on this device.</p>
          <div class="inrow"><input id="api-in" type="password" autocomplete="off" placeholder="Paste API key (starts with AIza…)" value="${esc(S.set.apiKey || '')}"><button class="btn pri" data-act="api-test">Test</button></div>
          <p class="hint" id="api-status">${hasKey() ? (API_ST.msg ? esc(API_ST.msg) : 'Key saved.') : 'No key set.'}</p>
          <details class="howto"><summary>How to get a free key (2 minutes)</summary>
            <ol><li>Open <b>console.cloud.google.com</b> and create a project.</li><li>Go to <b>APIs &amp; Services → Library</b>, search <b>YouTube Data API v3</b> and press <b>Enable</b>.</li><li>Go to <b>Credentials → Create credentials → API key</b> and copy it here.</li><li>Free quota: about 100 searches a day (channel feeds are almost free).</li></ol>
          </details>
        </div>

        <div class="set-sec" id="set-privacy"><h4>Privacy &amp; what the app knows</h4>
          <p class="hint" style="margin:0 0 .7rem">Everything is stored only on this phone. Recommendations are built from the signals below \u2014 you can read them and wipe them any time.</p>
          <button class="btn red" style="width:100%" data-act="forget-all">${ic('trash', 17)} Delete everything about you</button>
          <details class="learned" id="learned"${S.learnedOpen ? ' open' : ''}>
            <summary><span>${ic('eye', 18)} What Vaultube has learned about you</span><i>${ic('chev', 18)}</i></summary>
            ${learnedHtml()}
          </details>
        </div>

        <div class="set-sec"><h4>Study reminders</h4>${schedHtml()}</div>

        <div class="set-sec"><h4>Your data</h4>
          <div class="srow"><button class="btn grow" data-act="backup">${ic('download', 17)} Back up</button><button class="btn grow" data-act="restore">${ic('plus', 17)} Restore</button></div>
          <input id="restore-in" type="file" accept="application/json,.json" hidden>
          <div class="srow"><button class="btn grow" data-act="clear-cache">Clear search cache</button><button class="btn grow" data-act="hist-clear">Clear history</button></div>
          <button class="btn red" style="margin-top:0.6rem;width:100%" data-act="reset-all">Erase everything</button>
        </div>

        <div class="set-sec"><h4>Install &amp; share from YouTube</h4>
          <button class="btn red" style="width:100%" data-act="install-pwa">${ic('download', 17)} Install Vaultube</button>
          <p class="hint">Once installed from an https link, open any video in the YouTube app, tap <b>Share</b>, pick <b>Vaultube</b>. It is saved to Watch later instantly and you are sent straight back to YouTube.</p>
        </div>
        <p class="hint" style="text-align:center;padding:0.5rem 0 1.5rem">Vaultube · distraction-free learning</p>
      `;
      $('sub').scrollTop = sc;
    }

    function applyTheme() {
      const dark = document.documentElement.classList.contains('dark');
      const amoled = document.documentElement.classList.contains('amoled');
      $('tc').setAttribute('content', amoled ? '#000000' : dark ? '#0d0d0f' : '#ffffff');
    }
    function setTheme(t) {
      document.documentElement.classList.toggle('dark', t === 'dark' || t === 'amoled');
      document.documentElement.classList.toggle('amoled', t === 'amoled');
      S.set.theme = t;
      sv(K.set, S.set);
      applyTheme();
    }

    /* ==================== PLAYER ENGINE & AD-BYPASS ==================== */
    let yt = null, ytReady = false, playerReady = false, pending = null, tick = null, lastSave = 0, ctrlTimer = null, isDrag = false;
    const EMB = ['https://inv.nadeko.net', 'https://yewtu.be', 'https://invidious.nerdvpn.de'];
    let embIdx = 0;
    const httpOk = () => /^https?:$/.test(location.protocol);

    window.onYouTubeIframeAPIReady = () => {
      ytReady = true;
      if (pending && !yt) { createPlayer(pending.id, pending.start); pending = null; }
    };
    (function () {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      document.head.appendChild(s);
    })();

    function createPlayer(id, start) {
      $('yt-host').innerHTML = '<div id="yt-el"></div>';
      const v = {
        autoplay: 1,
        controls: 0,
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        disablekb: 1,
        fs: 0,
        start: Math.floor(start || 0)
      };
      if (httpOk()) v.origin = location.origin;
      yt = new YT.Player('yt-el', {
        host: 'https://www.youtube-nocookie.com',
        videoId: id,
        playerVars: v,
        events: {
          onReady: e => {
            playerReady = true;
            try { e.target.setPlaybackRate(S.rate); } catch (x) {}
            if (pending) { e.target.loadVideoById({ videoId: pending.id, startSeconds: pending.start }); pending = null; }
          },
          onStateChange: onState,
          onError: e => {
            if (e.data === 100) { toast('Video is private or unavailable'); return; }
            if (e.data === 152 || e.data === 153) S.fb = true;
            if (S.cur) playFallback(S.cur, S.t);
          }
        }
      });
    }

    function playFallback(id, start) {
      S.native = true;
      $('pv').classList.add('native');
      playerReady = false;
      yt = null;
      pending = null;
      $('yt-host').innerHTML = `<iframe src="${EMB[embIdx % EMB.length]}/embed/${id}?autoplay=1&local=true&start=${Math.floor(start || 0)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
      S.playing = true;
      updatePlayUI();
    }

    function loadInPlayer(id, start) {
      if (!httpOk() || S.fb) { playFallback(id, start); return; }
      if (S.native) {
        S.native = false;
        $('pv').classList.remove('native');
        yt = null;
        playerReady = false;
        pending = null;
        $('yt-host').innerHTML = '';
      }
      if (playerReady) {
        yt.loadVideoById({ videoId: id, startSeconds: start });
        try { yt.setPlaybackRate(S.rate); } catch (e) {}
      } else if (yt) pending = { id, start };
      else if (ytReady) createPlayer(id, start);
      else pending = { id, start };
    }

    /* Ad handling: YouTube's IFrame player is cross-origin, so a page can never click its Skip button.
       What we can do: notice an ad is playing, hand every touch straight to YouTube's own player (so its
       Skip button works), and keep ad seconds out of your study/watch timers and saved progress.
       An ad is detected when (a) the player reports another video / a much shorter duration, or
       (b) the clock says "playing" but the video position is frozen (ads never move the main position). */
    S.ad = false; S.adManual = 0;
    let adLastT = -1, adFrozen = 0, adMoving = 0;
    function setAd(on) {
      if (on === S.ad) return;
      S.ad = on;
      $('pv').classList.toggle('ad', on);
      if (on) { $('ctrl').classList.remove('show'); $('player-layer').classList.remove('hud-on'); }
      else showCtrls();
    }
    function detectAd(fromEvent) {
      if (!playerReady || !yt || !S.cur) return false;
      let hard = false, t = 0;
      try {
        const vd = yt.getVideoData && yt.getVideoData();
        const d = yt.getDuration && yt.getDuration();
        t = yt.getCurrentTime() || 0;
        const exp = M(S.cur).dur;
        if (vd && vd.video_id && vd.video_id !== S.cur) hard = true;
        else if (exp > 240 && d > 0 && d < Math.min(180, exp * 0.6)) hard = true;
        else if (yt.getAdState && yt.getAdState() === 1) hard = true;
      } catch (e) {}
      if (!fromEvent) {
        if (S.playing && !isDrag) {
          if (Math.abs(t - adLastT) > 0.2) { adMoving++; adFrozen = 0; } else { adFrozen++; adMoving = 0; }
        }
        adLastT = t;
      }
      let ad = hard || adFrozen >= 3;
      if (!ad && S.ad && adMoving < 2 && S.playing) ad = true;            // stay in ad mode until the video visibly moves again
      if (S.adManual > Date.now()) { if (adMoving >= 2) S.adManual = 0; else ad = true; }
      if (!S.playing && !fromEvent && !hard) ad = S.ad;                   // paused: keep whatever we decided
      setAd(ad);
      return ad;
    }

    function onState(e) {
      const st = e.data;
      S.playing = st === 1;
      if (st === 0) { adFrozen = 0; adMoving = 0; setAd(false); }
      if (st === 1) detectAd(true);
      if (st === 1 && !S.ad) {
        try {
          const d = yt.getDuration();
          if (d > 0) {
            S.d = d;
            if (S.cur && M(S.cur).dur !== Math.floor(d)) setMeta(S.cur, { dur: Math.floor(d) });
          }
        } catch (x) {}
        startTick();
        showCtrls();
      }
      if (st === 2 && !S.ad) {
        saveProg();
        $('ctrl').classList.add('show');
        $('player-layer').classList.add('hud-on');
        clearTimeout(ctrlTimer);
      }
      if (st === 0 && !S.ad && !(M(S.cur).dur > 60 && S.d < M(S.cur).dur * 0.8)) {
        if (S.cur) histUpsert(S.cur, S.d, S.d);
        if (S.set.autoplay !== false) playNext();
      }
      updatePlayUI();
    }

    function startTick() {
      if (tick) return;
      tick = setInterval(() => {
        if (!playerReady || !S.cur) return;
        try {
          if (detectAd()) return;
          const t = yt.getCurrentTime(), d = yt.getDuration();
          if (typeof t === 'number') S.t = t;
          if (d > 0) S.d = d;
          if (!isDrag) paintProg();
          if (S.playing && Date.now() - lastSave > 5000) saveProg();
        } catch (e) {}
      }, 500);
    }

    function saveProg() { if (S.cur && S.d) histUpsert(S.cur, S.t, S.d); }
    function paintProg() {
      const d = S.d || 0, t = S.t || 0, p = d > 0 ? Math.min(100, (t / d) * 100) : 0;
      const pctStr = p + '%';
      const timeStr = fmt(t) + ' / ' + (d ? fmt(d) : '--:--');
      $('sc-fill').style.width = pctStr;
      $('sc-knob').style.left = pctStr;
      $('mini-prog').style.width = pctStr;
      $('c-time').textContent = timeStr;
      if ($('th-fill')) $('th-fill').style.width = pctStr;
      if ($('th-knob')) $('th-knob').style.left = pctStr;
      if ($('th-time')) $('th-time').textContent = timeStr;
      if (isDrag) { const tp = $('sc-tip'); tp.textContent = fmt(t); tp.style.left = pctStr; }
    }

    function updatePlayUI() {
      $('c-play').innerHTML = ic(S.playing ? 'pause' : 'play', S.playing ? 26 : 28);
      $('mini-play').innerHTML = ic(S.playing ? 'pause' : 'play', 22);
    }

    function showCtrls() {
      const c = $('ctrl');
      const layer = $('player-layer');
      c.classList.add('show');
      layer.classList.add('hud-on');
      clearTimeout(ctrlTimer);
      if (S.playing) {
        ctrlTimer = setTimeout(() => {
          c.classList.remove('show');
          layer.classList.remove('hud-on');
        }, 3200);
      }
    }

    function togglePlay() { if (!playerReady) return; try { S.playing ? yt.pauseVideo() : yt.playVideo(); } catch (e) {} }
    function seekTo(s) {
      if (!playerReady) return;
      S.t = Math.max(0, Math.min(S.d || s, s));
      try { yt.seekTo(S.t, true); } catch (e) {}
      paintProg();
      saveProg();
    }
    function seekRel(d) { seekTo((S.t || 0) + d); }
    function playNext() {
      const i = S.queue.indexOf(S.cur);
      if (i > -1 && i < S.queue.length - 1) playVideo(S.queue[i + 1], { keepQueue: true });
    }

    const SEEK = () => S.set.seek || 10;
    const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
    const inFs = () => isFs() || !!S.cfs;
    function exitFs() { try { if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {} }
    function lockLand(on) { try { const r = on ? screen.orientation.lock('landscape') : screen.orientation.unlock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
    function cssFs() { S.cfs = true; $('pv').classList.add('cfs'); }
    function toggleFs() {
      const pv = $('pv');
      if (inFs()) { if (isFs()) exitFs(); S.cfs = false; pv.classList.remove('cfs'); lockLand(false); setFill(false, true); return; }
      const f = pv.requestFullscreen || pv.webkitRequestFullscreen;
      if (f) { try { Promise.resolve(f.call(pv)).then(() => lockLand(true)).catch(cssFs); } catch (e) { cssFs(); } }
      else cssFs();
    }
    function setFill(on, silent) {
      const h = $('yt-host');
      if (on && inFs()) {
        const f = Math.max(1, (innerWidth / innerHeight) / (16 / 9));
        h.style.transform = `scale(${f})`;
        S.fill = true;
        if (!silent) toast('Zoomed to fill screen');
      } else {
        h.style.transform = '';
        const was = S.fill;
        S.fill = false;
        if (was && !silent) toast('Original ratio');
      }
    }
    document.addEventListener('fullscreenchange', () => { if (!isFs()) { S.cfs = false; $('pv').classList.remove('cfs'); setFill(false, true); } });

    function playVideo(id, o = {}) {
      if (!id) return;
      if (!o.keepQueue) {
        if (o.queue && o.queue.length) S.queue = o.queue.slice();
        else if (!S.queue.includes(id)) S.queue = [id];
      }
      if (!S.queue.includes(id)) S.queue = [id];
      const h = histMap()[id];
      let start = o.start != null ? o.start : (h && h.t > 0 && h.w / h.t < 0.95 ? h.w : 0);
      if (start < 3) start = 0;

      setAd(false);
      adFrozen = 0; adMoving = 0; adLastT = -1; S.adManual = 0;
      S.cur = id;
      S.t = start;
      S.d = (h && h.t) || M(id).dur || 0;
      ensureMeta(id, true);
      openPlayerUI();
      updateWatchPage();
      paintProg();
      loadInPlayer(id, start);
      histUpsert(id, start, 0);
      startTick();
      startStudyTimer(id);

      const ex = $('notes-box');
      if (ex && !ex.hidden) renderNotes();
    }

    function openPlayerUI() {
      if (S.pmode === 'full' || S.pmode === 'theater') return;
      if (S.pmode === 'mini') { expandPlayer(); return; }
      const targetMode = S.set.playerMode === 'theater' ? 'theater' : 'full';
      $('player-layer').className = 'on ' + targetMode + ' hud-on';
      S.pmode = targetMode;
      document.body.classList.remove('has-mini');
      pushLayer(playerClose, 'player');
      showCtrls();
    }

    function playerClose() {
      if (S.set.playerMode === 'mini' || S.set.playerMode === 'theater') minimize();
      else stopPlayer();
    }
    function minimize() {
      purgeKind('player');
      exitFs();
      saveProg();
      $('player-layer').className = 'on mini';
      S.pmode = 'mini';
      document.body.classList.add('has-mini');
    }
    function expandPlayer() {
      if (S.pmode !== 'mini') return;
      const targetMode = S.set.playerMode === 'theater' ? 'theater' : 'full';
      $('player-layer').className = 'on ' + targetMode + ' hud-on';
      S.pmode = targetMode;
      document.body.classList.remove('has-mini');
      purgeKind('player');
      pushLayer(playerClose, 'player');
      updateWatchPage();
      showCtrls();
    }

    function toggleTheaterLayout() {
      if (!S.cur) return;
      const nextMode = S.pmode === 'theater' ? 'full' : 'theater';
      S.pmode = nextMode;
      $('player-layer').className = 'on ' + nextMode + ' hud-on';
      document.body.classList.remove('has-mini');
      updateWatchPage();
      showCtrls();
      toast(nextMode === 'theater' ? 'Portrait Cinema (Centered Middle)' : 'Half-Screen Watch Page');
    }

    function stopPlayer() {
      purgeKind('player');
      exitFs();
      saveProg();
      flushStudySession();
      try { playerReady && yt.stopVideo(); } catch (e) {}
      if (S.native) {
        $('yt-host').innerHTML = '';
        yt = null;
        playerReady = false;
        S.native = false;
        $('pv').classList.remove('native');
      }
      S.cfs = false;
      $('pv').classList.remove('cfs');
      $('yt-host').style.transform = '';
      S.fill = false;
      clearInterval(tick);
      tick = null;
      setAd(false);
      S.cur = null;
      S.playing = false;
      S.pmode = 'none';
      S.t = 0;
      S.d = 0;
      $('player-layer').className = '';
      document.body.classList.remove('has-mini');
      updatePlayUI();
    }

    function updateWatchPage() {
      const id = S.cur;
      if (!id) return;
      const m = M(id), nl = S.notes[id] || [];
      { const mt = [m.views, m.pub].filter(Boolean).join(' \u2022 '); $('wp-title').innerHTML = esc(m.title) + (mt ? ` <span class="wp-inl">${esc(mt)}</span>` : ''); }
      $('wp-chan').textContent = m.channel || 'YouTube';
      $('wp-meta').textContent = [m.views, m.pub, m.cat].filter(Boolean).join(' • ');
      $('wp-av').innerHTML = avatar(m.channel);

      const subBtn = $('wp-sub-btn');
      const subbed = isSubscribed(m.channel);
      subBtn.textContent = subbed ? 'Subscribed' : 'Subscribe';
      subBtn.classList.toggle('on', subbed);

      $('bl').textContent = '« ' + SEEK() + 's';
      $('br').textContent = SEEK() + 's »';
      $('mini-title').textContent = m.title;
      $('mini-chan').textContent = m.channel || 'YouTube';

      $('b-like').innerHTML = ic('like', 19) + `<span>${inPl('liked', id) ? 'Liked' : 'Like'}</span>`;
      $('b-save').innerHTML = ic('save', 19) + '<span>Save</span>';
      $('b-share').innerHTML = ic('share', 19) + '<span>Share</span>';
      $('b-more').innerHTML = ic('more', 19) + '<span>More</span>';
      $('b-like').classList.toggle('on', inPl('liked', id));
      $('b-save').classList.toggle('on', S.playlists.some(p => p.id !== 'liked' && p.items.includes(id)));
      $('b-save').querySelector('span').textContent = S.playlists.some(p => p.id !== 'liked' && p.items.includes(id)) ? 'Saved' : 'Save';
      $('ad-min').innerHTML = ic('chev', 24);

      $('notes-n').textContent = nl.length;
      $('notes-prev').textContent = nl.length ? nl[0].text.replace(/\*\*|==|`/g, '').replace(/^\s*- \[[ x]\]\s*/gim, '').replace(/\n+/g, ' \u00b7 ') : 'Pin a timestamped note while watching\u2026';
      $('notes-ic').innerHTML = ic('note', 17);
      syncNotesCard();
      $('c-min').innerHTML = ic(S.set.playerMode !== 'full' ? 'chev' : 'close', 26);
      $('nbtn').innerHTML = ic('chev', 26);
      $('c-auto').innerHTML = `<span class="tg${S.set.autoplay !== false ? ' on' : ''}"><i></i></span>`;
      $('c-theater').innerHTML = ic('theater', 20);

      // Update Portrait Cinema (Centered Mode) HUD
      if ($('th-title')) {
        $('th-title').textContent = m.title;
        $('th-handle').textContent = '@' + (m.channel || 'YouTube').replace(/\s+/g, '');
        $('th-min').innerHTML = ic('chev', 26);
        $('th-layout').innerHTML = ic('theater', 21);
        $('th-speed').innerHTML = ic('gear', 21);
        $('th-close').innerHTML = ic('close', 22);
        $('th-fs').innerHTML = ic('collapse', 20);
        $('th-like').innerHTML = ic('like', 22);
        $('th-like').classList.toggle('on', inPl('liked', id));
        $('th-like').innerHTML = ic('like', 22);
        $('th-note').innerHTML = ic('note', 21);
        $('th-more').innerHTML = ic('more', 21);
        $('th-queue').innerHTML = ic('queue', 22);

        const qIdx = S.queue.indexOf(id);
        const nextId = (qIdx > -1 && qIdx < S.queue.length - 1) ? S.queue[qIdx + 1] : personalFeed().find(x => x !== id);
        const nextPill = $('th-next-pill');
        if (nextPill) {
          if (nextId) {
            nextPill.hidden = false;
            $('th-next-img').src = thumb(nextId);
          } else {
            nextPill.hidden = true;
          }
        }
      }

      renderUpNext();
      updatePlayUI();
    }

    function syncNotesCard() {
      const b = $('notes-box'), c = $('notes-card');
      if (!b || !c) return;
      const open = !b.hidden;
      c.classList.toggle('open', open);
      c.setAttribute('aria-expanded', open ? 'true' : 'false');
      $('notes-chev').innerHTML = ic('chev', 20);
    }
    function renderUpNext() {
      const el = $('upnext');
      if (!el) return;
      const i = S.queue.indexOf(S.cur);
      let ids = i > -1 ? S.queue.slice(i + 1) : [];
      if (ids.length < 6) {
        personalFeed().concat(H.ids, H.recs || []).forEach(x => {
          if (x !== S.cur && !ids.includes(x) && !S.queue.includes(x)) ids.push(x);
        });
      }
      ids = ids.slice(0, 18);
      ctxLists.upnext = [S.cur].concat(ids);
      const hm = histMap();
      el.innerHTML = ids.map(id => cardHtml(id, 'upnext', hm)).join('');
    }

    /* ==================== PRO NOTES ==================== */
    const NT = {
      note: { n: 'Note', c: '#3ea6ff' },
      key: { n: 'Key point', c: '#10b981' },
      def: { n: 'Definition', c: '#a78bfa' },
      formula: { n: 'Formula', c: '#f59e0b' },
      ex: { n: 'Example', c: '#14b8a6' },
      q: { n: 'Doubt', c: '#ef4444' },
      imp: { n: 'Important', c: '#ff0033' },
      todo: { n: 'Revise', c: '#ec4899' }
    };
    const NTPL = {
      def: '**Term:** \n**Meaning:** \n**Example:** ',
      formula: '**Formula:** `  `\n**Where:** \n**Use when:** ',
      steps: '**Steps**\n- [ ] \n- [ ] \n- [ ] ',
      qa: '**Q:** \n**A:** ',
      cornell: '**Cue:** \n**Notes:**\n- \n- \n**Summary:** '
    };
    let NE = null, neLast = 'note', sheetHook = null;
    S.nfilter = 'all';

    const mdInline = t => esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, '$1<i>$2</i>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/==(.+?)==/g, '<mark>$1</mark>');
    function md(text, vid, nid) {
      return String(text || '').split('\n').map((ln, i) => {
        let m;
        if ((m = /^\s*- \[( |x)\] ?(.*)$/i.exec(ln))) {
          const on = m[1].toLowerCase() === 'x';
          return `<div class="mdl chk${on ? ' done' : ''}" data-act="note-chk" data-id="${vid}" data-nid="${nid}" data-line="${i}"><span class="bx"></span><span>${mdInline(m[2])}</span></div>`;
        }
        if ((m = /^\s*[-•] (.*)$/.exec(ln))) return `<div class="mdl bul"><span>•</span><span>${mdInline(m[1])}</span></div>`;
        if ((m = /^\s*> ?(.*)$/.exec(ln))) return `<div class="mdl quo">${mdInline(m[1])}</div>`;
        if ((m = /^#{1,3} (.*)$/.exec(ln))) return `<div class="mdl hd">${mdInline(m[1])}</div>`;
        return ln.trim() ? `<div class="mdl">${mdInline(ln)}</div>` : '<div class="mdl sp2"></div>';
      }).join('');
    }

    function noteCard(vid, n, jump, head) {
      const t = NT[n.type] || NT.note;
      const m = head ? M(vid) : null;
      return `<div class="ncard2" style="--nc:${t.c}">
        ${head ? `<div class="nc-vid" data-act="play" data-id="${vid}" data-ctx="x"><img src="${thumb(vid)}" loading="lazy" alt=""><span class="clamp1">${esc(m.title)}</span></div>` : ''}
        <div class="nc-top">
          <span class="nc-type"><i class="nc-dot"></i>${t.n}</span>
          <button class="tsb tnum" data-act="${jump ? 'note-go' : 'seek-ts'}" data-id="${vid}" data-ts="${n.timestamp}">${ic('play', 10)} ${fmt(n.timestamp)}</button>
          <span class="sp"></span>
          <button class="ib nc-star${n.star ? ' on' : ''}" data-act="note-star" data-id="${vid}" data-nid="${n.id}" aria-label="Star">${ic('star', 18)}</button>
          <button class="ib" data-act="note-menu" data-id="${vid}" data-nid="${n.id}" aria-label="More">${ic('more', 18)}</button>
        </div>
        <div class="nc-body">${md(n.text, vid, n.id)}</div>
        ${n.at ? `<div class="nc-foot">${ago(n.at)}${n.edited ? ' · edited' : ''}</div>` : ''}
      </div>`;
    }

    function filterNotes(list) {
      const f = S.nfilter;
      return list.filter(n => f === 'all' || (f === 'star' ? n.star : (n.type || 'note') === f));
    }
    function filterChips(list) {
      const types = [...new Set(list.map(n => n.type || 'note'))];
      const chip = (v, l) => `<button class="chip sm${S.nfilter === v ? ' on' : ''}" data-act="note-filter" data-v="${v}">${l}</button>`;
      return `<div class="np-filters">${chip('all', 'All')}${list.some(n => n.star) ? chip('star', ic('star', 12) + ' Starred') : ''}${types.map(t => chip(t, (NT[t] || NT.note).n)).join('')}</div>`;
    }

    function notesPanelHtml(vid) {
      const all = S.notes[vid] || [];
      const sorted = filterNotes(all).slice().sort((a, b) => a.timestamp - b.timestamp);
      return `
        <div class="np-head"><b>Notes <span class="cnt">${all.length}</span></b>
          <div class="np-btns"><button class="btn sm pri" data-act="note-new">${ic('plus', 16)} Add note</button>${all.length ? `<button class="btn sm" data-act="note-export" data-id="${vid}">${ic('share', 16)} Export</button>` : ''}</div>
        </div>
        <div class="np-sum"><span class="lbl" style="margin-top:0.2rem">${ic('sparkle', 12)} Summary \u2014 what did this lecture teach you?</span>
          <textarea id="nsum" data-vid="${vid}" rows="2" placeholder="Write the 2–3 lines you would tell a friend…">${esc(S.nsum[vid] || '')}</textarea></div>
        ${all.length ? filterChips(all) : ''}
        <div class="np-list">${sorted.length ? sorted.map(n => noteCard(vid, n)).join('') : `<p class="hint" style="padding:0.4rem 0">${all.length ? 'No notes match this filter.' : 'No notes yet. Tap “Add note” — the video pauses and the timestamp is pinned for you.'}</p>`}</div>`;
    }
    function renderNotes() {
      if (!S.cur) return;
      document.querySelectorAll('.notes-host').forEach(el => {
        const keep = document.activeElement && document.activeElement.id === 'nsum' && el.contains(document.activeElement);
        if (keep) return;
        el.innerHTML = notesPanelHtml(S.cur);
      });
      if ($('notes-n')) { const l = S.notes[S.cur] || []; $('notes-n').textContent = l.length; }
    }

    function openNoteEditor(vid, nid) {
      if (!vid) return;
      const ex = nid ? (S.notes[vid] || []).find(n => n.id === nid) : null;
      NE = { vid, nid: nid || null, ts: ex ? ex.timestamp : Math.floor(S.cur === vid ? S.t || 0 : 0), type: ex ? ex.type || 'note' : neLast, star: ex ? !!ex.star : false, resume: false };
      if (S.cur === vid && S.playing && !ex && !S.native) { try { yt.pauseVideo(); NE.resume = true; } catch (e) {} }
      const m = M(vid);
      openSheet(`
        <div class="ne-h"><div><div class="shead" style="padding:0">${ex ? 'Edit note' : 'New note'}</div><div class="ne-sub clamp1">${esc(m.title)}</div></div>
          <button class="ib nc-star${NE.star ? ' on' : ''}" id="ne-star" data-act="ne-star" aria-label="Star">${ic('star', 22)}</button></div>
        <div class="ne-ts">
          <button data-act="ne-ts" data-d="-10">−10s</button><button data-act="ne-ts" data-d="-5">−5s</button>
          <b id="ne-tsv" class="tnum">${fmt(NE.ts)}</b>
          <button data-act="ne-ts" data-d="5">+5s</button><button data-act="ne-ts" data-d="10">+10s</button>
          ${S.cur === vid ? '<button data-act="ne-now" class="now">Now</button>' : ''}
        </div>
        <div class="ne-types">${Object.keys(NT).map(k => `<button class="chip sm${NE.type === k ? ' on' : ''}" style="--nc:${NT[k].c}" data-act="ne-type" data-v="${k}">${NT[k].n}</button>`).join('')}</div>
        <div class="ne-tools">
          <button data-act="ne-fmt" data-f="b"><b>B</b></button><button data-act="ne-fmt" data-f="i"><i>I</i></button>
          <button data-act="ne-fmt" data-f="code">&lt;/&gt;</button><button data-act="ne-fmt" data-f="hl" aria-label="Highlight">${ic('hl', 16)}</button>
          <button data-act="ne-fmt" data-f="bul" aria-label="List">${ic('bul', 16)}</button><button data-act="ne-fmt" data-f="chk" aria-label="Task">${ic('task', 16)}</button>
          <button data-act="ne-fmt" data-f="quo" aria-label="Quote">${ic('quote', 15)}</button><button data-act="ne-fmt" data-f="hd">H</button>
        </div>
        <textarea id="ne-text" rows="6" placeholder="Write your note… use the toolbar for bold, lists and checklists"></textarea>
        <div class="ne-tpl"><span>Templates:</span>${[['def', 'Definition'], ['formula', 'Formula'], ['steps', 'Steps'], ['qa', 'Q & A'], ['cornell', 'Cornell']].map(t => `<button class="chip sm" data-act="ne-tpl" data-v="${t[0]}">${t[1]}</button>`).join('')}</div>
        <div class="srow"><button class="btn grow" data-act="sheet-close">Cancel</button><button class="btn red grow" data-act="ne-save">${ex ? 'Save changes' : 'Save note'}</button></div>`);
      sheetHook = () => { if (NE && NE.resume) { try { yt.playVideo(); } catch (e) {} } NE = null; };
      const ta = $('ne-text');
      if (ex) ta.value = ex.text;
      setTimeout(() => ta && ta.focus(), 120);
    }
    function neFormat(f) {
      const ta = $('ne-text');
      if (!ta) return;
      const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value, sel = v.slice(a, b);
      const wrap = (l, r) => { ta.setRangeText(l + (sel || 'text') + r, a, b, 'select'); };
      const line = pre => {
        const ls = v.lastIndexOf('\n', a - 1) + 1;
        ta.setRangeText(pre, ls, ls, 'end');
        ta.selectionStart = ta.selectionEnd = b + pre.length;
      };
      if (f === 'b') wrap('**', '**'); else if (f === 'i') wrap('*', '*'); else if (f === 'code') wrap('`', '`'); else if (f === 'hl') wrap('==', '==');
      else if (f === 'bul') line('- '); else if (f === 'chk') line('- [ ] '); else if (f === 'quo') line('> '); else if (f === 'hd') line('# ');
      ta.focus();
    }
    function saveNote() {
      const txt = ($('ne-text').value || '').trim();
      if (!txt || !NE) { toast('Write something first'); return; }
      const list = S.notes[NE.vid] || (S.notes[NE.vid] = []);
      if (NE.nid) {
        const n = list.find(x => x.id === NE.nid);
        if (n) Object.assign(n, { text: txt, timestamp: NE.ts, type: NE.type, star: NE.star, edited: Date.now() });
      } else list.unshift({ id: 'n' + Date.now(), timestamp: NE.ts, text: txt, type: NE.type, star: NE.star, at: Date.now() });
      neLast = NE.type;
      const tsSaved = NE.ts;
      sv(K.notes, S.notes);
      closeSheet();
      renderNotes(); renderNotesPage(); if (S.cur) updateWatchPage();
      toast('Note saved at ' + fmt(tsSaved || 0));
    }

    function notesMarkdown(ids) {
      return ids.map(id => {
        const m = M(id), list = (S.notes[id] || []).slice().sort((a, b) => a.timestamp - b.timestamp);
        let o = `# ${m.title}\n${m.channel} · https://youtu.be/${id}\n\n`;
        if (S.nsum[id]) o += `## Summary\n${S.nsum[id]}\n\n`;
        o += '## Notes\n' + list.map(n => `- [${fmt(n.timestamp)}](https://youtu.be/${id}?t=${n.timestamp}) **${(NT[n.type] || NT.note).n}${n.star ? ' ★' : ''}** — ${n.text.replace(/\n/g, '\n  ')}`).join('\n') + '\n';
        return o;
      }).join('\n---\n\n');
    }
    function exportNotesSheet(ids) {
      const text = notesMarkdown(ids);
      NE_EXPORT = { text, name: ids.length === 1 ? M(ids[0]).title.slice(0, 40) : 'Vaultube notes' };
      openSheet(`<div class="shead">Export notes</div>
        <button class="mi" data-act="exp-copy">${ic('list')}<span>Copy as Markdown</span></button>
        <button class="mi" data-act="exp-share">${ic('share')}<span>Share…</span></button>
        <button class="mi" data-act="exp-dl">${ic('download')}<span>Download .md file</span></button>`);
    }
    let NE_EXPORT = null;

    /* ---- Notes page (Library) ---- */
    S.npq = ''; S.npView = 'video'; S.npCol = {};
    function openNotes() { openSub({ kind: 'notes' }, '<div id="notespage" class="np"></div>'); renderNotesPage(); }
    function renderNotesPage() {
      const el = $('notespage');
      if (!el) return;
      const q = (S.npq || '').toLowerCase();
      const allIds = Object.keys(S.notes).filter(id => S.notes[id] && S.notes[id].length);
      const flat = allIds.flatMap(id => S.notes[id].map(n => ({ id, n })));
      const stars = flat.filter(x => x.n.star).length;
      let tAll = 0, tDone = 0;
      flat.forEach(x => String(x.n.text || '').split('\n').forEach(l => { const m = /^\s*- \[( |x)\]/i.exec(l); if (m) { tAll++; if (m[1].toLowerCase() === 'x') tDone++; } }));
      const f = S.nfilter;
      const ok = x => (f === 'all' || (f === 'star' ? x.n.star : (x.n.type || 'note') === f)) && (!q || x.n.text.toLowerCase().includes(q) || M(x.id).title.toLowerCase().includes(q));
      const counts = {}; flat.forEach(x => { const t = x.n.type || 'note'; counts[t] = (counts[t] || 0) + 1; });
      const chip = (v, l, c, col) => `<button class="chip sm${f === v ? ' on' : ''}" ${col ? `style="--nc:${col}"` : ''} data-act="note-filter" data-v="${v}">${l}${c != null ? `<em>${c}</em>` : ''}</button>`;
      const chips = `<div class="np-filters">${chip('all', 'All', flat.length)}${stars ? chip('star', ic('star', 12) + ' Starred', stars) : ''}${Object.keys(counts).map(t => chip(t, (NT[t] || NT.note).n, counts[t], (NT[t] || NT.note).c)).join('')}</div>`;
      const hadFocus = document.activeElement && document.activeElement.id === 'np-q';
      let body = '';
      if (S.npView === 'latest') {
        const list = flat.filter(ok).sort((a, b) => (b.n.at || 0) - (a.n.at || 0));
        body = list.length ? `<div class="np-list" style="padding:0 0.9rem">${list.map(x => noteCard(x.id, x.n, true, true)).join('')}</div>` : '';
      } else {
        const groups = allIds.map(id => ({ id, m: M(id), list: flat.filter(x => x.id === id && ok(x)).map(x => x.n).sort((a, b) => a.timestamp - b.timestamp) })).filter(g => g.list.length)
          .sort((a, b) => Math.max(...b.list.map(n => n.at || 0)) - Math.max(...a.list.map(n => n.at || 0)));
        body = groups.map(g => `
          <section class="ng${S.npCol[g.id] ? ' col' : ''}">
            <div class="ng-head" data-act="ng-toggle" data-id="${g.id}">
              <div class="ng-th" data-act="play" data-id="${g.id}" data-ctx="x"><img src="${thumb(g.id)}" loading="lazy" alt=""><span>${ic('play', 16)}</span></div>
              <div class="ng-t"><h3 class="clamp2">${esc(g.m.title)}</h3><p>${esc(g.m.channel)} · ${g.list.length} note${g.list.length === 1 ? '' : 's'}</p></div>
              <span class="ng-chev">${ic('chev', 20)}</span>
            </div>
            <div class="ng-body">
              ${S.nsum[g.id] ? `<div class="nsum-box"><b>${ic('sparkle', 12)} Summary</b>${esc(S.nsum[g.id])}</div>` : ''}
              <div class="tl">${g.list.map(n => `<div class="tl-i" style="--nc:${(NT[n.type] || NT.note).c}"><i class="tl-n"></i>${noteCard(g.id, n, true)}</div>`).join('')}</div>
            </div>
          </section>`).join('');
      }
      const none = !body;
      el.innerHTML = subHeader('Notes', allIds.length ? `<button class="btn sm" data-act="note-export-all">${ic('share', 16)} Export</button>` : '') + (allIds.length ? `
        <section class="np-hero">
          <div class="nh-stat" style="--c:var(--a5)"><span>${ic('note', 16)}</span><b class="tnum">${flat.length}</b><small>Notes</small></div>
          <div class="nh-stat" style="--c:var(--a1)"><span>${ic('layers', 16)}</span><b class="tnum">${allIds.length}</b><small>Videos</small></div>
          <div class="nh-stat" style="--c:var(--a3)"><span>${ic('star', 16)}</span><b class="tnum">${stars}</b><small>Starred</small></div>
          <div class="nh-stat" style="--c:var(--a4)"><span>${ic('task', 16)}</span><b class="tnum">${tAll ? tDone + '/' + tAll : '0'}</b><small>Tasks done</small></div>
        </section>
        ${tAll ? `<div class="np-prog"><div><span>Revision progress</span><b class="tnum">${Math.round((tDone / tAll) * 100)}%</b></div><div class="pbar"><i style="width:${(tDone / tAll) * 100}%"></i></div></div>` : ''}
        <div class="sbox">${ic('search', 20)}<input id="np-q" placeholder="Search notes, formulas, videos…" value="${esc(S.npq)}" autocomplete="off"></div>
        ${chips}
        <div class="seg np-view"><button class="${S.npView === 'video' ? 'on' : ''}" data-act="np-view" data-v="video">By video</button><button class="${S.npView === 'latest' ? 'on' : ''}" data-act="np-view" data-v="latest">Latest first</button></div>` : '') +
        (none ? `<div class="np-empty"><div class="emp-ic">${ic('note', 30)}</div><h3>${allIds.length ? 'No notes match' : 'Your notes live here'}</h3><p>${allIds.length ? 'Try another search or filter.' : 'Open any video, tap <b>Notes</b> and pin timestamped notes, key points, formulas and doubts. They\u2019ll be organised by video here.'}</p></div>` : body) + '<div style="height:1.5rem"></div>';
      if (hadFocus) { const i = $('np-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
    }


    /* Player Touch Controls, Double-Tap Seek & Swipe Gestures */
    (function () {
      let lastTap = 0, tapT = null;
      const sh = $('shield');
      sh.addEventListener('click', e => {
        if (S.pmode === 'mini') { expandPlayer(); return; }
        const r = sh.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, now = Date.now();
        if (now - lastTap < 300) {
          clearTimeout(tapT);
          lastTap = 0;
          if (x < 0.38) { seekRel(-SEEK()); badge('bl'); }
          else if (x > 0.62) { seekRel(SEEK()); badge('br'); }
          else togglePlay();
          return;
        }
        lastTap = now;
        clearTimeout(tapT);
        tapT = setTimeout(() => {
          const c = $('ctrl');
          const layer = $('player-layer');
          if (c.classList.contains('show')) {
            c.classList.remove('show');
            layer.classList.remove('hud-on');
          } else showCtrls();
        }, 280);
      });

      function badge(id) { const b = $(id); b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); }

      function bindScrubBar(el) {
        if (!el) return;
        const pos = e => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); };
        el.addEventListener('pointerdown', e => {
          if (!S.d) return;
          isDrag = true;
          el.classList.add('drag');
          try { el.setPointerCapture(e.pointerId); } catch (x) {}
          S.t = pos(e) * S.d;
          paintProg();
          clearTimeout(ctrlTimer);
        });
        el.addEventListener('pointermove', e => { if (!isDrag) return; S.t = pos(e) * S.d; paintProg(); });
        el.addEventListener('pointerup', e => { if (!isDrag) return; isDrag = false; el.classList.remove('drag'); seekTo(pos(e) * S.d); showCtrls(); });
        el.addEventListener('pointercancel', () => { isDrag = false; el.classList.remove('drag'); });
      }
      bindScrubBar($('scrub'));
      bindScrubBar($('th-scrub'));

      ['th-top', 'th-bot'].forEach(id => {
        const el = $(id);
        if (el) {
          el.addEventListener('click', e => {
            if (!e.target.closest('button') && !e.target.closest('#th-scrub')) {
              const layer = $('player-layer');
              const c = $('ctrl');
              if (layer.classList.contains('hud-on')) {
                layer.classList.remove('hud-on');
                c.classList.remove('show');
              } else showCtrls();
            } else {
              showCtrls();
            }
          });
        }
      });

      // Swipe gestures for minimize / fullscreen / mini-player dismiss
      const L = $('player-layer');
      let g = null;
      const rst = () => { L.style.transition = 'transform .16s,opacity .16s'; L.style.transform = ''; L.style.opacity = ''; setTimeout(() => { L.style.transition = ''; L.style.animation = ''; }, 180); };
      const dismiss = (tx, ty) => { L.style.transition = 'transform .18s,opacity .18s'; L.style.transform = `translate(${tx}%,${ty}%)`; L.style.opacity = '0'; setTimeout(() => { L.style.transition = ''; L.style.transform = ''; L.style.opacity = ''; L.style.animation = ''; stopPlayer(); }, 190); };

      L.addEventListener('touchstart', e => {
        if (S.pmode === 'none' || e.touches.length !== 1 || S.native || e.target.closest('#scrub') || e.target.closest('#th-scrub')) return;
        const mini = S.pmode === 'mini';
        if (!mini && !e.target.closest('#pv')) return;
        const t = e.touches[0];
        g = { x: t.clientX, y: t.clientY, t0: Date.now(), dx: 0, dy: 0, mode: mini ? 'mini' : (inFs() ? 'fs' : 'port') };
      }, { passive: true });

      L.addEventListener('touchmove', e => {
        if (!g) return;
        const t = e.touches[0];
        g.dx = t.clientX - g.x;
        g.dy = t.clientY - g.y;
        if (g.mode === 'port' && g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx)) {
          L.style.animation = 'none';
          L.style.transition = 'none';
          L.style.transform = `translateY(${g.dy}px)`;
        } else if (g.mode === 'mini' && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy)) {
          L.style.transition = 'none';
          L.style.transform = `translateX(${g.dx}px)`;
          L.style.opacity = String(1 - Math.min(0.8, Math.abs(g.dx) / 300));
        }
      }, { passive: true });

      L.addEventListener('touchend', () => {
        if (!g) return;
        const d = g;
        g = null;
        const ax = Math.abs(d.dx), ay = Math.abs(d.dy), fast = Date.now() - d.t0 < 320;
        const up = d.dy < -(fast ? 26 : 60) && ay > ax, down = d.dy > (fast ? 26 : 60) && ay > ax, side = ax > (fast ? 40 : 90) && ax > ay;
        if (d.mode === 'port') {
          if (down) { L.style.transition = 'transform .16s'; L.style.transform = 'translateY(100%)'; setTimeout(() => { L.style.transition = ''; L.style.transform = ''; L.style.animation = ''; if (stack.length && stack[stack.length - 1].kind === 'player') closeTopLayer(); else playerClose(); }, 160); }
          else if (up) { rst(); toggleFs(); }
          else rst();
        } else if (d.mode === 'fs') {
          if (up) setFill(true);
          else if (down) { if (S.fill) setFill(false); else toggleFs(); }
        } else {
          if (up) { rst(); expandPlayer(); }
          else if (side) dismiss(d.dx > 0 ? 100 : -100, 0);
          else if (down) dismiss(0, 100);
          else rst();
        }
      }, { passive: true });
    })();

    /* ==================== NAVIGATION & ENDLESS SCROLL ==================== */
    function setTab(t, init) {
      if (!init) S.scroll[S.tab] = window.scrollY;
      S.tab = t;
      $('view-home').hidden = t !== 'home';
      $('view-subs').hidden = t !== 'subs';
      $('view-library').hidden = t !== 'library';

      $('nav-home').classList.toggle('on', t === 'home');
      $('nav-subs').classList.toggle('on', t === 'subs');
      $('nav-library').classList.toggle('on', t === 'library');
      $('hdr').classList.toggle('no-chips', t !== 'home');
      $('hdr').classList.remove('hide');

      if (t === 'library') renderLibrary();
      else if (t === 'subs') renderSubscriptions();
      else if (!init && S.chip === 'All') { buildAllFeed(); renderFeed(); }
      window.scrollTo(0, S.scroll[t] || 0);
    }

    function renderVisible() {
      if (subOpen && S.sub) {
        const k = S.sub.kind;
        if (k === 'hist') renderHistList();
        else if (k === 'pl') renderPlPage();
        else if (k === 'notes') renderNotesPage();
        else if (k === 'analytics') renderAnalytics();
      }
      if (S.tab === 'library') renderLibrary();
      else if (S.tab === 'subs') renderSubscriptions();
      else if (!H.loading) renderFeed();
      if (S.cur && $('upnext')) renderUpNext();
    }

    const MORE = ['', ' latest', ' one shot', ' lecture', ' explained', ' tutorial'];
    let moreN = 0, moreBusy = false;
    async function loadMore() {
      if (moreBusy || H.loading || H.err || S.tab !== 'home' || subOpen || S.pmode === 'full' || S.pmode === 'theater') return;
      const tp = S.chip === 'All' ? [...new Set(Object.entries(profile().cat).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]).concat(S.set.topics))].slice(0, 8) : [S.chip];
      if (moreN >= tp.length * (MORE.length - 1)) return;
      moreBusy = true;
      const my = homeTok, base = tp[moreN % tp.length], suf = MORE[1 + Math.floor(moreN / tp.length)];
      moreN++;
      try {
        const r = await onlineSearch(base + suf);
        if (my !== homeTok) return;
        const seen = new Set(H.ids.concat(H.recs || []));
        const ids = ingest(r, S.chip === 'All' ? base : S.chip).filter(id => !seen.has(id));
        if (ids.length) {
          H.recs = (H.recs || []).concat(ids);
          ctxLists.home = H.ids.concat(H.recs);
          const hm = histMap();
          $('feed-more').insertAdjacentHTML('beforeend', ids.map(id => cardHtml(id, 'home', hm)).join(''));
        }
      } catch (e) { moreN = 1e9; }
      finally { moreBusy = false; }
    }

    (function () {
      let lastY = 0, tk = false;
      const h = $('hdr');
      addEventListener('scroll', () => {
        if (tk) return;
        tk = true;
        requestAnimationFrame(() => {
          tk = false;
          const y = Math.max(0, scrollY);
          if (y > lastY + 10 && y > 140) h.classList.add('hide');
          else if (y < lastY - 8 || y < 60) h.classList.remove('hide');
          lastY = y;
        });
      }, { passive: true });
    })();

    /* ==================== EVENT ROUTER ==================== */
    const A = {
      play(el) { const id = el.dataset.id; playVideo(id, { queue: ctxLists[el.dataset.ctx] || [id] }); },
      menu(el) { const h = el.closest('[data-ctx]'); openMenu(el.dataset.id, h && h.dataset.ctx, h && h.dataset.pl); },
      chip(el) { S.chip = el.dataset.v; if (S.chip !== 'All') { S.set.hits[S.chip] = (S.set.hits[S.chip] || 0) + 1; sv(K.set, S.set); } renderChips(); loadHome(); window.scrollTo(0, 0); },
      'goto-api'() { openSettings('api'); },
      retry() { loadHome(); },
      'home-top'() { closeSheet(); closeSub(); setTab('home'); if (S.chip !== 'All') { S.chip = 'All'; renderChips(); loadHome(); } window.scrollTo({ top: 0, behavior: 'smooth' }); },
      'tab-home'() { closeSheet(); closeSub(); if (S.tab === 'home') { refreshHome(); return; } setTab('home'); },
      'tab-subs'() { closeSheet(); closeSub(); setTab('subs'); },
      'tab-library'() { closeSheet(); closeSub(); setTab('library'); },
      search() { openSearch(); },
      add() { if (sheetOpen && !$('add-body')) closeSheet(); openAdd(); },
      settings() { openSettings(); },
      'open-analytics'() { if (sheetOpen) closeSheet(); openAnalytics(); },
      'an-range'(el) { S.anRange = el.dataset.v; renderAnalytics(); },
      'an-bar'(el) {
        document.querySelectorAll('.an-chart .bc').forEach(b => b.classList.toggle('sel', b === el));
        const t = $('an-tip'); if (t) t.textContent = el.dataset.tip;
      },
      import() { openAdd(null, 'playlist'); },
      'open-import'() { openAdd(null, 'playlist'); },
      'open-import-link'() { openImport($('add-url').value); },
      'new-playlist'() { newPlaylistSheet(); },
      'open-history'() { openHistory(); },
      'open-pl'(el) { openPlaylist(el.dataset.id); },
      'open-notes'() { openNotes(); },
      'sub-back'() { closeSub(); },
      'sheet-close'() { closeSheet(); },
      'confirm-ok'() { const f = confirmFn; confirmFn = null; closeSheet(); f && f(); },
      'undo-pl-rm'() { if (window.undoPlRemove) window.undoPlRemove(); },

      'open-channel'(el) { openChannelPage(el.dataset.ch); },
      'open-cur-channel'() { if (S.cur) { const ch = M(S.cur).channel; minimize(); openChannelPage(ch); } },
      'subs-refresh'() { renderSubscriptions(true); },
      'manage-subs'() { manageSubsSheet(); },
      unsub(el) { toggleSubscribe(el.dataset.ch); closeSheet(); renderSubscriptions(); toast('Unsubscribed'); },
      'ch-tab'(el) {
        const v = el.dataset.v;
        document.querySelectorAll('.ch-tabs button').forEach(b => b.classList.toggle('on', b === el));
        $('ch-videos').hidden = v !== 'videos';
        $('ch-about').hidden = v !== 'about';
      },
      'toggle-cur-sub'() {
        if (!S.cur) return;
        const ch = M(S.cur).channel;
        const on = toggleSubscribe(ch);
        updateWatchPage();
        toast(on ? `Subscribed to ${ch}` : `Unsubscribed from ${ch}`);
      },
      'toggle-ch-sub'(el) {
        const ch = el.dataset.ch;
        const on = toggleSubscribe(ch);
        el.textContent = on ? 'Subscribed' : 'Subscribe';
        el.classList.toggle('on', on);
        toast(on ? `Subscribed to ${ch}` : `Unsubscribed from ${ch}`);
      },

      'st-toggle'() {
        ST.running = !ST.running;
        if (ST.running && !stInterval) startStudyTimer(ST.videoId || S.cur);
        if (!ST.running) persistStudyStats();
        updateStudyBarUI();
      },
      'st-break'() {
        ST.mode = ST.mode === 'lecture' ? 'break' : 'lecture';
        ST.running = true;
        persistStudyStats();
        updateStudyBarUI();
        toast(ST.mode === 'break' ? 'Break timer started' : 'Resumed lecture timer');
      },

      'hist-menu'() { openSheet(`<button class="mi" data-act="hist-clear">${ic('trash')}<span>Clear all watch history</span></button>`); },
      'hist-clear'() { confirmSheet('Clear watch history', 'Remove all watched videos and progress?', 'Clear', () => { S.hist = []; sv(K.hist, S.hist); renderVisible(); toast('History cleared'); }); },

      'pl-toggle-reord'() { S.reordering = !S.reordering; renderPlPage(); },
      'pl-move'(el) {
        const p = PL(S.sub && S.sub.id);
        if (!p) return;
        const idx = +el.dataset.idx, dir = +el.dataset.dir, to = idx + dir;
        if (to < 0 || to >= p.items.length) return;
        const tmp = p.items[idx];
        p.items[idx] = p.items[to];
        p.items[to] = tmp;
        sv(K.pl, S.playlists);
        renderPlPage();
      },
      'pl-menu'() { plMenuSheet(S.sub.id); },
      'pl-row-menu'(el) { plMenuSheet(el.dataset.id); },
      'pl-play'() { const p = PL(S.sub.id); if (p && p.items.length) playVideo(p.items[0], { queue: p.items, start: 0 }); },
      'pl-shuffle'() { const p = PL(S.sub.id); if (!p || !p.items.length) return; const q = p.items.slice().sort(() => Math.random() - 0.5); playVideo(q[0], { queue: q, start: 0 }); },
      'pl-add'() { openAdd(null, 'video', S.sub && PL(S.sub.id) && S.sub.id !== 'liked' ? S.sub.id : 'wl'); },

      'undo-noint'() {
        const l = lastNoInt; if (!l) return; const s = S.set;
        s.blockV = s.blockV.filter(x => x !== l.id);
        if (s.blockCh[l.ch]) { s.blockCh[l.ch]--; if (s.blockCh[l.ch] <= 0) delete s.blockCh[l.ch]; }
        if (s.blockCat[l.cat]) { s.blockCat[l.cat]--; if (s.blockCat[l.cat] <= 0) delete s.blockCat[l.cat]; }
        sv(K.set, S.set); lastNoInt = null; toast('Restored'); if (S.tab === 'home') loadHome();
      },
      'unblock-all'() { S.set.blockV = []; S.set.blockCh = {}; S.set.blockCat = {}; sv(K.set, S.set); renderSettings(); toast('Hidden items restored'); },
      'q-like'(el) { togglePl('liked', el.dataset.id); el.classList.toggle('on', inPl('liked', el.dataset.id)); },
      'q-save'(el) { togglePl('wl', el.dataset.id); el.classList.toggle('on', inPl('wl', el.dataset.id)); },
      'sched-q'(el) { const d = new Date(); const v = el.dataset.v; if (v === 'h1') d.setHours(d.getHours() + 1); else if (v === 't20') { d.setHours(20, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); } else { d.setDate(d.getDate() + 1); d.setHours(7, 0, 0, 0); } const i = $('sched-at'); if (i) i.value = toLocalInput(d); },
      'sched-save'() { const i = $('sched-at'), at = i && i.value ? new Date(i.value).getTime() : 0; if (!at || at < Date.now() + 30000) { toast('Pick a time in the future'); return; } const l = ld('tv3_sched', []); l.push({ v: SCH.id, at, done: false }); sv('tv3_sched', l); askNotif(); closeSheet(); toast('Reminder set for ' + new Date(at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })); },
      'sched-gcal'() { const i = $('sched-at'), at = i && i.value ? new Date(i.value) : null; if (!at) { toast('Pick a time first'); return; } const f = d => d.toISOString().replace(/[-:]|\.\d{3}/g, ''), e = new Date(at.getTime() + 3600000); const u = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('Watch: ' + (M(SCH.id).title || 'lecture')) + '&dates=' + f(at) + '/' + f(e) + '&details=' + encodeURIComponent('https://youtu.be/' + SCH.id); window.open(u, '_blank'); },
      'sched-ics'() { const i = $('sched-at'), at = i && i.value ? new Date(i.value) : null; if (!at) { toast('Pick a time first'); return; } const p = n => String(n).padStart(2, '0'), f = d => `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`, e = new Date(at.getTime() + 3600000); const ttl = M(SCH.id).title || 'lecture'; downloadTextFile('vaultube-reminder.ics', ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vaultube//EN', 'BEGIN:VEVENT', 'UID:' + SCH.id + at.getTime() + '@vaultube', 'DTSTAMP:' + f(new Date()), 'DTSTART:' + f(at), 'DTEND:' + f(e), 'SUMMARY:Watch: ' + ttl.replace(/[,;\n]/g, ' '), 'DESCRIPTION:https://youtu.be/' + SCH.id, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Time to study', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'), 'text/calendar'); toast('Open the file to add it to your calendar'); },
      'sched-del'(el) { const [v, at] = el.dataset.k.split('|'); sv('tv3_sched', ld('tv3_sched', []).filter(x => !(x.v === v && String(x.at) === at))); renderSettings(); },
      'notif-on'() { askNotif(true); setTimeout(renderSettings, 600); },
      mi(el) {
        const k = el.dataset.k, { id, ctx, pl } = menuCtx || {};
        if (k === 'save') saveSheet(id);
        else if (k === 'wl') { const a = togglePl('wl', id); closeSheet(); renderVisible(); toast(a ? 'Saved to Watch later' : 'Removed from Watch later'); }
        else if (k === 'channel') { closeSheet(); openChannelPage(M(id).channel); }
        else if (k === 'share') { closeSheet(); shareVideo(id); }
        else if (k === 'sched') schedSheet(id);
        else if (k === 'int') { markInterest(id, true); closeSheet(); }
        else if (k === 'noint') { markInterest(id, false); closeSheet(); }
        else if (k === 'rmhist') { S.hist = S.hist.filter(h => h.v !== id); sv(K.hist, S.hist); closeSheet(); renderVisible(); toast('Removed from history'); }
        else if (k === 'rmpl') { const p = PL(pl); if (p) { p.items = p.items.filter(x => x !== id); sv(K.pl, S.playlists); } closeSheet(); renderVisible(); toast('Removed from playlist'); }
      },
      mi2(el) {
        const k = el.dataset.k, id = menuCtx && menuCtx.plid, p = PL(id);
        if (!p) return;
        if (k === 'pl-rename') renameSheet(id);
        else if (k === 'pl-delete') confirmSheet('Delete playlist', `Delete “${p.name}”?`, 'Delete', () => { S.playlists = S.playlists.filter(x => x.id !== id); sv(K.pl, S.playlists); if (S.sub && S.sub.kind === 'pl' && S.sub.id === id) closeSub(); renderVisible(); toast('Playlist deleted'); });
        else if (k === 'pl-clear') confirmSheet('Clear playlist', `Remove all videos from “${p.name}”?`, 'Clear', () => { p.items = []; sv(K.pl, S.playlists); renderVisible(); });
      },
      savepl(el) { const id = menuCtx.id; const a = togglePl(el.dataset.id, id); saveSheet(id); renderVisible(); if (S.cur) updateWatchPage(); toast(a ? 'Saved to ' + PL(el.dataset.id).name : 'Removed'); },
      'savepl-new'() { newPlaylistSheet(menuCtx && menuCtx.id); },
      paste() { navigator.clipboard.readText().then(t => { if (t) { $('add-url').value = t.trim(); onAddInput(t); } }).catch(() => toast('Paste link into the text box')); },
      'add-save'() { addSubmit(false); },
      'add-play'() { addSubmit(true); },
      'imp-paste'() { navigator.clipboard.readText().then(t => { if (t) { $('imp-text').value = t; loadImport(); } }).catch(() => toast('Paste links into the box')); },
      'imp-load'() { loadImport(); },
      'imp-go'() { executeImport(); },
      'imp-all'() { imp.items.forEach(i => i.on = true); renderImpList(); },
      'imp-none'() { imp.items.forEach(i => i.on = false); renderImpList(); },
      'q-go'(el) { runSearch(el.dataset.v); },
      'q-fill'(el) { const i = $('sq'); if (i) { i.value = el.dataset.v; i.focus(); renderSearchRecent(i.value); } },
      'set-theme'(el) { setTheme(el.dataset.v); renderSettings(); },
      'set-pm'(el) { S.set.playerMode = el.dataset.v; sv(K.set, S.set); renderSettings(); if (S.cur) updateWatchPage(); },
      'set-tog'(el) { const k = el.dataset.k; S.set[k] = !(S.set[k] !== false); sv(K.set, S.set); renderSettings(); if (k === 'hideWatched' && S.tab === 'home') loadHome(); },
      'set-seek'(el) { S.set.seek = +el.dataset.v; sv(K.set, S.set); renderSettings(); },
      'goal-custom'() {
        const v = parseFloat(($('goal-in').value || '').replace(',', '.'));
        if (!(v >= 0.25 && v <= 24)) { toast('Enter hours between 0.25 and 24'); return; }
        S.set.goal = Math.round(v * 60); sv(K.set, S.set); renderSettings(); toast('Daily goal set to ' + fmtDurHuman(S.set.goal * 60));
      },
      'set-goal'(el) { S.set.goal = +el.dataset.v; sv(K.set, S.set); renderSettings(); },
      'goto-goal'() { openSettings('goal'); },
      'tg-add'() { tgDraft = { t: '', h: 10 }; tgSheet(); },
      'tg-pick'(el) { tgDraft.t = el.dataset.t; tgSheet(); },
      'tg-h'(el) { tgDraft.h = +el.dataset.v; tgSheet(); },
      'tg-save'() {
        if (!tgDraft.t) { toast('Pick a subject first'); return; }
        S.set.targets = (S.set.targets || []).filter(x => x.t !== tgDraft.t).concat([{ t: tgDraft.t, h: tgDraft.h }]);
        sv(K.set, S.set); closeSheet(); toast('Target saved'); renderAnalytics();
      },
      'tg-del'(el) { S.set.targets = (S.set.targets || []).filter(x => x.t !== el.dataset.t); sv(K.set, S.set); toast('Target removed'); renderAnalytics(); },
      'ui-auto'() { S.set.ui = 'auto'; sv(K.set, S.set); window.TV_UI(); renderSettings(); },
      'topic-del'(el) { S.set.topics = S.set.topics.filter(t => t !== el.dataset.v); if (!S.set.topics.length) S.set.topics = DEF_TOPICS.slice(); if (S.chip === el.dataset.v) { S.chip = 'All'; loadHome(); } sv(K.set, S.set); renderChips(); renderSettings(); },
      'forget-all'() { wipeStep(0); },
      'wipe-next'() { wipeStep(wipeI + 1); },
      'reset-interests'() { confirmSheet('Reset recommendations', 'Forget which topics you tapped? Your history and notes are not touched.', 'Reset', () => { S.set.hits = {}; sv(K.set, S.set); toast('Interests reset'); }); },
      'api-test'() {
        S.set.apiKey = ($('api-in').value || '').trim(); sv(K.set, S.set); apiDead = 0;
        const st = $('api-status');
        if (!hasKey()) { st.textContent = 'That does not look like an API key.'; return; }
        st.textContent = 'Testing…';
        apiGet('videos', { part: 'id', id: 'dQw4w9WgXcQ' }).then(() => { st.textContent = 'Key works. Search, channels and subscriptions will use it.'; S.chip === 'All' && loadHome(); }, e => { st.textContent = 'Key problem: ' + (e.message || 'Key rejected') + (e.reason === 'API_KEY_HTTP_REFERRER_BLOCKED' ? ' (remove the website restriction or add this site)' : ''); });
      },
      backup() {
        const data = {};
        Object.values(K).forEach(k => { if (k !== K.cache) { const v = localStorage.getItem(k); if (v != null) data[k] = v; } });
        const n = Object.keys(data).length;
        downloadTextFile('vaultube-backup-' + todayKey() + '.json', JSON.stringify({ app: 'tubevault', v: 2, at: Date.now(), data }), 'application/json');
        toast('Backup saved (' + n + ' data sets) \u2014 check your Downloads folder');
      },
      restore() { $('restore-in').click(); },
      'clear-cache'() { Object.keys(PC).forEach(k => delete PC[k]); scache.clear(); localStorage.removeItem(K.cache); localStorage.removeItem(K.subfeed); toast('Search cache cleared'); },
      'reset-all'() { confirmSheet('Erase everything', 'This deletes playlists, history, notes, subscriptions and settings on this device. It cannot be undone.', 'Erase', () => { window.__wiped = true; Object.values(K).forEach(k => localStorage.removeItem(k)); location.reload(); }); },
      'pick-photo'() { const i = $('photo-in'); if (i) i.click(); },
      'rm-photo'() { delete S.set.photo; sv(K.set, S.set); renderSettings(); if (S.tab === 'library') renderLibrary(); },
      'install-pwa'() {
        if (deferredInstallPrompt) { deferredInstallPrompt.prompt(); deferredInstallPrompt = null; }
        else toast('In Chrome open the menu, then Install app (needs the https link)');
      },

      'c-theater'() { toggleTheaterLayout(); },
      'ad-manual'() { S.adManual = Date.now() + 45000; adMoving = 0; setAd(true); toast('Ad mode: tap YouTube\u2019s Skip button'); },
      'wp-more'() { if (!S.cur) return; const m = M(S.cur); openSheet(`<div class="shead">${esc(m.title)}</div><p class="hint" style="margin:0 0 .6rem">${esc([m.channel, m.views, m.pub].filter(Boolean).join(' \u2022 '))}</p><div class="desc-sheet">${esc(m.desc || 'No description available yet.')}</div>`); },
      'th-more-menu'() { if (S.cur) openMenu(S.cur, 'x'); },
      'open-notes-sheet'() { if (!S.cur) return; openSheet('<div class="shead">Notes</div><div class="notes-host"></div>'); renderNotes(); },
      'open-queue-sheet'() {
        if (!S.cur) return;
        const i = S.queue.indexOf(S.cur);
        let ids = i > -1 ? S.queue.slice(i + 1) : [];
        if (ids.length < 6) {
          personalFeed().concat(H.ids, H.recs || []).forEach(x => { if (x !== S.cur && !ids.includes(x)) ids.push(x); });
        }
        ids = ids.slice(0, 15);
        ctxLists.upnext = [S.cur].concat(ids);
        const hm = histMap();
        openSheet(`<div class="shead">Up Next</div>` + (ids.length ? ids.map(id => rowHtml(id, 'upnext', hm)).join('') : `<p class="hint">No queued videos.</p>`));
      },

      'c-min'() { showCtrls(); if (stack.length && stack[stack.length - 1].kind === 'player') closeTopLayer(); else playerClose(); },
      'c-play'() { togglePlay(); showCtrls(); },
      'c-rew'() { seekRel(-SEEK()); showCtrls(); },
      'c-fwd'() { seekRel(SEEK()); showCtrls(); },
      'c-prev'() { const i = S.queue.indexOf(S.cur); if (S.t > 3 || i < 1) seekTo(0); else playVideo(S.queue[i - 1], { keepQueue: true }); showCtrls(); },
      'c-next'() { playNext(); showCtrls(); },
      'c-auto'() { S.set.autoplay = S.set.autoplay === false; sv(K.set, S.set); $('c-auto').innerHTML = `<span class="tg${S.set.autoplay !== false ? ' on' : ''}"><i></i></span>`; showCtrls(); },
      'c-speed'() { showCtrls(); openSheet(`<div class="shead">Playback speed</div>` + [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(r => `<button class="mi" data-act="set-rate" data-v="${r}">${ic(S.rate === r ? 'check' : 'clock')}<span>${r === 1 ? 'Normal' : r + 'x'}</span></button>`).join('')); },
      'set-rate'(el) { S.rate = +el.dataset.v; if (playerReady) try { yt.setPlaybackRate(S.rate); } catch (e) {} closeSheet(); toast('Speed ' + S.rate + 'x'); },
      'c-fs'() { toggleFs(); showCtrls(); },
      'fb-next'() { embIdx++; if (S.cur) { playFallback(S.cur, S.t); toast('Switching playback server...'); } },
      expand() { expandPlayer(); },
      'mini-play'() { togglePlay(); },
      'mini-close'() { stopPlayer(); },
      'b-like'() { if (!S.cur) return; const a = togglePl('liked', S.cur); updateWatchPage(); toast(a ? 'Added to Liked videos' : 'Removed from Liked videos'); },
      'b-save'() { if (S.cur) { menuCtx = { id: S.cur }; saveSheet(S.cur); } },
      'b-share'() { if (S.cur) shareVideo(S.cur); },
      'b-more'() { if (S.cur) openMenu(S.cur, 'x'); },
      'b-notes'() { const b = $('notes-box'); b.hidden = !b.hidden; if (!b.hidden) renderNotes(); syncNotesCard(); },
      'note-new'() { openNoteEditor(S.cur); },
      'np-view'(el) { S.npView = el.dataset.v; renderNotesPage(); },
      'ng-toggle'(el) { const g = el.closest('.ng'); if (!g) return; const c = g.classList.toggle('col'); S.npCol[el.dataset.id] = c; },
      'note-filter'(el) { S.nfilter = el.dataset.v; renderNotes(); renderNotesPage(); },
      'note-star'(el) { const n = (S.notes[el.dataset.id] || []).find(x => x.id === el.dataset.nid); if (n) { n.star = !n.star; sv(K.notes, S.notes); renderNotes(); renderNotesPage(); } },
      'note-menu'(el) {
        NM = { id: el.dataset.id, nid: el.dataset.nid };
        openSheet(`<div class="shead">Note</div><button class="mi" data-act="nm-edit">${ic('note')}<span>Edit</span></button><button class="mi" data-act="nm-copy">${ic('list')}<span>Copy text</span></button><button class="mi" data-act="nm-del" style="color:var(--red)">${ic('trash')}<span>Delete</span></button>`);
      },
      'nm-edit'() { openNoteEditor(NM.id, NM.nid); },
      'nm-copy'() { const n = (S.notes[NM.id] || []).find(x => x.id === NM.nid); closeSheet(); if (n) navigator.clipboard.writeText(n.text).then(() => toast('Copied'), () => toast('Copy failed')); },
      'nm-del'() { const id = NM.id; S.notes[id] = (S.notes[id] || []).filter(n => n.id !== NM.nid); if (!S.notes[id].length) delete S.notes[id]; sv(K.notes, S.notes); closeSheet(); renderNotes(); renderNotesPage(); if (S.cur) updateWatchPage(); toast('Note deleted'); },
      'note-chk'(el) {
        const n = (S.notes[el.dataset.id] || []).find(x => x.id === el.dataset.nid);
        if (!n) return;
        const lines = n.text.split('\n'), i = +el.dataset.line;
        lines[i] = /\[x\]/i.test(lines[i]) ? lines[i].replace(/\[x\]/i, '[ ]') : lines[i].replace('[ ]', '[x]');
        n.text = lines.join('\n');
        sv(K.notes, S.notes); renderNotes(); renderNotesPage();
      },
      'seek-ts'(el) { const id = el.dataset.id; if (id && id !== S.cur) playVideo(id, { queue: [id], start: +el.dataset.ts }); else seekTo(+el.dataset.ts); },
      'note-go'(el) { const id = el.dataset.id, ts = +el.dataset.ts; if (S.cur === id) { if (S.pmode === 'mini') expandPlayer(); seekTo(ts); } else playVideo(id, { queue: [id], start: ts }); },
      'note-export'(el) { exportNotesSheet([el.dataset.id]); },
      'note-export-all'() { exportNotesSheet(Object.keys(S.notes).filter(id => S.notes[id] && S.notes[id].length)); },
      'exp-copy'() { navigator.clipboard.writeText(NE_EXPORT.text).then(() => { closeSheet(); toast('Notes copied as Markdown'); }, () => toast('Copy failed')); },
      'exp-share'() { const t = NE_EXPORT; closeSheet(); if (navigator.share) navigator.share({ title: t.name, text: t.text }).catch(() => {}); else navigator.clipboard.writeText(t.text).then(() => toast('Copied (sharing not supported here)')); },
      'exp-dl'() { downloadTextFile((NE_EXPORT.name.replace(/[^\w]+/g, '_') || 'notes') + '.md', NE_EXPORT.text, 'text/markdown'); closeSheet(); },
      'ne-star'() { if (!NE) return; NE.star = !NE.star; $('ne-star').classList.toggle('on', NE.star); },
      'ne-ts'(el) { if (!NE) return; NE.ts = Math.max(0, NE.ts + +el.dataset.d); $('ne-tsv').textContent = fmt(NE.ts); if (S.cur === NE.vid) seekTo(NE.ts); },
      'ne-now'() { if (!NE) return; NE.ts = Math.floor(S.t || 0); $('ne-tsv').textContent = fmt(NE.ts); },
      'ne-type'(el) { if (!NE) return; NE.type = el.dataset.v; document.querySelectorAll('.ne-types .chip').forEach(c => c.classList.toggle('on', c.dataset.v === NE.type)); },
      'ne-fmt'(el) { neFormat(el.dataset.f); },
      'ne-tpl'(el) { const ta = $('ne-text'); ta.value = (ta.value ? ta.value + '\n\n' : '') + NTPL[el.dataset.v]; ta.focus(); },
      'ne-save'() { saveNote(); },
      'add-tab'(el) { ADD.tab = el.dataset.v; renderAddTab(); },
      'as-add'(el) {
        const id = el.dataset.id, p = PL($('as-pl').value);
        if (!p) return;
        const i = p.items.indexOf(id);
        if (i > -1) p.items.splice(i, 1); else p.items.unshift(id);
        sv(K.pl, S.playlists);
        el.classList.toggle('on', i === -1);
        el.innerHTML = ic(i === -1 ? 'check' : 'plus', 20);
        renderVisible();
      },
      'clip-x'() { dismissClip(); },
      'clip-go'() { acceptClip(true); },
      'clip-save'() { acceptClip(false); }
    };

    const FORMS = {
      topic() { const v = ($('topic-in').value || '').trim(); if (!v) return; if (!S.set.topics.some(t => t.toLowerCase() === v.toLowerCase())) { S.set.topics.push(v); sv(K.set, S.set); renderChips(); } renderSettings(); },
      addsearch() { ADD.lastQ = $('as-q').value; addSearch(ADD.lastQ); },
      search() { runSearch($('sq').value); },
      newpl() {
        const n = $('pl-name').value.trim();
        if (!n) return;
        const p = { id: 'pl-' + Date.now(), name: n, items: [] };
        S.playlists.push(p);
        const then = menuCtx && menuCtx.thenId;
        if (then) { p.items.unshift(then); ensureMeta(then); }
        const bulk = [...new Set((($('pl-links') && $('pl-links').value) || '').split(/[\s,]+/).map(extractId).filter(Boolean))];
        bulk.forEach(id => { if (!p.items.includes(id)) { p.items.push(id); ensureMeta(id); } });
        sv(K.pl, S.playlists);
        if (then) saveSheet(then);
        else closeSheet();
        renderVisible();
        toast('Created “' + n + '”');
      },
      rename() {
        const n = $('pl-name').value.trim(), p = PL(menuCtx && menuCtx.plid);
        if (!n || !p) return;
        p.name = n;
        sv(K.pl, S.playlists);
        closeSheet();
        renderVisible();
      }
    };

    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const f = A[el.dataset.act];
      if (f) { e.preventDefault(); e.stopPropagation(); f(el, e); }
    });
    document.addEventListener('submit', e => {
      const f = e.target.dataset && e.target.dataset.form;
      if (f && FORMS[f]) { e.preventDefault(); FORMS[f](); }
    });
    let sumT = null;
    document.addEventListener('input', e => {
      const t = e.target;
      if (t.id === 'add-url') onAddInput(t.value);
      else if (t.id === 'hist-q') renderHistList();
      else if (t.id === 'sq') renderSearchRecent(t.value);
      else if (t.id === 'imp-name') imp.name = t.value;
      else if (t.id === 'np-q') { S.npq = t.value; renderNotesPage(); }
      else if (t.id === 'nsum') { S.nsum[t.dataset.vid] = t.value; clearTimeout(sumT); sumT = setTimeout(() => sv(K.nsum, S.nsum), 500); }
      else if (t.id === 'ui-range') { S.set.ui = parseFloat(t.value); sv(K.set, S.set); window.TV_UI(); const b = document.querySelector('.ui-row b'); if (b) b.textContent = Math.round(S.set.ui * 100) + '%'; }
    });
    document.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset && t.dataset.i !== undefined && t.type === 'checkbox') {
        imp.items[+t.dataset.i].on = t.checked;
        renderImpList();
      } else if (t.id === 'imp-dest') {
        $('imp-name').hidden = t.value !== 'new';
      } else if (t.id === 'add-pl') {
        const n = $('add-newpl'); n.hidden = t.value !== '__new'; if (!n.hidden) n.focus();
      } else if (t.id === 'as-pl') {
        if (ADD.lastQ) addSearch(ADD.lastQ);
      } else if (t.id === 'api-in') {
        S.set.apiKey = t.value.trim(); sv(K.set, S.set); apiDead = 0;
      } else if (t.id === 'restore-in' && t.files && t.files[0]) {
        t.files[0].text().then(txt => {
          const d = JSON.parse(txt);
          if (!d || d.app !== 'tubevault' || !d.data) throw 0;
          const ent = Object.entries(d.data).filter(([k, v]) => Object.values(K).includes(k) && typeof v === 'string');
          if (!ent.length) throw 0;
          window.__wiped = true; /* stop autosave from overwriting the restored data while reloading */
          ent.forEach(([k, v]) => localStorage.setItem(k, v));
          t.value = ''; toast('Restored ' + ent.length + ' data sets \u2014 reloading');
          setTimeout(() => location.reload(), 700);
        }).catch(() => { t.value = ''; toast('That file is not a Vaultube backup'); });
      } else if (t.id === 'topics-in') {
        const l = [...new Set(t.value.split(',').map(x => x.trim()).filter(Boolean))].slice(0, 14);
        S.set.topics = l.length ? l : DEF_TOPICS.slice();
        sv(K.set, S.set);
        if (S.chip !== 'All' && !S.set.topics.includes(S.chip)) S.chip = 'All';
        renderChips();
      } else if (t.id === 'name-in') {
        S.set.name = t.value.trim() || 'Student';
        sv(K.set, S.set);
        if (S.tab === 'library') renderLibrary();
      } else if (t.id === 'handle-in') {
        S.set.handle = t.value.trim() || '@tubevault';
        sv(K.set, S.set);
        if (S.tab === 'library') renderLibrary();
      } else if (t.id === 'set-autostudy') {
        S.set.autoStudy = t.checked;
        sv(K.set, S.set);
      } else if (t.id === 'photo-in' && t.files && t.files[0]) {
        const r = new FileReader();
        r.onload = () => {
          const im = new Image();
          im.onload = () => {
            const s = 256, c = document.createElement('canvas');
            c.width = c.height = s;
            const m = Math.min(im.width, im.height);
            c.getContext('2d').drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, s, s);
            S.set.photo = c.toDataURL('image/jpeg', 0.82);
            sv(K.set, S.set);
            openSettings();
            if (S.tab === 'library') renderLibrary();
            toast('Profile photo updated');
          };
          im.src = r.result;
        };
        r.readAsDataURL(t.files[0]);
      }
    });

    /* ==================== CLIPBOARD & NATIVE YOUTUBE SHARE HANDLER ==================== */
    let clipCand = null, clipDismissed = '';
    async function checkClip() {
      if (!navigator.clipboard || !navigator.clipboard.readText || S.pmode === 'full' || S.pmode === 'theater' || sheetOpen) return;
      try {
        const t = ((await navigator.clipboard.readText()) || '').trim();
        if (!t || t.length > 400 || t === clipDismissed || !/youtu\.?be|youtube\.com/i.test(t)) return;
        const pl = extractPlaylistId(t), id = extractId(t);
        if (!pl && !id) return;
        if (id && S.cur === id && !pl) return;
        clipCand = { t, pl: pl && (!id || /playlist\?/.test(t)) ? pl : null, id };
        showClip();
      } catch (e) {}
    }

    function showClip() {
      const c = clipCand, el = $('clip');
      if (!c) return;
      el.className = 'on';
      if (c.pl) {
        el.innerHTML = `<div class="cl"><div class="avatar" style="background:var(--red)">${ic('download', 20)}</div><div class="ct" style="flex:1"><h4>YouTube playlist copied</h4><p>Import all videos into a folder</p></div><button class="btn pri" data-act="clip-go">Import</button><button class="ib" data-act="clip-x">${ic('close', 20)}</button></div>`;
      } else {
        ensureMeta(c.id);
        el.innerHTML = `<div class="cl"><img src="${thumb(c.id)}" alt=""><div class="ct" style="flex:1;min-width:0"><h4>${esc(M(c.id).title)}</h4><p>YouTube link detected</p></div><button class="btn" data-act="clip-save">Save</button><button class="btn red" data-act="clip-go">Play</button><button class="ib" data-act="clip-x">${ic('close', 20)}</button></div>`;
      }
    }

    function dismissClip() { if (clipCand) clipDismissed = clipCand.t; $('clip').className = ''; clipCand = null; }
    function acceptClip(play) {
      const c = clipCand;
      if (!c) return;
      dismissClip();
      if (c.pl) { openImport('https://www.youtube.com/playlist?list=' + c.pl); return; }
      const wl = PL('wl');
      if (!wl.items.includes(c.id)) { wl.items.unshift(c.id); sv(K.pl, S.playlists); }
      ensureMeta(c.id, true);
      renderVisible();
      if (play) playVideo(c.id, { queue: [c.id] });
      else toast('Saved to Watch later');
    }

    function handleShare() {
      try {
        const p = new URLSearchParams(location.search);
        const raw = [p.get('url'), p.get('text'), p.get('v') ? 'https://www.youtube.com/watch?v=' + p.get('v') : '', p.get('list') ? 'https://www.youtube.com/playlist?list=' + p.get('list') : ''].filter(Boolean).join(' ').trim();
        if (!raw) return false;
        if (history.replaceState) history.replaceState({}, document.title, location.pathname);
        const pl = extractPlaylistId(raw), id = extractId(raw);
        if (pl && (!id || /playlist\?/.test(raw))) {
          setTab('library');
          openImport('https://www.youtube.com/playlist?list=' + pl);
          return true;
        }
        if (id) {
          const wl = PL('wl');
          if (!wl.items.includes(id)) { wl.items.unshift(id); sv(K.pl, S.playlists); }
          if (p.get('title')) setMeta(id, { title: p.get('title') });
          ensureMeta(id, true);
          renderVisible();
          menuCtx = { id };
          saveSheet(id);
          toast('Saved shared YouTube video to Watch later!');
          return true;
        }
      } catch (e) {}
      return false;
    }

    /* ==================== BOOTSTRAP ==================== */
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { saveProg(); flushStudySession(); saveUsage(); }
      else setTimeout(checkClip, 300);
    });
    window.addEventListener('pagehide', () => { saveProg(); flushStudySession(); saveUsage(); });

    function syncExternal() {
      try {
        const pl = ld(K.pl, null), mt2 = ld(K.meta, null);
        if (Array.isArray(pl)) {
          const a = JSON.stringify(S.playlists), b = JSON.stringify(pl);
          if (a !== b) { S.playlists = pl; ['wl', 'liked'].forEach(id => { if (!S.playlists.some(p => p.id === id)) S.playlists.unshift({ id, name: id === 'wl' ? 'Watch later' : 'Liked videos', sys: true, items: [] }); }); }
        }
        if (mt2 && typeof mt2 === 'object') Object.keys(mt2).forEach(id => { if (!S.meta[id] || (!S.meta[id].title && mt2[id].title)) S.meta[id] = Object.assign({}, S.meta[id] || {}, mt2[id]); });
        if (!(S.cur && S.playing)) renderVisible();
      } catch (e) {}
    }
    window.addEventListener('storage', e => { if (e.key === K.pl || e.key === K.meta) syncExternal(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncExternal(); });

    function init() {
      load();
      $('subs-top-btn').innerHTML = ic('subs'); updTimeChip();
      $('search-btn').innerHTML = ic('search');
      $('add-btn').innerHTML = ic('plus');

      $('nav-home').innerHTML = ic('home') + '<span>Home</span>';
      $('nav-subs').innerHTML = ic('subs') + '<span>Subscriptions</span>';
      $('nav-library').innerHTML = ic('library') + '<span>You</span>';

      updateStudyBarUI();
      $('ad-min').innerHTML = ic('chev', 24);
      $('c-prev').innerHTML = ic('prev', 24);
      $('c-rew').innerHTML = ic('rew', 28);
      $('c-fwd').innerHTML = ic('fwd', 28);
      $('c-next').innerHTML = ic('next', 24);
      $('c-speed').innerHTML = ic('gear', 21);
      $('c-fs').innerHTML = ic('fs', 20);
      $('mini-close').innerHTML = ic('close', 22);

      applyTheme();
      initUsage();
      renderChips();
      setTab('home', true);
      loadHome();

      const sp = $('splash');
      if (sp && document.documentElement.classList.contains('nosplash')) sp.remove();
      else if (sp) { setTimeout(() => { sp.classList.add('out'); setTimeout(() => sp.remove(), 600); }, 1700); }
      if (new URLSearchParams(location.search).get('add')) { try { history.replaceState({}, '', location.pathname); } catch (e) {} setTimeout(() => openAdd(), 700); }
      else if (!handleShare()) setTimeout(checkClip, 500);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) loadMore(); }, { rootMargin: '600px' }).observe($('feed-end'));
      }
      setInterval(() => {
        if (S.cur) {
          const m = S.meta[S.cur];
          if (!m || !m.title || !m.desc || !AV[m.channel]) ensureMeta(S.cur, true);
        }
      }, 20000);
    }

    function totalAppSec() { return Object.values(S.usage || {}).reduce((a, r) => a + (r.app || 0), 0); }
    function updTimeChip() { const c = $('time-chip'); if (c) c.textContent = fmtDurHuman((S.usage[todayKey()] || {}).app || 0); }
    setInterval(updTimeChip, 15000); setTimeout(updTimeChip, 500);
    /* ==================== SCHEDULE / REMINDERS ==================== */
    let SCH = { id: '' };
    const toLocalInput = d => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
    function schedSheet(id) {
      SCH = { id };
      const d = new Date(Date.now() + 3600000);
      openSheet(`<div class="shead clamp2">Schedule: ${esc(M(id).title)}</div>
        <div class="seg"><button data-act="sched-q" data-v="h1">In 1 hour</button><button data-act="sched-q" data-v="t20">Tonight 8 pm</button><button data-act="sched-q" data-v="t7">Tomorrow 7 am</button></div>
        <input id="sched-at" type="datetime-local" value="${toLocalInput(d)}" style="width:100%;margin:.7rem 0;padding:.7rem;border-radius:12px;border:1px solid var(--line,#ddd);font:inherit">
        <div class="srow"><button class="btn grow" data-act="sched-gcal">Google Calendar</button><button class="btn grow" data-act="sched-ics">.ics file</button></div>
        <button class="btn red" data-act="sched-save" style="width:100%;margin-top:.5rem">Remind me in Vaultube</button>
        <p class="hint" style="font-size:.78rem">Reminders arrive as a notification. For a guaranteed alert even when Vaultube is closed, also tap Add to calendar.</p>`);
    }
    function askNotif(force) {
      if (!('Notification' in window)) { if (force) toast('Notifications are not supported here'); return; }
      if (Notification.permission === 'default') Notification.requestPermission();
      else if (force && Notification.permission === 'denied') toast('Notifications are blocked \u2014 enable them in Android Settings > Apps > Vaultube');
    }
    function notifyDue(s) {
      const title = 'Time to study', body = M(s.v).title || 'Your scheduled lecture is ready', opt = { body, icon: './icon-192.png', badge: './icon-192.png', tag: 'vt-' + s.v + s.at, requireInteraction: true, vibrate: [200, 100, 200], data: { v: s.v } };
      toast('Time to watch: ' + body);
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const fb = () => { try { new Notification(title, opt); } catch (e) {} };
      if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then(r => (r ? r.showNotification(title, opt) : fb())).catch(fb); else fb();
    }
    function fireDue() {
      const l = ld('tv3_sched', []), now = Date.now(); let ch = false;
      l.forEach(s => { if (!s.done && s.at <= now) { s.done = true; ch = true; notifyDue(s); } });
      if (ch) sv('tv3_sched', l.filter(s => !s.done || now - s.at < 864e5));
    }
    function schedHtml() {
      const l = ld('tv3_sched', []).filter(s => !s.done).sort((a, b) => a.at - b.at);
      const perm = 'Notification' in window ? Notification.permission : 'unsupported';
      const st = perm === 'granted' ? '' : `<button class="btn" data-act="notif-on" style="width:100%;margin-bottom:.5rem">Turn on notifications</button>`;
      return st + (l.length ? l.map(s => `<div class="srow2"><div class="st"><b class="clamp2">${esc(M(s.v).title || s.v)}</b><small>${esc(new Date(s.at).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</small></div><button class="link" data-act="sched-del" data-k="${s.v}|${s.at}">Cancel</button></div>`).join('') : '<p class="hint">Nothing scheduled. Use \u22EE \u2192 Schedule to watch on any lecture.</p>');
    }
    /* pull-down to refresh on Home */
    (function () {
      const st = document.createElement('style'); st.textContent = 'body{overscroll-behavior-y:contain}#ptr{position:fixed;left:50%;top:0;transform:translate(-50%,-60px);z-index:60;background:var(--bg2,#222);color:var(--tx,#fff);border:1px solid rgba(128,128,128,.35);padding:.45rem .9rem;border-radius:999px;font-size:.8rem;box-shadow:0 4px 14px rgba(0,0,0,.25);pointer-events:none;transition:transform .15s}';
      document.head.appendChild(st);
      const ind = document.createElement('div'); ind.id = 'ptr'; document.body.appendChild(ind);
      let y0 = 0, pull = 0, on = false;
      const show = (y, t) => { ind.textContent = t; ind.style.transform = 'translate(-50%,' + (y - 60 + 70) + 'px)'; };
      document.addEventListener('touchstart', e => { const h = $('view-home'); on = S.tab === 'home' && window.scrollY <= 0 && h && h.contains(e.target); pull = 0; y0 = e.touches[0].clientY; }, { passive: true });
      document.addEventListener('touchmove', e => { if (!on) return; const dy = e.touches[0].clientY - y0; if (dy <= 0 || window.scrollY > 0) { pull = 0; ind.style.transform = 'translate(-50%,-60px)'; return; } pull = Math.min(dy * 0.5, 80); show(pull, pull >= 60 ? 'Release to refresh' : 'Pull to refresh'); }, { passive: true });
      document.addEventListener('touchend', () => { if (!on) return; on = false; ind.style.transform = 'translate(-50%,-60px)'; if (pull >= 60) refreshHome(); pull = 0; }, { passive: true });
    })();
    setInterval(fireDue, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) fireDue(); });
    setTimeout(fireDue, 2000);

    init();
