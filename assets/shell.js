/* =========================================================================
   multipage · shell.js   (vanilla, no build)

   The SHARED CHROME for every page: app bar, cross-page nav, footer and the
   detail <dialog>. It also owns global state (language + theme) and exposes a
   tiny toolkit on window.LDW that each page's app.js reuses.

   Loaded on EVERY page BEFORE app.js. It:
     1. reads the language from <html lang> and the theme from localStorage,
     2. injects app bar + nav + footer + dialog around <main id="page">,
     3. wires the theme toggle and points the language link at this page's
        counterpart in the other language,
     4. highlights the current page (from <body data-page="...">).

   Language belongs to the URL, not to the visitor: the Chinese pages live at
   the root and the English ones under /en/, so switching language is a
   navigation rather than an in-place repaint. Theme still persists in
   localStorage (an origin-wide store) and survives moving between pages.
   ========================================================================= */
(function () {
  "use strict";

  var META = window.SITE_META || { title: {}, subtitle: {}, footer: {} };
  var PAGES = Array.isArray(window.SITE_PAGES) ? window.SITE_PAGES : [];

  /* ---------- analytics (GA4) ---------- *
     Injected once, on every page, BUT only on the live site — never on
     localhost / 127.0.0.1 / file:// — so local previews and the Playwright
     verifier don't pollute production stats or hit an external domain. */
  var GA4_ID = "G-981GFJ59P8";
  function injectAnalytics() {
    var h = location.hostname;
    var local = (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h === "");
    if (local || location.protocol === "file:" || !/^G-[A-Z0-9]+$/.test(GA4_ID)) return;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA4_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", GA4_ID);
  }

  /* ---------- chrome i18n (page content strings live in the data) ---------- */
  var I18N = {
    en: { close: "Close", menu: "Pages", skip: "Skip to content", contents: "Contents",
          paper: "The paper", kit: "Study kit", unofficial: "Unofficial reader's guide. Numbers and definitions come from the paper; check the original for anything that matters." },
    zh: { close: "關閉", menu: "頁面", skip: "跳到內容", contents: "目錄",
          paper: "論文", kit: "學習工具", unofficial: "非官方論文導讀。數字與定義取自原論文，引用前請以原文為準。" }
  };

  /* ---------- sandbox-safe localStorage ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* ---------- global state ----------
     The URL decides the language, so <html lang> is what we read. localStorage
     must not seed it: a crawler has no localStorage and would always be handed
     the fallback, which is how one half of the site ended up with no address of
     its own — and why a first-time reader of the Chinese pages was repainted
     into English. Writing the choice back is gone too; the address carries it. */
  function langFromDocument() {
    var declared = (document.documentElement.getAttribute("lang") || "en").toLowerCase();
    return declared.indexOf("zh") === 0 ? "zh" : "en";
  }

  /* the same page in the other language — mirror the path, never guess */
  var TWIN_DIR = "/en";
  function altLangHref() {
    var path = location.pathname || "/";
    if (path === TWIN_DIR || path.indexOf(TWIN_DIR + "/") === 0) {
      return path.slice(TWIN_DIR.length) || "/";
    }
    return TWIN_DIR + path;
  }

  /* Theme: an explicit choice (saved only when the visitor clicks the toggle)
     wins; otherwise follow the OS setting. */
  var mqDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function systemTheme() { return mqDark && mqDark.matches ? "dark" : "light"; }
  var savedTheme = lsGet("theme");
  var state = {
    lang:  langFromDocument(),
    theme: (savedTheme === "dark" || savedTheme === "light") ? savedTheme : systemTheme()
  };

  /* ---------- helpers shared with app.js ---------- */
  function t(obj) {
    if (obj == null) return "";
    if (typeof obj === "string") return obj;
    return obj[state.lang] || obj.en || obj.zh || "";
  }
  function ui(key) { return (I18N[state.lang] || I18N.en)[key]; }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }
  function r(n) { return Math.round(n * 100) / 100; }

  function pageHref(p) { return p.slug === "home" ? "index.html" : p.slug + ".html"; }
  function currentSlug() { return document.body.getAttribute("data-page") || "home"; }
  function currentPage() {
    var slug = currentSlug();
    for (var i = 0; i < PAGES.length; i++) if (PAGES[i].slug === slug) return PAGES[i];
    return PAGES[0] || null;
  }

  /* =======================================================================
     CHROME INJECTION — app bar, nav, footer, dialog around <main id="page">
     ===================================================================== */
  function injectChrome() {
    var main = document.getElementById("page");
    if (!main) return;

    /* skip link */
    var skip = document.createElement("a");
    skip.className = "skip-link";
    skip.href = "#page";
    skip.id = "skipLink";
    document.body.insertBefore(skip, document.body.firstChild);

    /* app bar: brand + actions on row 1, the page index on row 2 (desktop) or
       in a drop-down panel (narrow screens), and a reading-progress hairline. */
    var appbar = document.createElement("header");
    appbar.className = "appbar";
    appbar.innerHTML =
      '<div class="appbar__inner">' +
        '<a class="brand" href="index.html">' +
          '<svg class="brand__mark" viewBox="0 0 28 20" aria-hidden="true">' +
            '<line x1="5" y1="15" x2="23" y2="5" class="brand__mark-line" />' +
            '<circle cx="5" cy="15" r="3.4" class="brand__mark-base" />' +
            '<circle cx="23" cy="5" r="3.4" class="brand__mark-rl" />' +
          '</svg>' +
          '<span class="brand__name" id="brandName"></span>' +
        '</a>' +
        '<div class="appbar__actions">' +
          '<button class="icon-btn menu-btn" id="menuToggle" type="button" aria-expanded="false" aria-controls="pageNav">' +
            '<span class="material-symbols-rounded" aria-hidden="true">toc</span>' +
            '<span class="icon-btn__txt" id="menuLabel"></span>' +
          '</button>' +
          '<a class="icon-btn" id="langToggle" href="' + escapeHtml(altLangHref()) + '" ' +
             'hreflang="' + (state.lang === "en" ? "zh-Hant" : "en") + '" rel="alternate" ' +
             'title="Language" aria-label="' +
             (state.lang === "en" ? "切換到中文版 / View in Chinese" : "View in English / 切換到英文版") + '">' +
            '<span class="material-symbols-rounded" aria-hidden="true">translate</span>' +
            '<span class="icon-btn__txt" id="langLabel"></span>' +
          '</a>' +
          '<button class="icon-btn" id="themeToggle" type="button" title="Theme" aria-label="Toggle theme / 切換主題">' +
            '<span class="material-symbols-rounded" id="themeIcon" aria-hidden="true">dark_mode</span>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<nav class="pagenav" id="pageNav"><div class="pagenav__inner" id="pageNavInner"></div></nav>' +
      '<div class="read-progress" aria-hidden="true"><span id="readProgress"></span></div>';
    document.body.insertBefore(appbar, main);

    /* footer — the plain "other language" link that ships in the static HTML
       (for crawlers and no-JS readers) moves in here instead of floating below */
    var footer = document.createElement("footer");
    footer.className = "footer";
    footer.innerHTML =
      '<div class="footer__inner">' +
        '<div class="footer__text">' +
          '<p class="footer__title" id="footerText"></p>' +
          '<p class="footer__note" id="footerNote"></p>' +
        '</div>' +
        '<div class="footer__links" id="footerLinks">' +
          '<a class="icon-btn" href="https://www.peteraim.com" target="_blank" rel="noopener" title="Home" aria-label="Back to peteraim.com / 返回首頁">' +
            '<span class="material-symbols-rounded" aria-hidden="true">home</span>' +
          '</a>' +
          '<a class="icon-btn" href="https://www.linkedin.com/in/ai-med/" target="_blank" rel="noopener" title="LinkedIn" aria-label="LinkedIn (opens in new tab)">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/></svg>' +
          '</a>' +
        '</div>' +
      '</div>';
    main.parentNode.insertBefore(footer, main.nextSibling);
    var alt = document.querySelector("body > .lang-alt-link");
    if (alt) {
      alt.removeAttribute("style");
      alt.className = "lang-alt-link footer__lang";
      document.getElementById("footerLinks").insertBefore(alt, document.getElementById("footerLinks").firstChild);
    }

    /* shared detail dialog (used by card layouts) */
    var dialog = document.createElement("dialog");
    dialog.className = "dialog";
    dialog.id = "dialog";
    dialog.setAttribute("aria-labelledby", "dialogTitle");
    dialog.innerHTML =
      '<div class="dialog__bar">' +
        '<span class="dialog__spacer"></span>' +
        '<button class="icon-btn" id="dialogClose" type="button" aria-label="Close / 關閉">' +
          '<span class="material-symbols-rounded">close</span>' +
        '</button>' +
      '</div>' +
      '<div class="dialog__body" id="dialogBody"></div>';
    document.body.appendChild(dialog);

    /* dialog wiring (shared close behaviour; deep links handled by app.js) */
    document.getElementById("dialogClose").addEventListener("click", function () {
      if (dialog.open) dialog.close();
    });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
  }

  /* The page index: the paper's seven sections are numbered in reading
     order (the same numbers the home page's contents use); the study tools
     sit in their own group. Short labels keep all of it on screen. */
  function paintNav() {
    var inner = document.getElementById("pageNavInner");
    if (!inner) return;
    var here = currentSlug();
    var n = 0;
    function link(p) {
      var on = p.slug === here;
      var num = p.group === "paper" ? ++n : null;
      return '<a class="navlink' + (on ? " navlink--active" : "") + (p.slug === "home" ? " navlink--home" : "") + '" href="' +
        escapeHtml(pageHref(p)) + '"' + (on ? ' aria-current="page"' : "") + ' title="' + escapeHtml(t(p.title)) + '">' +
        (num ? '<span class="navlink__num">' + num + "</span>" : "") +
        '<span class="navlink__short">' + escapeHtml(t(p.short) || t(p.title)) + "</span>" +
        '<span class="navlink__long">' + escapeHtml(p.slug === "home" ? (t(p.short) || t(p.title)) : t(p.title)) + "</span></a>";
    }
    function group(key) {
      var items = PAGES.filter(function (p) { return p.group === key; });
      if (!items.length) return "";
      return '<div class="navgroup navgroup--' + key + '"><span class="navgroup__label">' + escapeHtml(ui(key)) + "</span>" +
        '<div class="navgroup__links">' + items.map(link).join("") + "</div></div>";
    }
    var home = PAGES.filter(function (p) { return p.slug === "home"; })[0];
    inner.innerHTML = (home ? link(home) : "") + group("paper") + group("kit");
  }

  /* drop-down page index on narrow screens */
  function wireMenu() {
    var btn = document.getElementById("menuToggle");
    var nav = document.getElementById("pageNav");
    if (!btn || !nav) return;
    function set(open) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      nav.classList.toggle("pagenav--open", open);
    }
    btn.addEventListener("click", function () { set(btn.getAttribute("aria-expanded") !== "true"); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("pagenav--open")) { set(false); btn.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (nav.classList.contains("pagenav--open") && !nav.contains(e.target) && !btn.contains(e.target)) set(false);
    });
  }

  /* reading progress hairline under the app bar (every page) */
  function wireProgress() {
    var bar = document.getElementById("readProgress");
    if (!bar) return;
    var ticking = false;
    function paint() {
      ticking = false;
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, h.scrollTop / max) : 0) + ")";
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(paint); }
    }, { passive: true });
    window.addEventListener("resize", paint);
    paint();
  }

  /* ---------- chrome text in the active language ---------- */
  function refreshChrome() {
    var page = currentPage();
    var siteTitle = t(META.title);
    var pageTitle = page ? t(page.title) : "";
    document.title = pageTitle ? pageTitle + " · " + siteTitle : siteTitle;

    var brand = document.getElementById("brandName");
    if (brand) brand.textContent = siteTitle;
    var foot = document.getElementById("footerText");
    if (foot) foot.textContent = "© " + new Date().getFullYear() + " " + siteTitle;
    var note = document.getElementById("footerNote");
    if (note) note.textContent = ui("unofficial");
    var ml = document.getElementById("menuLabel");
    if (ml) ml.textContent = ui("contents");
    var skip = document.getElementById("skipLink");
    if (skip) skip.textContent = ui("skip");
    var nav = document.getElementById("pageNav");
    if (nav) nav.setAttribute("aria-label", ui("menu"));
    var dc = document.getElementById("dialogClose");
    if (dc) dc.setAttribute("aria-label", ui("close"));
    paintNav();
  }

  /* =======================================================================
     THEME + LANGUAGE
     ===================================================================== */
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    var icon = document.getElementById("themeIcon");
    if (icon) icon.textContent = state.theme === "dark" ? "light_mode" : "dark_mode";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", state.theme === "dark" ? "#15140F" : "#F8F7F3");
  }
  /* The toggle is a link now, so it is labelled with the language it leads TO,
     not the one already on screen. */
  function applyLangChrome() {
    var label = document.getElementById("langLabel");
    if (label) label.textContent = state.lang === "en" ? "中" : "EN";
  }

  function wire() {
    document.getElementById("themeToggle").addEventListener("click", function () {
      state.theme = state.theme === "dark" ? "light" : "dark";
      lsSet("theme", state.theme);          // only an explicit choice is remembered
      savedTheme = state.theme;
      applyTheme();
    });
    /* no saved choice yet: keep following the OS as it changes */
    if (mqDark) {
      var onSys = function () { if (!savedTheme) { state.theme = systemTheme(); applyTheme(); } };
      if (mqDark.addEventListener) mqDark.addEventListener("change", onSys);
      else if (mqDark.addListener) mqDark.addListener(onSys);
    }
    wireMenu();
    wireProgress();
  }

  /* =======================================================================
     PUBLIC TOOLKIT (app.js uses this)
     ===================================================================== */
  window.LDW = {
    ready: false,          // flipped true once the chrome (incl. #dialog) is injected
    state: state,
    t: t, ui: ui, escapeHtml: escapeHtml, r: r,
    lsGet: lsGet, lsSet: lsSet,
    pages: PAGES, meta: META,
    currentPage: currentPage, currentSlug: currentSlug, pageHref: pageHref,
    refreshChrome: refreshChrome,
    dialog: function () { return document.getElementById("dialog"); }
  };

  /* =======================================================================
     INIT
     ===================================================================== */
  function init() {
    injectAnalytics();
    injectChrome();
    applyTheme();
    applyLangChrome();
    refreshChrome();
    wire();
    window.LDW.ready = true;
    document.dispatchEvent(new CustomEvent("ldw:shell-ready"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
