/* ============================================================
   PORTFOLIO — SHARED SCRIPT
   Handles: header state, mobile nav, scroll reveal, skill bars,
   project filters, contact form (mailto) and footer year.
   No dependencies. Each feature is optional per page.
   ============================================================ */
(function () {
  "use strict";

  // Mark JS availability (used by CSS to reveal animated content)
  document.documentElement.classList.add("js");

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ----------------------------------------------------------
     1. Header: solid background after scrolling
     ---------------------------------------------------------- */
  var header = document.querySelector(".site-header");

  function updateHeader() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  }

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  /* ----------------------------------------------------------
     2. Mobile navigation
     ---------------------------------------------------------- */
  var navToggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");

  // Set up in section 10; declared here so the menu can call it.
  var syncQuickBar = null;

  function setNav(open) {
    if (!nav || !navToggle) return;
    nav.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("nav-open", open);
    document.body.style.overflow = open ? "hidden" : "";
    if (syncQuickBar) syncQuickBar();
  }

  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      setNav(navToggle.getAttribute("aria-expanded") !== "true");
    });

    // Close when a nav link or the backdrop is chosen
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a") || event.target.classList.contains("nav-backdrop")) {
        setNav(false);
      }
    });

    // Close on Escape
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setNav(false);
    });

    // Reset when resizing up to desktop
    window.addEventListener(
      "resize",
      function () {
        if (window.innerWidth >= 960) setNav(false);
      },
      { passive: true }
    );
  }

  /* ----------------------------------------------------------
     3. Scroll reveal
     ---------------------------------------------------------- */
  var revealElements = Array.prototype.slice.call(
    document.querySelectorAll("[data-reveal]")
  );

  if (revealElements.length) {
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealElements.forEach(function (el) {
        el.classList.add("is-visible");
      });
    } else {
      var revealObserver = new IntersectionObserver(
        function (entries, observer) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
      );

      revealElements.forEach(function (el, index) {
        // Stagger siblings that share a parent
        var delay = (index % 4) * 0.08;
        el.style.setProperty("--reveal-delay", delay + "s");
        revealObserver.observe(el);
      });
    }
  }

  /* ----------------------------------------------------------
     4. Skill bars (skills page)
     ---------------------------------------------------------- */
  var skillFills = Array.prototype.slice.call(
    document.querySelectorAll(".skill-fill[data-level]")
  );

  function fillSkill(fill) {
    var level = parseInt(fill.getAttribute("data-level"), 10) || 0;
    fill.style.width = Math.max(0, Math.min(100, level)) + "%";
  }

  if (skillFills.length) {
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      skillFills.forEach(fillSkill);
    } else {
      var skillObserver = new IntersectionObserver(
        function (entries, observer) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              fillSkill(entry.target);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.4 }
      );
      skillFills.forEach(function (fill) {
        skillObserver.observe(fill);
      });
    }
  }

  /* ----------------------------------------------------------
     5. Project filters (projects page)
     ---------------------------------------------------------- */
  var filterBar = document.querySelector(".filter-bar");
  var projectCards = Array.prototype.slice.call(
    document.querySelectorAll(".project-card[data-category]")
  );

  if (filterBar && projectCards.length) {
    filterBar.addEventListener("click", function (event) {
      var button = event.target.closest(".filter-btn");
      if (!button) return;

      var filter = button.getAttribute("data-filter");

      filterBar.querySelectorAll(".filter-btn").forEach(function (btn) {
        var active = btn === button;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", String(active));
      });

      projectCards.forEach(function (card) {
        var categories = card.getAttribute("data-category") || "";
        var show = filter === "all" || categories.split(" ").indexOf(filter) !== -1;
        card.classList.toggle("is-hidden", !show);
      });
    });
  }

  /* ----------------------------------------------------------
     6. Contact form (mailto integration)
     ---------------------------------------------------------- */
  var contactForm = document.getElementById("contact-form");

  if (contactForm) {
    var statusBox = document.getElementById("form-status");
    var submitBtn = contactForm.querySelector('button[type="submit"]');

    var validators = {
      name: function (value) {
        if (!value.trim()) return "Please enter your name.";
        if (value.trim().length < 2) return "Name is too short.";
        return "";
      },
      email: function (value) {
        if (!value.trim()) return "Please enter your email address.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()))
          return "Please enter a valid email address.";
        return "";
      },
      service: function (value) {
        if (!value) return "Please choose a service.";
        return "";
      },
      message: function (value) {
        if (!value.trim()) return "Please tell me about your project.";
        if (value.trim().length < 10)
          return "A few more details would help — at least 10 characters.";
        return "";
      }
    };

    function validateField(input) {
      var validator = validators[input.name];
      if (!validator) return true;

      var message = validator(input.value);
      var field = input.closest(".field");
      var errorEl = field ? field.querySelector(".field-error") : null;

      if (field) field.classList.toggle("has-error", Boolean(message));
      input.setAttribute("aria-invalid", message ? "true" : "false");
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.hidden = !message;
      }
      return !message;
    }

    // Validate on blur once the user has interacted
    contactForm.addEventListener(
      "blur",
      function (event) {
        var input = event.target;
        if (input.matches("input, select, textarea") && input.value) {
          validateField(input);
        }
      },
      true
    );

    // Clear a field's error while typing
    contactForm.addEventListener("input", function (event) {
      var input = event.target;
      var field = input.closest(".field");
      if (field && field.classList.contains("has-error")) {
        validateField(input);
      }
    });

    contactForm.addEventListener("submit", function (event) {
      event.preventDefault();

      var inputs = Array.prototype.slice.call(
        contactForm.querySelectorAll("input, select, textarea")
      );
      var allValid = inputs.map(validateField).every(Boolean);

      if (!allValid) {
        var firstInvalid = contactForm.querySelector(
          '[aria-invalid="true"]'
        );
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // No backend on this site — hand the message to the visitor's
      // email app, pre-filled. Nothing is stored on a server.
      var recipient =
        contactForm.getAttribute("data-email") || "hello@yourname.com";
      var name = contactForm.elements.name.value.trim();
      var email = contactForm.elements.email.value.trim();
      var service = contactForm.elements.service.value;
      var message = contactForm.elements.message.value.trim();

      var subject = "Portfolio enquiry — " + service;
      var body =
        "Name: " + name + "\n" +
        "Email: " + email + "\n" +
        "Service: " + service + "\n\n" +
        "Message:\n" + message + "\n";

      var mailtoUrl =
        "mailto:" + recipient +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);

      if (submitBtn) submitBtn.classList.add("is-loading");

      if (statusBox) {
        statusBox.hidden = false;
        statusBox.textContent =
          "Opening your email app with the message pre-filled. " +
          "If nothing opens, email " + recipient + " directly.";
      }

      // Keep a copy for the admin panel inbox (local to this browser).
      if (window.KB_ADMIN && typeof window.KB_ADMIN.logMessage === "function") {
        window.KB_ADMIN.logMessage({
          name: name,
          email: email,
          service: service,
          message: message
        });
      }

      window.location.href = mailtoUrl;

      window.setTimeout(function () {
        if (submitBtn) submitBtn.classList.remove("is-loading");
      }, 1500);
    });
  }

  /* ----------------------------------------------------------
     7. Footer year + back to top
     ---------------------------------------------------------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  var backTop = document.querySelector(".back-top");
  if (backTop) {
    backTop.addEventListener("click", function () {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? "auto" : "smooth"
      });
    });
  }

  /* ----------------------------------------------------------
     8. Pointer motion on the hero portrait
     A light translate on the stage plus a 3D turn of the portrait
     itself, so the figure leans towards the cursor. Touch devices
     and "prefers reduced motion" keep the static portrait.
     ---------------------------------------------------------- */
  var heroStage = document.querySelector(".hero-visual[data-parallax]");

  if (
    heroStage &&
    !prefersReducedMotion &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  ) {
    var hero = heroStage.closest(".hero");
    var portraitTilt = heroStage.querySelector(".portrait-stage__img");

    if (hero) {
      hero.addEventListener("mousemove", function (event) {
        var rect = hero.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width - 0.5;
        var y = (event.clientY - rect.top) / rect.height - 0.5;
        heroStage.style.transform =
          "translate3d(" + x * 10 + "px, " + y * 8 + "px, 0)";

        if (portraitTilt) {
          portraitTilt.style.transform =
            "perspective(1000px) rotateX(" +
            (-y * 5).toFixed(2) +
            "deg) rotateY(" +
            (x * 7).toFixed(2) +
            "deg)";
        }
      });

      hero.addEventListener("mouseleave", function () {
        heroStage.style.transform = "";

        if (portraitTilt) {
          portraitTilt.style.transform = "";
        }
      });

      heroStage.style.transition = "transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)";
    }
  }

  /* ----------------------------------------------------------
     9. Home page — cinematic motion layer
     Word-by-word hero reveal, scroll progress, magnetic
     buttons, pointer spotlight and hero cursor glow.
     Only runs on pages with <body class="home">.
     ---------------------------------------------------------- */
  var isHome = document.body.classList.contains("home");

  if (isHome) {
    var finePointer = window.matchMedia(
      "(hover: hover) and (pointer: fine)"
    ).matches;

    /* 9a. Split hero headings into masked words for a staggered reveal.
       Children such as <em class="accent-word"> are recursed into so the
       markup keeps its styling; only text nodes are wrapped. */
    function splitWords(root) {
      var index = 0;

      function walk(node) {
        var children = Array.prototype.slice.call(node.childNodes);
        children.forEach(function (child) {
          if (child.nodeType === 3) {
            var text = child.nodeValue;
            if (!text || !text.trim()) return; // leave whitespace as-is

            var fragment = document.createDocumentFragment();
            text.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) {
                fragment.appendChild(document.createTextNode(" "));
                return;
              }
              var mask = document.createElement("span");
              mask.className = "w";
              var word = document.createElement("span");
              word.className = "wi";
              word.style.setProperty("--i", String(index++));
              word.textContent = part;
              mask.appendChild(word);
              fragment.appendChild(mask);
            });
            node.replaceChild(fragment, child);
          } else if (child.nodeType === 1 && !child.classList.contains("w")) {
            walk(child); // keep <em>, <span>, etc. and process their text
          }
        });
      }

      walk(root);
      return index;
    }

    if (!prefersReducedMotion) {
      document
        .querySelectorAll(".hero-name, .hero-headline")
        .forEach(function (heading) {
          if (splitWords(heading) > 0) heading.classList.add("is-split");
        });
    }

    /* 9b. Scroll progress line across the header */
    var progressBar = document.querySelector(".scroll-progress");

    if (progressBar && !prefersReducedMotion) {
      var progressTicking = false;

      var paintProgress = function () {
        var doc = document.documentElement;
        var max = doc.scrollHeight - window.innerHeight;
        var ratio = max > 0 ? window.scrollY / max : 0;
        progressBar.style.setProperty(
          "--progress",
          Math.min(1, Math.max(0, ratio)).toFixed(4)
        );
        progressTicking = false;
      };

      window.addEventListener(
        "scroll",
        function () {
          if (progressTicking) return;
          progressTicking = true;
          window.requestAnimationFrame(paintProgress);
        },
        { passive: true }
      );

      window.addEventListener("resize", paintProgress, { passive: true });
      paintProgress();
    }

    /* 9c. Magnetic pull on the main buttons */
    if (!prefersReducedMotion && finePointer) {
      document
        .querySelectorAll(".hero-actions .btn, .cta-band .btn")
        .forEach(function (btn) {
          var strength = 0.28;

          btn.addEventListener("mousemove", function (event) {
            var rect = btn.getBoundingClientRect();
            var x = event.clientX - (rect.left + rect.width / 2);
            var y = event.clientY - (rect.top + rect.height / 2);
            btn.style.setProperty("--mag-x", x * strength + "px");
            btn.style.setProperty("--mag-y", y * strength + "px");
          });

          btn.addEventListener("mouseleave", function () {
            btn.style.setProperty("--mag-x", "0px");
            btn.style.setProperty("--mag-y", "0px");
          });
        });
    }

    /* 9d. Pointer-tracking spotlight inside cards, stats and projects */
    if (!prefersReducedMotion && finePointer) {
      document
        .querySelectorAll(".card, .project-card, .stat")
        .forEach(function (tile) {
          tile.addEventListener("mousemove", function (event) {
            var rect = tile.getBoundingClientRect();
            tile.style.setProperty("--mx", event.clientX - rect.left + "px");
            tile.style.setProperty("--my", event.clientY - rect.top + "px");
          });
        });
    }

    /* 9e. Soft glow that follows the pointer across the hero */
    var heroSection = document.querySelector(".hero");
    var heroGlow = document.querySelector(".hero-cursor-glow");

    if (heroSection && heroGlow && !prefersReducedMotion && finePointer) {
      heroSection.addEventListener("mousemove", function (event) {
        var rect = heroSection.getBoundingClientRect();
        heroGlow.style.setProperty("--cx", event.clientX - rect.left + "px");
        heroGlow.style.setProperty("--cy", event.clientY - rect.top + "px");
        heroSection.classList.add("is-pointer");
      });

      heroSection.addEventListener("mouseleave", function () {
        heroSection.classList.remove("is-pointer");
      });
    }
  }

  /* ----------------------------------------------------------
     10. Phone-only touches
     A thumb-reachable quick bar, built here so no page has to
     carry the markup. It appears once you have scrolled past the
     hero and keeps out of the way of the menu, the admin panel
     and the project lightbox.
     ---------------------------------------------------------- */
  var phone = window.matchMedia("(max-width: 639px)");

  var ICON_OPEN =
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 3.2 3.2 9 12 20.8 20.8 9 12 3.2Z" />' +
    '<path d="M3.2 9h17.6" />' +
    '<path d="m8.4 9 3.6 6.2L15.6 9" /></svg>';

  var ICON_SPARK =
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M13 2.5 15 8l5.5 2-5.5 2-2 5.5-2-5.5L5.5 10 11 8l2-5.5Z" />' +
    '<path d="M5 17.5 5.8 19.4 7.7 20.2 5.8 21 5 22.9 4.2 21 2.3 20.2 4.2 19.4 5 17.5Z" /></svg>';

  var quickBar = null;

  // The contact page is already the commission step, so it skips the bar.
  if (!contactForm) {
    quickBar = document.createElement("nav");
    quickBar.className = "m-bar";
    quickBar.id = "m-bar";
    quickBar.hidden = true;
    quickBar.setAttribute("aria-label", "Quick actions");
    quickBar.innerHTML =
      '<a class="m-bar-link" href="projects.html">' +
      ICON_OPEN +
      "<span>Projects</span></a>" +
      '<a class="m-bar-link is-primary" href="contact.html">' +
      ICON_SPARK +
      "<span>Commission</span></a>";
    document.body.appendChild(quickBar);
  }

  var barShown = false;

  syncQuickBar = function () {
    if (!quickBar) return;

    var blocked =
      document.body.classList.contains("nav-open") ||
      document.documentElement.classList.contains("adm-open") ||
      document.documentElement.classList.contains("pd-lock");

    var show = phone.matches && !blocked && window.scrollY > 340;
    if (show === barShown) return;

    barShown = show;
    quickBar.hidden = !show;
    document.body.classList.toggle("m-bar-on", show);
  };

  if (quickBar) {
    window.addEventListener("scroll", syncQuickBar, { passive: true });
    window.addEventListener("resize", syncQuickBar, { passive: true });

    if (phone.addEventListener) {
      phone.addEventListener("change", syncQuickBar);
    }

    // The admin panel and the lightbox mark themselves on <html>
    if (window.MutationObserver) {
      new MutationObserver(syncQuickBar).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"]
      });
    }

    syncQuickBar();
  }
})();
