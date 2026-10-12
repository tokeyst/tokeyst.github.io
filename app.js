/* Interactive figure: two-soliton collision of the KdV equation
   u_t + 6 u u_x + u_xxx = 0, with u = 2 (ln f)_xx and
   f = 1 + e1 + e2 + A e1 e2,  e_i = exp(2 k_i (x - x0_i) - 8 k_i^3 t),
   A = ((k2 - k1) / (k2 + k1))^2.  Soliton i has amplitude 2 k_i^2 and speed 4 k_i^2. */
(function () {
  'use strict';

  var cvP = document.getElementById('sim-profile');
  var cvM = document.getElementById('sim-map');
  var slT = document.getElementById('sim-t');
  var slK = document.getElementById('sim-k2');
  var btn = document.getElementById('sim-play');
  var outT = document.getElementById('sim-tval');
  var outA = document.getElementById('sim-amp');
  var read = document.getElementById('sim-read');
  if (!cvP || !cvM || !slT || !slK || !btn || !cvP.getContext) return;

  var ctxP = cvP.getContext('2d');
  var ctxM = cvM.getContext('2d');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var X0 = -12, X1 = 34;          // plotted range of x
  var T0 = -0.6, T1 = 2.4;        // plotted range of t
  var UMAX = 8.2;                 // fixed vertical scale
  var K1 = 1.0, X01 = 3, X02 = -4;
  var PLAY_MS = 7000;             // time for one full run

  var AMBER = '#f5b544', SKY = '#a8c8ff';
  var TEXT = '#b4c5e3', GRID = 'rgba(180,197,227,.22)', INK = '#f3f7fe';

  var k2 = parseFloat(slK.value);
  var t = parseFloat(slT.value);
  var playing = false, raf = 0, lastTs = 0, started = false;
  var dpr = 1, geo = {}, mapCanvas = null;

  function A() { var r = (k2 - K1) / (k2 + K1); return r * r; }
  function shiftL() { return -Math.log(A()); }

  function u(x, tt) {
    var q1 = 2 * K1, q2 = 2 * k2, a = A();
    var e1 = Math.exp(q1 * (x - X01) - 8 * K1 * K1 * K1 * tt);
    var e2 = Math.exp(q2 * (x - X02) - 8 * k2 * k2 * k2 * tt);
    var e12 = a * e1 * e2;
    var f = 1 + e1 + e2 + e12;
    var fx = q1 * e1 + q2 * e2 + (q1 + q2) * e12;
    var fxx = q1 * q1 * e1 + q2 * q2 * e2 + (q1 + q2) * (q1 + q2) * e12;
    return 2 * (f * fxx - fx * fx) / (f * f);
  }
  function sech2(z) { var c = Math.cosh(z); return 1 / (c * c); }

  // centers of the two solitons if they did not interact (initial asymptotes)
  function freeShort(tt) { return X01 + shiftL() / (2 * K1) + 4 * K1 * K1 * tt; }
  function freeTall(tt)  { return X02 + 4 * k2 * k2 * tt; }

  function fmtT(v) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(2); }

  function updateText() {
    outT.textContent = 't = ' + fmtT(t);
    outA.textContent = (2 * k2 * k2).toFixed(2);
    var L = shiftL();
    read.innerHTML =
      '<span class="dot amber"></span><b>Taller soliton</b>: amplitude ' + (2 * k2 * k2).toFixed(2) +
      ', ends up ' + (L / (2 * k2)).toFixed(2) + ' ahead of its dashed line. ' +
      '<span class="dot sky" style="margin-left:.6em"></span><b>Shorter soliton</b>: amplitude ' + (2 * K1 * K1).toFixed(2) +
      ', ends up ' + (L / (2 * K1)).toFixed(2) + ' behind its dashed line.';
  }

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    [cvP, cvM].forEach(function (c) {
      var w = c.clientWidth, h = c.clientHeight;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    });
    geo.pl = 40; geo.pr = 12;
    geo.wP = cvP.clientWidth; geo.hP = cvP.clientHeight;
    geo.wM = cvM.clientWidth; geo.hM = cvM.clientHeight;
    buildMap();
  }

  function sx(x, w) { return geo.pl + (x - X0) / (X1 - X0) * (w - geo.pl - geo.pr); }

  function buildMap() {
    var pw = geo.wM - geo.pl - geo.pr, ph = geo.hM - 12;
    var mw = Math.max(60, Math.round(pw)), mh = Math.max(30, Math.round(ph));
    var cv = document.createElement('canvas'); cv.width = mw; cv.height = mh;
    var cx = cv.getContext('2d');
    var img = cx.createImageData(mw, mh), d = img.data, i = 0;
    for (var j = 0; j < mh; j++) {
      var tt = T1 - (j / (mh - 1)) * (T1 - T0);
      for (var m = 0; m < mw; m++) {
        var x = X0 + (m / (mw - 1)) * (X1 - X0);
        var v = u(x, tt);
        var s = Math.sqrt(Math.max(0, Math.min(1, v / UMAX)));
        var r, g, b;
        if (s < 0.5) { var p = s / 0.5; r = 15 + p * (92 - 15); g = 40 + p * (140 - 40); b = 87 + p * (230 - 87); }
        else { var q = (s - 0.5) / 0.5; r = 92 + q * (255 - 92); g = 140 + q * (255 - 140); b = 230 + q * (255 - 230); }
        d[i++] = r; d[i++] = g; d[i++] = b; d[i++] = 255;
      }
    }
    cx.putImageData(img, 0, 0);
    mapCanvas = cv;
  }

  function drawProfile() {
    var w = geo.wP, h = geo.hP, c = ctxP;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    var pt = 14, pb = 26, ph = h - pt - pb;
    var sy = function (v) { return pt + ph - (v / UMAX) * ph; };

    // baseline, x ticks
    c.strokeStyle = GRID; c.lineWidth = 1; c.fillStyle = TEXT;
    c.font = '12px "Source Sans 3", system-ui, sans-serif';
    c.textAlign = 'center';
    for (var xv = -10; xv <= 30; xv += 10) {
      var px = sx(xv, w);
      c.beginPath(); c.moveTo(px, pt); c.lineTo(px, pt + ph); c.stroke();
      c.fillText(String(xv).replace('-', '−'), px, h - 8);
    }
    c.beginPath(); c.moveTo(geo.pl, sy(0)); c.lineTo(w - geo.pr, sy(0)); c.stroke();
    c.textAlign = 'right'; c.fillText('x', w - geo.pr, h - 8);
    c.textAlign = 'left'; c.fillText('u', 10, pt + 10);
    for (var yv = 2; yv <= 8; yv += 2) {
      c.textAlign = 'right';
      c.fillText(String(yv), geo.pl - 8, sy(yv) + 4);
      c.beginPath(); c.moveTo(geo.pl, sy(yv)); c.lineTo(w - geo.pr, sy(yv)); c.stroke();
    }

    // dashed free solitons
    function free(center, amp, kk, color) {
      c.save(); c.setLineDash([5, 5]); c.strokeStyle = color; c.lineWidth = 1.4; c.globalAlpha = .85;
      c.beginPath();
      var n = 160;
      for (var i = 0; i <= n; i++) {
        var x = X0 + (X1 - X0) * i / n;
        var y = sy(amp * sech2(kk * (x - center)));
        if (i === 0) c.moveTo(sx(x, w), y); else c.lineTo(sx(x, w), y);
      }
      c.stroke(); c.restore();
    }
    free(freeShort(t), 2 * K1 * K1, K1, SKY);
    free(freeTall(t), 2 * k2 * k2, k2, AMBER);

    // actual profile
    var n = Math.max(120, Math.round((w - geo.pl - geo.pr) / 1.5));
    var grad = c.createLinearGradient(0, pt, 0, pt + ph);
    grad.addColorStop(0, 'rgba(243,247,254,.28)'); grad.addColorStop(1, 'rgba(243,247,254,0)');
    c.beginPath();
    c.moveTo(sx(X0, w), sy(0));
    for (var i = 0; i <= n; i++) {
      var x = X0 + (X1 - X0) * i / n;
      c.lineTo(sx(x, w), sy(Math.max(0, u(x, t))));
    }
    c.lineTo(sx(X1, w), sy(0)); c.closePath();
    c.fillStyle = grad; c.fill();
    c.beginPath();
    for (var j = 0; j <= n; j++) {
      var xx = X0 + (X1 - X0) * j / n;
      var yy = sy(Math.max(0, u(xx, t)));
      if (j === 0) c.moveTo(sx(xx, w), yy); else c.lineTo(sx(xx, w), yy);
    }
    c.strokeStyle = INK; c.lineWidth = 2.2; c.lineJoin = 'round'; c.stroke();
  }

  function drawMap() {
    var w = geo.wM, h = geo.hM, c = ctxM;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    var pt = 6, ph = h - 12, pw = w - geo.pl - geo.pr;
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(mapCanvas, geo.pl, pt, pw, ph);
    var ty = function (tt) { return pt + ph - (tt - T0) / (T1 - T0) * ph; };

    // dashed straight trajectories of the free solitons
    function line(fn, color) {
      c.save();
      c.beginPath(); c.rect(geo.pl, pt, pw, ph); c.clip();
      c.setLineDash([5, 5]); c.strokeStyle = color; c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(sx(fn(T0), w), ty(T0)); c.lineTo(sx(fn(T1), w), ty(T1));
      c.stroke(); c.restore();
    }
    line(freeShort, SKY);
    line(freeTall, AMBER);

    // time marker
    var y = ty(t);
    c.strokeStyle = '#fff'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(geo.pl, y); c.lineTo(w - geo.pr, y); c.stroke();
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(geo.pl - 2, y); c.lineTo(geo.pl - 9, y - 5); c.lineTo(geo.pl - 9, y + 5); c.closePath(); c.fill();
    c.fillStyle = TEXT; c.font = '12px "Source Sans 3", system-ui, sans-serif';
    c.textAlign = 'left'; c.fillText('t', 10, pt + 12);
  }

  function draw() { drawProfile(); drawMap(); updateText(); }

  function setT(v) { t = Math.max(T0, Math.min(T1, v)); slT.value = String(t); draw(); }

  function tick(ts) {
    if (!playing) return;
    if (!lastTs) lastTs = ts;
    var dt = ts - lastTs; lastTs = ts;
    t += dt * (T1 - T0) / PLAY_MS;
    if (t >= T1) { t = T1; playing = false; btn.textContent = 'Replay'; }
    slT.value = String(t); draw();
    if (playing) raf = requestAnimationFrame(tick);
  }
  function play() {
    if (t >= T1 - 0.005) t = T0;
    playing = true; started = true; lastTs = 0; btn.textContent = 'Pause';
    cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
  }
  function pause() { playing = false; cancelAnimationFrame(raf); btn.textContent = t >= T1 - 0.005 ? 'Replay' : 'Play'; }

  btn.addEventListener('click', function () { playing ? pause() : play(); });
  slT.addEventListener('input', function () { if (playing) pause(); t = parseFloat(slT.value); started = true; draw(); });
  slK.addEventListener('input', function () { k2 = parseFloat(slK.value); buildMap(); draw(); });

  // dragging on the map also moves time
  var dragging = false;
  function mapToT(ev) {
    var r = cvM.getBoundingClientRect();
    var py = (ev.clientY - r.top - 6) / (r.height - 12);
    return T1 - Math.max(0, Math.min(1, py)) * (T1 - T0);
  }
  cvM.addEventListener('pointerdown', function (ev) {
    dragging = true; started = true; if (playing) pause();
    cvM.setPointerCapture(ev.pointerId); setT(mapToT(ev));
  });
  cvM.addEventListener('pointermove', function (ev) { if (dragging) setT(mapToT(ev)); });
  cvM.addEventListener('pointerup', function () { dragging = false; });
  cvM.addEventListener('pointercancel', function () { dragging = false; });

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt); rt = setTimeout(function () { size(); draw(); }, 120);
  });

  size();
  if (reduce) {
    // no automatic motion: show the moment of closest approach
    t = (X01 - X02) / (4 * (k2 * k2 - K1 * K1));
    slT.value = String(t);
    draw();
  } else {
    draw();
    var go = function () { if (!started) play(); };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { io.disconnect(); setTimeout(go, 350); }
      }, { threshold: 0.45 });
      io.observe(document.getElementById('sim'));
    } else { go(); }
  }
})();
