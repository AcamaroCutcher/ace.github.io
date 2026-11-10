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
 * Rendering (v8): a natural land surface built from the fuel map, LANDFIRE canopy cover and NLCD pavement;
 * a tree for every forested cell at its LANDFIRE canopy height; sun, sky and terrain shadows that follow the
 * simulated clock; flames sized by Byram's flame length; buoyant smoke. An optional crown-fire add-on
 * (Van Wagner 1977 initiation, Rothermel 1991 spread) uses LANDFIRE canopy base height and bulk density.
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
    'uniform sampler2D uCan; uniform float uCrown, uFmc; uniform float uFgi[13]; float gCrown;',   // crown-fire add-on (not in SFIRE)
    'vec4 can(ivec2 p){vec4 v=texelFetch(uCan,clamp(p,ivec2(0),uSize-1),0)*255.; return vec4(v.r/4.,v.g/100.,v.b/10.,v.a/400.);}',   // height m, cover 0-1, base height m, bulk density kg/m3
    'ivec2 cl(ivec2 p){return clamp(p,ivec2(0),uSize-1);}',
    'int fuelOf(ivec2 p){int c=int(texelFetch(uStatic,cl(p),0).a+.5);return c>=32?c-32:c;}',
    'bool ok(int f){return f>=1&&f<=13;}',
    'float psiAt(sampler2D s,ivec2 p,float pc){return ok(fuelOf(p))?texelFetch(s,cl(p),0).r:pc;}',
    'float rhs(sampler2D s,ivec2 p,out float S){',
    '  int f=fuelOf(p); S=0.; gCrown=0.; if(!ok(f)) return 0.;',
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
    // Crown fire. Initiation (Van Wagner 1977): Byram intensity I = H w R >= I0 = (0.010 CBH (460 + 25.9 FMC))^1.5 kW/m.
    // Active spread (Rothermel 1991): Rc = 3.34 x the rate of fuel model 10 at 40% of the open wind, if Rc >= 3.0 / CBD m/min.
    '  if(uCrown>.5){ vec4 cn=can(p); if(cn.x>=3.&&cn.y>=.2&&cn.w>0.){',
    '    float I=18000.*uFgi[f-1]*S, I0=pow(.010*max(cn.z,.3)*(460.+25.9*uFmc),1.5);',
    '    if(I>=I0){ gCrown=1.; vec4 k10=uCoef[9]; float u10=min(uU*.4,30.)*196.85;',
    '      float Rc=3.34*(k10.x+k10.y*pow(max(u10,1e-6),k10.z)*cw+k10.w*tp*tp*cs);',
    '      if(Rc>=3./cn.w/60.){ gCrown=2.; S=min(6.,max(S,Rc)); } } } }',
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
    ' float S1,S2; float f1=rhs(uState,p,S1); float c1=gCrown; float f2=rhs(uStar,p,S2);',
    ' float psi=s.r, tg=s.g, ca=s.a; float pn=min(psi, psi-.5*uDt*(f1+f2));',
    ' if(psi>0.&&pn<=0.){ tg=min(tg,uT0+uDt*psi/max(psi-pn,1e-6)); ca=c1; }',   // alpha: 0 surface fire, 1 torching, 2 active crown fire
    ' bool fo=ok(fuelOf(p)); vec2 x=vec2(p);',
    ' for(int k=0;k<24;k++){ if(k>=uNIgn) break; vec4 g=uIgn[k];',
    '   if(g.w>uTlo&&g.w<=uT1){ float d=length(x-g.xy)*uDx-g.z; float v=fo?d:max(d,uDx); pn=min(pn,v); if(fo&&d<=0.) tg=min(tg,g.w);} }',
    ' if(uLineP.y>0.){ vec2 a=uLine.xy, b=uLine.zw; float L=length(b-a)*uDx;',
    '   float u1=clamp((uT1-uLineP.z)*uLineP.y/L,0.,1.), u0=clamp((uTlo-uLineP.z)*uLineP.y/L,0.,1.);',
    '   if(u1>u0||(uTlo<uLineP.z&&uT1>=uLineP.z)){ vec2 e=(b-a)*u1; float q=clamp(dot(x-a,e)/max(dot(e,e),1e-6),0.,1.);',
    '     float d=length(x-a-e*q)*uDx-uLineP.x; float v=fo?d:max(d,uDx); pn=min(pn,v); if(fo&&d<=0.) tg=min(tg,uLineP.z+q*u1*L/uLineP.y);} }',
    ' if(uReplay>.5&&uT1<=uTp){ float T=texelFetch(uRep,p,0).r; pn=T-uT1; tg=(T<=uT1&&fo)?T:1e9; if(!fo) pn=max(pn,uDx);}',
    ' o=vec4(pn,tg,S1,ca);}'
  ].join('\n');
  var REDUCE = [
    '#version 300 es', 'precision highp float;', 'uniform sampler2D uState; uniform sampler2D uStatic; uniform ivec2 uSize; uniform float uT; out vec4 o;',
    'void main(){ivec2 b=ivec2(gl_FragCoord.xy)*4; float burning=0., burned=0., outside=0., crown=0.;',
    ' for(int j=0;j<4;j++) for(int i=0;i<4;i++){ ivec2 p=min(b+ivec2(i,j),uSize-1); vec4 s=texelFetch(uState,p,0);',
    '  if(s.r<=0.){ burned+=1.; if(uT-s.g<900.) burning+=1.; if(s.a>1.5) crown+=1.; int c=int(texelFetch(uStatic,p,0).a+.5); if(c<32) outside+=1.; } }',
    ' o=vec4(burning,burned,outside,crown)/16.;}'
  ].join('\n');
  var NOISE = [
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}'
  ].join('\n');
  // sky: a gradient from zenith to horizon, the sun (or moon) and stars, from the view ray of each pixel
  var SKY_VS = '#version 300 es\nin vec2 p; out vec2 vP; void main(){vP=p; gl_Position=vec4(p,1.,1.);}';
  var SKY_FS = [
    '#version 300 es', 'precision highp float;', 'in vec2 vP; uniform mat4 uInv; uniform vec3 uEye, uSun, uSunCol, uZen, uHor; uniform float uNight; out vec4 o;', NOISE,
    'void main(){ vec4 a=uInv*vec4(vP,1.,1.); vec3 d=normalize(a.xyz/a.w-uEye);',
    ' vec3 c=mix(uZen,uHor,pow(1.-clamp(d.y,0.,1.),3.)); if(d.y<0.) c=mix(uHor,uHor*.32+uZen*.22,smoothstep(0.,-.22,d.y));',   // below the horizon: distant haze, not sky
    ' float sd=max(dot(d,uSun),0.); c+=uSunCol*(pow(sd,900.)*2.+pow(sd,14.)*.16)*step(0.,d.y+.02);',
    ' if(uNight>.5&&d.y>0.){ vec2 q=floor(d.xz/(d.y+.25)*260.); c+=vec3(step(.9978,hash(q)))*.75*clamp(d.y*5.,0.,1.); }',
    ' o=vec4(c,1.);}'
  ].join('\n');
  var TERRAIN_VS = [
    '#version 300 es', 'precision highp float;', 'in vec2 aCell; uniform sampler2D uStatic; uniform mat4 uMVP; uniform float uExag, uDx; uniform vec2 uOrigin;',
    'out vec2 vCell; out vec3 vN; out vec3 vW; out float vDepth;',
    'void main(){ ivec2 c=ivec2(aCell); vec4 st=texelFetch(uStatic,c,0);',
    ' vW=vec3(aCell.x*uDx-uOrigin.x, st.r*uExag, aCell.y*uDx-uOrigin.y);',
    ' vN=normalize(vec3(-st.g*uExag,1.,st.b*uExag)); vCell=aCell; gl_Position=uMVP*vec4(vW,1.); vDepth=gl_Position.w; }'
  ].join('\n');
  var TERRAIN_FS = [
    '#version 300 es', 'precision highp float;',
    'in vec2 vCell; in vec3 vN; in vec3 vW; in float vDepth;',
    'uniform sampler2D uState; uniform sampler2D uStatic; uniform sampler2D uAlbedo; uniform sampler2D uCan; uniform sampler2D uSurf;',
    'uniform ivec2 uSize; uniform float uT, uTime, uNight, uView, uExag, uDx; uniform float uTf[14];',
    'uniform vec3 uFog, uSun, uSunCol, uAmb, uEye; out vec4 o;', NOISE,
    'vec4 st(ivec2 p){return texelFetch(uState,clamp(p,ivec2(0),uSize-1),0);}',
    'float park(ivec2 p){return texelFetch(uStatic,clamp(p,ivec2(0),uSize-1),0).a>=31.5?1.:0.;}',
    'float hc(ivec2 p){return texelFetch(uStatic,clamp(p,ivec2(0),uSize-1),0).r;}',
    'float hAt(vec2 c){ ivec2 i=ivec2(floor(c)); vec2 f=c-vec2(i); return mix(mix(hc(i),hc(i+ivec2(1,0)),f.x),mix(hc(i+ivec2(0,1)),hc(i+ivec2(1,1)),f.x),f.y); }',
    // natural land surface: the fuel class, canopy cover and paved share of each cell, with noise so 30 m cells do not show
    'vec3 natural(vec2 g, out float wat){',
    ' vec2 gj=g+(vec2(noise(g*1.9),noise(g*1.9+7.3))-.5)*1.15;',
    ' ivec2 c=clamp(ivec2(floor(gj+.5)),ivec2(0),uSize-1);',
    ' vec4 sf=texelFetch(uSurf,c,0)*255.; int cls=int(sf.r+.5); float imp=sf.g/100.;',
    ' float cc=texture(uCan,(gj+.5)/vec2(uSize)).g*2.55;',
    ' int f=int(texelFetch(uStatic,c,0).a+.5); f=f>=32?f-32:f;',
    ' float n1=noise(g*.11), n2=noise(g*.9), n3=noise(g*5.3), n4=noise(g*23.);',
    ' vec3 dry=mix(vec3(.60,.52,.32),vec3(.50,.47,.27),n2), green=mix(vec3(.30,.40,.19),vec3(.38,.46,.22),n2);',
    ' vec3 litter=mix(vec3(.17,.20,.11),vec3(.24,.24,.14),n3), crown=mix(vec3(.07,.17,.08),vec3(.13,.26,.11),n2*.6+n4*.4);',
    ' vec3 col; wat=0.;',
    ' if(cls==1){ col=mix(vec3(.05,.13,.20),vec3(.08,.18,.25),n1); wat=1.; }',
    ' else if(cls==2||cls==5){ vec3 pav=mix(vec3(.40,.40,.41),vec3(.50,.49,.48),n3); vec3 yard=mix(mix(dry,green,.55),crown,clamp(cc*1.3,0.,1.));',
    '   col=mix(yard,pav,clamp(imp*1.15+.12,0.,1.)); if(cls==5) col=mix(col,vec3(.46,.45,.44),.5); }',
    ' else if(cls==3){ col=mix(vec3(.55,.50,.30),vec3(.36,.44,.22),step(.5,hash(floor(g/9.))))*(.9+.2*n2); }',
    ' else if(cls==4){ col=vec3(.50,.46,.40); }',
    ' else { vec3 open=(f==1||f==3)?dry:(f>=5&&f<=7)?mix(vec3(.33,.36,.20),dry,.3):mix(dry,green,.5);',
    '   col=mix(open,mix(litter,crown,.75),smoothstep(.15,.7,cc)); }',
    ' return col*(.86+.28*n4);}',
    'void main(){',
    ' vec2 g=vCell; ivec2 i0=ivec2(floor(g)); vec2 f=g-vec2(i0);',
    ' vec4 a=st(i0), b=st(i0+ivec2(1,0)), c=st(i0+ivec2(0,1)), d=st(i0+ivec2(1,1));',
    ' float psi=mix(mix(a.r,b.r,f.x),mix(c.r,d.r,f.x),f.y);',
    ' ivec2 nc=ivec2(floor(g+.5)); vec4 sn=st(nc); float tg=sn.g;',
    ' int code=int(texelFetch(uStatic,clamp(nc,ivec2(0),uSize-1),0).a+.5); int fu=code>=32?code-32:code;',
    ' float pk=mix(mix(park(i0),park(i0+ivec2(1,0)),f.x),mix(park(i0+ivec2(0,1)),park(i0+ivec2(1,1)),f.x),f.y);',
    ' float wat=0.; vec3 alb=uView>.5?texture(uAlbedo,(g+.5)/vec2(uSize)).rgb*(uNight>.5?2.2:1.):natural(g,wat);',
    ' vec3 N=normalize(vN+vec3(noise(g*3.)-.5,0.,noise(g*3.+5.)-.5)*.22);',
    // terrain shadow: march toward the sun over the height field
    ' float sh=1., hl=length(uSun.xz);',
    ' if(uSun.y>.02&&hl>1e-3){ vec2 hd=uSun.xz/hl; float tanE=uSun.y/hl, h0=hAt(g)*uExag;',
    '  for(int i=1;i<=12;i++){ float dd=float(i*i)*7.+10.; vec2 q=g+hd*dd/uDx;',
    '   if(q.x<0.||q.y<0.||q.x>float(uSize.x-1)||q.y>float(uSize.y-1)) break;',
    '   sh=min(sh,1.-clamp((hAt(q)*uExag-(h0+dd*tanE))/(dd*.06+4.),0.,1.)); } }',
    ' float dif=max(dot(N,uSun),0.)*sh;',
    ' vec3 col=alb*(uAmb*(.75+.25*N.y)+uSunCol*dif);',
    ' if(wat>.5){ vec3 V=normalize(uEye-vW); vec3 Nw=normalize(vec3((noise(g*4.+uTime*.3)-.5)*.14,1.,(noise(g*4.-uTime*.25+9.)-.5)*.14));',
    '  float fres=pow(1.-max(dot(V,Nw),0.),4.); col=mix(col,uFog,.22+.5*fres); col+=uSunCol*pow(max(dot(reflect(-V,Nw),uSun),0.),90.)*1.3*sh; }',
    ' float burned=smoothstep(6.,-6.,psi); float age=max(uT-tg,0.);',
    ' float tf=max(uTf[clamp(fu,1,14)-1],90.);',
    ' float flaming=burned*exp(-age/tf); float front=burned*exp(-age/150.);',
    ' vec3 charc=vec3(.10,.085,.075)*(uAmb+uSunCol*dif)*(.8+.4*noise(g*7.));',
    ' col=mix(col,charc,burned*clamp(age/120.,0.,1.)*.93);',
    ' float fl=.6+.4*noise(g*1.7+vec2(uTime*2.3,-uTime*1.7))+.25*noise(g*6.+uTime*7.);',
    ' float smolder=burned*exp(-age/(tf*4.+600.))*step(.72,noise(g*9.+floor(uTime*1.5)))*.5;',
    ' vec3 em=vec3(1.,.38,.06)*flaming*1.1*fl + vec3(1.,.82,.45)*front*1.8*fl + vec3(1.,.3,.05)*smolder;',
    ' float edge=1.-smoothstep(0.,fwidth(pk)*1.6+1e-4,abs(pk-.5));',
    ' col=mix(col,uNight>.5?vec3(.85,.85,.8):vec3(.98,.97,.92),edge*.5);',
    ' col+=em*(1.+.6*uNight);',
    ' float fog=clamp((vDepth-9000.)/45000.,0.,.75); col=mix(col,uFog,fog*(1.-min(1.,flaming+front)));',
    ' o=vec4(col,1.);}'
  ].join('\n');
  // smoke: soft sprites lit from above; young smoke glows, crown-fire smoke is darker
  var SMOKE_VS = [
    '#version 300 es', 'precision highp float;', 'in vec4 aP; in vec2 aS; uniform mat4 uMVP; uniform float uScale; out float vA, vHot, vTone, vSeed;',
    'void main(){ gl_Position=uMVP*vec4(aP.xyz,1.); float life=clamp(aP.w,0.,1.);',
    ' vA=smoothstep(0.,.07,life)*(1.-smoothstep(.5,1.,life)); vHot=1.-clamp(life*5.,0.,1.); vSeed=aS.x; vTone=aS.y;',
    ' if(aP.w>=1.){ gl_Position=vec4(2.,2.,2.,1.); gl_PointSize=1.; return; }',
    ' gl_PointSize=clamp(uScale*(60.+520.*pow(life,.7))/gl_Position.w,1.,320.); }'
  ].join('\n');
  var SMOKE_FS = [
    '#version 300 es', 'precision highp float;', 'in float vA, vHot, vTone, vSeed; uniform vec3 uLit, uShade, uGlow; out vec4 o;', NOISE,
    'void main(){ vec2 q=gl_PointCoord*2.-1.; float r=dot(q,q); if(r>1.) discard;',
    ' float n=noise(q*2.3+vSeed*31.); float a=pow(1.-r,1.5)*(.5+.5*n)*vA*.26;',
    ' vec3 c=mix(uShade,uLit,clamp(.55-q.y*.5,0.,1.)*.85+.15*n); c=mix(c,c*.42,vTone); c=mix(c,uGlow,vHot*.5);',
    ' o=vec4(c,a); }'
  ].join('\n');

  var GLOW_VS = [
    '#version 300 es', 'precision highp float;', 'in vec4 aP; uniform mat4 uMVP; uniform float uPx; out float vI;',
    'void main(){ gl_Position=uMVP*vec4(aP.xyz,1.); vI=aP.w; gl_PointSize=clamp(uPx*(380.+420.*aP.w)/gl_Position.w,6.,120.); }'
  ].join('\n');
  var GLOW_FS = [
    '#version 300 es', 'precision highp float;', 'in float vI; uniform float uTime, uGain; out vec4 o;',
    'void main(){ vec2 q=gl_PointCoord*2.-1.; float r=dot(q,q); if(r>1.) discard;',
    ' float a=exp(-r*3.)*(.35+.65*vI)*uGain; vec3 c=mix(vec3(1.,.35,.05),vec3(1.,.85,.45),exp(-r*8.)); o=vec4(c*a,a); }'
  ].join('\n');
  // flames: one camera-facing sheet per burning cell, as tall as Byram's flame length L = 0.0775 I^0.46 (I = H w R),
  // or the torching tree when the crown-fire add-on says the cell crowned
  var FLAME_VS = [
    '#version 300 es', 'precision highp float;', 'precision highp int;', 'in vec2 aQ;',
    'uniform sampler2D uState; uniform sampler2D uStatic; uniform sampler2D uCan; uniform ivec2 uSize; uniform ivec3 uBox; uniform int uStride;',
    'uniform mat4 uMVP; uniform vec3 uRight; uniform vec2 uOrigin; uniform float uT, uExag, uDx; uniform float uTf[14]; uniform float uFgi[13];',
    'out vec2 vUV; out float vI, vSeed;', NOISE,
    'void main(){ int id=gl_InstanceID; ivec2 c=ivec2(uBox.x+(id%uBox.z)*uStride, uBox.y+(id/uBox.z)*uStride);',
    ' vUV=vec2(0.); vI=0.; vSeed=0.; gl_Position=vec4(2.,2.,2.,1.);',
    ' if(c.x<0||c.y<0||c.x>=uSize.x||c.y>=uSize.y) return;',
    ' vec4 s=texelFetch(uState,c,0), stt=texelFetch(uStatic,c,0); int code=int(stt.a+.5); int f=code>=32?code-32:code;',
    ' if(s.r>0.||f<1||f>13) return; float age=uT-s.g, tf=max(uTf[f-1],60.); if(age<0.||age>tf*3.) return;',
    ' float fl=exp(-age/tf); float L=.0775*pow(18000.*uFgi[f-1]*max(s.b,.002),.46);',
    ' if(s.a>.5) L=max(L,texelFetch(uCan,c,0).r*255./4.*(s.a>1.5?2.:1.3));',
    ' float hgt=max(L,4.)*(.35+.65*fl), wid=uDx*float(uStride)*1.3; vSeed=hash(vec2(c));',
    ' vec2 jit=(vec2(hash(vec2(c)+3.),hash(vec2(c)+7.))-.5)*uDx*.6;',
    ' vec3 w=vec3(float(c.x)*uDx-uOrigin.x+jit.x, stt.r*uExag, float(c.y)*uDx-uOrigin.y+jit.y)+uRight*aQ.x*wid+vec3(0.,aQ.y*hgt,0.);',
    ' vUV=vec2(aQ.x+.5,aQ.y); vI=fl; gl_Position=uMVP*vec4(w,1.); }'
  ].join('\n');
  var FLAME_FS = [
    '#version 300 es', 'precision highp float;', 'in vec2 vUV; in float vI, vSeed; uniform float uTime; out vec4 o;', NOISE,
    'void main(){ vec2 uv=vUV; float t=uTime*1.6+vSeed*17.;',
    ' float n=noise(vec2(uv.x*3.+vSeed*9.,uv.y*2.6-t*1.9))*.6+noise(vec2(uv.x*7.-t*.7,uv.y*6.-t*3.1))*.4;',
    ' float x=abs(uv.x-.5)*2.; float body=1.-x*(1.15+uv.y*1.4)-uv.y*.55+(n-.5)*(.5+uv.y*.9);',
    ' float a=smoothstep(0.,.35,body)*smoothstep(0.,.06,uv.y+.02); if(a<.01) discard;',
    ' float heat=clamp(body*1.6,0.,1.)*(1.-uv.y*.5);',
    ' vec3 c=mix(vec3(.9,.16,.02),vec3(1.,.55,.08),smoothstep(.1,.55,heat)); c=mix(c,vec3(1.,.9,.55),smoothstep(.6,1.,heat));',
    ' a*=.35+.65*vI; o=vec4(c*a,a); }'
  ].join('\n');
  // trees: one lathed crown per instance (a cone for conifers, an ovoid for broadleaves), at the LANDFIRE canopy height of its cell.
  // A surface fire scorches the lower crown; a cell that crowned leaves a black snag.
  var TREE_VS = [
    '#version 300 es', 'precision highp float;', 'in vec2 aV; in vec4 aT0; in vec2 aT1;',
    'uniform sampler2D uState; uniform sampler2D uStatic; uniform ivec2 uSize; uniform mat4 uMVP; uniform vec3 uEye; uniform vec2 uOrigin;',
    'uniform float uT, uExag, uDx; out vec3 vN, vW; out float vV, vSeed, vType, vScorch, vGone, vFire;',
    'float hc(ivec2 p){return texelFetch(uStatic,clamp(p,ivec2(0),uSize-1),0).r;}',
    'void main(){ float x=aT0.x*.5, z=aT0.y*.5, hgt=aT0.z*.1, rad=aT0.w*.1, cb=aT1.x/65535.;',
    ' vType=floor(aT1.y/256.); vSeed=mod(aT1.y,256.)/255.;',
    ' vec2 cc=vec2(x,z)/uDx; ivec2 i=ivec2(floor(cc)); vec2 f=cc-vec2(i);',
    ' float ground=mix(mix(hc(i),hc(i+ivec2(1,0)),f.x),mix(hc(i+ivec2(0,1)),hc(i+ivec2(1,1)),f.x),f.y)*uExag;',
    ' vec3 basep=vec3(x-uOrigin.x,ground,z-uOrigin.y); float dist=length(uEye-basep);',
    ' float keep=dist<5000.?1.:dist<10000.?.5:.25; vV=aV.x; vN=vec3(0.,1.,0.); vW=basep; vScorch=0.; vGone=0.; vFire=0.;',
    ' if(vSeed>keep){ gl_Position=vec4(2.,2.,2.,1.); return; }',   // distance level of detail: fewer, wider crowns far away
    ' rad*=inversesqrt(keep);',
    ' vec4 s=texelFetch(uState,clamp(ivec2(floor(cc+.5)),ivec2(0),uSize-1),0);',
    ' if(s.r<=0.){ float age=max(uT-s.g,0.); vScorch=1.; vFire=exp(-age/(s.a>.5?240.:90.))*(s.a>.5?1.:.35); if(s.a>.5) vGone=smoothstep(30.,420.,age); }',
    ' float v=aV.x, prof=vType<.5?(v<.01?.55:(1.-v)*1.25):sin(3.14159*(.14+.86*v))*1.05;',
    ' prof*=mix(1.,.13,vGone); float base=hgt*cb*mix(1.,.2,vGone);',
    ' float ca=cos(aV.y), sa=sin(aV.y);',
    ' vW=basep+vec3(ca*rad*prof, base+(hgt-base)*v, sa*rad*prof); vN=normalize(vec3(ca,vType<.5?.5:(v-.4)*1.6,sa));',
    ' gl_Position=uMVP*vec4(vW,1.); }'
  ].join('\n');
  var TREE_FS = [
    '#version 300 es', 'precision highp float;', 'in vec3 vN, vW; in float vV, vSeed, vType, vScorch, vGone, vFire;',
    'uniform vec3 uSun, uSunCol, uAmb, uEye, uFog; uniform float uTime; out vec4 o;',
    'void main(){ vec3 base=vType<.5?mix(vec3(.06,.16,.08),vec3(.12,.25,.11),vSeed):mix(vec3(.17,.30,.10),vec3(.30,.36,.12),vSeed);',
    ' if(vType>.5&&fract(vSeed*7.3)>.95) base=vec3(.40,.36,.13);',   // a few early autumn crowns
    ' vec3 light=uAmb*(.55+.45*vV)+uSunCol*max(dot(normalize(vN),uSun),0.)*(.5+.5*vV);',
    ' vec3 c=base*light;',
    ' c=mix(c,vec3(.30,.20,.10)*light,vScorch*(1.-vGone)*clamp(1.2-vV*1.1,0.,1.));',
    ' c=mix(c,vec3(.05,.045,.04)*(.5+light),vGone);',
    ' c+=vec3(1.,.45,.08)*vFire*(.7+.3*sin(uTime*11.+vSeed*40.))*(1.-.5*vV);',
    ' c=mix(c,uFog,clamp((length(uEye-vW)-9000.)/45000.,0.,.75)); o=vec4(c,1.); }'
  ].join('\n');

  var BLD_VS = [
    '#version 300 es', 'precision highp float;', 'in vec4 aP; in vec3 aN; uniform mat4 uMVP; uniform float uExag; uniform vec2 uOrigin;',
    'uniform sampler2D uState; uniform ivec2 uSize; uniform float uT; out vec3 vN; out float vFire, vBurnt, vH;',
    'void main(){ float x=aP.x*.5, z=aP.y*.5; vec3 w=vec3(x-uOrigin.x, aP.z*.1*uExag+aP.w*.1, z-uOrigin.y);',
    ' ivec2 c=ivec2(floor(x/30.+.5), floor(z/30.+.5)); float f=0., b=0.;',
    ' for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec4 s=texelFetch(uState,clamp(c+ivec2(i,j),ivec2(0),uSize-1),0);',
    '   if(s.r<=0.){ float age=uT-s.g; f=max(f,exp(-max(age,0.)/900.)); b=1.; } }',
    ' vFire=f; vBurnt=b; vH=aP.w*.1; vN=aN; gl_Position=uMVP*vec4(w,1.); }'
  ].join('\n');
  var BLD_FS = [
    '#version 300 es', 'precision highp float;', 'in vec3 vN; in float vFire, vBurnt, vH; uniform float uDark, uTime; uniform vec3 uSun; out vec4 o;',
    'void main(){ float d=.45+.6*max(dot(normalize(vN),uSun),0.);',
    ' vec3 base=uDark>.5?vec3(.42,.42,.44):vec3(.86,.85,.82); vec3 c=base*d;',
    ' c=mix(c,c*.35,vBurnt*.6*(1.-vFire)); float low=exp(-vH/25.);',
    ' c+=vec3(1.,.42,.08)*vFire*(.6+.4*sin(uTime*9.+vH))*(.35+.9*low);',
    ' o=vec4(c,1.); }'
  ].join('\n');

  // every other building in the domain: one instanced box per footprint (oriented minimum rectangle with the footprint's area)
  var BOX_VS = [
    '#version 300 es', 'precision highp float;', 'in vec3 aC; in vec4 aI0; in vec4 aI1;',
    'uniform mat4 uMVP; uniform float uExag, uT; uniform vec2 uOrigin; uniform sampler2D uState; uniform ivec2 uSize;',
    'out vec3 vW, vL; out float vFire, vBurnt, vH; flat out int vId;',
    'void main(){ float x=aI0.x*.5, z=aI0.y*.5, g=aI0.z*.1, hh=aI0.w*.1, wd=max(aI1.x*.1,2.5), ln=max(aI1.y*.1,2.5), a=aI1.z/65535.*3.14159265;',
    ' vec2 ax=vec2(cos(a),sin(a)), ay=vec2(-sin(a),cos(a)); vec2 p=vec2(x,z)+ax*aC.x*ln+ay*aC.z*wd;',
    ' float y=mix(g*uExag-6.,g*uExag+hh,aC.y);',
    ' ivec2 c=ivec2(floor(x/30.+.5),floor(z/30.+.5)); float f=0.,b=0.;',
    ' for(int k=0;k<5;k++){ ivec2 o=k==0?ivec2(0):k==1?ivec2(1,0):k==2?ivec2(-1,0):k==3?ivec2(0,1):ivec2(0,-1);',
    '   vec4 s=texelFetch(uState,clamp(c+o,ivec2(0),uSize-1),0); if(s.r<=0.){ f=max(f,exp(-max(uT-s.g,0.)/900.)); b=1.; } }',
    ' vFire=f; vBurnt=b; vH=hh; vId=gl_InstanceID; vL=vec3(aC.x*ln,aC.y>.5?hh:-6.,aC.z*wd);',
    ' vW=vec3(p.x-uOrigin.x,y,p.y-uOrigin.y); gl_Position=uMVP*vec4(vW,1.); }'
  ].join('\n');
  var BOX_FS = [
    '#version 300 es', 'precision highp float;', 'in vec3 vW, vL; in float vFire, vBurnt, vH; flat in int vId;',
    'uniform float uDark, uTime; uniform vec3 uEye, uFog, uSun; out vec4 o;',
    'float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
    'void main(){ vec3 n=normalize(cross(dFdx(vW),dFdy(vW))); if(dot(n,uEye-vW)<0.) n=-n;',
    ' float d=.48+.55*max(dot(n,uSun),0.); bool roof=n.y>.6;',
    ' vec3 base=uDark>.5?(roof?vec3(.33,.34,.37):vec3(.45,.46,.49)):(roof?vec3(.76,.74,.71):vec3(.91,.90,.87));',
    ' base*=.92+.16*hash(vec2(float(vId),3.1)); vec3 c=base*d; float dist=length(uEye-vW);',
    ' if(!roof){ c*=.70+.30*smoothstep(0.,9.,vL.y);',
    '  if(vL.y>1.){ vec2 q=vec2((vL.x+vL.z)/3.6,(vL.y-1.)/3.4), cl=floor(q), fq=fract(q);',
    '   float win=step(.22,fq.x)*step(fq.x,.78)*step(.30,fq.y)*step(fq.y,.80)*(1.-smoothstep(1500.,4500.,dist));',
    '   if(uDark>.5){ float lit=step(.64,hash(cl+float(vId)*.37)); c=mix(c,mix(c*.55,vec3(1.,.80,.50),lit),win); } else c=mix(c,c*vec3(.70,.78,.86),win*.8); } }',
    ' c=mix(c,c*.35,vBurnt*.6*(1.-vFire)); c+=vec3(1.,.42,.08)*vFire*(.6+.4*sin(uTime*9.+float(vId)))*(.35+.9*exp(-vH/25.));',
    ' c=mix(c,uFog,clamp((dist-9000.)/45000.,0.,.75)); o=vec4(c,1.); }'
  ].join('\n');
  // St. Johns Bridge: y = ground * exaggeration + height above ground, so the bridge stays attached to the banks at any exaggeration
  var BR_VS = [
    '#version 300 es', 'precision highp float;', 'in vec4 aP; in vec3 aCol; uniform mat4 uMVP; uniform float uExag; out vec3 vW, vCol;',
    'void main(){ vW=vec3(aP.x,aP.y*uExag+aP.w,aP.z); vCol=aCol; gl_Position=uMVP*vec4(vW,1.); }'
  ].join('\n');
  var BR_FS = [
    '#version 300 es', 'precision highp float;', 'in vec3 vW, vCol; uniform vec3 uEye, uFog, uSun; uniform float uDark; out vec4 o;',
    'void main(){ vec3 n=normalize(cross(dFdx(vW),dFdy(vW))); if(dot(n,uEye-vW)<0.) n=-n;',
    ' float d=.42+.62*max(dot(n,uSun),0.); vec3 c=vCol*d*(uDark>.5?.8:1.);',
    ' c=mix(c,uFog,clamp((length(uEye-vW)-9000.)/45000.,0.,.75)); o=vec4(c,1.); }'
  ].join('\n');

  function Sim(host, meta, gridBmp, albD, albL, canBmp) {
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
    // ---------- canopy and surface classes (fp3d-canopy.png: two W x H tiles, see make_sim_data.py)
    var canPx = new Uint8Array(W * H * 4), surfPx = new Uint8Array(W * H * 4), hasCanopy = false;
    if (canBmp && canBmp.width === 2 * W) {
      var c3 = document.createElement('canvas'); c3.width = 2 * W; c3.height = H;
      var x3 = c3.getContext('2d'); x3.drawImage(canBmp, 0, 0);
      var lp = x3.getImageData(0, 0, W, H).data, rp = x3.getImageData(W, 0, W, H).data;
      for (k = 0; k < W * H; k++) {
        canPx[4 * k] = lp[4 * k]; canPx[4 * k + 1] = lp[4 * k + 1]; canPx[4 * k + 2] = lp[4 * k + 2]; canPx[4 * k + 3] = rp[4 * k];   // height x4, cover %, base dm, density x400
        surfPx[4 * k] = rp[4 * k + 1]; surfPx[4 * k + 1] = rp[4 * k + 2]; surfPx[4 * k + 3] = 255;                                 // class, paved %
      }
      hasCanopy = true;
    }
    function heightAt(cx, cy) {   // bilinear, cell coordinates
      var i0 = Math.max(0, Math.min(W - 2, Math.floor(cx))), j0 = Math.max(0, Math.min(H - 2, Math.floor(cy)));
      var fx = Math.min(1, Math.max(0, cx - i0)), fy = Math.min(1, Math.max(0, cy - j0));
      var a = hgt[j0 * W + i0], b = hgt[j0 * W + i0 + 1], c = hgt[(j0 + 1) * W + i0], d = hgt[(j0 + 1) * W + i0 + 1];
      return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    }

    // ---------- DOM
    var canvas = h('canvas', { class: 'sim3d-canvas', 'aria-label': '3-D view of Forest Park with a simulated fire. Drag to rotate, right-drag or two fingers to pan, scroll or pinch to zoom, double-click to zoom in, click to ignite. Arrow keys or WASD pan, Q and E rotate, R and F tilt, plus and minus zoom.', tabindex: '0' });
    var hud = h('div', { class: 'sim3d-hud', translate: 'no' }), help = h('div', { class: 'sim3d-help', text: 'Drag to orbit · right-drag, shift-drag or two fingers to pan · scroll or pinch to zoom toward the cursor · double-click to fly in · click to ignite · keys: WASD / arrows, Q E, R F, + −' });
    var compass = h('button', { type: 'button', class: 'sim3d-compass', title: 'Turn north up', 'aria-label': 'Turn the view north up' }, [h('span', { text: 'N' }), h('i')]);
    var nav = h('div', { class: 'sim3d-nav', translate: 'no', role: 'group', 'aria-label': 'Camera' });
    var labels = h('div', { class: 'sim3d-labels', 'aria-hidden': 'true' });
    var stage = h('div', { class: 'sim3d-stage' }, [canvas, labels, hud, compass, nav, help]);
    host.appendChild(stage);
    var gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: false });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
      stage.innerHTML = '';
      stage.appendChild(h('p', { class: 'sim3d-fallback', text: 'This 3-D simulation needs WebGL 2 with floating-point render targets, which this browser does not provide. The 2-D labs on this site work everywhere.' }));
      return;
    }

    var P = { preset: presetKey, weather: 'east', wind: meta.scenarios.east.wind, dir: meta.scenarios.east.dir,
      wrf: true, speed: 12, exag: 2.0, smoke: true, playing: !reduceMotion, spot: false, bld: true, orbit: false,
      view: hasCanopy ? 'natural' : 'fuel', light: 'clock', trees: hasCanopy, crown: false, treeFrac: window.innerWidth < 700 ? 0.45 : 1 };
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
    var cPreset = sel('Scenario', presetOpts, P.preset, function (v) { P.preset = v; reset(); focusOn(meta.presets[v]); cam0 = JSON.parse(JSON.stringify(goal)); });
    var cWx = sel('Weather', [['east', meta.scenarios.east.label], ['nw', meta.scenarios.nw.label]], 'east', function (v) {
      P.weather = v; P.wind = meta.scenarios[v].wind; P.dir = meta.scenarios[v].dir;
      cWind[1].value = P.wind; cWind[2].textContent = (P.wind * 2.237).toFixed(0) + ' mph'; cDir[1].value = P.dir; cDir[2].textContent = P.dir + '°';
      coefChanged();
    });
    var cWind = rng('Wind at 6.1 m', 0, 15, 0.1, P.wind, ' m/s', function (v) { P.wind = v; cWind[2].textContent = (v * 2.237).toFixed(0) + ' mph'; coefChanged(); });
    cWind[2].textContent = (P.wind * 2.237).toFixed(0) + ' mph';
    var cDir = rng('Wind from', 0, 359, 1, P.dir, '°', function (v) { P.dir = v; });
    var cSpeed = rng('Playback', 1, 120, 1, P.speed, ' min/s', function (v) { P.speed = v; });
    var cExag = rng('Vertical exaggeration', 1, 4, 0.1, P.exag, '×', function (v) { P.exag = v; });
    var cWrf = h('input', { type: 'checkbox' }); cWrf.checked = true; cWrf.addEventListener('change', function () { P.wrf = cWrf.checked; coefChanged(); });
    var SRC = [['lightning', 'Lightning storm: 8 strikes on ridge tops'], ['power', 'Power-line failure (real BPA/PGE lines, OpenStreetMap)'],
      ['road', 'Roadside / vehicle fires (US-30, Skyline, streets)'], ['trail', 'Campfire on a trail (Wildwood, Leif Erikson, firelanes)'],
      ['arson', 'Arson: 4 starts near trails at once']];
    var cSrc = sel('Add an ignition source', SRC, 'lightning', function () {});
    var bSrc = h('button', { type: 'button', text: 'Ignite source now' });
    var cSpot = h('input', { type: 'checkbox' }); cSpot.addEventListener('change', function () { P.spot = cSpot.checked; });
    var cBld = h('input', { type: 'checkbox' }); cBld.checked = true; cBld.addEventListener('change', function () { P.bld = cBld.checked; });
    var cSmoke = h('input', { type: 'checkbox' }); cSmoke.checked = true; cSmoke.addEventListener('change', function () { P.smoke = cSmoke.checked; });
    var cView = sel('Surface', [['natural', 'Natural (land cover and canopy)'], ['fuel', 'Fuel map colors']], P.view, function (v) { P.view = v; });
    var cLight = sel('Light', [['clock', 'Follow the clock (fire starts 2 pm)'], ['day', 'Midday'], ['dusk', 'Sunset'], ['night', 'Night']], P.light, function (v) { P.light = v; });
    var cTrees = h('input', { type: 'checkbox' }); cTrees.checked = P.trees; cTrees.addEventListener('change', function () { P.trees = cTrees.checked; });
    var cCrown = h('input', { type: 'checkbox' }); cCrown.addEventListener('change', function () { P.crown = cCrown.checked; coefChanged(); });
    var controls = h('div', { class: 'lab-controls' }, [lockPreset ? h('span') : cPreset[0], cWx[0], cWind[0], cDir[0], cSpeed[0], cExag[0],
      hasCanopy ? cView[0] : h('span'), cLight[0],
      h('div', { class: 'ctl' }, [h('label', { class: 'check' }, [cWrf, document.createTextNode('Mid-flame wind (fuel windrf, fire_use_windrf = 1)')]),
                                  h('label', { class: 'check' }, [cSmoke, document.createTextNode('Smoke')]),
                                  h('label', { class: 'check' }, [cSpot, document.createTextNode('Ember spotting (simple add-on, not in SFIRE ifire = 1)')]),
                                  h('label', { class: 'check' }, [cBld, document.createTextNode('3-D buildings (all of Portland in the domain) and St. Johns Bridge')])].concat(hasCanopy ? [
                                  h('label', { class: 'check' }, [cTrees, document.createTextNode('Trees at LANDFIRE canopy height')]),
                                  h('label', { class: 'check' }, [cCrown, document.createTextNode('Crown fire (Van Wagner 1977 / Rothermel 1991 add-on, not in SFIRE ifire = 1)')])] : [])), cSrc[0]]);
    host.appendChild(controls);
    var bPlay = h('button', { type: 'button', class: 'primary', text: P.playing ? 'Pause' : 'Play' });
    var bReset = h('button', { type: 'button', text: 'Reset' }), bView = h('button', { type: 'button', text: 'Reset view' });
    var bLapse = h('button', { type: 'button', text: '24-hour time-lapse' });
    var FLY = [['', 'Fly to…'], ['fire', 'The fire'], ['park', 'All of Forest Park'], ['top', 'Top view (north up)'], ['downtown', 'Downtown Portland'],
      ['nw', 'NW Portland & the Pearl'], ['linnton', 'Linnton'], ['bridge', 'St. Johns Bridge'], ['stjohns', 'St. Johns']];
    var cFly = h('select', { class: 'fly', 'aria-label': 'Fly the camera to' });
    FLY.forEach(function (o) { cFly.appendChild(h('option', { value: o[0], text: o[1] })); });
    host.appendChild(h('div', { class: 'lab-buttons' }, [bPlay, bReset, bSrc, bLapse, bView, cFly]));
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
        ter: program(TERRAIN_VS, TERRAIN_FS), smoke: program(SMOKE_VS, SMOKE_FS), glow: program(GLOW_VS, GLOW_FS), bld: program(BLD_VS, BLD_FS),
        box: program(BOX_VS, BOX_FS), br: program(BR_VS, BR_FS), sky: program(SKY_VS, SKY_FS), flame: program(FLAME_VS, FLAME_FS), tree: program(TREE_VS, TREE_FS) };
    } catch (err) {
      stage.innerHTML = ''; stage.appendChild(h('p', { class: 'sim3d-fallback', text: 'WebGL error: ' + err.message })); return;
    }
    var tStatic = tex(W, H, gl.RGBA32F, gl.RGBA, gl.FLOAT, stat);
    var states = [0, 1, 2].map(function () { var t = tex(W, H, gl.RGBA32F, gl.RGBA, gl.FLOAT, null); return { t: t, f: fbo(t) }; });
    var tRep = tex(W, H, gl.R32F, gl.RED, gl.FLOAT, new Float32Array(W * H));
    var tCan = tex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canPx, gl.LINEAR), tSurf = tex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, surfPx);
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
    var NSMOKE = 4500, smoke = new Float32Array(NSMOKE * 4), smokeV = new Float32Array(NSMOKE * 4), smokeS = new Float32Array(NSMOKE * 2), sp = 0, smokeDebt = 0;
    for (k = 0; k < NSMOKE; k++) smoke[4 * k + 3] = 2;   // dead
    var sbo = gl.createBuffer(), sbo2 = gl.createBuffer(), gbo = gl.createBuffer(), glowData = new Float32Array(0);
    var fqo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, fqo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-.5, 0, .5, 0, .5, 1, -.5, 0, .5, 1, -.5, 1]), gl.STATIC_DRAW);

    // ---------- trees: one or two per forested cell (LANDFIRE height >= 5 m, cover >= 20 %), in random order so that
    // drawing only the first part of the list thins the forest evenly on slow machines
    var trees = null;
    (function buildTrees() {
      if (!hasCanopy) return;
      var seed = 12345; function rr() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
      var list = [];
      for (var jj = 0; jj < H; jj++) for (var ii = 0; ii < W; ii++) {
        var kk = jj * W + ii, th = canPx[4 * kk] / 4, cov = canPx[4 * kk + 1] / 100, cls = surfPx[4 * kk];
        if (th < 5 || cov < 0.2 || cls === 1) continue;
        if (cov < 0.35 && rr() > 0.6) continue;
        var n = cov >= 0.6 ? 2 : 1, fu = code[kk] & 31, cbf = Math.min(0.75, Math.max(0.12, (canPx[4 * kk + 2] / 10) / th));
        for (var q2 = 0; q2 < n; q2++) {
          var broad = rr() < (fu === 9 ? 0.8 : (cls === 2 || cls === 5) ? 0.55 : 0.15) ? 1 : 0;
          var hh = th * (0.72 + 0.4 * rr()) * (broad ? 0.85 : 1), rad = (n === 2 ? 7.2 : 6.2) * (0.75 + 0.5 * rr()) * (broad ? 1.3 : 1);
          list.push((ii + rr() - 0.5) * DX * 2, (jj + rr() - 0.5) * DX * 2, hh * 10, rad * 10, (broad ? Math.max(cbf, 0.3) : cbf) * 65535, broad * 256 + Math.floor(rr() * 256));
        }
      }
      var nT = list.length / 6, order = new Uint32Array(nT);
      for (var a1 = 0; a1 < nT; a1++) order[a1] = a1;
      for (a1 = nT - 1; a1 > 0; a1--) { var b1 = Math.floor(rr() * (a1 + 1)), tmp = order[a1]; order[a1] = order[b1]; order[b1] = tmp; }
      var inst = new Uint16Array(nT * 6);
      for (a1 = 0; a1 < nT; a1++) for (var c1 = 0; c1 < 6; c1++) inst[a1 * 6 + c1] = Math.max(0, Math.min(65535, Math.round(list[order[a1] * 6 + c1])));
      var RINGS = [0, 0.28, 0.62, 1], SEG = 5, lv = [], li = [];
      RINGS.forEach(function (v) { for (var sg = 0; sg < SEG; sg++) lv.push(v, sg / SEG * 2 * Math.PI); });
      for (var r1 = 0; r1 + 1 < RINGS.length; r1++) for (var s1 = 0; s1 < SEG; s1++) {
        var A = r1 * SEG + s1, B = r1 * SEG + (s1 + 1) % SEG, C = A + SEG, D = B + SEG; li.push(A, C, B, B, C, D);
      }
      var pr = progs.tree, vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lv), gl.STATIC_DRAW);
      var lV = gl.getAttribLocation(pr.p, 'aV'); gl.enableVertexAttribArray(lV); gl.vertexAttribPointer(lV, 2, gl.FLOAT, false, 0, 0);
      var eb = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(li), gl.STATIC_DRAW);
      var ib3 = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib3); gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
      var l0 = gl.getAttribLocation(pr.p, 'aT0'), l1 = gl.getAttribLocation(pr.p, 'aT1');
      gl.enableVertexAttribArray(l0); gl.vertexAttribPointer(l0, 4, gl.UNSIGNED_SHORT, false, 12, 0); gl.vertexAttribDivisor(l0, 1);
      gl.enableVertexAttribArray(l1); gl.vertexAttribPointer(l1, 2, gl.UNSIGNED_SHORT, false, 12, 8); gl.vertexAttribDivisor(l1, 1);
      gl.bindVertexArray(null);
      trees = { vao: vao, n: nT, idx: li.length }; host.dataset.trees = nT;
    })();

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
      if (P.crown) {   // upper bound of Rothermel's crown-fire rate, for the time step limit
        var k10 = cf[9], u10 = Math.min(P.wind * 0.4, 30) * 196.85;
        Smax = Math.max(Smax, Math.min(6, 3.34 * (k10[0] + k10[1] * Math.pow(Math.max(u10, 1e-6), k10[2]) + k10[3] * tm * tm)));
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
      t = 0; tlo = -1; cur = 0; ign = []; line = null; replay = false; spots = 0; fx = [];
      var pr = meta.presets[P.preset];
      (pr.ign && pr.ign.length && typeof pr.ign[0] === 'object' && pr.ign[0].length === 4 ? pr.ign : []).forEach(function (g) { ign.push(g.slice()); });
      if (pr.line) line = { a: pr.line[0], b: pr.line[1], ros: pr.ros, t: pr.t || 0, r: 30 };
      if (pr.perim) { buildReplay(pr); replay = true; tp = pr.tp; }
      for (var m = 0; m < NSMOKE; m++) smoke[4 * m + 3] = 2;
      smokeDebt = 0;
      burnedHa = 0; outsideHa = 0; crownHa = 0; hotBox = null;
    }
    var burnedHa = 0, outsideHa = 0, crownHa = 0, hotBox = null;

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
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, tCan); gl.uniform1i(u.uCan, 4);
      gl.uniform1f(u.uCrown, P.crown && hasCanopy ? 1 : 0); gl.uniform1f(u.uFmc, 100); gl.uniform1fv(u.uFgi, meta.fgi);
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
        var due = ign.filter(function (g) { return g[3] > tlo && g[3] <= t + dt; }).slice(0, 24);
        var flat = []; for (var m = 0; m < 24; m++) { var g = due[m] || [0, 0, 0, -1e9]; flat.push(g[0], g[1], g[2], g[3]); }
        gl.uniform4fv(u.uIgn, flat); gl.uniform1i(u.uNIgn, due.length);
        if (line) { gl.uniform4f(u.uLine, line.a[0], line.a[1], line.b[0], line.b[1]); gl.uniform3f(u.uLineP, line.r, line.ros, line.t); }
        else { gl.uniform4f(u.uLine, 0, 0, 0, 0); gl.uniform3f(u.uLineP, 0, 0, 0); }
        gl.uniform1f(u.uReplay, replay ? 1 : 0); gl.uniform1f(u.uTp, tp);
      });
      cur = (cur + 2) % 3; tlo = t; t += dt;
    }
    var lastRead = 0, hot = [], hotCrown = [];
    function readBack(now, force) {
      if (!force && now - lastRead < 350) return; lastRead = now;
      gl.viewport(0, 0, RW, RH);
      runPass(progs.red, fRed, function (u) {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, states[cur].t); gl.uniform1i(u.uState, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tStatic); gl.uniform1i(u.uStatic, 1);
        gl.uniform2i(u.uSize, W, H); gl.uniform1f(u.uT, t);
      });
      gl.readPixels(0, 0, RW, RH, gl.RGBA, gl.UNSIGNED_BYTE, redBuf);
      var b = 0, o = 0, cr = 0, x0 = RW, x1 = -1, y0 = RH, y1 = -1; hot = []; hotCrown = [];
      for (var kk = 0; kk < RW * RH; kk++) {
        b += redBuf[4 * kk + 1]; o += redBuf[4 * kk + 2]; cr += redBuf[4 * kk + 3];
        if (redBuf[4 * kk] > 0) {
          hot.push(kk, redBuf[4 * kk]); hotCrown.push(redBuf[4 * kk + 3] > 0 ? 1 : 0);
          var bx = kk % RW, by = (kk / RW) | 0; if (bx < x0) x0 = bx; if (bx > x1) x1 = bx; if (by < y0) y0 = by; if (by > y1) y1 = by;
        }
      }
      burnedHa = b / 255 * 16 * DX * DX / 1e4; outsideHa = o / 255 * 16 * DX * DX / 1e4; crownHa = cr / 255 * 16 * DX * DX / 1e4;
      hotBox = x1 >= 0 ? [x0 * 4 - 2, y0 * 4 - 2, (x1 - x0 + 1) * 4 + 4, (y1 - y0 + 1) * 4 + 4] : null;   // cells: i0, j0, width, height
      glowData = new Float32Array(hot.length * 2);
      for (var m = 0; m < hot.length / 2; m++) {
        var cell = hot[2 * m], wp = worldOfCell((cell % RW) * 4 + 2, ((cell / RW) | 0) * 4 + 2);
        glowData[4 * m] = wp[0]; glowData[4 * m + 1] = wp[1] + 15; glowData[4 * m + 2] = wp[2]; glowData[4 * m + 3] = hot[2 * m + 1] / 255;
      }
    }

    // ---------- camera: the inputs move a goal; the camera eases toward it (smooth zoom, fly-to and inertia)
    var cam = { az: -0.78, el: 0.62, dist: 15500, tx: meta.park_center[0] * DX - origin[0], tz: meta.park_center[1] * DX - origin[1], ty: 0 };
    var goal = JSON.parse(JSON.stringify(cam)), ease = 9, vel = { az: 0, el: 0, tx: 0, tz: 0 }, dragging = false, keys = {}, hold = null;
    function clampGoal() {
      goal.el = Math.max(0.06, Math.min(1.55, goal.el)); goal.dist = Math.max(300, Math.min(45000, goal.dist));
      goal.tx = Math.max(-origin[0], Math.min((W - 1) * DX - origin[0], goal.tx)); goal.tz = Math.max(-origin[1], Math.min((H - 1) * DX - origin[1], goal.tz));
    }
    function setGoal(o, rate) {
      if (o.az !== undefined) { var d = o.az - cam.az; d = Math.atan2(Math.sin(d), Math.cos(d)); o = Object.assign({}, o, { az: cam.az + d }); }
      ['az', 'el', 'dist', 'tx', 'tz'].forEach(function (k) { if (o[k] !== undefined) goal[k] = o[k]; });
      vel = { az: 0, el: 0, tx: 0, tz: 0 }; ease = rate || 9; clampGoal();
    }
    function cellGoal(c, dist, el, az) { var o = { tx: c[0] * DX - origin[0], tz: c[1] * DX - origin[1], dist: dist }; if (el !== undefined) o.el = el; if (az !== undefined) o.az = az; return o; }
    function focusOn(pr, now) {
      var pts = [];
      if (pr.ign && pr.ign.length && typeof pr.ign[0] === 'object') pr.ign.forEach(function (g) { pts.push(g); });
      else if (pr.ign && pr.ign.length === 2) pts.push(pr.ign);
      if (pr.line) pts.push(pr.line[0], pr.line[1]);
      if (!pts.length) return;
      var cx = 0, cy = 0; pts.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= pts.length; cy /= pts.length;
      var spread = 0; pts.forEach(function (p) { spread = Math.max(spread, Math.hypot(p[0] - cx, p[1] - cy)); });
      setGoal(cellGoal([cx, cy], Math.max(3600, Math.min(16000, 3600 + spread * DX * 2.2)), spread < 20 ? 0.85 : 0.72), 2.5);
      if (now) { Object.assign(cam, goal); }
    }
    focusOn(meta.presets[P.preset], true);
    cam.ty = heightAt((cam.tx + origin[0]) / DX, (cam.tz + origin[1]) / DX) * P.exag;
    var cam0 = JSON.parse(JSON.stringify(goal));
    var view, proj, mvp, eye;
    function camera() {
      var asp = canvas.clientWidth / Math.max(1, canvas.clientHeight);
      eye = [cam.tx + cam.dist * Math.cos(cam.el) * Math.sin(cam.az), cam.ty + cam.dist * Math.sin(cam.el), cam.tz + cam.dist * Math.cos(cam.el) * Math.cos(cam.az)];
      var ge = heightAt((eye[0] + origin[0]) / DX, (eye[2] + origin[1]) / DX) * P.exag + 30;   // never below the terrain
      if (eye[1] < ge) eye[1] = ge;
      var near = Math.max(1.5, Math.min(20, cam.dist * 0.004));
      view = lookAt(eye, [cam.tx, cam.ty, cam.tz], [0, 1, 0]); proj = persp(0.75, asp, near, 90000); mvp = mul(proj, view);
    }
    function updateCam(dt) {
      if (P.orbit) goal.az += dt * 0.05;
      var kx = 0, kz = 0, ka = 0, ke = 0, kd = 0;
      if (keys.arrowleft || keys.a) kx -= 1; if (keys.arrowright || keys.d) kx += 1;
      if (keys.arrowup || keys.w) kz += 1; if (keys.arrowdown || keys.s) kz -= 1;
      if (keys.q) ka -= 1; if (keys.e) ka += 1; if (keys.r) ke += 1; if (keys.f) ke -= 1;
      if (keys['+'] || keys['=']) kd -= 1; if (keys['-'] || keys._) kd += 1;
      if (hold) { ka += hold.a || 0; ke += hold.e || 0; kd += hold.d || 0; }
      if (kx || kz) { var sp = goal.dist * 0.5 * dt, a = cam.az; goal.tx += (Math.cos(a) * kx - Math.sin(a) * kz) * sp; goal.tz += (-Math.sin(a) * kx - Math.cos(a) * kz) * sp; ease = 12; }
      if (ka) { goal.az += ka * 1.1 * dt; ease = 12; } if (ke) { goal.el += ke * 0.7 * dt; ease = 12; } if (kd) { goal.dist *= Math.exp(kd * 1.4 * dt); ease = 12; }
      if (!dragging) {
        goal.az += vel.az * dt; goal.el += vel.el * dt; goal.tx += vel.tx * dt; goal.tz += vel.tz * dt;
        var dmp = Math.exp(-dt * 4.5); vel.az *= dmp; vel.el *= dmp; vel.tx *= dmp; vel.tz *= dmp;
      }
      clampGoal();
      var k = 1 - Math.exp(-dt * ease);
      cam.az += (goal.az - cam.az) * k; cam.el += (goal.el - cam.el) * k; cam.tx += (goal.tx - cam.tx) * k; cam.tz += (goal.tz - cam.tz) * k;
      cam.dist *= Math.pow(goal.dist / cam.dist, k);
      var tyG = heightAt((cam.tx + origin[0]) / DX, (cam.tz + origin[1]) / DX) * P.exag; cam.ty += (tyG - cam.ty) * (1 - Math.exp(-dt * 4));
      if (ease < 9 && Math.abs(goal.dist / cam.dist - 1) < 0.01 && Math.hypot(goal.tx - cam.tx, goal.tz - cam.tz) < 5) ease = 9;
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

    // ---------- light. The clock starts at meta.start_hour (2 pm) and the sun follows a mid-September day in Portland
    // (sunrise about 6:50, sunset about 19:20, 46 degrees high at solar noon). x = east, y = up, z = south.
    function mix3(a, b, u) { return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }
    function lightState() {
      var hr = P.light === 'clock' ? ((meta.start_hour || 14) + t / 3600) % 24 : { day: 13.1, dusk: 19.0, night: 23.5 }[P.light];
      var rise = 6.85, set = 19.35, x = (hr - rise) / (set - rise), el = -0.3, az = Math.PI;
      if (x > -0.06 && x < 1.06) { el = Math.sin(Math.PI * x) * 46 * Math.PI / 180; az = (90 + 180 * x) * Math.PI / 180; }
      var day = Math.max(0, Math.min(1, (Math.sin(el) + 0.07) / 0.2)), high = Math.max(0, Math.min(1, Math.sin(Math.max(el, 0)) / 0.38));
      high = high * high * (3 - 2 * high);
      var e2 = Math.max(el, 0.03), sun = day > 0.02 ? [Math.sin(az) * Math.cos(e2), Math.sin(e2), -Math.cos(az) * Math.cos(e2)] : norm([-0.45, 0.62, -0.4]);
      var L = {
        hr: hr, day: day, night: day < 0.35, sun: sun,
        sunCol: day > 0.02 ? mix3([0, 0, 0], mix3([1.05, 0.50, 0.24], [1.0, 0.96, 0.88], high), day) : [0.15, 0.19, 0.28],
        amb: mix3([0.11, 0.14, 0.21], mix3([0.40, 0.34, 0.37], [0.48, 0.54, 0.62], high), day),
        zen: mix3([0.012, 0.018, 0.04], mix3([0.15, 0.20, 0.40], [0.24, 0.46, 0.80], high), day),
        hor: mix3([0.05, 0.065, 0.10], mix3([0.93, 0.55, 0.30], [0.72, 0.80, 0.88], high), day)
      };
      if (day <= 0.02) L.sunCol = [0.15, 0.19, 0.28];
      return L;
    }
    var LS = null;

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
      LS = lightState();
      var dark = LS.night, bg = LS.hor, time = (now - start) / 1000;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      // sky
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(false);
      var ps = progs.sky; gl.useProgram(ps.p); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      var lq = gl.getAttribLocation(ps.p, 'p'); gl.enableVertexAttribArray(lq); gl.vertexAttribPointer(lq, 2, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(ps.u.uInv, false, inv(mvp)); gl.uniform3f(ps.u.uEye, eye[0], eye[1], eye[2]);
      gl.uniform3fv(ps.u.uSun, LS.sun); gl.uniform3fv(ps.u.uSunCol, LS.sunCol); gl.uniform3fv(ps.u.uZen, LS.zen); gl.uniform3fv(ps.u.uHor, LS.hor);
      gl.uniform1f(ps.u.uNight, LS.night ? 1 : 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
      var pr = progs.ter; gl.useProgram(pr.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo); var loc = gl.getAttribLocation(pr.p, 'aCell');
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, states[cur].t); gl.uniform1i(pr.u.uState, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tStatic); gl.uniform1i(pr.u.uStatic, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, dark ? tAlbD : tAlbL); gl.uniform1i(pr.u.uAlbedo, 2);
      gl.uniformMatrix4fv(pr.u.uMVP, false, mvp); gl.uniform1f(pr.u.uExag, P.exag); gl.uniform1f(pr.u.uDx, DX);
      gl.uniform2f(pr.u.uOrigin, origin[0], origin[1]); gl.uniform2i(pr.u.uSize, W, H);
      gl.uniform1f(pr.u.uT, t); gl.uniform1f(pr.u.uTime, time); gl.uniform1f(pr.u.uNight, dark ? 1 : 0);
      gl.uniform1fv(pr.u.uTf, TF);
      gl.uniform3f(pr.u.uFog, bg[0], bg[1], bg[2]);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, tCan); gl.uniform1i(pr.u.uCan, 3);
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, tSurf); gl.uniform1i(pr.u.uSurf, 4);
      gl.uniform1f(pr.u.uView, P.view === 'fuel' || !hasCanopy ? 1 : 0);
      gl.uniform3fv(pr.u.uSun, LS.sun); gl.uniform3fv(pr.u.uSunCol, LS.sunCol); gl.uniform3fv(pr.u.uAmb, LS.amb); gl.uniform3f(pr.u.uEye, eye[0], eye[1], eye[2]);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_INT, 0);
      drawBuildings(now, dark);
      if (P.trees && trees) drawTrees(time);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      drawGlow(now);
      drawFlames(time);
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
      var ck = ((meta.start_hour || 14) + t / 3600) % 24, ch2 = Math.floor(ck), cm = Math.floor((ck - ch2) * 60);
      hud.textContent = (P.light === 'clock' ? ch2 + ':' + (cm < 10 ? '0' : '') + cm + ' · ' : '') + hrs + ' h ' + (mins < 10 ? '0' : '') + mins + ' min · ' +
        burnedHa.toFixed(1) + ' ha burned · ' + outsideHa.toFixed(1) + ' ha outside the park' +
        (P.crown ? ' · ' + crownHa.toFixed(1) + ' ha active crown fire' : '') + (replay && t < tp ? ' · replaying the perimeter' : '');
    }
    var TF = meta.weight.concat([7]).map(function (wt) { return wt / 0.85; });
    function drawTrees(time) {
      var pr = progs.tree; gl.useProgram(pr.p); gl.bindVertexArray(trees.vao);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, states[cur].t); gl.uniform1i(pr.u.uState, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tStatic); gl.uniform1i(pr.u.uStatic, 1);
      gl.uniformMatrix4fv(pr.u.uMVP, false, mvp); gl.uniform2i(pr.u.uSize, W, H); gl.uniform2f(pr.u.uOrigin, origin[0], origin[1]);
      gl.uniform1f(pr.u.uT, t); gl.uniform1f(pr.u.uExag, P.exag); gl.uniform1f(pr.u.uDx, DX); gl.uniform1f(pr.u.uTime, time);
      gl.uniform3f(pr.u.uEye, eye[0], eye[1], eye[2]); gl.uniform3fv(pr.u.uSun, LS.sun); gl.uniform3fv(pr.u.uSunCol, LS.sunCol);
      gl.uniform3fv(pr.u.uAmb, LS.amb); gl.uniform3fv(pr.u.uFog, LS.hor);
      gl.disable(gl.CULL_FACE);
      gl.drawElementsInstanced(gl.TRIANGLES, trees.idx, gl.UNSIGNED_SHORT, 0, Math.max(1, Math.floor(trees.n * P.treeFrac)));
      gl.bindVertexArray(null);
    }
    function drawFlames(time) {
      if (!hotBox) return;
      var bw = hotBox[2], bh = hotBox[3], stride = Math.max(1, Math.ceil(Math.sqrt(bw * bh / 60000)));
      var nx = Math.ceil(bw / stride), ny = Math.ceil(bh / stride);
      var pr = progs.flame; gl.useProgram(pr.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, fqo); var loc = gl.getAttribLocation(pr.p, 'aQ');
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(loc, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, states[cur].t); gl.uniform1i(pr.u.uState, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tStatic); gl.uniform1i(pr.u.uStatic, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tCan); gl.uniform1i(pr.u.uCan, 2);
      gl.uniform2i(pr.u.uSize, W, H); gl.uniform3i(pr.u.uBox, hotBox[0], hotBox[1], nx); gl.uniform1i(pr.u.uStride, stride);
      gl.uniformMatrix4fv(pr.u.uMVP, false, mvp); gl.uniform2f(pr.u.uOrigin, origin[0], origin[1]);
      gl.uniform3f(pr.u.uRight, Math.cos(cam.az), 0, -Math.sin(cam.az));
      gl.uniform1f(pr.u.uT, t); gl.uniform1f(pr.u.uExag, P.exag); gl.uniform1f(pr.u.uDx, DX); gl.uniform1f(pr.u.uTime, time);
      gl.uniform1fv(pr.u.uTf, TF); gl.uniform1fv(pr.u.uFgi, meta.fgi);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, nx * ny);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    function drawGlow(now) {
      if (!glowData.length) return;
      var pr = progs.glow; gl.useProgram(pr.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, gbo); gl.bufferData(gl.ARRAY_BUFFER, glowData, gl.DYNAMIC_DRAW);
      var loc = gl.getAttribLocation(pr.p, 'aP'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(pr.u.uMVP, false, mvp); gl.uniform1f(pr.u.uPx, canvas.height * 0.9);
      gl.uniform1f(pr.u.uGain, 0.45 + 0.55 * (1 - LS.day));   // the glow reads strongest at night
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
      gl.drawArrays(gl.POINTS, 0, glowData.length / 4);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    function drawSmoke(dark) {
      var pr = progs.smoke; gl.useProgram(pr.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, sbo); gl.bufferData(gl.ARRAY_BUFFER, smoke, gl.DYNAMIC_DRAW);
      var loc = gl.getAttribLocation(pr.p, 'aP'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, sbo2); gl.bufferData(gl.ARRAY_BUFFER, smokeS, gl.DYNAMIC_DRAW);
      var loc2 = gl.getAttribLocation(pr.p, 'aS'); gl.enableVertexAttribArray(loc2); gl.vertexAttribPointer(loc2, 2, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(pr.u.uMVP, false, mvp); gl.uniform1f(pr.u.uScale, canvas.height * 1.4);
      var d = LS.day, lit = mix3([0.17, 0.18, 0.21], [0.80 * (0.6 + 0.4 * LS.sunCol[0]), 0.76 * (0.6 + 0.4 * LS.sunCol[1]), 0.72 * (0.6 + 0.4 * LS.sunCol[2])], d);
      gl.uniform3fv(pr.u.uLit, lit); gl.uniform3fv(pr.u.uShade, mix3([0.05, 0.05, 0.06], [0.33, 0.32, 0.33], d)); gl.uniform3f(pr.u.uGlow, 1.0, 0.5, 0.18);
      // keep the canvas opaque: blend colour only, or the page behind shows through the smoke as black
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); gl.depthMask(false);
      gl.drawArrays(gl.POINTS, 0, NSMOKE);
      gl.depthMask(true); gl.disable(gl.BLEND); gl.disableVertexAttribArray(loc2);
    }
    // buoyant plume: puffs leave the fire fast and slow down as they cool, the wind takes over with height, and each puff wanders
    function updateSmoke(dtReal) {
      var wv = windVec(), drift = Math.min(P.wind, 15) * 18, tnow = performance.now() / 1000;
      for (var m = 0; m < NSMOKE; m++) {
        if (smoke[4 * m + 3] >= 1) continue;
        var life = smoke[4 * m + 3], sd = smokeS[2 * m], lift = 0.35 + 1.15 * Math.min(1, life * 2.2);
        smoke[4 * m] += (wv[0] * drift * lift + smokeV[4 * m] + Math.sin(tnow * 0.9 + sd * 40) * 22) * dtReal;
        smoke[4 * m + 2] += (-wv[1] * drift * lift + smokeV[4 * m + 2] + Math.cos(tnow * 0.8 + sd * 53) * 22) * dtReal;
        smoke[4 * m + 1] += smokeV[4 * m + 1] * dtReal;
        smokeV[4 * m + 1] *= Math.exp(-dtReal * 0.22);
        smoke[4 * m + 3] += dtReal / smokeV[4 * m + 3];
      }
      if (!hot.length || !P.playing) return;
      smokeDebt += Math.min(420, 24 + hot.length * 3) * dtReal;
      while (smokeDebt >= 1) {
        smokeDebt -= 1;
        var pick2 = (Math.random() * (hot.length / 2)) | 0, cell = hot[2 * pick2], crown = hotCrown[pick2] || 0;
        var cx = (cell % RW) * 4 + Math.random() * 4, cy = ((cell / RW) | 0) * 4 + Math.random() * 4, wp = worldOfCell(cx, cy);
        smoke[4 * sp] = wp[0]; smoke[4 * sp + 1] = wp[1] + 12; smoke[4 * sp + 2] = wp[2]; smoke[4 * sp + 3] = 0;
        smokeV[4 * sp] = (Math.random() - 0.5) * 50; smokeV[4 * sp + 1] = (110 + Math.random() * 150) * (crown ? 1.5 : 1); smokeV[4 * sp + 2] = (Math.random() - 0.5) * 50;
        smokeV[4 * sp + 3] = 8 + Math.random() * 6;
        smokeS[2 * sp] = Math.random(); smokeS[2 * sp + 1] = crown ? 0.75 : 0.12 + 0.2 * Math.random();
        sp = (sp + 1) % NSMOKE;
      }
    }
    // keep the frame rate: if frames stay slow, draw fewer trees
    var slow = 0;
    function adapt(dtReal) {
      if (!trees || !P.trees) return;
      slow = dtReal > 0.034 ? slow + dtReal : Math.max(0, slow - dtReal * 0.5);
      if (slow > 2.5 && P.treeFrac > 0.3) { P.treeFrac = Math.max(0.3, P.treeFrac * 0.7); slow = 0; }
    }
    function frame(now) {
      var dtReal = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
      if (visible) {
        if (P.playing) {
          var target = P.speed * 60 * dtReal, done = 0, dtMax = Math.min(10, 0.45 * DX / Smax), n = 0;
          while (done < target - 1e-6 && n < 60) { var d = Math.min(dtMax, target - done); step(d); done += d; n++; }
          if (t > 24 * 3600) { P.playing = false; P.orbit = false; bPlay.textContent = 'Play'; }
          if (P.spot) spotting(dtReal * P.speed * 60);
        }
        updateCam(dtReal); readBack(now); updateSmoke(dtReal); adapt(dtReal); draw(now); overlay(now);
      }
      requestAnimationFrame(frame);
    }

    // ---------- ignition sources (candidate cells precomputed from real data, see fp3d.json "sources")
    var src = meta.sources || {}, fx = [];
    function rnd(a) { return a[(Math.random() * a.length) | 0]; }
    function addSource(kind) {
      var t0 = t + 1, out = [];
      if (kind === 'lightning' && src.ridge) {
        for (var k = 0; k < 8; k++) { var p = rnd(src.ridge), tt = t0 + Math.random() * 1800; out.push([p[0], p[1], 20, tt]); fx.push({ kind: 'bolt', c: p, t: tt, life: 0 }); }
      } else if (kind === 'power' && src.power && src.power.length) {
        var ln = rnd(src.power), q = (Math.random() * ln.pts.length) | 0;
        for (var k2 = 0; k2 < 3; k2++) { var p2 = ln.pts[Math.min(ln.pts.length - 1, q + k2 * 2)]; out.push([p2[0], p2[1], 25, t0 + k2 * 120]); }
        fx.push({ kind: 'line', pts: ln.pts, t: t0, life: 0 });
      } else if (kind === 'road' && src.roadside) {
        var r0 = rnd(src.roadside); out.push([r0[0], r0[1], 25, t0]);
        src.roadside.filter(function (p) { return Math.hypot(p[0] - r0[0], p[1] - r0[1]) < 40; }).slice(0, 2)
          .forEach(function (p, n) { out.push([p[0], p[1], 25, t0 + 300 * (n + 1)]); });
      } else if (kind === 'trail' && src.trails) {
        var tp0 = rnd(src.trails); out.push([tp0[0], tp0[1], 15, t0]);
      } else if (kind === 'arson' && src.trails) {
        var a0 = rnd(src.trails); out.push([a0[0], a0[1], 20, t0]);
        src.trails.filter(function (p) { return Math.hypot(p[0] - a0[0], p[1] - a0[1]) < 35; }).sort(function () { return Math.random() - 0.5; })
          .slice(0, 3).forEach(function (p) { out.push([p[0], p[1], 20, t0]); });
      }
      out.forEach(function (g) { ign.push(g); });
      if (!P.playing) { P.playing = true; bPlay.textContent = 'Pause'; }
    }
    bSrc.addEventListener('click', function () { addSource(cSrc[1].value); });
    // simple ember spotting: burning 120 m blocks throw brands downwind, lognormal distance
    var spots = 0;
    function spotting(simDt) {
      if (!hot.length || spots > 300) return;
      var wv = windVec(), U = Math.max(P.wind, 0.5), med = 60 * Math.pow(U / 4, 1.3);
      for (var m = 0; m < hot.length / 2; m++) {
        var frac = hot[2 * m + 1] / 255, rate = 0.00025 * frac * Math.pow(U / 4, 1.5);   // brands per second per block
        if (Math.random() > rate * simDt) continue;
        var cell = hot[2 * m], cx = (cell % RW) * 4 + 2, cy = ((cell / RW) | 0) * 4 + 2;
        var dist = med * Math.exp(0.6 * (Math.random() + Math.random() + Math.random() - 1.5) * 1.4);
        var ang = Math.atan2(wv[0], wv[1]) + (Math.random() - 0.5) * 0.42;
        var lx = cx + Math.sin(ang) * dist / DX, ly = cy - Math.cos(ang) * dist / DX;
        var li = Math.round(lx), lj = Math.round(ly);
        if (li < 0 || lj < 0 || li >= W || lj >= H) continue;
        var f = code[lj * W + li] & 15; if (f < 1 || f > 13) continue;
        ign.push([lx, ly, 15, t + dist / Math.max(U, 1)]); spots++;
        fx.push({ kind: 'ember', a: [cx, cy], b: [lx, ly], t: t, life: 0 });
      }
    }
    var ov = h('canvas', { class: 'sim3d-overlay', 'aria-hidden': 'true' }); stage.insertBefore(ov, labels);
    var octx = ov.getContext('2d');
    function overlay(now) {
      var w = canvas.clientWidth, hh = canvas.clientHeight;
      if (ov.width !== w || ov.height !== hh) { ov.width = w; ov.height = hh; }
      octx.clearRect(0, 0, w, hh);
      fx = fx.filter(function (e) { return e.life < 2.5; });
      fx.forEach(function (e) {
        if (e.kind === 'bolt') {
          if (t < e.t) return; e.life += 1 / 60; var g = project(worldOfCell(e.c[0], e.c[1])); if (!g) return;
          var a = Math.max(0, 1 - e.life / 0.6); if (a <= 0) return;
          octx.strokeStyle = 'rgba(230,240,255,' + a + ')'; octx.lineWidth = 2.5; octx.beginPath();
          var x = g[0], y = g[1] - 260; octx.moveTo(x, y);
          for (var k = 1; k <= 8; k++) octx.lineTo(g[0] + (Math.random() - 0.5) * 30 * (1 - k / 8), y + 260 * k / 8);
          octx.stroke();
        } else if (e.kind === 'ember') {
          e.life += 1 / 60; var p0 = project(worldOfCell(e.a[0], e.a[1])), p1 = project(worldOfCell(e.b[0], e.b[1])); if (!p0 || !p1) return;
          var u = Math.min(1, e.life / 1.2), x2 = p0[0] + (p1[0] - p0[0]) * u, y2 = p0[1] + (p1[1] - p0[1]) * u - Math.sin(Math.PI * u) * 60;
          octx.fillStyle = 'rgba(255,170,60,' + (1 - e.life / 2.5) + ')'; octx.beginPath(); octx.arc(x2, y2, 2.2, 0, 6.283); octx.fill();
        } else if (e.kind === 'line') {
          e.life += 1 / 240; octx.strokeStyle = 'rgba(255,220,120,' + Math.max(0, 0.9 - e.life / 2.5) + ')'; octx.lineWidth = 1.5; octx.beginPath();
          e.pts.forEach(function (p, n) { var q = project(worldOfCell(p[0], p[1])); if (q) { q[1] -= 25; n ? octx.lineTo(q[0], q[1]) : octx.moveTo(q[0], q[1]); } });
          octx.stroke();
        }
      });
    }
    // buildings: the detailed downtown mesh (7,811 footprints) and every other building in the domain as instanced boxes;
    // both are City of Portland Building Footprints with lidar heights; loaded after the simulator starts
    var bld = null, boxes = null, bridge = null;
    function gunzip(url) { return get(url).then(function (r) { return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); }); }
    (function loadBuildings() {
      if (!window.DecompressionStream) return;
      var a = Promise.all([get(root + 'data/buildings-downtown.json').then(function (r) { return r.json(); }), gunzip(root + 'data/buildings-downtown.bin.gz')])
        .then(function (r) {
          var m = r[0], buf = r[1], vb = gl.createBuffer(), ib = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(buf, 0, m.index_offset), gl.STATIC_DRAW);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(buf, m.index_offset, m.indices), gl.STATIC_DRAW);
          bld = { vb: vb, ib: ib, n: m.indices, meta: m }; return m.buildings;
        });
      var b = Promise.all([get(root + 'data/buildings-all.json').then(function (r) { return r.json(); }), gunzip(root + 'data/buildings-all.bin.gz')])
        .then(function (r) {
          var m = r[0], pr = progs.box, vao = gl.createVertexArray(); gl.bindVertexArray(vao);
          var cube = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cube);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-.5, 0, -.5, .5, 0, -.5, .5, 0, .5, -.5, 0, .5, -.5, 1, -.5, .5, 1, -.5, .5, 1, .5, -.5, 1, .5]), gl.STATIC_DRAW);
          var lc = gl.getAttribLocation(pr.p, 'aC'); gl.enableVertexAttribArray(lc); gl.vertexAttribPointer(lc, 3, gl.FLOAT, false, 0, 0);
          var ci = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ci);
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]), gl.STATIC_DRAW);
          var ib2 = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib2); gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(r[1]), gl.STATIC_DRAW);
          var l0 = gl.getAttribLocation(pr.p, 'aI0'), l1 = gl.getAttribLocation(pr.p, 'aI1');
          gl.enableVertexAttribArray(l0); gl.vertexAttribPointer(l0, 4, gl.UNSIGNED_SHORT, false, 16, 0); gl.vertexAttribDivisor(l0, 1);
          gl.enableVertexAttribArray(l1); gl.vertexAttribPointer(l1, 4, gl.UNSIGNED_SHORT, false, 16, 8); gl.vertexAttribDivisor(l1, 1);
          gl.bindVertexArray(null);
          boxes = { vao: vao, n: Math.min(m.count, r[1].byteLength / 16) }; return boxes.n;
        });
      Promise.all([a.catch(function () { return 0; }), b.catch(function () { return 0; })]).then(function (n) { host.dataset.buildings = (n[0] + n[1]) || 'error'; });
    })();
    // St. Johns Bridge from fp3d.json "bridge": deck line from OpenStreetMap, published dimensions for the towers and deck
    (function buildBridge() {
      var B = meta.bridge; if (!B) return;
      var data = [], DECKC = [0.36, 0.36, 0.35], STEEL = [0.29, 0.50, 0.42], CABLE = [0.22, 0.40, 0.34];
      function wp(i, j) { return [i * DX - origin[0], j * DX - origin[1]]; }
      var G = B.deck.map(function (d) { return heightAt(d[0], d[1]); });
      var Gs = G.map(function (g, n) { var s = 0, c = 0; for (var m = Math.max(0, n - 3); m <= Math.min(G.length - 1, n + 3); m++) { s += G[m]; c++; } return s / c; });
      Gs[0] = G[0]; Gs[Gs.length - 1] = G[G.length - 1];
      var dpos = B.deck.map(function (d) { return wp(d[0], d[1]); });
      function gref(x, z) { var best = 0, bd = 1e18; dpos.forEach(function (p, n) { var dd = (p[0] - x) * (p[0] - x) + (p[1] - z) * (p[1] - z); if (dd < bd) { bd = dd; best = n; } }); return Gs[best]; }
      function box(c, col) {   // c: 8 corners [x, G, z, rel], bottom 0-3, top 4-7
        [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]].forEach(function (f) {
          [f[0], f[1], f[2], f[0], f[2], f[3]].forEach(function (v) { data.push(c[v][0], c[v][1], c[v][2], c[v][3], col[0], col[1], col[2]); });
        });
      }
      function beam(a, b, side, hw, th, col) {   // a, b: [x, z, rel]; hanging th below the line, hw either side
        var ga = gref(a[0], a[1]), gb = gref(b[0], b[1]);
        function C(p, g, sg, dz) { return [p[0] + side[0] * hw * sg, g, p[1] + side[1] * hw * sg, p[2] - g - dz]; }
        box([C(a, ga, -1, th), C(a, ga, 1, th), C(b, gb, 1, th), C(b, gb, -1, th), C(a, ga, -1, 0), C(a, ga, 1, 0), C(b, gb, 1, 0), C(b, gb, -1, 0)], col);
      }
      function post(p, z0, z1, ax, ay, ha0, hb0, ha1, hb1, col) {   // vertical member, tapering from (ha0, hb0) to (ha1, hb1)
        var g = gref(p[0], p[1]);
        function C(sa, sb, ha, hb, zz) { return [p[0] + ax[0] * ha * sa + ay[0] * hb * sb, g, p[1] + ax[1] * ha * sa + ay[1] * hb * sb, zz - g]; }
        box([C(-1, -1, ha0, hb0, z0), C(1, -1, ha0, hb0, z0), C(1, 1, ha0, hb0, z0), C(-1, 1, ha0, hb0, z0),
             C(-1, -1, ha1, hb1, z1), C(1, -1, ha1, hb1, z1), C(1, 1, ha1, hb1, z1), C(-1, 1, ha1, hb1, z1)], col);
      }
      var e0 = dpos[0], e1 = dpos[dpos.length - 1], L = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]);
      var dir = [(e1[0] - e0[0]) / L, (e1[1] - e0[1]) / L], perp = [-dir[1], dir[0]];
      for (var n = 0; n + 1 < B.deck.length; n++) {
        var a = [dpos[n][0], dpos[n][1], B.deck[n][2] + Gs[n] - gref(dpos[n][0], dpos[n][1])], b = [dpos[n + 1][0], dpos[n + 1][1], B.deck[n + 1][2] + Gs[n + 1] - gref(dpos[n + 1][0], dpos[n + 1][1])];
        a[2] = B.deck[n][2]; b[2] = B.deck[n + 1][2];
        var sd = [-(b[1] - a[1]), b[0] - a[0]], sl = Math.hypot(sd[0], sd[1]) || 1; sd = [sd[0] / sl, sd[1] / sl];
        beam(a, b, sd, B.width / 2, 2.5, DECKC);
        var hab = Math.min(B.deck[n][2], B.deck[n + 1][2]) - Math.max(G[n], G[n + 1]);
        if (hab > 12) [-1, 1].forEach(function (sg) {   // stiffening trusses along both edges
          var o = [sd[0] * sg * (B.width / 2 - 0.8), sd[1] * sg * (B.width / 2 - 0.8)];
          beam([a[0] + o[0], a[1] + o[1], a[2] - 2.5], [b[0] + o[0], b[1] + o[1], b[2] - 2.5], sd, 0.7, 6, STEEL);
        });
      }
      B.towers.forEach(function (tw) {
        var legs = tw.legs.map(function (c) { return wp(c[0], c[1]); });
        legs.forEach(function (p) { post(p, B.water - 2, tw.top, dir, perp, 5, 4.2, 2.6, 2.2, STEEL); });
        [[tw.deck - 4, 4], [tw.deck + 30, 3], [tw.top - 7, 5]].forEach(function (cb) {   // portal beams
          beam([legs[0][0], legs[0][1], cb[0]], [legs[1][0], legs[1][1], cb[0]], dir, 2.2, cb[1], STEEL);
        });
        var mid = [(legs[0][0] + legs[1][0]) / 2, (legs[0][1] + legs[1][1]) / 2];
        post(mid, tw.top - 7, tw.top + 9, dir, perp, 1.4, 1.4, 0.2, 0.2, STEEL);   // the Gothic spire
      });
      B.cables.forEach(function (cab) {
        for (var n = 0; n + 1 < cab.length; n++) {
          var p = wp(cab[n][0], cab[n][1]), q = wp(cab[n + 1][0], cab[n + 1][1]);
          beam([p[0], p[1], cab[n][2]], [q[0], q[1], cab[n + 1][2]], perp, 0.6, 1.2, CABLE);
          if (cab[n][2] - cab[n][3] > 3) post(p, cab[n][3], cab[n][2] - 1, dir, perp, 0.2, 0.2, 0.2, 0.2, CABLE);   // suspenders
        }
      });
      var f = new Float32Array(data), vao = gl.createVertexArray(), pr = progs.br; gl.bindVertexArray(vao);
      var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, f, gl.STATIC_DRAW);
      var lp = gl.getAttribLocation(pr.p, 'aP'), lc = gl.getAttribLocation(pr.p, 'aCol');
      gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 4, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(lc); gl.vertexAttribPointer(lc, 3, gl.FLOAT, false, 28, 16);
      gl.bindVertexArray(null);
      bridge = { vao: vao, n: f.length / 7 };
      var mc = B.deck[Math.floor(B.deck.length / 2)]; bridge.center = [mc[0], mc[1]]; bridge.az = Math.atan2(perp[0], perp[1]);
    })();
    function drawBuildings(now, dark) {
      if (!P.bld) return;
      var bg = LS.hor, time = (now - start) / 1000;
      if (bld) {
        var pr = progs.bld; gl.useProgram(pr.p);
        gl.bindBuffer(gl.ARRAY_BUFFER, bld.vb);
        var lp = gl.getAttribLocation(pr.p, 'aP'), ln = gl.getAttribLocation(pr.p, 'aN');
        gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 4, gl.UNSIGNED_SHORT, false, 12, 0);
        gl.enableVertexAttribArray(ln); gl.vertexAttribPointer(ln, 3, gl.BYTE, true, 12, 8);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bld.ib);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, states[cur].t); gl.uniform1i(pr.u.uState, 0);
        gl.uniformMatrix4fv(pr.u.uMVP, false, mvp); gl.uniform1f(pr.u.uExag, P.exag); gl.uniform2f(pr.u.uOrigin, origin[0], origin[1]);
        gl.uniform2i(pr.u.uSize, W, H); gl.uniform1f(pr.u.uT, t); gl.uniform1f(pr.u.uDark, dark ? 1 : 0); gl.uniform1f(pr.u.uTime, time);
        gl.uniform3fv(pr.u.uSun, LS.sun);
        gl.drawElements(gl.TRIANGLES, bld.n, gl.UNSIGNED_INT, 0);
        gl.disableVertexAttribArray(ln);
      }
      if (boxes) {
        var pb = progs.box; gl.useProgram(pb.p); gl.bindVertexArray(boxes.vao);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, states[cur].t); gl.uniform1i(pb.u.uState, 0);
        gl.uniformMatrix4fv(pb.u.uMVP, false, mvp); gl.uniform1f(pb.u.uExag, P.exag); gl.uniform2f(pb.u.uOrigin, origin[0], origin[1]);
        gl.uniform2i(pb.u.uSize, W, H); gl.uniform1f(pb.u.uT, t); gl.uniform1f(pb.u.uDark, dark ? 1 : 0); gl.uniform1f(pb.u.uTime, time);
        gl.uniform3f(pb.u.uEye, eye[0], eye[1], eye[2]); gl.uniform3f(pb.u.uFog, bg[0], bg[1], bg[2]); gl.uniform3fv(pb.u.uSun, LS.sun);
        gl.drawElementsInstanced(gl.TRIANGLES, 30, gl.UNSIGNED_SHORT, 0, boxes.n);
        gl.bindVertexArray(null);
      }
      if (bridge) {
        var pg = progs.br; gl.useProgram(pg.p); gl.bindVertexArray(bridge.vao);
        gl.uniformMatrix4fv(pg.u.uMVP, false, mvp); gl.uniform1f(pg.u.uExag, P.exag); gl.uniform1f(pg.u.uDark, dark ? 1 : 0);
        gl.uniform3f(pg.u.uEye, eye[0], eye[1], eye[2]); gl.uniform3f(pg.u.uFog, bg[0], bg[1], bg[2]); gl.uniform3fv(pg.u.uSun, LS.sun);
        gl.drawArrays(gl.TRIANGLES, 0, bridge.n);
        gl.bindVertexArray(null);
      }
    }

    // ---------- interaction
    // mouse: drag = orbit, right/middle/shift-drag = pan (the ground follows the cursor), wheel = zoom toward the cursor,
    // click = ignite, double-click = fly in; touch: one finger orbits, two fingers pan, pinch and twist; keyboard and on-screen buttons
    var ptrs = {}, downAt = null, moved = 0, two = null, lastMove = 0, pend = [];
    function wrapA(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
    function stopAuto() { if (P.orbit) P.orbit = false; }
    function panBy(dx, dy, dtm) {
      var s = cam.dist * 0.785 / Math.max(1, canvas.clientHeight), sy = s / Math.max(0.3, Math.sin(cam.el)), a = cam.az;
      var mx = -Math.cos(a) * dx * s - Math.sin(a) * dy * sy, mz = Math.sin(a) * dx * s - Math.cos(a) * dy * sy;
      goal.tx += mx; goal.tz += mz; ease = 16;
      if (dtm) { vel.tx = 0.6 * vel.tx + 0.4 * mx / dtm; vel.tz = 0.6 * vel.tz + 0.4 * mz / dtm; }
    }
    function zoomAt(f, x, y) {
      var nd = Math.max(300, Math.min(45000, goal.dist * f)), ff = nd / goal.dist, p = x === undefined ? null : pick(x, y);
      if (p) { var wx = p[0] * DX - origin[0], wz = p[1] * DX - origin[1]; goal.tx = wx + (goal.tx - wx) * ff; goal.tz = wz + (goal.tz - wz) * ff; }
      goal.dist = nd; ease = 12; clampGoal();
    }
    function twoState() {
      var ks = Object.keys(ptrs), a = ptrs[ks[0]], b = ptrs[ks[1]];
      return { d: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])), ang: Math.atan2(b[1] - a[1], b[0] - a[0]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 };
    }
    canvas.addEventListener('pointerdown', function (e) {
      if (canvas.focus) canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(e.pointerId); ptrs[e.pointerId] = [e.clientX, e.clientY];
      var ks = Object.keys(ptrs);
      if (ks.length === 1) { downAt = { x: e.clientX, y: e.clientY, t: performance.now(), btn: e.button, shift: e.shiftKey }; moved = 0; }
      else { two = twoState(); moved = 99; }
      dragging = true; vel = { az: 0, el: 0, tx: 0, tz: 0 }; lastMove = performance.now(); stopAuto();
      help.hidden = true;
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!ptrs[e.pointerId]) return;
      var p0 = ptrs[e.pointerId], dx = e.clientX - p0[0], dy = e.clientY - p0[1]; ptrs[e.pointerId] = [e.clientX, e.clientY];
      moved += Math.abs(dx) + Math.abs(dy);
      var now = performance.now(), dtm = Math.max(8, now - lastMove) / 1000; lastMove = now;
      if (Object.keys(ptrs).length >= 2) {
        var s2 = twoState();
        if (two) {
          var r = canvas.getBoundingClientRect();
          zoomAt(two.d / s2.d, s2.mx, s2.my); panBy(s2.mx - two.mx, s2.my - two.my, 0);
          goal.az -= wrapA(s2.ang - two.ang);
        }
        two = s2; return;
      }
      if (!downAt) return;
      if (downAt.btn === 2 || downAt.btn === 1 || downAt.shift) panBy(dx, dy, dtm);
      else {
        var dA = -dx * 0.0055, dE = dy * 0.0045; goal.az += dA; goal.el += dE; ease = 16; clampGoal();
        vel.az = 0.6 * vel.az + 0.4 * dA / dtm; vel.el = 0.6 * vel.el + 0.4 * dE / dtm;
      }
    });
    function up(e) {
      if (!ptrs[e.pointerId]) return;
      delete ptrs[e.pointerId];
      var left = Object.keys(ptrs).length;
      if (left === 1) { two = null; downAt = null; return; }
      if (left) return;
      dragging = false;
      if (performance.now() - lastMove > 90) vel = { az: 0, el: 0, tx: 0, tz: 0 };
      if (downAt && moved < 6 && performance.now() - downAt.t < 450 && downAt.btn === 0 && !downAt.shift) {
        vel = { az: 0, el: 0, tx: 0, tz: 0 };
        var c = pick(e.clientX, e.clientY);
        if (c) pend.push(setTimeout(function () {   // wait briefly: a second click means "fly in", not "ignite"
          ign.push([c[0], c[1], 40, t + 1]); if (!P.playing) { P.playing = true; bPlay.textContent = 'Pause'; }
        }, 260));
      }
      downAt = null; two = null;
    }
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('dblclick', function (e) {
      pend.forEach(clearTimeout); pend = [];
      var c = pick(e.clientX, e.clientY); if (!c) return;
      stopAuto(); setGoal(cellGoal(c, goal.dist * 0.4), 3.5);
    });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault(); stopAuto();
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      zoomAt(Math.exp(Math.max(-300, Math.min(300, dy)) * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY);
    }, { passive: false });
    var NAVK = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd', 'q', 'e', 'r', 'f', '+', '=', '-', '_'];
    canvas.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var k = e.key.toLowerCase();
      if (NAVK.indexOf(k) >= 0) { keys[k] = true; e.preventDefault(); stopAuto(); }
      else if (k === '0' || k === 'home') { setGoal(JSON.parse(JSON.stringify(cam0)), 3); e.preventDefault(); }
      else if (k === 'n') setGoal({ az: 0 }, 4);
    });
    canvas.addEventListener('keyup', function (e) {
      var k = e.key.toLowerCase(); delete keys[k];
      if (k === '+' || k === '=') { delete keys['+']; delete keys['=']; } if (k === '-' || k === '_') { delete keys['-']; delete keys._; }
    });
    canvas.addEventListener('blur', function () { keys = {}; });
    // on-screen camera buttons: tap for a step, hold to keep moving
    [['+', 'Zoom in', { d: -1 }, function () { zoomAt(0.6); }], ['−', 'Zoom out', { d: 1 }, function () { zoomAt(1.65); }],
     ['⟲', 'Rotate left', { a: -1 }, function () { goal.az -= 0.35; }], ['⟳', 'Rotate right', { a: 1 }, function () { goal.az += 0.35; }],
     ['▴', 'Look from higher up', { e: 1 }, function () { goal.el += 0.18; clampGoal(); }], ['▾', 'Look from lower down', { e: -1 }, function () { goal.el -= 0.18; clampGoal(); }]
    ].forEach(function (b) {
      var btn = h('button', { type: 'button', text: b[0], title: b[1], 'aria-label': b[1] }), t0 = 0;
      btn.addEventListener('pointerdown', function (e) { e.preventDefault(); stopAuto(); hold = b[2]; t0 = performance.now(); btn.setPointerCapture(e.pointerId); });
      function rel() { if (hold === b[2]) { if (performance.now() - t0 < 200) { b[3](); ease = 8; } hold = null; } }
      btn.addEventListener('pointerup', rel); btn.addEventListener('pointercancel', rel); btn.addEventListener('lostpointercapture', rel);
      btn.addEventListener('click', function (e) { if (e.detail === 0) { b[3](); ease = 8; } });   // keyboard activation
      nav.appendChild(btn);
    });
    compass.addEventListener('click', function () { setGoal({ az: 0 }, 4); });
    host.simSet = function (o) { Object.assign(P, o); if (o.crown !== undefined || o.wind !== undefined) coefChanged(); return JSON.stringify(P); };   // for tests
    host.cameraJump = function () { Object.assign(cam, goal); cam.ty = heightAt((cam.tx + origin[0]) / DX, (cam.tz + origin[1]) / DX) * P.exag; return JSON.stringify(goal); };   // for tests and scripted tours: skip the glide
    bPlay.addEventListener('click', function () { P.playing = !P.playing; bPlay.textContent = P.playing ? 'Pause' : 'Play'; });
    bReset.addEventListener('click', function () { reset(); });
    bView.addEventListener('click', function () { P.orbit = false; setGoal(JSON.parse(JSON.stringify(cam0)), 3); });
    bLapse.addEventListener('click', function () {
      reset(); P.speed = 30; cSpeed[1].value = 30; cSpeed[2].textContent = '30 min/s'; P.orbit = true; setGoal({ dist: Math.max(goal.dist, 9000) }, 3);
      if (!ign.length && !line && !replay) addSource('lightning');
      P.playing = true; bPlay.textContent = 'Pause';
    });
    function lonlat(lon, lat) { var b = meta.bbox; return [(lon - b.west) / (b.east - b.west) * W - 0.5, (b.north - lat) / (b.north - b.south) * H - 0.5]; }
    cFly.addEventListener('change', function () {
      var v = cFly.value; cFly.value = ''; if (!v) return; stopAuto();
      if (v === 'park') setGoal(cellGoal(meta.park_center, 15500, 0.62, -0.78), 2.5);
      else if (v === 'top') setGoal(cellGoal(meta.park_center, 21000, 1.55, 0), 2.5);
      else if (v === 'downtown') setGoal(cellGoal(lonlat(-122.679, 45.519), 2600, 0.42, -0.9), 2.5);
      else if (v === 'nw') setGoal(cellGoal(lonlat(-122.692, 45.531), 2400, 0.45, -1.6), 2.5);
      else if (v === 'linnton') setGoal(cellGoal(meta.places.Linnton, 1900, 0.32, 1.25), 2.5);
      else if (v === 'stjohns') setGoal(cellGoal(meta.places['St. Johns'], 2600, 0.45, 2.4), 2.5);
      else if (v === 'bridge' && bridge) setGoal(cellGoal(bridge.center, 850, 0.20, bridge.az + 0.5), 2.5);
      else if (v === 'fire') {
        var sx = 0, sy = 0, n = 0, ext = 0;
        if (hot.length) { for (var m = 0; m < hot.length / 2; m++) { sx += (hot[2 * m] % RW) * 4 + 2; sy += ((hot[2 * m] / RW) | 0) * 4 + 2; n++; } }
        else ign.forEach(function (g) { sx += g[0]; sy += g[1]; n++; });
        if (!n) { focusOn(meta.presets[P.preset]); return; }
        sx /= n; sy /= n;
        if (hot.length) for (m = 0; m < hot.length / 2; m++) ext = Math.max(ext, Math.hypot((hot[2 * m] % RW) * 4 + 2 - sx, ((hot[2 * m] / RW) | 0) * 4 + 2 - sy));
        setGoal(cellGoal([sx, sy], Math.max(2500, Math.min(16000, 2500 + ext * DX * 2.4)), 0.6), 2.5);
      }
    });
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
        loadBitmap(root + 'img/fire/fuelmap-dark.jpg'), loadBitmap(root + 'img/fire/fuelmap-light.jpg'),
        loadBitmap(root + 'data/fp3d-canopy.png').catch(function () { return null; })]);   // without it the simulator falls back to the fuel-map view
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
      try { Sim(el, r[0], r[1], r[2], r[3], r[4]); }
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
