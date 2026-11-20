/* === CONFIG (generated) === */
  const COLLECTOR_BASE = "https://dmwithai.selftrainai.com/api/collector";
  const API_BASE = "https://dmwithai.selftrainai.com";
  const TENANT_ID = "416";
  const SITE_TOKEN = "J0ei3EOmiqVKGEISwx3lK6kK3BDMEq3q";
  const TRACKER_VERSION = "1.1.0";

  function sid() {
    // Use localStorage for cross-session persistence (better for returning user detection)
    // Falls back to sessionStorage if localStorage unavailable
    const k = "_our_sid";
    let storage = typeof localStorage !== 'undefined' ? localStorage : sessionStorage;
    let v = storage.getItem(k);
    if (!v) {
      v = Math.random().toString(36).slice(2)+Date.now().toString(36);
      try {
        storage.setItem(k, v);
      } catch(e) {
        // Fallback to sessionStorage if localStorage fails (e.g., private mode)
        if (storage !== sessionStorage) {
          storage = sessionStorage;
          storage.setItem(k, v);
        }
      }
    }
    return v;
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
      user_key: pick('user_key'),
      session_id: pick('session_id'),
      anonymous_id: pick('anonymous_id'),
      user_fingerprint: pick('user_fingerprint')
    };
  }
  function sendEvent(type, extra = {}) {
    const cfgVersion = (window.__dmwConfig && window.__dmwConfig.config_version) ? window.__dmwConfig.config_version : undefined;
    const payload = {
      t:type,
      tenantId:TENANT_ID,
      siteToken:SITE_TOKEN,
      url:location.href,
      ref:document.referrer||null,
      sid:sid(),
      config_version: cfgVersion,
      source: { channel: "js_tracker", method: extra.source_method || "explicit", tracker_version: TRACKER_VERSION },
      source_channel: "js_tracker",
      source_method: extra.source_method || "explicit",
      tracker_version: TRACKER_VERSION,
      ...getParams(),
      ...getIdentity(),
      ...extra
    };
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${COLLECTOR_BASE}/collect`, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
      return;
    }
    fetch(`${COLLECTOR_BASE}/collect`, {
      method:'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body,
      keepalive:true
    }).catch(()=>{});
  }
  window.__dmwTrackPageview = (extra = {}) => sendEvent('pageview', { spa: true, ...extra });
  sendEvent('pageview');
  (function(){
    let engaged=false;
    const markEngaged=()=>{ if(engaged) return; engaged=true; sendEvent('engaged'); };
    const markBounce =()=>{ if(engaged) return; sendEvent('bounce'); };
    setTimeout(markEngaged, 30_000);
    window.addEventListener('scroll', ()=>{ const s=(window.scrollY+window.innerHeight)/(document.documentElement.scrollHeight||1); if(s>=0.75) markEngaged(); }, { passive:true });
    window.addEventListener('beforeunload', markBounce);
  })();

  /* === ECOMMERCE AUTO-DETECTION === */
  (function(){
    const configKey = `_dmw_cfg_${SITE_TOKEN}`;
    const loadConfig = async () => {
      try {
        const cached = localStorage.getItem(configKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.config_version && parsed.payload) {
            window.__dmwConfig = parsed.payload;
          }
        }
      } catch (e) {}
      try {
        const res = await fetch(`${API_BASE}/api/track/config?site_token=${SITE_TOKEN}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'omit'
        });
        if (res.ok) {
          const payload = await res.json();
          window.__dmwConfig = payload;
          try {
            localStorage.setItem(configKey, JSON.stringify({
              config_version: payload.config_version,
              updated_at: payload.updated_at,
              payload
            }));
          } catch (e) {}
        }
      } catch (e) {}
    };
    loadConfig();
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

    const inferCurrency = (raw) => {
      const s = (raw || '').toString();
      if (s.includes('€')) return 'EUR';
      if (s.includes('£')) return 'GBP';
      if (s.includes('$')) return 'USD';
      return undefined;
    };

    const extractPriceFromDom = () => {
      const candidates = [
        '[itemprop="price"]',
        'meta[property="product:price:amount"]',
        '[data-price]',
        '.price',
        '.product-price',
        '.product-price-large',
        '#price',
        '[class*="price"]'
      ];
      for (let i = 0; i < candidates.length; i++) {
        const sel = candidates[i];
        const el = document.querySelector(sel);
        if (!el) continue;
        const raw = el.getAttribute('content') || el.getAttribute('value') || el.getAttribute('data-price') || el.textContent;
        const parsed = toNumber(raw);
        if (parsed !== undefined) {
          return {
            value: parsed,
            currency: el.getAttribute('data-currency') || inferCurrency(raw)
          };
        }
      }
      return undefined;
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
          if (!meta.currency && cfg.selectors.currency) {
            const el = document.querySelector(cfg.selectors.currency);
            const val = el ? (el.getAttribute('content') || el.getAttribute('value') || el.textContent) : null;
            if (val) meta.currency = normalize(val);
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

    const isProductPage = (meta) => {
      const cfg = window.__dmwConfig || {};
      if (matchPatternList(cfg.product_url_patterns, location.href || '')) return true;
      return Boolean(meta.sku || meta.price || (meta.name && /product|buy|shop/i.test(meta.name)));
    };

    const sendProductView = (meta) => {
      if (productViewSent) return;
      productViewSent = true;
      let confidence = 0.7;
      if (meta.source_hint === 'config_selector') confidence = Math.max(confidence, 0.9);
      if (meta.source_hint === 'json_ld') confidence = Math.max(confidence, 0.85);
      if (meta.source_hint === 'meta') confidence = Math.max(confidence, 0.8);
      if (meta.source_hint === 'url_param') confidence = Math.max(confidence, 0.7);
      const domPrice = meta.price ?? extractPriceFromDom();
      if (domPrice && (meta.price === undefined || meta.price === null)) {
        meta.price = domPrice.value;
        if (!meta.currency && domPrice.currency) meta.currency = domPrice.currency;
        confidence = Math.max(confidence, 0.7);
      }
      sendEvent('product_view', {
        sku: meta.sku,
        product_id: meta.product_id || meta.sku,
        name: meta.name,
        category: meta.category,
        price: meta.price,
        currency: meta.currency,
        confidence,
        data_completeness: meta.product_id || meta.sku || meta.price ? 'medium' : 'low',
        commerce: {
          product_id: meta.product_id || meta.sku,
          value: meta.price,
          currency: meta.currency
        }
      });
    };

    // Expose manual helpers
    window.sendProductView = (data = {}) => sendEvent('product_view', data);
    window.sendAddToCart = (data = {}) => sendEvent('add_to_cart', data);

    const applyConfigRules = () => {
      const cfg = window.__dmwConfig || {};
      const url = location.href || '';
      if (matchPatternList(cfg.cart_url_patterns, url)) {
        sendEvent('add_to_cart', { data_completeness: 'low', source_method: 'explicit' });
      }
      if (matchPatternList(cfg.checkout_url_patterns, url)) {
        sendEvent('begin_checkout', { data_completeness: 'low', source_method: 'explicit' });
      }
      if (cfg.selectors && cfg.selectors.product_view) {
        const el = document.querySelector(cfg.selectors.product_view);
        if (el) {
          sendEvent('product_view', { data_completeness: 'medium', source_method: 'explicit' });
        }
      }
      if (cfg.selectors && cfg.selectors.add_to_cart) {
        const el = document.querySelector(cfg.selectors.add_to_cart);
        if (el) {
          el.addEventListener('click', () => sendEvent('add_to_cart', { data_completeness: 'low', source_method: 'explicit' }), true);
        }
      }
      if (cfg.selectors && cfg.selectors.begin_checkout) {
        const el = document.querySelector(cfg.selectors.begin_checkout);
        if (el) {
          el.addEventListener('click', () => sendEvent('begin_checkout', { data_completeness: 'low', source_method: 'explicit' }), true);
        }
      }
    };

    // Auto product page detection
    try {
      const meta = detectProductMeta();
      if (isProductPage(meta)) {
        sendProductView(meta);
      }
    } catch(e) {}

    // Apply config-driven rules
    try {
      applyConfigRules();
    } catch(e) {}

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
      data.sku = data.sku || meta.sku;
      data.name = data.name || meta.name;
      data.category = data.category || meta.category;
      data.price = data.price || meta.price;
      data.currency = meta.currency;
      if (!data.product_id) {
        data.product_id = meta.product_id || meta.sku;
      }
      const domPrice = data.price ?? extractPriceFromDom();
      if (domPrice && (data.price === undefined || data.price === null)) {
        data.price = domPrice.value;
        if (!data.currency && domPrice.currency) data.currency = domPrice.currency;
      }
      if (data.price && data.quantity) {
        data.total = Math.round((data.price * data.quantity + Number.EPSILON) * 100) / 100;
      }

      if (cartKeywords.some(k => combined.includes(k))) {
        sendEvent('add_to_cart', data);
        return;
      }
      if (checkoutKeywords.some(k => combined.includes(k))) {
        sendEvent('begin_checkout', data);
        return;
      }
      if (purchaseKeywords.some(k => combined.includes(k))) {
        sendEvent('purchase', data);
        sendEvent('conversion', { source: 'purchase', ...data });
      }
    }, true);
  })();
  
  /* === CONVERSION TRACKING === */
  // Option A: Manual tracking - websites can call sendEvent('conversion', { goal: 'purchase', value: 99.99 })
  // Option C: Automatic form submission detection
  (function(){
    let conversionTracked = false;
    const trackConversion = (source, metadata = {}) => {
      if (conversionTracked) return; // Only track one conversion per session
      conversionTracked = true;
      sendEvent('conversion', { source: source, ...metadata });
    };
    
    // Make sendEvent available globally for manual tracking (Option A)
    window.sendConversionEvent = (goal, value) => {
      trackConversion('manual', { goal: goal || 'conversion', value: value });
    };

    // Option C2: Track likely signup CTA clicks (for SPAs/custom forms without native submit)
    const signupKeywords = ['signup', 'sign up', 'register', 'subscribe', 'join', 'start trial', 'get started', 'book now'];
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;
      const el = target.closest('button, a, input[type="button"], input[type="submit"]');
      if (!el) return;
      const text = (el.textContent || el.value || '').toString().toLowerCase().trim();
      const attrs = [el.id || '', el.className || '', el.getAttribute('name') || '', el.getAttribute('data-action') || '']
        .join(' ')
        .toLowerCase();
      const combined = `${text} ${attrs}`;
      if (signupKeywords.some(k => combined.includes(k))) {
        trackConversion('cta_click', {
          goal: 'signup_intent',
          cta_text: text || undefined
        });
      }
    }, true);

    // Option C3: Hook successful fetch/XHR calls to common signup/lead endpoints.
    // This catches AJAX submissions where native form submit isn't used.
    try {
      const pathLooksLikeConversion = (url) => {
        if (!url) return false;
        const u = url.toString().toLowerCase();
        return /(signup|register|subscribe|newsletter|lead|contact|checkout|purchase|order|trial|demo)/.test(u);
      };

      const originalFetch = window.fetch;
      if (typeof originalFetch === 'function') {
        window.fetch = async function(...args) {
          const res = await originalFetch.apply(this, args);
          try {
            const reqUrl = (args && args[0] && (args[0].url || args[0])) ? (args[0].url || args[0]) : '';
            if (res && res.ok && pathLooksLikeConversion(reqUrl)) {
              trackConversion('ajax_success', {
                goal: 'async_conversion',
                endpoint: reqUrl.toString().slice(0, 200)
              });
            }
          } catch(_) {}
          return res;
        };
      }

      const xhrOpen = XMLHttpRequest.prototype.open;
      const xhrSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this.__dmw_url = url;
        return xhrOpen.call(this, method, url, ...rest);
      };
      XMLHttpRequest.prototype.send = function(...args) {
        this.addEventListener('load', function() {
          try {
            if (this.status >= 200 && this.status < 300 && pathLooksLikeConversion(this.__dmw_url)) {
              trackConversion('xhr_success', {
                goal: 'async_conversion',
                endpoint: String(this.__dmw_url || '').slice(0, 200)
              });
            }
          } catch(_) {}
        });
        return xhrSend.apply(this, args);
      };
    } catch(e) {}
    
    // Option C: Automatic form submission detection
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (!form || form.tagName !== 'FORM') return;
      
      // Check if form has data attribute to exclude it
      if (form.dataset.trackConversion === 'false') return;
      
      // Extract form metadata
      const formId = form.id || form.name || 'unknown';
      const formAction = form.action || location.href;
      const formMethod = form.method || 'get';
      
      // Check for common conversion form patterns
      const conversionPatterns = [
        /signup|register|subscribe|newsletter/i,
        /contact|inquiry|lead|quote/i,
        /checkout|purchase|order|buy/i,
        /download|demo|trial/i,
        /apply|application/i
      ];
      
      const isConversionForm = 
        form.dataset.trackConversion === 'true' ||
        conversionPatterns.some(pattern => 
          pattern.test(formId) || 
          pattern.test(formAction) || 
          pattern.test(form.className)
        );
      
      if (isConversionForm) {
        // Extract form data for metadata
        const formData = new FormData(form);
        const metadata = {
          goal: form.dataset.conversionGoal || 'form_submission',
          form_id: formId,
          form_action: formAction,
          form_method: formMethod
        };
        
        // Try to extract value if present in form
        const valueField = form.querySelector('[name*="value"], [name*="amount"], [name*="price"]');
        if (valueField && valueField.value) {
          const parsedValue = parseFloat(valueField.value);
          if (!isNaN(parsedValue)) {
            metadata.value = parsedValue;
          }
        }
        
        trackConversion('form_submission', metadata);
      }
    }, true); // Use capture phase to catch all form submissions
  })();
