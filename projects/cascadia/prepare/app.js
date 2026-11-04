/*
 * "Be prepared" page: what-to-do picker, water & food calculator, kit checklist (saved in localStorage),
 * tsunami walking race, and a one-minute drill timer. No dependencies.
 */
(function () {
  'use strict';

  var Q = window.QUAKE;
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  // Text with **bold** segments -> DOM nodes (content is our own, never user input).
  function rich(parent, text) {
    text.split(/\*\*/).forEach(function (part, i) {
      parent.appendChild(i % 2 ? el('strong', null, part) : document.createTextNode(part));
    });
    return parent;
  }
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }

  // ---------- why: the report's 50-year odds ----------
  function buildWhy() {
    var ids = [['deep-puget', 'Deep M6.5+ under Puget Sound'], ['crustal-puget', 'Shallow M6.5+ in the Puget Sound crust'],
      ['mega-full-td', 'Cascadia M9 megathrust'], ['crustal-seattle', 'M6.5+ on the Seattle Fault']];
    var byId = {};
    Q.scenarios.forEach(function (s) { byId[s.id] = s; });
    var ul = $('why-stats');
    ids.forEach(function (pair) {
      var s = byId[pair[0]];
      var li = el('li', 'why-stat');
      li.style.setProperty('--c', Q.types[s.type].color);
      var v = pair[0] === 'mega-full-td' ? '10–15%' : Math.round(s.reported * 100) + '%';
      li.appendChild(el('strong', null, v));
      li.appendChild(el('span', null, pair[1]));
      var bar = el('span', 'why-bar');
      var fill = el('span');
      fill.style.width = (s.reported * 100) + '%';
      bar.appendChild(fill);
      li.appendChild(bar);
      ul.appendChild(li);
    });
  }

  // ---------- where are you? ----------
  var WHERE = [
    { id: 'indoors', label: 'Indoors', do: [
      '**Drop** to your hands and knees, **Cover** under a sturdy table or desk, and **Hold On**.',
      'No table nearby? Get down next to an inside wall and cover your head and neck with your arms.',
      'Stay inside until the shaking stops. Most injuries happen to people moving around or going outside.'],
      dont: 'Don’t run outside or stand in a doorway. Stay away from windows, mirrors and tall furniture.' },
    { id: 'bed', label: 'In bed', do: [
      '**Stay in bed.** Turn face down and cover your head and neck with a pillow.',
      'Hold on until the shaking stops.',
      'Put on the shoes you keep by the bed before you get up: there may be broken glass.'],
      dont: 'Don’t try to walk to a table in the dark during shaking.' },
    { id: 'outdoors', label: 'Outdoors', do: [
      'Move a few steps away from buildings, trees, streetlights and power lines, if you can do it safely.',
      'Then **Drop, Cover, and Hold On** right where you are.',
      'Near tall buildings, glass and bricks can fall into the street. Duck into a building lobby if one is right next to you.'],
      dont: 'Don’t run long distances. Falling debris close to buildings is the biggest danger.' },
    { id: 'driving', label: 'Driving', do: [
      '**Pull over** to a clear spot, **stop**, and set the parking brake.',
      'Stay in the car with your seat belt on until the shaking stops.',
      'Then drive slowly and watch for cracks, fallen objects and damaged roads.'],
      dont: 'Don’t stop on or under bridges, overpasses, or near power lines and trees.' },
    { id: 'coast', label: 'At the coast', do: [
      '**Drop, Cover, and Hold On** until the shaking stops.',
      'Then **go to high ground or inland right away, on foot.** Strong or long shaking is your tsunami warning.',
      'Stay on high ground until officials say it is safe. More waves may come for hours.'],
      dont: 'Don’t wait for an official warning or go to the beach to look at the water.' },
    { id: 'wheelchair', label: 'Wheelchair or walker', do: [
      'If you use a wheelchair: **Lock** your wheels, **Cover** your head and neck with your arms or a book, and **Hold On**.',
      'If you use a walker or cane: sit down in a chair or on the floor if you can, cover your head and neck, and hold on.',
      'Don’t try to move to a table if it isn’t safe for you.'],
      dont: 'Don’t try to transfer out of your wheelchair during the shaking.' },
  ];

  function buildWhere() {
    var wrap = $('where-buttons');
    WHERE.forEach(function (w) {
      var b = el('button', null, w.label);
      b.type = 'button';
      b.dataset.where = w.id;
      b.addEventListener('click', function () { showWhere(w.id); });
      wrap.appendChild(b);
    });
    showWhere('indoors');
  }
  function showWhere(id) {
    var w = WHERE.filter(function (x) { return x.id === id; })[0];
    document.querySelectorAll('#where-buttons button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.where === id));
    });
    var p = $('where-panel');
    p.textContent = '';
    p.dataset.where = id;
    var ol = el('ol', 'where-do');
    w.do.forEach(function (t) { ol.appendChild(rich(el('li'), t)); });
    p.appendChild(ol);
    var dont = el('p', 'where-dont');
    dont.appendChild(el('span', 'x', '✕'));
    dont.appendChild(document.createTextNode(w.dont));
    p.appendChild(dont);
  }

  // ---------- water & food calculator ----------
  var calc = { people: 2, petlb: 0, days: 14 };
  var LIMITS = { people: [1, 12], petlb: [0, 300] };

  function renderCalc() {
    var personGal = calc.people * calc.days;               // 1 gallon / person / day
    var petGal = calc.petlb * calc.days / 128;              // 1 oz per lb per day, 128 oz per gallon
    var total = Math.ceil(personGal + petGal);
    $('people-out').textContent = calc.people;
    $('petlb-out').textContent = calc.petlb;
    $('water-gal').textContent = total;
    var cases = Math.ceil(total * 3.785 / 12);               // 24 × 0.5 L bottles = 12 L per case
    $('water-sub').textContent = calc.people + (calc.people === 1 ? ' person' : ' people') +
      (calc.petlb ? ' and ' + calc.petlb + ' lb of pets' : '') + ' for ' + calc.days + ' days. That’s about ' +
      cases + (cases === 1 ? ' case' : ' cases') + ' of 24 half-liter bottles, or ' + total + ' one-gallon jugs.';
    var meals = calc.people * calc.days * 3;
    $('meals').textContent = meals;
    $('meals-sub').textContent = '3 meals a day. Pick food that needs no fridge and little or no cooking.';

    var jugs = $('jugs');
    jugs.textContent = '';
    var shown = Math.min(total, 60);
    for (var i = 0; i < shown; i++) jugs.appendChild(el('span', 'jug' + (i >= Math.ceil(personGal) ? ' pet' : '')));
    if (total > shown) jugs.appendChild(el('span', 'jug-more', '+' + (total - shown)));
    jugs.setAttribute('aria-label', total + ' one-gallon jugs of water');

    document.querySelectorAll('#days-buttons button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(+b.dataset.days === calc.days));
    });
    document.querySelectorAll('[data-step]').forEach(function (b) {
      var k = b.dataset.step, d = +b.dataset.d;
      b.disabled = d < 0 ? calc[k] <= LIMITS[k][0] : calc[k] >= LIMITS[k][1];
    });
  }
  function wireCalc() {
    document.querySelectorAll('[data-step]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        var k = b.dataset.step;
        calc[k] = Math.max(LIMITS[k][0], Math.min(LIMITS[k][1], calc[k] + +b.dataset.d));
        renderCalc();
      });
    });
    document.querySelectorAll('#days-buttons button').forEach(function (b) {
      b.addEventListener('click', function () { calc.days = +b.dataset.days; renderCalc(); });
    });
    renderCalc();
  }

  // ---------- checklist ----------
  var KIT = [
    ['Water and food', ['Water: 1 gallon per person per day', 'No-cook food (canned, dried, peanut butter, bars)',
      'Manual can opener', 'Food and water for pets', 'Camp stove and fuel (outdoor use only)']],
    ['Light and communication', ['Flashlight or headlamp for each person', 'Extra batteries', 'Battery or hand-crank radio',
      'Phone power bank and charging cables', 'Whistle to signal for help']],
    ['Health and safety', ['First aid kit', 'Extra prescription medicines and glasses', 'Sturdy shoes and work gloves',
      'Fire extinguisher', 'Wrench to shut off gas']],
    ['Sanitation', ['Two buckets with lids for a toilet', 'Heavy-duty garbage bags', 'Toilet paper, wipes and hand sanitizer']],
    ['Documents and money', ['Cash in small bills', 'Copies of IDs, insurance and medical info', 'Printed list of family contacts']],
    ['Comfort', ['Warm clothes, blankets or sleeping bags', 'Tarp or tent', 'Books, cards or games']],
  ];
  var CHECK_KEY = 'quake-prep-kit';

  function buildChecklist() {
    var saved = store(CHECK_KEY) || {};
    var wrap = $('check-groups');
    KIT.forEach(function (g, gi) {
      var fs = el('fieldset', 'check-group');
      fs.appendChild(el('legend', null, g[0]));
      g[1].forEach(function (item, ii) {
        var id = 'k' + gi + '-' + ii;
        var lab = el('label', 'check-item');
        var cb = el('input');
        cb.type = 'checkbox';
        cb.id = id;
        cb.dataset.key = id;
        cb.checked = !!saved[id];
        cb.addEventListener('change', saveChecklist);
        lab.appendChild(cb);
        lab.appendChild(el('span', null, item));
        fs.appendChild(lab);
      });
      wrap.appendChild(fs);
    });
    $('check-reset').addEventListener('click', function () {
      document.querySelectorAll('.check-item input').forEach(function (c) { c.checked = false; });
      saveChecklist();
    });
    $('check-print').addEventListener('click', function () { window.print(); });
    updateProgress();
  }
  function saveChecklist() {
    var s = {};
    document.querySelectorAll('.check-item input').forEach(function (c) { if (c.checked) s[c.dataset.key] = 1; });
    store(CHECK_KEY, s);
    updateProgress();
  }
  function updateProgress() {
    var all = document.querySelectorAll('.check-item input');
    var n = 0;
    all.forEach(function (c) { if (c.checked) n++; });
    $('check-count').textContent = n + ' of ' + all.length + (n === all.length ? ' · 2 Weeks Ready!' : '');
    $('check-bar').style.width = (n / all.length * 100) + '%';
    $('check-bar').classList.toggle('done', n === all.length);
  }

  // ---------- tsunami race ----------
  var WALK_MPH = 3, RUN_MPH = 6, SLOW_MPH = 1.5;
  function renderRace() {
    var min = +$('race-min').value;
    $('race-min-out').textContent = min + ' min';
    var rows = [['Brisk walk (3 mph)', WALK_MPH], ['Slow walk, carrying a child (1.5 mph)', SLOW_MPH], ['Jogging (6 mph)', RUN_MPH]];
    var max = RUN_MPH * 40 / 60;
    var wrap = $('race-bars');
    wrap.textContent = '';
    rows.forEach(function (r) {
      var mi = r[1] * min / 60;
      var row = el('div', 'race-row');
      row.appendChild(el('span', 'race-name', r[0]));
      var track = el('span', 'race-track');
      var fill = el('span', 'race-fill');
      fill.style.width = (mi / max * 100) + '%';
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('span', 'race-val', mi.toFixed(1) + ' mi'));
      wrap.appendChild(row);
    });
  }

  // ---------- one-minute drill ----------
  var drill = { timer: null, start: 0, len: 60 };
  var CIRC = 2 * Math.PI * 52;
  function drillTick() {
    var left = Math.max(0, drill.len - (Date.now() - drill.start) / 1000);
    $('drill-time').textContent = Math.ceil(left);
    $('drill-prog').style.strokeDashoffset = String(CIRC * (left / drill.len));
    var e = drill.len - left;
    $('drill-word').textContent = left <= 0 ? 'Well done!' : e < 3 ? 'Drop!' : e < 6 ? 'Cover!' : 'Hold on!';
    if (left <= 0) stopDrill(true);
  }
  function startDrill() {
    drill.start = Date.now();
    $('drill-ring').classList.add('shaking');
    $('drill-start').disabled = true;
    $('drill-stop').disabled = false;
    drillTick();
    drill.timer = setInterval(drillTick, 200);
  }
  function stopDrill(finished) {
    clearInterval(drill.timer);
    drill.timer = null;
    $('drill-ring').classList.remove('shaking');
    $('drill-start').disabled = false;
    $('drill-start').textContent = 'Start again';
    $('drill-stop').disabled = true;
    if (!finished) {
      $('drill-word').textContent = 'Stopped';
      $('drill-time').textContent = String(drill.len);
      $('drill-prog').style.strokeDashoffset = String(CIRC);
    }
  }

  function init() {
    buildWhy();
    buildWhere();
    wireCalc();
    buildChecklist();
    $('race-min').addEventListener('input', renderRace);
    renderRace();
    $('drill-prog').style.strokeDasharray = String(CIRC);
    $('drill-prog').style.strokeDashoffset = String(CIRC);
    $('drill-start').addEventListener('click', startDrill);
    $('drill-stop').addEventListener('click', function () { stopDrill(false); });
    window.__prep = { calc: calc, drill: drill };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
