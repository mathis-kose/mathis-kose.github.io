/* Startseite: Kacheln vergroessern sich (Maus: Hover, Handy: Antippen mit Vorschaufenster), Live-Vorschau mit Bildfolge oder 3D-Modell. */
(function () {
    'use strict';
    var doc = document;
    var tiles = [].slice.call(doc.querySelectorAll('.grid .gt'));
    if (!tiles.length) return;
    var scrim = doc.querySelector('.scrim');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    var conn = navigator.connection;
    var saveData = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')));

    var current = null;      // geoeffnete Kachel
    var hoverTimer = 0, leaveTimer = 0;
    var DUR = reduce ? 0 : 620;

    function targetRect(touch) {
        var vw = window.innerWidth, vh = window.innerHeight, w, h;
        if (touch) { w = Math.min(vw * 0.92, 560); h = Math.min(vh * 0.74, 700); }
        else { w = Math.min(1180, vw * 0.94); h = Math.min(vh * 0.86, 780); }
        return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
    }
    function put(t, r) {
        t.style.left = r.left + 'px'; t.style.top = r.top + 'px';
        t.style.width = r.width + 'px'; t.style.height = r.height + 'px';
    }
    function cellRect(t) { return t.parentElement.getBoundingClientRect(); }

    /* ---------- Live-Inhalte ---------- */
    function pad3(n) { return ('00' + n).slice(-3); }

    function startFrames(t, quiet) {
        var live = t.querySelector('.live');
        var st = t._st || (t._st = {});
        if (!st.cv) {
            st.base = t.getAttribute('data-frames'); st.count = +t.getAttribute('data-count'); st.step = +t.getAttribute('data-step');
            st.cv = doc.createElement('canvas'); st.cv.width = 720; st.cv.height = 576; st.cx = st.cv.getContext('2d');
            st.cache = []; st.idx = 0;
            for (var i = 0; i < st.count; i++) {
                var im = new Image(); im.decoding = 'async';
                if (i === 0) im.onload = function () { st.cx.drawImage(st.cache[0], 0, 0); };
                im.src = st.base + pad3(i * st.step) + '.webp'; st.cache.push(im);
            }
            live.appendChild(st.cv);
        }
        function show(i) {
            i = Math.max(0, Math.min(st.count - 1, i));
            var im = st.cache[i];
            if (im.complete && im.naturalWidth) { st.idx = i; st.cx.drawImage(im, 0, 0); }
        }
        st.show = show;
        if (quiet) return;
        if (!reduce && !st.timer) {
            var hold = 0;
            st.timer = setInterval(function () {
                if (st.scrubbing) return;
                if (hold > 0) { hold--; return; }
                if (st.idx >= st.count - 1) { hold = 18; st.idx = -1; }
                var n = st.idx + 1;
                if (n < st.count && st.cache[n].complete) show(n); else if (n >= st.count) show(0);
            }, 58);
        }
        // Mit der Maus (oder dem Finger) durch die Bildfolge ziehen
        if (!st.bound) {
            st.bound = true; var idleT = 0;
            var scrub = function (e) {
                if (!t.classList.contains('is-open')) return;
                if (t.classList.contains('is-touch') && e.pointerType !== 'touch' && e.buttons === 0) return;
                if (t.classList.contains('is-touch') && e.pointerType === 'touch' && !st.down) return;
                var r = live.getBoundingClientRect();
                var f = (e.clientX - r.left) / r.width;
                st.scrubbing = true; clearTimeout(idleT);
                show(Math.round(f * (st.count - 1)));
                idleT = setTimeout(function () { st.scrubbing = false; }, 2200);
            };
            live.addEventListener('pointermove', scrub);
            live.addEventListener('pointerdown', function (e) { st.down = true; scrub(e); });
            window.addEventListener('pointerup', function () { st.down = false; });
        }
    }
    function stopFrames(t) {
        var st = t._st; if (!st) return;
        clearInterval(st.timer); st.timer = 0; st.scrubbing = false;
        if (st.show) st.show(0);
    }

    var mvPromise = null;
    function loadMV() {
        if (!mvPromise) {
            mvPromise = new Promise(function (ok, fail) {
                var s = doc.createElement('script'); s.type = 'module'; s.src = '3d/model-viewer.min.js'; s.onload = ok; s.onerror = fail; doc.head.appendChild(s);
            });
        }
        return mvPromise;
    }
    function startModel(t) {
        var live = t.querySelector('.live');
        var st = t._st || (t._st = {});
        if (st.mv) { try { st.mv.autoRotate = !reduce; } catch (e) {} if (st.ready) t.classList.add('is-live'); return; }
        if (st.loading) return; st.loading = true;
        loadMV().then(function () {
            var MV = window.customElements && customElements.get('model-viewer');
            if (MV && MV.meshoptDecoderLocation !== '3d/meshopt_decoder.js') MV.meshoptDecoderLocation = '3d/meshopt_decoder.js';
            var mv = doc.createElement('model-viewer');
            var a = {
                'src': t.getAttribute('data-model'), 'alt': 'Orchideen-System als 3D-Modell, mit Maus oder Finger drehbar',
                'shadow-intensity': '1', 'shadow-softness': '0.9', 'exposure': '0.7', 'environment-image': 'neutral',
                'camera-orbit': '28deg 80deg auto', 'field-of-view': '26deg', 'interaction-prompt': 'none',
                'min-camera-orbit': 'auto 45deg auto', 'max-camera-orbit': 'auto 100deg auto', 'disable-zoom': '', 'camera-controls': '',
                'touch-action': 'pan-y'
            };
            if (!reduce) { a['auto-rotate'] = ''; a['rotation-per-second'] = '16deg'; a['auto-rotate-delay'] = '600'; }
            Object.keys(a).forEach(function (k) { mv.setAttribute(k, a[k]); });
            mv.addEventListener('load', function () { st.ready = true; if (t.classList.contains('is-open')) t.classList.add('is-live'); });
            live.appendChild(mv); st.mv = mv;
        }).catch(function () { st.loading = false; });
    }
    function startLive(t) {
        if (saveData && t.getAttribute('data-kind') !== 'soon') return;
        var k = t.getAttribute('data-kind');
        if (k === 'soon') { t.classList.add('is-live'); return; }
        if (k === 'frames') { startFrames(t); t.classList.add('is-live'); }
        else if (k === 'model') { startModel(t); if (t._st && t._st.ready) t.classList.add('is-live'); }
    }
    function stopLive(t) {
        t.classList.remove('is-live');
        if (t.getAttribute('data-kind') === 'frames') stopFrames(t);
        else if (t._st && t._st.mv) { try { t._st.mv.autoRotate = false; } catch (e) {} }
    }
    function warm(t) {   // Daten schon beim Annaehern holen
        if (saveData) return;
        if (t.getAttribute('data-kind') === 'model') { loadMV().catch(function () {}); }
        else { startFrames(t, true); }
    }

    /* ---------- Oeffnen und Schliessen ---------- */
    function open(t, touch) {
        if (current === t) return;
        if (current) closeNow(current, true);
        clearTimeout(t._closeT);
        var c = cellRect(t);
        put(t, { left: c.left, top: c.top, width: c.width, height: c.height });
        t.classList.add('is-fixed');
        t.classList.toggle('is-touch', !!touch);
        void t.offsetWidth;
        t.classList.add('is-open');
        put(t, targetRect(touch));
        scrim.classList.add('on'); scrim.classList.toggle('touch', !!touch);
        current = t;
        startLive(t);
    }
    function closeNow(t, instant) {
        if (!t.classList.contains('is-open')) return;
        stopLive(t);
        t.classList.remove('is-open');
        scrim.classList.remove('on', 'touch');
        if (current === t) current = null;
        if (instant || DUR === 0) { finish(t); return; }
        put(t, cellRect(t));
        t._closeT = setTimeout(function () { finish(t); }, DUR + 40);
    }
    function finish(t) {
        t.classList.remove('is-fixed', 'is-touch');
        t.style.left = t.style.top = t.style.width = t.style.height = '';
    }

    window.addEventListener('resize', function () {
        if (current) put(current, targetRect(current.classList.contains('is-touch')));
    });
    window.addEventListener('scroll', function () { if (current && !current.classList.contains('is-touch')) closeNow(current); }, { passive: true });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && current) closeNow(current); });
    doc.addEventListener('visibilitychange', function () { if (doc.hidden && current) closeNow(current, true); });

    tiles.forEach(function (t) {
        var link = t.querySelector('.gt-link');
        var xbtn = t.querySelector('.x');

        t.addEventListener('pointerenter', function (e) {
            if (e.pointerType !== 'mouse' || !fine.matches) return;
            warm(t); clearTimeout(leaveTimer);
            hoverTimer = setTimeout(function () { open(t, false); }, 150);
        });
        t.addEventListener('pointerleave', function (e) {
            if (e.pointerType !== 'mouse') return;
            clearTimeout(hoverTimer);
        });
        t.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') warm(t); }, { passive: true });

        // Handy: erstes Tippen = Vorschaufenster, der Knopf darin oeffnet das Projekt
        link.addEventListener('click', function (e) {
            if (fine.matches && t.getAttribute('data-kind') !== 'soon') return;   // Maus: normaler Link
            e.preventDefault(); open(t, !fine.matches);
        });
        // Maus: Klick auf die vergroesserte Kachel (ohne Ziehen) oeffnet das Projekt
        var down = null;
        t.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, t: Date.now() }; });
        t.addEventListener('pointerup', function (e) {
            if (!down || !t.classList.contains('is-open') || t.classList.contains('is-touch') || e.pointerType !== 'mouse') return;
            var moved = Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y);
            if (t.getAttribute('data-kind') === 'soon') return;
            if (moved < 6 && Date.now() - down.t < 450 && !(e.target.closest && e.target.closest('.go'))) location.href = link.getAttribute('href');
        });
        // Tastatur: Fokus oeffnet, Enter navigiert
        link.addEventListener('focus', function () { if (link.matches(':focus-visible')) open(t, false); });
        link.addEventListener('blur', function () { if (current === t && !t.classList.contains('is-touch')) closeNow(t); });
        if (xbtn) xbtn.addEventListener('click', function (e) { e.stopPropagation(); closeNow(t); });
    });

    // Maus verlaesst Kachel und Ursprungsfeld: schliessen
    doc.addEventListener('pointermove', function (e) {
        if (!current || e.pointerType !== 'mouse' || current.classList.contains('is-touch')) return;
        var r = current.getBoundingClientRect(), c = cellRect(current), m = 14;
        var inside = function (b) { return e.clientX >= b.left - m && e.clientX <= b.right + m && e.clientY >= b.top - m && e.clientY <= b.bottom + m; };
        if (inside(r) || inside(c)) { clearTimeout(leaveTimer); leaveTimer = 0; return; }
        if (!leaveTimer) leaveTimer = setTimeout(function () { leaveTimer = 0; if (current) closeNow(current); }, 160);
    }, { passive: true });
    scrim.addEventListener('click', function () { if (current) closeNow(current); });
})();
