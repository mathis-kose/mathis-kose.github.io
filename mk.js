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
