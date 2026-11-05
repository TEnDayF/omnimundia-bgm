(() => {
  // src/db.ts
  var pending;
  function open() {
    return pending ??= new Promise((resolve, reject) => {
      const r = indexedDB.open("omni-bgm", 1);
      r.onupgradeneeded = () => {
        for (const s of ["tracks", "blobs", "cache"]) r.result.createObjectStore(s, { keyPath: "id" });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function get(store, id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const r = db.transaction(store).objectStore(store).get(id);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  // src/offscreen.ts
  var current = null;
  var outgoing = null;
  var until = 0;
  var master = 0.55;
  var generation = 0;
  var ramp = null;
  function dispose(a) {
    if (a) {
      a.audio.pause();
      URL.revokeObjectURL(a.url);
    }
  }
  function notify(event) {
    if (current) void chrome.runtime.sendMessage({ type: "audioEvent", event, id: current.id, position: current.audio.currentTime }).catch(() => {
    });
  }
  function pause() {
    until = 0;
    generation++;
    clearInterval(ramp);
    dispose(outgoing);
    outgoing = null;
    if (current) {
      current.audio.pause();
      current.audio.volume = Math.min(1, master * current.gain);
      notify("position");
    }
  }
  async function play(m) {
    const gen = ++generation;
    until = m.until;
    master = m.volume;
    if (current?.id === m.id && !m.restart) {
      current.gain = m.gain;
      current.audio.volume = Math.min(1, master * m.gain);
      if (current.audio.paused) await current.audio.play();
      return;
    }
    const item = await get("blobs", m.id);
    if (gen !== generation || Date.now() > until) return;
    if (!item?.blob) throw Error("\u97F3\u9891\u4E0D\u5B58\u5728");
    clearInterval(ramp);
    dispose(outgoing);
    outgoing = current;
    const a = new Audio();
    const url = URL.createObjectURL(item.blob);
    a.src = url;
    a.preload = "auto";
    current = { id: m.id, audio: a, url, gain: m.gain };
    a.volume = m.fade && outgoing ? 0 : Math.min(1, master * m.gain);
    a.addEventListener("loadedmetadata", () => {
      if (m.position > 0 && m.position < a.duration) a.currentTime = m.position;
    }, { once: true });
    a.addEventListener("ended", () => {
      if (current?.audio === a) notify("ended");
    });
    a.addEventListener("error", () => notify("error"));
    try {
      await a.play();
    } catch (e) {
      notify("error");
      throw e;
    }
    if (gen !== generation || Date.now() > until) {
      a.pause();
      return;
    }
    if (outgoing && m.fade) {
      const start = Date.now(), old = outgoing, initial = old.audio.volume;
      ramp = setInterval(() => {
        const p = Math.min(1, (Date.now() - start) / (m.fade * 1e3));
        a.volume = Math.min(1, master * m.gain * p);
        old.audio.volume = initial * (1 - p);
        if (p === 1) {
          clearInterval(ramp);
          dispose(old);
          if (outgoing === old) outgoing = null;
        }
      }, 40);
    } else {
      dispose(outgoing);
      outgoing = null;
    }
  }
  chrome.runtime.onMessage.addListener((m, sender, respond) => {
    if (m.target !== "audio") return;
    const run = async () => {
      if (m.command === "play") await play(m);
      if (m.command === "pause") pause();
      if (m.command === "stop") {
        pause();
        dispose(current);
        current = null;
      }
      if (m.command === "lease") {
        until = m.until;
        master = m.volume;
        if (current) {
          if (!outgoing) current.audio.volume = Math.min(1, master * current.gain);
          if (current.audio.paused) await current.audio.play();
        }
      }
    };
    run().then(() => respond({ ok: true })).catch(() => respond({ ok: false }));
    return true;
  });
  setInterval(() => {
    if (until && Date.now() > until) pause();
  }, 250);
  setInterval(() => {
    if (current && !current.audio.paused) notify("position");
  }, 2e3);
})();
