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

    // Produktgalerie: Hauptbild wechseln
    var main = document.querySelector('[data-gallery-main]');
    document.querySelectorAll('[data-gallery-thumb]').forEach(function (b) {
        b.addEventListener('click', function () {
            var tpl = document.getElementById(b.getAttribute('data-gallery-thumb'));
            if (!tpl || !main) return;
            main.innerHTML = '';
            main.appendChild(tpl.content.cloneNode(true));
            document.querySelectorAll('[data-gallery-thumb]').forEach(function (x) { x.removeAttribute('aria-current'); });
            b.setAttribute('aria-current', 'true');
        });
    });
})();
