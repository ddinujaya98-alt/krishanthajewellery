/* ============================================================
   PORTFOLIO — PROJECT DATA (single source of truth)
   ------------------------------------------------------------
   Every project lives here (or in localStorage when added /
   edited from the admin panel). Both the Projects page grid
   and the project.html detail page read from this module, so
   there is only ever one copy of a project to maintain.

   Storage keys (shared with the admin panel):
     kb_admin_projects         -> array of { id, ... } records.
                                  A record whose id matches a
                                  built-in project OVERRIDES it;
                                  any other id is a NEW project.
     kb_admin_project_hidden   -> array of built-in ids the admin
                                  removed from the grid.
     kb_admin_hide_templates   -> true = hide all built-in samples.

   Loaded BEFORE admin.js so the cards exist when main.js binds
   the filters and the scroll-reveal observer.
   ============================================================ */
window.KB_PROJECTS = (function () {
  "use strict";

  /* ----------------------------------------------------------
     Storage (safe — degrades if storage is blocked)
     ---------------------------------------------------------- */
  var LS = {
    projects: "kb_admin_projects",
    hidden: "kb_admin_project_hidden",
    hideAll: "kb_admin_hide_templates"
  };

  function load(k, fallback) {
    try {
      var raw = window.localStorage.getItem(k);
      if (raw === null) return fallback;
      var v = JSON.parse(raw);
      return v === null || v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function save(k, value) {
    try {
      window.localStorage.setItem(k, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function esc(str) {
    return String(str === null || str === undefined ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /* ----------------------------------------------------------
     Categories (ids must match the filter buttons + admin CATS)
     ---------------------------------------------------------- */
  var CATS = [
    { id: "bespoke", label: "Bespoke" },
    { id: "bridal", label: "Rings & Bridal" },
    { id: "stone", label: "Stone Setting" },
    { id: "repair", label: "Repairs" }
  ];

  /* ----------------------------------------------------------
     Built-in projects — sample work for the portfolio
     ---------------------------------------------------------- */
  var DEFAULTS = [
    {
      id: "aurelia",
      title: "Aurelia",
      catLabel: "Bespoke Commission",
      category: "bespoke",
      letter: "A",
      art: "ring",
      preset: "custom",
      artA: "rgba(255,104,30,.42)",
      artB: "rgba(122,58,18,.5)",
      tags: ["Gold", "Sapphire", "Bespoke"],
      desc: "A bespoke engagement ring made by hand in yellow gold — a Ceylon sapphire set in a soft, tapered band and polished to a warm finish.",
      story:
        "Aurelia started with a loose Ceylon sapphire and a brief that was really a feeling: warm, quiet, and made for one hand only. I sketched the profile first, then raised the band and tapered the shoulders so the stone sits low and never catches on a sleeve.\n\nThe sapphire is held in a hand-cut collet, set at the bench and finished with a soft satin polish. The client saw photographs at every stage — wax, metal, setting and final polish — so the ring that arrived was the ring they had imagined.",
      metal: "18k yellow gold",
      stones: "1.2ct Ceylon sapphire",
      finish: "Soft satin, hand-polished",
      timeframe: "6 weeks",
      images: [],
      link: ""
    },
    {
      id: "thilaka-bangles",
      title: "Thilaka Bangles",
      catLabel: "Bridal Commission",
      category: "bridal",
      desc: "A pair of bridal bangles in 22k gold — hand-engraved in a traditional pattern and polished to a soft satin finish.",
      story: "A pair: one for the bride, one for her mother. The bangles are raised from 22k gold and hand-engraved with a traditional repeating motif, cut freehand with a graver so the pattern stays alive rather than perfectly mechanical.\n\nThe final surface is a soft satin — it holds the light in a way a mirror polish never does, and it wears beautifully for years.",
      metal: "22k yellow gold",
      stones: "None — all metal work",
      finish: "Satin with hand-engraved pattern",
      timeframe: "8 weeks",
      tags: ["Bridal", "Hand Engraving"],
      letter: "T",
      preset: "cream",
      artA: "rgba(243,223,201,.3)",
      artB: "rgba(255,104,30,.28)",
      art: "bars",
      images: [],
      link: ""
    },
    {
      id: "serene-pendant",
      title: "Serene Pendant",
      catLabel: "Stone Setting",
      category: "stone",
      desc: "A single moonstone set in a hand-made bezel pendant — quiet, light-catching metalwork made to be worn every day.",
      story: "A single moonstone, and nothing that competes with it. The bezel is formed by hand around the stone so the setting follows its edge exactly, and the bail is made so the pendant hangs flat instead of tipping forward.\n\nWorn every day — which is the point of it — the moonstone shifts from cool blue to a warm glow depending on the light and what it is worn against.",
      metal: "18k white gold",
      stones: "4.8ct oval moonstone",
      finish: "High polish",
      timeframe: "3 weeks",
      tags: ["Moonstone", "Bezel Setting"],
      letter: "S",
      preset: "sunset",
      artA: "rgba(255,139,70,.36)",
      artB: "rgba(36,22,20,.85)",
      art: "ring",
      images: [],
      link: ""
    },
    {
      id: "heirloom-restoration",
      title: "Heirloom Restoration",
      catLabel: "Restoration",
      category: "repair",
      desc: "A grandmother's ring brought back to life — worn claws re-tipped, the band rebuilt, and the stones re-set and polished.",
      story: "The ring arrived in a small box with a story attached: a grandmother's, worn every day for forty years. The claws were flat, the band had worn thin at the back, and two stones were loose in their settings.\n\nThe original stones were kept, the claws re-tipped and re-cut by hand, the band rebuilt in matching gold, and the whole piece polished back to its warmth. Nothing was replaced that did not have to be, so the ring the family knows is the ring that came home.",
      metal: "Original gold, preserved",
      stones: "Family stones, re-set",
      finish: "Polished to match the original",
      timeframe: "4 weeks",
      tags: ["Restoration", "Polishing"],
      letter: "H",
      preset: "deep",
      artA: "rgba(255,104,30,.3)",
      artB: "rgba(90,40,20,.6)",
      art: "bars",
      images: [],
      link: ""
    },
    {
      id: "bimba-earrings",
      title: "Bimba Earrings",
      catLabel: "Stone Setting",
      category: "stone",
      desc: "A pair of garnet drop earrings — each stone hand-matched and set in gold, light and balanced enough to wear all day.",
      story: "Two garnets, matched by eye until they read as a pair in every light. Each stone sits in a fine hand-made setting so it hangs and moves slightly as the wearer turns, and the posts are weighted so the drops sit forward rather than swinging back.\n\nLight, warm, and easy enough to forget you are wearing them — which is how a pair of everyday earrings should feel.",
      metal: "18k rose gold",
      stones: "Matched garnet drops",
      finish: "Polished, hand-finished settings",
      timeframe: "5 weeks",
      tags: ["Garnet", "Drop Earrings"],
      letter: "B",
      preset: "custom",
      artA: "rgba(243,223,201,.24)",
      artB: "rgba(255,139,70,.3)",
      art: "ring",
      images: [],
      link: ""
    },
    {
      id: "ember-signet",
      title: "Ember Signet",
      catLabel: "Bespoke Commission",
      category: "bespoke",
      desc: "A hand-carved signet ring in silver with a deep engraved crest — a modern take on an old family idea.",
      story: "A signet should feel like it has always existed. The face is cut by hand in reverse so the impression comes out sharp in wax, and the shoulders are filed to a soft curve that sits naturally against the finger.\n\nThe silver is left brushed on the face and polished on the sides, so the engraved crest reads clearly while the ring still catches light along the edge. It was made to be worn, not kept in a drawer.",
      metal: "Sterling silver",
      stones: "None — engraved by hand",
      finish: "Brushed face, polished sides",
      timeframe: "5 weeks",
      tags: ["Signet", "Hand Engraving"],
      letter: "E",
      preset: "custom",
      artA: "rgba(255,104,30,.26)",
      artB: "rgba(243,223,201,.2)",
      art: "bars",
      images: [],
      link: ""
    },
    {
      id: "fern-ring",
      title: "Fern Ring",
      catLabel: "Bridal Commission",
      category: "bridal",
      desc: "A slim rose-gold wedding band with a delicate hand-engraved fern pattern and a brushed, hand-finished surface.",
      story: "A wedding band with a single fern leaf travelling around it. The pattern is engraved by hand with a fine liner, worked around the curve of the ring so the leaf grows rather than repeats.\n\nRose gold takes a hand-engraved line beautifully, so the band is finished with a light brush: the fern stays soft, the metal keeps its warmth, and nothing looks printed or stamped.",
      metal: "18k rose gold",
      stones: "None — hand-engraved band",
      finish: "Brushed, hand-engraved",
      timeframe: "4 weeks",
      tags: ["Bridal", "Rose Gold"],
      letter: "F",
      preset: "custom",
      artA: "rgba(255,104,30,.36)",
      artB: "rgba(36,22,20,.7)",
      art: "ring",
      images: [],
      link: ""
    },
    {
      id: "lankaa-bridal-set",
      title: "Lankaa Bridal Set",
      catLabel: "Bridal & Stone Setting",
      category: "bridal stone",
      desc: "A full bridal set — necklace, earrings and ring in white gold, every stone matched by hand and set to sit perfectly together.",
      story: "A full set for one wedding: necklace, earrings and ring, designed together so the three pieces read as one idea rather than a matched pair.\n\nThe sapphires were chosen over several fittings, matched for colour and life until they belonged together, then set in settings cut to each individual stone rather than to a number. That is why the set sits flat, catches light evenly, and looks made for one person — because it was.",
      metal: "18k white gold",
      stones: "Matched Ceylon sapphires",
      finish: "High polish, hand-set",
      timeframe: "10 weeks",
      tags: ["Bridal", "Sapphire"],
      letter: "L",
      preset: "custom",
      artA: "rgba(255,139,70,.34)",
      artB: "rgba(36,22,20,.8)",
      art: "bars",
      images: [],
      link: ""
    }
  ];

  function baseById(id) {
    for (var i = 0; i < DEFAULTS.length; i++) {
      if (DEFAULTS[i].id === id) return DEFAULTS[i];
    }
    return null;
  }

  function stored() {
    var list = load(LS.projects, []);
    return Array.isArray(list) ? list : [];
  }

  function setStored(list) {
    return save(LS.projects, list);
  }

  function hiddenIds() {
    var list = load(LS.hidden, []);
    return Array.isArray(list) ? list : [];
  }

  function setHiddenIds(list) {
    return save(LS.hidden, list);
  }

  function hideAllSamples() {
    return load(LS.hideAll, false) === true;
  }

  function overrideFor(id) {
    var list = stored();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  function hasOverride(id) {
    return !!overrideFor(id);
  }

  function merge(base, over) {
    var out = clone(base);
    for (var k in over) {
      if (Object.prototype.hasOwnProperty.call(over, k)) out[k] = over[k];
    }
    return out;
  }

  function normaliseImages(value) {
    if (!value) return [];
    var raw = value;
    if (typeof raw === "string") raw = raw.split(/[\r\n,]+/);
    if (!Array.isArray(raw)) return [];
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var src = String(raw[i] === null || raw[i] === undefined ? "" : raw[i]).trim();
      if (src) out.push(src);
    }
    return out;
  }

  /* ----------------------------------------------------------
     Public data helpers
     ---------------------------------------------------------- */

  // Every project the site should show, in order:
  //   admin-added projects first (newest first), then the built-ins.
  function list() {
    var store = stored();
    var hid = hiddenIds();
    var hideAll = hideAllSamples();
    var overrides = {};
    var i;

    for (i = 0; i < store.length; i++) {
      if (store[i] && store[i].id) overrides[store[i].id] = store[i];
    }

    var out = [];

    // Custom projects (ids that are not built in)
    for (i = 0; i < store.length; i++) {
      if (store[i] && store[i].id && !baseById(store[i].id)) out.push(store[i]);
    }

    // Built-in projects (with any admin edits applied)
    for (i = 0; i < DEFAULTS.length; i++) {
      var base = DEFAULTS[i];
      if (hid.indexOf(base.id) !== -1) continue;
      var over = overrides[base.id];
      if (hideAll && !over) continue;
      out.push(over ? merge(base, over) : clone(base));
    }

    return out;
  }

  function get(id) {
    if (!id) return null;
    var all = list();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) return all[i];
    }
    return null;
  }

  function others(id, count) {
    var all = list();
    var out = [];
    for (var i = 0; i < all.length && out.length < (count || 3); i++) {
      if (all[i].id !== id) out.push(all[i]);
    }
    return out;
  }

  /* ----------------------------------------------------------
     Markup helpers (shared by the grid and the detail page)
     ---------------------------------------------------------- */
  function visualHtml(p) {
    var art =
      p.art === "bars"
        ? '<span class="art-bars"><i></i><i></i><i></i></span>'
        : '<span class="art-ring"></span>';
    return (
      '<div class="project-visual" style="--art-a: ' +
      esc(p.artA || "rgba(255,104,30,.35)") +
      "; --art-b: " +
      esc(p.artB || "rgba(255,139,70,.18)") +
      ';" aria-hidden="true">' +
      art +
      '<span class="art-letter">' +
      esc(p.letter || (p.title || "P").charAt(0).toUpperCase()) +
      "</span>" +
      "</div>"
    );
  }

  function cardHtml(p, admin) {
    // `admin` marks a card injected by the panel so a later render can
    // clean it up before re-inserting the current list.
    var tags = "";
    var list_ = Array.isArray(p.tags) ? p.tags : [];
    for (var i = 0; i < list_.length && i < 5; i++) {
      tags += '<span class="tag">' + esc(list_[i]) + "</span>";
    }

    return (
      '<article class="project-card"' +
      (admin ? ' data-admin="1"' : "") +
      ' data-category="' +
      esc(p.category) +
      '" data-project="' +
      esc(p.id) +
      '" data-reveal>' +
      visualHtml(p) +
      '<div class="project-body">' +
      '<span class="project-cat">' +
      esc(p.catLabel) +
      "</span>" +
      '<h2 class="project-title">' +
      esc(p.title) +
      "</h2>" +
      '<p class="project-desc">' +
      esc(p.desc) +
      "</p>" +
      '<div class="project-foot">' +
      '<div class="tag-row">' +
      tags +
      "</div>" +
      '<a class="project-open" href="project.html?id=' +
      encodeURIComponent(p.id) +
      '" aria-label="View ' +
      esc(p.title) +
      ' details">↗</a>' +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  function markVisible(grid) {
    // If main.js has already run, its reveal observer cannot see nodes
    // added afterwards — so reveal them immediately.
    if (!document.documentElement.classList.contains("js")) return;
    var cards = grid.querySelectorAll('[data-reveal]:not(.is-visible)');
    for (var i = 0; i < cards.length; i++) cards[i].classList.add("is-visible");
  }

  /* ----------------------------------------------------------
     Grid rendering (Projects page)
     ---------------------------------------------------------- */
  function renderGrid() {
    var grid = document.querySelector(".project-grid");
    if (!grid) return;

    // 1. Drop the cards we injected on a previous render.
    var injected = grid.querySelectorAll('[data-admin="1"]');
    for (var i = 0; i < injected.length; i++) {
      injected[i].parentNode.removeChild(injected[i]);
    }

    // 2. Reconcile the built-in cards against the stored state.
    var statics = Array.prototype.slice.call(
      grid.querySelectorAll(".project-card[data-project]")
    );
    for (var j = 0; j < statics.length; j++) {
      var card = statics[j];
      var id = card.getAttribute("data-project");
      var project = get(id);

      if (!project) {
        card.parentNode.removeChild(card);
        continue;
      }
      if (hasOverride(id)) {
        // The admin has edited this project — re-render it.
        card.outerHTML = cardHtml(project);
      }
    }

    // 3. Insert admin-added projects at the top of the grid.
    var store = stored();
    var html = "";
    for (var k = 0; k < store.length; k++) {
      if (store[k] && store[k].id && !baseById(store[k].id)) {
        html += cardHtml(store[k], true);
      }
    }
    if (html) grid.insertAdjacentHTML("afterbegin", html);

    // 4. Reveal anything new + hide the samples if the admin asked.
    markVisible(grid);

    var hide = hideAllSamples();
    grid.classList.toggle("hide-templates", hide);

    var note = document.getElementById("tpl-note");
    if (note) note.hidden = !(hide && list().length === 0);
  }

  /* ----------------------------------------------------------
     Boot: keep the grid in sync everywhere the admin edits it
     ---------------------------------------------------------- */
  renderGrid();

  window.addEventListener("storage", function () {
    renderGrid();
  });

  return {
    CATS: CATS,
    defaults: DEFAULTS,
    baseById: baseById,
    list: list,
    get: get,
    others: others,
    stored: stored,
    setStored: setStored,
    hiddenIds: hiddenIds,
    setHiddenIds: setHiddenIds,
    hideAllSamples: hideAllSamples,
    hasOverride: hasOverride,
    overrideFor: overrideFor,
    normaliseImages: normaliseImages,
    esc: esc,
    visualHtml: visualHtml,
    cardHtml: cardHtml,
    renderGrid: renderGrid
  };
})();
