/* === CONFIG (generated) === */
  const COLLECTOR_BASE = "https://dmwithai.selftrainai.com/api/collector";
  const TENANT_ID = "2";
  const SITE_TOKEN = "FKJGcfGKiNsQkglXD-O7PRUvIqHZq8cj";

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
    const payload = { t:type, tenantId:TENANT_ID, siteToken:SITE_TOKEN, url:location.href, ref:document.referrer||null, sid:sid(), ...getParams(), ...getIdentity(), ...extra };
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
      const meta = {
        sku: normalize(getMeta('[itemprop="sku"]')) || normalize(getMeta('meta[property="product:retailer_item_id"]')),
        name: normalize(getMeta('[itemprop="name"]')) || normalize(getMeta('meta[property="og:title"]')) || document.title,
        category: normalize(getMeta('[itemprop="category"]')),
        price: toNumber(getMeta('[itemprop="price"]')) || toNumber(getMeta('meta[property="product:price:amount"]')),
        currency: normalize(getMeta('[itemprop="priceCurrency"]')) || normalize(getMeta('meta[property="product:price:currency"]')),
      };
      return meta;
    };

    const isProductPage = (meta) => {
      return Boolean(meta.sku || meta.price || (meta.name && /product|buy|shop/i.test(meta.name)));
    };

    const sendProductView = (meta) => {
      if (productViewSent) return;
      productViewSent = true;
      sendEvent('product_view', meta);
    };

    // Expose manual helpers
    window.sendProductView = (data = {}) => sendEvent('product_view', data);
    window.sendAddToCart = (data = {}) => sendEvent('add_to_cart', data);

    // Auto product page detection
    try {
      const meta = detectProductMeta();
      if (isProductPage(meta)) {
        sendProductView(meta);
      }
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
