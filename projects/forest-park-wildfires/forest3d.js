/*
 * Forest Park 3-D fire simulator (WebGL 2, no libraries).
 *
 * The real 30 m terrain (USGS 3DEP) and the WUI fuel map of this project, with the fire front
 * computed on the GPU by the level-set equation WRF-SFIRE solves:
 *     dpsi/dt + S(x, n) |grad psi| = 0,     fire area = { psi <= 0 }
 * S is SFIRE's Rothermel form (fire_ros_cawfe, fire_advection = 1) with the Anderson-13
 * coefficients for the chosen weather, upwind |grad psi| (fire_upwinding = 4) and Heun time
 * stepping (fire_back_weight = 0.5); fuel-free cells (roads, buildings, water) do not burn.
 * The wind is steady and uniform: this is the fire model alone, without WRF's atmosphere.
 *
 * <div class="sim3d" data-sim3d data-root="../" data-preset="single|multiple|line|perimeter|free"></div>
 */
(function () {
  'use strict';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BIG = 1e5, NEVER = 1e9;

  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  // fetch with one retry that bypasses the HTTP cache (a parallel request for the same URL
  // from another script can otherwise leave this one waiting on the cache entry)
  function get(url) {
    return fetch(url).catch(function () { return fetch(url, { cache: 'reload' }); })
      .then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r; });
  }
  function loadBitmap(url) {
    return get(url).then(function (r) { return r.blob(); })
      .then(function (b) { return createImageBitmap(b, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }); });
  }

  // ------------------------------------------------------------------ small matrix helpers
  function persp(fov, asp, n, f) {
    var t = 1 / Math.tan(fov / 2), nf = 1 / (n - f);
    return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0];
  }
  function lookAt(e, c, u) {
    var z = norm([e[0] - c[0], e[1] - c[1], e[2] - c[2]]), x = norm(cross(u, z)), y = cross(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
      -dot(x, e), -dot(y, e), -dot(z, e), 1];
  }
  function mul(a, b) {
    var o = new Array(16);
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) {
      var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s;
    }
    return o;
  }
  function inv(m) {
    var a = m, o = new Array(16);
    var b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4];
    var b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
    var b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12];
    var b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
    var d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
    o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d;
    o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
    o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d;
    o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
    o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d;
    o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
    o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d;
    o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
    return o;
  }
  function xf(m, v) {   // vec4
    return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3], m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3]];
  }
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  // ------------------------------------------------------------------ shaders
  var FS_VERT = '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var SIM_COMMON = [
    '#version 300 es', 'precision highp float;', 'precision highp int;',
    'uniform sampler2D uState; uniform sampler2D uStatic; uniform ivec2 uSize; uniform float uDx;',
    'uniform vec4 uCoef[13]; uniform float uWrf[13]; uniform float uUseWrf; uniform vec2 uWind; uniform float uU;',
    'ivec2 cl(ivec2 p){return clamp(p,ivec2(0),uSize-1);}',
    'int fuelOf(ivec2 p){int c=int(texelFetch(uStatic,cl(p),0).a+.5);return c>=32?c-32:c;}',
    'bool ok(int f){return f>=1&&f<=13;}',
    'float psiAt(sampler2D s,ivec2 p,float pc){return ok(fuelOf(p))?texelFetch(s,cl(p),0).r:pc;}',
    'float rhs(sampler2D s,ivec2 p,out float S){',
    '  int f=fuelOf(p); S=0.; if(!ok(f)) return 0.;',
    '  float pc=texelFetch(s,p,0).r;',
    '  float pe=psiAt(s,p+ivec2(1,0),pc), pw=psiAt(s,p-ivec2(1,0),pc);',
    '  float pn=psiAt(s,p-ivec2(0,1),pc), ps=psiAt(s,p+ivec2(0,1),pc);',
    '  float dxm=(pc-pw)/uDx, dxp=(pe-pc)/uDx, dym=(pc-ps)/uDx, dyp=(pn-pc)/uDx;',   // y = north
    '  vec2 c=.5*vec2(dxm+dxp,dym+dyp); float cn=length(c); vec2 n=cn>0.?c/cn:vec2(0.);',
    '  vec4 st=texelFetch(uStatic,p,0); vec2 gz=st.gb; float g=length(gz);',
    '  vec4 k=uCoef[f-1]; float U=uU*(uUseWrf>.5?uWrf[f-1]:1.);',
    '  float cw=U>0.?max(0.,dot(uWind,n)):0.; float cs=g>0.?max(0.,dot(gz,n)/g):0.; float tp=min(g,5.);',
    '  float umid=min(U,30.)*196.85;',
    '  S=min(6.,k.x+k.y*pow(max(umid,1e-6),k.z)*cw+k.w*tp*tp*cs);',
    '  float gr=sqrt(pow(max(dxm,0.),2.)+pow(min(dxp,0.),2.)+pow(max(dym,0.),2.)+pow(min(dyp,0.),2.));',
    '  return S*gr;}'
  ].join('\n');
  var SIM_PASS1 = SIM_COMMON + '\nuniform float uDt; out vec4 o;\n' +
    'void main(){ivec2 p=ivec2(gl_FragCoord.xy); vec4 s=texelFetch(uState,p,0); float S; float f=rhs(uState,p,S);' +
    ' o=vec4(s.r-uDt*f,s.g,S,s.a);}';
  var SIM_PASS2 = SIM_COMMON + [
    '', 'uniform sampler2D uStar; uniform sampler2D uRep; uniform float uDt, uT0, uTlo, uT1;',
    'uniform vec4 uIgn[24]; uniform int uNIgn;',
    'uniform vec4 uLine; uniform vec3 uLineP; uniform float uReplay, uTp;',      // line: ax,ay,bx,by (cells); radius, ros, t start
    'out vec4 o;',
    'void main(){ivec2 p=ivec2(gl_FragCoord.xy); vec4 s=texelFetch(uState,p,0);',
    ' float S1,S2; float f1=rhs(uState,p,S1); float f2=rhs(uStar,p,S2);',
    ' float psi=s.r, tg=s.g; float pn=min(psi, psi-.5*uDt*(f1+f2));',
    ' if(psi>0.&&pn<=0.) tg=min(tg,uT0+uDt*psi/max(psi-pn,1e-6));',
    ' bool fo=ok(fuelOf(p)); vec2 x=vec2(p);',
    ' for(int k=0;k<24;k++){ if(k>=uNIgn) break; vec4 g=uIgn[k];',
    '   if(g.w>uTlo&&g.w<=uT1){ float d=length(x-g.xy)*uDx-g.z; float v=fo?d:max(d,uDx); pn=min(pn,v); if(fo&&d<=0.) tg=min(tg,g.w);} }',
    ' if(uLineP.y>0.){ vec2 a=uLine.xy, b=uLine.zw; float L=length(b-a)*uDx;',
    '   float u1=clamp((uT1-uLineP.z)*uLineP.y/L,0.,1.), u0=clamp((uTlo-uLineP.z)*uLineP.y/L,0.,1.);',
    '   if(u1>u0||(uTlo<uLineP.z&&uT1>=uLineP.z)){ vec2 e=(b-a)*u1; float q=clamp(dot(x-a,e)/max(dot(e,e),1e-6),0.,1.);',
    '     float d=length(x-a-e*q)*uDx-uLineP.x; float v=fo?d:max(d,uDx); pn=min(pn,v); if(fo&&d<=0.) tg=min(tg,uLineP.z+q*u1*L/uLineP.y);} }',
    ' if(uReplay>.5&&uT1<=uTp){ float T=texelFetch(uRep,p,0).r; pn=T-uT1; tg=(T<=uT1&&fo)?T:1e9; if(!fo) pn=max(pn,uDx);}',
    ' o=vec4(pn,tg,S1,s.a);}'
  ].join('\n');
  var REDUCE = [
    '#version 300 es', 'precision highp float;', 'uniform sampler2D uState; uniform sampler2D uStatic; uniform ivec2 uSize; uniform float uT; out vec4 o;',
    'void main(){ivec2 b=ivec2(gl_FragCoord.xy)*4; float burning=0., burned=0., outside=0.;',
    ' for(int j=0;j<4;j++) for(int i=0;i<4;i++){ ivec2 p=min(b+ivec2(i,j),uSize-1); vec4 s=texelFetch(uState,p,0);',
    '  if(s.r<=0.){ burned+=1.; if(uT-s.g<900.) burning+=1.; int c=int(texelFetch(uStatic,p,0).a+.5); if(c<32) outside+=1.; } }',
    ' o=vec4(burning,burned,outside,16.)/16.;}'
  ].join('\n');
  var TERRAIN_VS = [
    '#version 300 es', 'precision highp float;', 'in vec2 aCell; uniform sampler2D uStatic; uniform mat4 uMVP; uniform float uExag, uDx; uniform vec2 uOrigin;',
    'out vec2 vCell; out vec3 vN; out float vDepth;',
    'void main(){ ivec2 c=ivec2(aCell); vec4 st=texelFetch(uStatic,c,0);',
    ' vec3 w=vec3(aCell.x*uDx-uOrigin.x, st.r*uExag, aCell.y*uDx-uOrigin.y);',
    ' vN=normalize(vec3(-st.g*uExag,1.,st.b*uExag)); vCell=aCell; gl_Position=uMVP*vec4(w,1.); vDepth=gl_Position.w; }'
  ].join('\n');
  var TERRAIN_FS = [
    '#version 300 es', 'precision highp float;',
    'in vec2 vCell; in vec3 vN; in float vDepth; uniform sampler2D uState; uniform sampler2D uStatic; uniform sampler2D uAlbedo;',
    'uniform ivec2 uSize; uniform float uT, uTime, uDark; uniform float uTf[14]; uniform vec3 uFog; out vec4 o;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}',
    'vec4 st(ivec2 p){return texelFetch(uState,clamp(p,ivec2(0),uSize-1),0);}',
    'float park(ivec2 p){return texelFetch(uStatic,clamp(p,ivec2(0),uSize-1),0).a>=31.5?1.:0.;}',
    'void main(){',
    ' vec2 g=vCell; ivec2 i0=ivec2(floor(g)); vec2 f=g-vec2(i0);',
    ' vec4 a=st(i0), b=st(i0+ivec2(1,0)), c=st(i0+ivec2(0,1)), d=st(i0+ivec2(1,1));',
    ' float psi=mix(mix(a.r,b.r,f.x),mix(c.r,d.r,f.x),f.y);',
    ' ivec2 nc=ivec2(floor(g+.5)); vec4 sn=st(nc); float tg=sn.g;',
    ' int code=int(texelFetch(uStatic,clamp(nc,ivec2(0),uSize-1),0).a+.5); int fu=code>=32?code-32:code;',
    ' float pk=mix(mix(park(i0),park(i0+ivec2(1,0)),f.x),mix(park(i0+ivec2(0,1)),park(i0+ivec2(1,1)),f.x),f.y);',
    ' vec3 alb=texture(uAlbedo,(g+.5)/vec2(uSize)).rgb;',
    ' vec3 L=normalize(vec3(-.55,.75,-.38)); float dif=.42+.7*max(dot(normalize(vN),L),0.);',
    ' vec3 col=alb*dif*(uDark>.5?1.35:1.);',
    ' float burned=smoothstep(6.,-6.,psi); float age=max(uT-tg,0.);',
    ' float tf=max(uTf[clamp(fu,1,14)-1],90.);',
    ' float flaming=burned*exp(-age/tf); float front=burned*exp(-age/150.);',
    ' vec3 charc=uDark>.5?vec3(.07,.055,.05):vec3(.16,.13,.11);',
    ' col=mix(col,charc*dif,burned*clamp(age/120.,0.,1.)*.92);',
    ' float fl=.6+.4*noise(g*1.7+vec2(uTime*2.3,-uTime*1.7))+.25*noise(g*6.+uTime*7.);',
    ' vec3 em=vec3(1.,.38,.06)*flaming*1.1*fl + vec3(1.,.82,.45)*front*1.8*fl;',
    ' float edge=1.-smoothstep(0.,fwidth(pk)*1.6+1e-4,abs(pk-.5));',
    ' col=mix(col,uDark>.5?vec3(.95,.95,.9):vec3(.08,.09,.08),edge*.55);',
    ' col+=em;',
    ' float fog=clamp((vDepth-9000.)/45000.,0.,.75); col=mix(col,uFog,fog*(1.-min(1.,flaming+front)));',
    ' o=vec4(col,1.);}'
  ].join('\n');
  var SMOKE_VS = [
    '#version 300 es', 'precision highp float;', 'in vec4 aP; uniform mat4 uMVP; uniform float uScale; out float vA; out float vHot;',
    'void main(){ gl_Position=uMVP*vec4(aP.xyz,1.); float life=aP.w; vA=sin(3.14159*clamp(life,0.,1.)); vHot=1.-clamp(life*3.,0.,1.);',
    ' gl_PointSize=clamp(uScale*(40.+260.*life)/gl_Position.w,1.,220.); }'
  ].join('\n');
  var SMOKE_FS = [
    '#version 300 es', 'precision highp float;', 'in float vA; in float vHot; uniform vec3 uSmoke; out vec4 o;',
    'void main(){ vec2 q=gl_PointCoord*2.-1.; float r=dot(q,q); if(r>1.) discard; float a=(1.-r)*(1.-r)*vA*.38;',
    ' vec3 c=mix(uSmoke,vec3(1.,.55,.2),vHot*.5); o=vec4(c,a); }'
  ].join('\n');

  var GLOW_VS = [
    '#version 300 es', 'precision highp float;', 'in vec4 aP; uniform mat4 uMVP; uniform float uPx; out float vI;',
    'void main(){ gl_Position=uMVP*vec4(aP.xyz,1.); vI=aP.w; gl_PointSize=clamp(uPx*(380.+420.*aP.w)/gl_Position.w,6.,120.); }'
  ].join('\n');
  var GLOW_FS = [
    '#version 300 es', 'precision highp float;', 'in float vI; uniform float uTime; out vec4 o;',
    'void main(){ vec2 q=gl_PointCoord*2.-1.; float r=dot(q,q); if(r>1.) discard;',
    ' float a=exp(-r*3.)*(.35+.65*vI); vec3 c=mix(vec3(1.,.35,.05),vec3(1.,.85,.45),exp(-r*8.)); o=vec4(c*a,a); }'
  ].join('\n');

  function Sim(host, meta, gridBmp, albD, albL) {
    var root = host.getAttribute('data-root') || '';
    var W = meta.W, H = meta.H, DX = meta.dx;
    var presetKey = host.getAttribute('data-preset') || 'single';
    var lockPreset = host.hasAttribute('data-lock');

    // ---------- decode the packed grid (R,G = height, B = fuel + 32 * park)
    var c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
    var x2 = c2.getContext('2d'); x2.drawImage(gridBmp, 0, 0);
    var px = x2.getImageData(0, 0, W, H).data;
    var hgt = new Float32Array(W * H), code = new Uint8Array(W * H);
    for (var k = 0; k < W * H; k++) { hgt[k] = (px[4 * k] * 256 + px[4 * k + 1]) / 65535 * meta.zmax; code[k] = px[4 * k + 2]; }
    var stat = new Float32Array(W * H * 4);
    for (var j = 0; j < H; j++) for (var i = 0; i < W; i++) {
      k = j * W + i;
      var e = hgt[j * W + Math.min(W - 1, i + 1)], w = hgt[j * W + Math.max(0, i - 1)];
      var n = hgt[Math.max(0, j - 1) * W + i], s = hgt[Math.min(H - 1, j + 1) * W + i];
      stat[4 * k] = hgt[k]; stat[4 * k + 1] = (e - w) / (2 * DX); stat[4 * k + 2] = (n - s) / (2 * DX); stat[4 * k + 3] = code[k];
    }
    function heightAt(cx, cy) {   // bilinear, cell coordinates
      var i0 = Math.max(0, Math.min(W - 2, Math.floor(cx))), j0 = Math.max(0, Math.min(H - 2, Math.floor(cy)));
      var fx = Math.min(1, Math.max(0, cx - i0)), fy = Math.min(1, Math.max(0, cy - j0));
      var a = hgt[j0 * W + i0], b = hgt[j0 * W + i0 + 1], c = hgt[(j0 + 1) * W + i0], d = hgt[(j0 + 1) * W + i0 + 1];
      return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    }

    // ---------- DOM
    var canvas = h('canvas', { class: 'sim3d-canvas', 'aria-label': '3-D view of Forest Park with a simulated fire. Drag to rotate, scroll or pinch to zoom, click to ignite.' });
    var hud = h('div', { class: 'sim3d-hud' }), help = h('div', { class: 'sim3d-help', text: 'Drag to orbit · scroll / pinch to zoom · right-drag or shift-drag to pan · click to ignite' });
    var compass = h('div', { class: 'sim3d-compass', 'aria-hidden': 'true' }, [h('span', { text: 'N' }), h('i')]);
    var labels = h('div', { class: 'sim3d-labels', 'aria-hidden': 'true' });
    var stage = h('div', { class: 'sim3d-stage' }, [canvas, labels, hud, compass, help]);
    host.appendChild(stage);
    var gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: false });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
      stage.innerHTML = '';
      stage.appendChild(h('p', { class: 'sim3d-fallback', text: 'This 3-D simulation needs WebGL 2 with floating-point render targets, which this browser does not provide. The 2-D labs on this site work everywhere.' }));
      return;
    }

    var P = { preset: presetKey, weather: 'east', wind: meta.scenarios.east.wind, dir: meta.scenarios.east.dir,
      wrf: true, speed: 12, exag: 2.0, smoke: true, playing: !reduceMotion };
    function sel(label, opts, val, on) {
      var s = h('select'); opts.forEach(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (o[0] === val) op.selected = true; s.appendChild(op); });
      s.addEventListener('change', function () { on(s.value); }); return [h('label', {}, [document.createTextNode(label), s]), s];
    }
    function rng(label, min, max, step, val, unit, on) {
      var out = h('output', { text: val + unit }), r = h('input', { type: 'range', min: min, max: max, step: step, value: val });
      r.addEventListener('input', function () { out.textContent = r.value + unit; on(+r.value); });
      return [h('label', {}, [h('span', {}, [document.createTextNode(label + ' '), out]), r]), r, out];
    }
    var presetOpts = Object.keys(meta.presets).map(function (key) { return [key, meta.presets[key].label]; });
    var cPreset = sel('Scenario', presetOpts, P.preset, function (v) { P.preset = v; reset(); focusOn(meta.presets[v]); cam0 = JSON.parse(JSON.stringify(cam)); });
    var cWx = sel('Weather', [['east', meta.scenarios.east.label], ['nw', meta.scenarios.nw.label]], 'east', function (v) {
      P.weather = v; P.wind = meta.scenarios[v].wind; P.dir = meta.scenarios[v].dir;
      cWind[1].value = P.wind; cWind[2].textContent = (P.wind * 2.237).toFixed(0) + ' mph'; cDir[1].value = P.dir; cDir[2].textContent = P.dir + '°';
      coefChanged();
    });
    var cWind = rng('Wind at 6.1 m', 0, 15, 0.1, P.wind, ' m/s', function (v) { P.wind = v; cWind[2].textContent = (v * 2.237).toFixed(0) + ' mph'; coefChanged(); });
    cWind[2].textContent = (P.wind * 2.237).toFixed(0) + ' mph';
    var cDir = rng('Wind from', 0, 359, 1, P.dir, '°', function (v) { P.dir = v; });
    var cSpeed = rng('Playback', 1, 60, 1, P.speed, ' min/s', function (v) { P.speed = v; });
    var cExag = rng('Vertical exaggeration', 1, 4, 0.1, P.exag, '×', function (v) { P.exag = v; });
    var cWrf = h('input', { type: 'checkbox' }); cWrf.checked = true; cWrf.addEventListener('change', function () { P.wrf = cWrf.checked; coefChanged(); });
    var cSmoke = h('input', { type: 'checkbox' }); cSmoke.checked = true; cSmoke.addEventListener('change', function () { P.smoke = cSmoke.checked; });
    var controls = h('div', { class: 'lab-controls' }, [lockPreset ? h('span') : cPreset[0], cWx[0], cWind[0], cDir[0], cSpeed[0], cExag[0],
      h('div', { class: 'ctl' }, [h('label', { class: 'check' }, [cWrf, document.createTextNode('Mid-flame wind (fuel windrf, fire_use_windrf = 1)')]),
                                  h('label', { class: 'check' }, [cSmoke, document.createTextNode('Smoke')])])]);
    host.appendChild(controls);
    var bPlay = h('button', { type: 'button', class: 'primary', text: P.playing ? 'Pause' : 'Play' });
    var bReset = h('button', { type: 'button', text: 'Reset' }), bView = h('button', { type: 'button', text: 'Reset view' });
    var bTop = h('button', { type: 'button', text: 'Top view' });
    host.appendChild(h('div', { class: 'lab-buttons' }, [bPlay, bReset, bView, bTop]));
    var readout = h('div', { class: 'lab-readout', 'aria-live': 'off' }); host.appendChild(readout);

    // ---------- GL resources
    function shader(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    function program(vs, fs) {
      var p = gl.createProgram(); gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i), nm = info.name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, info.name); }
      return { p: p, u: new Proxy(u, { get: function (o, key) { return key in o ? o[key] : null; } }) };
    }
    function tex(w, hh, ifmt, fmt, type, data, filter) {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, hh, 0, fmt, type, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    function fbo(t) { var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; }
    var progs;
    try {
      progs = { p1: program(FS_VERT, SIM_PASS1), p2: program(FS_VERT, SIM_PASS2), red: program(FS_VERT, REDUCE),
        ter: program(TERRAIN_VS, TERRAIN_FS), smoke: program(SMOKE_VS, SMOKE_FS), glow: program(GLOW_VS, GLOW_FS) };
    } catch (err) {
      stage.innerHTML = ''; stage.appendChild(h('p', { class: 'sim3d-fallback', text: 'WebGL error: ' + err.message })); return;
    }
    var tStatic = tex(W, H, gl.RGBA32F, gl.RGBA, gl.FLOAT, stat);
    var states = [0, 1, 2].map(function () { var t = tex(W, H, gl.RGBA32F, gl.RGBA, gl.FLOAT, null); return { t: t, f: fbo(t) }; });
    var tRep = tex(W, H, gl.R32F, gl.RED, gl.FLOAT, new Float32Array(W * H));
    var RW = Math.ceil(W / 4), RH = Math.ceil(H / 4);
    var tRed = tex(RW, RH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null), fRed = fbo(tRed), redBuf = new Uint8Array(RW * RH * 4);
    var tAlbD = tex(albD.width, albD.height, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE, albD, gl.LINEAR);
    var tAlbL = tex(albL.width, albL.height, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE, albL, gl.LINEAR);
    var quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    // terrain mesh: one vertex per cell (step 2), triangles
    var STEP = 2, MW = Math.floor((W - 1) / STEP) + 1, MH = Math.floor((H - 1) / STEP) + 1;
    var verts = new Float32Array(MW * MH * 2);
    for (j = 0; j < MH; j++) for (i = 0; i < MW; i++) { verts[2 * (j * MW + i)] = Math.min(W - 1, i * STEP); verts[2 * (j * MW + i) + 1] = Math.min(H - 1, j * STEP); }
    var idx = new Uint32Array((MW - 1) * (MH - 1) * 6), q = 0;
    for (j = 0; j < MH - 1; j++) for (i = 0; i < MW - 1; i++) {
      var a0 = j * MW + i, b0 = a0 + 1, c0 = a0 + MW, d0 = c0 + 1;
      idx[q++] = a0; idx[q++] = c0; idx[q++] = b0; idx[q++] = b0; idx[q++] = c0; idx[q++] = d0;
    }
    var vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    var ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    var NSMOKE = 1600, smoke = new Float32Array(NSMOKE * 4), smokeV = new Float32Array(NSMOKE * 4), sp = 0;
    for (k = 0; k < NSMOKE; k++) smoke[4 * k + 3] = 2;   // dead
    var sbo = gl.createBuffer(), gbo = gl.createBuffer(), glowData = new Float32Array(0);

    // ---------- simulation state
    var cur = 0, t = 0, tlo = -1, ign = [], line = null, replay = false, tp = 0, simStart = 0;
    var origin = [W * DX / 2, H * DX / 2];
    function windVec() { var a = (P.dir + 180) * Math.PI / 180; return [Math.sin(a), Math.cos(a)]; }
    var Smax = 1;
    function coefChanged() {
      var cf = meta.coef[P.weather], tm = Math.min(meta.tan_max, 5); Smax = 0.05;
      for (var m = 0; m < 13; m++) {
        var U = P.wind * (P.wrf ? meta.windrf[m] : 1), u = Math.min(U, 30) * 196.85;
        var s = Math.min(6, cf[m][0] + cf[m][1] * Math.pow(Math.max(u, 1e-6), cf[m][2]) + cf[m][3] * tm * tm);
        if (s > Smax) Smax = s;
      }
    }
    function buildReplay(pr) {
      var poly = pr.perim, ig = pr.ign, T = new Float32Array(W * H), TP = pr.tp;
      function pip(x, y) { var c = false; for (var a = 0, b = poly.length - 1; a < poly.length; b = a++) { var A = poly[a], B = poly[b]; if ((A[1] > y) !== (B[1] > y) && x < (B[0] - A[0]) * (y - A[1]) / (B[1] - A[1]) + A[0]) c = !c; } return c; }
      for (var jj = 0; jj < H; jj++) for (var ii = 0; ii < W; ii++) {
        var kk = jj * W + ii, x = ii, y = jj;
        var dmin = Infinity;
        for (var e = 0; e < poly.length; e++) {
          var A = poly[e], B = poly[(e + 1) % poly.length], vx = B[0] - A[0], vy = B[1] - A[1];
          var tt = Math.max(0, Math.min(1, ((x - A[0]) * vx + (y - A[1]) * vy) / (vx * vx + vy * vy || 1)));
          var dd = Math.hypot(x - A[0] - tt * vx, y - A[1] - tt * vy); if (dd < dmin) dmin = dd;
        }
        if (!pip(x, y)) { T[kk] = TP + dmin * DX / 0.3; continue; }
        var ux = x - ig[0], uy = y - ig[1], r = Math.hypot(ux, uy);
        if (r < 1e-6) { T[kk] = 0; continue; }
        ux /= r; uy /= r; var R = Infinity;
        for (e = 0; e < poly.length; e++) {
          A = poly[e]; B = poly[(e + 1) % poly.length]; var ex = B[0] - A[0], ey = B[1] - A[1], wx = A[0] - ig[0], wy = A[1] - ig[1];
          var den = ux * ey - uy * ex; if (Math.abs(den) < 1e-12) continue;
          var t1 = (wx * ey - wy * ex) / den, s1 = (wx * uy - wy * ux) / den;
          if (s1 >= 0 && s1 <= 1 && t1 >= r - 1e-6 && t1 < R) R = t1;
        }
        T[kk] = isFinite(R) ? TP * Math.min(1, r / R) : TP;
      }
      gl.bindTexture(gl.TEXTURE_2D, tRep); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, W, H, 0, gl.RED, gl.FLOAT, T);
    }
    function reset() {
      var init = new Float32Array(W * H * 4);
      for (var kk = 0; kk < W * H; kk++) { init[4 * kk] = BIG; init[4 * kk + 1] = NEVER; }
      states.forEach(function (s) { gl.bindTexture(gl.TEXTURE_2D, s.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, init); });
      t = 0; tlo = -1; cur = 0; ign = []; line = null; replay = false;
      var pr = meta.presets[P.preset];
      (pr.ign && pr.ign.length && typeof pr.ign[0] === 'object' && pr.ign[0].length === 4 ? pr.ign : []).forEach(function (g) { ign.push(g.slice()); });
      if (pr.line) line = { a: pr.line[0], b: pr.line[1], ros: pr.ros, t: pr.t || 0, r: 30 };
      if (pr.perim) { buildReplay(pr); replay = true; tp = pr.tp; }
      for (var m = 0; m < NSMOKE; m++) smoke[4 * m + 3] = 2;
      burnedHa = 0; outsideHa = 0;
    }
    var burnedHa = 0, outsideHa = 0;

    function runPass(prog, target, bind) {
      gl.useProgram(prog.p); gl.bindFramebuffer(gl.FRAMEBUFFER, target);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad); var loc = gl.getAttribLocation(prog.p, 'p');
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      bind(prog.u); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function common(u, stateTex) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, stateTex); gl.uniform1i(u.uState, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tStatic); gl.uniform1i(u.uStatic, 1);
      gl.uniform2i(u.uSize, W, H); gl.uniform1f(u.uDx, DX);
      var cf = meta.coef[P.weather], flat = [];
      for (var m = 0; m < 13; m++) flat.push(cf[m][0], cf[m][1], cf[m][2], cf[m][3]);
      gl.uniform4fv(u.uCoef, flat); gl.uniform1fv(u.uWrf, meta.windrf); gl.uniform1f(u.uUseWrf, P.wrf ? 1 : 0);
      var wv = windVec(); gl.uniform2f(u.uWind, wv[0], wv[1]); gl.uniform1f(u.uU, P.wind);
    }
    function step(dt) {
      var A = states[cur], B = states[(cur + 1) % 3], C = states[(cur + 2) % 3];
      gl.viewport(0, 0, W, H); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      runPass(progs.p1, B.f, function (u) { common(u, A.t); gl.uniform1f(u.uDt, dt); });
      runPass(progs.p2, C.f, function (u) {
        common(u, A.t);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, B.t); gl.uniform1i(u.uStar, 2);
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, tRep); gl.uniform1i(u.uRep, 3);
        gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uT0, t); gl.uniform1f(u.uTlo, tlo); gl.uniform1f(u.uT1, t + dt);
        var flat = []; for (var m = 0; m < 24; m++) { var g = ign[m] || [0, 0, 0, -1e9]; flat.push(g[0], g[1], g[2], g[3]); }
        gl.uniform4fv(u.uIgn, flat); gl.uniform1i(u.uNIgn, Math.min(24, ign.length));
        if (line) { gl.uniform4f(u.uLine, line.a[0], line.a[1], line.b[0], line.b[1]); gl.uniform3f(u.uLineP, line.r, line.ros, line.t); }
        else { gl.uniform4f(u.uLine, 0, 0, 0, 0); gl.uniform3f(u.uLineP, 0, 0, 0); }
        gl.uniform1f(u.uReplay, replay ? 1 : 0); gl.uniform1f(u.uTp, tp);
      });
      cur = (cur + 2) % 3; tlo = t; t += dt;
    }
    var lastRead = 0, hot = [];
    function readBack(now, force) {
      if (!force && now - lastRead < 350) return; lastRead = now;
      gl.viewport(0, 0, RW, RH);
      runPass(progs.red, fRed, function (u) {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, states[cur].t); gl.uniform1i(u.uState, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tStatic); gl.uniform1i(u.uStatic, 1);
        gl.uniform2i(u.uSize, W, H); gl.uniform1f(u.uT, t);
      });
      gl.readPixels(0, 0, RW, RH, gl.RGBA, gl.UNSIGNED_BYTE, redBuf);
      var b = 0, o = 0; hot = [];
      for (var kk = 0; kk < RW * RH; kk++) {
        b += redBuf[4 * kk + 1]; o += redBuf[4 * kk + 2];
        if (redBuf[4 * kk] > 0) hot.push(kk, redBuf[4 * kk]);
      }
      burnedHa = b / 255 * 16 * DX * DX / 1e4; outsideHa = o / 255 * 16 * DX * DX / 1e4;
      glowData = new Float32Array(hot.length * 2);
      for (var m = 0; m < hot.length / 2; m++) {
        var cell = hot[2 * m], wp = worldOfCell((cell % RW) * 4 + 2, ((cell / RW) | 0) * 4 + 2);
        glowData[4 * m] = wp[0]; glowData[4 * m + 1] = wp[1] + 15; glowData[4 * m + 2] = wp[2]; glowData[4 * m + 3] = hot[2 * m + 1] / 255;
      }
    }

    // ---------- camera
    var cam = { az: -0.78, el: 0.62, dist: 15500, tx: meta.park_center[0] * DX - origin[0], tz: meta.park_center[1] * DX - origin[1] };
    function focusOn(pr) {
      var pts = [];
      if (pr.ign && pr.ign.length && typeof pr.ign[0] === 'object') pr.ign.forEach(function (g) { pts.push(g); });
      else if (pr.ign && pr.ign.length === 2) pts.push(pr.ign);
      if (pr.line) pts.push(pr.line[0], pr.line[1]);
      if (!pts.length) return;
      var cx = 0, cy = 0; pts.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= pts.length; cy /= pts.length;
      var spread = 0; pts.forEach(function (p) { spread = Math.max(spread, Math.hypot(p[0] - cx, p[1] - cy)); });
      cam.tx = cx * DX - origin[0]; cam.tz = cy * DX - origin[1];
      cam.dist = Math.max(3600, Math.min(16000, 3600 + spread * DX * 2.2)); cam.el = spread < 20 ? 0.85 : 0.72;
    }
    focusOn(meta.presets[P.preset]);
    var cam0 = JSON.parse(JSON.stringify(cam));
    var view, proj, mvp, eye;
    function camera() {
      var asp = canvas.clientWidth / Math.max(1, canvas.clientHeight);
      var ty = 160 * P.exag;
      eye = [cam.tx + cam.dist * Math.cos(cam.el) * Math.sin(cam.az), ty + cam.dist * Math.sin(cam.el), cam.tz + cam.dist * Math.cos(cam.el) * Math.cos(cam.az)];
      view = lookAt(eye, [cam.tx, ty, cam.tz], [0, 1, 0]); proj = persp(0.75, asp, 20, 90000); mvp = mul(proj, view);
    }
    function worldOfCell(cx, cy) { return [cx * DX - origin[0], heightAt(cx, cy) * P.exag, cy * DX - origin[1]]; }
    function project(wp) {
      var c = xf(mvp, [wp[0], wp[1], wp[2], 1]); if (c[3] <= 0) return null;
      return [(c[0] / c[3] * 0.5 + 0.5) * canvas.clientWidth, (1 - (c[1] / c[3] * 0.5 + 0.5)) * canvas.clientHeight];
    }
    function pick(clientX, clientY) {
      var r = canvas.getBoundingClientRect(), nx = (clientX - r.left) / r.width * 2 - 1, ny = 1 - (clientY - r.top) / r.height * 2;
      var im = inv(mvp), p0 = xf(im, [nx, ny, -1, 1]), p1 = xf(im, [nx, ny, 1, 1]);
      p0 = [p0[0] / p0[3], p0[1] / p0[3], p0[2] / p0[3]]; p1 = [p1[0] / p1[3], p1[1] / p1[3], p1[2] / p1[3]];
      var d = norm([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]);
      for (var s = 0, prev = null; s < 90000; s += 15) {
        var x = p0[0] + d[0] * s, y = p0[1] + d[1] * s, z = p0[2] + d[2] * s;
        var cx = (x + origin[0]) / DX, cy = (z + origin[1]) / DX;
        if (cx < 0 || cy < 0 || cx > W - 1 || cy > H - 1) { if (prev) break; continue; }
        prev = true;
        if (y <= heightAt(cx, cy) * P.exag) return [cx, cy];
      }
      return null;
    }

    // ---------- labels
    var labelEls = Object.keys(meta.places).map(function (name) {
      var el = h('span', { text: name }); labels.appendChild(el); return { el: el, c: meta.places[name] };
    });
    var ignEls = [];

    // ---------- rendering
    var start = performance.now(), lastFrame = start, visible = true;
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), w = canvas.clientWidth, hh = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(hh * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr); }
    }
    function draw(now) {
      resize(); camera();
      var dark = isDark(), bg = dark ? [0.06, 0.065, 0.07] : [0.80, 0.84, 0.88];
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      var pr = progs.ter; gl.useProgram(pr.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo); var loc = gl.getAttribLocation(pr.p, 'aCell');
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, states[cur].t); gl.uniform1i(pr.u.uState, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tStatic); gl.uniform1i(pr.u.uStatic, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, dark ? tAlbD : tAlbL); gl.uniform1i(pr.u.uAlbedo, 2);
      gl.uniformMatrix4fv(pr.u.uMVP, false, mvp); gl.uniform1f(pr.u.uExag, P.exag); gl.uniform1f(pr.u.uDx, DX);
      gl.uniform2f(pr.u.uOrigin, origin[0], origin[1]); gl.uniform2i(pr.u.uSize, W, H);
      gl.uniform1f(pr.u.uT, t); gl.uniform1f(pr.u.uTime, (now - start) / 1000); gl.uniform1f(pr.u.uDark, dark ? 1 : 0);
      gl.uniform1fv(pr.u.uTf, meta.weight.concat([7]).map(function (wt) { return wt / 0.85; }));
      gl.uniform3f(pr.u.uFog, bg[0], bg[1], bg[2]);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_INT, 0);
      drawGlow(now);
      if (P.smoke) drawSmoke(dark);
      // labels and ignition markers
      labelEls.forEach(function (L) {
        var s = project(worldOfCell(L.c[0], L.c[1]));
        if (!s) { L.el.style.display = 'none'; return; }
        L.el.style.display = ''; L.el.style.transform = 'translate(' + s[0].toFixed(0) + 'px,' + s[1].toFixed(0) + 'px)';
      });
      while (ignEls.length < ign.length) { var m = h('i', { class: 'ign' }); labels.appendChild(m); ignEls.push(m); }
      ignEls.forEach(function (el, n) {
        var g = ign[n]; if (!g) { el.style.display = 'none'; return; }
        var s2 = project(worldOfCell(g[0], g[1]));
        el.style.display = s2 ? '' : 'none'; if (s2) el.style.transform = 'translate(' + s2[0].toFixed(0) + 'px,' + s2[1].toFixed(0) + 'px)';
        el.classList.toggle('done', g[3] <= t);
      });
      compass.style.transform = 'rotate(' + (cam.az * 180 / Math.PI + 180).toFixed(1) + 'deg)';
      var wa = compass.querySelector('i'); wa.style.transform = 'rotate(' + (P.dir + 180) + 'deg)';
      var hrs = Math.floor(t / 3600), mins = Math.floor((t % 3600) / 60);
      hud.textContent = hrs + ' h ' + (mins < 10 ? '0' : '') + mins + ' min · ' + burnedHa.toFixed(1) + ' ha burned · ' +
        outsideHa.toFixed(1) + ' ha outside the park' + (replay && t < tp ? ' · replaying the perimeter' : '');
    }
    function drawGlow(now) {
      if (!glowData.length) return;
      var pr = progs.glow; gl.useProgram(pr.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, gbo); gl.bufferData(gl.ARRAY_BUFFER, glowData, gl.DYNAMIC_DRAW);
      var loc = gl.getAttribLocation(pr.p, 'aP'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(pr.u.uMVP, false, mvp); gl.uniform1f(pr.u.uPx, canvas.height * 0.9);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
      gl.drawArrays(gl.POINTS, 0, glowData.length / 4);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    function drawSmoke(dark) {
      var pr = progs.smoke; gl.useProgram(pr.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, sbo); gl.bufferData(gl.ARRAY_BUFFER, smoke, gl.DYNAMIC_DRAW);
      var loc = gl.getAttribLocation(pr.p, 'aP'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(pr.u.uMVP, false, mvp); gl.uniform1f(pr.u.uScale, canvas.height * 1.4);
      gl.uniform3f(pr.u.uSmoke, dark ? 0.55 : 0.42, dark ? 0.55 : 0.42, dark ? 0.57 : 0.44);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.drawArrays(gl.POINTS, 0, NSMOKE);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    function updateSmoke(dtReal) {
      var wv = windVec(), drift = Math.min(P.wind, 15) * 18;
      for (var m = 0; m < NSMOKE; m++) {
        if (smoke[4 * m + 3] >= 1) continue;
        smoke[4 * m] += (wv[0] * drift + smokeV[4 * m]) * dtReal;
        smoke[4 * m + 2] += (-wv[1] * drift + smokeV[4 * m + 2]) * dtReal;
        smoke[4 * m + 1] += smokeV[4 * m + 1] * dtReal;
        smoke[4 * m + 3] += dtReal / smokeV[4 * m + 3];
      }
      if (!hot.length || !P.playing) return;
      var n = Math.min(40, Math.ceil(hot.length / 6));
      for (var s = 0; s < n; s++) {
        var pick2 = (Math.random() * (hot.length / 2)) | 0, cell = hot[2 * pick2];
        var cx = (cell % RW) * 4 + Math.random() * 4, cy = ((cell / RW) | 0) * 4 + Math.random() * 4, wp = worldOfCell(cx, cy);
        smoke[4 * sp] = wp[0]; smoke[4 * sp + 1] = wp[1] + 20; smoke[4 * sp + 2] = wp[2]; smoke[4 * sp + 3] = 0;
        smokeV[4 * sp] = (Math.random() - 0.5) * 60; smokeV[4 * sp + 1] = 120 + Math.random() * 160; smokeV[4 * sp + 2] = (Math.random() - 0.5) * 60;
        smokeV[4 * sp + 3] = 5 + Math.random() * 6;
        sp = (sp + 1) % NSMOKE;
      }
    }
    function frame(now) {
      var dtReal = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
      if (visible) {
        if (P.playing) {
          var target = P.speed * 60 * dtReal, done = 0, dtMax = Math.min(10, 0.45 * DX / Smax), n = 0;
          while (done < target - 1e-6 && n < 60) { var d = Math.min(dtMax, target - done); step(d); done += d; n++; }
          if (t > 12 * 3600) { P.playing = false; bPlay.textContent = 'Play'; }
        }
        readBack(now); updateSmoke(dtReal); draw(now);
      }
      requestAnimationFrame(frame);
    }

    // ---------- interaction
    var ptrs = {}, downAt = null, moved = 0, pinch0 = 0;
    canvas.addEventListener('pointerdown', function (e) {
      canvas.setPointerCapture(e.pointerId); ptrs[e.pointerId] = [e.clientX, e.clientY];
      downAt = { x: e.clientX, y: e.clientY, t: performance.now(), btn: e.button, shift: e.shiftKey }; moved = 0;
      var ks = Object.keys(ptrs); if (ks.length === 2) pinch0 = Math.hypot(ptrs[ks[0]][0] - ptrs[ks[1]][0], ptrs[ks[0]][1] - ptrs[ks[1]][1]);
      help.hidden = true;
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!ptrs[e.pointerId]) return;
      var p0 = ptrs[e.pointerId], dx = e.clientX - p0[0], dy = e.clientY - p0[1]; ptrs[e.pointerId] = [e.clientX, e.clientY];
      moved += Math.abs(dx) + Math.abs(dy);
      var ks = Object.keys(ptrs);
      if (ks.length === 2) {
        var d = Math.hypot(ptrs[ks[0]][0] - ptrs[ks[1]][0], ptrs[ks[0]][1] - ptrs[ks[1]][1]);
        if (pinch0) cam.dist = Math.max(2500, Math.min(45000, cam.dist * pinch0 / d)); pinch0 = d; return;
      }
      if (downAt && (downAt.btn === 2 || downAt.shift)) {
        var sx = cam.dist / canvas.clientHeight * 1.0;
        cam.tx -= (Math.cos(cam.az) * dx - Math.sin(cam.az) * dy) * sx; cam.tz -= (-Math.sin(cam.az) * dx - Math.cos(cam.az) * dy) * sx;
      } else {
        cam.az -= dx * 0.006; cam.el = Math.max(0.12, Math.min(1.5, cam.el + dy * 0.005));
      }
    });
    function up(e) {
      delete ptrs[e.pointerId];
      if (downAt && moved < 6 && performance.now() - downAt.t < 400 && downAt.btn === 0) {
        var c = pick(e.clientX, e.clientY);
        if (c) { ign.push([c[0], c[1], 40, t + 1]); if (ign.length > 24) ign.shift(); if (!P.playing) { P.playing = true; bPlay.textContent = 'Pause'; } }
      }
      downAt = null; pinch0 = 0;
    }
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); cam.dist = Math.max(2500, Math.min(45000, cam.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
    bPlay.addEventListener('click', function () { P.playing = !P.playing; bPlay.textContent = P.playing ? 'Pause' : 'Play'; });
    bReset.addEventListener('click', function () { reset(); });
    bView.addEventListener('click', function () { cam = JSON.parse(JSON.stringify(cam0)); });
    bTop.addEventListener('click', function () { cam.el = 1.5; cam.az = 0; cam.dist = 21000; });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(host);

    coefChanged(); reset();
    if (host.hasAttribute('data-nohelp')) help.hidden = true;
    var pre = parseFloat(host.getAttribute('data-prerun') || (reduceMotion ? '3600' : '0'));
    for (var s0 = 0; s0 < 5000 && t < pre; s0++) step(Math.min(10, 0.45 * DX / Smax));
    if (pre > 0) readBack(performance.now(), true);
    requestAnimationFrame(frame);
    host.classList.add('ready');
  }

  var dataPromise = null;
  function loadData(root) {
    if (!dataPromise) {
      dataPromise = Promise.all([get(root + 'data/fp3d.json').then(function (r) { return r.json(); }), loadBitmap(root + 'data/fp3d-grid.png'),
        loadBitmap(root + 'img/fire/fuelmap-dark.jpg'), loadBitmap(root + 'img/fire/fuelmap-light.jpg')]);
      dataPromise.catch(function () { dataPromise = null; });   // allow a retry
    }
    return dataPromise;
  }
  function start(el) {
    var root = el.getAttribute('data-root') || '';
    el.classList.add('loading');
    var wait = h('p', { class: 'sim3d-fallback', text: 'Loading Forest Park terrain and fuel map…' });
    el.appendChild(wait);
    loadData(root).then(function (r) {
      wait.remove(); el.classList.remove('loading');
      try { Sim(el, r[0], r[1], r[2], r[3]); }
      catch (err) { el.appendChild(h('p', { class: 'sim3d-fallback', text: 'The 3-D simulation could not start: ' + err.message })); }
    }).catch(function (err) {
      wait.textContent = 'Could not load the Forest Park data (' + err.message + '). ';
      var b = h('button', { type: 'button', class: 'copy', text: 'Retry' });
      b.addEventListener('click', function () { wait.remove(); start(el); });
      wait.appendChild(b);
    });
  }
  function init() {
    var hosts = document.querySelectorAll('[data-sim3d]');
    if (!hosts.length) return;
    // load lazily, when a simulator is about to scroll into view
    function go(el) { if (!el.__sim3dStarted) { el.__sim3dStarted = true; start(el); } }
    // on or near the screen already: start right away
    hosts.forEach(function (el) { if (el.getBoundingClientRect().top < window.innerHeight + 600) go(el); });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); go(e.target); } });
      }, { rootMargin: '600px 0px' });
      hosts.forEach(function (el) { io.observe(el); });
    }
    // fallback: whatever has not started 1.5 s after the page finished loading starts now
    function late() { setTimeout(function () { hosts.forEach(go); }, 1500); }
    if (document.readyState === 'complete') late(); else window.addEventListener('load', late);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
