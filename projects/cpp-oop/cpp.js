/*
 * C++ OOP tutorial: widgets.
 * All program output shown here comes from window.CPP, which build.py fills from real compiled runs
 * (and, for the debugger, from a real step-by-step recording made with LLDB).
 */
(function () {
  'use strict';
  var D = window.CPP || {};

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // tiny C++ highlighter for code the widgets generate (same classes as the build's)
  var KW = /^(class|struct|public|private|protected|virtual|override|final|const|return|new|delete|using|this|explicit|default|int|double|void|auto)$/;
  function hl(src) {
    return src.split('\n').map(function (line) {
      var m = line.match(/^(.*?)(\/\/.*)?$/), code = m[1], cm = m[2] || '';
      code = esc(code).replace(/[A-Za-z_~]\w*/g, function (w) {
        if (KW.test(w)) return '<span class="k">' + w + '</span>';
        if (/^~?[A-Z][a-z]/.test(w)) return '<span class="t">' + w + '</span>';
        return w;
      }).replace(/\b\d+(\.\d+)?\b/g, '<span class="n">$&</span>');
      return code + (cm ? '<span class="c">' + esc(cm) + '</span>' : '');
    }).join('\n');
  }
  function codeBox(title) {
    var pre = h('code'), box = h('div', { class: 'code', translate: 'no' }, [h('div', { class: 'code-head' }, [h('span', { text: title })]), h('pre', null, [pre])]);
    return { box: box, set: function (src, mark) { pre.innerHTML = hl(src).split('\n').map(function (l, i) { return mark && mark.indexOf(i) >= 0 ? '<span class="mark">' + l + '</span>' : l; }).join('\n'); } };
  }
  function seg(label, opts, val, onchange) {   // segmented control
    var wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }, [h('span', { class: 'seg-label', text: label })]);
    var btns = opts.map(function (o) {
      var b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(o[0] === val), html: o[1], onclick: function () {
        btns.forEach(function (x) { x.setAttribute('aria-checked', 'false'); }); b.setAttribute('aria-checked', 'true'); onchange(o[0]);
      } });
      wrap.appendChild(b); return b;
    });
    return wrap;
  }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================================================================ lifetime */
  function lifetime(root) {
    var st = { v: 1, heap: 0 }, timer = null;
    var code = codeBox('lifetime_lab.cpp (the variant you picked)');
    var out = h('pre', { class: 'term-out' }), parts = {};
    var obj = h('div', { class: 'objview', 'aria-hidden': 'true' }, [
      h('div', { class: 'obj-title', text: 'the Derived object' }),
      parts.base = h('div', { class: 'part', text: 'Base part' }),
      parts.member = h('div', { class: 'part', text: 'member log_ (a std::string inside)' }),
      parts.derived = h('div', { class: 'part', text: 'Derived part' })
    ]);
    var note = h('p', { class: 'w-note' });
    var run = h('button', { type: 'button', class: 'btn primary', text: '▶ Run', onclick: play });
    root.appendChild(h('div', { class: 'w-controls' }, [
      seg('Base destructor', [[1, '<code>virtual ~Base()</code>'], [0, '<code>~Base()</code>']], 1, function (v) { st.v = v; render(); }),
      seg('Create the object', [[0, 'on the stack'], [1, 'with <code>new</code>, delete via <code>Base*</code>']], 0, function (v) { st.heap = v; render(); }),
      run
    ]));
    root.appendChild(h('div', { class: 'w-grid' }, [code.box, h('div', { class: 'w-side' }, [h('div', { class: 'out', translate: 'no' }, [h('div', { class: 'out-head', text: 'Output' }), out]), obj])]));
    root.appendChild(note);
    function src() {
      return 'class Base {\npublic:\n    Base()  { std::cout << "Base()\\n"; }\n    ' + (st.v ? 'virtual ' : '') + '~Base() { std::cout << "~Base()\\n"; }\n};\n' +
        'class Derived : public Base {\n    Logger log_{"member log_"};\npublic:\n    Derived()  { std::cout << "Derived()\\n"; }\n    ~Derived() { std::cout << "~Derived()\\n"; }\n};\n\nint main() {\n' +
        (st.heap ? '    Base* p = new Derived;\n    std::cout << "-- using *p\\n";\n    delete p;\n' : '    {\n        Derived d;\n        std::cout << "-- using d\\n";\n    }\n') + '}';
    }
    function setParts(state) { ['base', 'member', 'derived'].forEach(function (k) { parts[k].className = 'part ' + (state[k] || ''); }); }
    function render() {
      clearInterval(timer); code.set(src(), st.heap ? [3, 13, 15] : [3, 14, 16]);
      out.textContent = ''; setParts({}); note.textContent = 'Press Run.'; note.className = 'w-note';
    }
    function play() {
      clearInterval(timer);
      var lines = (D.lifetime[String(st.v) + st.heap] || '').replace(/\n$/, '').split('\n'), i = 0, s = {};
      out.textContent = ''; setParts({});
      function stepLine() {
        if (i >= lines.length) { clearInterval(timer); finish(s); return; }
        var l = lines[i++]; out.textContent += l + '\n';
        if (l === 'Base()') s.base = 'built'; else if (l === '  + member log_') s.member = 'built'; else if (l === 'Derived()') s.derived = 'built';
        else if (l === '~Derived()') s.derived = 'gone'; else if (l === '  - member log_') s.member = 'gone'; else if (l === '~Base()') s.base = 'gone';
        setParts(s);
      }
      if (reduce) { while (i < lines.length) stepLine(); finish(s); } else timer = setInterval(stepLine, 380);
    }
    function finish(s) {
      if (s.derived === 'built') {
        setParts({ base: 'gone', member: 'leak', derived: 'leak' });
        note.innerHTML = '<b>Undefined behavior.</b> <code>delete p</code> through a <code>Base*</code> whose destructor is not virtual: here only <code>~Base()</code> ran. <code>~Derived()</code> and the member\'s destructor were skipped, so whatever they own (the string\'s memory, a file, a lock) is never released. Make <code>~Base()</code> virtual.';
        note.className = 'w-note bad';
      } else {
        note.innerHTML = st.heap ? 'Because <code>~Base()</code> is virtual, <code>delete p</code> found <code>~Derived()</code> through the vtable, and everything was destroyed in reverse order.'
          : 'A local object is destroyed at its closing brace, in exactly the reverse order of construction. The static type is <code>Derived</code>, so this works even without <code>virtual</code>.';
        note.className = 'w-note good';
      }
    }
    render();
  }

  /* ================================================================ dispatch + vtable */
  function dispatch(root) {
    var st = { v: 1, call: 3 };
    var CALLS = { 1: ['c.area()', 'Circle c;\nstd::cout << c.area();'], 2: ['Shape&amp; s = c', 'Circle c;\nShape& s = c;\nstd::cout << s.area();'],
      3: ['Shape* p = &amp;c', 'Circle c;\nShape* p = &c;\nstd::cout << p->area();'], 4: ['Shape s = c (copy)', 'Circle c;\nShape s = c;          // copies the Shape part only\nstd::cout << s.area();'] };
    var code = codeBox('dispatch_lab.cpp');
    var outv = h('b', { class: 'big-out' }), why = h('p', { class: 'w-note' }), diag = h('div', { class: 'vt-diag', 'aria-hidden': 'true' });
    root.appendChild(h('div', { class: 'w-controls' }, [
      seg('Shape::area() is', [[1, '<code>virtual</code>'], [0, 'not virtual']], 1, function (v) { st.v = v; render(); }),
      seg('Call through', [[1, 'the object'], [2, 'a reference'], [3, 'a pointer'], [4, 'a copy']], 3, function (v) { st.call = v; render(); })
    ]));
    root.appendChild(h('div', { class: 'w-grid' }, [code.box, h('div', { class: 'w-side' }, [h('div', { class: 'out', translate: 'no' }, [h('div', { class: 'out-head', text: 'Output' }), h('pre', null, [outv])]), diag])]));
    root.appendChild(why);
    function box(title, rows, cls) {
      return '<div class="vt-box ' + (cls || '') + '"><div class="vt-title">' + title + '</div>' + rows.map(function (r) { return '<div class="vt-row ' + (r[1] || '') + '">' + r[0] + '</div>'; }).join('') + '</div>';
    }
    function render() {
      var s = 'struct Shape {\n    virtual ~Shape() = default;\n    ' + (st.v ? 'virtual ' : '') + 'double area() const { return 0; }\n};\nstruct Circle : Shape {\n    double r = 2;\n    double area() const { return 3.14159 * r * r; }\n};\n\n' + CALLS[st.call][1];
      var n = CALLS[st.call][1].split('\n').length, mk = [2];
      for (var q = 10; q < 9 + n; q++) mk.push(q);
      code.set(s, mk);
      var o = D.dispatch[String(st.v) + st.call]; outv.textContent = o;
      var isVirt = st.v && st.call !== 1;
      var objCls = st.call === 4 ? 'Shape' : 'Circle';
      var obj = box((st.call === 4 ? 's' : 'c') + ' : ' + objCls, [['vptr →', isVirt ? 'hot' : ''], st.call === 4 ? ['(no r: sliced off)', 'dim'] : ['r = 2', '']], 'obj');
      var vt = box('vtable for ' + objCls, [['[0] ' + objCls + '::~' + objCls + '()', ''], ['[1] ' + objCls + '::~' + objCls + '()', ''], st.v ? ['[2] ' + objCls + '::area()', isVirt ? 'hot' : ''] : ['(area is not in the table)', 'dim']], isVirt ? '' : 'dim');
      var target = o === '0' ? 'Shape::area()' : 'Circle::area()';
      var how;
      if (st.call === 1) how = 'compile time: the static type is <code>Circle</code>';
      else if (!st.v) how = 'compile time: the static type is <code>Shape</code>';
      else if (st.call === 4) how = 'run time, through <code>s</code>\'s own vptr';
      else how = 'run time: load vptr → slot [2] → jump';
      diag.innerHTML = '<div class="vt-flow">' + obj + '<span class="vt-arrow' + (isVirt ? ' hot' : '') + '">→</span>' + vt + '</div><div class="vt-call">Called <code>' + target + '</code><br><small>' + how + '</small></div>';
      var t;
      if (st.call === 1) t = 'Calling on the object itself: the compiler knows it is exactly a <code>Circle</code>, so it calls <code>Circle::area</code> directly, virtual or not.';
      else if (st.call === 4) t = '<b>Slicing.</b> <code>s</code> is a new <code>Shape</code> object built from the Shape part of <code>c</code>. Its vptr points to Shape\'s vtable and the radius was not copied, so <code>Shape::area</code> runs whatever you do.';
      else if (!st.v) t = 'Without <code>virtual</code>, a call through a ' + (st.call === 2 ? 'reference' : 'pointer') + ' is resolved at compile time from its declared type, <code>Shape</code>. <code>Circle::area</code> only hides the base version; it does not override it.';
      else t = 'With <code>virtual</code>, the call goes through the object\'s vptr to <code>Circle</code>\'s vtable, so the actual object decides: <b>dynamic dispatch</b>. This is what makes a <code>vector&lt;Shape*&gt;</code> of mixed shapes work.';
      why.innerHTML = t; why.className = 'w-note ' + (o === '0' ? 'bad' : 'good');
    }
    render();
  }

  /* ================================================================ abstract checker */
  function abstractChecker(root) {
    var M = ['area', 'perimeter', 'name'], SIG = { area: 'double area() const', perimeter: 'double perimeter() const', name: 'std::string name() const' };
    var has = { Rectangle: { area: 1, perimeter: 1, name: 1 }, Square: { area: 0, perimeter: 0, name: 1 } };
    var cards = h('div', { class: 'ab-cards' }), code = codeBox('check.cpp'), msg = h('div', { class: 'out', translate: 'no' });
    root.appendChild(h('p', { class: 'w-note', html: '<code>Shape</code> declares three pure virtual functions. Tick the ones each derived class overrides.' }));
    root.appendChild(cards); root.appendChild(h('div', { class: 'w-grid' }, [code.box, msg]));
    function missing(cls) {
      return M.filter(function (m) { return !(cls === 'Shape' ? 0 : has.Rectangle[m] || (cls === 'Square' && has.Square[m])); });
    }
    function render() {
      cards.innerHTML = '';
      ['Shape', 'Rectangle', 'Square'].forEach(function (cls) {
        var miss = missing(cls), card = h('div', { class: 'ab-card ' + (miss.length ? 'abs' : 'conc') }, [
          h('div', { class: 'ab-head' }, [h('b', { text: cls }), h('span', { class: 'ab-badge', text: miss.length ? 'abstract' : 'concrete' })]),
          h('small', { text: cls === 'Shape' ? 'base class' : cls === 'Rectangle' ? ': public Shape' : ': public Rectangle' })
        ]);
        M.forEach(function (m) {
          if (cls === 'Shape') { card.appendChild(h('div', { class: 'ab-m', html: '<code>' + m + '() = 0</code>' })); return; }
          var id = 'ab-' + cls + '-' + m, inherited = cls === 'Square' && has.Rectangle[m] && !has.Square[m];
          var cb = h('input', { type: 'checkbox', id: id }); cb.checked = !!has[cls][m];
          cb.addEventListener('change', function () { has[cls][m] = cb.checked ? 1 : 0; render(); });
          card.appendChild(h('label', { class: 'ab-m', for: id }, [cb, h('code', { text: m + '()' }), inherited ? h('small', { text: ' inherited from Rectangle' }) : null]));
        });
        cards.appendChild(card);
      });
      var lines = ['class Shape {', 'public:', '    virtual ~Shape() = default;'];
      M.forEach(function (m) { lines.push('    virtual ' + SIG[m] + ' = 0;'); });
      lines.push('};');
      ['Rectangle', 'Square'].forEach(function (cls) {
        lines.push('class ' + cls + ' : public ' + (cls === 'Square' ? 'Rectangle' : 'Shape') + ' {', 'public:');
        lines.push(cls === 'Square' ? '    explicit Square(double s) : Rectangle(s, s) {}' : '    Rectangle(double w, double h) : w_(w), h_(h) {}');
        M.forEach(function (m) { if (has[cls][m]) lines.push('    ' + SIG[m] + ' override { ... }'); });
        if (cls === 'Rectangle') lines.push('protected:', '    double w_, h_;');
        lines.push('};');
      });
      var mainAt = lines.length;
      lines.push('int main() {', '    Rectangle r(2, 3);', '    Square sq(2);', '    Shape* p = &sq;   // always fine: pointers to abstract classes', '}');
      code.set(lines.join('\n'), [mainAt + 1, mainAt + 2]);
      // diagnostics in clang's wording (see the real message above): one error per variable, one note per missing function
      var diag = [], line = mainAt + 2, decl = { area: 4, perimeter: 5, name: 6 };
      [['Rectangle', 'r', 5], ['Square', 'sq', 9]].forEach(function (x, k) {
        var miss = missing(x[0]);
        if (!miss.length) return;
        diag.push('check.cpp:' + (line + k) + ':' + (x[0] === 'Square' ? 12 : 15) + ': error: variable type \'' + x[0] + '\' is an abstract class');
        miss.forEach(function (m) { diag.push('check.cpp:' + decl[m] + ':' + (m === 'name' ? 25 : 20) + ': note: unimplemented pure virtual method \'' + m + '\' in \'' + x[0] + '\''); });
      });
      msg.innerHTML = '<div class="out-head">' + (diag.length ? 'Compiler says' : 'Compiler says') + '</div><pre class="' + (diag.length ? 'err' : 'ok') + '">' + esc(diag.length ? diag.join('\n') + '\n' + (diag.filter(function (d) { return / error: /.test(d); }).length) + ' error' + (diag.filter(function (d) { return / error: /.test(d); }).length > 1 ? 's' : '') + ' generated.' : 'Compiled without errors: Rectangle and Square are concrete.') + '</pre>';
    }
    render();
  }

  /* ================================================================ quiz */
  function quiz(root) {
    var score = h('p', { class: 'quiz-score' }), right = 0, done = 0;
    D.quiz.forEach(function (q, n) {
      var res = h('div', { class: 'quiz-res', 'aria-live': 'polite' }), opts = h('div', { class: 'quiz-opts' });
      q.opts.forEach(function (o) {
        var b = h('button', { type: 'button', class: 'quiz-opt', text: o, translate: 'no', onclick: function () {
          if (opts.dataset.done) return; opts.dataset.done = '1'; done++;
          var ok = o === q.answer; if (ok) right++;
          [].forEach.call(opts.children, function (x) { x.disabled = true; if (x.textContent === q.answer) x.classList.add('right'); });
          if (!ok) b.classList.add('wrong');
          res.innerHTML = '<b>' + (ok ? 'Right.' : 'Not quite: it prints <code>' + esc(q.answer) + '</code>.') + '</b> ' + q.why + (q.ref ? ' <span class="quiz-ref">(' + q.ref + ')</span>' : '');
          res.className = 'quiz-res ' + (ok ? 'good' : 'bad');
          score.textContent = right + ' of ' + done + ' right so far' + (done === D.quiz.length ? ' · done' : '');
        } });
        opts.appendChild(b);
      });
      root.appendChild(h('div', { class: 'quiz-q' }, [h('div', { class: 'quiz-n', text: 'Question ' + (n + 1) }),
        h('div', { class: 'code', translate: 'no' }, [h('pre', null, [h('code', { html: q.html })])]), h('p', { class: 'quiz-ask', text: 'What does it print?' }), opts, res]));
    });
    root.appendChild(score);
  }

  /* ================================================================ copy / move: which special member runs? */
  function special(root) {
    var st = { c: 1, nx: 0 };
    var CASES = [
      [1, 'Buffer b = a;', 'Buffer a("a");\nBuffer b = a;', 'Initializing from an lvalue (a named object that is still in use) calls the <b>copy constructor</b>. The copy gets its own data; the name gains a prime.'],
      [2, 'Buffer b = std::move(a);', 'Buffer a("a");\nBuffer b = std::move(a);', '<code>std::move</code> turns <code>a</code> into an rvalue, so the <b>move constructor</b> runs and steals <code>a</code>\'s contents. <code>a</code> still exists, empty, until its destructor runs at the end of the scope.'],
      [3, 'b = a;', 'Buffer a("a"), b("b");\nb = a;', 'Both objects already exist, so this is <b>assignment</b>, not construction: copy assignment replaces <code>b</code>\'s contents with a copy of <code>a</code>\'s.'],
      [4, 'b = std::move(a);', 'Buffer a("a"), b("b");\nb = std::move(a);', '<b>Move assignment</b>: <code>b</code> takes <code>a</code>\'s contents and <code>a</code> is left empty.'],
      [5, 'Buffer a = make();', 'Buffer make() { return Buffer("tmp"); }\nBuffer a = make();', '<b>Guaranteed copy elision</b> (C++17): the temporary in <code>return</code> is built directly in <code>a</code>. No copy, no move.'],
      [6, 'by_value(a);', 'void by_value(Buffer b);\nBuffer a("a");\nby_value(a);', 'Passing an lvalue <b>by value</b> copies it into the parameter, which is destroyed when the function returns.'],
      [7, 'by_ref(a);', 'void by_ref(const Buffer& b);\nBuffer a("a");\nby_ref(a);', 'Passing by <code>const&amp;</code> copies nothing: the function sees the caller\'s object.'],
      [8, 'by_value(std::move(a));', 'void by_value(Buffer b);\nBuffer a("a");\nby_value(std::move(a));', 'Passing an rvalue by value <b>moves</b> it into the parameter: the usual way to hand over ownership to a function.'],
      [9, 'vector grows', 'std::vector<Buffer> v;\nv.push_back(Buffer("x"));\nv.push_back(Buffer("y"));   // capacity 1 -> 2: x must be transferred', null]
    ];
    var code = codeBox('special_lab.cpp (your choice)'), out = h('pre', { class: 'term-out' }), tally = h('p', { class: 'sp-tally' }), note = h('p', { class: 'w-note' });
    var list = h('div', { class: 'sp-cases', role: 'radiogroup', 'aria-label': 'Statement' });
    CASES.forEach(function (c) {
      var b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(c[0] === 1), translate: 'no', text: c[1], onclick: function () {
        [].forEach.call(list.children, function (x) { x.setAttribute('aria-checked', 'false'); }); b.setAttribute('aria-checked', 'true'); st.c = c[0]; render();
      } });
      list.appendChild(b);
    });
    root.appendChild(h('div', { class: 'w-controls' }, [seg('Move operations', [[0, 'may throw'], [1, '<code>noexcept</code>']], 0, function (v) { st.nx = v; render(); })]));
    root.appendChild(list);
    root.appendChild(h('div', { class: 'w-grid' }, [code.box, h('div', { class: 'w-side' }, [h('div', { class: 'out', translate: 'no' }, [h('div', { class: 'out-head', text: 'Output' }), out]), tally])]));
    root.appendChild(note);
    function render() {
      var c = CASES[st.c - 1];
      code.set('struct Buffer {          // owns some data; every special member prints\n    Buffer(Buffer&&)' + (st.nx ? ' noexcept' : '') + ';\n    Buffer& operator=(Buffer&&)' + (st.nx ? ' noexcept' : '') + ';\n    ...\n};\n\n' + c[2], [1, 2].concat(c[2].split('\n').map(function (_, i) { return 6 + i; })));
      var text = D.special[String(st.nx) + st.c] || '';
      out.innerHTML = esc(text.replace(/\n$/, '')).split('\n').map(function (l) {
        return /^COPY/.test(l) ? '<span class="sp-copy">' + l + '</span>' : /^move/.test(l) ? '<span class="sp-move">' + l + '</span>' : l;
      }).join('\n');
      var copies = (text.match(/^COPY/gm) || []).length, moves = (text.match(/^move/gm) || []).length;
      tally.innerHTML = '<b>' + copies + '</b> cop' + (copies === 1 ? 'y' : 'ies') + ' · <b>' + moves + '</b> move' + (moves === 1 ? '' : 's');
      var t = c[3];
      if (st.c === 9) t = st.nx
        ? 'With a <code>noexcept</code> move constructor, the growing vector <b>moves</b> <code>x</code> into its new memory: cheap.'
        : 'The vector needs room for a second element, so it allocates new memory and transfers <code>x</code>. Because the move constructor is not <code>noexcept</code>, it <b>copies</b> instead (if a move threw halfway, the old contents would be lost). Switch to <code>noexcept</code>.';
      note.innerHTML = t; note.className = 'w-note ' + (copies ? 'bad' : 'good');
    }
    render();
  }

  /* ================================================================ program stepper (recorded with LLDB) */
  function stepper(root) {
    var P = D.steps[root.getAttribute('data-prog')], N = P.stops.length, k = 0, timer = null, prevMap = {};
    var LINES = P.src.replace(/\n$/, '').split('\n'), HL = P.html;
    var codeBody = h('div', { class: 'st-code', translate: 'no' }), framesEl = h('div', { class: 'st-frames', translate: 'no' });
    var outEl = h('pre', { class: 'st-out', translate: 'no' }), label = h('span', { class: 'st-label' });
    var slider = h('input', { type: 'range', min: '0', max: String(N - 1), value: '0', 'aria-label': 'Step' });
    function btn(t, title, f) { return h('button', { type: 'button', class: 'btn', title: title, 'aria-label': title, text: t, onclick: f }); }
    var playB = btn('▶ Play', 'Play', function () { if (timer) stop(); else { if (k >= N - 1) go(0); timer = setInterval(function () { if (k >= N - 1) stop(); else go(k + 1); }, 650); playB.textContent = '❚❚ Pause'; } });
    function stop() { clearInterval(timer); timer = null; playB.textContent = '▶ Play'; }
    root.appendChild(h('div', { class: 'w-controls st-bar' }, [btn('⏮', 'First step', function () { stop(); go(0); }), btn('◀ Back', 'Previous step', function () { stop(); go(k - 1); }),
      btn('Next ▶', 'Next step', function () { stop(); go(k + 1); }), btn('⏭', 'Last step', function () { stop(); go(N - 1); }), playB, slider, label]));
    var rows = LINES.map(function (l, i) { var r = h('div', { class: 'st-row' }, [h('span', { class: 'st-n', text: i + 1 }), h('span', { class: 'st-l', html: HL[i] || ' ' })]); codeBody.appendChild(r); return r; });
    root.appendChild(h('div', { class: 'st-grid' }, [h('div', { class: 'st-pane' }, [h('div', { class: 'st-head', text: P.file + '  ·  ▶ = the line about to run' }), codeBody]),
      h('div', { class: 'st-pane' }, [h('div', { class: 'st-head', text: 'Call stack and variables (newest call on top)' }), framesEl])]));
    root.appendChild(h('div', { class: 'out', translate: 'no' }, [h('div', { class: 'out-head', text: 'Output so far' }), outEl]));
    slider.addEventListener('input', function () { stop(); go(+slider.value); });
    root.tabIndex = 0;
    root.addEventListener('keydown', function (e) { if (e.target.tagName === 'INPUT' && e.target !== slider) return; if (e.key === 'ArrowRight') { go(k + 1); e.preventDefault(); } if (e.key === 'ArrowLeft') { go(k - 1); e.preventDefault(); } });
    function uninit(v, f) { return !v.a && v.dl && (v.dl > f.line || v.dl === f.line && v.n !== 'this'); }
    function node(v, path, map, f) {
      var key = path + '/' + v.n; map[key] = v.s;
      var changed = prevMap[key] !== undefined && prevMap[key] !== v.s;
      var dead = f && uninit(v, f);
      var head = h('span', { class: 'st-var' + (changed ? ' changed' : '') + (dead ? ' dead' : '') }, [h('b', { text: v.n }), ' ', h('span', { class: 'st-t', text: v.t + (v.d && !dead ? '  (really a ' + v.d.replace(/ \*$/, '') + ')' : '') }), ' ',
        h('span', { class: 'st-s', text: dead ? 'not initialized yet' : (v.s || (v.c ? '' : '—')) })]);
      if (!v.c || dead) return h('div', { class: 'st-leaf' }, [head]);
      var det = h('details', { class: 'st-node' }, [h('summary', null, [head])]);
      if (openSet[key]) det.open = true;
      det.addEventListener('toggle', function () { openSet[key] = det.open; });
      v.c.forEach(function (c) { det.appendChild(node(c, key, map)); });
      return det;
    }
    var openSet = {};
    function go(n) {
      k = Math.max(0, Math.min(N - 1, n)); slider.value = k;
      var s = P.stops[k], map = {};
      label.textContent = 'step ' + (k + 1) + ' of ' + N;
      rows.forEach(function (r) { r.className = 'st-row'; });
      s.f.forEach(function (f, i) { var r = rows[f.line - 1]; if (r) r.className = 'st-row ' + (i === 0 ? 'cur' : 'caller'); });
      var cur = rows[s.f[0].line - 1];
      if (cur) { var body = codeBody; if (cur.offsetTop < body.scrollTop || cur.offsetTop > body.scrollTop + body.clientHeight - 30) body.scrollTop = cur.offsetTop - body.clientHeight / 3; }
      framesEl.innerHTML = '';
      s.f.forEach(function (f, i) {
        var card = h('div', { class: 'st-frame' + (i === 0 ? ' top' : '') }, [h('div', { class: 'st-fn' }, [h('b', { text: f.fn }), h('small', { text: '  line ' + f.line })])]);
        if (!f.vars.length) card.appendChild(h('div', { class: 'st-leaf st-none', text: 'no variables' }));
        f.vars.forEach(function (v) { card.appendChild(node(v, i + ':' + f.fn, map, f)); });
        framesEl.appendChild(card);
      });
      var prevOut = k ? P.stops[k - 1].out : '';
      outEl.innerHTML = esc(s.out.slice(0, prevOut.length)) + (s.out.length > prevOut.length && s.out.indexOf(prevOut) === 0 ? '<mark>' + esc(s.out.slice(prevOut.length)) + '</mark>' : esc(s.out.slice(prevOut.length)));
      outEl.scrollTop = outEl.scrollHeight;
      prevMap = map;
    }
    go(0);
  }

  /* ================================================================ "what if I write…?" (every line really compiled) */
  function tryLab(root) {
    var L = D.try[root.getAttribute('data-lab')], cur = 0;
    var list = h('div', { class: 'sp-cases', role: 'radiogroup', 'aria-label': 'Line to add' });
    var code = codeBox(L.file + ' + your line'), res = h('div', { class: 'out', translate: 'no' }), note = h('p', { class: 'w-note' });
    L.lines.forEach(function (e, i) {
      var b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(i === 0), translate: 'no', text: e.code.length > 46 ? e.code.slice(0, 44) + '…' : e.code, title: e.code, onclick: function () {
        [].forEach.call(list.children, function (x) { x.setAttribute('aria-checked', 'false'); }); b.setAttribute('aria-checked', 'true'); cur = i; render();
      } });
      list.appendChild(b);
    });
    root.appendChild(h('p', { class: 'w-note', html: 'Pick a line to add where the program says <code>/*TRY*/</code>. Each result is what the compiler and the program really did.' }));
    root.appendChild(list);
    root.appendChild(h('div', { class: 'w-grid' }, [code.box, h('div', { class: 'w-side' }, [res])]));
    root.appendChild(note);
    function render() {
      var e = L.lines[cur], lines = L.src.replace(/\n$/, '').split('\n'), at = -1;
      lines = lines.map(function (l, i) { if (l.indexOf('/*TRY*/') >= 0) { at = i; return l.replace('/*TRY*/', e.code); } return l; });
      code.set(lines.join('\n'), [at]);
      var html;
      if (e.error) html = '<div class="out-head">✗ Does not compile</div><pre class="err">' + esc(e.error) + '</pre>';
      else {
        html = '<div class="out-head">✓ Compiles' + (e.status ? ', then crashes' : ' and runs') + '</div>';
        if (e.warn) html += '<pre class="warnline">' + esc(e.warn) + '</pre>';
        html += '<pre class="' + (e.status ? 'err' : 'ok') + '">' + esc((e.out || '').replace(/\n$/, '') || '(no output)') + (e.status ? '\n[the program stopped: ' + esc(e.status) + ']' : '') + '</pre>';
      }
      res.innerHTML = html;
      note.innerHTML = e.why; note.className = 'w-note ' + (e.error || e.status || e.warn ? 'bad' : 'good');
    }
    render();
  }

  /* ================================================================ memory layout builder (24 real layouts) */
  function layoutLab(root) {
    var st = { bv: 1, bd: 0, sb: 0, fl: 0 };
    var code = codeBox('layout_lab.cpp (your choices)'), diag = h('div', { class: 'lay' }), sum = h('p', { class: 'w-note' });
    root.appendChild(h('div', { class: 'w-controls' }, [
      seg('Base has', [[1, 'a virtual function'], [0, 'no virtual function']], 1, function (v) { st.bv = v; render(); }),
      seg('Base data', [[0, 'none'], [1, '<code>double a</code>']], 0, function (v) { st.bd = v; render(); }),
      seg('Second base', [[0, 'no'], [1, '<code>Other</code> (virtual, <code>int o</code>)']], 0, function (v) { st.sb = v; render(); }),
      seg('<code>char flag</code>', [[0, 'none'], [1, 'before <code>r</code>'], [2, 'after <code>r</code>']], 0, function (v) { st.fl = v; render(); })
    ]));
    root.appendChild(h('div', { class: 'w-grid' }, [code.box, h('div', { class: 'w-side' }, [diag])]));
    root.appendChild(sum);
    var COL = { Base: 'base', Other: 'base2', Derived: 'own' };
    function render() {
      var L = D.layout['' + st.bv + st.bd + st.sb + st.fl];
      var src = 'struct Base {\n' + (st.bv ? '    virtual ~Base() = default;\n' : '') + (st.bd ? '    double a = 0;\n' : '') + '};\n' +
        (st.sb ? 'struct Other { virtual ~Other() = default; int o = 0; };\n' : '') +
        'struct Derived : Base' + (st.sb ? ', Other' : '') + ' {\n' + (st.fl === 1 ? '    char flag = 0;\n' : '') + '    double r = 0;\n' + (st.fl === 2 ? '    char flag = 0;\n' : '') + '};';
      code.set(src, []);
      var cells = L.cells.slice().sort(function (a, b) { return a[1] - b[1]; }), segs = [], pos = 0, pad = 0;
      cells.forEach(function (c) { if (c[1] > pos) { segs.push(['padding', pos, c[1] - pos, 'pad']); pad += c[1] - pos; } segs.push([c[0], c[1], c[2], COL[c[3]], c[3]]); pos = c[1] + c[2]; });
      if (L.size > pos) { segs.push(['padding', pos, L.size - pos, 'pad']); pad += L.size - pos; }
      diag.innerHTML = '';
      diag.appendChild(h('div', { class: 'lay-title', text: 'Derived: sizeof = ' + L.size + ' bytes' }));
      for (var row = 0; row < L.size; row += 8) {
        var r = h('div', { class: 'lay-row' }, [h('span', { class: 'lay-off', text: row })]), track = h('div', { class: 'lay-track' });
        segs.forEach(function (sg) {
          var a = Math.max(sg[1], row), b = Math.min(sg[1] + sg[2], row + 8);
          if (b > a) track.appendChild(h('div', { class: 'lay-cell ' + sg[3], style: 'flex:' + (b - a), title: sg[0] + (sg[4] ? ' (' + sg[4] + ' part)' : '') + ', bytes ' + a + '–' + (b - 1) }, [h('span', { text: (a === sg[1] ? sg[0] : '') + (a === sg[1] && sg[4] && sg[0] === 'vptr' ? ' (' + sg[4] + ')' : '') })]));
        });
        r.appendChild(track); diag.appendChild(r);
      }
      if (!L.size || segs.length === 0) diag.appendChild(h('p', { text: 'empty' }));
      var t = 'Measured: <b>' + L.size + ' bytes</b>' + (pad ? ', of which <b>' + pad + ' are padding</b> (gaps the compiler leaves so each member starts at a multiple of its alignment)' : ', no padding') + '.';
      if (!st.bv && !st.bd) t += ' The empty <code>Base</code> takes no space at all: the <b>empty base optimization</b>.';
      if (st.sb && !st.bv) t += ' <code>Other</code> is placed first although <code>Base</code> is listed first: the ABI puts a base with a vptr at offset 0 so the object\'s vptr is shared with it.';
      if (st.fl === 1) t += ' The 1-byte <code>flag</code> before an 8-byte double forces 7 bytes of padding; putting small members last (or grouping them) can save space.';
      if (st.bv && st.sb) t += ' Two polymorphic bases mean two vptrs.';
      sum.innerHTML = t;
    }
    render();
  }

  /* ================================================================ ownership visualizer (shared_ptr / weak_ptr semantics) */
  function ownership(root) {
    var S, log;
    function reset() { S = { v: { p: null, q: null, r: null }, w: null, o: {} }; log = []; }
    function alive(n) { return S.o[n] && S.o[n].alive; }
    function counts() {
      var c = {}; Object.keys(S.o).forEach(function (n) { c[n] = { s: 0, w: 0 }; });
      ['p', 'q', 'r'].forEach(function (k) { if (S.v[k]) c[S.v[k]].s++; });
      if (S.w && c[S.w]) c[S.w].w++;
      Object.keys(S.o).forEach(function (n) { var o = S.o[n]; if (!o.alive) return; if (o.next && c[o.next]) c[o.next].s++; if (o.back && c[o.back]) c[o.back].w++; });
      return c;
    }
    function collect() {
      for (;;) {
        var c = counts(), dead = Object.keys(S.o).filter(function (n) { return alive(n) && c[n].s === 0; });
        if (!dead.length) return;
        dead.forEach(function (n) { S.o[n].alive = false; log.push(['dtor', '~Node() ' + n + ' destroyed']); S.o[n].next = null; S.o[n].back = null; });
      }
    }
    function reachable() {
      var seen = {}, stack = ['p', 'q', 'r'].map(function (k) { return S.v[k]; }).filter(Boolean);
      while (stack.length) { var n = stack.pop(); if (seen[n] || !alive(n)) continue; seen[n] = 1; if (S.o[n].next) stack.push(S.o[n].next); }
      return seen;
    }
    var ACTIONS = [
      ['p = std::make_shared<Node>("A");', function () { return true; }, function () { if (S.o.A && alive('A')) { log.push(['note', 'A already exists in this demo']); return false; } S.o.A = { alive: true, next: null, back: null }; S.v.p = 'A'; }],
      ['q = std::make_shared<Node>("B");', function () { return true; }, function () { if (S.o.B && alive('B')) { log.push(['note', 'B already exists in this demo']); return false; } S.o.B = { alive: true, next: null, back: null }; S.v.q = 'B'; }],
      ['r = p;', function () { return S.v.p; }, function () { S.v.r = S.v.p; }],
      ['std::weak_ptr<Node> w = p;', function () { return S.v.p; }, function () { S.w = S.v.p; }],
      ['p->next = q;', function () { return S.v.p && S.v.q; }, function () { S.o[S.v.p].next = S.v.q; }],
      ['q->next = p;   // shared: a cycle', function () { return S.v.p && S.v.q; }, function () { S.o[S.v.q].next = S.v.p; S.o[S.v.q].back = null; }],
      ['q->back = p;   // weak: no cycle', function () { return S.v.p && S.v.q; }, function () { S.o[S.v.q].back = S.v.p; S.o[S.v.q].next = null; }],
      ['p.reset();', function () { return S.v.p; }, function () { S.v.p = null; }],
      ['q.reset();', function () { return S.v.q; }, function () { S.v.q = null; }],
      ['r.reset();', function () { return S.v.r; }, function () { S.v.r = null; }],
      ['auto s = w.lock();', function () { return S.w; }, function () { log.push(['lock', 'w.lock() → ' + (alive(S.w) ? 'a shared_ptr to ' + S.w + ' (it still exists)' : 'empty: ' + S.w + ' is gone (w.expired() is true)')]); return 'nolog'; }]
    ];
    var btns = h('div', { class: 'own-btns' }), svgWrap = h('div', { class: 'own-svg' }), logEl = h('div', { class: 'own-log', translate: 'no', 'aria-live': 'polite' }), note = h('p', { class: 'w-note' });
    root.appendChild(h('p', { class: 'w-note', html: 'Run lines of C++ in any order. Variables <code>p</code>, <code>q</code>, <code>r</code> are <code>std::shared_ptr&lt;Node&gt;</code>, <code>w</code> is a <code>std::weak_ptr&lt;Node&gt;</code>; each <code>Node</code> has a <code>shared_ptr next</code> and a <code>weak_ptr back</code>. The counts are what <code>use_count()</code> would report.' }));
    root.appendChild(btns);
    root.appendChild(h('div', { class: 'w-grid' }, [svgWrap, h('div', { class: 'w-side' }, [h('div', { class: 'out', translate: 'no' }, [h('div', { class: 'out-head', text: 'What ran' }), logEl])])]));
    root.appendChild(note);
    ACTIONS.forEach(function (a) {
      a.b = h('button', { type: 'button', class: 'g-chip', translate: 'no', text: a[0], onclick: function () { var r = a[2](); if (r !== false && r !== 'nolog') log.push(['code', a[0].replace(/\s+\/\/.*$/, '')]); collect(); render(); } });
      btns.appendChild(a.b);
    });
    btns.appendChild(h('button', { type: 'button', class: 'btn', text: 'Start over', onclick: function () { reset(); render(); } }));
    function render() {
      ACTIONS.forEach(function (a) { a.b.disabled = !a[1](); });
      var c = counts(), reach = reachable(), W = 540, H = 250, VY = { p: 40, q: 100, r: 160, w: 220 }, OY = { A: 70, B: 180 };
      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Pointers and objects"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="own-ah"/></marker></defs>';
      function arrow(x1, y1, x2, y2, cls, bend) {
        var mx = (x1 + x2) / 2 + (bend || 0), my = (y1 + y2) / 2;
        return '<path d="M' + x1 + ' ' + y1 + ' Q' + mx + ' ' + my + ' ' + x2 + ' ' + y2 + '" class="own-ar ' + cls + '" marker-end="url(#ah)"/>';
      }
      ['p', 'q', 'r', 'w'].forEach(function (k) {
        var t = k === 'w' ? S.w : S.v[k];
        svg += '<rect x="10" y="' + (VY[k] - 16) + '" width="70" height="32" rx="6" class="own-var"/><text x="45" y="' + (VY[k] + 5) + '" class="own-tx">' + k + (t ? '' : ' ∅') + '</text>';
        if (t && S.o[t]) svg += arrow(80, VY[k], 300, OY[t], k === 'w' ? 'weak' + (alive(t) ? '' : ' gone') : 'strong');
      });
      Object.keys(OY).forEach(function (n) {
        var o = S.o[n]; if (!o) return;
        var cls = !o.alive ? 'dead' : (reach[n] ? '' : 'leak');
        svg += '<rect x="300" y="' + (OY[n] - 38) + '" width="150" height="76" rx="8" class="own-obj ' + cls + '"/>';
        svg += '<text x="375" y="' + (OY[n] - 16) + '" class="own-tx b">Node ' + n + '</text>';
        svg += '<text x="375" y="' + (OY[n] + 4) + '" class="own-tx s">' + (o.alive ? 'strong ' + c[n].s + ' · weak ' + c[n].w : 'destroyed') + '</text>';
        if (cls === 'leak') svg += '<text x="375" y="' + (OY[n] + 24) + '" class="own-tx s leakt">leaked: unreachable</text>';
        if (o.alive && o.next) svg += arrow(450, OY[n] + (OY[o.next] > OY[n] ? 12 : -12), 452, OY[o.next] + (OY[o.next] > OY[n] ? -24 : 24), 'strong', 70);
        if (o.alive && o.back) svg += arrow(300, OY[n] + 10, 300, OY[o.back] + (OY[o.back] > OY[n] ? -20 : 20), 'weak', -45);
      });
      svgWrap.innerHTML = svg + '</svg><div class="own-key"><span class="k1">━ owns (shared_ptr)</span> <span class="k2">┄ observes (weak_ptr)</span></div>';
      logEl.innerHTML = log.length ? log.slice(-14).map(function (l) { return '<div class="own-' + l[0] + '">' + esc(l[1]) + '</div>'; }).join('') : '<div class="own-note">Start with p = std::make_shared…</div>';
      logEl.scrollTop = logEl.scrollHeight;
      var leaks = Object.keys(S.o).filter(function (n) { return alive(n) && !reach[n]; });
      note.innerHTML = leaks.length ? '<b>Leak.</b> ' + leaks.join(' and ') + ' can no longer be reached from any variable, but ' + (leaks.length > 1 ? 'they own each other' : 'it is still owned') + ', so the count never reaches zero and the destructor never runs. Use <code>back</code> (a <code>weak_ptr</code>) for one direction.'
        : 'An object is destroyed the moment its <b>strong</b> count drops to zero. Weak pointers do not count: <code>w.lock()</code> tells you whether the object still exists.';
      note.className = 'w-note ' + (leaks.length ? 'bad' : 'good');
    }
    reset(); render();
  }

  /* ================================================================ spot the bug */
  function spotBug(root) {
    var cur = 0, solved = {}, tries = {};
    var tabs = h('div', { class: 'sp-cases', role: 'tablist' }), body = h('div', { class: 'spot-body' }), score = h('p', { class: 'quiz-score' });
    root.appendChild(h('p', { class: 'w-note', html: 'Each program compiles and has one bug. <b>Click the line</b> you think is wrong.' }));
    root.appendChild(tabs); root.appendChild(body); root.appendChild(score);
    D.spot.forEach(function (s, i) { tabs.appendChild(h('button', { type: 'button', role: 'tab', 'aria-selected': String(i === 0), text: 'Bug ' + (i + 1), onclick: function () { cur = i; render(); } })); });
    function render() {
      [].forEach.call(tabs.children, function (b, i) { b.setAttribute('aria-selected', String(i === cur)); b.className = solved[i] ? 'solved' : ''; });
      var s = D.spot[cur]; body.innerHTML = '';
      var code = h('div', { class: 'code spot-code', translate: 'no' }, [h('div', { class: 'code-head' }, [h('span', { text: s.file })])]), pre = h('div', { class: 'spot-lines' });
      var msg = h('div', { class: 'spot-msg', 'aria-live': 'polite' });
      s.lines.forEach(function (l, i) {
        var n = i + 1, row = h('button', { type: 'button', class: 'spot-line' + (solved[cur] && n === s.bug ? ' right' : ''), 'aria-label': 'Line ' + n, html: '<span class="st-n">' + n + '</span><span>' + (l || ' ') + '</span>' });
        row.addEventListener('click', function () {
          if (solved[cur]) return;
          tries[cur] = (tries[cur] || 0) + 1;
          if (n === s.bug) { solved[cur] = tries[cur] === 1 ? 'first' : 'yes'; render(); }
          else { row.classList.add('wrong'); setTimeout(function () { row.classList.remove('wrong'); }, 600); msg.innerHTML = '<p class="w-note bad">Not line ' + n + '. ' + (tries[cur] >= 2 ? '<button type="button" class="btn">Show me</button>' : 'Try again.') + '</p>'; var sb = msg.querySelector('button'); if (sb) sb.onclick = function () { solved[cur] = 'shown'; render(); }; }
        });
        pre.appendChild(row);
      });
      code.appendChild(pre); body.appendChild(code); body.appendChild(msg);
      if (solved[cur]) {
        msg.innerHTML = '<p class="w-note ' + (solved[cur] === 'shown' ? 'bad' : 'good') + '"><b>' + (solved[cur] === 'shown' ? 'Line ' + s.bug + '.' : 'Found it: line ' + s.bug + '.') + '</b> ' + s.why + '</p><p class="spot-fix">Fix: <code>' + esc(s.fix) + '</code></p>' +
          (s.warn ? '<div class="out" translate="no"><div class="out-head">Compiler warning (-Wall -Wextra)</div><pre class="warnline">' + esc(s.warn) + '</pre></div>' : '<p class="spot-nowarn">The compiler gave no warning for this one.</p>') +
          '<div class="out" translate="no"><div class="out-head">What the program really printed</div><pre>' + esc(s.out.replace(/\n$/, '')) + '</pre></div>';
      }
      var n = Object.keys(solved).length, first = Object.keys(solved).filter(function (k) { return solved[k] === 'first'; }).length;
      score.textContent = n + ' of ' + D.spot.length + ' bugs found · ' + first + ' on the first click';
    }
    render();
  }

  /* ================================================================ ODE explorer (same methods as integrators.cpp) */
  function odeLab(root) {
    var st = { n: 5, on: { Euler: 1, Midpoint: 1, RK4: 1 } };
    var f = function (t, y) { return -y; }, exact = function (t) { return Math.exp(-t); };
    var M = {
      Euler: function (t, y, h) { return y + h * f(t, y); },
      Midpoint: function (t, y, h) { var k1 = f(t, y); return y + h * f(t + h / 2, y + h / 2 * k1); },
      RK4: function (t, y, h) { var k1 = f(t, y), k2 = f(t + h / 2, y + h / 2 * k1), k3 = f(t + h / 2, y + h / 2 * k2), k4 = f(t + h, y + h * k3); return y + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4); }
    };
    var COLORS = { Euler: 'var(--series-2)', Midpoint: 'var(--series-1)', RK4: 'var(--series-3)' };
    function solve(m, n) { var h = 1 / n, y = 1, pts = [[0, 1]]; for (var i = 0; i < n; i++) { y = M[m](i * h, y, h); pts.push([(i + 1) * h, y]); } return pts; }
    var slider = h('input', { type: 'range', min: '1', max: '40', value: '5', 'aria-label': 'Number of steps' }), nOut = h('b');
    var plot = h('div', { class: 'ode-plot' }), table = h('div', { class: 'table-wrap' });
    var boxes = Object.keys(M).map(function (m) {
      var cb = h('input', { type: 'checkbox' }); cb.checked = true;
      cb.addEventListener('change', function () { st.on[m] = cb.checked; render(); });
      return h('label', { class: 'ode-m' }, [cb, h('span', { class: 'ode-sw', style: 'background:' + COLORS[m] }), m]);
    });
    slider.addEventListener('input', function () { st.n = +slider.value; render(); });
    root.appendChild(h('div', { class: 'w-controls' }, [h('label', { class: 'ode-n' }, ['Steps n = ', nOut, ' ', slider])].concat(boxes)));
    root.appendChild(plot); root.appendChild(table);
    root.appendChild(h('p', { class: 'w-note', html: 'Solving <i>y\' = −y</i>, <i>y(0) = 1</i> on [0, 1] with the same three <code>Stepper</code> classes as <code>integrators.cpp</code>, rewritten in JavaScript. At n = 10 the errors match the C++ output above. Halving the step divides the error by about 2<sup>p</sup>: watch the last column approach 2, 4 and 16.' }));
    function render() {
      nOut.textContent = st.n;
      var W = 640, H = 300, L = 46, R = 12, T = 12, B = 34, y0 = 0.3, y1 = 1.02;
      function X(t) { return L + t * (W - L - R); }
      function Y(y) { return T + (y1 - y) / (y1 - y0) * (H - T - B); }
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Numerical solutions compared with the exact solution">';
      [0.4, 0.6, 0.8, 1.0].forEach(function (g) { s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(g) + '" y2="' + Y(g) + '" class="ode-grid"/><text x="' + (L - 6) + '" y="' + (Y(g) + 4) + '" class="ode-ax" text-anchor="end">' + g.toFixed(1) + '</text>'; });
      [0, 0.25, 0.5, 0.75, 1].forEach(function (g) { s += '<text x="' + X(g) + '" y="' + (H - 12) + '" class="ode-ax" text-anchor="middle">' + g + '</text>'; });
      var ex = []; for (var i = 0; i <= 100; i++) ex.push(X(i / 100) + ',' + Y(exact(i / 100)));
      s += '<polyline points="' + ex.join(' ') + '" class="ode-exact"/>';
      Object.keys(M).forEach(function (m) {
        if (!st.on[m]) return;
        var pts = solve(m, st.n);
        s += '<polyline points="' + pts.map(function (p) { return X(p[0]) + ',' + Y(p[1]); }).join(' ') + '" fill="none" stroke="' + COLORS[m] + '" stroke-width="2"/>';
        if (st.n <= 20) pts.forEach(function (p) { s += '<circle cx="' + X(p[0]) + '" cy="' + Y(p[1]) + '" r="3" fill="' + COLORS[m] + '"/>'; });
      });
      s += '<line x1="' + (W - R - 150) + '" x2="' + (W - R - 122) + '" y1="' + (T + 10) + '" y2="' + (T + 10) + '" class="ode-exact"/><text x="' + (W - R) + '" y="' + (T + 14) + '" class="ode-ax" text-anchor="end">exact: e^(−t)</text></svg>';
      plot.innerHTML = s;
      var rows = Object.keys(M).map(function (m) {
        var e1 = Math.abs(solve(m, st.n)[st.n][1] - exact(1)), e2 = Math.abs(solve(m, 2 * st.n)[2 * st.n][1] - exact(1));
        return '<tr><td><span class="ode-sw" style="background:' + COLORS[m] + '"></span>' + m + '</td><td>' + e1.toExponential(3) + '</td><td>' + e2.toExponential(3) + '</td><td>' + (e1 / e2).toFixed(1) + '</td></tr>';
      }).join('');
      table.innerHTML = '<table><thead><tr><th>method</th><th>error at t=1, n=' + st.n + '</th><th>n=' + 2 * st.n + '</th><th>ratio</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }
    render();
  }

  /* ================================================================ live Observer (mirrors observer.cpp) */
  function observerLab(root) {
    var subs = { Display: true, Alarm: true, Average: true }, limit = 30, sum = 0, n = 0, lines = [];
    function g6(x) { var s = Number(x.toPrecision(6)); return String(s); }
    var temp = h('input', { type: 'range', min: '0', max: '45', step: '0.5', value: '21.5', 'aria-label': 'Temperature' }), tOut = h('b', { text: '21.5' });
    var lim = h('input', { type: 'range', min: '15', max: '40', step: '1', value: '30', 'aria-label': 'Alarm limit' }), lOut = h('b', { text: '30' });
    var logEl = h('pre', { class: 'term-out', translate: 'no' });
    var toggles = Object.keys(subs).map(function (k) {
      var b = h('button', { type: 'button', role: 'switch', 'aria-checked': 'true', text: k, onclick: function () { subs[k] = !subs[k]; b.setAttribute('aria-checked', String(subs[k])); push('[' + k + (subs[k] ? ' subscribed' : ' unsubscribed: observer.cpp has no unsubscribe(), a real one would remove it from the list') + ']', 'c'); } });
      return b;
    });
    root.appendChild(h('div', { class: 'w-controls' }, [h('label', { class: 'ode-n' }, ['Temperature ', tOut, ' °C ', temp]), h('button', { type: 'button', class: 'btn primary', text: 's.measure(t)', onclick: measure }),
      h('label', { class: 'ode-n' }, ['Alarm limit ', lOut, ' ', lim])]));
    root.appendChild(h('div', { class: 'w-controls' }, [h('span', { class: 'seg-label', text: 'Subscribed' })].concat(toggles.map(function (b) { b.className = 'obs-t'; return b; }))));
    root.appendChild(h('div', { class: 'out', translate: 'no' }, [h('div', { class: 'out-head', text: 'Output (same format as observer.cpp)' }), logEl]));
    root.appendChild(h('p', { class: 'w-note', html: 'The <code>Sensor</code> only knows the <code>Observer</code> interface. Each subscribed object reacts in its own way; unsubscribed ones hear nothing. Adding a fourth kind of observer would not change <code>Sensor</code> at all.' }));
    temp.addEventListener('input', function () { tOut.textContent = temp.value; });
    temp.addEventListener('change', measure);
    lim.addEventListener('input', function () { limit = +lim.value; lOut.textContent = lim.value; });
    function push(t, c) { lines.push([t, c]); if (lines.length > 40) lines.shift(); logEl.innerHTML = lines.map(function (l) { return '<span class="obs-' + (l[1] || '') + '">' + esc(l[0]) + '</span>'; }).join('\n'); logEl.scrollTop = logEl.scrollHeight; }
    function measure() {
      var t = +temp.value;
      push('sensor reads ' + g6(t), 'r');
      if (subs.Display) push('  display: ' + g6(t) + ' C');
      if (subs.Alarm && t > limit) push('  ALARM: above ' + g6(limit) + ' C', 'a');
      if (subs.Average) { sum += t; n++; push('  running mean: ' + g6(sum / n)); }
    }
  }

  /* ================================================================ which mechanism? */
  function chooser(root) {
    var Q = [
      ['A physics code reads "solver = rk4" from an input file and must accept new solvers written later as plug-ins.', 0, 'The type is chosen at run time from data, and the set must stay open to new classes: virtual functions behind an abstract <code>Solver</code>, created by a factory.'],
      ['A sum over ten million grid cells of a field whose type (<code>double</code> or <code>float</code>) is fixed when the program is built.', 1, 'Known at compile time and in the innermost loop: a template, so each call is direct and can be inlined and vectorized.'],
      ['A parser produces tokens that are exactly one of: number, name, operator, parenthesis. New operations on tokens are added often; new kinds of token almost never.', 2, 'A closed set of types with many operations: <code>std::variant</code> plus <code>std::visit</code>, which also checks that every alternative is handled.'],
      ['A GUI toolkit where users of your library derive their own widgets from <code>Widget</code> and you store them all in one list.', 0, 'Users add types you never see: an open hierarchy, so virtual functions and a container of <code>std::unique_ptr&lt;Widget&gt;</code>.'],
      ['Several small math types (vector, matrix, quaternion) should all get <code>print()</code> and <code>norm()</code> built from one shared implementation, with no run-time cost.', 1, 'Code reuse resolved at compile time: CRTP (or a function template constrained by a concept).'],
      ['A simulation keeps a list of particles that can be electrons, protons or neutrons, stored by value for cache efficiency.', 2, 'A fixed, small set stored by value: <code>std::vector&lt;std::variant&lt;Electron, Proton, Neutron&gt;&gt;</code>, no pointers and no heap allocation per particle.']
    ];
    var OPTS = ['virtual functions', 'templates / CRTP', 'std::variant'], right = 0, done = 0, score = h('p', { class: 'quiz-score' });
    Q.forEach(function (q, i) {
      var res = h('div', { class: 'quiz-res' }), opts = h('div', { class: 'quiz-opts' });
      OPTS.forEach(function (o, j) {
        var b = h('button', { type: 'button', class: 'quiz-opt', text: o, onclick: function () {
          if (opts.dataset.done) return; opts.dataset.done = 1; done++; if (j === q[1]) right++;
          [].forEach.call(opts.children, function (x, xi) { x.disabled = true; if (xi === q[1]) x.classList.add('right'); });
          if (j !== q[1]) b.classList.add('wrong');
          res.innerHTML = '<b>' + (j === q[1] ? 'Yes.' : 'Better: ' + OPTS[q[1]] + '.') + '</b> ' + q[2]; res.className = 'quiz-res ' + (j === q[1] ? 'good' : 'bad');
          score.textContent = right + ' of ' + done + ' matched';
        } });
        opts.appendChild(b);
      });
      root.appendChild(h('div', { class: 'quiz-q' }, [h('div', { class: 'quiz-n', text: 'Scenario ' + (i + 1) }), h('p', { class: 'quiz-ask', text: q[0] }), opts, res]));
    });
    root.appendChild(score);
  }

  /* ================================================================ GDB playground */
  function gdb(root) {
    var G = D.gdb, mid = 'm1', prog = 'bug', M, P, T, SRC, LINES, S, FIELDS, TYPES, SIGS, CLSRE;
    var PATH, FILE;
    var FIXMSG = { m1: 'line 21 now reads  Rectangle(double w, double h) : w_(w), h_(h) {}', m2: 'line 22 now reads  double area() const override {' };

    // ---------- layout
    var srcPane = h('div', { class: 'g-src', translate: 'no' }), term = h('div', { class: 'g-term', translate: 'no' });
    var outEl = h('div', { class: 'g-out', 'aria-live': 'polite' }), input = h('input', { class: 'g-in', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'GDB command' });
    term.appendChild(outEl); term.appendChild(h('label', { class: 'g-line' }, [h('span', { class: 'g-prompt', text: '(gdb) ' }), input]));
    var stackEl = h('div', { class: 'g-panel-body' }), localsEl = h('div', { class: 'g-panel-body' });
    var misSeg = seg('Mission', [['m1', '1 · the wrong rectangle'], ['m2', '2 · the missing triangle']], 'm1', function (v) { switchMission(v); });
    var progSeg = seg('Program', [['bug', 'as written (buggy)'], ['fixed', 'with the fix applied']], 'bug', function (v) { switchProg(v); });
    var bar = h('div', { class: 'w-controls' }, [misSeg, progSeg, h('button', { type: 'button', class: 'btn', text: 'Reset session', onclick: function () { reset(true); } })]);
    var mission = h('div', { class: 'g-mission' });
    root.appendChild(bar);
    root.appendChild(h('div', { class: 'g-grid' }, [srcPane, term]));
    root.appendChild(h('div', { class: 'g-panels' }, [
      h('div', { class: 'g-panel' }, [h('div', { class: 'g-panel-head', text: 'Call stack' }), stackEl]),
      h('div', { class: 'g-panel' }, [h('div', { class: 'g-panel-head', text: 'Locals (selected frame)' }), localsEl])]));
    root.appendChild(mission);
    term.addEventListener('click', function () { if (!window.getSelection().toString()) input.focus({ preventScroll: true }); });

    // ---------- output
    function print(text, cls) {
      var el = h('div', { class: 'g-o ' + (cls || '') }); el.textContent = text; outEl.appendChild(el);
      while (outEl.childNodes.length > 600) outEl.removeChild(outEl.firstChild);
      term.scrollTop = term.scrollHeight;
    }

    // ---------- trace helpers
    function stop(k) { return T.stops[k]; }
    function depth(k) { return T.stops[k].f.length; }
    function lineStart(k) {
      if (k === 0) return true;
      var a = stop(k - 1), b = stop(k);
      if (b.f.length > a.f.length) return true;
      return b.f.length === a.f.length && (a.f[0].line !== b.f[0].line || a.f[0].fn !== b.f[0].fn);
    }
    function entered(k) { return k === 0 || depth(k) > depth(k - 1); }
    var FUNCS;   // fn -> {line, pc}
    function indexFuncs() {
      FUNCS = {};
      T.stops.forEach(function (s, k) { if (entered(k) && !FUNCS[s.f[0].fn]) FUNCS[s.f[0].fn] = { line: s.f[0].line, pc: s.f[0].pc }; });
    }
    function lineHasCode(n) { for (var k = 0; k < T.stops.length; k++) if (lineStart(k) && stop(k).f[0].line === n) return stop(k).f[0].pc; return null; }

    // ---------- values
    function fmtNum(x) {
      if (Number.isInteger(x) && Math.abs(x) < 1e16) return String(x);
      var s = x.toPrecision(17);
      if (s.indexOf('e') >= 0) { var p = s.split('e'); return p[0].replace(/\.?0+$/, '') + 'e' + p[1]; }
      return s.replace(/\.?0+$/, '');
    }
    function cls(t) { return t.replace(/\b(const|\*|&)\b|[*&]/g, '').replace(/\s+/g, ' ').trim(); }
    function dynType(addr, fallback) {
      var o = S.cur && stop(S.cur.k).o[addr];
      if (o && o.sym && /^vtable for (\w+)\+16$/.test(o.sym)) return o.sym.match(/^vtable for (\w+)/)[1];
      return fallback;
    }
    function obj(addr) { return stop(S.cur.k).o[addr]; }
    function fieldVal(addr, name) {
      var o = obj(addr); if (!o) return null;
      for (var i = 0; i < o.fields.length; i++) if (o.fields[i][0] === name) return o.fields[i][1];
      return null;
    }
    function vptrStr(addr) { var o = obj(addr); return o ? o.vptr + (o.sym ? ' <' + o.sym + '>' : '') : '<unavailable>'; }
    function objBody(addr, type, pretty, ind) {
      ind = ind || '';
      var vp = '_vptr.Shape = ' + vptrStr(addr);
      if (type === 'Shape') return pretty ? '{\n' + ind + '  ' + vp + '\n' + ind + '}' : '{' + vp + '}';
      var fs = FIELDS[type].map(function (f) { var v = fieldVal(addr, f); return f + ' = ' + (v == null ? '<optimized out>' : v); });
      if (pretty) return '{\n' + ind + '  <Shape> = ' + objBody(addr, 'Shape', true, ind + '  ') + ',\n' + ind + '  members of ' + type + ':\n' + fs.map(function (f) { return ind + '  ' + f; }).join(',\n') + '\n' + ind + '}';
      return '{<Shape> = ' + objBody(addr, 'Shape') + ', ' + fs.join(', ') + '}';
    }
    function vecStr(els) { return 'std::vector of length ' + els.length + ', capacity ' + els.length + (els.length ? ' = {' + els.join(', ') + '}' : ''); }
    // a value: {k:'num', v, s, t} | {k:'ptr', addr, t (static, e.g. 'const Shape *')} | {k:'obj', addr, t} | {k:'vec', els, t}
    function fromRec(r) {
      if (r.k === 'val') return { k: 'num', v: parseFloat(r.v), s: r.v, t: r.t };
      if (r.k === 'ptr') return { k: 'ptr', addr: r.v, t: r.t };
      if (r.k === 'vec') return { k: 'vec', els: r.v, t: r.t };
      return { k: 'obj', addr: r.v, t: r.t };
    }
    function show(v, top) {   // top: print-style, with (type) prefixes on pointers
      if (v.k === 'num') return v.s;
      if (v.k === 'vec') return vecStr(v.els);
      if (v.k === 'ptr') {
        if (!top) return v.addr;
        var t = v.t;
        if (S.printObject) { var d = dynType(v.addr, null); if (d) t = t.replace(CLSRE, d); }
        return '(' + t + ') ' + v.addr;
      }
      var st = cls(v.t), dt = S.printObject ? dynType(v.addr, st) : st;
      return (dt !== st ? '(' + dt + ') ' : '') + objBody(v.addr, dt, S.pretty);
    }

    // ---------- expression evaluator
    function EvalError(m) { this.message = m; }
    function lookup(name) {
      var f = stop(S.cur.k).f[S.cur.sel];
      var all = f.locals.concat(f.args);
      for (var i = 0; i < all.length; i++) if (all[i].n === name) return fromRec(all[i]);
      var th = f.args.filter(function (a) { return a.n === 'this'; })[0];
      if (th) { var c = cls(th.t); if (FIELDS[c] && FIELDS[c].indexOf(name) >= 0) return member(fromRec(th), name, true); }
      throw new EvalError('No symbol "' + name + '" in current context.');
    }
    function deref(v) {
      if (v.k !== 'ptr') throw new EvalError('Attempt to take contents of a non-pointer value.');
      if (!obj(v.addr)) throw new EvalError('Cannot access memory at address ' + v.addr);
      return { k: 'obj', addr: v.addr, t: v.t.replace(/\s*\*\s*(const)?\s*$/, '') };
    }
    function member(v, name, arrow) {
      if (arrow) v = deref(v);
      if (v.k !== 'obj') throw new EvalError('Attempt to extract a component of a value that is not a structure' + (arrow ? ' pointer.' : '.'));
      var c = cls(v.t);
      if (FIELDS[c].indexOf(name) < 0) throw new EvalError('There is no member named ' + name + '.');
      var s = fieldVal(v.addr, name);
      return { k: 'num', v: parseFloat(s), s: s, t: 'double' };
    }
    function callMethod(v, name, arrow) {
      if (arrow) v = deref(v);
      var st = cls(v.t), sym = (P.nonvirtual[st] || {})[name];   // a non-virtual function of the static type is called directly
      if (!sym) {                                                 // otherwise: a virtual call, through the object's vtable
        var d = dynType(v.addr, null);
        if (!d) throw new EvalError('Cannot call a virtual function on an object whose vtable pointer is not set yet.');
        ((T.vt[d] || {}).entries || []).forEach(function (e) { if (e.sym.indexOf('::' + name + '(') >= 0) sym = e.sym; });
      }
      var f = sym && M.formulas[sym];
      if (!f) throw new EvalError('Couldn\'t find method ' + st + '::' + name);
      var r = 1;
      f.forEach(function (x) { r *= typeof x === 'number' ? x : parseFloat(fieldVal(v.addr, x)); });
      return { k: 'num', v: r, s: fmtNum(r), t: 'double' };
    }
    function evaluate(src) {
      var toks = src.match(/\s*(0x[0-9a-fA-F]+|\d+\.\d*(?:e[-+]?\d+)?|\d+|\$\d*|[A-Za-z_]\w*(?:::\w+)*|->|[-+*\/&().\[\]])\s*/g);
      if (!toks || toks.join('') !== src) throw new EvalError('A syntax error in expression, near `' + src + '\'.');
      toks = toks.map(function (t) { return t.trim(); });
      var i = 0;
      function peek() { return toks[i]; }
      function eat(t) { if (toks[i] !== t) throw new EvalError('A syntax error in expression, near `' + toks.slice(i).join(' ') + '\'.'); i++; }
      function add() {
        var l = mul();
        while (peek() === '+' || peek() === '-') { var op = toks[i++], r = mul(); l = arith(l, op, r); }
        return l;
      }
      function mul() {
        var l = unary();
        while (peek() === '*' || peek() === '/') { var op = toks[i++], r = unary(); l = arith(l, op, r); }
        return l;
      }
      function arith(a, op, b) {
        if (a.k !== 'num' || b.k !== 'num') throw new EvalError('Argument to arithmetic operation not a number or boolean.');
        var ints = a.t === 'int' && b.t === 'int';
        var r = op === '+' ? a.v + b.v : op === '-' ? a.v - b.v : op === '*' ? a.v * b.v : (ints ? Math.trunc(a.v / b.v) : a.v / b.v);
        if (op === '/' && ints && b.v === 0) throw new EvalError('Division by zero');
        return { k: 'num', v: r, s: fmtNum(r), t: ints ? 'int' : 'double' };
      }
      function unary() {
        var t = peek();
        if (t === '*') { i++; return deref(unary()); }
        if (t === '-') { i++; var v = unary(); return arith({ k: 'num', v: 0, s: '0', t: v.t }, '-', v); }
        if (t === '&') {
          i++; var o = unary();
          if (o.k !== 'obj') throw new EvalError('Attempt to take address of value not located in memory.');
          return { k: 'ptr', addr: o.addr, t: o.t + ' *' };
        }
        if (t === '(' && (toks[i + 1] === 'const' || FIELDS.hasOwnProperty(toks[i + 1]))) {   // cast
          i++; var ty = '';
          while (peek() !== ')' && i < toks.length) ty += (ty && toks[i] !== '*' ? ' ' : ' ') + toks[i++];
          eat(')'); ty = ty.trim().replace(/\s*\*$/, ' *');
          var x = unary();
          if (x.k !== 'ptr' || !/\*$/.test(ty)) throw new EvalError('Invalid cast.');
          return { k: 'ptr', addr: x.addr, t: ty };
        }
        return postfix();
      }
      function postfix() {
        var v = primary();
        for (;;) {
          var t = peek();
          if (t === '.' || t === '->') {
            i++; var name = toks[i++];
            if (!/^[A-Za-z_]\w*$/.test(name || '')) throw new EvalError('A syntax error in expression.');
            if (peek() === '(') { eat('('); eat(')'); v = callMethod(v, name, t === '->'); }
            else v = member(v, name, t === '->');
          } else if (t === '[') {
            i++; var n = add(); eat(']');
            if (v.k !== 'vec') throw new EvalError('cannot subscript something of type `' + (v.t || 'double') + '\'');
            if (n.v < 0 || n.v >= v.els.length) throw new EvalError('Cannot access memory: index ' + n.v + ' is past the end of a vector of length ' + v.els.length + '.');
            v = { k: 'ptr', addr: v.els[n.v], t: 'Shape *' };
          } else return v;
        }
      }
      function primary() {
        var t = toks[i++];
        if (t === undefined) throw new EvalError('A syntax error in expression, near `\'.');
        if (t === '(') { var v = add(); eat(')'); return v; }
        if (/^0x/.test(t)) return { k: 'num', v: parseInt(t, 16), s: String(parseInt(t, 16)), t: 'int' };
        if (/^\d+$/.test(t)) return { k: 'num', v: +t, s: t, t: 'int' };
        if (/^\d/.test(t)) return { k: 'num', v: +t, s: fmtNum(+t), t: 'double' };
        if (t[0] === '$') {
          var n = t === '$' ? S.hist.length : +t.slice(1);
          if (!S.hist.length) throw new EvalError('History is empty.');
          if (!(n >= 1 && n <= S.hist.length)) throw new EvalError('History has not yet reached $' + n + '.');
          return S.hist[n - 1];
        }
        if (t === 'this' || /^[A-Za-z_]\w*$/.test(t)) {
          if (peek() === '(' && toks[i + 1] === ')') { i += 2; return callMethod(lookup('this'), t, true); }
          return lookup(t);
        }
        throw new EvalError('No symbol "' + t + '" in current context.');
      }
      var r = add();
      if (i < toks.length) throw new EvalError('A syntax error in expression, near `' + toks.slice(i).join('') + '\'.');
      return r;
    }

    // ---------- frames, stops
    function argStr(f) { return f.args.map(function (a) { return a.n + '=' + show(fromRec(a), false); }).join(', '); }
    function frameLine(k, idx, num) {
      var f = stop(k).f[idx], s = f.fn + ' (' + argStr(f) + ') at ' + FILE + ':' + f.line;
      if (num) return '#' + idx + '  ' + (idx > 0 ? pc16(f.pc) + ' in ' : '') + s;
      return s;
    }
    function pc16(pc) { return '0x' + ('0000000000000000' + pc.slice(2)).slice(-16); }
    function srcLine(n) { return n + '\t' + (LINES[n - 1] || ''); }
    function running() { return S.cur !== null; }
    function shownOutput(k) {   // program output produced up to stop k
      var o = k === null ? T.stdout : stop(k).out;
      if (o.length > S.outShown) { print(o.slice(S.outShown).replace(/\n$/, ''), 'prog'); S.outShown = o.length; }
    }
    function arrive(k, how) {
      var prev = S.cur ? S.cur.k : null;
      S.cur = { k: k, sel: 0 };
      shownOutput(k);
      var f = stop(k).f[0];
      if (how.bp) {
        print('');
        print((how.bp.temp ? 'Temporary breakpoint ' : 'Breakpoint ') + how.bp.num + ', ' + frameLine(k, 0));
      } else if (how.watch) {
        print(''); print('Hardware watchpoint ' + how.watch.num + ': ' + how.watch.expr); print('');
        print('Old value = ' + how.old); print('New value = ' + how.now);
        print(frameLine(k, 0));
      } else if (how.finish) {
        print(pc16(f.pc) + ' in ' + frameLine(k, 0));
      } else if (prev === null || depth(k) !== depth(prev) || stop(prev).f[0].fn !== f.fn) {
        print(frameLine(k, 0));
      }
      print(srcLine(f.line));
      if (how.ret != null) { var rv = { k: 'num', v: parseFloat(how.ret), s: how.ret, t: 'double' }; S.hist.push(rv); print('Value returned is $' + S.hist.length + ' = ' + how.ret); }
      doDisplays();
      S.listNext = null;
      paint();
    }
    function exitProgram() {
      shownOutput(null);
      S.watches.forEach(function (w) {
        print(''); print('Watchpoint ' + w.num + ' deleted because the program has left the block in'); print('which its expression is valid.');
      });
      S.bps = S.bps.filter(function (b) { return !b.watch; }); S.watches = [];
      print('[Inferior 1 (process ' + S.pid + ') exited normally]');
      S.cur = null; S.outShown = 0; paint();
    }
    function bpAt(k) {
      if (!lineStart(k) || (k > 0 && depth(k) < depth(k - 1))) return null;
      var f = stop(k).f[0];
      for (var i = 0; i < S.bps.length; i++) {
        var b = S.bps[i];
        if (b.enabled && !b.watch && b.lines.indexOf(f.line) >= 0) return b;
      }
      return null;
    }
    function watchAt(k) {
      for (var i = 0; i < S.watches.length; i++) {
        var w = S.watches[i];
        if (depth(k) < w.depth) return { gone: w };
        var save = S.cur; S.cur = { k: k, sel: depth(k) - w.depth };
        var now; try { now = show(evaluate(w.expr), false); } catch (e) { now = w.old; }
        S.cur = save;
        if (now !== w.old) { var old = w.old; w.old = now; return { w: w, old: old, now: now }; }
      }
      return null;
    }
    // advance from the current stop until want(k) is true, a breakpoint or a watchpoint triggers, or the program ends
    function go(want, opts) {
      opts = opts || {};
      for (var k = S.cur.k + 1; k < T.stops.length; k++) {
        var w = watchAt(k);
        if (w && w.gone) {
          S.cur = { k: k, sel: 0 };
          print(''); print('Watchpoint ' + w.gone.num + ' deleted because the program has left the block in'); print('which its expression is valid.');
          S.watches.splice(S.watches.indexOf(w.gone), 1); S.bps.splice(S.bps.indexOf(w.gone), 1);
          shownOutput(k); print(pc16(stop(k).f[0].pc) + ' in ' + frameLine(k, 0)); print(srcLine(stop(k).f[0].line)); doDisplays(); paint();
          return;
        }
        if (w) { w.w.hits++; arrive(k, { watch: w.w, old: w.old, now: w.now }); return; }
        var b = bpAt(k);
        if (b) {
          b.hits++;
          if (b.temp) S.bps.splice(S.bps.indexOf(b), 1);
          arrive(k, { bp: b }); return;
        }
        if (want(k)) { arrive(k, opts.finishRet !== undefined ? { finish: true, ret: opts.finishRet } : {}); return; }
      }
      exitProgram();
    }

    // ---------- commands
    function needRun() { if (!running()) { print('The program is not being run.'); return true; } return false; }
    function needFrame() { if (!running()) { print('No frame selected.'); return true; } return false; }
    function resolveLoc(arg) {
      arg = arg.replace(/^\w+\.cpp:/, '');
      if (/^\d+$/.test(arg)) {
        var n = +arg;
        if (n < 1 || n > LINES.length) return { err: 'Line ' + n + ' out of range; "' + FILE + '" has ' + LINES.length + ' lines.' };
        for (var m = n; m <= LINES.length; m++) { var pc = lineHasCode(m); if (pc) return { lines: [m], pc: pc, desc: 'file ' + FILE + ', line ' + m + '.' }; }
        return { err: 'No line ' + n + ' in the current file.' };
      }
      var names = Object.keys(FUNCS).filter(function (fn) { return fn === arg || fn.slice(-arg.length - 2) === '::' + arg; });
      if (!names.length) {
        var meth = arg.split('::').pop();
        if (new RegExp('\\b' + meth + '\\s*\\(').test(SRC)) return { err: 'Function "' + arg + '" is in the source but never runs in this recording, so the playground has no address for it. (Real GDB would set the breakpoint.)' };
        return { err: 'Function "' + arg + '" not defined.' };
      }
      if (names.length > 1) return { lines: names.map(function (n) { return FUNCS[n].line; }), pc: FUNCS[names[0]].pc, desc: arg + '. (' + names.length + ' locations)', multi: true };
      return { lines: [FUNCS[names[0]].line], pc: FUNCS[names[0]].pc, desc: 'file ' + FILE + ', line ' + FUNCS[names[0]].line + '.' };
    }
    function cmdBreak(arg, temp) {
      if (!arg) {
        if (!running()) { print('No default breakpoint location now selected.'); return; }
        arg = String(stop(S.cur.k).f[S.cur.sel].line);
      }
      var r = resolveLoc(arg);
      if (r.err) { print(r.err); return; }
      var b = { num: S.nextBp++, lines: r.lines, pc: r.pc, enabled: true, hits: 0, temp: temp, what: 'in ' + sig(funcAtLine(r.lines[0])) + ' at ' + FILE + ':' + r.lines[0] };
      S.bps.push(b);
      print((temp ? 'Temporary breakpoint ' : 'Breakpoint ') + b.num + ' at ' + r.pc + (r.multi ? ': ' : ': ') + r.desc);
      paint();
    }
    function sig(fn) { return SIGS[fn] || fn + '()'; }
    function funcAtLine(n) {
      var best = null;   // the function whose first line is the closest one at or above n
      for (var fn in FUNCS) if (FUNCS[fn].line <= n && (!best || FUNCS[fn].line > FUNCS[best].line)) best = fn;
      return best || 'main';
    }
    function cmdRun(isStart) {
      if (running()) print('The program being debugged has been started already.\nStart it from the beginning? (y or n) [answered Y; input not from terminal]');
      if (isStart) cmdBreak('main', true);
      S.pid = 4000 + Math.floor(Math.random() * 5000);
      S.outShown = 0; S.cur = null;
      S.watches.forEach(function (w) { S.bps.splice(S.bps.indexOf(w), 1); }); S.watches = [];
      print('Starting program: ' + PATH + ' ');
      var b = bpAt(0);
      S.cur = { k: 0, sel: 0 };
      if (b) { b.hits++; if (b.temp) S.bps.splice(S.bps.indexOf(b), 1); S.cur = null; arrive(0, { bp: b }); return; }
      go(function () { return false; });
    }
    function cmdNext(n, into) {
      if (needRun()) return;
      n = n || 1;
      for (var c = 0; c < n && running(); c++) {
        var d = depth(S.cur.k);
        if (into) go(function (k) { return depth(k) < d || entered(k) || lineStart(k); });
        else go(function (k) { return depth(k) < d || (depth(k) === d && lineStart(k)); });
      }
    }
    function cmdFinish() {
      if (needRun()) return;
      var sel = S.cur.sel, k0 = S.cur.k, d = depth(k0) - sel;
      if (d <= 1) { print('"finish" not meaningful in the outermost frame.'); return; }
      print('Run till exit from ' + frameLine(k0, sel, true));
      var ret = stop(k0).f.length - sel === depth(k0) ? retOf(k0, sel) : null;
      go(function (k) { return depth(k) < d; }, { finishRet: ret });
    }
    function retOf(k, sel) {
      if (sel) return null;
      var r = stop(k).ret;
      return r == null ? null : r.replace('E', 'e');
    }
    function cmdList(arg) {
      var center, a, b;
      if (arg && arg.indexOf(',') >= 0) { var p = arg.split(','); a = +p[0]; b = +p[1]; }
      else {
        if (arg) {
          if (arg === '-') { a = Math.max(1, (S.listFirst || 1) - 10); b = a + 9; }
          else { var r = resolveLoc(arg); if (r.err) { print(r.err); return; } center = r.lines[0]; }
        } else if (S.listNext) { a = S.listNext; b = a + 9; }
        else center = running() ? stop(S.cur.k).f[S.cur.sel].line : FUNCS.main.line;
        if (center) { a = Math.max(1, center - 5); b = a + 9; }
      }
      b = Math.min(b, LINES.length);
      if (a > LINES.length) { print('Line number ' + a + ' out of range; "' + FILE + '" has ' + LINES.length + ' lines.'); return; }
      for (var n = a; n <= b; n++) print(srcLine(n));
      S.listFirst = a; S.listNext = b + 1;
    }
    function cmdPrint(arg, quiet) {
      var fmt = null, m = arg.match(/^\/(\w)\s*(.*)$/);
      if (m) { fmt = m[1]; arg = m[2]; }
      if (!arg) { if (!S.hist.length) { print('$1 = <error: History is empty.>'); return; } arg = '$'; }
      if (/[^=!<>]=[^=]/.test(' ' + arg + ' ')) { print('This playground replays a recorded run, so it cannot change variables. Fix the source and run again.'); return; }
      try {
        if (!running() && !/^[\d\s+\-*\/().$]+$/.test(arg)) {
          var ids = (arg.match(/[A-Za-z_]\w*/g) || [arg]).filter(function (w) { return !FIELDS.hasOwnProperty(w) && w !== 'const'; });
          throw new EvalError('No symbol "' + (ids[0] || arg) + '" in current context.');
        }
        var v = evaluate(arg);
        if (fmt === 'x' && v.k === 'num' && v.t === 'int') v = { k: 'num', v: v.v, s: '0x' + v.v.toString(16), t: 'int' };
        S.hist.push(v);
        print('$' + S.hist.length + ' = ' + show(v, true));
      } catch (e) { if (e instanceof EvalError) print(e.message); else throw e; }
    }
    function doDisplays() {
      S.displays.forEach(function (d) {
        try { print(d.num + ': ' + d.expr + ' = ' + show(evaluate(d.expr), true)); } catch (e) { /* not in scope here: GDB skips it */ }
      });
    }
    function cmdBt() {
      if (!running()) { print('No stack.'); return; }
      stop(S.cur.k).f.forEach(function (f, i) { print(frameLine(S.cur.k, i, true)); });
    }
    function cmdFrame(n) {
      if (!running()) { print('No stack.'); return; }
      var fr = stop(S.cur.k).f;
      if (n < 0) { print('Bottom (innermost) frame selected; you cannot go down.'); return; }
      if (n >= fr.length) { print('Initial frame selected; you cannot go up.'); return; }
      S.cur.sel = n;
      print(frameLine(S.cur.k, n, true)); print(srcLine(fr[n].line)); S.listNext = null; paint();
    }
    function cmdInfo(arg) {
      var w = arg.split(/\s+/), what = w[0], rest = w.slice(1).join(' ');
      if (/^(b|br|break|breakpoints|watchpoints)$/.test(what)) {
        var list = S.bps.filter(function (b) { return what !== 'watchpoints' || b.watch; });
        if (!list.length) { print(what === 'watchpoints' ? 'No watchpoints.' : 'No breakpoints or watchpoints.'); return; }
        print('Num     Type           Disp Enb Address            What');
        list.forEach(function (b) {
          if (b.watch) print(pad(b.num, 8) + pad('hw watchpoint', 15) + 'keep y                      ' + b.expr);
          else print(pad(b.num, 8) + pad('breakpoint', 15) + (b.temp ? 'del  ' : 'keep ') + (b.enabled ? 'y   ' : 'n   ') + (b.lines.length > 1 ? pad('<MULTIPLE>', 19) : pad(pc16(b.pc), 19)) + (b.lines.length > 1 ? '' : b.what));
          if (b.lines.length > 1) b.lines.forEach(function (l, i) { print(pad(b.num + '.' + (i + 1), 32) + 'y   ' + pad(pc16(FUNCS[funcAtLine(l)].pc), 19) + 'in ' + sig(funcAtLine(l)) + ' at ' + FILE + ':' + l); });
          if (b.hits) print('\tbreakpoint already hit ' + b.hits + ' time' + (b.hits > 1 ? 's' : ''));
        });
        return;
      }
      if (what === 'locals' || what === 'args') {
        if (needFrame()) return;
        var f = stop(S.cur.k).f[S.cur.sel], vs = what === 'locals' ? f.locals : f.args;
        if (!vs.length) { print(what === 'locals' ? 'No locals.' : 'No arguments.'); return; }
        vs.slice().reverse().forEach(function (v) { print(v.n + ' = ' + show(fromRec(v), false)); });
        return;
      }
      if (what === 'vtbl') {
        if (needFrame()) return;
        try {
          var v = evaluate(rest);
          if (v.k === 'ptr') v = deref(v);
          if (v.k !== 'obj') { print('This object does not have a virtual function table'); return; }
          var dt = dynType(v.addr, null);
          if (!dt) { print('This object does not have a virtual function table (its vptr is not set yet)'); return; }
          var vt = T.vt[dt];
          print('vtable for \'' + dt + '\' @ ' + obj(v.addr).vptr + ' (subobject @ ' + v.addr + '):');
          vt.entries.forEach(function (e, i) { print('[' + i + ']: ' + e.addr + ' <' + e.sym + '>'); });
        } catch (e) { if (e instanceof EvalError) print(e.message); else throw e; }
        return;
      }
      if (what === 'display') {
        if (!S.displays.length) { print('There are no auto-display expressions now.'); return; }
        print('Auto-display expressions now in effect:\nNum Enb Expression');
        S.displays.forEach(function (d) { print(d.num + ':   y  ' + d.expr); }); return;
      }
      if (what === 'frame') { if (needFrame()) return; var fr = stop(S.cur.k).f[S.cur.sel]; var up = stop(S.cur.k).f[S.cur.sel + 1]; print('Stack level ' + S.cur.sel + ':\n pc = ' + pc16(fr.pc) + ' in ' + fr.fn + ' (' + FILE + ':' + fr.line + ')' + (up ? '; saved pc = ' + pc16(up.pc) + '\n called by frame at level ' + (S.cur.sel + 1) : '') + '\n source language c++.'); return; }
      if (what === 'source') { print('Current source file is ' + FILE + '\nContains ' + LINES.length + ' lines.\nSource language is c++.'); return; }
      print('This playground supports: info breakpoints, info locals, info args, info vtbl EXPR, info display, info watchpoints, info frame, info source.');
    }
    function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
    function cmdPtype(arg, whatis) {
      var bare = arg.replace(/^(class|struct)\s+/, '');
      if (TYPES[bare]) { print('type = ' + (whatis ? bare : TYPES[bare])); return; }
      if (/^(double|int)$/.test(bare)) { print('type = ' + bare); return; }
      try {
        if (!running()) throw new EvalError('No symbol "' + arg + '" in current context.');
        var v = evaluate(arg), t = v.t || 'double';
        if (whatis) { print('type = ' + t); return; }
        var c = cls(t);
        if (TYPES[c]) { print('type = ' + t.replace(c, TYPES[c]).replace(/^(const )?class/, '$1class')); return; }
        if (v.k === 'vec') { print('type = ' + t + '\n    [the full std::vector class definition is long; this playground omits it]'); return; }
        print('type = ' + t);
      } catch (e) { if (e instanceof EvalError) print(e.message); else throw e; }
    }
    var HELP = [
      'Commands in this playground (a replay of a recorded run):',
      '  break LOC (b)       breakpoint at a line, FUNC or Class::method;  tbreak LOC',
      '  run (r) · start     start the program (start = tbreak main + run)',
      '  next (n) [N]        next line, stepping over calls',
      '  step (s) [N]        next line, stepping into calls',
      '  finish (fin)        run until the selected function returns',
      '  continue (c)        run to the next breakpoint or watchpoint',
      '  print (p) EXPR      e.g.  p total   p *s   p s->area()   p shapes[1]   p ((Circle*)s)->r_   p $1',
      '  display EXPR        print EXPR at every stop;  undisplay N',
      '  watch EXPR          stop when EXPR changes',
      '  bt · up · down · frame N      the call stack',
      '  info locals|args|breakpoints|vtbl EXPR|display|frame',
      '  ptype EXPR|TYPE · whatis EXPR',
      '  list (l) [LOC|A,B]  show source',
      '  set print object on|off · set print pretty on|off',
      '  delete [N] · disable N · enable N · kill · clear (empties this window)',
      'Enter on an empty line repeats the last command.'
    ];
    function exec(line) {
      var raw = line.trim();
      if (!raw) { raw = S.last || ''; if (!raw || !/^(n|next|s|step|c|continue|l|list|finish|fin|up|down)\b/.test(raw)) return; }
      else S.last = raw;
      var m = raw.match(/^(\S+)\s*(.*)$/), c = m[1], arg = m[2].trim();
      var num = /^\d+$/.test(arg) ? +arg : null;
      switch (c) {
        case 'help': case 'h': HELP.forEach(function (l) { print(l); }); break;
        case 'b': case 'br': case 'break': cmdBreak(arg, false); break;
        case 'tbreak': cmdBreak(arg, true); break;
        case 'r': case 'run': cmdRun(false); break;
        case 'start': cmdRun(true); break;
        case 'n': case 'next': cmdNext(num, false); break;
        case 's': case 'step': cmdNext(num, true); break;
        case 'fin': case 'finish': cmdFinish(); break;
        case 'c': case 'cont': case 'continue': if (!needRun()) { print('Continuing.'); go(function () { return false; }); } break;
        case 'u': case 'until': cmdNext(1, false); break;
        case 'p': case 'print': case 'output': case 'call': cmdPrint(arg); break;
        case 'p/x': cmdPrint('/x ' + arg); break;
        case 'display':
          if (!arg) { doDisplays(); break; }
          var d = { num: S.nextDisp++, expr: arg }; S.displays.push(d);
          if (running()) { try { print(d.num + ': ' + arg + ' = ' + show(evaluate(arg), true)); } catch (e) { print(e.message); } }
          break;
        case 'undisplay': S.displays = arg ? S.displays.filter(function (d) { return d.num !== +arg; }) : []; break;
        case 'watch':
          if (needRun()) break;
          try {
            var wv = show(evaluate(arg), false), wb = { num: S.nextBp++, watch: true, expr: arg, depth: depth(S.cur.k) - S.cur.sel, old: wv, hits: 0, enabled: true, lines: [] };
            S.bps.push(wb); S.watches.push(wb); print('Hardware watchpoint ' + wb.num + ': ' + arg);
          } catch (e) { print(e.message); }
          break;
        case 'bt': case 'backtrace': case 'where': cmdBt(); break;
        case 'f': case 'frame': if (num === null && running()) cmdFrame(S.cur.sel); else cmdFrame(num || 0); break;
        case 'up': if (running()) cmdFrame(S.cur.sel + (num || 1)); else print('No stack.'); break;
        case 'down': if (running()) cmdFrame(S.cur.sel - (num || 1)); else print('No stack.'); break;
        case 'i': case 'info': cmdInfo(arg); break;
        case 'l': case 'list': cmdList(arg); break;
        case 'ptype': cmdPtype(arg, false); break;
        case 'whatis': cmdPtype(arg, true); break;
        case 'd': case 'delete':
          if (!arg) { S.bps = []; S.watches = []; }
          else arg.split(/\s+/).forEach(function (x) {
            var b = S.bps.filter(function (b) { return b.num === +x; })[0];
            if (!b) print('No breakpoint number ' + x + '.'); else { S.bps.splice(S.bps.indexOf(b), 1); if (b.watch) S.watches.splice(S.watches.indexOf(b), 1); }
          });
          paint(); break;
        case 'disable': case 'enable':
          S.bps.forEach(function (b) { if (!arg || b.num === +arg) b.enabled = c === 'enable'; }); paint(); break;
        case 'set':
          var sm = arg.match(/^print\s+(object|pretty)\s*(on|off)?$/);
          if (sm) { S[sm[1] === 'object' ? 'printObject' : 'pretty'] = sm[2] !== 'off'; }
          else if (/^var/.test(arg)) print('This playground replays a recorded run, so it cannot change variables. Fix the source and run again.');
          else print('This playground supports: set print object on|off, set print pretty on|off.');
          break;
        case 'show':
          if (/^print object/.test(arg)) print('Printing of C++ virtual function tables is ' + (S.printObject ? 'on.' : 'off.').replace('C++ virtual function tables', 'object\'s derived type based on vtable info'));
          else if (/^print pretty/.test(arg)) print('Pretty formatting of structures is ' + (S.pretty ? 'on.' : 'off.'));
          else if (/^version/.test(arg)) print('GDB playground: replays a run of ' + FILE + ' recorded with LLDB (clang, -g -O0, arm64 macOS).\nOutput is formatted the way GDB formats it.');
          else print('This playground supports: show print object, show print pretty, show version.');
          break;
        case 'k': case 'kill':
          if (needRun()) break;
          print('[Inferior 1 (process ' + S.pid + ') killed]'); S.cur = null; S.outShown = 0; paint(); break;
        case 'q': case 'quit':
          print(running() ? 'A debugging session is active; this playground ends it. (Reload the page or press Reset to start again.)' : 'Bye. (Press Reset to start a new session.)');
          S.cur = null; paint(); break;
        case 'clear': if (!arg) { outEl.innerHTML = ''; break; } cmdClear(arg); break;
        case 'x': case 'set var': case 'jump': case 'return': case 'call!':
          print('Not available in this playground: it replays a recorded run.'); break;
        default:
          if (/^\d+$/.test(c)) { print('Undefined command: "' + c + '".  Try "help".'); break; }
          print('Undefined command: "' + c + '".  Try "help".');
      }
    }
    function cmdClear(arg) {
      var r = resolveLoc(arg); if (r.err) { print(r.err); return; }
      var gone = S.bps.filter(function (b) { return !b.watch && b.lines.join() === r.lines.join(); });
      if (!gone.length) { print('No breakpoint at ' + arg + '.'); return; }
      S.bps = S.bps.filter(function (b) { return gone.indexOf(b) < 0; });
      print('Deleted breakpoint' + (gone.length > 1 ? 's ' : ' ') + gone.map(function (b) { return b.num; }).join(' ') + ' '); paint();
    }

    // ---------- source pane and panels
    var lineEls = [];
    function buildSource() {
      srcPane.innerHTML = ''; lineEls = [];
      srcPane.appendChild(h('div', { class: 'g-src-head', text: FILE + (prog === 'fixed' ? '  (fixed)' : '') }));
      var body = h('div', { class: 'g-src-body' });
      var hlLines = hl(SRC.replace(/\n$/, '')).split('\n');
      LINES.forEach(function (l, i) {
        var n = i + 1, gut = h('button', { type: 'button', class: 'g-gut', text: n, title: 'Toggle a breakpoint on line ' + n, 'aria-label': 'Toggle breakpoint on line ' + n });
        gut.addEventListener('click', function () {
          var has = S.bps.filter(function (b) { return !b.watch && b.lines.length === 1 && b.lines[0] === n; })[0];
          run(has ? 'delete ' + has.num : 'break ' + n);
        });
        var row = h('div', { class: 'g-row' }, [gut, h('span', { class: 'g-code', html: hlLines[i] || ' ' })]);
        lineEls.push(row); body.appendChild(row);
      });
      srcPane.appendChild(body);
    }
    var prevVals = {};
    function paint() {
      var bpLines = {};
      S.bps.forEach(function (b) { if (!b.watch) b.lines.forEach(function (l) { bpLines[l] = b.enabled ? 'on' : 'off'; }); });
      var curLine = running() ? stop(S.cur.k).f[0].line : -1, selLine = running() && S.cur.sel ? stop(S.cur.k).f[S.cur.sel].line : -1;
      lineEls.forEach(function (el, i) {
        var n = i + 1;
        el.className = 'g-row' + (bpLines[n] ? ' bp-' + bpLines[n] : '') + (n === curLine ? ' cur' : '') + (n === selLine ? ' sel' : '');
      });
      if (curLine > 0) { var el = lineEls[(selLine > 0 ? selLine : curLine) - 1], body = el.parentNode; if (el.offsetTop < body.scrollTop + 20 || el.offsetTop > body.scrollTop + body.clientHeight - 40) body.scrollTop = el.offsetTop - body.clientHeight / 2; }
      stackEl.innerHTML = ''; localsEl.innerHTML = '';
      if (!running()) { stackEl.appendChild(h('p', { class: 'g-empty', text: 'Not running. Try: break total_area, then run.' })); localsEl.appendChild(h('p', { class: 'g-empty', text: '—' })); return; }
      var st = stop(S.cur.k);
      st.f.forEach(function (f, i) {
        stackEl.appendChild(h('button', { type: 'button', class: 'g-frame' + (i === S.cur.sel ? ' on' : ''), translate: 'no', onclick: function () { run('frame ' + i); } },
          [h('b', { text: '#' + i + ' ' }), f.fn + ' ', h('small', { text: 'line ' + f.line })]));
      });
      var f = st.f[S.cur.sel], vals = {};
      f.args.concat(f.locals).forEach(function (v) {
        var key = f.fn + ':' + v.n, val;
        val = show(fromRec(v), false);
        if (v.k === 'ptr' && obj(v.v)) { var save = S.printObject; S.printObject = true; val = v.v + '  → ' + show(deref(fromRec(v)), true); S.printObject = save; }
        if (v.k === 'obj') { var sv = S.printObject; S.printObject = false; val = show(fromRec(v), true); S.printObject = sv; }
        vals[key] = val;
        var changed = prevVals[key] !== undefined && prevVals[key] !== val;
        localsEl.appendChild(h('div', { class: 'g-var' + (changed ? ' changed' : ''), translate: 'no' }, [h('span', { class: 'g-vn', text: v.n }), h('span', { class: 'g-vt', text: v.t }), h('span', { class: 'g-vv', text: val })]));
      });
      prevVals = vals;
    }

    // ---------- mission
    var STEPS = {
      m1: [
        ['Stop where the areas are added up', 'Set a breakpoint on the function, then start the program. GDB stops at its first line; <code>total</code> has not been set yet, so it holds whatever was in memory.', ['break total_area', 'run', 'info locals']],
        ['Walk through the loop', 'Step over lines with <code>next</code>. <code>s</code> is a <code>const Shape*</code>: GDB prints its <em>static</em> type, and the object behind it only as a Shape.', ['next', 'next', 'p s', 'p *s']],
        ['Ask for the dynamic type', 'With <code>print object</code> on, GDB reads the vptr to find what the object really is.', ['set print object on', 'p s', 'p *s', 'info vtbl s']],
        ['Follow the virtual call', '<code>step</code> enters <code>s-&gt;area()</code> and lands in <code>Circle::area</code>: dynamic dispatch in action. <code>finish</code> returns and shows the value.', ['step', 'bt', 'p *this', 'finish']],
        ['Watch the running total', 'A watchpoint stops the program whenever <code>total</code> changes. The second change adds the rectangle\'s area. Is it 2 × 3?', ['watch total', 'continue', 'continue']],
        ['Look inside the rectangle', 'Restart with a breakpoint in <code>Rectangle::area</code> and look at the object. One field is wrong; <code>list</code> the constructor to see why.', ['delete', 'break Rectangle::area', 'run', 'p *this', 'list Rectangle::Rectangle']],
        ['Apply the fix and run again', 'Switch to the fixed program (line 21 now reads <code>h_(h)</code>) and run it to the end.', ['@fixed', 'run', 'p *this', 'continue']]
      ],
      m2: [
        ['Stop in total()', 'The square (side 2) gives 4, so the triangle (base 3, height 4) must be contributing 0 instead of 6. Stop where the areas are summed.', ['break total', 'run']],
        ['Follow the square', 'Turn on <code>print object</code>, walk to the call, and step into it: the square\'s own <code>area</code> runs and returns 4.', ['set print object on', 'next', 'next', 'p *s', 'step', 'finish']],
        ['Follow the triangle', 'Go round the loop once more. <code>s</code> now points at the triangle, with the right fields. Step into the call: which function do you land in?', ['next', 'next', 'next', 'p *s', 'step']],
        ['Ask why', 'You are in <code>Shape::area</code>, not <code>Triangle::area</code>. Go up to the caller and look at the triangle\'s vtable: slot [2] still points to <code>Shape::area() const</code>. <code>ptype</code> shows why: Triangle\'s <code>area</code> is neither <code>const</code> nor virtual.', ['bt', 'up', 'info vtbl s', 'p s->area()', 'ptype Triangle']],
        ['The function exists', 'Called directly on a <code>Triangle</code>, the function works: it is just a different function, not an override. (Clang\'s <code>-Wall</code> warned about this: <i>hides overloaded virtual function</i>.)', ['up', 'p tr.area()', 'p sq.area()']],
        ['Apply the fix and run again', 'Switch to the fixed program: line 22 becomes <code>double area() const override</code>. Run it to the end.', ['@fixed', 'run', 'continue', 'ptype Triangle']]
      ]
    };
    var MORE = {
      m1: 'More to try: <code>up</code> then <code>p c</code> · <code>p shapes</code> · <code>p shapes[1]</code> · <code>p s-&gt;area()</code> · <code>p ((Circle*)s)-&gt;r_</code> · <code>ptype s</code> · <code>display total</code> · <code>set print pretty on</code> · <code>start</code> then <code>step</code> into the constructors.',
      m2: 'More to try: <code>break Shape::area</code> · <code>watch sum</code> · <code>info vtbl sq</code> (from <code>main</code>) · <code>ptype Square</code> · <code>p ((Square*)shapes[0])-&gt;s_</code> · <code>info breakpoints</code>.'
    };
    function buildMission() {
      mission.innerHTML = '';
      mission.appendChild(h('div', { class: 'g-mission-head', html: '<b>Mission ' + mid.slice(1) + ': find the bug</b> <small>click a command to run it, or type it yourself</small>' }));
      var ol = h('ol');
      STEPS[mid].forEach(function (s) {
        var chips = h('div', { class: 'g-chips' });
        s[2].forEach(function (c) {
          chips.appendChild(h('button', { type: 'button', class: 'g-chip', translate: 'no', text: c === '@fixed' ? 'use the fixed program' : c, onclick: function () {
            if (c === '@fixed') { switchProg('fixed'); return; }
            run(c);
          } }));
        });
        ol.appendChild(h('li', null, [h('b', { text: s[0] }), h('p', { html: s[1] }), chips]));
      });
      mission.appendChild(ol);
      mission.appendChild(h('p', { class: 'g-more', html: MORE[mid] }));
    }

    // ---------- session
    function run(cmd) { print('(gdb) ' + cmd, 'cmd'); exec(cmd); input.focus({ preventScroll: true }); }
    function load(p) {
      M = G[mid]; P = M.progs[p]; prog = p; T = P.trace; SRC = P.src; LINES = SRC.replace(/\n$/, '').split('\n');
      FIELDS = M.fields; TYPES = P.ptype; SIGS = M.sigs; CLSRE = new RegExp('\\b(' + Object.keys(FIELDS).join('|') + ')\\b');
      FILE = M.progs.bug.file; PATH = '/home/you/' + FILE.replace(/\.cpp$/, '');
      indexFuncs(); buildSource();
    }
    function setSeg(segEl, first) { segEl.querySelectorAll('button').forEach(function (b, i) { b.setAttribute('aria-checked', String((i === 0) === first)); }); }
    function switchMission(m) {
      if (m === mid) return;
      mid = m; setSeg(misSeg, m === 'm1'); setSeg(progSeg, true);
      load('bug'); reset(true); buildMission();
    }
    function reset(clearOut) {
      S = { cur: null, bps: [], watches: [], displays: [], hist: [], nextBp: 1, nextDisp: 1, printObject: false, pretty: false, last: '', outShown: 0, pid: 4242, listNext: null };
      if (clearOut) outEl.innerHTML = '';
      prevVals = {};
      print('GNU gdb-style playground (replaying a recorded run). Type "help" for the commands.', 'dim');
      print('Reading symbols from ' + PATH + '...', 'dim');
      paint();
    }
    function switchProg(p) {
      if (p === prog) return;
      setSeg(progSeg, p === 'bug');
      var keep = S.bps.filter(function (b) { return !b.watch; });
      if (running()) { print('[Inferior 1 (process ' + S.pid + ') killed]'); }
      load(p);
      S.cur = null; S.outShown = 0; S.watches = []; S.bps = keep; prevVals = {};
      print(p === 'fixed' ? 'Rebuilt from the fixed source: ' + FIXMSG[mid] : 'Rebuilt from the original (buggy) source.', 'dim');
      print('Reading symbols from ' + PATH + '...', 'dim');
      paint();
    }

    // ---------- input: history, Enter, Tab
    var hist = [], hpos = 0;
    var NAMES = ['break', 'tbreak', 'run', 'start', 'next', 'step', 'finish', 'continue', 'print', 'display', 'undisplay', 'watch', 'backtrace', 'frame', 'up', 'down', 'info', 'list', 'ptype', 'whatis', 'delete', 'disable', 'enable', 'set', 'show', 'kill', 'help', 'clear'];
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var v = input.value; input.value = '';
        if (v.trim()) { hist.push(v); } hpos = hist.length;
        print('(gdb) ' + v, 'cmd'); exec(v);
      } else if (e.key === 'ArrowUp') { if (hpos > 0) { input.value = hist[--hpos]; } e.preventDefault(); }
      else if (e.key === 'ArrowDown') { if (hpos < hist.length) { hpos++; input.value = hist[hpos] || ''; } e.preventDefault(); }
      else if (e.key === 'Tab') {
        var p = input.value;
        if (/^\S*$/.test(p) && p) { var mm = NAMES.filter(function (n) { return n.indexOf(p) === 0; }); if (mm.length === 1) input.value = mm[0] + ' '; else if (mm.length) print(mm.join('  '), 'dim'); e.preventDefault(); }
        else if (/^(b|break|tbreak|list|l)\s+\S*$/.test(p)) { var q = p.split(/\s+/)[1], fm = Object.keys(FUNCS).filter(function (n) { return n.indexOf(q) === 0; }); if (fm.length === 1) input.value = p.replace(/\S*$/, fm[0]); else if (fm.length) print(fm.join('  '), 'dim'); e.preventDefault(); }
      } else if (e.key === 'l' && e.ctrlKey) { outEl.innerHTML = ''; e.preventDefault(); }
    });

    load('bug'); reset(false); buildMission();
  }

  /* ================================================================ C++ theme: page background and banner scenes */
  var REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function hidpi(cv) {
    var ctx = cv.getContext('2d'), o = { ctx: ctx, W: 0, H: 0 };
    o.size = function () { var r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); o.W = r.width; o.H = r.height; cv.width = Math.round(o.W * dpr); cv.height = Math.round(o.H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    o.size(); return o;
  }
  function animate(cv, step, onResize) {   // rAF loop that pauses when hidden or off-screen; one still frame for reduced motion
    var running = false, last = 0, visible = true;
    function frame(t) { if (!running) return; var dt = Math.max(0, Math.min(0.05, (t - last) / 1000 || 0.016)); last = t; step(dt, t / 1000); requestAnimationFrame(frame); }   // the first rAF time can precede performance.now()
    function start() { if (running || !visible || document.hidden || REDUCE) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
    window.addEventListener('resize', function () { onResize(); if (REDUCE) still(); });
    function still() { for (var i = 0; i < 300; i++) step(0.05, i * 0.05); }
    if (REDUCE) { still(); return; }
    document.addEventListener('visibilitychange', function () { if (document.hidden) running = false; else start(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); else running = false; }).observe(cv);
    start();
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // page background: drifting C++ tokens and little class hierarchies with virtual-call pulses, strongest in the margins
  var TOKENS = [['class', 'k'], ['virtual', 'k'], ['override', 'k'], ['= 0;', 'k'], ['final', 'k'], ['public:', 'k'], ['private:', 'k'], ['noexcept', 'k'], ['template <typename T>', 'k'], ['constexpr', 'k'],
    ['std::unique_ptr<T>', 't'], ['std::shared_ptr<T>', 't'], ['std::vector<T>', 't'], ['std::variant<A, B>', 't'], ['Shape*', 't'], ['const Shape&', 't'], ['T&&', 't'],
    ['->', 'o'], ['::', 'o'], ['{ }', 'o'], ['~T()', 'o'], ['std::move(x)', 'o'], ['operator<=>', 'o'], ['nullptr', 'o'], ['_vptr', 'o'], ['0x7ffd5e8c', 'n'], ['sizeof(T)', 'o'], ['#include <memory>', 'p'], ['dynamic_cast<D*>', 'o']];
  var NAMES = [['Shape', ['Circle', 'Rect']], ['Animal', ['Dog', 'Cat']], ['Stepper', ['Euler', 'RK4']], ['Sensor', ['Thermo', 'Wind']], ['Observer', ['Display', 'Alarm']], ['Widget', ['Button', 'Slider']]];
  function pageBackground() {
    var cv = h('canvas', { class: 'cpp-bg', 'aria-hidden': 'true' });
    document.body.insertBefore(cv, document.body.firstChild);
    var c = hidpi(cv), toks = [], trees = [];
    function marginWeight(x) {   // 1 in the margins, low over the text column
      var col = Math.min(c.W, 900), left = (c.W - col) / 2, right = left + col;
      if (x < left) return 1; if (x > right) return 1;
      var d = Math.min(x - left, right - x);
      return Math.max(0.22, 1 - d / 120);
    }
    function newTok(init) {
      var t = pickOne(TOKENS);
      return { s: t[0], k: t[1], x: rnd(0, c.W), y: init ? rnd(0, c.H) : c.H + 20, v: rnd(6, 14), sway: rnd(0, 6.28), size: rnd(11, 15), life: 0 };
    }
    function newTree() {
      var n = pickOne(NAMES), side = Math.random() < 0.5, colw = Math.min(c.W, 900), margin = (c.W - colw) / 2;
      var x = margin > 200 ? (side ? rnd(16, margin - 190) : rnd(c.W - margin + 10, c.W - 190)) : rnd(10, Math.max(20, c.W - 190));
      var y = rnd(40, c.H - 140);
      for (var tries = 0; tries < 12; tries++) {   // keep clear of the other diagrams
        var clash = trees.some(function (o) { return o && Math.abs(o.x - x) < 200 && Math.abs(o.y - y) < 150; });
        if (!clash) break;
        x = margin > 200 ? (Math.random() < 0.5 ? rnd(16, margin - 190) : rnd(c.W - margin + 10, c.W - 190)) : rnd(10, Math.max(20, c.W - 190)); y = rnd(40, c.H - 140);
      }
      return { base: n[0], kids: n[1], x: x, y: y, v: rnd(3, 6), t: rnd(0, 3), age: 0, ttl: rnd(14, 22) };
    }
    function init() {
      c.size(); toks = []; trees = [];
      var n = Math.round(Math.min(38, c.W * c.H / 34000));
      for (var i = 0; i < n; i++) toks.push(newTok(true));
      var m = c.W > 1100 ? 4 : 2;
      for (i = 0; i < m; i++) { var tr = newTree(); tr.age = rnd(0, tr.ttl * 0.6); trees.push(tr); }   // newTree avoids those already placed
    }
    init();
    animate(cv, function (dt, time) {
      var ctx = c.ctx, dark = isDark();
      var COL = dark ? { k: '255,162,90', t: '121,180,255', o: '195,194,183', n: '211,164,255', p: '241,154,197', line: '195,194,183', pulse: '255,176,102' }
                     : { k: '180,82,12', t: '42,99,184', o: '82,81,78', n: '138,79,194', p: '160,82,122', line: '82,81,78', pulse: '235,104,52' };
      var A = dark ? 0.2 : 0.15;
      ctx.clearRect(0, 0, c.W, c.H);
      toks.forEach(function (t, i) {
        t.y -= t.v * dt; t.life += dt; t.sway += dt * 0.5;
        if (t.y < -30) toks[i] = newTok(false);
        var x = t.x + Math.sin(t.sway) * 10, fade = Math.min(1, t.life / 3);
        ctx.font = '600 ' + t.size + 'px ui-monospace, Menlo, monospace';
        ctx.fillStyle = 'rgba(' + COL[t.k] + ',' + (A * fade * marginWeight(x)) + ')';
        ctx.fillText(t.s, x, t.y);
      });
      trees.forEach(function (tr, i) {
        tr.age += dt; tr.t += dt; tr.y -= tr.v * dt * 0.4;
        if (tr.age > tr.ttl) { trees[i] = null; trees[i] = newTree(); return; }
        var fade = Math.min(1, tr.age / 2, (tr.ttl - tr.age) / 2), w = marginWeight(tr.x + 80), a = (dark ? 0.32 : 0.26) * fade * w;
        var bx = tr.x + 50, by = tr.y, kids = [[tr.x, tr.y + 80], [tr.x + 100, tr.y + 80]];
        ctx.lineWidth = 1.2;
        kids.forEach(function (k) {   // inheritance arrows: derived -> base, hollow triangle at the base
          ctx.strokeStyle = 'rgba(' + COL.line + ',' + a + ')';
          ctx.beginPath(); ctx.moveTo(k[0] + 40, k[1]); ctx.lineTo(bx + 40, by + 34); ctx.stroke();
        });
        ctx.beginPath(); ctx.moveTo(bx + 40, by + 26); ctx.lineTo(bx + 34, by + 36); ctx.lineTo(bx + 46, by + 36); ctx.closePath(); ctx.stroke();
        [[bx, by, tr.base, true]].concat(kids.map(function (k, j) { return [k[0], k[1], tr.kids[j], false]; })).forEach(function (b) {
          ctx.strokeStyle = 'rgba(' + COL[b[3] ? 'k' : 't'] + ',' + a + ')';
          rrect(ctx, b[0], b[1], 80, 26, 5); ctx.stroke();
          ctx.font = (b[3] ? 'italic ' : '') + '600 11.5px ui-monospace, Menlo, monospace';
          ctx.fillStyle = 'rgba(' + COL[b[3] ? 'k' : 't'] + ',' + a * 1.2 + ')';
          ctx.textAlign = 'center'; ctx.fillText(b[2], b[0] + 40, b[1] + 17); ctx.textAlign = 'left';
        });
        var phase = (tr.t % 3) / 3, k = kids[Math.floor(tr.t / 3) % 2];   // a virtual call: base pointer -> the real class
        if (phase < 0.6) {
          var u = phase / 0.6, px = bx + 40 + (k[0] + 40 - bx - 40) * u, py = by + 34 + (k[1] - by - 34) * u;
          ctx.fillStyle = 'rgba(' + COL.pulse + ',' + (a * 2.4) + ')'; ctx.beginPath(); ctx.arc(px, py, 3, 0, 7); ctx.fill();
        } else {
          ctx.strokeStyle = 'rgba(' + COL.pulse + ',' + (a * 2.2 * (1 - (phase - 0.6) / 0.4)) + ')';
          rrect(ctx, k[0] - 3, k[1] - 3, 86, 32, 7); ctx.stroke();
        }
      });
    }, init);
    // with reduced motion there is only one still frame: repaint it when the theme changes
    new MutationObserver(function () { if (REDUCE) window.dispatchEvent(new Event('resize')); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // banner scenes: the lesson's idea, alive, in the right part of the banner (the banner is always dark)
  var BC = { text: '246,244,238', dim: '246,244,238', k: '255,162,90', t: '121,180,255', g: '155,227,180', r: '255,138,92', y: '245,197,66' };
  function bc(c, a) { return 'rgba(' + BC[c] + ',' + a + ')'; }
  var SCENES = {};
  SCENES.dispatch = function () {   // Shape* -> vptr -> vtable -> Circle::area / Rect::area / Square::area
    var classes = ['Circle', 'Rect', 'Square'], i = 0, t = 0;
    return function (ctx, R, dt) {
      t += dt; if (t > 3.2) { t = 0; i = (i + 1) % 3; }
      var x0 = R.x, y0 = R.y, w = R.w, h = R.h, cls = classes[i];
      ctx.font = '600 12px ui-monospace, Menlo, monospace';
      function box(x, y, bw, bh, label, col, hot) { ctx.strokeStyle = bc(col, hot ? 0.95 : 0.45); ctx.lineWidth = hot ? 2 : 1.2; rrect(ctx, x, y, bw, bh, 6); ctx.stroke(); if (hot) { ctx.fillStyle = bc(col, 0.12); ctx.fill(); } ctx.fillStyle = bc(col, hot ? 1 : 0.7); ctx.fillText(label, x + 8, y + bh / 2 + 4); }
      var px = x0, py = y0 + 26, ox = x0 + w * 0.02, oy = y0 + h * 0.42, vx = x0 + w * 0.5, vy = y0 + h * 0.06;
      box(px, py, 120, 28, 'Shape* s', 't', false);
      box(ox, oy, 130, 54, '', 't', true); ctx.fillStyle = bc('text', 0.9); ctx.fillText(cls + ' object', ox + 8, oy + 18); ctx.fillStyle = bc('k', 0.9); ctx.fillText('vptr ●', ox + 8, oy + 40);
      ctx.fillStyle = bc('text', 0.6); ctx.fillText('vtable for ' + cls, vx, vy - 6 + 16);
      var rows = ['~' + cls + '()', '~' + cls + '()', cls + '::area()'];
      rows.forEach(function (r, j) { box(vx, vy + 22 + j * 30, Math.min(170, w * 0.48), 26, '[' + j + '] ' + r, j === 2 ? 'k' : 'dim', j === 2 && t > 1.6); });
      var path = [[px + 60, py + 28], [ox + 60, oy], [ox + 56, oy + 36], [vx, vy + 22 + 2 * 30 + 13]];
      var u = Math.min(1, t / 1.6) * (path.length - 1), seg = Math.min(path.length - 2, Math.floor(u)), f = u - seg;
      ctx.strokeStyle = bc('k', 0.35); ctx.lineWidth = 1.2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(path[0][0], path[0][1]); for (var q = 1; q <= seg + 1 && q < path.length; q++) ctx.lineTo(path[q][0], path[q][1]); ctx.stroke(); ctx.setLineDash([]);
      var X = path[seg][0] + (path[seg + 1][0] - path[seg][0]) * f, Y = path[seg][1] + (path[seg + 1][1] - path[seg][1]) * f;
      ctx.fillStyle = bc('y', 0.95); ctx.beginPath(); ctx.arc(X, Y, 4, 0, 7); ctx.fill();
      ctx.fillStyle = bc('text', 0.75); ctx.fillText('s->area()', px + 2, py - 8);
      if (t > 1.6) { ctx.fillStyle = bc('g', Math.min(1, (t - 1.6) * 2)); ctx.fillText('→ ' + cls + '::area() runs', vx, vy + 22 + 3 * 30 + 16); }
    };
  };
  SCENES.memory = function () {   // a heap: objects allocated, copied, moved, freed
    var N = 32, cells = [], t = 2.2, msg = '', id = 0;   // t = 2.2: the first allocation happens on the first frame
    for (var i = 0; i < N; i++) cells.push(null);
    function alloc(len, name, col) { for (var s = 0; s + len <= N; s++) { var ok = true; for (var j = s; j < s + len; j++) if (cells[j]) ok = false; if (ok) { var o = { name: name, col: col, born: 0, id: id++ }; for (j = s; j < s + len; j++) cells[j] = o; return o; } } return null; }
    function free(o) { for (var j = 0; j < N; j++) if (cells[j] === o) cells[j] = null; }
    var live = [], step = 0;
    var SCRIPT = [
      function () { var o = alloc(4, 'Circle', 't'); if (o) live.push(o); msg = 'auto c = std::make_unique<Circle>(1);'; },
      function () { var o = alloc(6, 'Buffer a', 'k'); if (o) live.push(o); msg = 'Buffer a("a");  // owns its data'; },
      function () { var a = live[live.length - 1], o = alloc(6, "Buffer a'", 'r'); if (o) live.push(o); msg = "Buffer b = a;  // COPY: new memory"; },
      function () { var o = live.pop(); if (o) { o.name = 'Buffer b ⟵ a'; o.col = 'g'; live.push(o); } msg = 'auto m = std::move(b);  // same memory'; },
      function () { var o = live.shift(); if (o) free(o); msg = 'c.reset();  // destructor ran, freed'; },
      function () { live.forEach(free); live = []; msg = '}  // scope ends: all destroyed'; }
    ];
    return function (ctx, R, dt) {
      t += dt; if (t > 2.2) { t = 0; SCRIPT[step % SCRIPT.length](); step++; }
      var cols = 8, cw = Math.min(42, R.w / cols - 4), ch = 26, x0 = R.x, y0 = R.y + 34;
      ctx.font = '600 11px ui-monospace, Menlo, monospace';
      ctx.fillStyle = bc('text', 0.6); ctx.fillText('heap (each cell = 8 bytes)', x0, R.y + 14);
      for (var i = 0; i < N; i++) {
        var cx = x0 + (i % cols) * (cw + 4), cy = y0 + Math.floor(i / cols) * (ch + 4), o = cells[i];
        ctx.strokeStyle = bc(o ? o.col : 'dim', o ? 0.85 : 0.18); ctx.lineWidth = 1; rrect(ctx, cx, cy, cw, ch, 4); ctx.stroke();
        if (o) { ctx.fillStyle = bc(o.col, 0.18); ctx.fill(); if (i === 0 || cells[i - 1] !== o || i % cols === 0) { ctx.fillStyle = bc(o.col, 1); ctx.fillText(o.name, cx + 4, cy + 17); } }
        else { ctx.fillStyle = bc('dim', 0.25); ctx.fillText('0x' + (0xa0 + i * 8).toString(16), cx + 4, cy + 17); }
      }
      ctx.fillStyle = bc('y', 0.95); ctx.font = '600 11.5px ui-monospace, Menlo, monospace';
      ctx.fillText(msg, x0, y0 + 4 * (ch + 4) + 20);
    };
  };
  SCENES.stack = function () {   // the call stack growing and shrinking
    var CALLS = [['main()', 0], ['total_area(shapes)', 1], ['Circle::area()', 2], ['total_area(shapes)', 1], ['Rect::area()', 2], ['total_area(shapes)', 1], ['main()', 0], ['~Rect()', 1], ['~Circle()', 1], ['main()', 0]];
    var i = 0, t = 0, stack = ['main()'];
    return function (ctx, R, dt) {
      t += dt;
      if (t > 1.3) { t = 0; i = (i + 1) % CALLS.length; var c = CALLS[i]; stack = stack.slice(0, c[1]); stack[c[1]] = c[0]; }
      var fw = Math.min(250, R.w * 0.8), fh = 32, x = R.x + 10, base = R.y + R.h - 10;
      ctx.font = '600 12px ui-monospace, Menlo, monospace';
      ctx.fillStyle = bc('text', 0.6); ctx.fillText('call stack', x, R.y + 14);
      stack.forEach(function (s, j) {
        var y = base - (j + 1) * (fh + 6), top = j === stack.length - 1, a = top ? Math.min(1, t * 4) : 1;
        ctx.strokeStyle = bc(top ? 'k' : 't', top ? 0.95 * a : 0.5); ctx.lineWidth = top ? 2 : 1.2; rrect(ctx, x + j * 14, y, fw, fh, 6); ctx.stroke();
        if (top) { ctx.fillStyle = bc('k', 0.12 * a); ctx.fill(); }
        ctx.fillStyle = bc(top ? 'k' : 'text', top ? a : 0.75); ctx.fillText('#' + (stack.length - 1 - j) + '  ' + s, x + j * 14 + 10, y + 20);
      });
      ctx.fillStyle = bc('g', 0.85); ctx.fillText(stack.length > 1 ? 'step ▸ ' + stack[stack.length - 1] : 'finish ◂ back in main', x + 90, R.y + 14);
    };
  };
  SCENES.template = function () {   // one template, many instantiations, stamped at compile time
    var TYPES = ['int', 'double', 'Circle', 'std::string', 'Rect', 'float'], made = [], t = 0, i = 0;
    return function (ctx, R, dt) {
      t += dt; if (t > 1.4) { t = 0; made.push({ ty: TYPES[i % TYPES.length], a: 0 }); i++; if (made.length > 4) made.shift(); }
      var x = R.x, y = R.y + 6;
      ctx.font = '600 12px ui-monospace, Menlo, monospace';
      ctx.strokeStyle = bc('k', 0.8); ctx.lineWidth = 1.6; rrect(ctx, x, y, 210, 50, 8); ctx.stroke();
      ctx.fillStyle = bc('k', 1); ctx.fillText('template <typename T>', x + 10, y + 20); ctx.fillStyle = bc('text', 0.85); ctx.fillText('T total_area(const vector<T>&)', x + 10, y + 38);
      made.forEach(function (m, j) {
        m.a = Math.min(1, m.a + dt * 2);
        var yy = y + 70 + j * 34, xx = x + 30;
        ctx.strokeStyle = bc('k', 0.3 * m.a); ctx.beginPath(); ctx.moveTo(x + 105, y + 50); ctx.lineTo(xx + 90, yy); ctx.stroke();
        ctx.strokeStyle = bc('t', 0.85 * m.a); rrect(ctx, xx, yy, 240, 26, 6); ctx.stroke();
        ctx.fillStyle = bc('t', m.a); ctx.fillText('total_area<' + m.ty + '>', xx + 10, yy + 17);
        ctx.fillStyle = bc('g', 0.8 * m.a); ctx.fillText('compiled', xx + 175, yy + 17);
      });
    };
  };
  function bannerScene() {
    var banner = document.querySelector('header.banner'), name = document.body.getAttribute('data-scene');
    if (!banner || !SCENES[name]) return;
    var cv = h('canvas', { class: 'cpp-scene', 'aria-hidden': 'true' });
    banner.appendChild(cv);
    var c = hidpi(cv), draw = SCENES[name](), R = null;
    function layout() { c.size(); R = c.W > 900 ? { x: c.W * 0.665, y: 26, w: c.W * 0.315, h: Math.min(250, c.H * 0.56) } : null; }
    layout();
    animate(cv, function (dt) { c.ctx.clearRect(0, 0, c.W, c.H); if (R) { try { draw(c.ctx, R, dt); } catch (e) { R = null; } } }, layout);
  }
  try { pageBackground(); bannerScene(); } catch (e) { /* decoration only */ }

  /* ================================================================ boot */
  var W = { lifetime: lifetime, dispatch: dispatch, abstract: abstractChecker, quiz: quiz, gdb: gdb, special: special, stepper: stepper, try: tryLab, layout: layoutLab, ownership: ownership, spot: spotBug, ode: odeLab, observer: observerLab, chooser: chooser };
  // progress: remember which lessons were opened, and tick them on the course page
  var KEY = 'cpp-oop-seen', seen = {};
  try { seen = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { seen = {}; }
  var here = document.body.getAttribute('data-lesson');
  if (here) { seen[here] = 1; try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch (e) { /* storage off */ } }
  document.querySelectorAll('.lesson-card[data-n]').forEach(function (a) {
    if (seen[a.getAttribute('data-n')]) { a.classList.add('is-seen'); var m = a.querySelector('.seen'); if (m) m.textContent = '✓ opened'; }
  });
  document.querySelectorAll('[data-widget]').forEach(function (el) {
    var f = W[el.getAttribute('data-widget')];
    if (f) { try { f(el); } catch (e) { el.textContent = 'This widget failed to load: ' + e.message; } }
  });
})();
