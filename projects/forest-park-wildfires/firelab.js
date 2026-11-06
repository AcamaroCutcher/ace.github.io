/*
 * Fire lab (WebGL 2): WRF-SFIRE's level-set fire model on a 3 x 2 km piece of Forest Park at 10 m.
 *
 * The update is a line-by-line port of SFIRE's tend_ls + prop_ls (module_fr_sfire_core.F):
 *   diffL/R one-sided differences, diffC = diffL + diffR (twice central),
 *   |grad psi| by fire_upwinding 0 none, 1 standard, 2 Godunov, 3 ENO (default), 4 Sethian,
 *   ros from fire_ros / fire_ros_cawfe (fire_advection 0 or 1), capped at 6 m/s, grows only,
 *   tend = -ros |grad psi| + fire_viscosity |ros| ((diffRx - diffLx) + (diffRy - diffLy)),
 *   Heun / RK2 with fire_back_weight, boundary extension "by extrapolation but never down".
 * Terrain: USGS 3DEP 10 m. Fuel: this project's WUI map (Anderson 13). Weather: Section 04 scenarios.
 *
 * <div class="lab" data-lab="levelset|perimeter" data-preset="single|multi|perimeter" data-root="../"></div>
 * Falls back to the canvas labs (levelset.js, perimeter.js) when WebGL 2 float targets are missing.
 */
