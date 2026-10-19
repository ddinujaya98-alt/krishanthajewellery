/* ============================================================
   PORTFOLIO — HIDDEN ADMIN PANEL
   Gate: triple-click (or focus + Enter) the footer credit line.
   Handles: security-key setup/login, project CRUD (including the
   built-in samples), contact messages, local analytics (page
   views with dates), account name, backup.
   Everything lives in localStorage — no server, no dependencies.
   Loaded BEFORE main.js so injected project cards exist when
   main.js binds filters and scroll reveals.
   ============================================================ */
(function () {
  "use strict";

  /* ----------------------------------------------------------
     1. Storage helpers (safe — degrades if storage is blocked)
     ---------------------------------------------------------- */
  var LS = {
    key: "kb_admin_key",
    projects: "kb_admin_projects",
    hidden: "kb_admin_project_hidden",
    messages: "kb_admin_messages",
    account: "kb_admin_account",
    stats: "kb_admin_stats",
    templates: "kb_admin_hide_templates"
  };
  var SESSION = "kb_admin_session";
  var FLASH = "kb_admin_flash";

  // Default unlock key, stored ONLY as a hash — the plain text is never
  // written into the page, the DOM, or this file. Two digests are kept so
  // the same key verifies in secure contexts (SHA-256) and file:// (fallback).
  var DEFAULT_HASH = {
    s2: "02b2132c4a389e4456fe85565ac22689a028b70020a7b0260daac0b95a3c9954",
    f1: "e3de728c0757f47ce48986f0eb366708"
  };
  var KEY_MAX = 20; // short keys only

  var storageOK = (function () {
    try {
      window.localStorage.setItem("kb_probe", "1");
      window.localStorage.removeItem("kb_probe");
      return true;
    } catch (e) {
      return false;
    }
  })();

  function readRaw(store, k) {
    try {
      return store.getItem(k);
    } catch (e) {
      return null;
    }
  }

  function load(k, fallback) {
    if (!storageOK) return fallback;
    var raw = readRaw(window.localStorage, k);
    if (raw === null) return fallback;
    try {
      var v = JSON.parse(raw);
      return v === null || v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function save(k, value) {
    if (!storageOK) return false;
    try {
      window.localStorage.setItem(k, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function drop(k) {
    if (!storageOK) return;
    try {
      window.localStorage.removeItem(k);
    } catch (e) {}
  }

  /* ----------------------------------------------------------
     2. Security key — hashed, never stored in plain text
     ---------------------------------------------------------- */
  function toHex(buf) {
    var v = new Uint8Array(buf);
    var out = "";
    for (var i = 0; i < v.length; i++) {
      out += ("0" + v[i].toString(16)).slice(-2);
    }
    return out;
  }

  // Fallback for non-secure contexts (e.g. file://) where
  // crypto.subtle is unavailable.
  function fbHash(str) {
    var h1 = 0x811c9dc5;
    var h2 = 0x01000193;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 = ((h1 ^ c) * 16777619) >>> 0;
      h2 = (h2 + c + i) >>> 0;
      h2 = ((h2 << 5) ^ (h2 >>> 3)) >>> 0;
    }
    var parts = [h1, h2, (h1 ^ h2) >>> 0, (h1 + h2) >>> 0];
    var out = "";
    for (var p = 0; p < parts.length; p++) {
      out += ("00000000" + parts[p].toString(16)).slice(-8);
    }
    return out;
  }

  function hashWith(alg, str) {
    // NOTE: hashKey() stores the raw hex digest (no prefix), so this must
    // return the same shape or every comparison would fail.
    if (alg === "f1") return Promise.resolve(fbHash(str));
    var subtle =
      window.crypto && window.crypto.subtle ? window.crypto.subtle : null;
    if (!subtle || !subtle.digest) return Promise.resolve(fbHash(str));
    try {
      var data = new TextEncoder().encode(str);
      return subtle.digest("SHA-256", data).then(
        function (buf) {
          return toHex(buf);
        },
        function () {
          return fbHash(str);
        }
      );
    } catch (e) {
      return Promise.resolve(fbHash(str));
    }
  }

  // Store a marker so we always re-hash with the same algorithm.
  function hashKey(str) {
    var subtle =
      window.crypto && window.crypto.subtle ? window.crypto.subtle : null;
    if (subtle && subtle.digest) {
      try {
        var data = new TextEncoder().encode(str);
        return subtle.digest("SHA-256", data).then(
          function (buf) {
            return { alg: "s2", hash: toHex(buf) };
          },
          function () {
            return { alg: "f1", hash: fbHash(str) };
          }
        );
      } catch (e) {}
    }
    return Promise.resolve({ alg: "f1", hash: fbHash(str) });
  }

  // The hash record matching the current context's hashing ability.
  function defaultKeyRecord() {
    var subtle =
      window.crypto && window.crypto.subtle ? window.crypto.subtle : null;
    if (subtle && subtle.digest) return { alg: "s2", hash: DEFAULT_HASH.s2 };
    return { alg: "f1", hash: DEFAULT_HASH.f1 };
  }

  function hasKey() {
    var rec = load(LS.key, null);
    return !!(rec && rec.hash);
  }

  // Guarantee a key record exists. There is no "set a key" screen any more —
  // the panel ships with a built-in key and never displays it.
  function ensureKey() {
    if (!storageOK) return;
    if (!hasKey()) save(LS.key, defaultKeyRecord());
  }

  // Unlock state lives in memory only — never persisted. Closing the panel
  // (or reloading) drops it, so the key is required on every fresh open.
  var unlocked = false;

  function sessionValid() {
    return unlocked === true;
  }

  function startSession() {
    unlocked = true;
  }

  function endSession() {
    unlocked = false;
    drop(SESSION); // clear any session saved by an older version
  }

  /* ----------------------------------------------------------
     3. Analytics — page views with dates (local to this browser)
     ---------------------------------------------------------- */
  function pageName() {
    var p = window.location.pathname.split("/").pop();
    return p === "" ? "index.html" : p;
  }

  function todayKey(ts) {
    var d = new Date(ts);
    var m = ("0" + (d.getMonth() + 1)).slice(-2);
    var day = ("0" + d.getDate()).slice(-2);
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function fmtDateTime(ts) {
    var d = new Date(ts);
    var h = ("0" + d.getHours()).slice(-2);
    var min = ("0" + d.getMinutes()).slice(-2);
    return todayKey(ts) + " " + h + ":" + min;
  }

  function trackView() {
    if (!storageOK) return;
    var now = Date.now();
    var s = load(LS.stats, null) || { total: 0, pages: {}, dates: {}, recent: [] };
    var page = pageName();

    s.total = (s.total || 0) + 1;
    s.pages = s.pages || {};
    s.pages[page] = (s.pages[page] || 0) + 1;
    s.dates = s.dates || {};
    var dk = todayKey(now);
    s.dates[dk] = (s.dates[dk] || 0) + 1;
    s.recent = s.recent || [];
    s.recent.unshift({ p: page, t: now });
    if (s.recent.length > 60) s.recent.length = 60;
    s.last = now;
    save(LS.stats, s);
  }

  /* ----------------------------------------------------------
     4. Projects — the built-in samples live in js/projects-data.js.
        Editing or deleting one writes an override into localStorage,
        so nothing in the HTML has to be touched by hand.
     ---------------------------------------------------------- */
  var DATA = window.KB_PROJECTS;

  var CATS = (DATA && DATA.CATS) || [
    { id: "bespoke", label: "Bespoke" },
    { id: "bridal", label: "Rings & Bridal" },
    { id: "stone", label: "Stone Setting" },
    { id: "repair", label: "Repairs" }
  ];

  var PRESETS = [
    { id: "ember", name: "Gold", a: "rgba(255,104,30,.42)", b: "rgba(122,58,18,.5)", art: "ring" },
    { id: "cream", name: "Pearl", a: "rgba(243,223,201,.3)", b: "rgba(255,104,30,.28)", art: "bars" },
    { id: "sunset", name: "Rose", a: "rgba(255,139,70,.36)", b: "rgba(36,22,20,.85)", art: "ring" },
    { id: "deep", name: "Bronze", a: "rgba(255,104,30,.3)", b: "rgba(90,40,20,.6)", art: "bars" },
    { id: "custom", name: "Custom", a: "rgba(255,104,30,.42)", b: "rgba(36,22,20,.7)", art: "ring" }
  ];

  function esc(str) {
    return String(str === null || str === undefined ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function uid() {
    return "p" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  }

  function getProjects() {
    var list = load(LS.projects, []);
    return Array.isArray(list) ? list : [];
  }

  function setProjects(list) {
    save(LS.projects, list);
  }

  // Everything the site shows: built-ins (with any edits) + new projects.
  function allProjects() {
    return DATA ? DATA.list() : getProjects();
  }

  function isSample(id) {
    return !!(DATA && DATA.baseById(id));
  }

  function hiddenSamples() {
    var list = DATA ? DATA.hiddenIds() : [];
    return Array.isArray(list) ? list : [];
  }

  function setHiddenSamples(list) {
    if (DATA) DATA.setHiddenIds(list);
  }

  function renderGrid() {
    if (DATA) DATA.renderGrid();
  }

  function catLabel(ids) {
    var names = [];
    for (var i = 0; i < CATS.length; i++) {
      if (ids.indexOf(CATS[i].id) !== -1) names.push(CATS[i].label);
    }
    if (!names.length) return "Commission";
    if (names.length === 1) return names[0] + " Commission";
    return names.slice(0, -1).join(", ") + " & " + names[names.length - 1] + " Commission";
  }

  // Card markup, grid reconciliation and the "hide samples" state all
  // live in js/projects-data.js so the grid and the detail page never
  // disagree about what a project looks like.

  /* ----------------------------------------------------------
     4b. Contact messages (saved by the contact form, shown here)
     ---------------------------------------------------------- */
  function getMessages() {
    var list = load(LS.messages, []);
    return Array.isArray(list) ? list : [];
  }

  function setMessages(list) {
    return save(LS.messages, list);
  }

  function logMessage(data) {
    if (!storageOK || !data) return;
    var msg = {
      id: "m" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      name: String(data.name || "").slice(0, 80),
      email: String(data.email || "").slice(0, 120),
      service: String(data.service || "").slice(0, 80),
      message: String(data.message || "").slice(0, 4000),
      date: Date.now()
    };
    if (!msg.name && !msg.email && !msg.message) return;
    var list = getMessages();
    list.unshift(msg);
    if (list.length > 200) list.length = 200;
    setMessages(list);
  }

  /* ----------------------------------------------------------
     5. Account name drives the footer credit line
     ---------------------------------------------------------- */
  function accountName() {
    var n = load(LS.account, null);
    return typeof n === "string" && n.trim() ? n : "Krishantha Balacharige";
  }

  function applyAccount() {
    var nodes = document.querySelectorAll("[data-admin-access]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = "Powered By " + accountName();
    }
    var brandName = document.getElementById("adm-brand-name");
    if (brandName) brandName.textContent = accountName();
  }

  /* ----------------------------------------------------------
     6. Gate — triple-click the footer credit
     ---------------------------------------------------------- */
  var credits = document.querySelectorAll("[data-admin-access]");
  var clicks = [];

  function gateOpen() {
    openPanel();
  }

  for (var ci = 0; ci < credits.length; ci++) {
    var node = credits[ci];
    node.setAttribute("tabindex", "0");
    node.setAttribute("role", "button");
    node.setAttribute("title", "Powered By " + accountName());

    node.addEventListener("click", function () {
      var now = Date.now();
      clicks.push(now);
      clicks = clicks.filter(function (t) {
        return now - t < 900;
      });
      if (clicks.length >= 3) {
        clicks = [];
        gateOpen();
      }
    });

    node.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        clicks = [];
        gateOpen();
      }
    });
  }

  /* ----------------------------------------------------------
     7. Panel shell
     ---------------------------------------------------------- */
  var overlay = null;
  var lastFocus = null;

  function buildShell() {
    if (overlay) return;
    var wrap = document.createElement("div");
    wrap.className = "adm-overlay";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="adm-panel" role="dialog" aria-modal="true" aria-label="Admin panel">' +
        '<header class="adm-head">' +
          '<div class="adm-brand">' +
            '<img class="adm-brand-mark" src="assets/kb-logo-monogram-clean.webp?v=3" alt="" width="506" height="512" aria-hidden="true">' +
            '<span class="adm-brand-text">' +
              '<strong id="adm-brand-name">' + esc(accountName()) + '</strong>' +
              '<em>Admin Panel</em>' +
            '</span>' +
          "</div>" +
          '<button class="adm-close" type="button" aria-label="Close admin panel">✕</button>' +
        "</header>" +
        '<div class="adm-body">' +
          '<div class="adm-auth" id="adm-auth"></div>' +
          '<div class="adm-app" id="adm-app" hidden>' +
            '<nav class="adm-tabs" role="tablist">' +
              '<button class="adm-tab is-active" type="button" role="tab" aria-selected="true" data-view="overview">Overview</button>' +
              '<button class="adm-tab" type="button" role="tab" aria-selected="false" data-view="projects">Projects</button>' +
              '<button class="adm-tab" type="button" role="tab" aria-selected="false" data-view="messages">Messages<span class="adm-count" data-msg-count hidden></span></button>' +
              '<button class="adm-tab" type="button" role="tab" aria-selected="false" data-view="settings">Settings</button>' +
            "</nav>" +
            '<div class="adm-view" id="adm-view"></div>' +
          "</div>" +
        "</div>" +
      "</div>";
    document.body.appendChild(wrap);
    overlay = wrap;

    wrap.querySelector(".adm-close").addEventListener("click", closePanel);
    wrap.addEventListener("mousedown", function (e) {
      if (e.target === wrap) closePanel();
    });

    var tabs = wrap.querySelectorAll(".adm-tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener("click", function () {
        showView(this.getAttribute("data-view"));
      });
    }

    // Delegated listeners bound ONCE — the #adm-view element is reused
    // across tab renders, so binding per-render would stack duplicates.
    var view = wrap.querySelector("#adm-view");
    view.addEventListener("click", onViewClick);
    view.addEventListener("change", onViewChange);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay && !overlay.hidden) closePanel();
      if (e.key === "Tab" && overlay && !overlay.hidden) trapFocus(e);
    });
  }

  function trapFocus(e) {
    var f = overlay.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    var vis = [];
    for (var i = 0; i < f.length; i++) {
      if (!f[i].disabled && f[i].offsetParent !== null) vis.push(f[i]);
    }
    if (!vis.length) return;
    var first = vis[0];
    var last = vis[vis.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function openPanel() {
    buildShell();
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.documentElement.classList.add("adm-open");
    document.body.style.overflow = "hidden";

    if (!storageOK) {
      renderBlocked();
      return;
    }
    ensureKey();
    if (sessionValid()) {
      renderApp();
      return;
    }
    renderLogin();
  }

  function closePanel() {
    if (!overlay) return;
    overlay.hidden = true;
    endSession(); // require the key again next time the panel is opened
    document.documentElement.classList.remove("adm-open");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ----------------------------------------------------------
     8. Auth views (setup / login / blocked)
     ---------------------------------------------------------- */
  function authBox(html) {
    var box = document.getElementById("adm-auth");
    var app = document.getElementById("adm-app");
    box.hidden = false;
    app.hidden = true;
    box.innerHTML = html;
    return box;
  }

  function renderBlocked() {
    authBox(
      '<div class="adm-auth-inner">' +
        '<span class="adm-lock" aria-hidden="true">!</span>' +
        "<h3>Storage unavailable</h3>" +
        '<p class="adm-note">This browser is blocking local storage (often private/incognito mode), so the admin panel cannot save projects, messages or keys. Reopen the site in a normal window.</p>' +
        '<button class="btn btn-ghost" type="button" data-act="close">Close</button>' +
      "</div>"
    );
    bindAuth();
  }

  function renderLogin() {
    authBox(
      '<div class="adm-auth-inner">' +
        '<span class="adm-lock" aria-hidden="true">🔐</span>' +
        "<h3>Enter security key</h3>" +
        '<p class="adm-note">This area is protected. Enter your key to unlock the admin panel.</p>' +
        '<div class="field"><label for="adm-key">Security key</label>' +
        '<input type="password" id="adm-key" maxlength="' + KEY_MAX + '" autocomplete="off" placeholder="Enter your key"></div>' +
        '<button class="btn btn-primary" type="button" data-act="login">Unlock panel</button>' +
        '<p class="adm-err" id="adm-err" hidden></p>' +
        '<p class="adm-note adm-small">Lost your key? You can reset it below, but that erases saved projects, messages and stats on this browser.</p>' +
        '<button class="btn-text" type="button" data-act="reset">Reset access</button>' +
      "</div>"
    );
    bindAuth();

    var input = document.getElementById("adm-key");
    if (input) input.focus();
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") doLogin();
    });
  }

  function authError(msg) {
    var el = document.getElementById("adm-err");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  function bindAuth() {
    var box = document.getElementById("adm-auth");
    if (!box) return;
    box.addEventListener("click", onAuthClick);
  }

  function onAuthClick(e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var act = btn.getAttribute("data-act");

    if (act === "close") {
      closePanel();
    } else if (act === "login") {
      doLogin();
    } else if (act === "reset") {
      if (
        window.confirm(
          "Reset the admin key?\n\nThis clears the saved key, projects and analytics on THIS browser and restores the built-in key. Your HTML files are not affected."
        )
      ) {
        drop(LS.key);
        drop(LS.projects);
        drop(LS.hidden);
        drop(LS.messages);
        drop(LS.stats);
        drop(LS.account);
        endSession();
        applyAccount();
        ensureKey();
        renderLogin();
      }
    }
  }

  function doLogin() {
    var input = document.getElementById("adm-key");
    ensureKey();
    var rec = load(LS.key, null);
    if (!rec || !rec.hash) {
      authError("This browser cannot store the key right now. Please try again in a normal window.");
      return;
    }
    var val = (input.value || "").trim();
    if (!val) {
      authError("Please enter your security key.");
      return;
    }
    hashWith(rec.alg, val).then(function (h) {
      if (h === rec.hash) {
        startSession();
        renderApp();
      } else {
        authError("That key is not correct. Try again.");
        input.value = "";
        input.focus();
      }
    });
  }

  /* ----------------------------------------------------------
     9. App views
     ---------------------------------------------------------- */
  function renderApp() {
    var box = document.getElementById("adm-auth");
    var app = document.getElementById("adm-app");
    box.hidden = true;
    box.innerHTML = "";
    app.hidden = false;
    showView("overview");
  }

  function showView(name) {
    var tabs = document.querySelectorAll(".adm-tab");
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute("data-view") === name;
      tabs[i].classList.toggle("is-active", on);
      tabs[i].setAttribute("aria-selected", String(on));
    }
    var view = document.getElementById("adm-view");
    if (name === "projects") renderProjectsView(view);
    else if (name === "messages") renderMessagesView(view);
    else if (name === "settings") renderSettingsView(view);
    else renderOverview(view);
    updateMsgBadge();
  }

  function updateMsgBadge() {
    var badge = document.querySelector("[data-msg-count]");
    if (!badge) return;
    var n = getMessages().length;
    badge.textContent = n > 99 ? "99+" : n ? String(n) : "";
    badge.hidden = !n;
  }

  function stat(label, value) {
    return (
      '<div class="adm-stat"><span class="adm-stat-val">' + esc(value) +
      '</span><span class="adm-stat-key">' + esc(label) + "</span></div>"
    );
  }

  function renderOverview(view) {
    var s = load(LS.stats, null) || { total: 0, pages: {}, dates: {}, recent: [] };
    var projects = allProjects();
    var messages = getMessages();
    var dk = todayKey(Date.now());

    var pages = [];
    for (var p in s.pages) {
      if (Object.prototype.hasOwnProperty.call(s.pages, p)) pages.push([p, s.pages[p]]);
    }
    pages.sort(function (a, b) {
      return b[1] - a[1];
    });

    var pagesHtml = pages.length
      ? pages
          .map(function (row) {
            return (
              '<li><span>' + esc(row[0]) + "</span><b>" + row[1] + "</b></li>"
            );
          })
          .join("")
      : '<li class="adm-empty">No views recorded yet.</li>';

    var dates = [];
    for (var d in s.dates) {
      if (Object.prototype.hasOwnProperty.call(s.dates, d)) dates.push([d, s.dates[d]]);
    }
    dates.sort(function (a, b) {
      return a[0] < b[0] ? 1 : -1;
    });
    dates = dates.slice(0, 14);

    var datesHtml = dates.length
      ? dates
          .map(function (row) {
            return (
              '<li><span>' + esc(row[0]) + "</span><b>" + row[1] + "</b></li>"
            );
          })
          .join("")
      : '<li class="adm-empty">No dates yet.</li>';

    var recentHtml = (s.recent || []).length
      ? s.recent
          .slice(0, 12)
          .map(function (r) {
            return (
              "<li><span>" + esc(r.p) + "</span><b>" + fmtDateTime(r.t) + "</b></li>"
            );
          })
          .join("")
      : '<li class="adm-empty">Nothing recorded yet.</li>';

    view.innerHTML =
      '<h3 class="adm-h3">Overview</h3>' +
      '<p class="adm-note">These numbers are recorded in this browser only — they are local to this device, not server-wide analytics.</p>' +
      '<div class="adm-stats">' +
        stat("Total views", s.total || 0) +
        stat("Views today", s.dates[dk] || 0) +
        stat("Saved projects", projects.length) +
        stat("Messages", messages.length) +
        stat("Last view", s.last ? fmtDateTime(s.last) : "—") +
      "</div>" +
      '<div class="adm-cols">' +
        '<section class="adm-card"><h4>Views by date</h4><ul class="adm-list">' + datesHtml + "</ul></section>" +
        '<section class="adm-card"><h4>Views by page</h4><ul class="adm-list">' + pagesHtml + "</ul></section>" +
        '<section class="adm-card"><h4>Recent activity</h4><ul class="adm-list">' + recentHtml + "</ul></section>" +
      "</div>" +
      '<p class="adm-note adm-signed">' +
        '<img class="adm-brand-mark adm-brand-mark--sm" src="assets/kb-logo-monogram-clean.webp?v=3" alt="" width="506" height="512" aria-hidden="true">' +
        "<span>Signed in as <b>" + esc(accountName()) + "</b></span>" +
      "</p>";
  }

  /* ---------- projects tab ---------- */
  var editingId = null;

  function rgbaToHex(value) {
    if (!value) return "";
    var s = String(value).trim();
    var m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(s);
    if (m) {
      var pair = function (n) {
        var v = Math.max(0, Math.min(255, parseInt(n, 10)));
        return ("0" + v.toString(16)).slice(-2);
      };
      return "#" + pair(m[1]) + pair(m[2]) + pair(m[3]);
    }
    if (/^#[0-9a-f]{6}$/i.test(s)) return s;
    if (/^#[0-9a-f]{3}$/i.test(s)) {
      return "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    }
    return "";
  }

  function projectRow(p) {
    var sample = isSample(p.id);
    var edited = sample && DATA && DATA.hasOverride(p.id);
    var note = sample ? (edited ? " · edited sample" : " · sample") : "";
    var second = sample
      ? '<button class="btn-text is-danger" type="button" data-hide="' + esc(p.id) + '">Hide</button>'
      : '<button class="btn-text is-danger" type="button" data-del="' + esc(p.id) + '">Delete</button>';

    return (
      '<li class="adm-project">' +
        '<span class="adm-dot" style="background:' + esc(p.artA || "#ff681e") + '"></span>' +
        '<span class="adm-project-name">' + esc(p.title) +
          "<em>" + esc(p.catLabel) + note + "</em></span>" +
        '<span class="adm-project-meta">' + esc(p.updated ? todayKey(p.updated) : "") + "</span>" +
        '<button class="btn-text" type="button" data-edit="' + esc(p.id) + '">Edit</button>' +
        second +
      "</li>"
    );
  }

  function renderProjectsView(view) {
    var list = allProjects();
    var hidden = hiddenSamples();
    var hideAll = load(LS.templates, false) === true;

    var rows = list.length
      ? list.map(projectRow).join("")
      : '<li class="adm-empty">No projects yet — add your first one below.</li>';

    var hiddenHtml = "";
    if (hidden.length) {
      var names = hidden.map(function (id) {
        var base = DATA && DATA.baseById(id);
        return base ? base.title : id;
      });
      hiddenHtml =
        '<p class="adm-note adm-samples-off">Hidden: ' + esc(names.join(", ")) +
        ' <button class="btn-text" type="button" data-act="restore-samples">Restore</button></p>';
    }

    view.innerHTML =
      '<h3 class="adm-h3">Projects</h3>' +
      '<p class="adm-note">Projects live in this browser. Edits to the sample projects — and any new projects you add — appear on the <a href="projects.html">Projects page</a> straight away. Every project also gets its own detail page with a photo gallery.</p>' +
      '<section class="adm-card"><h4>Projects (' + list.length + ")</h4>" +
        '<ul class="adm-list">' + rows + "</ul>" +
        hiddenHtml +
        '<label class="adm-check"><input type="checkbox" id="adm-hide-tpl"' +
          (hideAll ? " checked" : "") +
          '> Hide the sample projects on the Projects page</label>' +
      "</section>" +
      '<section class="adm-card" id="adm-form-card">' + formHtml() + "</section>";

    syncCustom();
  }

  function formHtml() {
    var p = editingId && DATA ? DATA.get(editingId) : null;
    if (editingId && !p) p = findProject(editingId);

    var title = p ? p.title : "";
    var desc = p ? p.desc : "";
    var story = p && p.story ? p.story : "";
    var metal = p && p.metal ? p.metal : "";
    var stones = p && p.stones ? p.stones : "";
    var finish = p && p.finish ? p.finish : "";
    var timeframe = p && p.timeframe ? p.timeframe : "";
    var images = p && Array.isArray(p.images) ? p.images.join("\n") : "";
    var tags = p && Array.isArray(p.tags) ? p.tags.join(", ") : "";
    var link = p ? p.link || "" : "";
    var letter = p ? p.letter : "";
    var preset = p ? p.preset || "ember" : "ember";
    var cats = p && p.category ? p.category.split(" ") : ["bespoke"];

    var boxes = CATS.map(function (c) {
      var on = cats.indexOf(c.id) !== -1;
      return (
        '<label class="adm-chip"><input type="checkbox" name="adm-cat" value="' + c.id + '"' +
        (on ? " checked" : "") +
        "><span>" + c.label + "</span></label>"
      );
    }).join("");

    var presetBoxes = PRESETS.map(function (pr) {
      var on = preset === pr.id;
      return (
        '<label class="adm-swatch"><input type="radio" name="adm-preset" value="' + pr.id + '"' +
        (on ? " checked" : "") +
        '><span style="--sw-a:' + pr.a + "; --sw-b:" + pr.b + '"></span><em>' + pr.name + "</em></label>"
      );
    }).join("");

    var colA = rgbaToHex(p && p.artA) || "#ff681e";
    var colB = rgbaToHex(p && p.artB) || "#241614";

    return (
      "<h4>" + (p ? "Edit project" : "Add a project") + "</h4>" +
      '<div class="adm-form">' +
        '<div class="field"><label for="f-title">Project title <span class="req">*</span></label>' +
          '<input type="text" id="f-title" maxlength="60" placeholder="e.g. Aurelia Ring" value="' + esc(title) + '"></div>' +
        '<div class="field"><label for="f-letter">Artwork letter</label>' +
          '<input type="text" id="f-letter" maxlength="2" placeholder="Auto from title" value="' + esc(letter) + '"></div>' +
        '<div class="field field-wide"><label for="f-desc">Short description <span class="req">*</span></label>' +
          '<textarea id="f-desc" rows="2" maxlength="300" placeholder="One or two lines shown on the project card.">' + esc(desc) + "</textarea></div>" +
        '<div class="field field-wide"><label for="f-story">Full story (project page)</label>' +
          '<textarea id="f-story" rows="6" placeholder="The story behind the piece — how it was made, the stones, the fittings. Leave a blank line between paragraphs.">' + esc(story) + "</textarea></div>" +
        '<div class="field"><label for="f-metal">Metal</label>' +
          '<input type="text" id="f-metal" maxlength="60" placeholder="18k yellow gold" value="' + esc(metal) + '"></div>' +
        '<div class="field"><label for="f-stones">Stones</label>' +
          '<input type="text" id="f-stones" maxlength="80" placeholder="1.2ct Ceylon sapphire" value="' + esc(stones) + '"></div>' +
        '<div class="field"><label for="f-finish">Finish</label>' +
          '<input type="text" id="f-finish" maxlength="60" placeholder="Soft satin, hand-polished" value="' + esc(finish) + '"></div>' +
        '<div class="field"><label for="f-timeframe">Timeframe</label>' +
          '<input type="text" id="f-timeframe" maxlength="40" placeholder="6 weeks" value="' + esc(timeframe) + '"></div>' +
        '<div class="field field-wide"><label for="f-images">Photographs (one per line)</label>' +
          '<textarea id="f-images" rows="3" placeholder="assets/aurelia-1.jpg&#10;assets/aurelia-2.jpg&#10;https://…">' + esc(images) + "</textarea>" +
          '<p class="adm-note adm-small">Put the photo files in the <b>assets</b> folder and list each one here, one per line. They appear as a gallery on the project page.</p></div>' +
        '<div class="field field-wide"><label>Categories</label><div class="adm-chips">' + boxes + "</div></div>" +
        '<div class="field field-wide"><label>Artwork style</label><div class="adm-swatches">' + presetBoxes + "</div></div>" +
        '<div class="field field-wide" id="f-custom-wrap" hidden>' +
          '<label>Custom colours</label><div class="adm-two">' +
            '<input type="color" id="f-ca" value="' + colA + '" aria-label="Glow colour">' +
            '<input type="color" id="f-cb" value="' + colB + '" aria-label="Shadow colour">' +
          "</div></div>" +
        '<div class="field"><label for="f-tags">Tags</label>' +
          '<input type="text" id="f-tags" maxlength="80" placeholder="Gold, Sapphire, Hand Setting" value="' + esc(tags) + '"></div>' +
        '<div class="field"><label for="f-link">External link (optional)</label>' +
          '<input type="url" id="f-link" placeholder="https://…" value="' + esc(link) + '"></div>' +
      "</div>" +
      '<p class="adm-err" id="f-err" hidden></p>' +
      '<div class="adm-actions">' +
        '<button class="btn btn-primary" type="button" data-act="save">' + (p ? "Save changes" : "Add project") + "</button>" +
        (p && isSample(p.id) && DATA && DATA.hasOverride(p.id)
          ? '<button class="btn btn-ghost" type="button" data-act="reset-sample">Reset to sample</button>'
          : "") +
        (p ? '<button class="btn btn-ghost" type="button" data-act="cancel">Cancel</button>' : "") +
      "</div>"
    );
  }

  function findProject(id) {
    var list = getProjects();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function syncCustom() {
    var sel = document.querySelector('input[name="adm-preset"]:checked');
    var wrap = document.getElementById("f-custom-wrap");
    if (wrap) wrap.hidden = !sel || sel.value !== "custom";
  }

  function onViewChange(e) {
    var t = e.target;
    if (!t) return;
    if (t.name === "adm-preset") {
      syncCustom();
    } else if (t.id === "adm-hide-tpl") {
      save(LS.templates, t.checked);
      renderGrid();
    } else if (t.id === "s-file") {
      importFile(t);
    }
  }

  function onViewClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;

    // ---- project row actions ----
    if (t.hasAttribute("data-edit")) {
      editingId = t.getAttribute("data-edit");
      var card = document.getElementById("adm-form-card");
      if (card) {
        card.innerHTML = formHtml();
        card.scrollIntoView({ block: "nearest" });
      }
      return;
    }

    if (t.hasAttribute("data-del")) {
      var id = t.getAttribute("data-del");
      var item = findProject(id);
      if (item && window.confirm('Delete "' + item.title + '"?')) {
        setProjects(
          getProjects().filter(function (p) {
            return p.id !== id;
          })
        );
        if (editingId === id) editingId = null;
        renderGrid();
        showView("projects");
      }
      return;
    }

    // Hiding a built-in sample keeps it recoverable.
    if (t.hasAttribute("data-hide")) {
      var hideId = t.getAttribute("data-hide");
      var sample = DATA && DATA.baseById(hideId);
      if (sample && window.confirm('Hide "' + sample.title + '" from the Projects page?')) {
        var list = hiddenSamples().slice();
        if (list.indexOf(hideId) === -1) list.push(hideId);
        setHiddenSamples(list);
        if (editingId === hideId) editingId = null;
        renderGrid();
        showView("projects");
      }
      return;
    }

    // ---- data-act buttons ----
    var btn = t.closest("[data-act]");
    if (!btn) return;
    var act = btn.getAttribute("data-act");

    if (act === "cancel") {
      editingId = null;
      var fc = document.getElementById("adm-form-card");
      if (fc) {
        fc.innerHTML = formHtml();
        syncCustom();
      }
    } else if (act === "save") {
      saveProject();
    } else if (act === "reset-sample") {
      resetSample();
    } else if (act === "restore-samples") {
      setHiddenSamples([]);
      save(LS.templates, false);
      renderGrid();
      showView("projects");
    } else if (act === "del-msg") {
      var mid = btn.getAttribute("data-msg");
      setMessages(
        getMessages().filter(function (m) {
          return m.id !== mid;
        })
      );
      showView("messages");
    } else if (act === "clear-msgs") {
      if (window.confirm("Delete all saved messages? This cannot be undone.")) {
        setMessages([]);
        showView("messages");
      }
    } else if (act === "save-name") {
      var v = (document.getElementById("s-name").value || "").trim();
      if (!v) return;
      save(LS.account, v);
      applyAccount();
      btn.textContent = "Saved ✓";
      setTimeout(function () {
        btn.textContent = "Save name";
      }, 1600);
    } else if (act === "save-key") {
      changeKey();
    } else if (act === "export") {
      exportBackup();
    } else if (act === "import") {
      var f = document.getElementById("s-file");
      if (f) f.click();
    } else if (act === "logout") {
      endSession();
      closePanel();
    } else if (act === "wipe") {
      wipeAll();
    }
  }

  function importFile(file) {
    if (!file.files || !file.files[0]) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (data && Array.isArray(data.projects)) save(LS.projects, data.projects);
        if (data && Array.isArray(data.hidden)) save(LS.hidden, data.hidden);
        if (data && Array.isArray(data.messages)) save(LS.messages, data.messages);
        if (data && typeof data.account === "string") save(LS.account, data.account);
        if (data && data.templates !== undefined) save(LS.templates, !!data.templates);
        updateMsgBadge();
        renderGrid();
        applyAccount();
        window.alert("Backup imported.");
        showView("projects");
      } catch (err) {
        window.alert("That file could not be read as a backup.");
      }
    };
    reader.readAsText(file.files[0]);
    file.value = "";
  }

  function wipeAll() {
    if (
      !window.confirm(
        "Erase all admin data?\n\nThis deletes the security key, saved projects, messages, account name and stats from this browser. Your HTML/CSS/JS files are untouched."
      )
    ) {
      return;
    }
    drop(LS.key);
    drop(LS.projects);
    drop(LS.hidden);
    drop(LS.messages);
    drop(LS.stats);
    drop(LS.account);
    drop(LS.templates);
    endSession();
    applyAccount();
    renderGrid();
    ensureKey();
    renderLogin();
  }

  function formError(msg) {
    var el = document.getElementById("f-err");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  function hexToRgba(hex, alpha) {
    var h = hex.replace("#", "");
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    var n = parseInt(h, 16);
    if (isNaN(n)) return "rgba(255,104,30," + alpha + ")";
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + alpha + ")";
  }

  function saveProject() {
    var title = (document.getElementById("f-title").value || "").trim();
    var desc = (document.getElementById("f-desc").value || "").trim();

    if (!title) return formError("Please give the project a title.");
    if (!desc) return formError("Please add a short description.");

    var catBoxes = document.querySelectorAll('input[name="adm-cat"]:checked');
    var cats = [];
    for (var i = 0; i < catBoxes.length; i++) cats.push(catBoxes[i].value);
    if (!cats.length) cats = ["bespoke"];

    var presetSel = document.querySelector('input[name="adm-preset"]:checked');
    var presetId = presetSel ? presetSel.value : "ember";
    var preset = null;
    for (var j = 0; j < PRESETS.length; j++) {
      if (PRESETS[j].id === presetId) preset = PRESETS[j];
    }
    if (!preset) preset = PRESETS[0];

    var artA = preset.a;
    var artB = preset.b;
    if (preset.id === "custom") {
      artA = hexToRgba(document.getElementById("f-ca").value, 0.42);
      artB = hexToRgba(document.getElementById("f-cb").value, 0.7);
    }

    var letterRaw = (document.getElementById("f-letter").value || "").trim();
    var letter = (letterRaw || title).trim().charAt(0).toUpperCase();
    if (!letter) letter = "P";

    var tagsRaw = (document.getElementById("f-tags").value || "").trim();
    var tags = tagsRaw
      ? tagsRaw
          .split(",")
          .map(function (t) {
            return t.trim();
          })
          .filter(Boolean)
          .slice(0, 5)
      : [];

    var link = (document.getElementById("f-link").value || "").trim();
    if (link && !/^https?:\/\//i.test(link)) {
      link = "https://" + link;
    }

    var story = (document.getElementById("f-story").value || "").trim();
    var metal = (document.getElementById("f-metal").value || "").trim();
    var stones = (document.getElementById("f-stones").value || "").trim();
    var finish = (document.getElementById("f-finish").value || "").trim();
    var timeframe = (document.getElementById("f-timeframe").value || "").trim();
    var imagesRaw = (document.getElementById("f-images").value || "").trim();
    var images = DATA ? DATA.normaliseImages(imagesRaw) : [];

    var now = Date.now();
    var list = getProjects();
    var payload = {
      id: editingId || uid(),
      title: title,
      desc: desc,
      story: story,
      metal: metal,
      stones: stones,
      finish: finish,
      timeframe: timeframe,
      images: images,
      category: cats.join(" "),
      catLabel: catLabel(cats),
      tags: tags,
      link: link,
      letter: letter.toUpperCase(),
      preset: preset.id,
      artA: artA,
      artB: artB,
      art: preset.art,
      updated: now
    };

    if (editingId) {
      // Editing an existing project — a built-in sample or one added here.
      // Keeping the same id means a sample edit simply overrides it.
      var found = false;
      for (var k = 0; k < list.length; k++) {
        if (list[k].id === editingId) {
          payload.created = list[k].created || now;
          list[k] = payload;
          found = true;
        }
      }
      if (!found) {
        payload.created = now;
        list.unshift(payload);
      }
      editingId = null;
    } else {
      payload.created = now;
      list.unshift(payload);
    }

    setProjects(list);
    renderGrid();

    if (pageName() === "projects.html" || pageName() === "project.html") {
      try {
        window.sessionStorage.setItem(FLASH, "Project saved — refreshed.");
      } catch (e) {}
      window.location.reload();
      return;
    }
    showView("projects");
  }

  function resetSample() {
    if (!editingId || !isSample(editingId)) return;
    var base = DATA.baseById(editingId);
    if (!window.confirm('Reset "' + base.title + '" back to the original sample?')) return;
    setProjects(
      getProjects().filter(function (p) {
        return p.id !== editingId;
      })
    );
    editingId = null;
    renderGrid();
    showView("projects");
  }

  /* ---------- messages tab ---------- */
  function renderMessagesView(view) {
    var list = getMessages();

    var rows = list.length
      ? list
          .map(function (m) {
            var mail = m.email
              ? '<a class="adm-msg-mail" href="mailto:' + esc(m.email) + '">' + esc(m.email) + "</a>"
              : "";
            return (
              '<li class="adm-msg">' +
                '<div class="adm-msg-head">' +
                  '<b class="adm-msg-name">' + esc(m.name || "Someone") + "</b>" +
                  mail +
                  '<span class="adm-msg-date">' + esc(fmtDateTime(m.date)) + "</span>" +
                "</div>" +
                (m.service ? '<span class="adm-msg-service">' + esc(m.service) + "</span>" : "") +
                '<p class="adm-msg-body">' + esc(m.message) + "</p>" +
                '<button class="btn-text is-danger" type="button" data-act="del-msg" data-msg="' +
                  esc(m.id) + '">Delete</button>' +
              "</li>"
            );
          })
          .join("")
      : '<li class="adm-empty">No messages yet.</li>';

    view.innerHTML =
      '<h3 class="adm-h3">Messages</h3>' +
      '<p class="adm-note">Messages sent through the contact form are saved here, newest first. The form also opens the visitor\u2019s email app, so you still receive them by email.</p>' +
      '<p class="adm-note adm-small">Note: this site has no server, so a message is only stored in the browser it was sent from. To collect messages from visitors on their own devices, connect a form service or a small backend.</p>' +
      '<section class="adm-card"><h4>Saved messages (' + list.length + ")</h4>" +
        '<ul class="adm-list adm-msg-list">' + rows + "</ul>" +
        (list.length
          ? '<div class="adm-actions"><button class="btn btn-ghost is-danger" type="button" data-act="clear-msgs">Delete all messages</button></div>'
          : "") +
      "</section>";

    updateMsgBadge();
  }

  /* ---------- settings tab ---------- */
  function renderSettingsView(view) {
    var name = accountName();

    view.innerHTML =
      '<h3 class="adm-h3">Settings</h3>' +
      '<section class="adm-card">' +
        "<h4>Account</h4>" +
        '<div class="field"><label for="s-name">Account name</label>' +
          '<input type="text" id="s-name" maxlength="40" value="' + esc(name) + '">' +
          '<p class="adm-note adm-small">Shown as “Powered By …” on every page footer.</p></div>' +
        '<button class="btn btn-primary" type="button" data-act="save-name">Save name</button>' +
      "</section>" +
      '<section class="adm-card">' +
        "<h4>Security key</h4>" +
        '<p class="adm-note">Change the key used to unlock this panel. Use a short key (up to ' + KEY_MAX + ' characters). The new key is stored only as an unreadable hash and is never shown on screen.</p>' +
        '<div class="adm-form">' +
          '<div class="field"><label for="s-old">Current key</label>' +
            '<input type="password" id="s-old" maxlength="' + KEY_MAX + '" autocomplete="off"></div>' +
          '<div class="field"><label for="s-new">New key</label>' +
            '<input type="password" id="s-new" maxlength="' + KEY_MAX + '" autocomplete="off" placeholder="Type a short key"></div>' +
        "</div>" +
        '<button class="btn btn-ghost" type="button" data-act="save-key">Update key</button>' +
        '<p class="adm-err" id="s-err" hidden></p>' +
      "</section>" +
      '<section class="adm-card">' +
        "<h4>Backup</h4>" +
        '<p class="adm-note">Projects, messages and settings live in this browser only. Export a backup before clearing cookies or switching devices.</p>' +
        '<div class="adm-actions">' +
          '<button class="btn btn-ghost" type="button" data-act="export">Export backup</button>' +
          '<button class="btn btn-ghost" type="button" data-act="import">Import backup</button>' +
          '<input type="file" id="s-file" accept="application/json" hidden>' +
        "</div>" +
      "</section>" +
      '<section class="adm-card">' +
        "<h4>Session</h4>" +
        '<div class="adm-actions">' +
          '<button class="btn btn-ghost" type="button" data-act="logout">Log out</button>' +
          '<button class="btn btn-ghost is-danger" type="button" data-act="wipe">Erase all admin data</button>' +
        "</div>" +
      "</section>";
  }

  function changeKey() {
    var rec = load(LS.key, null);
    var old = (document.getElementById("s-old").value || "").trim();
    var nu = (document.getElementById("s-new").value || "").trim();
    var err = document.getElementById("s-err");
    var fail = function (msg) {
      err.textContent = msg;
      err.hidden = false;
    };

    if (!old) return fail("Enter your current key first.");
    if (!nu) return fail("Type the new key you want to use.");
    if (nu.length > KEY_MAX) return fail("Keep the new key to " + KEY_MAX + " characters or fewer.");

    var proceed = function () {
      hashKey(nu).then(function (next) {
        save(LS.key, next);
        startSession();
        document.getElementById("s-old").value = "";
        document.getElementById("s-new").value = "";
        err.hidden = true;
        window.alert("Security key updated.");
        showView("settings");
      });
    };

    if (rec && rec.alg && rec.hash) {
      hashWith(rec.alg, old).then(function (h) {
        if (h !== rec.hash) return fail("Current key is not correct.");
        proceed();
      });
    } else {
      proceed();
    }
  }

  function exportBackup() {
    var data = {
      exported: new Date().toISOString(),
      account: accountName(),
      templates: load(LS.templates, false) === true,
      projects: getProjects(),
      hidden: hiddenSamples(),
      messages: getMessages()
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "portfolio-admin-backup.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /* ----------------------------------------------------------
     11. Public hook — the contact form hands messages in here
     ---------------------------------------------------------- */
  window.KB_ADMIN = {
    logMessage: logMessage,
    getMessages: getMessages
  };

  /* ----------------------------------------------------------
     12. Boot
     ---------------------------------------------------------- */
  trackView();
  applyAccount();
  ensureKey();
  drop(SESSION); // remove any session saved by an older version
  renderGrid();
  updateMsgBadge();

  // Flash message carried across a reload from the Projects tab.
  try {
    var fl = window.sessionStorage.getItem(FLASH);
    if (fl) {
      window.sessionStorage.removeItem(FLASH);
      setTimeout(function () {
        var n = document.createElement("div");
        n.className = "adm-toast";
        n.textContent = fl;
        document.body.appendChild(n);
        setTimeout(function () {
          n.classList.add("is-out");
        }, 2200);
        setTimeout(function () {
          if (n.parentNode) n.parentNode.removeChild(n);
        }, 2700);
      }, 400);
    }
  } catch (e) {}
})();
