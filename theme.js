/* Theme: Standard = System. Wahl (Hell/Dunkel) wird im Browser gemerkt, "Auto" folgt wieder dem System. */
(function () {
    var KEY = 'theme', root = document.documentElement;
    var order = ['auto', 'light', 'dark'];
    var label = { auto: 'Auto', light: 'Hell', dark: 'Dunkel' };
    function read() { try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; } }
    function apply(mode) {
        if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
        else root.removeAttribute('data-theme');
    }
    apply(read());
    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.createElement('button');
        btn.className = 'theme-toggle';
        btn.type = 'button';
        function paint() {
            var m = read();
            btn.textContent = 'Theme: ' + label[m];
            btn.setAttribute('aria-label', 'Farbschema wechseln, aktuell ' + label[m]);
        }
        btn.addEventListener('click', function () {
            var next = order[(order.indexOf(read()) + 1) % order.length];
            try { if (next === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, next); } catch (e) {}
            apply(next); paint();
        });
        paint();
        document.body.appendChild(btn);
    });
})();
