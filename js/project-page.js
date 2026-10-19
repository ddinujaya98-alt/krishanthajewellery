/* ============================================================
   PORTFOLIO — PROJECT DETAIL PAGE (project.html)
   Reads ?id=… from the URL, looks the project up in
   KB_PROJECTS and renders the story, the specs, the photo
   gallery and a few related projects.

   Loaded AFTER projects-data.js and BEFORE main.js, so the
   scroll-reveal observer sees the freshly rendered blocks.
   ============================================================ */
(function () {
  "use strict";

  var DATA = window.KB_PROJECTS;
  var layout = document.getElementById("pd-layout");
  if (!DATA || !layout) return;

  var esc = DATA.esc;

  function el(id) {
    return document.getElementById(id);
  }

  function param(name) {
    var match = new RegExp("[?&]" + name + "=([^&]*)").exec(
      window.location.search
    );
    return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
  }

  var state = { images: [], index: 0, title: "" };
  var project = null;
  var box = null;

  /* ----------------------------------------------------------
     Heading — accent the last word when there is more than one
     ---------------------------------------------------------- */
  function titleHtml(title) {
    var words = String(title).trim().split(/\s+/);
    if (words.length < 2) return esc(title);
    var last = words.pop();
    return (
      esc(words.join(" ")) + ' <em class="accent-word">' + esc(last) + "</em>"
    );
  }

  /* ----------------------------------------------------------
     Gallery
     ---------------------------------------------------------- */
  function renderMain() {
    var fig = el("pd-main");
    if (!fig) return;

    if (!state.images.length) {
      fig.classList.add("pd-main--art");
      fig.innerHTML =
        DATA.visualHtml(project) +
        '<figcaption class="pd-empty">Photographs of this piece are coming soon.</figcaption>';
      return;
    }

    fig.classList.remove("pd-main--art");
    fig.innerHTML =
      '<button class="pd-main-btn" type="button" aria-label="Enlarge photograph">' +
      '<img id="pd-img" src="' +
      esc(state.images[state.index]) +
      '" alt="' +
      esc(state.title) +
      " — photograph " +
      (state.index + 1) +
      '">' +
      '<span class="pd-zoom" aria-hidden="true">⤢</span>' +
      "</button>";

    var img = el("pd-img");
    if (img) {
      img.addEventListener("error", function () {
        if (img.parentNode) img.parentNode.classList.add("is-broken");
      });
    }
  }

  function renderThumbs() {
    var wrap = el("pd-thumbs");
    if (!wrap) return;

    if (state.images.length < 2) {
      wrap.hidden = true;
      wrap.innerHTML = "";
      return;
    }

    var html = "";
    for (var i = 0; i < state.images.length; i++) {
      html +=
        '<button class="pd-thumb' +
        (i === state.index ? " is-active" : "") +
        '" type="button" data-shot="' +
        i +
        '" aria-label="Show photograph ' +
        (i + 1) +
        '"><img src="' +
        esc(state.images[i]) +
        '" alt="" loading="lazy"></button>';
    }
    wrap.innerHTML = html;
    wrap.hidden = false;
  }

  function selectShot(i) {
    var total = state.images.length;
    if (!total) return;
    state.index = ((i % total) + total) % total;
    renderMain();
    renderThumbs();
  }

  /* ----------------------------------------------------------
     Lightbox
     ---------------------------------------------------------- */
  function openLightbox() {
    var img = el("pd-lb-img");
    if (!state.images.length || !box || !img) return;

    img.src = state.images[state.index];
    img.alt = state.title + " — photograph " + (state.index + 1);
    box.hidden = false;
    document.documentElement.classList.add("pd-lock");
    document.body.style.overflow = "hidden";

    var multi = state.images.length > 1;
    var prev = box.querySelector(".pd-lb-prev");
    var next = box.querySelector(".pd-lb-next");
    if (prev) prev.hidden = !multi;
    if (next) next.hidden = !multi;

    var close = box.querySelector(".pd-lb-close");
    if (close && close.focus) close.focus();
  }

  function closeLightbox() {
    if (!box || box.hidden) return;
    box.hidden = true;
    document.documentElement.classList.remove("pd-lock");
    document.body.style.overflow = "";
  }

  function step(delta) {
    selectShot(state.index + delta);
    var img = el("pd-lb-img");
    if (box && !box.hidden && img) {
      img.src = state.images[state.index];
      img.alt = state.title + " — photograph " + (state.index + 1);
    }
  }

  function bindLightbox() {
    box = el("pd-lightbox");
    if (!box) return;

    box.addEventListener("click", function (event) {
      var t = event.target;
      if (!t || !t.closest) return;
      if (t === box || t.closest(".pd-lb-close")) {
        closeLightbox();
      } else if (t.closest(".pd-lb-prev")) {
        step(-1);
      } else if (t.closest(".pd-lb-next")) {
        step(1);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (!box || box.hidden) return;
      if (event.key === "Escape") closeLightbox();
      else if (event.key === "ArrowLeft") step(-1);
      else if (event.key === "ArrowRight") step(1);
    });
  }

  /* ----------------------------------------------------------
     Render
     ---------------------------------------------------------- */
  function render(p) {
    if (el("pd-cat")) el("pd-cat").textContent = p.catLabel || "Project";
    if (el("pd-title")) el("pd-title").innerHTML = titleHtml(p.title);
    if (el("pd-lede")) el("pd-lede").textContent = p.desc || "";

    // Photos
    state.images = DATA.normaliseImages(p.images);
    state.index = 0;
    state.title = p.title;
    renderMain();
    renderThumbs();

    // Specs
    var specs = [
      ["Metal", p.metal],
      ["Stones", p.stones],
      ["Finish", p.finish],
      ["Timeframe", p.timeframe]
    ];
    var specHtml = "";
    for (var i = 0; i < specs.length; i++) {
      if (specs[i][1]) {
        specHtml +=
          "<li><span>" + esc(specs[i][0]) + "</span><b>" + esc(specs[i][1]) + "</b></li>";
      }
    }
    var specList = el("pd-specs");
    if (specList) {
      specList.innerHTML = specHtml;
      specList.hidden = !specHtml;
    }

    // Tags
    var tagRow = el("pd-tags");
    if (tagRow) {
      var tags = Array.isArray(p.tags) ? p.tags : [];
      var tagHtml = "";
      for (var t = 0; t < tags.length && t < 6; t++) {
        tagHtml += '<span class="tag">' + esc(tags[t]) + "</span>";
      }
      tagRow.innerHTML = tagHtml;
      tagRow.hidden = !tagHtml;
    }

    // Story
    var storyBox = el("pd-story");
    if (storyBox) {
      var paragraphs = String(p.story || p.desc || "").split(/\n\s*\n/);
      var storyHtml = "";
      for (var s = 0; s < paragraphs.length; s++) {
        if (paragraphs[s].trim()) {
          storyHtml += "<p>" + esc(paragraphs[s].trim()) + "</p>";
        }
      }
      storyBox.innerHTML = storyHtml;
    }

    // Optional external link
    var link = el("pd-link");
    if (link) {
      if (p.link) {
        link.href = p.link;
        link.hidden = false;
      } else {
        link.hidden = true;
      }
    }

    // Related projects
    var more = DATA.others(p.id, 3);
    if (more.length) {
      var wrap = el("pd-more");
      var html = "";
      for (var m = 0; m < more.length; m++) html += DATA.cardHtml(more[m]);
      if (wrap) wrap.innerHTML = html;
      if (el("pd-more-section")) el("pd-more-section").hidden = false;
    }

    document.title =
      p.title + " — Krishantha Balacharige | Jewellery Designer & Craftsman";
    var meta = document.querySelector('meta[name="description"]');
    if (meta && p.desc) meta.setAttribute("content", p.desc);
  }

  function renderMissing() {
    if (layout) layout.hidden = true;
    var story = el("pd-story");
    if (story) story.hidden = true;
    if (el("pd-cat")) el("pd-cat").textContent = "Project not found";
    if (el("pd-title")) el("pd-title").textContent = "That piece has moved.";
    if (el("pd-lede")) el("pd-lede").textContent = "";
    if (el("pd-missing")) el("pd-missing").hidden = false;
    if (box && box.parentNode) box.parentNode.removeChild(box);
    document.title = "Project not found — Krishantha Balacharige";
  }

  /* ----------------------------------------------------------
     Boot
     ---------------------------------------------------------- */
  bindLightbox();

  var media = document.querySelector(".pd-media");
  if (media) {
    media.addEventListener("click", function (event) {
      var t = event.target;
      if (!t || !t.closest) return;
      var thumb = t.closest(".pd-thumb");
      if (thumb) {
        selectShot(parseInt(thumb.getAttribute("data-shot"), 10) || 0);
        return;
      }
      if (t.closest(".pd-main-btn")) openLightbox();
    });
  }

  project = DATA.get(param("id"));
  if (!project) {
    renderMissing();
    return;
  }
  render(project);
})();
