/* MK-Projects: kleine, optionale Verbesserungen. Ohne JS bleibt alles les- und klickbar. */
(function () {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.classList.remove('no-js');

    // Bento: leichtes Kippen bei Maus (nicht bei Touch, nicht bei reduzierter Bewegung)
    if (!reduce) {
        document.querySelectorAll('.bento .tile').forEach(function (t) {
            t.addEventListener('pointermove', function (e) {
                if (e.pointerType !== 'mouse') return;
                var r = t.getBoundingClientRect();
                var x = (e.clientX - r.left) / r.width - 0.5;
                var y = (e.clientY - r.top) / r.height - 0.5;
                t.style.setProperty('--ry', (x * 5).toFixed(2) + 'deg');
                t.style.setProperty('--rx', (-y * 5).toFixed(2) + 'deg');
            });
            t.addEventListener('pointerleave', function () {
                t.style.removeProperty('--ry'); t.style.removeProperty('--rx');
            });
        });
    }

    // Story: aktiven Schritt bestimmen, Buehne und Punkte nachfuehren
    var stage = document.querySelector('.story-stage');
    var steps = document.querySelectorAll('.step');
    if (stage && steps.length && 'IntersectionObserver' in window) {
        var dots = stage.querySelectorAll('.dots i');
        var set = function (n) {
            stage.setAttribute('data-step', n);
            steps.forEach(function (s) { s.classList.toggle('is-active', s.getAttribute('data-step') === String(n)); });
            dots.forEach(function (d, i) { d.classList.toggle('on', i + 1 === n); });
        };
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) set(parseInt(en.target.getAttribute('data-step'), 10));
            });
        }, { rootMargin: (window.matchMedia('(max-width: 899px)').matches ? '-60% 0px -16% 0px' : '-42% 0px -42% 0px'), threshold: 0 });
        steps.forEach(function (s) { io.observe(s); });
        set(1);
    } else if (stage) {
        stage.setAttribute('data-step', stage.getAttribute('data-last') || '6');
    }


    // Tiger-Story: Blender-Bildfolge, per Scrollposition vor- und zurueckgespult
    (function () {
        var st = document.querySelector('.story-stage[data-render]');
        var stepEls = document.querySelectorAll('.step');
        if (!st || !stepEls.length) return;
        var base = (window.matchMedia('(max-width: 899px)').matches && st.getAttribute('data-render-m')) || st.getAttribute('data-render');
        var total = parseInt(st.getAttribute('data-frames'), 10) || 182;
        var kf = (st.getAttribute('data-keys') || '').split(',').map(Number);
        var mo = (st.getAttribute('data-motion') || '').split(',').map(Number);   // Bewegung je Frame: Scrollweg wird nach Bildaenderung verteilt, nicht nach Frame-Index
        if (mo.length !== total) mo = null;
        if (kf.length !== stepEls.length) return;
        var sl = document.querySelector('.steps'); if (sl) sl.classList.add('long');
        var cv = document.createElement('canvas');
        cv.className = 'render'; cv.setAttribute('aria-hidden', 'true');
        var ctx = cv.getContext('2d');
        var frames = new Array(total), ready = false, want = 0, cur = 0, drawn = '';
        // Testhaken (nur mit ?probe in der URL): liefert Frame-Stand fuer tools/scrollfilm, aendert nichts am Ablauf
        if (/[?&]probe\b/.test(location.search)) window.__mkProbe = function () { var n = 0; for (var i = 0; i < total; i++) if (frames[i] && frames[i].ok) n++; var f = frames[Math.max(0, Math.min(total - 1, Math.round(cur)))]; return { cur: cur, want: want, total: total, loaded: n, have: !!(f && f.ok), fin: st.classList.contains('fin') }; };
        function name(i) { return base + 'f' + (i < 10 ? '00' : i < 100 ? '0' : '') + i + '.webp?v=20261104f'; }
        function load(i, cb) {
            if (frames[i]) { cb && cb(); return; }
            var im = new Image(); frames[i] = im;
            im.onload = function () { im.ok = true; cb && cb(); };
            im.onerror = function () { cb && cb(true); };
            im.decoding = 'async'; im.src = name(i);
        }
        // Dekodieren vorziehen: Frames in Laufrichtung vor dem Zeichnen decodieren, damit mitten im Scrollen nichts haengt
        var aheadAt = -99;
        function ahead(c) {
            if (Math.abs(c - aheadAt) < 3) return;
            aheadAt = c;
            var dir = want >= c ? 1 : -1, i0 = Math.round(c);
            for (var k = -2; k <= 28; k++) {
                var im = frames[i0 + dir * k];
                if (im && im.ok && !im.dec) { im.dec = 1; if (im.decode) im.decode().catch(function () {}); }
            }
        }
        function okf(i) { return i >= 0 && i < total && frames[i] && frames[i].ok; }
        function lower(i) { for (var k = Math.floor(i); k >= 0; k--) if (okf(k)) return k; return -1; }
        function upper(i) { for (var k = Math.ceil(i); k < total; k++) if (okf(k)) return k; return -1; }
        function size() {
            var r = st.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
            var w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
            var f0 = frames[0];
            if (f0 && f0.naturalWidth) {   // nie feiner als die Quellbilder: spart Fuellrate, CSS skaliert hoch
                if (w > f0.naturalWidth) { var q = f0.naturalWidth / w; w = f0.naturalWidth; h = Math.round(h * q); }
            }
            if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; drawn = ''; }
        }
        function put(im, alpha) {
            var s = Math.min(cv.width / im.naturalWidth, cv.height / im.naturalHeight);
            var w = im.naturalWidth * s, h = im.naturalHeight * s;
            ctx.globalAlpha = alpha;
            ctx.drawImage(im, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
        }
        // Zeichnet die Position cur: Nachbarframes werden weich ueberblendet, damit jede Scrollposition ein eigenes Bild hat
        function draw() {
            if (!ready) return;
            var c = Math.max(0, Math.min(total - 1, cur));
            var lo = lower(c), hi = upper(c);
            if (lo < 0 && hi < 0) return;
            if (lo < 0) lo = hi;
            if (hi < 0) hi = lo;
            var t = hi === lo ? 0 : (c - lo) / (hi - lo);
            size(); ahead(c);
            var key = lo + ':' + hi + ':' + Math.round(t * 64);
            if (key === drawn) return;
            ctx.globalAlpha = 1; ctx.clearRect(0, 0, cv.width, cv.height);
            put(frames[lo], 1);
            if (t > 0.01 && hi !== lo) put(frames[hi], t);
            ctx.globalAlpha = 1; drawn = key;
        }
        // Honig-Traegheit: die Anzeige folgt der Scrollposition gedaempft und mit Geschwindigkeitsgrenze (nur hier, die Seite scrollt normal)
        var honey = !reduce && !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        var raf = 0, last = 0;
        function step(now) {
            raf = 0;
            var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
            var d = want - cur;
            if (honey) {
                var k = 1 - Math.exp(-dt / 0.14), vmax = 70 * (total / 182) * dt;   // Zeitkonstante 140 ms, max. 70 Frames/s bei 182 Frames, skaliert mit der Frame-Dichte
                var mv = d * k; if (mv > vmax) mv = vmax; else if (mv < -vmax) mv = -vmax;
                cur += mv;
            } else cur = want;
            draw();
            if (Math.abs(want - cur) > 0.003) raf = requestAnimationFrame(step); else { cur = want; draw(); }
        }
        function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } }
        // Position u (0..1) im Abschnitt a..b -> Frame: Gewicht = 20 % gleichmaessig + 80 % Bewegung, damit Ruhephasen nicht den ganzen Scrollweg fressen
        function warp(a, b, u) {
            if (!mo || b - a < 2) return a + (b - a) * u;
            var avg = 0, i; for (i = a + 1; i <= b; i++) avg += mo[i]; avg = avg / (b - a) || 1;
            var w = [], tot = 0; for (i = a + 1; i <= b; i++) { var x = 0.2 + 0.8 * mo[i] / avg; w.push(x); tot += x; }
            var goal = u * tot, acc = 0;
            for (i = 0; i < w.length; i++) { if (acc + w[i] >= goal) return a + i + (goal - acc) / w[i]; acc += w[i]; }
            return b;
        }
        function update() {
            var ref = window.innerHeight * (window.matchMedia('(max-width: 899px)').matches ? 0.62 : 0.5);
            var c = [];
            stepEls.forEach(function (s) { var r = s.getBoundingClientRect(); c.push((r.top + r.bottom) / 2 - ref); });
            var n = c.length, f;
            if (c[0] >= 0) f = kf[0];
            else if (c[n - 1] <= 0) f = kf[n - 1];
            else {
                for (var i = 0; i < n - 1; i++) {
                    if (c[i] <= 0 && c[i + 1] > 0) { f = warp(kf[i], kf[i + 1], -c[i] / (c[i + 1] - c[i])); break; }
                }
            }
            // Uebergang zur CSS-Endansicht: nach dem letzten Frame ueber ~70 % Bildschirmhoehe Scrollweg weich ueberblenden (scrollgesteuert, kein Zeit-Fade)
            var fv = c[n - 1] <= 0 ? Math.min(1, -c[n - 1] / (window.innerHeight * 0.7)) : 0;
            fv = fv * fv * (3 - 2 * fv);
            st.style.setProperty('--fin', fv.toFixed(3)); st.classList.toggle('fin', fv >= 0.999);
            want = f; kick();
        }
        var tick = false;
        function onScroll() { if (tick) return; tick = true; requestAnimationFrame(function () { tick = false; update(); }); }
        load(0, function (err) {
            if (err) return;                      // ohne Bildfolge bleibt die CSS-3D-Buehne
            ready = true; st.classList.add('has-render');
            var gr = st.closest('.story-grid'); if (gr) gr.classList.add('big');
            st.insertBefore(cv, st.firstChild);
            window.addEventListener('scroll', onScroll, { passive: true });
            window.addEventListener('resize', function () { drawn = ''; onScroll(); });
            update(); cur = want; draw();
            // Erst ein grobes Geruest (jedes 16., dann 8. Bild), danach lueckenlos ab der aktuellen Position in Scrollrichtung nachladen (begrenzt parallel)
            [16, 8].forEach(function (stride, n) {
                for (var i = 0; i < total; i += stride) { (function (k) { setTimeout(function () { load(k, function () { drawn = ''; draw(); }); }, 400 * n); })(i); }
            });
            var inflight = 0;
            function pick() {
                var c = Math.max(0, Math.min(total - 1, Math.round(cur))), i;
                for (i = c; i < total; i++) if (!frames[i]) return i;
                for (i = c - 1; i >= 0; i--) if (!frames[i]) return i;
                return -1;
            }
            function pump() {
                while (inflight < 8) {
                    var i = pick(); if (i < 0) return;
                    inflight++;
                    load(i, function () { inflight--; drawn = ''; draw(); pump(); });
                }
            }
            setTimeout(pump, 900);
        });
    })();

    // 3D-Modell: model-viewer wird erst geladen, wenn die Flaeche sichtbar wird. Bis dahin (und ohne WebGL) bleibt das Poster stehen.
    var mvScript;
    function load3d() {
        if (!mvScript) {
            mvScript = new Promise(function (ok, fail) {
                var s = document.createElement('script');
                s.type = 'module'; s.src = '3d/model-viewer.min.js'; s.onload = ok; s.onerror = fail;
                document.head.appendChild(s);
            });
        }
        return mvScript;
    }
    function hydrate3d(root) {
        (root || document).querySelectorAll('.mv-host[data-model]').forEach(function (host) {
            if (host.hasAttribute('data-hydrated')) return;
            host.setAttribute('data-hydrated', '1');
            var c = navigator.connection;
            if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return;   // Datensparmodus: nur Poster
            var interactive = !host.hasAttribute('data-static');
            var go = function () {
                load3d().then(function () {
                    var mv = document.createElement('model-viewer');
                    var a = {
                        'src': host.getAttribute('data-model'), 'alt': host.getAttribute('data-alt') || '3D-Modell',
                        'shadow-intensity': '1', 'shadow-softness': '0.9', 'exposure': '1.1', 'environment-image': 'neutral',
                        'camera-orbit': '28deg 80deg auto', 'field-of-view': host.getAttribute('data-fov') || '26deg', 'interaction-prompt': 'none',
                        'min-camera-orbit': 'auto 45deg auto', 'max-camera-orbit': 'auto 100deg auto', 'disable-zoom': '',
                        'touch-action': 'pan-y'
                    };
                    if (!reduce) { a['auto-rotate'] = ''; a['rotation-per-second'] = '14deg'; a['auto-rotate-delay'] = '2200'; }
                    if (interactive) { a['camera-controls'] = ''; } else { a['tabindex'] = '-1'; a['aria-hidden'] = 'true'; }
                    Object.keys(a).forEach(function (k) { mv.setAttribute(k, a[k]); });
                    mv.addEventListener('load', function () { host.classList.add('is-ready'); });
                    mv.addEventListener('camera-change', function (e) {
                        if (e.detail && e.detail.source === 'user-interaction') host.classList.add('is-touched');
                    });
                    host.appendChild(mv);
                }).catch(function () {});
            };
            if ('IntersectionObserver' in window) {
                var io = new IntersectionObserver(function (es) {
                    if (es[0].isIntersecting) { io.disconnect(); go(); }
                }, { rootMargin: '200px' });
                io.observe(host);
            } else { go(); }
        });
    }
    hydrate3d(document);

    // Produktgalerie: Hauptbild wechseln
    var main = document.querySelector('[data-gallery-main]');
    document.querySelectorAll('[data-gallery-thumb]').forEach(function (b) {
        b.addEventListener('click', function () {
            var tpl = document.getElementById(b.getAttribute('data-gallery-thumb'));
            if (!tpl || !main) return;
            main.innerHTML = '';
            main.appendChild(tpl.content.cloneNode(true));
            hydrate3d(main);
            document.querySelectorAll('[data-gallery-thumb]').forEach(function (x) { x.removeAttribute('aria-current'); });
            b.setAttribute('aria-current', 'true');
        });
    });
})();
