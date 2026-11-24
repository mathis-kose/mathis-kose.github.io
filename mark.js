/* Zeichen 術 als Linolschnitt-Animation: Block mit gespiegeltem Zeichen, Messer mit Spaenen, Block wird umgedreht, glaenzender Druck.
   Laeuft einmal beim Laden und danach alle 15 Sekunden. Alles ist eine reine Funktion der Zeit (render(t)), daher pausier- und pruefbar.
   Hintergrund transparent. Mit prefers-reduced-motion: nur der fertige Druck. */
(function () {
    'use strict';
    var svg = document.getElementById('mark');
    if (!svg) return;
    var $ = function (id) { return document.getElementById(id); };
    var NS = 'http://www.w3.org/2000/svg';
    var PERIOD = 15000;

    var blk = $('mk-block'), shadow = $('mk-shadow'), cut = $('mk-cut'), pencil = $('mk-pencil'), pencilClip = $('mk-pencil-wipe'),
        knife = $('mk-knife'), chipsG = $('mk-chips'), prt = $('mk-print'), sheen = $('mk-sheen'), wet = $('mk-wet'), blur = $('mk-blur');
    var bands = [0, 1, 2, 3, 4].map(function (i) { return $('mk-band' + i); });

    // Geometrie (Einheiten der viewBox 1240 x 1080)
    var BX = 40, BY = 52, BW = 1160, BH = 972, CX = 620, CY = BY + BH / 2;
    var ROWS = 5, BAND = BH / ROWS;
    var T = { blockIn: [0, 600], pencil: [450, 1150], carve: [1150, 3000], knifeOut: [3000, 3350], lift: [3250, 3650], flip: [3650, 4300], print: [4300, 4750], gloss: [4750, 6600], dry: [4750, 8200], fade: [14300, 15000] };
    var ROW_T = (T.carve[1] - T.carve[0]) / ROWS;

    function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function seg(t, a) { return clamp01((t - a[0]) / (a[1] - a[0])); }
    function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
    function easeIO(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
    function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

    // Messerweg: Reihe fuer Reihe (Schlangenlinie), Spitze auf der Bandmitte
    function rowDir(i) { return i % 2 === 0 ? 1 : -1; }
    function knifePos(t) {
        var k = (t - T.carve[0]) / ROW_T;
        var i = Math.max(0, Math.min(ROWS - 1, Math.floor(k)));
        var p = clamp01(k - i);
        var e = easeIO(p);
        var x = rowDir(i) === 1 ? BX + 30 + e * (BW - 60) : BX + BW - 30 - e * (BW - 60);
        var y = BY + BAND * (i + .5) + Math.sin(p * Math.PI * 6) * 22;
        return { x: x, y: y, row: i, p: p };
    }

    // Spaene: vorab mit festem Zufall erzeugt
    var rnd = mulberry(7), chips = [];
    for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < 9; c++) {
            var ts = T.carve[0] + r * ROW_T + (c + .5) / 9 * ROW_T * .92;
            var ph = clamp01((ts - T.carve[0] - r * ROW_T) / ROW_T), ee = easeIO(ph);
            var x0 = rowDir(r) === 1 ? BX + 30 + ee * (BW - 60) : BX + BW - 30 - ee * (BW - 60);
            var el = document.createElementNS(NS, 'path');
            el.setAttribute('d', 'M0 0 q 9 -15 24 -7 q -8 11 -24 7z');
            el.setAttribute('fill', rnd() > .45 ? '#c8d8c9' : '#b2c5b4');
            el.setAttribute('opacity', '0');
            chipsG.appendChild(el);
            chips.push({ el: el, ts: ts, x: x0, y: BY + BAND * (r + .5), vx: (rnd() - .35) * 720 * rowDir(r) + rowDir(r) * 120, vy: -(520 + rnd() * 620), rot: rnd() * 360, spin: (rnd() - .5) * 900, life: 520 + rnd() * 260, sc: .8 + rnd() * .9 });
        }
    }

    function set(el, a, v) { el.setAttribute(a, v); }

    function render(t) {
        // ---- Block ----
        var bi = easeOut(seg(t, T.blockIn)), lift = easeIO(seg(t, T.lift)), fl = easeIO(seg(t, T.flip));
        var fade = seg(t, T.fade);
        var blockVisible = t < T.flip[1] && fade < 1;
        blk.style.display = blockVisible ? '' : 'none';
        shadow.style.display = blockVisible ? '' : 'none';
        if (blockVisible) {
            var s = (.94 + .06 * bi) * (1 + .045 * lift) * (1 - .04 * fl);
            var sx = Math.cos(Math.PI / 2 * fl);
            var dy = 14 * (1 - bi) - 18 * lift;
            set(blk, 'transform', 'translate(' + CX + ' ' + (CY + dy) + ') scale(' + (sx * s).toFixed(4) + ' ' + s.toFixed(4) + ') translate(' + (-CX) + ' ' + (-CY) + ')');
            set(blk, 'opacity', bi.toFixed(3));
            set(shadow, 'opacity', (bi * (.9 - .55 * lift) * (1 - fl)).toFixed(3));
            set(shadow, 'transform', 'translate(' + CX + ' 1040) scale(' + ((1 - .12 * lift) * (1 - fl * .4)).toFixed(3) + ' 1) translate(' + (-CX) + ' -1040)');
        }
        // Bleistiftlinie des gespiegelten Zeichens wird von links aufgezogen
        set(pencilClip, 'width', (seg(t, T.pencil) * BW).toFixed(1));
        set(pencil, 'opacity', (.75 - .45 * seg(t, T.carve)).toFixed(3));
        // Schnitt: Maske waechst reihenweise hinter dem Messer her
        var k = (t - T.carve[0]) / ROW_T;
        for (var i = 0; i < ROWS; i++) {
            var p = clamp01(k - i);
            var w = easeIO(p) * (BW - 0);
            if (rowDir(i) === 1) { set(bands[i], 'x', BX); } else { set(bands[i], 'x', (BX + BW - w).toFixed(1)); }
            set(bands[i], 'width', w.toFixed(1));
        }
        // Messer
        var inCarve = t >= T.carve[0] - 120 && t <= T.knifeOut[1];
        knife.style.display = inCarve ? '' : 'none';
        if (inCarve) {
            var kp, ko = seg(t, T.knifeOut), ki = easeOut(clamp01((t - (T.carve[0] - 120)) / 160));
            if (t <= T.carve[1]) kp = knifePos(Math.max(t, T.carve[0])); else { var last = knifePos(T.carve[1] - 1); kp = { x: last.x, y: last.y }; }
            var ex = kp.x + (t > T.carve[1] ? easeIO(ko) * 520 * rowDir(ROWS - 1) : 0);
            var ey = kp.y - (t > T.carve[1] ? easeIO(ko) * 260 : (1 - ki) * 200);
            set(knife, 'transform', 'translate(' + ex.toFixed(1) + ' ' + ey.toFixed(1) + ') rotate(-34)');
            set(knife, 'opacity', (ki * (1 - ko)).toFixed(3));
        }
        // Spaene
        for (var j = 0; j < chips.length; j++) {
            var c = chips[j], a = t - c.ts;
            if (a < 0 || a > c.life) { if (c.on) { set(c.el, 'opacity', '0'); c.on = false; } continue; }
            var u = a / 1000, f = a / c.life;
            var x = c.x + c.vx * u, y = c.y + c.vy * u + 2600 * u * u * .5;
            set(c.el, 'transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + (c.rot + c.spin * u).toFixed(0) + ') scale(' + c.sc.toFixed(2) + ')');
            set(c.el, 'opacity', (f < .15 ? f / .15 : 1 - Math.pow(f, 2)).toFixed(3));
            c.on = true;
        }
        // ---- Abdruck ----
        var pr = easeOut(seg(t, T.print));
        var dry = seg(t, T.dry);
        var po = pr * (1 - fade);
        prt.style.display = po > 0.001 ? '' : 'none';
        if (po > 0.001) {
            var ps = 1.07 - .07 * pr;
            set(prt, 'opacity', po.toFixed(3));
            set(prt, 'transform', 'translate(' + CX + ' 540) scale(' + ps.toFixed(4) + ') translate(' + (-CX) + ' -540)');
            set(blur, 'stdDeviation', ((1 - pr) * 5 + fade * 3).toFixed(2));
            var g = easeIO(seg(t, T.gloss));
            set(sheen, 'x', (-340 + g * 1500).toFixed(1));
            set(sheen, 'opacity', (g > 0 && g < 1 ? .9 : 0).toFixed(2));
            set(wet, 'opacity', (.5 * (1 - dry) + .08).toFixed(3));
        }
    }

    // ---- Ablauf ----
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var t0 = 0, raf = 0, timer = 0, running = false, visible = true;
    function now() { return performance.now(); }
    function tick() {
        raf = 0;
        if (!running) return;
        var t = (now() - t0) % PERIOD;
        render(t);
        if (t > T.dry[1] + 100 && t < T.fade[0]) {          // Ruhephase: nichts zu zeichnen, bis zum Ausblenden schlafen
            timer = setTimeout(function () { timer = 0; if (running) raf = requestAnimationFrame(tick); }, T.fade[0] - t);
            return;
        }
        raf = requestAnimationFrame(tick);
    }
    function start() { if (running || reduce) return; running = true; if (!t0) t0 = now(); raf = requestAnimationFrame(tick); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); if (timer) clearTimeout(timer); raf = timer = 0; }

    if (reduce) { render(T.dry[1] + 200); }
    else {
        render(0); t0 = now(); start();
        if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !doc.hidden) start(); else stop(); }).observe(svg);
        var doc = document;
        doc.addEventListener('visibilitychange', function () { if (doc.hidden) stop(); else if (visible) start(); });
    }
    window.__markSeek = function (t) { stop(); render(t); };   // Pruefhaken
})();
