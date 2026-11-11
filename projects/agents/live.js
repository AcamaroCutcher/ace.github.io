/*
 * Live Claude in the browser, with the visitor's own API key.
 * The key is kept in this page's memory (or, if the visitor ticks the box, in sessionStorage for this tab only).
 * It is sent only to api.anthropic.com, by the official Anthropic SDK in browser mode.
 */
(function () {
  'use strict';
  var h = AG.h;
  var SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.2.0/+esm';
  var MODELS = [
    ['claude-opus-5-5', 'Claude Opus 5.5 (default)', 4, 20, true],
    ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (faster, cheaper)', 2, 10, true],
    ['claude-haiku-5-5', 'Claude Haiku 5.5 (fastest, cheapest)', 0.1, 0.5, false],
  ];
  var L = AG.live = { key: null, model: MODELS[0][0], panels: [], spent: 0 };
  try { L.key = sessionStorage.getItem('agents:apikey') || null; } catch (e) { /* storage blocked */ }
  var sdkPromise = null;
  function sdk() { if (!sdkPromise) sdkPromise = import(SDK_URL).then(function (m) { return m.default; }); return sdkPromise; }
  function modelInfo(id) { return MODELS.filter(function (m) { return m[0] === id; })[0] || MODELS[0]; }

  L.cost = function (usage, model) {
    var m = modelInfo(model || L.model);
    var inTok = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
    return (inTok * m[2] + (usage.output_tokens || 0) * m[3]) / 1e6;
  };

  // One Messages API call. params: {system, tools, messages, max_tokens}
  L.create = function (params) {
    if (!L.key) return Promise.reject(new Error('Enter your Anthropic API key first.'));
    return sdk().then(function (Anthropic) {
      var client = new Anthropic({ apiKey: L.key, dangerouslyAllowBrowser: true, baseURL: window.AG_TEST_BASEURL || undefined, maxRetries: 2 });
      var body = Object.assign({ model: L.model, max_tokens: 8000 }, params);
      if (modelInfo(L.model)[4]) {
        // server-side fallback: if a safety classifier declines, the API retries on a fallback model in the same call
        return client.beta.messages.create(Object.assign(body, { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }));
      }
      return client.messages.create(body);
    }).then(function (r) {
      L.spent += L.cost(r.usage || {}, r.model);
      L.panels.forEach(function (p) { p.update(); });
      return r;
    });
  };
  L.errorText = function (e) {
    var st = e && e.status;
    if (st === 401) return 'The API rejected the key (401). Check it at console.anthropic.com.';
    if (st === 429) return 'Rate limited (429). Wait a moment and try again.';
    if (st === 529 || st === 503) return 'The API is overloaded right now (' + st + '). Try again shortly.';
    if (st === 400) return 'Bad request (400): ' + (e.message || '');
    if (e && /Failed to fetch|NetworkError/i.test(String(e.message))) return 'Network error: could not reach the API (offline, or blocked by an extension).';
    return String((e && e.message) || e);
  };

  // The key panel. Several widgets on one page share the same key.
  L.panel = function (root) {
    var box = h('div', { class: 'live-panel' });
    var input = h('input', { type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Anthropic API key', style: 'flex:1;min-width:200px' });
    var model = h('select', { 'aria-label': 'Model' });
    MODELS.forEach(function (m) { model.appendChild(h('option', { value: m[0], text: m[1] })); });
    var remember = h('input', { type: 'checkbox' });
    var bSet = h('button', { type: 'button', class: 'small primary', text: 'Use key' }), bForget = h('button', { type: 'button', class: 'small', text: 'Forget key' });
    var status = h('span', { class: 'w-note' });
    box.appendChild(h('div', { class: 'w-row' }, [h('b', { text: '🔑 Live mode' }), status]));
    box.appendChild(h('div', { class: 'w-row' }, [input, bSet, bForget]));
    box.appendChild(h('div', { class: 'w-row' }, [model, h('label', { class: 'w-note' }, [remember, ' Remember in this tab (sessionStorage)'])]));
    box.appendChild(h('p', { class: 'w-note', html: 'Uses <b>your</b> Anthropic API key and is billed to your account (get one at <a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a>; set a low spend limit). The key stays in this browser tab and is sent only to <code>api.anthropic.com</code>. This is a static page with no server of its own. A key typed into any web page can be read by that page\'s code, so only do this on sites you trust, and delete the key afterwards if you are unsure.' }));
    root.appendChild(box);
    var self = {
      update: function () {
        status.innerHTML = L.key ? '<span class="pill ok">key set</span> ' + modelInfo(L.model)[1].replace(/ \(.*/, '') + ' · spent this session ≈ $' + L.spent.toFixed(4) : '<span class="pill warn">no key</span> paste your key to run live';
        if (model.value !== L.model) model.value = L.model;
      },
    };
    bSet.addEventListener('click', function () {
      var k = input.value.trim(); if (!k) return;
      L.key = k; input.value = '';
      try { if (remember.checked) sessionStorage.setItem('agents:apikey', k); else sessionStorage.removeItem('agents:apikey'); } catch (e) { /* ignore */ }
      L.panels.forEach(function (p) { p.update(); });
    });
    bForget.addEventListener('click', function () { L.key = null; try { sessionStorage.removeItem('agents:apikey'); } catch (e) { /* ignore */ } L.panels.forEach(function (p) { p.update(); }); });
    model.addEventListener('change', function () { L.model = model.value; L.panels.forEach(function (p) { p.update(); }); });
    L.panels.push(self); self.update();
    return self;
  };
})();