(function () {
  'use strict';
  var test = document.createElement('canvas').getContext('webgl2');
  var GPU = !!(test && test.getExtension('EXT_color_buffer_float'));
  window.FIRELAB_GPU = GPU;
  if (!GPU) return;
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
  function get(url) {
    return fetch(url).catch(function () { return fetch(url, { cache: 'reload' }); })
      .then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r; });
  }

  var VS = '#version 300 es\nin vec2 p; out vec2 vUV; void main(){ vUV=p*.5+.5; gl_Position=vec4(p,0.,1.); }';
  var COMMON = [
    '#version 300 es', 'precision highp float;', 'precision highp int;',
    'uniform sampler2D uState, uStatic; uniform ivec2 uSize; uniform float uDx;',
    'uniform vec4 uCoef[13]; uniform float uWrf[13]; uniform float uUseWrf; uniform vec2 uWind; uniform float uU;',
    'uniform int uUpw, uAdv, uWalls; uniform float uVisc;',
    'int fuelOf(ivec2 p){ return int(texelFetch(uStatic,clamp(p,ivec2(0),uSize-1),0).a+.5) & 15; }',
    'bool ok(int f){ return f>=1 && f<=13; }',
    // psi at p; outside the domain: extrapolate but never down (fire_lfn_ext_up = 1)
    'float ps(sampler2D s, ivec2 p, float pc){',
    '  ivec2 q=clamp(p,ivec2(0),uSize-1);',
    '  if(q!=p){ ivec2 inner=clamp(q-(p-q),ivec2(0),uSize-1); float e=texelFetch(s,q,0).r, i=texelFetch(s,inner,0).r; return max(e, 2.*e-i); }',
    '  if(uWalls==1 && !ok(fuelOf(p))) return pc;',
    '  return texelFetch(s,p,0).r; }',
    'float selUpw(float L,float R){ if(L>0.&&R>0.) return L; if(L<0.&&R<0.) return R; return 0.; }',
    'float selGod(float L,float R){ float C=R+L; if(L>0.&&!(C<0.)) return L; if(R<0.&&C<0.) return R; return 0.; }',
    'float selEno(float L,float R){ if(!(L>0.)&&!(R>0.)) return R; if(!(L<0.)&&!(R<0.)) return L;',
    '  if(!(L<0.)&&!(R>0.)) return !(abs(R)<abs(L))?R:L; return 0.; }',
    'float tend(sampler2D s, ivec2 p, out float ros){',
    '  ros=0.; int f=fuelOf(p); float pc=texelFetch(s,p,0).r;',
    '  float pe=ps(s,p+ivec2(1,0),pc), pw=ps(s,p-ivec2(1,0),pc), pn=ps(s,p-ivec2(0,1),pc), pso=ps(s,p+ivec2(0,1),pc);',
    '  float dRx=(pe-pc)/uDx, dLx=(pc-pw)/uDx, dRy=(pn-pc)/uDx, dLy=(pc-pso)/uDx;',   // y = north
    '  float dCx=dLx+dRx, dCy=dLy+dRy, gr, d2x=0., d2y=0.;',
    '  if(uUpw==0) gr=sqrt(dCx*dCx+dCy*dCy);',
    '  else if(uUpw==1){ d2x=selUpw(dLx,dRx); d2y=selUpw(dLy,dRy); gr=sqrt(d2x*d2x+d2y*d2y); }',
    '  else if(uUpw==2){ d2x=selGod(dLx,dRx); d2y=selGod(dLy,dRy); gr=sqrt(d2x*d2x+d2y*d2y); }',
    '  else if(uUpw==3){ d2x=selEno(dLx,dRx); d2y=selEno(dLy,dRy); gr=sqrt(d2x*d2x+d2y*d2y); }',
    '  else gr=sqrt(pow(max(dLx,0.),2.)+pow(min(dRx,0.),2.)+pow(max(dLy,0.),2.)+pow(min(dRy,0.),2.));',
    '  if(!ok(f)) return 0.;',
    // fire_ros: normal from the twice-central differences, then fire_ros_cawfe (Rothermel)
    '  float cn=length(vec2(dCx,dCy)); vec2 n=cn>0.?vec2(dCx,dCy)/cn:vec2(0.);',
    '  vec4 st=texelFetch(uStatic,p,0); vec2 gz=st.gb; vec4 k=uCoef[f-1];',
    '  float U=uU*(uUseWrf>.5?uWrf[f-1]:1.); vec2 Uv=U*uWind;',
    '  float speed, tanphi, cw=1., cs=1.;',
    '  if(uAdv==1){ speed=length(Uv)+1e-9; tanphi=length(gz)+1e-9; cw=max(0.,dot(Uv,n)/speed); cs=max(0.,dot(gz,n)/tanphi); }',
    '  else { speed=dot(Uv,n); tanphi=dot(gz,n); }',
    '  float umid=min(max(speed,0.),30.)*196.85;',
    '  float rw=k.y*pow(max(umid,1e-6),k.z), tp=clamp(tanphi,0.,5.), rs=k.w*tp*tp, rb=k.x;',
    '  rw*=cw; rs*=cs; float ex=rb+rw+rs-6.; if(ex>0.){ float tot=rw+rs; rw-=ex*rw/tot; rs-=ex*rs/tot; }',
    '  ros=max(rb+rw+rs,0.);',
    '  return -ros*gr + uVisc*abs(ros)*((dRx-dLx)+(dRy-dLy)); }'
  ].join('\n');
  var P1 = COMMON + '\nuniform float uDt; out vec4 o;\nvoid main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 s=texelFetch(uState,p,0); float r; float te=tend(uState,p,r); o=vec4(s.r+uDt*te,s.g,r,s.a); }';
  var P2 = COMMON + [
    '', 'uniform sampler2D uStar, uRep; uniform float uDt, uT0, uTlo, uT1, uW, uReplay, uTp; uniform vec4 uIgn[24]; uniform int uNIgn; out vec4 o;',
    'void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 s=texelFetch(uState,p,0); float r1,r2;',
    ' float t1=tend(uState,p,r1), t2=tend(uStar,p,r2); float psi=s.r, tg=s.g;',
    ' float pn=min(psi, psi+uDt*((1.-uW)*t1+uW*t2));',                        // fire_grows_only
    ' if(psi>0.&&pn<=0.) tg=min(tg,uT0+uDt*psi/max(psi-pn,1e-6));',
    ' bool fo=ok(fuelOf(p)); vec2 x=vec2(p);',
    ' for(int k=0;k<24;k++){ if(k>=uNIgn) break; vec4 g=uIgn[k];',
    '   if(g.w>uTlo&&g.w<=uT1){ float d=length(x-g.xy)*uDx-g.z; float v=(fo||uWalls==0)?d:max(d,uDx); pn=min(pn,v); if(fo&&d<=0.) tg=min(tg,g.w);} }',
    ' if(uReplay>.5&&uT1<=uTp){ float T=texelFetch(uRep,p,0).r; pn=T-uT1; tg=(T<=uT1&&fo)?T:1e9; }',
    ' o=vec4(pn,tg,r1,s.a); }'
  ].join('\n');
  var DRAW = [
    '#version 300 es', 'precision highp float;', 'in vec2 vUV; out vec4 o;',
    'uniform sampler2D uState, uStatic; uniform ivec2 uSize; uniform float uDx, uT, uTime, uDark, uZmin, uZmax, uIso; uniform int uView; uniform float uTf[14];',
    'vec4 S(ivec2 p){ return texelFetch(uState,clamp(p,ivec2(0),uSize-1),0); }',
    'vec4 Q(ivec2 p){ return texelFetch(uStatic,clamp(p,ivec2(0),uSize-1),0); }',
    'float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
    'float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }',
    'float line(float v, float w){ float fw=fwidth(v)*w+1e-6; return 1.-smoothstep(0.,fw,abs(v)); }',
    'vec3 fuelCol(int f){',
    '  if(f>=1&&f<=3) return vec3(.93,.70,.30);', '  if(f>=4&&f<=7) return vec3(.62,.55,.85);',
    '  if(f==8||f==9) return vec3(.36,.62,.36);', '  if(f>=10&&f<=13) return vec3(.47,.47,.78);', '  return vec3(.72,.72,.70); }',
    'void main(){',
    ' vec2 g=vec2(vUV.x*float(uSize.x)-.5, (1.-vUV.y)*float(uSize.y)-.5);',
    ' ivec2 i0=ivec2(floor(g)); vec2 f=g-vec2(i0);',
    ' vec4 a=S(i0), b=S(i0+ivec2(1,0)), c=S(i0+ivec2(0,1)), d=S(i0+ivec2(1,1));',
    ' float psi=mix(mix(a.r,b.r,f.x),mix(c.r,d.r,f.x),f.y);',
    ' ivec2 nc=ivec2(floor(g+.5)); vec4 sn=S(nc), qn=Q(nc); int fu=int(qn.a+.5)&15; bool park=(int(qn.a+.5)&32)!=0;',
    ' float tg=min(min(a.g,b.g),min(c.g,d.g));',
    ' vec4 qa=Q(i0), qb=Q(i0+ivec2(1,0)), qc=Q(i0+ivec2(0,1)), qd=Q(i0+ivec2(1,1));',
    ' vec2 gz=mix(mix(qa.gb,qb.gb,f.x),mix(qc.gb,qd.gb,f.x),f.y); float z=mix(mix(qa.r,qb.r,f.x),mix(qc.r,qd.r,f.x),f.y);',
    ' vec3 nrm=normalize(vec3(-gz.x*1.6,-gz.y*1.6,1.)); float hs=clamp(.55+.75*dot(nrm,normalize(vec3(-.6,.55,.6))),.25,1.25);',
    ' vec3 col;',
    ' if(uView==1){',   // level-set function
    '   float v=clamp(psi/300.,-1.,1.); vec3 mid=uDark>.5?vec3(.22,.22,.21):vec3(.94,.94,.92);',
    '   vec3 neg=uDark>.5?vec3(.90,.40,.40):vec3(.89,.29,.28), pos=uDark>.5?vec3(.22,.53,.90):vec3(.16,.47,.84);',
    '   col=mix(mid, v<0.?neg:pos, abs(v)); col*=mix(1.,hs,.25);',
    '   float lv=line(mod(psi+12.5,25.)-12.5,1.2)*(abs(psi)<BIGLIM?1.:0.); col=mix(col,col*.55,lv*.7);',
    '   col=mix(col,uDark>.5?vec3(1.,.95,.75):vec3(.07,.07,.07),line(psi,2.2));',
    ' } else if(uView==2){',  // arrival time
    '   vec3 base=(uDark>.5?vec3(.17,.17,.16):vec3(.95,.95,.93))*hs;',
    '   float q=clamp(tg/max(uT,60.),0.,1.); vec3 lo=vec3(1.,.86,.62), hi=vec3(.55,.12,.04);',
    '   col=tg<1e8&&psi<=0.?mix(lo,hi,q)*mix(1.,hs,.35):base;',
    '   if(tg<1e8) col=mix(col,col*.45,line(mod(tg+uIso*.5,uIso)-uIso*.5,1.)*.8);',
    '   col=mix(col,uDark>.5?vec3(1.,.95,.75):vec3(.07,.07,.07),line(psi,2.));',
    ' } else {',              // fire on the fuel map
    '   vec3 fc=fuelCol(fu); vec3 base=uDark>.5?fc*.42:mix(fc,vec3(1.),.35);',
    '   col=base*hs;',
    '   float burned=smoothstep(3.,-3.,psi); float age=max(uT-sn.g,0.);',
    '   float tf=max(uTf[clamp(fu,1,14)-1],60.);',
    '   float flaming=burned*exp(-age/tf), front=burned*exp(-age/90.);',
    '   vec3 charc=uDark>.5?vec3(.06,.05,.045):vec3(.20,.17,.15);',
    '   col=mix(col,charc*hs,burned*clamp(age/90.,0.,1.)*.9);',
    '   float fl=.55+.45*noise(g*.9+vec2(uTime*2.1,-uTime*1.4))+.3*noise(g*3.1+uTime*6.);',
    '   col+=vec3(1.,.36,.05)*flaming*.9*fl + vec3(1.,.85,.5)*front*1.4*fl;',
    '   if(tg<1e8&&psi<=0.) col=mix(col,col*.6+vec3(.08,.03,0.),line(mod(tg+uIso*.5,uIso)-uIso*.5,1.)*.55);',
    '   col=mix(col,vec3(1.,.93,.6),line(psi,1.6)*(burned>0.?1.:.6)*step(age,1200.));',
    ' }',
    ' float pk=mix(mix(float((int(qa.a+.5)&32)!=0),float((int(qb.a+.5)&32)!=0),f.x),mix(float((int(qc.a+.5)&32)!=0),float((int(qd.a+.5)&32)!=0),f.x),f.y);',
    ' col=mix(col,uDark>.5?vec3(.92,.92,.88):vec3(.12,.13,.12),line(pk-.5,1.4)*.5);',
    ' o=vec4(col,1.); }'
  ].join('\n').replace('BIGLIM', '5e4');
  // psi as a surface: height = ZS * tanh(psi / PL), so the cone near the fire keeps its true slope (|grad psi| = 1 near the front)
  // while far-away values (and the +infinity of cells no fire has reached yet) level off instead of towering over the plane psi = 0
  var SURF_VS = [
    '#version 300 es', 'precision highp float;', 'in vec2 aG; uniform sampler2D uState; uniform ivec2 uSize; uniform mat4 uMVP; uniform float uDx, uZS, uPL;',
    'out float vPsi; out vec3 vW;',
    'void main(){ ivec2 c=ivec2(aG); float psi=texelFetch(uState,clamp(c,ivec2(0),uSize-1),0).r; vPsi=psi;',
    ' vec3 w=vec3((aG.x-float(uSize.x-1)/2.)*uDx, uZS*tanh(psi/uPL), (aG.y-float(uSize.y-1)/2.)*uDx); vW=w; gl_Position=uMVP*vec4(w,1.); }'
  ].join('\n');
  var SURF_FS = [
    '#version 300 es', 'precision highp float;', 'in float vPsi; in vec3 vW; uniform float uDark, uPL; out vec4 o;',
    'void main(){ vec3 n=normalize(cross(dFdx(vW),dFdy(vW))); if(n.y<0.) n=-n; float l=.38+.62*max(dot(n,normalize(vec3(-.4,.8,-.3))),0.);',
    ' float u=tanh(vPsi/uPL);',
    ' vec3 cool=uDark>.5?mix(vec3(.24,.40,.68),vec3(.55,.68,.88),u):mix(vec3(.30,.50,.82),vec3(.70,.80,.94),u);',
    ' vec3 hot=mix(vec3(.98,.55,.16),vec3(.55,.10,.05),clamp(-u*1.6,0.,1.));',
    ' vec3 c=vPsi<=0.?hot:cool;',
    ' float g=fwidth(vPsi), rings=(abs(vPsi)<4e4)?1.-smoothstep(0.,g*1.2,abs(mod(vPsi+25.,50.)-25.)):0.; c*=1.-.28*rings;',
    ' c=c*l; float fr=1.-smoothstep(0.,g*1.8,abs(vPsi)); c=mix(c,vec3(1.,.93,.55),fr);',
    ' o=vec4(c,1.); }'
  ].join('\n');
  // the plane psi = 0, drawn translucent: it shows where the surface dips below zero (the burned region) and the front itself
  var PLANE_VS = '#version 300 es\nprecision highp float; in vec3 aP; uniform mat4 uMVP; uniform vec2 uHalf; uniform float uDx; out vec2 vC; void main(){ vC=(aP.xz+uHalf)/uDx; gl_Position=uMVP*vec4(aP,1.); }';
  var PLANE_FS = [
    '#version 300 es', 'precision highp float;', 'in vec2 vC; uniform sampler2D uState; uniform ivec2 uSize; uniform float uDark; out vec4 o;',
    'float at(ivec2 c){ return texelFetch(uState,clamp(c,ivec2(0),uSize-1),0).r; }',
    'void main(){ vec2 p=vC; ivec2 i=ivec2(floor(p)); vec2 f=fract(p);',
    ' float psi=mix(mix(at(i),at(i+ivec2(1,0)),f.x),mix(at(i+ivec2(0,1)),at(i+ivec2(1,1)),f.x),f.y);',
    ' vec2 gq=abs(fract(vC/25.+.5)-.5)/fwidth(vC/25.); float grid=1.-min(min(gq.x,gq.y),1.);',
    ' vec4 c=uDark>.5?vec4(.85,.85,.80,.10+.16*grid):vec4(.25,.25,.22,.08+.16*grid);',
    ' if(psi<=0.) c=vec4(1.,.45,.12,.30+.12*grid);',
    ' float fr=1.-smoothstep(0.,fwidth(psi)*1.6,abs(psi)); c=mix(c,vec4(1.,.92,.5,1.),fr*.95);',
    ' c.a*=1.-smoothstep(40.,200.,psi);',   // the plane is only needed where the surface comes near it or dips below it
    ' if(c.a<.01) discard; o=c; }'
  ].join('\n');

  // matrices
  function persp(fov, asp, n, f) { var t = 1 / Math.tan(fov / 2), nf = 1 / (n - f); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]; }
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function lookAt(e, c, u) { var z = norm([e[0] - c[0], e[1] - c[1], e[2] - c[2]]), x = norm(cross(u, z)), y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]; }
  function mul(a, b) { var o = new Array(16); for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) { var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }

  function Lab(host, grid, meta, bmp) {
    var mode = host.getAttribute('data-lab'), preset = host.getAttribute('data-preset') || (mode === 'perimeter' ? 'perimeter' : 'single');
    var W = grid.W, H = grid.H, DX = grid.dx;
    // decode grid
    var c2 = document.createElement('canvas'); c2.width = W; c2.height = H; var x2 = c2.getContext('2d'); x2.drawImage(bmp, 0, 0);
    var px = x2.getImageData(0, 0, W, H).data, hgt = new Float32Array(W * H), code = new Uint8Array(W * H), stat = new Float32Array(W * H * 4);
    for (var k = 0; k < W * H; k++) { hgt[k] = grid.zmin + (px[4 * k] * 256 + px[4 * k + 1]) / 65535 * (grid.zmax - grid.zmin); code[k] = px[4 * k + 2]; }
    for (var j = 0; j < H; j++) for (var i = 0; i < W; i++) {
      k = j * W + i;
      var e = hgt[j * W + Math.min(W - 1, i + 1)], w = hgt[j * W + Math.max(0, i - 1)], n = hgt[Math.max(0, j - 1) * W + i], s = hgt[Math.min(H - 1, j + 1) * W + i];
      stat[4 * k] = hgt[k]; stat[4 * k + 1] = (e - w) / (2 * DX); stat[4 * k + 2] = (n - s) / (2 * DX); stat[4 * k + 3] = code[k];
    }

    // DOM
    var canvas = h('canvas', { class: 'fl-canvas', 'aria-label': 'Fire lab: the level-set fire model on Forest Park. Click or tap to ignite.' });
    var overlay = h('canvas', { class: 'fl-overlay', 'aria-hidden': 'true' });
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'fl-svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('preserveAspectRatio', 'none');
    var badge = h('div', { class: 'lab-badge', translate: 'no' }), hint = h('div', { class: 'lab-hint', text: mode === 'perimeter' ? 'Drag the star or the white dots' : 'Click or tap to ignite' });
    var legend = h('div', { class: 'fl-legend', 'aria-hidden': 'true' });
    var stage = h('div', { class: 'lab-stage fl-stage' }, [canvas, overlay, svg, badge, hint, legend]);
    host.classList.add('fl'); host.appendChild(stage);
    var gl = canvas.getContext('webgl2', { antialias: true }); gl.getExtension('EXT_color_buffer_float');

    var P = { weather: 'east', wind: meta.scenarios.east.wind, dir: meta.scenarios.east.dir, upw: 3, adv: 1, visc: 0.4, back: 0.5,
      wrf: true, walls: true, view: 'fire', speed: 20, streams: true, playing: !reduceMotion };
    if (preset === 'multi') { P.speed = 25; }
    function sel(label, opts, val, on) { var s = h('select'); opts.forEach(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (String(o[0]) === String(val)) op.selected = true; s.appendChild(op); }); s.addEventListener('change', function () { on(s.value); }); return [h('label', {}, [document.createTextNode(label), s]), s]; }
    function rng(label, min, max, step, val, fmt, on) { var out = h('output', { text: fmt(val) }), r = h('input', { type: 'range', min: min, max: max, step: step, value: val }); r.addEventListener('input', function () { out.textContent = fmt(+r.value); on(+r.value); }); return [h('label', {}, [h('span', {}, [document.createTextNode(label + ' '), out]), r]), r, out]; }
    var cWx = sel('Weather (Section 04)', [['east', meta.scenarios.east.label], ['nw', meta.scenarios.nw.label]], 'east', function (v) {
      P.weather = v; P.wind = meta.scenarios[v].wind; P.dir = meta.scenarios[v].dir; cWind[1].value = P.wind; cWind[2].textContent = fmtW(P.wind); cDir[1].value = P.dir; cDir[2].textContent = P.dir + '°'; bound(); });
    function fmtW(v) { return v.toFixed(1) + ' m/s (' + (v * 2.237).toFixed(0) + ' mph)'; }
    var cWind = rng('Wind at 6.1 m', 0, 15, 0.1, P.wind, fmtW, function (v) { P.wind = v; bound(); });
    var cDir = rng('Wind from', 0, 359, 1, P.dir, function (v) { return v + '°'; }, function (v) { P.dir = v; });
    var cUpw = sel('fire_upwinding', [[3, '3 · ENO (SFIRE default)'], [4, '4 · Sethian'], [2, '2 · Godunov'], [1, '1 · standard'], [0, '0 · none (unstable)']], 3, function (v) { P.upw = +v; });
    var cAdv = sel('fire_advection', [[1, '1 · speed projected on the normal (default)'], [0, '0 · wind component along the normal']], 1, function (v) { P.adv = +v; });
    var cVisc = rng('fire_viscosity', 0, 1, 0.05, P.visc, function (v) { return v.toFixed(2); }, function (v) { P.visc = v; });
    var cView = sel('View', [['fire', 'Fire on the fuel map'], ['psi', 'Level-set function ψ'], ['tign', 'Arrival time T'], ['3d', 'ψ as a 3-D surface']], 'fire', function (v) { P.view = v; legendFor(); });
    var cSpeed = rng('Playback', 2, 120, 1, P.speed, function (v) { return v + '× real time'; }, function (v) { P.speed = v; });
    var cWrf = h('input', { type: 'checkbox' }); cWrf.checked = true; cWrf.addEventListener('change', function () { P.wrf = cWrf.checked; bound(); });
    var cWalls = h('input', { type: 'checkbox' }); cWalls.checked = true; cWalls.addEventListener('change', function () { P.walls = cWalls.checked; });
    var cStr = h('input', { type: 'checkbox' }); cStr.checked = true; cStr.addEventListener('change', function () { P.streams = cStr.checked; });
    host.appendChild(h('div', { class: 'lab-controls' }, [cWx[0], cWind[0], cDir[0], cView[0], cUpw[0], cAdv[0], cVisc[0], cSpeed[0],
      h('div', { class: 'ctl' }, [h('label', { class: 'check' }, [cWrf, document.createTextNode('Mid-flame wind (windrf)')]),
        h('label', { class: 'check' }, [cWalls, document.createTextNode('Fuel-free cells block the front (lab choice)')]),
        h('label', { class: 'check' }, [cStr, document.createTextNode('Wind streamlines')])])]));
    var bPlay = h('button', { type: 'button', class: 'primary', text: P.playing ? 'Pause' : 'Play' }), bStep = h('button', { type: 'button', text: 'Step' });
    var bReset = h('button', { type: 'button', text: 'Reset' }), bClear = h('button', { type: 'button', text: 'Clear ignitions' });
    host.appendChild(h('div', { class: 'lab-buttons' }, [bPlay, bStep, bReset, bClear]));
    var readout = h('div', { class: 'lab-readout', translate: 'no' }); host.appendChild(readout);
    var slice = h('canvas', { class: 'fl-slice', 'aria-label': 'Cross-section of the level-set function' });
    var sliceNote = h('p', { text: mode === 'perimeter' ? '' : 'Cross-section of ψ along the dashed line: the fire is where ψ ≤ 0, and the front is where the curve crosses zero.' });
    var chart = h('canvas', { class: 'fl-chart', 'aria-label': 'Heat released into the atmosphere over time' });
    var chartBox = h('div', { class: 'lab-slice' }, mode === 'perimeter' ? [chart, h('p', { text: 'Sensible heat flux into the atmosphere (MW) from the fuel-burnout model, replay vs igniting the whole perimeter at t_p (dashed line).' })] : [slice, sliceNote]);
    host.appendChild(chartBox);

    // GL
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    function prog(vs, fs) { var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); var u = {}, nU = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (var q = 0; q < nU; q++) { var inf = gl.getActiveUniform(p, q); u[inf.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, inf.name); } return { p: p, u: new Proxy(u, { get: function (o, key) { return key in o ? o[key] : null; } }) }; }
    function tex(w, hh, ifmt, fmt, type, data) { var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, hh, 0, fmt, type, data); [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(function (pn) { gl.texParameteri(gl.TEXTURE_2D, pn, gl.NEAREST); }); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
    function fbo(t) { var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; }
    var pr;
    try { pr = { p1: prog(VS, P1), p2: prog(VS, P2), draw: prog(VS, DRAW), surf: prog(SURF_VS, SURF_FS), plane: prog(PLANE_VS, PLANE_FS) }; }
    catch (err) { stage.innerHTML = ''; stage.appendChild(h('p', { class: 'sim3d-fallback', text: 'WebGL error: ' + err.message })); return; }
    var tStat = tex(W, H, gl.RGBA32F, gl.RGBA, gl.FLOAT, stat);
    var st = [0, 1, 2].map(function () { var t = tex(W, H, gl.RGBA32F, gl.RGBA, gl.FLOAT, null); return { t: t, f: fbo(t) }; });
    var tRep = tex(W, H, gl.R32F, gl.RED, gl.FLOAT, new Float32Array(W * H));
    var quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var MW = 151, MH = 101, gv = new Float32Array(MW * MH * 2);
    for (j = 0; j < MH; j++) for (i = 0; i < MW; i++) { gv[2 * (j * MW + i)] = i * (W - 1) / (MW - 1); gv[2 * (j * MW + i) + 1] = j * (H - 1) / (MH - 1); }
    var gidx = new Uint32Array((MW - 1) * (MH - 1) * 6), q = 0;
    for (j = 0; j < MH - 1; j++) for (i = 0; i < MW - 1; i++) { var a0 = j * MW + i; gidx[q++] = a0; gidx[q++] = a0 + MW; gidx[q++] = a0 + 1; gidx[q++] = a0 + 1; gidx[q++] = a0 + MW; gidx[q++] = a0 + MW + 1; }
    var gvb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, gvb); gl.bufferData(gl.ARRAY_BUFFER, gv, gl.STATIC_DRAW);
    var gib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, gidx, gl.STATIC_DRAW);
    var plb = gl.createBuffer(); var hw = (W - 1) * DX / 2, hh2 = (H - 1) * DX / 2, ZS = 260, camSpin = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, plb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-hw, 0, -hh2, hw, 0, -hh2, hw, 0, hh2, -hw, 0, -hh2, hw, 0, hh2, -hw, 0, hh2]), gl.STATIC_DRAW);

    // state
    var cur = 0, t = 0, tlo = -1, ign = [], replay = false, TP = 3600, Tcpu = null;
    var poly = null, ignPt = null;
    function windVec() { var a = (P.dir + 180) * Math.PI / 180; return [Math.sin(a), Math.cos(a)]; }
    var Smax = 0.05, tanMax = 0;
    for (k = 0; k < W * H; k++) tanMax = Math.max(tanMax, Math.hypot(stat[4 * k + 1], stat[4 * k + 2]));
    function bound() {
      var cf = meta.coef[P.weather], tm = Math.min(tanMax, 5); Smax = 0.05;
      for (var m = 0; m < 13; m++) { var U = P.wind * (P.wrf ? meta.windrf[m] : 1), u = Math.min(U, 30) * 196.85; Smax = Math.max(Smax, Math.min(6, cf[m][0] + cf[m][1] * Math.pow(Math.max(u, 1e-6), cf[m][2]) + cf[m][3] * tm * tm)); }
    }
    function defaults() {
      var c = grid.ign08;
      if (preset === 'multi') return [[c[0], c[1], 15, 0], [c[0] - 60, c[1] - 55, 15, 240], [c[0] - 25, c[1] + 30, 15, 480], [c[0] + 40, c[1] - 70, 15, 720], [c[0] - 95, c[1] - 10, 15, 960]];
      if (preset === 'perimeter') return [];
      return [[c[0], c[1], 20, 0]];
    }
    function buildReplay() {
      var T = new Float32Array(W * H);
      function pip(x, y) { var cc = false; for (var a = 0, b = poly.length - 1; a < poly.length; b = a++) { var A = poly[a], B = poly[b]; if ((A[1] > y) !== (B[1] > y) && x < (B[0] - A[0]) * (y - A[1]) / (B[1] - A[1]) + A[0]) cc = !cc; } return cc; }
      for (var jj = 0; jj < H; jj++) for (var ii = 0; ii < W; ii++) {
        var kk = jj * W + ii, dmin = Infinity;
        for (var e = 0; e < poly.length; e++) { var A = poly[e], B = poly[(e + 1) % poly.length], vx = B[0] - A[0], vy = B[1] - A[1], tt = Math.max(0, Math.min(1, ((ii - A[0]) * vx + (jj - A[1]) * vy) / (vx * vx + vy * vy || 1))); dmin = Math.min(dmin, Math.hypot(ii - A[0] - tt * vx, jj - A[1] - tt * vy)); }
        if (!pip(ii, jj)) { T[kk] = TP + dmin * DX / 0.3; continue; }
        var ux = ii - ignPt[0], uy = jj - ignPt[1], r = Math.hypot(ux, uy); if (r < 1e-6) { T[kk] = 0; continue; }
        ux /= r; uy /= r; var R = Infinity;
        for (e = 0; e < poly.length; e++) { A = poly[e]; B = poly[(e + 1) % poly.length]; var ex = B[0] - A[0], ey = B[1] - A[1], wx = A[0] - ignPt[0], wy = A[1] - ignPt[1], den = ux * ey - uy * ex; if (Math.abs(den) < 1e-12) continue; var t1 = (wx * ey - wy * ex) / den, s1 = (wx * uy - wy * ux) / den; if (s1 >= 0 && s1 <= 1 && t1 >= r - 1e-6 && t1 < R) R = t1; }
        T[kk] = isFinite(R) ? TP * Math.min(1, r / R) : TP;
      }
      Tcpu = T; gl.bindTexture(gl.TEXTURE_2D, tRep); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, W, H, 0, gl.RED, gl.FLOAT, T); curve = null;
    }
    function reset() {
      var init = new Float32Array(W * H * 4); for (var kk = 0; kk < W * H; kk++) { init[4 * kk] = BIG; init[4 * kk + 1] = NEVER; }
      st.forEach(function (s) { gl.bindTexture(gl.TEXTURE_2D, s.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, init); });
      t = 0; tlo = -1; cur = 0; ign = ign.length ? ign.filter(function (g) { return g.keep; }) : [];
      if (!ign.length) ign = defaults();
      replay = mode === 'perimeter';
      if (replay) buildReplay();
    }
    function common(u, tx) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tx); gl.uniform1i(u.uState, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tStat); gl.uniform1i(u.uStatic, 1);
      gl.uniform2i(u.uSize, W, H); gl.uniform1f(u.uDx, DX);
      var cf = meta.coef[P.weather], fl = []; for (var m = 0; m < 13; m++) fl.push(cf[m][0], cf[m][1], cf[m][2], cf[m][3]);
      gl.uniform4fv(u.uCoef, fl); gl.uniform1fv(u.uWrf, meta.windrf); gl.uniform1f(u.uUseWrf, P.wrf ? 1 : 0);
      var wv = windVec(); gl.uniform2f(u.uWind, wv[0], wv[1]); gl.uniform1f(u.uU, P.wind);
      gl.uniform1i(u.uUpw, P.upw); gl.uniform1i(u.uAdv, P.adv); gl.uniform1i(u.uWalls, P.walls ? 1 : 0); gl.uniform1f(u.uVisc, P.visc);
    }
    function pass(p, target, bind) { gl.useProgram(p.p); gl.bindFramebuffer(gl.FRAMEBUFFER, target); gl.bindBuffer(gl.ARRAY_BUFFER, quad); var l = gl.getAttribLocation(p.p, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); bind(p.u); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    function step(dt) {
      var A = st[cur], B = st[(cur + 1) % 3], C = st[(cur + 2) % 3];
      gl.viewport(0, 0, W, H); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      pass(pr.p1, B.f, function (u) { common(u, A.t); gl.uniform1f(u.uDt, dt); });
      pass(pr.p2, C.f, function (u) {
        common(u, A.t); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, B.t); gl.uniform1i(u.uStar, 2);
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, tRep); gl.uniform1i(u.uRep, 3);
        gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uT0, t); gl.uniform1f(u.uTlo, tlo); gl.uniform1f(u.uT1, t + dt); gl.uniform1f(u.uW, P.back);
        var due = ign.filter(function (g) { return g[3] > tlo && g[3] <= t + dt; }).slice(0, 24), fl = [];
        for (var m = 0; m < 24; m++) { var g = due[m] || [0, 0, 0, -1e9]; fl.push(g[0], g[1], g[2], g[3]); }
        gl.uniform4fv(u.uIgn, fl); gl.uniform1i(u.uNIgn, due.length); gl.uniform1f(u.uReplay, replay ? 1 : 0); gl.uniform1f(u.uTp, TP);
      });
      cur = (cur + 2) % 3; tlo = t; t += dt;
    }

    // read back the state (300 x 200, small) for the readouts, the slice and the badge
    var buf = new Float32Array(W * H * 4), lastRead = -1e9;
    function readBack(now, force) {
      if (!force && now - lastRead < 250) return; lastRead = now;
      gl.bindFramebuffer(gl.FRAMEBUFFER, st[cur].f); gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, buf);
      var burned = 0, band = 0, dev = 0, rmax = 0;
      for (var kk = 0; kk < W * H; kk++) {
        var p = buf[4 * kk]; if (p <= 0) burned++; if (buf[4 * kk + 2] > rmax) rmax = buf[4 * kk + 2];
        if (Math.abs(p) < 4 * DX) { var ii = kk % W, jj = (kk / W) | 0; if (ii > 0 && ii < W - 1 && jj > 0 && jj < H - 1) { var gx = (buf[4 * (kk + 1)] - buf[4 * (kk - 1)]) / (2 * DX), gy = (buf[4 * (kk - W)] - buf[4 * (kk + W)]) / (2 * DX); band++; dev += Math.abs(Math.hypot(gx, gy) - 1); } }
      }
      var hrs = Math.floor(t / 3600), mins = Math.floor(t % 3600 / 60);
      badge.textContent = (hrs ? hrs + ' h ' : '') + mins + ' min · ' + (burned * DX * DX / 1e4).toFixed(2) + ' ha' + (replay && t < TP ? ' · replaying the perimeter' : replay ? ' · model spreading' : '');
      readout.textContent = '';
      [['Fastest spread now', rmax.toFixed(2) + ' m/s'], ['Time step (CFL 0.4)', (0.4 * DX / Smax).toFixed(2) + ' s'],
       ['|∇ψ| − 1 near the front', band ? (dev / band).toFixed(2) : '–'], ['Grid', W + ' × ' + H + ' cells of ' + DX + ' m']].forEach(function (pp) {
        var sp = h('span'); sp.appendChild(document.createTextNode(pp[0] + ': ')); sp.appendChild(h('b', { text: pp[1] })); readout.appendChild(sp); });
      if (mode !== 'perimeter') drawSlice(); else drawChart();
    }
    function sliceRow() { var g = ign[0] || defaults()[0] || [0, H / 2]; return Math.max(0, Math.min(H - 1, Math.round(g[1]))); }
    function drawSlice() {
      var dpr = Math.min(2, window.devicePixelRatio || 1), Wc = slice.clientWidth, Hc = slice.clientHeight;
      slice.width = Wc * dpr; slice.height = Hc * dpr; var c = slice.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      var row = H - 1 - sliceRow(), dark = isDark(), lo = -200, hi = 400, Y = function (v) { return 8 + (hi - Math.max(lo, Math.min(hi, v))) / (hi - lo) * (Hc - 24); };
      c.strokeStyle = dark ? '#383835' : '#c3c2b7'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, Y(0)); c.lineTo(Wc, Y(0)); c.stroke();
      var cs = getComputedStyle(document.documentElement), s1 = cs.getPropertyValue('--series-1').trim() || '#2a78d6';
      c.fillStyle = dark ? 'rgba(230,103,103,.22)' : 'rgba(227,73,72,.16)'; c.beginPath(); c.moveTo(0, Y(0));
      for (var ii = 0; ii < W; ii++) c.lineTo(ii / (W - 1) * Wc, Y(Math.min(0, buf[4 * (row * W + ii)]))); c.lineTo(Wc, Y(0)); c.fill();
      c.strokeStyle = s1; c.lineWidth = 2; c.lineJoin = 'round'; c.beginPath();
      for (ii = 0; ii < W; ii++) { var v = buf[4 * (row * W + ii)]; if (v > 5e4) v = hi; var x = ii / (W - 1) * Wc; ii ? c.lineTo(x, Y(v)) : c.moveTo(x, Y(v)); } c.stroke();
      c.fillStyle = '#898781'; c.font = '11px system-ui, sans-serif'; c.fillText('ψ = 0', 4, Y(0) - 4); c.fillText('+400 m', 4, 18); c.fillText('0 km', 4, Hc - 4);
      c.textAlign = 'right'; c.fillText((W * DX / 1000).toFixed(1) + ' km', Wc - 4, Hc - 4);
    }
    var curve = null;
    function drawChart() {
      if (!Tcpu) return;
      if (!curve) {
        var ts = [], A = [], B = [], fg = meta.fgi, wt = meta.weight;
        for (var tt = 0; tt <= TP + 1800; tt += 30) {
          var qa = 0, qb = 0;
          for (var kk = 0; kk < W * H; kk += 2) { var f = code[kk] & 15; if (f < 1 || f > 13) continue; var Tk = Tcpu[kk]; if (Tk > TP) continue; var Tf = wt[f - 1] / 0.85, pk = fg[f - 1] * (1 - 0.08 / 1.08) * 17.433e6 / Tf * DX * DX * 2 / 1e6; if (tt >= Tk) qa += pk * Math.exp(-(tt - Tk) / Tf); if (tt >= TP) qb += pk * Math.exp(-(tt - TP) / Tf); }
          ts.push(tt); A.push(qa); B.push(qb);
        }
        curve = { t: ts, a: A, b: B };
      }
      var dpr = Math.min(2, window.devicePixelRatio || 1), Wc = chart.clientWidth, Hc = chart.clientHeight; chart.width = Wc * dpr; chart.height = Hc * dpr;
      var c = chart.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      var m = { l: 52, r: 10, t: 10, b: 24 }, ymax = Math.max.apply(null, curve.a.concat(curve.b)) || 1, mag = Math.pow(10, Math.floor(Math.log10(ymax / 4))); ymax = Math.ceil(ymax / 4 / mag) * mag * 4;
      var tmax = curve.t[curve.t.length - 1], X = function (v) { return m.l + v / tmax * (Wc - m.l - m.r); }, Y = function (v) { return Hc - m.b - v / ymax * (Hc - m.t - m.b); };
      var dark = isDark(), cs = getComputedStyle(document.documentElement);
      c.font = '11px system-ui, sans-serif'; c.fillStyle = '#898781'; c.strokeStyle = dark ? '#2c2c2a' : '#e1e0d9';
      for (var g = 0; g <= 4; g++) { var v = ymax * g / 4; c.beginPath(); c.moveTo(m.l, Y(v)); c.lineTo(Wc - m.r, Y(v)); c.stroke(); c.textAlign = 'right'; c.fillText(v.toLocaleString('en-US', { maximumFractionDigits: v < 10 ? 1 : 0 }), m.l - 6, Y(v) + 4); }
      c.textAlign = 'center'; for (var x = 0; x <= tmax; x += 900) c.fillText(x / 60 + ' min', X(x), Hc - 6);
      c.setLineDash([4, 4]); c.strokeStyle = dark ? '#c3c2b7' : '#52514e'; c.beginPath(); c.moveTo(X(TP), m.t); c.lineTo(X(TP), Hc - m.b); c.stroke(); c.setLineDash([]);
      [[curve.a, cs.getPropertyValue('--series-1').trim()], [curve.b, cs.getPropertyValue('--series-2').trim()]].forEach(function (sr) {
        c.strokeStyle = sr[1]; c.lineWidth = 2; c.beginPath(); sr[0].forEach(function (v2, n2) { var xx = X(curve.t[n2]), yy = Y(v2); n2 ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }); c.stroke(); });
      var ix = Math.min(curve.t.length - 1, Math.round(t / 30)); c.fillStyle = dark ? '#f0efec' : '#0b0b0b'; c.beginPath(); c.arc(X(Math.min(t, tmax)), Y(curve.a[ix]), 4, 0, 6.283); c.fill();
    }

    // perimeter editing (SVG handles)
    function drawSvg() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      if (mode !== 'perimeter' || P.view === '3d') return;
      var NS = 'http://www.w3.org/2000/svg', pl = document.createElementNS(NS, 'polygon');
      pl.setAttribute('points', poly.map(function (p) { return (p[0] + .5) + ',' + (p[1] + .5); }).join(' ')); pl.setAttribute('class', 'fl-perim'); svg.appendChild(pl);
      poly.forEach(function (p, n2) { var c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', p[0] + .5); c.setAttribute('cy', p[1] + .5); c.setAttribute('r', 3.2); c.setAttribute('class', 'fl-handle'); c.dataset.i = n2; svg.appendChild(c); });
      var s2 = document.createElementNS(NS, 'circle'); s2.setAttribute('cx', ignPt[0] + .5); s2.setAttribute('cy', ignPt[1] + .5); s2.setAttribute('r', 4.5); s2.setAttribute('class', 'fl-ign'); s2.dataset.i = 'ign'; svg.appendChild(s2);
    }
    if (mode === 'perimeter') {
      var c0 = grid.ign08; ignPt = [c0[0] - 30, c0[1] - 30];
      poly = []; for (var a = 0; a < 12; a++) { var ang = a / 12 * 2 * Math.PI, rr = (a % 3 ? 1 : 0.82) * 1; poly.push([ignPt[0] - 45 + Math.cos(ang) * 78 * rr, ignPt[1] + Math.sin(ang) * 46 * rr]); }
    }
    var drag = null;
    function cellAt(e) { var b = stage.getBoundingClientRect(); return [(e.clientX - b.left) / b.width * W - .5, (e.clientY - b.top) / b.height * H - .5]; }
    stage.addEventListener('pointerdown', function (e) {
      hint.hidden = true;
      if (P.view === '3d') { dragCam = [e.clientX, e.clientY]; camMoved = 0; stage.setPointerCapture(e.pointerId); return; }
      var c = cellAt(e);
      if (mode === 'perimeter') {
        var best = null, bd = 9; if (Math.hypot(c[0] - ignPt[0], c[1] - ignPt[1]) < bd) best = 'ign';
        poly.forEach(function (p, n2) { var d = Math.hypot(c[0] - p[0], c[1] - p[1]); if (d < bd) { bd = d; best = n2; } });
        if (best !== null) { drag = best; stage.setPointerCapture(e.pointerId); }
        return;
      }
      ign.push([c[0], c[1], 15, t + 0.5]); if (!P.playing) { P.playing = true; bPlay.textContent = 'Pause'; }
    });
    var dragCam = null, camMoved = 0, az = 0.7, el = 0.62, dist3 = 3900, azV = 0;
    stage.addEventListener('wheel', function (e) { if (P.view !== '3d') return; e.preventDefault(); dist3 = Math.max(1200, Math.min(9000, dist3 * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)))); }, { passive: false });
    stage.addEventListener('pointermove', function (e) {
      if (dragCam) { var ddx = e.clientX - dragCam[0], ddy = e.clientY - dragCam[1]; camMoved += Math.abs(ddx) + Math.abs(ddy); azV = -ddx * 0.008; az += azV; el = Math.max(0.12, Math.min(1.45, el + ddy * 0.006)); dragCam = [e.clientX, e.clientY]; return; }
      if (drag === null) return; var c = cellAt(e); c[0] = Math.max(0, Math.min(W - 1, c[0])); c[1] = Math.max(0, Math.min(H - 1, c[1]));
      if (drag === 'ign') ignPt = c; else poly[drag] = c; drawSvg();
    });
    stage.addEventListener('pointerup', function () { if (dragCam && camMoved > 5) camSpin = azV; dragCam = null; if (drag !== null) { drag = null; reset(); drawSvg(); } });

    // legend + wind streamlines
    function legendFor() {
      legend.innerHTML = '';
      var items = P.view === 'fire' ? [['#fff0a0', 'Front'], ['#ff7a1a', 'Flaming'], ['#3a2f2a', 'Burned'], ['#7fb07f', 'Timber litter'], ['#8e8ad6', 'Timber understory'], ['#ecc06a', 'Grass'], ['#b8b8b4', 'No fuel (city)']]
        : P.view === 'psi' ? [['#e34948', 'ψ < 0 (burning or burned)'], ['#2a78d6', 'ψ > 0'], ['#111', 'ψ = 0: the front · contours every 25 m']]
        : P.view === 'tign' ? [['#ffdb9e', 'Early'], ['#8c1f0a', 'Late'], ['#111', 'Isochrones']] : [['#f26b1f', 'ψ ≤ 0: burning or burned (below the plane)'], ['#5c8fdb', 'ψ > 0: not yet reached'], ['#ffe98a', 'ψ = 0: the front, where the surface cuts the plane'], ['#999', 'Drag to rotate · scroll to zoom']];
      items.forEach(function (it) { var s3 = h('span'); var sw = h('i'); sw.style.background = it[0]; s3.appendChild(sw); s3.appendChild(document.createTextNode(it[1])); legend.appendChild(s3); });
      drawSvg();
    }
    var parts = []; for (k = 0; k < 220; k++) parts.push({ x: Math.random(), y: Math.random(), a: Math.random() * 3 });
    function drawStreams(dt) {
      var dpr = Math.min(2, window.devicePixelRatio || 1), Wc = overlay.clientWidth, Hc = overlay.clientHeight;
      if (overlay.width !== Math.round(Wc * dpr)) { overlay.width = Math.round(Wc * dpr); overlay.height = Math.round(Hc * dpr); }
      var c = overlay.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, Wc, Hc);
      if (!P.streams || P.view === '3d' || P.wind <= 0) return;
      var wv = windVec(), sp = P.wind * 0.012, dark = isDark();
      c.lineCap = 'round';
      parts.forEach(function (p) {
        p.x += wv[0] * sp * dt; p.y -= wv[1] * sp * dt * W / H; p.a += dt;
        if (p.x < -0.05 || p.x > 1.05 || p.y < -0.05 || p.y > 1.05 || p.a > 3) { p.x = Math.random(); p.y = Math.random(); p.a = 0; }
        var L = 14 + P.wind * 2, x = p.x * Wc, y = p.y * Hc, al = Math.sin(Math.PI * Math.min(1, p.a / 3)) * 0.5;
        var g = c.createLinearGradient(x, y, x - wv[0] * L, y + wv[1] * L);
        g.addColorStop(0, dark ? 'rgba(230,240,255,' + al + ')' : 'rgba(20,40,70,' + al * 0.8 + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.strokeStyle = g; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, y); c.lineTo(x - wv[0] * L, y + wv[1] * L); c.stroke();
      });
      if (mode !== 'perimeter') {   // slice line
        var yl = (sliceRow() + 0.5) / H * Hc; c.setLineDash([6, 6]); c.strokeStyle = dark ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.4)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(0, yl); c.lineTo(Wc, yl); c.stroke(); c.setLineDash([]);
      }
    }

    // draw
    var t0real = performance.now();
    function draw(now) {
      var dpr = Math.min(2, window.devicePixelRatio || 1), Wc = canvas.clientWidth, Hc = canvas.clientHeight;
      if (canvas.width !== Math.round(Wc * dpr) || canvas.height !== Math.round(Hc * dpr)) { canvas.width = Math.round(Wc * dpr); canvas.height = Math.round(Hc * dpr); }
      var dark = isDark();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
      if (P.view === '3d') {
        gl.clearColor(dark ? .07 : .95, dark ? .07 : .95, dark ? .075 : .94, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
        var d = dist3, eye = [d * Math.cos(el) * Math.sin(az), d * Math.sin(el), d * Math.cos(el) * Math.cos(az)];
        var mvp = mul(persp(0.8, Wc / Math.max(1, Hc), 30, 30000), lookAt(eye, [0, -40, 0], [0, 1, 0]));
        var p = pr.surf; gl.useProgram(p.p); gl.bindBuffer(gl.ARRAY_BUFFER, gvb); var l = gl.getAttribLocation(p.p, 'aG'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gib); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st[cur].t); gl.uniform1i(p.u.uState, 0);
        gl.uniform2i(p.u.uSize, W, H); gl.uniformMatrix4fv(p.u.uMVP, false, mvp); gl.uniform1f(p.u.uDx, DX); gl.uniform1f(p.u.uDark, dark ? 1 : 0);
        gl.uniform1f(p.u.uZS, ZS); gl.uniform1f(p.u.uPL, mode === 'perimeter' ? 900 : 450);
        gl.drawElements(gl.TRIANGLES, gidx.length, gl.UNSIGNED_INT, 0);
        var q2 = pr.plane; gl.useProgram(q2.p); gl.bindBuffer(gl.ARRAY_BUFFER, plb); var l2 = gl.getAttribLocation(q2.p, 'aP'); gl.enableVertexAttribArray(l2); gl.vertexAttribPointer(l2, 3, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(q2.u.uMVP, false, mvp); gl.uniform2f(q2.u.uHalf, hw, hh2); gl.uniform1f(q2.u.uDx, DX); gl.uniform2i(q2.u.uSize, W, H); gl.uniform1f(q2.u.uDark, dark ? 1 : 0);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st[cur].t); gl.uniform1i(q2.u.uState, 0); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        gl.drawArrays(gl.TRIANGLES, 0, 6); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
        if (!dragCam) { if (Math.abs(camSpin) > 1e-4) { az += camSpin; camSpin *= 0.93; } else if (P.playing && !reduceMotion) az += 0.0015; }
      } else {
        pass(pr.draw, null, function (u) {
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st[cur].t); gl.uniform1i(u.uState, 0);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tStat); gl.uniform1i(u.uStatic, 1);
          gl.uniform2i(u.uSize, W, H); gl.uniform1f(u.uDx, DX); gl.uniform1f(u.uT, t); gl.uniform1f(u.uTime, (now - t0real) / 1000); gl.uniform1f(u.uDark, dark ? 1 : 0);
          gl.uniform1f(u.uIso, t > 5400 ? 900 : t > 1800 ? 600 : 300);
          gl.uniform1i(u.uView, P.view === 'psi' ? 1 : P.view === 'tign' ? 2 : 0);
          gl.uniform1fv(u.uTf, meta.weight.concat([7]).map(function (wt) { return wt / 0.85; }));
        });
      }
    }
    var visible = true, last = performance.now();
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(host);
    function frame(now) {
      var dtR = Math.min(0.1, (now - last) / 1000); last = now;
      if (visible) {
        if (P.playing) { var target = dtR * P.speed, done = 0, dmax = 0.4 * DX / Smax, n2 = 0; while (done < target - 1e-6 && n2 < 80) { var dd = Math.min(dmax, target - done); step(dd); done += dd; n2++; } }
        draw(now); drawStreams(dtR); readBack(now);
      }
      requestAnimationFrame(frame);
    }
    bPlay.addEventListener('click', function () { P.playing = !P.playing; bPlay.textContent = P.playing ? 'Pause' : 'Play'; });
    bStep.addEventListener('click', function () { step(0.4 * DX / Smax); readBack(0, true); });
    bReset.addEventListener('click', function () { ign = []; reset(); });
    bClear.addEventListener('click', function () { ign = []; reset(); ign = []; });
    new MutationObserver(function () { legendFor(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    bound(); reset(); legendFor();
    if (reduceMotion) { for (var s0 = 0; s0 < 2000 && t < 1200; s0++) step(0.4 * DX / Smax); }
    readBack(0, true); requestAnimationFrame(frame);
  }

  function init() {
    if (!window.FIRELAB_GPU) return;
    var hosts = document.querySelectorAll('[data-lab="levelset"], [data-lab="perimeter"]');
    if (!hosts.length) return;
    var root = hosts[0].getAttribute('data-root') || '../';
    Promise.all([get(root + 'data/lab-grid.json').then(function (r) { return r.json(); }), get(root + 'data/fp3d.json').then(function (r) { return r.json(); }),
      get(root + 'data/lab-grid.png').then(function (r) { return r.blob(); }).then(function (b) { return createImageBitmap(b, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }); })])
      .then(function (r) {
        hosts.forEach(function (el) { el.innerHTML = ''; try { Lab(el, r[0], r[1], r[2]); } catch (err) { el.appendChild(h('p', { class: 'sim3d-fallback', text: 'The lab could not start: ' + err.message })); } });
      }).catch(function (err) { hosts.forEach(function (el) { el.appendChild(h('p', { class: 'sim3d-fallback', text: 'Could not load the lab data: ' + err.message })); }); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
