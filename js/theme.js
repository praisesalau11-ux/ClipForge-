(function () {
  var d = document.documentElement;
  function get(k, def) { try { return localStorage.getItem(k) || def; } catch (e) { return def; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function apply() {
    var t = get("cf-theme", "system");
    var dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    d.dataset.theme = dark ? "dark" : "light";
    d.dataset.accent = get("cf-accent", "violet");
  }
  apply();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", apply);
  window.cfTheme = {
    get: function () { return { theme: get("cf-theme", "system"), accent: get("cf-accent", "violet") }; },
    set: function (t, a) { if (t) put("cf-theme", t); if (a) put("cf-accent", a); apply(); }
  };
})();