/* ASCII-Flow fuer die Startseite.
   Portierung der Variante "flow" des ASCII Effect aus nxui (https://github.com/vinayakkulkarni/nxui,
   MIT-Lizenz, (c) Vinayak Kulkarni) auf Vanilla-JS. Gleiche Parameter und gleiche Formeln fuer Feld,
   Dithering, Wellenversatz und Zeiger-Ripple. Unterschiede zum Original: Das Helligkeitsfeld wird nur bei
   Groessenaenderung berechnet (nicht jedes Bild), die Zeichen kommen aus einem Glyphen-Atlas, die Farben
   folgen dem Theme (Hell/Dunkel), Pause ausserhalb des Sichtbereichs und bei "reduzierte Bewegung" ein
   statisches Bild. Zwei Ebenen: Wellenmuster im Hintergrund, Tiger unten links. */
(function () {
    'use strict';

    // Einstellungen (Namen wie bei nxui). Ebenen koennen einzelne Werte ueberschreiben.
    var CFG = {
        chars: ' .:-=+*#%@',
        fontSize: 6, fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: 400,
        lineHeight: 1, characterSpacing: 1,
        brightnessBoost: 2.2, contrast: 1.1, threshold: 0.06, posterize: 32,
        dither: 'floyd-steinberg', ditherStrength: 0.8,
        flowSpeed: 0.22, flowDirection: 0, flowStrength: 12, flowFrequency: 0.018,
        mouseRadius: 150, mouseStrength: 22, mouseWaveSpeed: 1.2,
        scale: 1, fit: 'cover', invert: false
    };

    var root = document.documentElement;
    var stage = document.querySelector('.ascii-stage');
    if (!stage) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function clamp(v, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return v < a ? a : (v > b ? b : v); }

    // ---------- Farben aus dem Theme ----------
    function parseColor(c) {
        c = String(c).trim();
        var m = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(c);
        if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
        m = /^#([\da-f])([\da-f])([\da-f])$/i.exec(c);
        if (m) return [parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16), parseInt(m[3] + m[3], 16)];
        m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(c);
        if (m) return [+m[1], +m[2], +m[3]];
        return [128, 128, 128];
    }
    function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    function themeVar(n) { return parseColor(getComputedStyle(root).getPropertyValue(n)); }
    function palette(kind) {
        var bg = themeVar('--bg'), tx = themeVar('--text'), rd = themeVar('--red');
        if (kind === 'pattern') return [mix(bg, rd, 0.14), mix(bg, rd, 0.55)];
        return [mix(bg, tx, 0.62), tx];
    }
    function gradient(stops, t) {
        var p = clamp(t) * (stops.length - 1), i = Math.min(Math.floor(p), stops.length - 2), f = p - i;
        var c = mix(stops[i], stops[i + 1], f);
        return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
    }

    // ---------- Dithering (wie nxui) ----------
    var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    function ditherFS(f, cols, rows, steps, strength) {
        var amt = clamp(strength);
        for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
                var i = r * cols + c, old = clamp(f[i]);
                var q = Math.round(old * (steps - 1)) / (steps - 1);
                var v = old + (q - old) * amt, e = old - v;
                f[i] = v;
                if (c + 1 < cols) f[i + 1] += e * 7 / 16;
                if (r + 1 < rows) {
                    if (c > 0) f[i + cols - 1] += e * 3 / 16;
                    f[i + cols] += e * 5 / 16;
                    if (c + 1 < cols) f[i + cols + 1] += e / 16;
                }
            }
        }
    }
    function ditherBayer(f, cols, rows, strength) {
        var amt = clamp(strength);
        for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
            var i = r * cols + c;
            f[i] = clamp(f[i] + ((BAYER[(r % 4) * 4 + (c % 4)] / 16 - 0.5) * amt) / 4);
        }
    }
    function posterizeField(f, steps) {
        for (var i = 0; i < f.length; i++) f[i] = Math.round(clamp(f[i]) * (steps - 1)) / (steps - 1);
    }

    // ---------- Quellbilder (hell auf schwarz: Helligkeit = Zeichendichte) ----------
    // Hintergrund: Wellenband-Muster wie die Kunst-Kachel (parallele Wellen, drei Staerken), weiche Kanten.
    function makePattern(w, h) {
        var c = document.createElement('canvas');
        c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h));
        var x = c.getContext('2d');
        x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
        x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#fff';
        var spacing = clamp(c.height / 8, 76, 120), n = Math.ceil(c.height / spacing) + 2;
        var amp = spacing * 0.5, lambda = Math.max(c.width, 640) / 1.7;
        var weights = [0.46, 0.7, 0.94];
        for (var i = 0; i < n; i++) {
            var base = (i - 0.5) * spacing, thick = spacing * weights[i % 3];
            for (var k = 0; k < 4; k++) {
                x.globalAlpha = 0.34; x.lineWidth = thick * (1 - k * 0.2);
                x.beginPath();
                for (var px = -24; px <= c.width + 24; px += 8) {
                    var py = base + amp * Math.sin(px / lambda * Math.PI * 2);
                    if (px === -24) x.moveTo(px, py); else x.lineTo(px, py);
                }
                x.stroke();
            }
        }
        x.globalAlpha = 1;
        return c;
    }
    // Tiger: Tusche (#111 auf transparent) wird weiss auf schwarz, damit die Streifen Zeichen bekommen.
    function makeTiger(img) {
        var TW = 1000, TH = Math.round(TW * 725 / 730);
        var a = document.createElement('canvas'); a.width = TW; a.height = TH;
        var ax = a.getContext('2d');
        ax.drawImage(img, 0, 0, TW, TH);
        ax.globalCompositeOperation = 'source-in'; ax.fillStyle = '#fff'; ax.fillRect(0, 0, TW, TH);
        var b = document.createElement('canvas'); b.width = TW; b.height = TH;
        var bx = b.getContext('2d');
        bx.fillStyle = '#000'; bx.fillRect(0, 0, TW, TH); bx.drawImage(a, 0, 0);
        return b;
    }

    // Aussparungen im Hintergrundmuster (Tiger, Ueberschrift): weich ausblenden, damit sie frei bleiben
    function holeFactor(holes, x, y) {
        var f = 1;
        for (var i = 0; i < holes.length; i++) {
            var hh = holes[i], dx = (x - hh.cx) / hh.rx, dy = (y - hh.cy) / hh.ry, d = Math.sqrt(dx * dx + dy * dy);
            if (d < 1) return 0;
            if (d < 1.4) f = Math.min(f, (d - 1) / 0.4);
        }
        return f;
    }
    function ellipseOf(el, base, grow) {
        var r = el.getBoundingClientRect();
        return { cx: r.left + r.width / 2 - base.left, cy: r.top + r.height / 2 - base.top, rx: r.width / 2 * grow, ry: r.height / 2 * grow };
    }

    // ---------- Ebene ----------
    var DPR_MAX = 2;
    function Layer(canvas, kind, getSource, over, minDt) {
        this.canvas = canvas; this.kind = kind; this.getSource = getSource;
        this.o = {}; for (var k in CFG) this.o[k] = CFG[k]; for (k in (over || {})) this.o[k] = over[k];
        this.ctx = canvas.getContext('2d');
        this.sample = document.createElement('canvas');
        this.sctx = this.sample.getContext('2d', { willReadFrequently: true });
        this.atlas = document.createElement('canvas');
        this.ptr = { x: 0, y: 0, tx: 0, ty: 0, on: false };
        this.minDt = minDt || 16; this.last = 0; this.visible = true; this.ready = false; this.shown = false;
    }
    Layer.prototype.build = function () {
        var o = this.o, cv = this.canvas, rect = cv.getBoundingClientRect();
        this.ready = false;
        if (rect.width < 2 || rect.height < 2 || !this.ctx || !this.sctx) return;
        var w = rect.width, h = rect.height, dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        var ctx = this.ctx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.font = o.fontWeight + ' ' + o.fontSize + 'px ' + o.fontFamily;
        // Zellen auf ganze Geraetepixel runden: Glyphen werden ohne Skalierung kopiert (viel schneller)
        var cwDev = Math.max(2, Math.round(ctx.measureText('M').width * dpr * Math.max(0.5, o.characterSpacing)));
        var chDev = Math.max(4, Math.round(o.fontSize * Math.max(0.5, o.lineHeight) * dpr));
        var cellW = cwDev / dpr, cellH = chDev / dpr;
        var cols = Math.ceil(w / cellW) + 2, rows = Math.ceil(h / cellH) + 2;
        var src = this.getSource(w, h);
        if (!src) return;
        var sw = src.width, sh = src.height;
        this.sample.width = cols; this.sample.height = rows;
        var sx = this.sctx;
        sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = 'high';
        sx.clearRect(0, 0, cols, rows);
        var fitScale = o.fit === 'contain' ? Math.min(w / sw, h / sh) : Math.max(w / sw, h / sh);
        var sc = o.fit === 'stretch' ? 1 : fitScale * Math.max(0.1, o.scale);
        var dw = o.fit === 'stretch' ? cols : (sw * sc) / cellW, dh = o.fit === 'stretch' ? rows : (sh * sc) / cellH;
        sx.drawImage(src, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
        var px = sx.getImageData(0, 0, cols, rows).data;
        var field = new Float32Array(cols * rows);
        var steps = Math.max(2, Math.round(o.posterize)), contrast = Math.max(0, o.contrast), th = o.threshold;
        for (var i = 0; i < field.length; i++) {
            var p = i * 4, al = px[p + 3] / 255;
            var lum = (px[p] * 0.2126 + px[p + 1] * 0.7152 + px[p + 2] * 0.0722) / 255;
            lum = clamp((lum - 0.5) * contrast + 0.5);
            lum = clamp(lum * o.brightnessBoost * al);
            field[i] = lum <= th ? 0 : (lum - th) / Math.max(0.001, 1 - th);
        }
        if (o.dither === 'floyd-steinberg') ditherFS(field, cols, rows, steps, o.ditherStrength);
        else if (o.dither === 'bayer') ditherBayer(field, cols, rows, o.ditherStrength);
        else posterizeField(field, steps);
        this.w = w; this.h = h; this.dpr = dpr; this.cellW = cellW; this.cellH = cellH; this.cwDev = cwDev; this.chDev = chDev;
        this.cols = cols; this.rows = rows; this.field = field; this.levels = steps;
        this.holes = this.getHoles ? this.getHoles(rect) : null;
        this.img = ctx.createImageData(cv.width, cv.height);
        this.buf32 = new Uint32Array(this.img.data.buffer);
        this.makeAtlas();
        this.ready = true;
    };
    // Glyphen-Atlas: pro Helligkeitsstufe ein Zeichen in der Verlaufsfarbe (Farbe haengt vom Theme ab).
    Layer.prototype.makeAtlas = function () {
        if (!this.cellW) return;
        var o = this.o, L = this.levels, dpr = this.dpr, last = o.chars.length - 1;
        var sw = this.cwDev, sh = this.chDev;
        var stops = palette(this.kind);
        this.sw = sw; this.sh = sh; this.vis = new Uint8Array(L);
        this.atlas.width = sw * L; this.atlas.height = sh;
        var a = this.atlas.getContext('2d', { willReadFrequently: true });
        a.setTransform(dpr, 0, 0, dpr, 0, 0);
        a.font = o.fontWeight + ' ' + o.fontSize + 'px ' + o.fontFamily; a.textBaseline = 'top';
        for (var k = 0; k < L; k++) {
            var lum = k / (L - 1), ch = o.chars[Math.min(last, Math.floor(lum * last))];
            if (!ch || !ch.trim()) continue;
            this.vis[k] = 1;
            a.fillStyle = gradient(stops, lum);
            a.fillText(ch, (k * sw) / dpr, 0);
        }
        // Pixel des Atlas fuer das schnelle Kopieren in den Bildpuffer (ein Zeichen = ein Block aus Pixeln)
        this.aw = sw * L;
        this.spr32 = new Uint32Array(a.getImageData(0, 0, sw * L, sh).data.buffer);
    };
    Layer.prototype.draw = function (now) {
        if (!this.ready) return;
        var o = this.o, ctx = this.ctx, field = this.field, cols = this.cols, rows = this.rows;
        var cw = this.cellW, ch = this.cellH, last = this.levels - 1, sw = this.sw, sh = this.sh;
        var ptr = this.ptr, animated = !reduce, vis = this.vis;
        ptr.x += (ptr.tx - ptr.x) * 0.08; ptr.y += (ptr.ty - ptr.y) * 0.08;
        var rad = o.flowDirection * Math.PI / 180, dX = Math.cos(rad), dY = Math.sin(rad);
        var fq = o.flowFrequency, t = now * o.flowSpeed * Math.PI * 0.002;
        var usePtr = animated && ptr.on && o.mouseRadius > 0, holes = this.holes, R = o.mouseRadius;
        var buf = this.buf32, spr = this.spr32, aw = this.aw, W = this.canvas.width, H = this.canvas.height;
        buf.fill(0);
        // Die Welle ist sin(Spalte + Zeile): per Additionstheorem je Spalte und Zeile einmal berechnen
        var cA = this.cA || (this.cA = new Float32Array(cols * 4)), rA = this.rA || (this.rA = new Float32Array(rows * 4));
        if (cA.length < cols * 4) cA = this.cA = new Float32Array(cols * 4);
        if (rA.length < rows * 4) rA = this.rA = new Float32Array(rows * 4);
        var i, pc, pr, qc, qr;
        for (i = 0; i < cols; i++) {
            var x = i * cw;
            pc = x * dX * fq + t; qc = pc * 0.61 + (-x * dY) * fq * 0.65;
            cA[i * 4] = Math.sin(pc); cA[i * 4 + 1] = Math.cos(pc); cA[i * 4 + 2] = Math.sin(qc); cA[i * 4 + 3] = Math.cos(qc);
        }
        for (i = 0; i < rows; i++) {
            var yy = i * ch;
            pr = yy * dY * fq; qr = pr * 0.61 + (yy * dX) * fq * 0.65;
            rA[i * 4] = Math.sin(pr); rA[i * 4 + 1] = Math.cos(pr); rA[i * 4 + 2] = Math.sin(qr); rA[i * 4 + 3] = Math.cos(qr);
        }
        var fs = o.flowStrength, adx = dX / cw, ady = dY / ch;
        for (var row = 0; row < rows; row++) {
            var y = row * ch, rs1 = rA[row * 4], rc1 = rA[row * 4 + 1], rs2 = rA[row * 4 + 2], rc2 = rA[row * 4 + 3];
            var dy0 = (row - 1) * sh;
            for (var col = 0; col < cols; col++) {
                var sc = col, sr = row, mi = 0;
                if (animated) {
                    var k = col * 4;
                    var drift = ((cA[k] * rc1 + cA[k + 1] * rs1) + (cA[k + 2] * rc2 + cA[k + 3] * rs2) * 0.45) * fs;
                    if (usePtr) {
                        var x2 = col * cw, mx = x2 - ptr.x, my = y - ptr.y;
                        if (mx < R && mx > -R && my < R && my > -R) {
                            var dist = Math.sqrt(mx * mx + my * my);
                            mi = clamp(1 - dist / R);
                            if (dist > 0 && mi > 0) {
                                var rip = Math.sin(dist * 0.055 - now * o.mouseWaveSpeed * Math.PI * 0.002);
                                var disp = mi * mi * o.mouseStrength * rip;
                                sc -= (mx / dist) * disp / cw;
                                sr -= (my / dist) * disp / ch;
                            }
                        }
                    }
                    sc -= drift * adx; sr -= drift * ady;
                }
                var ic = sc < 0 ? 0 : (sc > cols - 1 ? cols - 1 : Math.round(sc));
                var ir = sr < 0 ? 0 : (sr > rows - 1 ? rows - 1 : Math.round(sr));
                var lum = field[ir * cols + ic] + mi * 0.08;
                if (lum > 1) lum = 1;
                if (holes) lum *= holeFactor(holes, col * cw, y);
                if (o.invert) lum = 1 - lum;
                var lvl = (lum * last + 0.5) | 0;
                if (!vis[lvl]) continue;
                var dx = (col - 1) * sw, so = lvl * sw;
                if (dx >= 0 && dx + sw <= W && dy0 >= 0 && dy0 + sh <= H) {
                    for (var yy = 0, di = dy0 * W + dx, si = so; yy < sh; yy++, di += W, si += aw) {
                        for (var xx = 0; xx < sw; xx++) buf[di + xx] = spr[si + xx];
                    }
                } else {
                    for (var y3 = 0; y3 < sh; y3++) {
                        var py = dy0 + y3; if (py < 0 || py >= H) continue;
                        for (var x3 = 0; x3 < sw; x3++) { var px3 = dx + x3; if (px3 >= 0 && px3 < W) buf[py * W + px3] = spr[y3 * aw + so + x3]; }
                    }
                }
            }
        }
        ctx.putImageData(this.img, 0, 0);
        if (!this.shown) { this.shown = true; this.canvas.classList.add('on'); if (this.onFirst) this.onFirst(); }
    };

    // ---------- Aufbau ----------
    var bgCanvas = stage.querySelector('.ascii-bg');
    var tigerLink = stage.querySelector('.ascii-tiger');
    var tigerCanvas = tigerLink && tigerLink.querySelector('canvas');
    var tigerImg = tigerLink && tigerLink.querySelector('img');
    var layers = [], tigerSource = null;

    if (bgCanvas && bgCanvas.getContext) {
        var bgLayer = new Layer(bgCanvas, 'pattern', makePattern, { fit: 'cover' }, 33);
        bgLayer.getHoles = function (base) {
            var hs = [];
            if (tigerLink) { var e = ellipseOf(tigerLink, base, 1); e.rx *= 0.98; e.ry *= 1.02; e.cy += e.ry * 0.04; hs.push(e); }
            stage.querySelectorAll('.ascii-copy h1, .ascii-copy p').forEach(function (el) { hs.push(ellipseOf(el, base, 1.12)); });
            return hs;
        };
        layers.push(bgLayer);
    }
    if (tigerCanvas && tigerCanvas.getContext && tigerImg) {
        var tl = new Layer(tigerCanvas, 'tiger', function () { return tigerSource; }, { fit: 'contain', fontSize: 4, fontWeight: 700, brightnessBoost: 3.2, contrast: 1.25 }, 16);
        tl.onFirst = function () { stage.classList.add('is-ascii'); };
        layers.push(tl);
    }
    if (!layers.length) return;

    // Zeichenschleife (mit ?probe=1 werden Zeichenzeiten in window.__asciiStats gesammelt)
    var probe = /[?&]probe=1/.test(location.search), running = false;
    function tick(now) {
        var any = false;
        for (var i = 0; i < layers.length; i++) {
            var l = layers[i];
            if (!l.ready || !l.visible) continue;
            any = true;
            if (now - l.last >= l.minDt - 2) {
                l.last = now;
                if (probe) { var t0 = performance.now(); l.draw(now); var st = (window.__asciiStats = window.__asciiStats || {})[l.kind] = (window.__asciiStats[l.kind] || { n: 0, ms: 0, max: 0 }); var dt = performance.now() - t0; st.n++; st.ms += dt; if (dt > st.max) st.max = dt; st.cells = l.cols * l.rows; }
                else l.draw(now);
            }
        }
        if (any && !document.hidden && !reduce) requestAnimationFrame(tick); else running = false;
    }
    function kick() { if (!running && !reduce) { running = true; requestAnimationFrame(tick); } }
    function redrawStatic() { if (reduce) layers.forEach(function (l) { l.draw(performance.now()); }); }
    function buildAll() { layers.forEach(function (l) { l.build(); }); redrawStatic(); kick(); }

    // Tiger-Quelle laden (SVG), danach Ebene aufbauen
    function loadTiger() {
        try { tigerSource = makeTiger(tigerImg); } catch (e) { return; }
        layers.forEach(function (l) { if (l.kind === 'tiger') l.build(); });
        redrawStatic(); kick();
    }
    if (tigerImg) {
        if (tigerImg.complete && tigerImg.naturalWidth > 0) loadTiger();
        else tigerImg.addEventListener('load', loadTiger, { once: true });
    }

    buildAll();
    var rt = 0;
    function scheduleBuild() { if (rt) return; rt = requestAnimationFrame(function () { rt = 0; buildAll(); }); }
    if ('ResizeObserver' in window) {
        var ro = new ResizeObserver(scheduleBuild);
        layers.forEach(function (l) { ro.observe(l.canvas); });
    } else window.addEventListener('resize', scheduleBuild);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleBuild);

    // Sichtbarkeit: ausserhalb des Bildschirms nicht zeichnen
    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
            es.forEach(function (e) {
                layers.forEach(function (l) { if (l.canvas === e.target) l.visible = e.isIntersecting; });
            });
            kick();
        });
        layers.forEach(function (l) { io.observe(l.canvas); });
    }
    document.addEventListener('visibilitychange', kick);

    // Theme-Wechsel: Farben im Atlas neu setzen (auch beim Ripple-Uebergang sofort)
    function recolor() { layers.forEach(function (l) { l.makeAtlas(); }); redrawStatic(); if (!reduce) layers.forEach(function (l) { if (l.ready && l.visible) l.draw(performance.now()); }); }
    new MutationObserver(recolor).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-color-scheme: dark)');
        if (mq.addEventListener) mq.addEventListener('change', recolor);
    }

    // Zeiger: Maus bewegt die Zeichen, Tippen (Touch) loest kurz einen Ripple aus
    function setPointer(e, hold) {
        layers.forEach(function (l) {
            var r = l.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, p = l.ptr;
            if (!p.on || hold) { p.x = x; p.y = y; }
            p.on = true; p.tx = x; p.ty = y;
        });
    }
    function clearPointer() { layers.forEach(function (l) { l.ptr.on = false; }); }
    if (!reduce) {
        stage.addEventListener('pointermove', function (e) { if (e.pointerType !== 'touch') setPointer(e); });
        stage.addEventListener('pointerleave', clearPointer);
        var tapTimer = 0;
        stage.addEventListener('pointerdown', function (e) {
            if (e.pointerType !== 'touch') return;
            setPointer(e, true); clearTimeout(tapTimer); tapTimer = setTimeout(clearPointer, 1100);
        });
    }
})();
