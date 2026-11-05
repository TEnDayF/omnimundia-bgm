(() => {
  // src/popup.ts
  var $ = (id) => document.getElementById(id);
  var state = {};
  async function send(m) {
    const r = await chrome.runtime.sendMessage(m);
    if (!r.ok) throw Error(r.error);
    return r.data;
  }
  function render(s) {
    state = s;
    $("track").textContent = s.trackName || "\u672A\u64AD\u653E";
    $("status").textContent = s.status;
    $("error").textContent = s.error;
    $("reason").textContent = [s.moods.find((m) => m.id === s.decision?.mood)?.name, s.decision?.tags?.join(" \xB7 ")].filter(Boolean).join(" / ");
    $("enabled").textContent = s.enabled ? "\u5173\u95ED\u81EA\u52A8" : "\u5F00\u542F\u81EA\u52A8";
    $("paused").textContent = s.paused ? "\u6062\u590D" : "\u6682\u505C";
    $("lock").textContent = s.lockTrack ? "\u89E3\u9664\u66F2\u76EE\u9501\u5B9A" : "\u9501\u5B9A\u5F53\u524D\u66F2\u76EE";
    $("floating").checked = s.floating;
    if (document.activeElement !== $("volume")) $("volume").value = s.volume;
    if (!$("mood").options.length) $("mood").replaceChildren(new Option("\u81EA\u52A8\u60C5\u7EEA", ""), ...s.moods.filter((m) => !m.disabled).map((m) => new Option(m.name, m.id)));
    $("mood").value = s.lockMood;
    $("usage").textContent = `\u5F53\u524D\u540E\u7AEF\uFF1A${s.backend} \xB7 \u672C\u4F1A\u8BDD\u7F13\u5B58\u547D\u4E2D ${s.cacheHits} \u6B21`;
  }
  async function command(command2, value) {
    try {
      render(await send({ type: "control", command: command2, value }));
    } catch (e) {
      $("error").textContent = e.message;
    }
  }
  $("enabled").onclick = () => command("enabled", !state.enabled);
  $("paused").onclick = () => command("paused", !state.paused);
  $("next").onclick = () => command("next");
  $("retry").onclick = () => command("retry");
  $("lock").onclick = () => command("lockTrack", !state.lockTrack);
  $("mood").onchange = () => command("lockMood", $("mood").value);
  $("volume").onchange = () => command("volume", +$("volume").value);
  $("floating").onchange = () => command("floating", $("floating").checked);
  $("settings").onclick = () => chrome.runtime.openOptionsPage();
  async function refresh() {
    try {
      render(await send({ type: "state" }));
    } catch (e) {
      $("error").textContent = e.message;
    }
  }
  void refresh();
  setInterval(refresh, 1e3);
  $("start").onclick = () => command("start");
  $("diagnose").onclick = () => chrome.runtime.openOptionsPage();
})();
