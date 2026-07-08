/* =========================================================
   CoreStorm Global — main.js
   Nav, scroll reveals, animated counters, contact form
   ========================================================= */
(function () {
  "use strict";

  // Content is only hidden for reveal animations when JS is running —
  // without this class, everything renders visible (no-JS safety).
  document.documentElement.classList.add("js");

  /* ---------- Sticky header shadow ---------- */
  const header = document.getElementById("siteHeader");
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile navigation ---------- */
  const navToggle = document.getElementById("navToggle");
  const mainNav = document.getElementById("mainNav");

  navToggle.addEventListener("click", () => {
    const open = mainNav.classList.toggle("open");
    navToggle.classList.toggle("open", open);
    navToggle.setAttribute("aria-expanded", String(open));
  });

  // Close the mobile menu after tapping a link
  mainNav.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      mainNav.classList.remove("open");
      navToggle.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });

  /* ---------- Scroll-reveal animations ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Reveal on intersection, and also anything already above the
          // viewport (anchor links / scroll restoration land mid-page).
          if (entry.isIntersecting || entry.boundingClientRect.bottom < 0) {
            entry.target.classList.add("visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach((el) => revealObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("visible"));
  }

  /* ---------- Animated counters ---------- */
  const counters = document.querySelectorAll("[data-count]");
  const animateCount = (el) => {
    const target = parseInt(el.dataset.count, 10);
    const duration = 1400;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      el.textContent = Math.round(target * eased).toLocaleString();
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if ("IntersectionObserver" in window) {
    const countObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            countObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((el) => countObserver.observe(el));
  } else {
    counters.forEach((el) => (el.textContent = el.dataset.count));
  }

  /* ---------- Contact form ---------- */
  const form = document.getElementById("contactForm");
  const success = document.getElementById("formSuccess");
  const errorBox = document.getElementById("formError");

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    let valid = true;
    form.querySelectorAll("[required]").forEach((field) => {
      const isEmail = field.type === "email";
      const value = field.value.trim();
      const fieldValid =
        value !== "" && (!isEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
      field.classList.toggle("invalid", !fieldValid);
      if (!fieldValid) valid = false;
    });

    if (!valid) {
      form.querySelector(".invalid")?.focus();
      return;
    }

    success.hidden = true;
    errorBox.hidden = true;

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Sending…";

    // Submits to Formspree (see the form's action= attribute). Accept: json
    // keeps this an in-page AJAX submission instead of a full-page redirect.
    fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    })
      .then((res) => {
        if (res.ok) {
          form.reset();
          success.hidden = false;
          success.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else {
          errorBox.hidden = false;
          errorBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      })
      .catch(() => {
        errorBox.hidden = false;
        errorBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
      })
      .finally(() => {
        btn.disabled = false;
        btn.textContent = "Request My Quote";
      });
  });

  // Clear error styling as the user types
  form.addEventListener("input", (e) => e.target.classList.remove("invalid"));

  /* ---------- Image fallback ----------
     If a stock photo fails to load (offline, dead ID, strict CSP before
     the build inlines it), swap in a themed gradient instead of showing
     a broken-image icon. The element keeps its box (aspect-ratio),
     so layout never collapses. */
  const markFailed = (img) => img.classList.add("img-error");
  document.querySelectorAll("img").forEach((img) => {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) {
      markFailed(img);
    }
    img.addEventListener("error", () => markFailed(img));
  });

  /* ---------- Footer year ---------- */
  document.getElementById("year").textContent = new Date().getFullYear();
})();
