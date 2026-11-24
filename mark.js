/* Zeichen 術: gerendertes Linolschnitt-Video (animiertes WebP mit Alpha, Hintergrund transparent). Zeigt die zum Theme passende Datei:
   Hell = schwarzer Abdruck, Dunkel = weisser Abdruck; mit prefers-reduced-motion nur das Standbild des fertigen Abdrucks.
   Die Animation laeuft beim Laden und wiederholt sich selbst alle 15 s (lange letzte Bilddauer in der Datei). */
(function () {
    'use strict';
    var img = document.getElementById('mark');
    if (!img) return;
    var root = document.documentElement, V = '20261124b', BASE = 'img/mark/mark-';
    var mqDark = window.matchMedia('(prefers-color-scheme: dark)'), mqRed = window.matchMedia('(prefers-reduced-motion: reduce)');
    function dark() { var t = root.getAttribute('data-theme'); return t === 'dark' || (t !== 'light' && mqDark.matches); }
    function apply() {
        var src = BASE + (dark() ? 'dunkel' : 'hell') + (mqRed.matches ? '-still' : '') + '.webp?v=' + V;
        if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    }
    apply();
    new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    [mqDark, mqRed].forEach(function (m) { if (m.addEventListener) m.addEventListener('change', apply); else if (m.addListener) m.addListener(apply); });
})();
