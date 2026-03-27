/* === CONFIG (generated) === */
  const COLLECTOR_BASE = "http://localhost:8002";
  const TENANT_ID = "2";
  const SITE_TOKEN = "C23bLSndtg3N_K7EmrOFk_k4LnNGVzkX";
  const TRACKER_VERSION = "1.1.0";
  const API_BASE = "http://localhost:8001";
  const SESSION_IDLE_MS = 30 * 60 * 1000;
  const SESSION_MAX_MS = 4 * 60 * 60 * 1000;
  const REFERRER_NEW_SESSION = false;
  const BATCH_FLUSH_MS = 5000;
  const BATCH_MAX = 10;

  function uuid() {
    return "evt_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch (e) {
      return "";
    }
  }

  function safeJsonParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function getAnonId() {
    const key = "_dmw_anon_id";
    try {
      let v = localStorage.getItem(key);
      if (!v) {
        v = "anon_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(key, v);
      }
      return v;
    } catch (e) {
      return "anon_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
  }

  function getSession() {
    const key = "_dmw_session";
    const now = Date.now();
    const ref = document.referrer || "";
    let raw = null;
    try { raw = localStorage.getItem(key); } catch (e) { raw = null; }
    let data = raw ? safeJsonParse(raw, null) : null;
    let needsNew = false;
    if (!data || !data.id || !data.start || !data.last) {
      needsNew = true;
    } else {
      const idle = now - data.last;
      const age = now - data.start;
      if (idle > SESSION_IDLE_MS || age > SESSION_MAX_MS) needsNew = true;
      if (REFERRER_NEW_SESSION && ref && data.ref && ref !== data.ref) needsNew = true;
    }
    if (needsNew) {
      data = {
        id: "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
        start: now,
        last: now,
        ref: ref
      };
    } else {
      data.last = now;
    }
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
    return data.id;
  }
  function getParams() {
    const sp = new URLSearchParams(location.search);
    const g = k => sp.get(k) || undefined;
    return { utm: { source:g('utm_source'), medium:g('utm_medium'), campaign:g('utm_campaign'), term:g('utm_term'), content:g('utm_content') },
              clid: { gclid:g('gclid'), fbclid:g('fbclid'), ttclid:g('ttclid') } };
  }

  function getIdentity() {
    const id = window.DMWIdentity || window.dmwIdentity || null;
    if (!id || typeof id !== 'object') return {};
    const pick = (k) => id[k] || id[k && k.toLowerCase ? k.toLowerCase() : k] || undefined;
    return {
      customer_id: pick('customer_id'),
      user_id: pick('user_id'),
      user_key: pick('user_key')
    };
  }

  function loadConfig() {
    const cacheKey = `_dmw_funnel_config_${SITE_TOKEN}`;
    const ttlMs = 60 * 60 * 1000;
    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = safeJsonParse(cachedRaw, null);
        if (cached && cached.config && cached.fetched_at && (Date.now() - cached.fetched_at) < ttlMs) {
          window.__dmwConfig = cached.config;
          return;
        }
      }
    } catch (e) {}

    const url = `${API_BASE}/api/track/config?site_token=${encodeURIComponent(SITE_TOKEN)}`;
    fetch(url, { method: 'GET', credentials: 'omit' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        window.__dmwConfig = data;
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ config: data, fetched_at: Date.now() }));
        } catch (e) {}
      })
      .catch(() => {});
  }

  loadConfig();

  function buildEvent(type, extra = {}, method = "explicit", confidence = 1.0) {
    const identity = getIdentity();
    const sessionId = identity.session_id || getSession();
    const configVersion = (window.__dmwConfig && window.__dmwConfig.config_version) || (window.dmwConfig && window.dmwConfig.config_version) || undefined;
    return {
      t: type,
      event_type: type,
      event_id: uuid(),
      event_version: "1.0",
      event_timestamp: nowIso(),
      tenantId: TENANT_ID,
      siteToken: SITE_TOKEN,
      url: location.href,
      ref: document.referrer || null,
      sid: sessionId,
      anonymous_id: getAnonId(),
      source: {
        channel: "js_tracker",
        method: method,
        tracker_version: TRACKER_VERSION
      },
      source_channel: "js_tracker",
      source_method: method,
      tracker_version: TRACKER_VERSION,
      config_version: configVersion,
      confidence: confidence,
      data_completeness: extra && extra.data_completeness ? extra.data_completeness : undefined,
      ...getParams(),
      ...identity,
      ...extra
    };
  }

  const queue = [];
  let flushTimer = null;
  let retryTimer = null;

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushQueue();
    }, BATCH_FLUSH_MS);
  }

  function enqueue(event) {
    queue.push({ event, attempts: 0 });
    if (queue.length >= BATCH_MAX) {
      flushQueue();
      return;
    }
    scheduleFlush();
  }

  function sendSingle(payload, onError) {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      try {
        navigator.sendBeacon(`${COLLECTOR_BASE}/collect`, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
        return;
      } catch (e) {}
    }
    fetch(`${COLLECTOR_BASE}/collect`, {
      method:'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body,
      keepalive:true
    }).then((res) => {
      if (!res.ok && onError) onError();
    }).catch(() => {
      if (onError) onError();
    });
  }

  function scheduleRetry() {
    if (retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      flushQueue();
    }, 1500);
  }

  function flushQueue() {
    if (!queue.length) return;
    const batch = queue.splice(0, BATCH_MAX);
    batch.forEach((item) => {
      sendSingle(item.event, () => {
        item.attempts += 1;
        if (item.attempts < 3) {
          queue.unshift(item);
          scheduleRetry();
        }
      });
    });
  }

  function sendEvent(type, extra = {}, method = "explicit", confidence = 1.0) {
    const payload = buildEvent(type, extra, method, confidence);
    enqueue(payload);
  }

  window.__dmwTrackPageview = (extra = {}) => sendEvent('pageview', { spa: true, ...extra }, "explicit", 1.0);
  sendEvent('pageview', {}, "explicit", 1.0);
  (function(){
    let engaged=false;
    const markEngaged=()=>{ if(engaged) return; engaged=true; sendEvent('engaged'); };
    const markBounce =()=>{ if(engaged) return; sendEvent('bounce'); };
    setTimeout(markEngaged, 30_000);
    window.addEventListener('scroll', ()=>{ const s=(window.scrollY+window.innerHeight)/(document.documentElement.scrollHeight||1); if(s>=0.75) markEngaged(); }, { passive:true });
    window.addEventListener('beforeunload', markBounce);
  })();
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushQueue();
    }
  });

  /* === ECOMMERCE AUTO-DETECTION === */
  (function(){
    let productViewSent = false;
    const normalize = (v) => (v || '').toString().trim();
    const toNumber = (v) => {
      if (v === null || v === undefined) return undefined;
      const cleaned = normalize(v).replace(/[^0-9.]/g, '');
      const n = parseFloat(cleaned);
      return Number.isFinite(n) ? n : undefined;
    };

    const getMeta = (selector) => {
      const el = document.querySelector(selector);
      return el ? el.getAttribute('content') || el.getAttribute('value') || el.textContent : null;
    };

    const detectProductMeta = () => {
      const urlParams = new URLSearchParams(window.location.search || '');
      const urlProductId = normalize(
        urlParams.get('product_id') ||
        urlParams.get('productId') ||
        urlParams.get('sku') ||
        urlParams.get('id') ||
        urlParams.get('variant')
      );
      const urlProductName = normalize(urlParams.get('name') || urlParams.get('product') || urlParams.get('title'));

      const meta = {
        sku: normalize(getMeta('[itemprop="sku"]')) || normalize(getMeta('meta[property="product:retailer_item_id"]')),
        product_id: null,
        name: normalize(getMeta('[itemprop="name"]')) || normalize(getMeta('meta[property="og:title"]')) || document.title,
        category: normalize(getMeta('[itemprop="category"]')),
        price: toNumber(getMeta('[itemprop="price"]')) || toNumber(getMeta('meta[property="product:price:amount"]')),
        currency: normalize(getMeta('[itemprop="priceCurrency"]')) || normalize(getMeta('meta[property="product:price:currency"]')),
        source_hint: null
      };

      // Config-driven selectors (highest confidence)
      try {
        const cfg = window.__dmwConfig || {};
        if (cfg.selectors) {
          if (cfg.selectors.product_id) {
            const el = document.querySelector(cfg.selectors.product_id);
            const val = el ? (el.getAttribute('content') || el.getAttribute('value') || el.textContent) : null;
            if (val) {
              meta.product_id = normalize(val);
              meta.source_hint = 'config_selector';
            }
          }
          if (!meta.sku && cfg.selectors.sku) {
            const el = document.querySelector(cfg.selectors.sku);
            const val = el ? (el.getAttribute('content') || el.getAttribute('value') || el.textContent) : null;
            if (val) meta.sku = normalize(val);
          }
          if (!meta.price && cfg.selectors.price) {
            const el = document.querySelector(cfg.selectors.price);
            const val = el ? (el.getAttribute('content') || el.getAttribute('value') || el.textContent) : null;
            if (val) meta.price = toNumber(val);
          }
        }
      } catch (e) {}

      // JSON-LD Product schema
      try {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (let i = 0; i < scripts.length; i++) {
          const raw = scripts[i].textContent || '';
          if (!raw) continue;
          const json = JSON.parse(raw);
          const node = Array.isArray(json) ? json.find(n => n && n['@type'] === 'Product') : json;
          if (node && node['@type'] === 'Product') {
            meta.sku = meta.sku || normalize(node.sku || node.mpn || node.productID);
            meta.product_id = meta.product_id || normalize(node.productID || node.sku || node.mpn);
            meta.name = meta.name || normalize(node.name);
            if (!meta.price && node.offers && node.offers.price) {
              meta.price = toNumber(node.offers.price);
            }
            if (!meta.currency && node.offers && node.offers.priceCurrency) {
              meta.currency = normalize(node.offers.priceCurrency);
            }
            if (!meta.source_hint) meta.source_hint = 'json_ld';
            break;
          }
        }
      } catch (e) {}

      // OpenGraph / meta tags
      if (!meta.sku) meta.sku = normalize(getMeta('meta[property="product:retailer_item_id"]')) || meta.sku;
      if (!meta.product_id) meta.product_id = normalize(getMeta('meta[property="product:retailer_item_id"]')) || meta.product_id;
      if (!meta.source_hint && (meta.product_id || meta.sku)) meta.source_hint = 'meta';

      // URL params fallback
      if (!meta.product_id && urlProductId) {
        meta.product_id = urlProductId;
        meta.source_hint = meta.source_hint || 'url_param';
      }
      if (!meta.name && urlProductName) meta.name = urlProductName;

      if (!meta.product_id) {
        meta.product_id = meta.sku || urlProductId || null;
      }
      return meta;
    };

    const matchPatternList = (patterns, value) => {
      if (!patterns || !patterns.length) return false;
      const hay = (value || '').toString();
      for (let i = 0; i < patterns.length; i++) {
        const p = patterns[i];
        if (!p) continue;
        if (p.startsWith('/') && p.endsWith('/') && p.length > 2) {
          try {
            const re = new RegExp(p.slice(1, -1), 'i');
            if (re.test(hay)) return true;
          } catch (e) {}
        } else if (hay.toLowerCase().includes(p.toLowerCase())) {
          return true;
        }
      }
      return false;
    };

    const isProductPage = (meta) => {
      const cfg = window.__dmwConfig || {};
      if (matchPatternList(cfg.product_url_patterns, location.href || '')) return true;
      return Boolean(meta.sku || meta.price || (meta.name && /product|buy|shop/i.test(meta.name)));
    };

    const sendProductView = (meta, confidence = 0.7) => {
      if (productViewSent) return;
      productViewSent = true;
      if (meta.source_hint === 'config_selector') confidence = Math.max(confidence, 0.9);
      if (meta.source_hint === 'json_ld') confidence = Math.max(confidence, 0.85);
      if (meta.source_hint === 'meta') confidence = Math.max(confidence, 0.8);
      if (meta.source_hint === 'url_param') confidence = Math.max(confidence, 0.7);
      sendEvent('product_view', {
        sku: meta.sku,
        product_id: meta.product_id || meta.sku,
        name: meta.name,
        category: meta.category,
        price: meta.price,
        currency: meta.currency,
        commerce: {
          product_id: meta.product_id || meta.sku,
          value: meta.price,
          currency: meta.currency
        },
        data_completeness: meta.product_id || meta.sku || meta.price ? 'medium' : 'low'
      }, "heuristic", confidence);
    };

    // Expose manual helpers
    window.sendProductView = (data = {}) => sendEvent('product_view', data);
    window.sendAddToCart = (data = {}) => sendEvent('add_to_cart', data);

    // Auto product page detection
    try {
      const meta = detectProductMeta();
      if (isProductPage(meta)) {
        sendProductView(meta, 0.7);
      }
    } catch(e) {}

    // Apply config rules
    const applyConfigRules = () => {
      const cfg = window.__dmwConfig || {};
      const url = location.href || '';
      if (matchPatternList(cfg.cart_url_patterns, url)) {
        sendEvent('add_to_cart', { data_completeness: 'low' }, "explicit", 0.85);
      }
      if (matchPatternList(cfg.checkout_url_patterns, url)) {
        sendEvent('begin_checkout', { data_completeness: 'low' }, "explicit", 0.85);
      }
      if (cfg.selectors && cfg.selectors.product_view) {
        const el = document.querySelector(cfg.selectors.product_view);
        if (el) {
          sendEvent('product_view', { data_completeness: 'medium' }, "explicit", 0.9);
        }
      }
      if (cfg.selectors && cfg.selectors.add_to_cart) {
        const el = document.querySelector(cfg.selectors.add_to_cart);
        if (el) {
          el.addEventListener('click', () => sendEvent('add_to_cart', { data_completeness: 'low' }, "explicit", 0.9), true);
        }
      }
      if (cfg.selectors && cfg.selectors.begin_checkout) {
        const el = document.querySelector(cfg.selectors.begin_checkout);
        if (el) {
          el.addEventListener('click', () => sendEvent('begin_checkout', { data_completeness: 'low' }, "explicit", 0.9), true);
        }
      }
    };

    applyConfigRules();

    // Auto add-to-cart click detection
    const cartKeywords = ['add to cart', 'add-to-cart', 'addtocart', 'add cart', 'add to bag', 'add to basket', 'cart'];
    const checkoutKeywords = ['checkout', 'begin checkout', 'start checkout', 'proceed to checkout'];
    const purchaseKeywords = ['purchase', 'complete purchase', 'place order', 'pay now', 'confirm order', 'buy now'];
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;
      const el = target.closest('button, a, input[type="button"], input[type="submit"]');
      if (!el) return;
      const text = normalize(el.textContent || el.value || '');
      const idClass = normalize([el.id, el.className].join(' '));
      const combined = `${text} ${idClass}`.toLowerCase();
      const meta = detectProductMeta();
      const data = {
        sku: el.dataset.sku,
        product_id: el.dataset.productId,
        name: el.dataset.name,
        category: el.dataset.category,
        price: toNumber(el.dataset.price),
        quantity: toNumber(el.dataset.quantity) || 1
      };
      if (!data.product_id) {
        data.product_id = meta.product_id || meta.sku;
      }
      data.sku = data.sku || meta.sku;
      data.name = data.name || meta.name;
      data.category = data.category || meta.category;
      data.price = data.price || meta.price;
      data.currency = meta.currency;
      if (data.price && data.quantity) {
        data.total = Math.round((data.price * data.quantity + Number.EPSILON) * 100) / 100;
      }

      if (cartKeywords.some(k => combined.includes(k))) {
        sendEvent('add_to_cart', { ...data, commerce: { product_id: data.sku || data.product_id, value: data.price, currency: data.currency, quantity: data.quantity } }, "heuristic", 0.6);
        return;
      }
      if (checkoutKeywords.some(k => combined.includes(k))) {
        sendEvent('begin_checkout', { ...data, commerce: { product_id: data.sku || data.product_id, value: data.price, currency: data.currency, quantity: data.quantity } }, "heuristic", 0.6);
        return;
      }
      if (purchaseKeywords.some(k => combined.includes(k))) {
        sendEvent('purchase', { ...data, commerce: { product_id: data.sku || data.product_id, value: data.price, currency: data.currency, quantity: data.quantity } }, "heuristic", 0.6);
      }
    }, true);
  })();
