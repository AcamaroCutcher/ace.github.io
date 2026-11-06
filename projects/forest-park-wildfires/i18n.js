/*
 * Language switch: English / Español / 中文 (simplified).
 * 1) On-device translation with the browser's built-in Translator API when it is available
 *    (private: the text never leaves the device). Text added later (labs, simulators) is translated too.
 * 2) Otherwise the Google Translate page proxy for acamaro.com.
 * Code, equations, live numbers and anything marked translate="no" are left alone.
 * Placeholder in the top bar: <div class="lang" data-lang-switch></div>
 */
(function () {
  'use strict';
  var KEY = 'fp-lang', LANGS = [['en', 'EN', 'English'], ['es', 'ES', 'Español'], ['zh', '中文', '中文（简体）']];
  var onProxy = /\.translate\.goog$/.test(location.hostname);
  var SKIP = 'script,style,code,pre,kbd,samp,textarea,svg,canvas,.katex,.katex-mathml,[translate="no"],.notranslate,.lang';
  var active = 'en', translator = null, cache = {}, observer = null;

  function stored() { try { return localStorage.getItem(KEY) || 'en'; } catch (e) { return 'en'; } }
  function store(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* storage off */ } }
  function proxyUrl(lang) {
    var tl = lang === 'zh' ? 'zh-CN' : lang;
    return 'https://acamaro-com.translate.goog' + location.pathname + '?_x_tr_sl=en&_x_tr_tl=' + tl + '&_x_tr_hl=' + tl + '&_x_tr_pto=wapp' + location.hash;
  }
  function originalUrl() { return 'https://acamaro.com' + location.pathname + location.hash; }

  function textNodes(root) {
    var out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!/[A-Za-z]{2}/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement; if (!p || p.closest(SKIP)) return NodeFilter.FILTER_REJECT;
        if (n.__fpDone === active) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      } });
    while (w.nextNode()) out.push(w.currentNode);
    return out;
  }
  function translateNodes(nodes) {
    var queue = nodes.slice(), running = 0;
    return new Promise(function (resolve) {
      function next() {
        if (!queue.length && !running) return resolve();
        while (running < 4 && queue.length) {
          var n = queue.shift(), raw = n.nodeValue, lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0], core = raw.trim();
          if (!n.__fpOrig) n.__fpOrig = raw;
          var key = active + '|' + core;
          running++;
          (cache[key] ? Promise.resolve(cache[key]) : translator.translate(core).then(function (k) { return function (txt) { cache[k] = txt; return txt; }; }(key)))
            .then(function (node, l, tr) { return function (txt) { node.nodeValue = l + txt + tr; node.__fpDone = active; }; }(n, lead, trail))
            .catch(function () { /* leave the original */ })
            .then(function () { running--; next(); });
        }
      }
      next();
    });
  }
  function status(msg) {
    var s = document.querySelector('.lang-status');
    if (!s) { s = document.createElement('div'); s.className = 'lang-status'; s.setAttribute('translate', 'no'); document.body.appendChild(s); }
    s.textContent = msg; s.hidden = !msg;
  }
  function onDevice(lang, gesture) {
    if (!('Translator' in self)) return Promise.reject(new Error('no on-device translator'));
    var opts = { sourceLanguage: 'en', targetLanguage: lang };
    return self.Translator.availability(opts).then(function (av) {
      if (av === 'unavailable') throw new Error('unavailable');
      if (av !== 'available' && !gesture) throw new Error('needs a click to download');
      status(lang === 'zh' ? '正在准备翻译…' : 'Preparando la traducción…');
      return self.Translator.create(Object.assign({ monitor: function (m) { m.addEventListener('downloadprogress', function (e) { status(Math.round(e.loaded * 100) + ' %'); }); } }, opts));
    }).then(function (tr) {
      translator = tr; active = lang; document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
      return translateNodes(textNodes(document.body)).then(function () {
        status('');
        if (!observer) {
          var pending = false;
          observer = new MutationObserver(function () {
            if (pending || active === 'en') return; pending = true;
            setTimeout(function () { pending = false; translateNodes(textNodes(document.body)); }, 400);
          });
          observer.observe(document.body, { childList: true, subtree: true });
        }
      });
    });
  }
  function choose(lang, gesture) {
    store(lang); mark(lang);
    if (lang === 'en') {
      if (onProxy) { location.href = originalUrl(); return; }
      if (active !== 'en') location.reload();
      return;
    }
    if (onProxy) { location.href = proxyUrl(lang); return; }
    onDevice(lang, gesture).catch(function () {
      status('');
      if (/^(localhost|127\.)/.test(location.hostname)) { alert('Translation needs the published site (or a browser with built-in translation).'); return; }
      location.href = proxyUrl(lang);
    });
  }
  function mark(lang) {
    document.querySelectorAll('[data-lang-switch] button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.lang === lang ? 'true' : 'false'); });
  }
  function build() {
    document.querySelectorAll('[data-lang-switch]').forEach(function (box) {
      box.setAttribute('translate', 'no'); box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Language');
      LANGS.forEach(function (L) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = L[1]; b.title = L[2]; b.dataset.lang = L[0];
        b.addEventListener('click', function () { choose(L[0], true); }); box.appendChild(b);
      });
    });
    var want = onProxy ? (new URLSearchParams(location.search).get('_x_tr_tl') || 'es').slice(0, 2) : stored();
    mark(want);
    if (!onProxy && want !== 'en') {
      onDevice(want, false).catch(function () {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'lang-offer';
        b.textContent = want === 'zh' ? '用中文显示此页' : 'Ver esta página en español';
        b.addEventListener('click', function () { b.remove(); choose(want, true); });
        document.body.appendChild(b);
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
