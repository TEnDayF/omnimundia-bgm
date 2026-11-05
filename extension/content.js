(() => {
  // src/icons.ts
  var paths = {
    music: "M9 18V5l12-2v13M9 9l12-2M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Zm12-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z",
    dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    library: "M4 4v16M9 4v16M14 4v16M18 5l3 14",
    model: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
    sliders: "M4 3v7m0 4v7M12 3v11m0 4v3M20 3v3m0 4v11M1 10h6M9 14h6M17 6h6",
    archive: "M3 3h18v5H3zM5 8v13h14V8M9 12h6",
    minus: "M5 12h14",
    plus: "M12 5v14M5 12h14",
    close: "m6 6 12 12M6 18 18 6",
    play: "m8 5 11 7-11 7V5Z",
    pause: "M8 5v14M16 5v14",
    next: "m5 5 10 7-10 7V5Zm13 0v14",
    restore: "M3 10a9 9 0 1 1 2 8M3 3v7h7",
    chevron: "m9 5 7 7-7 7",
    check: "m5 12 4 4L19 6"
  };
  function icon(name) {
    return `<svg class="ui-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ? `<path d="${paths[name]}"/>` : ""}</svg>`;
  }

  // src/core.ts
  var MOODS = [["relax", "\u4F11\u95F2", "\u5B89\u5168\u3001\u5E73\u9759\u7684\u65E5\u5E38\u6D3B\u52A8"], ["explore", "\u63A2\u7D22", "\u65C5\u884C\u3001\u53D1\u73B0\u3001\u8C03\u67E5\u672A\u77E5\u73AF\u5883"], ["mystery", "\u795E\u79D8", "\u672A\u77E5\u79D8\u5BC6\u6216\u96BE\u4EE5\u89E3\u91CA\u7684\u5F02\u8C61"], ["tension", "\u7D27\u5F20", "\u5371\u9669\u903C\u8FD1\u3001\u6212\u5907\u3001\u5C1A\u672A\u8FDB\u5165\u5B9E\u9645\u6218\u6597"], ["battle", "\u6218\u6597", "\u6B63\u5728\u53D1\u751F\u7684\u6B63\u9762\u4EA4\u6218"], ["victory", "\u80DC\u5229", "\u5371\u9669\u89E3\u9664\u3001\u6210\u529F\u3001\u5E86\u795D"], ["sad", "\u60B2\u4F24", "\u5931\u843D\u3001\u54C0\u60BC\u3001\u79BB\u522B"], ["warm", "\u6E29\u60C5", "\u4EB2\u5BC6\u3001\u5B89\u6170\u3001\u53CB\u5584\u4EA4\u6D41"]].map(([id, name, description]) => ({ id, name, description }));

  // src/workflow.ts
  function clampPosition(pos, width, height, boxWidth, boxHeight) {
    const maxX = Math.max(0, width - boxWidth - 8), maxY = Math.max(0, height - boxHeight - 8);
    return { left: Math.max(Math.min(8, maxX), Math.min(maxX, (pos?.x ?? 1) * maxX)), top: Math.max(Math.min(8, maxY), Math.min(maxY, (pos?.y ?? 1) * maxY)) };
  }

  // src/content.ts
  (() => {
    const marker = "omni-bgm-host";
    if (document.getElementById(marker)) return;
    const host = document.createElement("div");
    host.id = marker;
    host.dataset.version = "1.4.1";
    document.documentElement.append(host);
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `<style>:host{all:initial;position:fixed;right:24px;bottom:28px;z-index:2147483600;font:13px/1.6 "Segoe UI","Microsoft YaHei",sans-serif;color:#edf2ee;color-scheme:dark}*{box-sizing:border-box}section{width:292px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;background:#171d19;border:1px solid #63796a;border-radius:12px;padding:16px;box-shadow:0 12px 32px #0006}header{display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:1px solid #35443a;color:#b8e2c1;cursor:grab}header strong{display:flex;align-items:center;gap:8px}.ui-icon{vertical-align:middle;flex:none}button,select{font:inherit;color:inherit;background:transparent;border:1px solid #63796a;border-radius:6px;padding:6px 10px;min-height:34px;cursor:pointer}button:hover{background:#242e27}button:disabled{opacity:.55}button:focus-visible,select:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid #b8e2c1;outline-offset:2px}header button{padding:5px 8px;border-color:transparent}header span{display:flex;gap:4px}.row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}p{margin:10px 0;overflow-wrap:anywhere}#track{font-size:16px;font-weight:600;margin:14px 0 8px}small{color:#b3c0b7}#status{display:block;margin:10px 0;font-size:12px}.error{color:#ffb5ac}.error:empty{display:none}input{width:100%;accent-color:#b8e2c1}select{max-width:100%;min-width:0;flex:1;background:#111713}.hidden{display:none!important}strong{font-weight:600}#compactPause{background:#b8e2c1;border-color:#b8e2c1;color:#14291b;flex:1}#compactNext{flex:1}#pause,#next{display:none}#body{padding-top:4px}#start{width:100%;margin:12px 0 8px}#settings{width:100%;margin-top:12px;border-color:#35443a;color:#b3c0b7}#resetPosition{font-size:12px;border-color:transparent;color:#b3c0b7}#retry{font-size:12px}::selection{background:#b8e2c1;color:#14291b}button{transition:background-color .16s ease-out}@media(prefers-reduced-motion:reduce){button{transition:none}}</style><section><header><strong>${icon("music")}\u968F\u5883\u914D\u4E50</strong><span><button id="fold" aria-label="\u5C55\u5F00\u64AD\u653E\u5668" aria-expanded="false">${icon("plus")}</button> <button id="hide" aria-label="\u9690\u85CF\u60AC\u6D6E\u64AD\u653E\u5668">${icon("close")}</button></span></header><p id="track">\u5C1A\u672A\u542F\u7528</p><div class="row"><button id="compactPause">\u6682\u505C</button><button id="compactNext">\u4E0B\u4E00\u9996</button></div><div id="body" class="hidden"><small id="status"></small><p id="error" class="error"></p><div class="row"><button id="enable">\u5F00\u542F</button><button id="pause">\u6682\u505C</button><button id="next">\u4E0B\u4E00\u9996</button><button id="retry" title="\u624B\u52A8\u53D1\u9001\u4E00\u6B21\u60C5\u5883\u5224\u65AD\u8BF7\u6C42">\u91CD\u5224 \xB7 1 \u6B21\u8BF7\u6C42</button></div><div class="row"><select id="mood" aria-label="\u9501\u5B9A\u60C5\u7EEA"><option value="">\u81EA\u52A8\u60C5\u7EEA</option></select><button id="lock">\u9501\u66F2</button></div><p><input id="volume" type="range" min="0" max="1" step="0.01" aria-label="\u97F3\u91CF"></p><button id="start" title="\u53D1\u9001\u5F53\u524D\u5B8C\u6574\u56DE\u5408\uFF1B\u7F13\u5B58\u547D\u4E2D\u4E0D\u8BA1\u65B0\u8BF7\u6C42">\u5F00\u59CB\u914D\u4E50</button><button id="resetPosition">\u91CD\u7F6E\u4F4D\u7F6E</button><button id="settings">\u66F2\u5E93\u4E0E\u8BBE\u7F6E \u2197</button></div></section>`;
    const $ = (id) => root.getElementById(id);
    let state = {}, controlError = "", folded = true, lastSig = "", changed = Date.now(), lastSent = "", lastBusy = 0, sending = false;
    const send = (m) => chrome.runtime.sendMessage(m);
    let pos, drag = null;
    function place() {
      if (drag) return;
      const box = host.getBoundingClientRect(), point = clampPosition(pos, innerWidth, innerHeight, box.width, box.height);
      host.style.right = "auto";
      host.style.bottom = "auto";
      host.style.left = point.left + "px";
      host.style.top = point.top + "px";
    }
    const panel = root.querySelector("section");
    panel.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button,input,select,textarea,a,label,summary")) return;
      const r = host.getBoundingClientRect();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: r.left, top: r.top, moved: false };
      panel.setPointerCapture?.(e.pointerId);
    });
    panel.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      e.preventDefault();
      panel.style.userSelect = "none";
      const box = host.getBoundingClientRect(), maxX = Math.max(0, innerWidth - box.width - 8), maxY = Math.max(0, innerHeight - box.height - 8);
      host.style.right = "auto";
      host.style.bottom = "auto";
      host.style.left = Math.max(0, Math.min(maxX, drag.left + dx)) + "px";
      host.style.top = Math.max(0, Math.min(maxY, drag.top + dy)) + "px";
    });
    function endDrag(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const moved = drag.moved;
      drag = null;
      panel.style.userSelect = "";
      if (moved) {
        const r = host.getBoundingClientRect();
        pos = { x: r.left / Math.max(1, innerWidth - r.width - 8), y: r.top / Math.max(1, innerHeight - r.height - 8) };
        void control("floatPosition", pos);
      }
      place();
    }
    panel.addEventListener("pointerup", endDrag);
    panel.addEventListener("pointercancel", endDrag);
    panel.addEventListener("lostpointercapture", endDrag);
    window.addEventListener("resize", place);
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(place).observe(panel);
    $("start").onclick = () => control("start");
    $("resetPosition").onclick = () => control("floatPosition", null);
    function setFolded(value) {
      folded = value;
      $("body").classList.toggle("hidden", folded);
      $("fold").innerHTML = icon(folded ? "plus" : "minus");
      $("fold").setAttribute("aria-expanded", String(!folded));
      $("fold").setAttribute("aria-label", folded ? "\u5C55\u5F00\u64AD\u653E\u5668" : "\u6298\u53E0\u64AD\u653E\u5668");
      place();
    }
    function showControlError(message) {
      controlError = message;
      $("error").textContent = message;
      setFolded(false);
    }
    async function control(command, value) {
      try {
        const r = await send({ type: "control", command, value });
        if (r.ok) {
          controlError = "";
          render(r.data);
        } else showControlError(r.error || "\u64CD\u4F5C\u672A\u5B8C\u6210\uFF0C\u8BF7\u91CD\u8BD5");
      } catch {
        showControlError("\u8FDE\u63A5\u4E2D\u65AD\uFF0C\u8BF7\u5237\u65B0\u6E38\u620F\u9875");
      }
    }
    $("fold").onclick = () => setFolded(!folded);
    $("compactPause").onclick = () => control("paused", !state.paused);
    $("compactNext").onclick = () => control("next");
    $("hide").onclick = () => control("floating", false);
    $("enable").onclick = () => control("enabled", !state.enabled);
    $("pause").onclick = () => control("paused", !state.paused);
    $("next").onclick = () => control("next");
    $("retry").onclick = () => control("retry");
    $("lock").onclick = () => control("lockTrack", !state.lockTrack);
    $("mood").onchange = () => control("lockMood", $("mood").value);
    $("volume").onchange = () => control("volume", +$("volume").value);
    $("settings").onclick = () => send({ type: "openSettings" });
    function render(s) {
      if (!s) return;
      state = s;
      if (!drag) pos = s.floatPosition;
      host.style.display = s.floating && /^\/game\//.test(location.pathname) ? "block" : "none";
      $("track").textContent = s.trackName || "\u672A\u64AD\u653E";
      $("status").textContent = [s.status, s.moods?.find((m) => m.id === s.decision?.mood)?.name, s.decision?.tags?.join(" \xB7 ")].filter(Boolean).join(" / ");
      $("error").textContent = controlError || s.error || "";
      $("enable").textContent = s.enabled ? "\u5173\u95ED\u81EA\u52A8" : "\u5F00\u542F\u81EA\u52A8";
      $("pause").textContent = s.paused ? "\u6062\u590D" : "\u6682\u505C";
      $("compactPause").textContent = s.paused ? "\u6062\u590D" : "\u6682\u505C";
      $("lock").textContent = s.lockTrack ? "\u89E3\u9501\u66F2\u76EE" : "\u9501\u66F2";
      if (root.activeElement !== $("volume")) $("volume").value = s.volume;
      const signature = JSON.stringify(s.moods);
      if ($("mood").dataset.sig !== signature) {
        $("mood").replaceChildren(new Option("\u81EA\u52A8\u60C5\u7EEA", ""), ...s.moods.filter((m) => !m.disabled).map((m) => new Option(m.name, m.id)));
        $("mood").dataset.sig = signature;
      }
      $("mood").value = s.lockMood || "";
      place();
    }
    function snapshot() {
      if (document.visibilityState === "hidden") return { game: /^\/game\/[^/]+/.test(location.pathname), visible: false };
      const scene = document.querySelector(".scene-content > .scene");
      const counter = document.querySelector(".page-status")?.textContent || "";
      const match = counter.match(/第\s*(\d+)\s*\/\s*(\d+)\s*回合/);
      const input = document.querySelector('textarea[placeholder="\u5728\u8FD9\u91CC\u81EA\u5B9A\u4E49\u4F60\u7684\u884C\u52A8..."]');
      const game = !!scene && !!match && !!input && /^\/game\/[^/]+/.test(location.pathname);
      if (!game) return { game: false, visible: document.visibilityState === "visible" };
      const buttons = [...document.querySelectorAll("button")].filter((x) => x.getClientRects().length);
      const submit = buttons.find((b) => /^提交$/.test(b.textContent.trim()));
      const busy = !submit || submit.disabled || submit.getAttribute("aria-disabled") === "true" || submit.classList.contains("is-loading") || buttons.some((b) => /^(停止生成|停止推演|取消生成)$/.test(b.textContent.trim()));
      if (busy) lastBusy = Date.now();
      const worldNode = [...document.querySelectorAll("span")].find((x) => /^世界线「[^」]+」$/.test(x.textContent.trim()));
      const world = worldNode?.textContent.trim() || "unknown";
      const text = scene.innerText.trim();
      const turn = +match[1];
      const gameId = location.pathname.split("/")[2];
      const sig = JSON.stringify([gameId, world, turn, text]);
      if (sig !== lastSig) {
        lastSig = sig;
        changed = Date.now();
      }
      const ready = !busy && Date.now() - changed > 2500 && Date.now() - lastBusy > 1e3 && text.length > 10;
      const context = turn === +match[2] ? [...document.querySelectorAll("#pane-player-entity li")].filter((e) => ["\u4F4D\u7F6E", "\u5F53\u524D\u76EE\u6807", "\u77ED\u671F\u76EE\u6807"].includes(e.querySelector(".item-name")?.textContent.trim())).map((e) => e.querySelector(".item-name")?.textContent + ":" + e.querySelector(".item-value")?.textContent).join("\uFF1B").slice(0, 600) : "";
      const sceneData = { text, world, turn, total: +match[2], gameId, context, ready, title: document.querySelector("h1")?.textContent?.trim().slice(0, 80) || "Omnimundia" };
      return { game: true, visible: document.visibilityState === "visible", scene: sceneData };
    }
    async function tick() {
      if (sending) return;
      sending = true;
      try {
        const data = snapshot();
        const sig = JSON.stringify(data.scene);
        const msg = { type: "heartbeat", game: data.game, visible: data.visible };
        if (data.visible && sig !== lastSent) {
          msg.scene = data.scene || { ready: false };
          lastSent = sig;
        }
        const r = await send(msg);
        if (r.ok) {
          render(r.data);
          if (r.data.needScene) lastSent = "";
        }
      } catch {
        host.style.display = /^\/game\//.test(location.pathname) ? "block" : "none";
        $("track").textContent = "\u6269\u5C55\u8FDE\u63A5\u5DF2\u65AD\u5F00";
        $("status").textContent = "\u66F4\u65B0\u6269\u5C55\u540E\u8BF7\u5237\u65B0\u6E38\u620F\u6807\u7B7E\u9875";
        $("body").classList.remove("hidden");
      } finally {
        sending = false;
      }
    }
    setInterval(tick, 1e3);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pagehide", () => send({ type: "heartbeat", game: false, visible: false }).catch(() => {
    }));
    void tick();
  })();
})();
