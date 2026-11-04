/*
 * Projects & Papers library: renders projects/catalog.js into sections by field, with filters and search.
 * Filter state lives in the URL (?field=physics&type=paper&q=plasmon), so filtered views can be linked to.
 * You should not need to edit this file to add projects; edit catalog.js instead.
 */
(function () {
  'use strict';

  var LIB = window.PROJECT_LIBRARY;
  var content = document.getElementById('libContent');
  var fieldChips = document.getElementById('fieldChips');
  var typeChips = document.getElementById('typeChips');
  var search = document.getElementById('libSearch');
  var countEl = document.getElementById('resultCount');
  var statsEl = document.getElementById('libStats');

  var fieldById = {}, typeById = {};
  LIB.disciplines.forEach(function (d) { fieldById[d.id] = d; });
  LIB.types.forEach(function (t) { typeById[t.id] = t; });

  // Catch typos in catalog.js early (shown in the browser console)
  LIB.projects.forEach(function (p) {
    (p.disciplines || []).forEach(function (d) { if (!fieldById[d]) console.warn('catalog.js: unknown discipline "' + d + '" in ' + p.id); });
    (p.types || []).forEach(function (t) { if (!typeById[t]) console.warn('catalog.js: unknown type "' + t + '" in ' + p.id); });
  });

  var state = readURL();

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function isExternal(href) { return /^https?:\/\//.test(href); }
  function linkAttrs(href) { return 'href="' + esc(href) + '"' + (isExternal(href) ? ' target="_blank" rel="noopener"' : ''); }
  function primaryLink(p) { return (p.links || []).filter(function (l) { return l.primary; })[0] || (p.links || [])[0]; }
  function haystack(p) {
    return [p.title, p.summary, (p.tags || []).join(' '), (p.disciplines || []).map(function (d) { return fieldById[d] ? fieldById[d].name : d; }).join(' '),
      (p.types || []).join(' '), p.year].join(' ').toLowerCase();
  }
  function matches(p, s) {
    if (s.field !== 'all' && (p.disciplines || []).indexOf(s.field) < 0) return false;
    if (s.type !== 'all' && (p.types || []).indexOf(s.type) < 0) return false;
    if (s.q) {
      var h = haystack(p);
      return s.q.toLowerCase().split(/\s+/).filter(Boolean).every(function (w) { return h.indexOf(w) >= 0; });
    }
    return true;
  }

  // ---------- URL state ----------
  function readURL() {
    var q = new URLSearchParams(location.search);
    var f = q.get('field'), t = q.get('type');
    return {
      field: fieldById[f] ? f : 'all',
      type: typeById[t] ? t : 'all',
      q: q.get('q') || '',
    };
  }
  function writeURL() {
    var q = new URLSearchParams();
    if (state.field !== 'all') q.set('field', state.field);
    if (state.type !== 'all') q.set('type', state.type);
    if (state.q) q.set('q', state.q);
    var s = q.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
  }

  // ---------- chips ----------
  function chip(group, id, label, icon, count, pressed) {
    return '<button type="button" class="lib-chip" data-group="' + group + '" data-id="' + esc(id) + '" aria-pressed="' + pressed + '">' +
      (icon ? '<i class="fas ' + esc(icon) + '" aria-hidden="true"></i>' : '') +
      '<span>' + esc(label) + '</span>' + (count != null ? '<span class="lib-chip-count">' + count + '</span>' : '') + '</button>';
  }
  function renderChips() {
    var all = LIB.projects.length;
    fieldChips.innerHTML = chip('field', 'all', 'All fields', null, all, state.field === 'all') +
      LIB.disciplines.map(function (d) {
        var n = LIB.projects.filter(function (p) { return (p.disciplines || []).indexOf(d.id) >= 0; }).length;
        return n ? chip('field', d.id, d.name, d.icon, n, state.field === d.id) : '';
      }).join('');
    typeChips.innerHTML = chip('type', 'all', 'Any type', null, null, state.type === 'all') +
      LIB.types.map(function (t) {
        var n = LIB.projects.filter(function (p) { return (p.types || []).indexOf(t.id) >= 0; }).length;
        return n ? chip('type', t.id, t.name, t.icon, n, state.type === t.id) : '';
      }).join('');
  }

  // ---------- cards ----------
  function thumb(p) {
    var d = fieldById[(p.disciplines || [])[0]] || { id: 'other', icon: 'fa-shapes' };
    var href = primaryLink(p) ? primaryLink(p).href : null;
    var inner = p.thumb
      ? '<img src="' + esc(p.thumb) + '" alt="" loading="lazy" />'
      : '<span class="lib-art lib-art-' + esc(d.id) + '"><i class="fas ' + esc(d.icon) + '"></i></span>';
    return href
      ? '<a class="lib-thumb" ' + linkAttrs(href) + ' tabindex="-1" aria-hidden="true">' + inner + '</a>'
      : '<div class="lib-thumb" aria-hidden="true">' + inner + '</div>';
  }
  function card(p, i) {
    var pl = primaryLink(p);
    var types = (p.types || []).map(function (t) {
      var ty = typeById[t]; return ty ? '<span class="lib-type"><i class="fas ' + esc(ty.icon) + '" aria-hidden="true"></i>' + esc(ty.name) + '</span>' : '';
    }).join('');
    var status = p.status ? '<span class="research-status ' + esc(p.status) + '">' + (p.status === 'current' ? 'Current' : 'Completed') + '</span>' : '';
    var fields = (p.disciplines || []).map(function (d) { return fieldById[d] ? '<span class="lib-field lib-field-' + esc(d) + '">' + esc(fieldById[d].name) + '</span>' : ''; }).join('');
    var links = (p.links || []).map(function (l) {
      return '<a class="lib-link' + (l.primary ? ' primary' : '') + '" ' + linkAttrs(l.href) + '>' +
        '<i class="' + (l.brand ? 'fab' : 'fas') + ' ' + esc(l.icon || 'fa-link') + '" aria-hidden="true"></i>' + esc(l.label) +
        (isExternal(l.href) ? '<span class="visually-hidden"> (opens in a new tab)</span>' : '') + '</a>';
    }).join('');
    return '<article class="lib-card' + (p.featured ? ' featured' : '') + '" id="' + esc(p.id) + '" style="--i:' + i + '">' +
      thumb(p) +
      '<div class="lib-body">' +
        '<div class="lib-meta">' + types + (p.year ? '<span class="lib-year">' + esc(p.year) + '</span>' : '') + status + '</div>' +
        '<h3>' + (pl ? '<a ' + linkAttrs(pl.href) + '>' + esc(p.title) + '</a>' : esc(p.title)) + '</h3>' +
        '<p class="lib-summary">' + esc(p.summary) + '</p>' +
        '<div class="lib-fields">' + fields + '</div>' +
        '<div class="lib-tags">' + (p.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<div class="lib-links">' + links + '</div>' +
      '</div></article>';
  }

  // ---------- page ----------
  function render() {
    var list = LIB.projects.filter(function (p) { return matches(p, state); });
    var filtered = state.field !== 'all' || state.type !== 'all' || state.q;
    var html = '', i = 0;

    if (!list.length) {
      html = '<div class="lib-empty"><i class="fas fa-magnifying-glass" aria-hidden="true"></i><p>No projects match these filters.</p>' +
        '<button type="button" class="lib-chip" id="clearFilters">Clear filters</button></div>';
    } else if (!filtered) {
      // Grouped view: one section per field, each project under its first-listed field
      LIB.disciplines.forEach(function (d) {
        var items = list.filter(function (p) { return (p.disciplines || [])[0] === d.id; });
        if (!items.length) return;
        html += '<section class="lib-section" id="field-' + esc(d.id) + '" aria-labelledby="h-' + esc(d.id) + '">' +
          '<div class="lib-section-head">' +
            '<span class="lib-section-icon lib-art-' + esc(d.id) + '"><i class="fas ' + esc(d.icon) + '" aria-hidden="true"></i></span>' +
            '<div><h2 id="h-' + esc(d.id) + '">' + esc(d.name) + '</h2><p>' + esc(d.blurb || '') + '</p></div>' +
            '<button type="button" class="lib-more" data-field="' + esc(d.id) + '" aria-label="Show only ' + esc(d.name) + '">Show only this field <i class="fas fa-arrow-right" aria-hidden="true"></i></button>' +
          '</div>' +
          '<div class="lib-grid">' + items.map(function (p) { return card(p, i++); }).join('') + '</div></section>';
      });
    } else {
      html = '<div class="lib-grid">' + list.map(function (p) { return card(p, i++); }).join('') + '</div>';
    }
    content.innerHTML = html;

    countEl.textContent = filtered
      ? 'Showing ' + list.length + ' of ' + LIB.projects.length + (LIB.projects.length === 1 ? ' project' : ' projects')
      : '';
    var clear = document.getElementById('clearFilters');
    if (clear) clear.addEventListener('click', function () { setState({ field: 'all', type: 'all', q: '' }); });
  }

  function setState(patch) {
    for (var k in patch) state[k] = patch[k];
    if (search.value !== state.q) search.value = state.q;
    writeURL(); renderChips(); render();
  }

  // ---------- events ----------
  document.addEventListener('click', function (e) {
    var c = e.target.closest('.lib-chip[data-group]');
    if (c) { var p = {}; p[c.getAttribute('data-group')] = c.getAttribute('data-id'); setState(p); return; }
    var m = e.target.closest('.lib-more');
    if (m) { setState({ field: m.getAttribute('data-field') }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  var t;
  search.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { setState({ q: search.value.trim() }); }, 120); });

  // Header stats
  var nFields = LIB.disciplines.filter(function (d) { return LIB.projects.some(function (p) { return (p.disciplines || [])[0] === d.id; }); }).length;
  var nInteractive = LIB.projects.filter(function (p) { return (p.types || []).indexOf('interactive') >= 0; }).length;
  statsEl.innerHTML = '<span><strong>' + LIB.projects.length + '</strong> projects</span><span><strong>' + nFields + '</strong> fields</span>' +
    '<span><strong>' + nInteractive + '</strong> interactive</span>';

  search.value = state.q;
  renderChips(); render();

  // Deep link to a card: projects/#cascadia
  if (location.hash) { var target = document.getElementById(location.hash.slice(1)); if (target) target.scrollIntoView(); }
})();
