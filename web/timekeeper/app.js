(function () {
  "use strict";

  // ── Configuration ──────────────────────────────────────────────
  const SHEET_URL = "https://script.google.com/macros/s/AKfycbzFGnBXjTkA059xDY87EJC5SeMsZ41Z_CuDiq_4ga0UmOCIeNH9Tip6WuPzrEnN55fS/exec"; // Paste your Google Apps Script web-app URL here
  const PROJECTS = ["Tracking", "LAYS", "Effects"];

  const QUEUE_KEY = "timekeeper_queue";
  const HISTORY_KEY = "timekeeper_history";
  const MAX_CHIPS = 5;

  // ── DOM refs ───────────────────────────────────────────────────
  const form = document.getElementById("entry-form");
  const projectEl = document.getElementById("project");
  const dateEl = document.getElementById("date");
  const startH = document.getElementById("start-h");
  const startM = document.getElementById("start-m");
  const endH = document.getElementById("end-h");
  const endM = document.getElementById("end-m");
  const descEl = document.getElementById("description");
  const chipsEl = document.getElementById("chips");
  const submitBtn = document.getElementById("submit-btn");
  const toastEl = document.getElementById("toast");

  // ── Populate project dropdown ──────────────────────────────────
  PROJECTS.forEach(function (name) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    projectEl.appendChild(opt);
  });

  // ── Default date to today ──────────────────────────────────────
  dateEl.value = new Date().toISOString().slice(0, 10);

  // ── Populate time dropdowns (hours 0-23, minutes 00/15/30/45) ─
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  [startH, endH].forEach(function (sel) {
    for (var h = 0; h < 24; h++) {
      var opt = document.createElement("option");
      opt.value = pad(h);
      opt.textContent = pad(h);
      sel.appendChild(opt);
    }
  });

  [startM, endM].forEach(function (sel) {
    [0, 15, 30, 45].forEach(function (m) {
      var opt = document.createElement("option");
      opt.value = pad(m);
      opt.textContent = pad(m);
      sel.appendChild(opt);
    });
  });

  function getTime(hSel, mSel) {
    return hSel.value + ":" + mSel.value;
  }

  function clearTime(hSel, mSel) {
    hSel.selectedIndex = 0;
    mSel.selectedIndex = 0;
  }

  // ── Activity history (per-project frequency map) ───────────────
  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || {};
    } catch (_) {
      return {};
    }
  }

  function saveHistory(hist) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    } catch (_) {}
  }

  function recordActivity(project, desc) {
    if (!desc) return;
    var hist = getHistory();
    if (!hist[project]) hist[project] = {};
    hist[project][desc] = (hist[project][desc] || 0) + 1;
    saveHistory(hist);
  }

  function topActivities(project) {
    var hist = getHistory();
    var map = hist[project] || {};
    return Object.entries(map)
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, MAX_CHIPS)
      .map(function (pair) { return pair[0]; });
  }

  // ── Render chips ───────────────────────────────────────────────
  function renderChips() {
    chipsEl.innerHTML = "";
    var activities = topActivities(projectEl.value);
    activities.forEach(function (text) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = text;
      btn.addEventListener("click", function () {
        descEl.value = text;
        descEl.focus();
      });
      chipsEl.appendChild(btn);
    });
  }

  projectEl.addEventListener("change", renderChips);
  renderChips();

  // ── Offline queue ──────────────────────────────────────────────
  function getQueue() {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
    } catch (_) {
      return [];
    }
  }

  function saveQueue(q) {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    } catch (_) {}
  }

  function enqueue(entry) {
    var q = getQueue();
    q.push(entry);
    saveQueue(q);
    updatePendingBadge();
  }

  function updatePendingBadge() {
    var q = getQueue();
    var badge = submitBtn.querySelector(".pending-badge");
    if (q.length === 0) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "pending-badge";
      submitBtn.appendChild(badge);
    }
    badge.textContent = " (" + q.length + " pending)";
  }

  async function postEntry(entry) {
    var res = await fetch(SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(entry),
      mode: "no-cors",
    });
    // no-cors means we can't read the response, but if fetch didn't throw
    // the request reached the server.
    return true;
  }

  async function flushQueue() {
    var q = getQueue();
    if (q.length === 0) return;
    var remaining = [];
    for (var i = 0; i < q.length; i++) {
      try {
        await postEntry(q[i]);
      } catch (_) {
        remaining.push(q[i]);
      }
    }
    saveQueue(remaining);
    updatePendingBadge();
  }

  // ── Toast ──────────────────────────────────────────────────────
  var toastTimer = null;
  function showToast(msg, isError) {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.toggle("error", !!isError);
    toastEl.classList.add("visible");
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("visible");
    }, 2400);
  }

  // ── Form submission ────────────────────────────────────────────
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    var entry = {
      project: projectEl.value,
      date: dateEl.value,
      start: getTime(startH, startM),
      end: getTime(endH, endM),
      description: descEl.value.trim(),
      submitted_at: new Date().toISOString(),
    };

    if (!entry.description) return;

    submitBtn.disabled = true;

    if (!SHEET_URL) {
      showToast("No SHEET_URL configured", true);
      submitBtn.disabled = false;
      return;
    }

    // Flush any queued entries first
    await flushQueue();

    try {
      await postEntry(entry);
      recordActivity(entry.project, entry.description);
      showToast("Logged!");
      descEl.value = "";
      clearTime(startH, startM);
      clearTime(endH, endM);
      renderChips();
    } catch (_) {
      enqueue(entry);
      recordActivity(entry.project, entry.description);
      showToast("Saved offline — will sync later", true);
      descEl.value = "";
      clearTime(startH, startM);
      clearTime(endH, endM);
      renderChips();
    }

    submitBtn.disabled = false;
  });

  // ── Init ───────────────────────────────────────────────────────
  updatePendingBadge();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
