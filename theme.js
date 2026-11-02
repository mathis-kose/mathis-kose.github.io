/* Theme: Standard = System. Der Schalter (nur Sonne/Mond) sitzt im Footer neben dem Copyright
   und wechselt Hell/Dunkel; die Wahl wird im Browser gemerkt. */
(function () {
    var KEY = 'theme', root = document.documentElement;
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    var SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    var MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
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
        btn.addEventListener('click', function () {
            var next = current() === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem(KEY, next); } catch (e) {}
            apply(next); paint();
        });
        if (mq && mq.addEventListener) mq.addEventListener('change', paint);
        paint();
        var host = document.querySelector('footer p') || document.querySelector('footer') || document.body;
        host.appendChild(btn);
    });
})();
