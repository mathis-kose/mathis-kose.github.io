/* Theme: Standard = System. Der Schalter (nur Sonne/Mond) sitzt im Footer neben dem Copyright
   und wechselt Hell/Dunkel; die Wahl wird im Browser gemerkt. */
(function () {
    var KEY = 'theme', root = document.documentElement;
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    var SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    var MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
    /* Ripple-Uebergang (Idee: nxui Ripple Transition): beim Wechsel Hell/Dunkel wandert vom Klickpunkt
       eine verrauschte Welle ueber die Seite, dahinter erscheint das neue Farbschema. Umsetzung mit der
       View Transitions API (Maske per clip-path) plus Canvas-Ring mit Glow und Farbsaeumen; ohne API oder
       bei "reduzierte Bewegung" wird sofort umgeschaltet. */
    var running = false;
    function ripple(x, y, change) {
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce || !document.startViewTransition) { change(); return; }
        running = true;
        var W = window.innerWidth, H = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
        var maxR = Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y)) * 1.12;
        var DUR = 1300, N = 96;
        var style = document.createElement('style');
        style.textContent =
            '@keyframes rp-hold{from{opacity:1}to{opacity:1}}' +
            '::view-transition-group(root){animation:rp-hold ' + (DUR + 150) + 'ms linear}' +
            '::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}' +
            '::view-transition-new(root){clip-path:var(--rp-clip)}' +
            '::view-transition-group(rp-ring),::view-transition-image-pair(rp-ring),::view-transition-new(rp-ring){animation:none}';
        document.head.appendChild(style);
        var canvas;
        function noise(a, t) {
            return Math.sin(a * 3 + t * 2.1) * 0.5 + Math.sin(a * 7 - t * 3.3) * 0.3 + Math.sin(a * 13 + t * 1.7) * 0.2;
        }
        function radius(a, base, t) { return Math.max(0, base * (1 + 0.05 * noise(a, t * 6)) ); }
        function cleanup() {
            running = false;
            root.style.removeProperty('--rp-clip');
            if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
            if (style.parentNode) style.parentNode.removeChild(style);
        }
        var vt;
        try {
            vt = document.startViewTransition(function () {
                change();
                root.style.setProperty('--rp-clip', 'circle(0px at ' + x + 'px ' + y + 'px)');
                canvas = document.createElement('canvas');
                canvas.width = W * dpr; canvas.height = H * dpr;
                canvas.setAttribute('aria-hidden', 'true');
                canvas.style.cssText = 'position:fixed;left:0;top:0;width:' + W + 'px;height:' + H + 'px;pointer-events:none;z-index:2147483647;view-transition-name:rp-ring';
                document.body.appendChild(canvas);
            });
        } catch (e) { change(); cleanup(); return; }
        vt.finished.then(cleanup, cleanup);
        vt.ready.then(function () {
            var ctx = canvas.getContext('2d');
            var t0 = performance.now();
            function path(base, t, off) {
                ctx.beginPath();
                for (var i = 0; i <= N; i++) {
                    var a = i / N * Math.PI * 2, rr = radius(a, base + off, t);
                    var px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
                    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
                }
                ctx.closePath();
            }
            function frame(now) {
                var t = Math.min((now - t0) / DUR, 1);
                var e = 1 - Math.pow(1 - t, 3);
                var base = e * maxR;
                var pts = [];
                for (var i = 0; i < N; i++) {
                    var a = i / N * Math.PI * 2, rr = radius(a, base, t);
                    pts.push((x + Math.cos(a) * rr).toFixed(1) + 'px ' + (y + Math.sin(a) * rr).toFixed(1) + 'px');
                }
                root.style.setProperty('--rp-clip', 'polygon(' + pts.join(',') + ')');
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, W, H);
                var alpha = Math.max(0, 1 - Math.pow(t, 2.2)), band = 10 + 26 * (1 - t);
                ctx.lineJoin = 'round';
                ctx.globalAlpha = alpha * 0.55; ctx.lineWidth = band * 0.5;
                ctx.strokeStyle = '#ff3d6e'; path(base, t, -band * 0.45); ctx.stroke();
                ctx.strokeStyle = '#3dc8ff'; path(base, t, band * 0.45); ctx.stroke();
                ctx.globalAlpha = alpha * 0.8; ctx.lineWidth = band * 0.6;
                ctx.strokeStyle = '#ffffff'; ctx.shadowColor = 'rgba(255,255,255,.9)'; ctx.shadowBlur = 24;
                path(base, t, 0); ctx.stroke();
                ctx.shadowBlur = 0; ctx.globalAlpha = 1;
                if (t < 1 && running) requestAnimationFrame(frame);
            }
            requestAnimationFrame(frame);
        }, cleanup);
    }
    function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
    function apply(mode) {
        if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
        else root.removeAttribute('data-theme');
    }
    function current() {
        var m = stored();
        if (m === 'light' || m === 'dark') return m;
        return mq && mq.matches ? 'dark' : 'light';
    }
    apply(stored());
    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.createElement('button');
        btn.className = 'theme-toggle';
        btn.type = 'button';
        function paint() {
            var m = current();
            btn.innerHTML = m === 'dark' ? MOON : SUN;
            btn.setAttribute('aria-label', m === 'dark' ? 'Zu hellem Farbschema wechseln' : 'Zu dunklem Farbschema wechseln');
        }
        btn.addEventListener('click', function (ev) {
            if (running) return;
            var next = current() === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem(KEY, next); } catch (e) {}
            var r = btn.getBoundingClientRect();
            var x = ev && ev.clientX ? ev.clientX : r.left + r.width / 2;
            var y = ev && ev.clientY ? ev.clientY : r.top + r.height / 2;
            ripple(x, y, function () { apply(next); paint(); });
        });
        if (mq && mq.addEventListener) mq.addEventListener('change', paint);
        paint();
        var host = document.querySelector('.footer-copy') || document.querySelector('footer p') || document.querySelector('footer') || document.body;
        host.appendChild(btn);
    });
})();
