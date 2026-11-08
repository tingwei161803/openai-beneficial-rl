/* =========================================================================
   multipage · app.js   (vanilla, no build, no chart lib)

   The PAGE-LEVEL LAYOUT ENGINE. shell.js has already injected the shared
   chrome and published window.LDW. This script:

     1. reads the current page from <body data-page="..."> (via LDW),
     2. picks a renderer from RENDERERS by that page's `layout`,
     3. paints it into <main id="page"> and wires its interactions.

   The language comes from the URL (see shell.js), so the body is painted once
   per page load — there is no in-place language switch to subscribe to.

   RENDERERS is the LAYOUT REGISTRY — one entry per supported page layout:
     hub | gallery | article | dashboard | timeline | table |
     bento | kanban | faq | comparison | leaderboard | scrolly | map
   To add a layout, add one renderer (returns the inner HTML for #page) and,
   if it needs interaction, one matching WIRE entry. Nothing else changes.
   ========================================================================= */
(function () {
  "use strict";

  function boot() {
    // Wait until shell.js has injected the chrome (app bar, nav, footer, #dialog)
    // and published LDW. End-of-body scripts run while readyState === "loading",
    // so the shell defers its injection to DOMContentLoaded — we must wait for it.
    if (!window.LDW || !window.LDW.ready) {
      document.addEventListener("ldw:shell-ready", boot, { once: true });
      return;
    }
    var L = window.LDW;

    var t = L.t, esc = L.escapeHtml, r = L.r;
    var pageEl = document.getElementById("page");
    var teardowns = [];   // observers / listeners to disconnect before each repaint

    /* ---------- shared bits ---------- */
    function head(p) {
      var sub = t(p.subtitle)
        ? '<p class="page-head__sub">' + esc(t(p.subtitle)) + "</p>" : "";
      return '<header class="page-head"><h1>' + esc(t(p.title)) + "</h1>" + sub + "</header>";
    }

    var EN = L.state.lang === "en";
    var COND = { base: EN ? "Baseline" : "基線", rl: EN ? "Beneficial-trait RL" : "有益特質 RL" };

    /* Horizontal bars in HTML (not SVG) so labels keep their CSS size on any
       screen. Each item may carry `cond` ("base" | "rl") to take the
       baseline-slate / trait-RL-teal colour story; `refs` draws dashed
       reference lines (e.g. an aggregate baseline) across every row. */
    function hbars(series, opts) {
      opts = opts || {};
      var max = opts.max || Math.max.apply(null, series.map(function (d) { return d.value; }).concat([0.0001])) * 1.18;
      function x(v) { return r(Math.min(100, (v / max) * 100)); }
      var refs = (opts.refs || []);
      var refMarks = refs.map(function (rf) {
        return '<i class="hbars__ref hbars__ref--' + esc(rf.cond) + '" style="left:' + x(rf.value) + '%"></i>';
      }).join("");
      var legend = refs.length ? '<div class="hbars__row hbars__row--legend" aria-hidden="true"><span class="hbars__label"></span>' +
        '<span class="hbars__track">' + refs.map(function (rf) {
          return '<span class="hbars__reflabel hbars__reflabel--' + esc(rf.cond) + '" style="left:' + x(rf.value) + '%">' +
            esc(t(rf.label)) + " " + esc(String(rf.value)) + "</span>";
        }).join("") + "</span></div>" : "";
      var rows = series.map(function (d) {
        var cond = d.cond || opts.cond || "rl";
        return '<div class="hbars__row" role="listitem"><span class="hbars__label">' + esc(t(d.label)) + "</span>" +
          '<span class="hbars__track">' + refMarks +
            '<span class="hbars__bar hbars__bar--' + esc(cond) + '" style="width:' + x(d.value) + '%"></span>' +
            '<span class="hbars__val" style="left:' + x(d.value) + '%">' + esc(String(d.value)) + "</span>" +
          "</span></div>";
      }).join("");
      return '<div class="hbars' + (refs.length ? " hbars--refs" : "") + '" role="list">' + legend + rows + "</div>";
    }

    /* Slope chart: every paired evaluation as a line from the baseline score
       (left, slate) to the beneficial-trait RL score (right, teal). Geometry
       is in percentages (HTML labels + a stretched SVG with non-scaling
       strokes), so the same markup works at any width and in the static copy. */
    function dodge(items, gap) {
      var a = items.slice().sort(function (p, q) { return p.y - q.y; });
      for (var i = 1; i < a.length; i++) if (a[i].y - a[i - 1].y < gap) a[i].y = a[i - 1].y + gap;
      var over = a.length ? a[a.length - 1].y - 100 : 0;
      if (over > 0) {
        a[a.length - 1].y = 100;
        for (var j = a.length - 2; j >= 0; j--) if (a[j + 1].y - a[j].y < gap) a[j].y = a[j + 1].y - gap;
      }
      return items;
    }
    function slopeChart(rows, opts) {
      opts = opts || {};
      var vals = [];
      rows.forEach(function (d) { vals.push(d.base, d.rl); });
      var lo = Math.floor(Math.min.apply(null, vals) * 10) / 10, hi = Math.ceil(Math.max.apply(null, vals) * 10) / 10;
      var span = (hi - lo) || 1;
      function y(v) { return r((hi - v) / span * 100); }
      var L = rows.map(function (d, i) { return { i: i, y: y(d.base), d: d }; });
      var R = rows.map(function (d, i) { return { i: i, y: y(d.rl), d: d }; });
      dodge(L, 4.2); dodge(R, 6);
      var lines = rows.map(function (d, i) {
        return '<line class="slope__line' + (d.agg ? " slope__line--agg" : "") + (d.cap ? " slope__line--cap" : "") +
          '" x1="0" y1="' + y(d.base) + '" x2="100" y2="' + y(d.rl) + '" vector-effect="non-scaling-stroke" data-i="' + i + '" />';
      }).join("");
      var dots = rows.map(function (d, i) {
        var k = d.agg ? " slope__dot--agg" : "";
        return '<span class="slope__dot slope__dot--base' + k + '" style="left:0%;top:' + y(d.base) + '%"></span>' +
               '<span class="slope__dot slope__dot--rl' + k + '" style="left:100%;top:' + y(d.rl) + '%"></span>';
      }).join("");
      var agg = rows.filter(function (d) { return d.agg; })[0];
      var note = agg ? '<span class="slope__note" style="top:' + r((y(agg.base) + y(agg.rl)) / 2) + '%">+' +
        (Math.round((agg.rl - agg.base) * 100) / 100).toFixed(2) + "</span>" : "";
      var lvals = L.map(function (o) {
        return '<span class="slope__v' + (o.d.agg ? " slope__v--agg" : "") + '" style="top:' + r(o.y) + '%">' + esc(o.d.baseTxt || String(o.d.base)) + "</span>";
      }).join("");
      var labels = R.map(function (o) {
        var d = o.d;
        return '<span class="slope__lab' + (d.agg ? " slope__lab--agg" : "") + (d.cap ? " slope__lab--cap" : "") + '" style="top:' + r(o.y) + '%">' +
          '<b class="slope__rv">' + esc(d.rlTxt || String(d.rl)) + "</b> " +
          '<span class="slope__name">' + esc(d.name) + "</span>" +
          (d.delta ? ' <span class="slope__delta">' + esc(d.delta) + "</span>" : "") + "</span>";
      }).join("");
      var sr = '<ul class="sr-only">' + rows.map(function (d) {
        return "<li>" + esc(d.name) + ": " + esc(COND.base) + " " + esc(String(d.base)) + " → " + esc(COND.rl) + " " + esc(String(d.rl)) + "</li>";
      }).join("") + "</ul>";
      return '<div class="slope' + (opts.hero ? " slope--hero" : "") + '">' +
        '<div class="slope__head" aria-hidden="true"><span></span><span class="slope__hpair">' +
          '<span class="slope__h slope__h--base">' + esc(COND.base) + "</span>" +
          '<span class="slope__h slope__h--rl">' + esc(COND.rl) + "</span></span><span></span></div>" +
        '<div class="slope__body" aria-hidden="true">' +
          '<div class="slope__lvals">' + lvals + "</div>" +
          '<div class="slope__plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">' +
            '<defs><linearGradient id="slopeGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0">' +
              '<stop offset="0" class="slope__g0" /><stop offset="1" class="slope__g1" /></linearGradient></defs>' +
            '<line class="slope__axis" x1="0" y1="0" x2="0" y2="100" vector-effect="non-scaling-stroke" />' +
            '<line class="slope__axis" x1="100" y1="0" x2="100" y2="100" vector-effect="non-scaling-stroke" />' +
            lines + "</svg>" + dots + note + "</div>" +
          '<div class="slope__labels">' + labels + "</div>" +
        "</div>" + sr + "</div>";
    }
    /* the paired rows the paper reports, in slope-chart form */
    function pairedRows(res, withAgg, aggName) {
      var rows = ((res.table && res.table.rows) || []).map(function (row) {
        var name = t(row.eval);
        return { name: name, base: parseFloat(row.baseline), rl: parseFloat(row.rl), delta: row.delta,
                 baseTxt: String(row.baseline), rlTxt: String(row.rl),
                 cap: /capabilit|能力/i.test(name) };
      });
      if (withAgg && res.bars && res.bars.baselineAggregate != null) {
        rows.unshift({ name: aggName, base: res.bars.baselineAggregate, rl: res.bars.rlAggregate,
                       delta: "", agg: true });
      }
      return rows;
    }
    function firstSentence(s) {
      var m = String(s || "").match(/^.*?(?:[。！？]|[.!?](?=\s|$))/);
      return m ? m[0] : s;
    }

    function lineChart(points) {
      var W = 520, H = 240, padL = 28, padR = 16, padT = 16, padB = 32;
      var plotW = W - padL - padR, plotH = H - padT - padB;
      var ys = points.map(function (d) { return d.y; });
      var max = Math.max.apply(null, ys.concat([1])), min = Math.min.apply(null, ys.concat([0]));
      var span = (max - min) || 1, n = points.length || 1;
      var xy = points.map(function (d, i) {
        var x = padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
        var y = padT + plotH - ((d.y - min) / span) * plotH;
        return { x: x, y: y, d: d };
      });
      var path = xy.map(function (pt, i) { return (i ? "L" : "M") + r(pt.x) + " " + r(pt.y); }).join(" ");
      var area = path + " L" + r(xy[xy.length - 1].x) + " " + r(padT + plotH) + " L" + r(xy[0].x) + " " + r(padT + plotH) + " Z";
      var dots = xy.map(function (pt) {
        return '<circle class="line-dot" cx="' + r(pt.x) + '" cy="' + r(pt.y) + '" r="3"><title>' +
          esc(String(pt.d.x)) + ": " + esc(String(pt.d.y)) + "</title></circle>";
      }).join("");
      var labels = xy.map(function (pt) {
        return '<text class="bar-label" x="' + r(pt.x) + '" y="' + r(padT + plotH + 20) + '" text-anchor="middle">' + esc(String(pt.d.x)) + "</text>";
      }).join("");
      return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" preserveAspectRatio="xMidYMid meet" aria-label="line chart">' +
        '<path class="line-area" d="' + area + '" />' +
        '<path class="line-path" d="' + path + '" fill="none" />' + dots + labels + "</svg>";
    }

    /* =====================================================================
       LAYOUT REGISTRY
       ===================================================================== */
    var RENDERERS = {

      /* ---- hub: research-explainer front page ----
         title + abstract, then the key figure (baseline → trait-RL slope chart)
         with its margin notes, a numbered contents list of the paper's
         sections, and the study tools as a separate band. */
      hub: function (p) {
        var res = L.pages.filter(function (q) { return q.slug === "results"; })[0] || {};
        var fig = p.figure || {};
        var gain = (res.stats || [])[1];
        var facts = (p.stats || []).map(function (s) {
          return '<div class="facts__row"><dt>' + esc(String(s.value)) + "</dt><dd>" + esc(t(s.label)) + "</dd></div>";
        }).join("");
        var paper = L.pages.filter(function (q) { return q.group === "paper"; });
        var kit = L.pages.filter(function (q) { return q.group === "kit"; });
        var toc = paper.map(function (q, i) {
          return '<li><a class="toc-entry" href="' + esc(L.pageHref(q)) + '">' +
            '<span class="toc-entry__num">' + (i + 1) + "</span>" +
            '<span class="toc-entry__title">' + esc(t(q.title)) + "</span>" +
            '<span class="toc-entry__desc">' + esc(firstSentence(t(q.subtitle))) + "</span></a></li>";
        }).join("");
        var cards = kit.map(function (q) {
          return '<a class="kit-card kit-card--' + esc(q.slug) + '" href="' + esc(L.pageHref(q)) + '">' +
            '<span class="material-symbols-rounded kit-card__icon" aria-hidden="true">' + esc(q.icon || "label") + "</span>" +
            '<span class="kit-card__title">' + esc(t(q.title)) + "</span>" +
            '<span class="kit-card__desc">' + esc(firstSentence(t(q.subtitle))) + "</span></a>";
        }).join("");
        return '<header class="page-head hero">' +
            "<h1>" + esc(t(p.title)) + "</h1>" +
            '<p class="hero__abstract">' + esc(t(p.subtitle)) + "</p>" +
            (t(p.kicker) ? '<p class="hero__byline">' + esc(t(p.kicker)) + "</p>" : "") +
          "</header>" +
          '<figure class="fig fig--hero">' +
            '<div class="fig__grid">' +
              '<div class="fig__main">' +
                (t(fig.title) ? '<p class="fig__title">' + esc(t(fig.title)) + "</p>" : "") +
                slopeChart(pairedRows(res, true, t(fig.aggregate)), { hero: true }) +
              "</div>" +
              '<aside class="fig__margin">' +
                (gain ? '<p class="fig__big"><span class="fig__big-num">' + esc(String(gain.value)) + "</span>" +
                  '<span class="fig__big-unit">' + esc(t(gain.unit)) + "</span></p>" +
                  '<p class="fig__big-label">' + esc(t(fig.headline)) + "</p>" : "") +
                '<dl class="facts">' + facts + "</dl>" +
              "</aside>" +
            "</div>" +
            '<figcaption class="fig__caption"><span class="fig__no">' + (EN ? "Figure 1." : "圖 1") + "</span> " + esc(t(fig.caption)) + "</figcaption>" +
          "</figure>" +
          '<section class="home-sec" aria-labelledby="tocH">' +
            '<h2 class="home-sec__h" id="tocH">' + (EN ? "Contents" : "目錄") + "</h2>" +
            '<ol class="toc-list">' + toc + "</ol>" +
          "</section>" +
          '<section class="home-sec kit" aria-labelledby="kitH">' +
            '<div class="kit__intro"><h2 class="home-sec__h" id="kitH">' + (EN ? "Study kit" : "學習工具") + "</h2>" +
            "<p>" + (EN ? "Finished reading? Check what stuck with the flashcards and the quiz, or look up a term."
                         : "讀完之後，用字卡和測驗檢查自己記住了多少，或回頭查術語。") + "</p></div>" +
            '<div class="kit__cards">' + cards + "</div>" +
          "</section>";
      },

      /* ---- gallery: search + chips + card grid + dialog ---- */
      gallery: function (p) {
        var cats = (p.categories || []).map(function (c) {
          return '<button class="chip" type="button" data-cat="' + esc(c.key) + '">' +
            esc(c[L.state.lang] || c.en) + "</button>";
        }).join("");
        var allLabel = L.state.lang === "en" ? "All" : "全部";
        return head(p) +
          '<div class="toolbar">' +
            '<input id="search" class="search" type="search" autocomplete="off" ' +
              'placeholder="' + (L.state.lang === "en" ? "Search…" : "搜尋…") + '" ' +
              'aria-label="' + (L.state.lang === "en" ? "Search" : "搜尋") + '" />' +
            (cats ? '<div class="chips"><button class="chip chip--active" type="button" data-cat="">' + esc(allLabel) + "</button>" + cats + "</div>" : "") +
          "</div>" +
          '<p class="result-count" id="resultCount" aria-live="polite"></p>' +
          '<div class="grid" id="grid"></div>';
      },

      /* ---- article: sticky TOC + prose + reading progress ---- */
      article: function (p) {
        var toc = (p.sections || []).map(function (s, si) {
          return '<a class="toc-link" href="#' + esc(s.id) + '" data-toc="' + esc(s.id) + '"><span class="toc-link__num">' + (si + 1) + "</span>" + esc(t(s.heading)) + "</a>";
        }).join("");
        var body = (p.sections || []).map(function (s, si) {
          var blocks = (s.blocks || []).map(function (b) {
            if (b.type === "h3") return "<h3>" + esc(t(b.text)) + "</h3>";
            if (b.type === "quote") return "<blockquote>" + esc(t(b.text)) + "</blockquote>";
            if (b.type === "code") return "<pre><code>" + esc(t(b.text)) + "</code></pre>";
            if (b.type === "ul") {
              var arr = (b.items && (b.items[L.state.lang] || b.items.en || b.items.zh)) || [];
              return "<ul>" + arr.map(function (li) { return "<li>" + esc(li) + "</li>"; }).join("") + "</ul>";
            }
            return "<p>" + esc(t(b.text)) + "</p>";
          }).join("");
          return '<section class="article-section" id="' + esc(s.id) + '" data-item ' +
            'aria-labelledby="' + esc(s.id) + '-h"><h2 id="' + esc(s.id) + '-h"><span class="sec-num">' + (si + 1) + "</span>" + esc(t(s.heading)) + "</h2>" + blocks + "</section>";
        }).join("");
        return head(p) +
          '<div class="article-layout">' +
            '<nav class="toc" aria-label="Contents"><div class="toc__inner">' + toc + "</div></nav>" +
            '<div class="article-body prose">' + body + "</div>" +
          "</div>";
      },

      /* ---- dashboard (results): key numbers, the held-out trait chart with
         the baseline drawn in, the paired baseline → RL slope chart, table ---- */
      dashboard: function (p) {
        var stats = (p.stats || []).map(function (s) {
          var d = s.delta;
          return '<div class="keynum">' +
            '<dt class="keynum__label">' + esc(t(s.label)) + "</dt>" +
            '<dd class="keynum__value">' + esc(String(s.value)) +
              (t(s.unit) ? ' <span class="keynum__unit">' + esc(t(s.unit)) + "</span>" : "") +
              ((d === 0 || d) ? ' <span class="keynum__pct">' + esc(String(d)) + "%</span>" : "") + "</dd></div>";
        }).join("");
        var bars = "";
        if (p.bars) {
          var refs = [];
          if (p.bars.baselineAggregate != null) refs.push({ cond: "base", value: p.bars.baselineAggregate, label: COND.base });
          if (p.bars.rlAggregate != null) refs.push({ cond: "rl", value: p.bars.rlAggregate, label: EN ? "Trait RL" : "特質 RL" });
          bars = '<figure class="fig" data-item>' +
            '<p class="fig__title">' + esc(t(p.bars.title)) + "</p>" +
            hbars(p.bars.series || [], { max: 1, refs: refs, cond: "rl" }) +
            '<figcaption class="fig__caption"><span class="fig__no">' + (EN ? "Figure 1." : "圖 1") + "</span> " + esc(t(p.bars.note)) + "</figcaption>" +
          "</figure>";
        }
        var slope = (p.table && p.table.rows) ? '<figure class="fig" data-item>' +
            '<p class="fig__title">' + (EN ? "Baseline → beneficial-trait RL, evaluation by evaluation" : "逐項評測：基線 → 有益特質 RL") + "</p>" +
            slopeChart(pairedRows(p, false)) +
            '<figcaption class="fig__caption"><span class="fig__no">' + (EN ? "Figure 2." : "圖 2") + "</span> " +
              (EN ? "Each line joins the two models' scores on one evaluation from the table below; the vermilion figure is the gap. Higher is better."
                  : "每條線連起兩個模型在下表同一項評測上的分數；朱紅數字是差距。越高越好。") + "</figcaption>" +
          "</figure>" : "";
        var table = "";
        if (p.table) {
          var thead = (p.table.columns || []).map(function (c) {
            return '<th class="col-' + esc(c.key) + '">' + esc(t(c.label)) + "</th>"; }).join("");
          var tbody = (p.table.rows || []).map(function (row) {
            return "<tr>" + (p.table.columns || []).map(function (c) {
              var v = row[c.key];
              return '<td class="col-' + esc(c.key) + '">' + esc(typeof v === "object" ? t(v) : String(v == null ? "" : v)) + "</td>";
            }).join("") + "</tr>";
          }).join("");
          table = '<div class="table-wrap table-wrap--results" data-item><table class="data-table data-table--results">' +
            "<thead><tr>" + thead + "</tr></thead><tbody>" + tbody + "</tbody></table></div>";
        }
        return head(p) +
          '<dl class="keynums">' + stats + "</dl>" + bars + slope + table;
      },

      /* ---- timeline: dated event cards down a rail ---- */
      timeline: function (p) {
        var items = (p.events || []).map(function (ev) {
          return '<li class="tl-item" data-item><div class="tl-dot" aria-hidden="true"></div>' +
            '<div class="tl-card"><span class="tl-date">' + esc(t(ev.date)) + "</span>" +
            '<h3 class="tl-title">' + esc(t(ev.title)) + "</h3>" +
            '<p class="tl-body">' + esc(t(ev.body)) + "</p></div></li>";
        }).join("");
        return head(p) + '<ol class="timeline">' + items + "</ol>";
      },

      /* ---- table: searchable + sortable ---- */
      table: function (p) {
        return head(p) +
          '<div class="toolbar">' +
            '<input id="search" class="search" type="search" autocomplete="off" ' +
              'placeholder="' + (L.state.lang === "en" ? "Search…" : "搜尋…") + '" ' +
              'aria-label="' + (L.state.lang === "en" ? "Search" : "搜尋") + '" />' +
            '<div class="chips" id="tableChips"></div>' +
          "</div>" +
          '<div class="table-wrap"><table class="data-table" id="dataTable"><thead></thead><tbody></tbody></table></div>';
      },

      /* ---- bento: asymmetric tile grid ---- */
      bento: function (p) {
        var tiles = (p.tiles || []).map(function (tile) {
          return '<article class="tile tile--' + esc(tile.size || "sm") + (tile.accent ? " tile--accent" : "") + '" data-item>' +
            (tile.icon ? '<span class="material-symbols-rounded tile__icon" aria-hidden="true">' + esc(tile.icon) + "</span>" : "") +
            (tile.value ? '<b class="tile__value">' + esc(tile.value) + "</b>" : "") +
            '<h3 class="tile__title">' + esc(t(tile.title)) + "</h3>" +
            (t(tile.body) ? '<p class="tile__body">' + esc(t(tile.body)) + "</p>" : "") + "</article>";
        }).join("");
        return head(p) + '<div class="bento">' + tiles + "</div>";
      },

      /* ---- kanban: cards grouped by status column ---- */
      kanban: function (p) {
        var cols = (p.columns || []).map(function (col) {
          var cards = (p.cards || []).filter(function (c) { return c.column === col.key; }).map(function (c) {
            var tags = (c.tags || []).map(function (g) { return '<span class="tag">' + esc(g) + "</span>"; }).join("");
            return '<article class="kb-card" data-item><h3 class="kb-card__title">' + esc(t(c.title)) + "</h3>" +
              (t(c.body) ? '<p class="kb-card__body">' + esc(t(c.body)) + "</p>" : "") +
              (tags ? '<div class="card__tags">' + tags + "</div>" : "") + "</article>";
          }).join("");
          var count = (p.cards || []).filter(function (c) { return c.column === col.key; }).length;
          return '<div class="kb-col"><div class="kb-col__head">' + esc(t(col.label)) +
            ' <span class="kb-col__count">' + count + "</span></div>" +
            '<div class="kb-col__body">' + cards + "</div></div>";
        }).join("");
        return head(p) + '<div class="kanban">' + cols + "</div>";
      },

      /* ---- faq: searchable accordion ---- */
      faq: function (p) {
        var items = (p.qa || []).map(function (row) {
          return '<details class="acc-item" data-item data-q="' + esc((t(row.q) + " " + t(row.a)).toLowerCase()) + '">' +
            '<summary class="acc-q"><span>' + esc(t(row.q)) + "</span>" +
            '<span class="material-symbols-rounded acc-chevron" aria-hidden="true">expand_more</span></summary>' +
            '<div class="acc-a">' + esc(t(row.a)) + "</div></details>";
        }).join("");
        return head(p) +
          '<div class="toolbar"><input id="search" class="search" type="search" autocomplete="off" ' +
            'placeholder="' + (L.state.lang === "en" ? "Search…" : "搜尋…") + '" ' +
            'aria-label="' + (L.state.lang === "en" ? "Search" : "搜尋") + '" /></div>' +
          '<div class="accordion" id="accordion">' + items + "</div>";
      },

      /* ---- comparison: plans (cols) x features (rows) ---- */
      comparison: function (p) {
        var plans = p.plans || [], feats = p.features || [];
        var thead = '<th scope="col"></th>' + plans.map(function (pl) {
          return '<th scope="col" class="' + (pl.highlight ? "cmp-col--hl" : "") + '">' +
            '<div class="cmp-plan">' + esc(t(pl.name)) + "</div>" +
            '<div class="cmp-price">' + esc(t(pl.price)) + "</div>" +
            (t(pl.note) ? '<div class="cmp-note">' + esc(t(pl.note)) + "</div>" : "") + "</th>";
        }).join("");
        var rows = feats.map(function (f) {
          var cells = plans.map(function (pl) {
            var v = f.values ? f.values[pl.key] : undefined;
            var cell;
            if (v === true) cell = '<span class="cmp-yes material-symbols-rounded" aria-label="yes">check</span>';
            else if (v === false || v == null) cell = '<span class="cmp-no" aria-label="no">—</span>';
            else cell = esc(t(v));
            return '<td class="' + (pl.highlight ? "cmp-col--hl" : "") + '">' + cell + "</td>";
          }).join("");
          return '<tr data-item><th scope="row" class="cmp-feat">' + esc(t(f.label)) + "</th>" + cells + "</tr>";
        }).join("");
        return head(p) + '<div class="table-wrap"><table class="cmp-table">' +
          "<thead><tr>" + thead + "</tr></thead><tbody>" + rows + "</tbody></table></div>";
      },

      /* ---- leaderboard: ranked list + tier grouping toggle ---- */
      leaderboard: function (p) {
        var listLabel = L.state.lang === "en" ? "List" : "排名";
        var tierLabel = L.state.lang === "en" ? "Tiers" : "階級";
        return head(p) +
          '<div class="seg" role="tablist">' +
            '<button class="seg__btn seg__btn--active" type="button" data-view="list">' + esc(listLabel) + "</button>" +
            '<button class="seg__btn" type="button" data-view="tier">' + esc(tierLabel) + "</button>" +
          "</div>" +
          '<div id="lbView"></div>';
      },

      /* ---- scrolly: sticky visual + stepped narrative ---- */
      scrolly: function (p) {
        var steps = (p.steps || []).map(function (s, i) {
          return '<div class="scrolly-step" data-item data-step="' + i + '"><p>' + esc(t(s.text)) + "</p></div>";
        }).join("");
        return head(p) +
          '<div class="scrolly">' +
            '<div class="scrolly-sticky"><div class="scrolly-visual" id="scrollyVisual"></div></div>' +
            '<div class="scrolly-steps">' + steps + "</div>" +
          "</div>";
      },

      /* ---- map: Leaflet map + list (needs Leaflet on the page) ---- */
      map: function (p) {
        return head(p) +
          '<div class="map-layout">' +
            '<div class="map-box" id="map" role="application" aria-label="Map"></div>' +
            '<ul class="map-list" id="mapList"></ul>' +
          "</div>";
      },

      /* ---- examples: paired baseline vs improved responses (custom) ---- */
      examples: function (p) {
        var L1 = L.state.lang === "en" ? "Baseline" : "基線";
        var L2 = L.state.lang === "en" ? "Beneficial-trait model" : "有益特質模型";
        var userLbl = L.state.lang === "en" ? "User" : "使用者";
        var cards = (p.examples || []).map(function (ex) {
          return '<article class="ex-card" data-item id="' + esc(ex.slug) + '">' +
            '<div class="ex-meta">' +
              '<span class="tag ex-trait">' + esc(t(ex.trait)) + "</span>" +
              '<span class="ex-domain">' + esc(t(ex.domain)) + "</span>" +
            "</div>" +
            '<div class="ex-user"><span class="ex-role">' + esc(userLbl) + "</span>" +
              "<p>" + esc(t(ex.user)) + "</p></div>" +
            '<div class="ex-resps">' +
              '<div class="ex-resp ex-resp--baseline"><span class="ex-resp__label">' + esc(L1) + "</span>" +
                "<p>" + esc(t(ex.baseline)) + "</p></div>" +
              '<div class="ex-resp ex-resp--beneficial"><span class="ex-resp__label">' + esc(L2) + "</span>" +
                "<p>" + esc(t(ex.beneficial)) + "</p></div>" +
            "</div></article>";
        }).join("");
        return head(p) + '<div class="ex-list">' + cards + "</div>";
      },

      /* ---- glossary: searchable definition list (custom) ---- */
      glossary: function (p) {
        var items = (p.terms || []).map(function (g) {
          return '<div class="gloss-item" data-item data-q="' + esc((t(g.term) + " " + t(g.def)).toLowerCase()) + '">' +
            '<dt class="gloss-term">' + esc(t(g.term)) + "</dt>" +
            '<dd class="gloss-def">' + esc(t(g.def)) + "</dd></div>";
        }).join("");
        return head(p) +
          '<div class="toolbar"><input id="search" class="search" type="search" autocomplete="off" ' +
            'placeholder="' + (L.state.lang === "en" ? "Search terms…" : "搜尋術語…") + '" ' +
            'aria-label="' + (L.state.lang === "en" ? "Search terms" : "搜尋術語") + '" /></div>' +
          '<dl class="glossary">' + items + "</dl>";
      },

      /* ---- flashcards: click-to-flip term/definition cards (custom) ---- */
      flashcards: function (p) {
        var hint = L.state.lang === "en" ? "Tap to flip" : "點擊翻面";
        var cards = (p.cards || []).map(function (c, i) {
          return '<div class="flashcard" role="button" tabindex="0" data-item aria-label="' + esc(t(c.front)) + '">' +
            '<div class="flashcard__inner">' +
              '<div class="flashcard__face flashcard__front">' +
                '<span class="flashcard__num">' + (i + 1) + "</span>" +
                '<span class="flashcard__term">' + esc(t(c.front)) + "</span>" +
                '<span class="flashcard__hint">' + esc(hint) + "</span></div>" +
              '<div class="flashcard__face flashcard__back">' +
                '<span class="flashcard__def">' + esc(t(c.back)) + "</span></div>" +
            "</div></div>";
        }).join("");
        return head(p) + '<div class="flashcards">' + cards + "</div>";
      },

      /* ---- quiz: in-session multiple choice with scoring (custom) ---- */
      quiz: function (p) {
        var n = (p.questions || []).length;
        var scoreLbl = L.state.lang === "en" ? "Score" : "得分";
        var qs = (p.questions || []).map(function (q, qi) {
          var opts = (q.options || []).map(function (o, oi) {
            return '<button class="quiz-opt" type="button" data-q="' + qi + '" data-o="' + oi + '">' +
              '<span class="quiz-opt__mark material-symbols-rounded" aria-hidden="true"></span>' +
              '<span class="quiz-opt__txt">' + esc(t(o)) + "</span></button>";
          }).join("");
          return '<div class="quiz-q" data-item data-q="' + qi + '" data-answer="' + (q.answer | 0) + '">' +
            '<h3 class="quiz-q__prompt"><span class="quiz-q__num">' + (qi + 1) + "</span>" + esc(t(q.q)) + "</h3>" +
            '<div class="quiz-opts">' + opts + "</div>" +
            '<div class="quiz-explain" hidden>' + esc(t(q.explain)) + "</div></div>";
        }).join("");
        return head(p) +
          '<div class="quiz-score" id="quizScore" aria-live="polite"><span>' + esc(scoreLbl) +
            '</span> <b id="quizScoreVal">0 / ' + n + "</b></div>" +
          '<div class="quiz">' + qs + "</div>";
      }
    };

    /* =====================================================================
       WIRING (interactions) — keyed by layout, run after innerHTML is set
       ===================================================================== */
    var WIRE = {
      hub: function () { /* static figure; motion handled in setupMotion */ },

      gallery: function (p) {
        var grid = document.getElementById("grid");
        var search = document.getElementById("search");
        var count = document.getElementById("resultCount");
        var chips = [].slice.call(pageEl.querySelectorAll(".chip"));
        var st = { q: "", cat: "" };

        function matches(item) {
          if (st.cat && item.category !== st.cat) return false;
          if (!st.q) return true;
          var hay = (t(item.title) + " " + t(item.summary) + " " + (item.tags || []).join(" ")).toLowerCase();
          return hay.indexOf(st.q) !== -1;
        }
        function paint() {
          var rows = (p.items || []).filter(matches);
          grid.innerHTML = rows.map(function (item) {
            var tags = (item.tags || []).map(function (g) { return '<span class="tag">' + esc(g) + "</span>"; }).join("");
            return '<article class="card card--' + esc(item.category || "item") + '" tabindex="0" role="button" data-item data-slug="' + esc(item.slug) + '" ' +
              'aria-label="' + esc(t(item.title)) + '">' +
              '<h3 class="card__title">' + esc(t(item.title)) + "</h3>" +
              '<p class="card__summary">' + esc(t(item.summary)) + "</p>" +
              (tags ? '<div class="card__tags">' + tags + "</div>" : "") + "</article>";
          }).join("");
          if (count) count.textContent = rows.length + (L.state.lang === "en" ? " result(s)" : " 筆結果");
          wireCards();
        }
        function wireCards() {
          [].forEach.call(grid.querySelectorAll(".card[data-slug]"), function (card) {
            var slug = card.dataset.slug;
            card.addEventListener("click", function () { openItem(slug); });
            card.addEventListener("keydown", function (e) {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openItem(slug); }
            });
          });
        }
        function findItem(slug) {
          return (p.items || []).filter(function (it) { return it.slug === slug; })[0] || null;
        }
        function openItem(slug) {
          var item = findItem(slug); if (!item) return;
          var dlg = L.dialog(), body = document.getElementById("dialogBody");
          var tags = (item.tags || []).map(function (g) { return '<span class="tag">' + esc(g) + "</span>"; }).join("");
          body.innerHTML = '<h2 id="dialogTitle">' + esc(t(item.title)) + "</h2>" +
            (tags ? '<div class="card__tags">' + tags + "</div>" : "") +
            "<p>" + esc(t(item.overview) || t(item.summary)) + "</p>";
          if (!dlg.open) dlg.showModal();
          if (location.hash.slice(1) !== slug) history.replaceState(null, "", "#" + slug);
        }
        function syncHash() {
          var slug = location.hash.slice(1);
          if (slug && findItem(slug)) openItem(slug);
        }
        if (search) search.addEventListener("input", function () { st.q = this.value.trim().toLowerCase(); paint(); });
        chips.forEach(function (chip) {
          chip.addEventListener("click", function () {
            chips.forEach(function (c) { c.classList.remove("chip--active"); });
            chip.classList.add("chip--active");
            st.cat = chip.dataset.cat || "";
            paint();
          });
        });
        /* closing the dialog clears the #slug so the URL returns to clean state
           and a later deep link to the SAME slug fires hashchange again */
        var dlg = L.dialog();
        function onClose() {
          var slug = location.hash.slice(1);
          if (slug && findItem(slug)) history.replaceState(null, "", location.pathname + location.search);
        }
        dlg.addEventListener("close", onClose);
        var onHash = function () { syncHash(); };
        window.addEventListener("hashchange", onHash);
        teardowns.push(function () {
          window.removeEventListener("hashchange", onHash);
          dlg.removeEventListener("close", onClose);
        });
        paint();
        syncHash();
      },

      article: function () {
        var links = [].slice.call(pageEl.querySelectorAll(".toc-link"));
        var secs = [].slice.call(pageEl.querySelectorAll(".article-section"));
        if ("IntersectionObserver" in window) {
          var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
              if (!en.isIntersecting) return;
              links.forEach(function (a) {
                var on = a.dataset.toc === en.target.id;
                a.classList.toggle("toc-link--active", on);
              });
            });
          }, { rootMargin: "-30% 0px -60% 0px" });
          secs.forEach(function (s) { io.observe(s); });
          teardowns.push(function () { io.disconnect(); });
        }
      },

      dashboard: function () { /* static charts; nothing to wire */ },

      table: function (p) {
        var table = document.getElementById("dataTable");
        var thead = table.querySelector("thead"), tbody = table.querySelector("tbody");
        var search = document.getElementById("search");
        var chipsBox = document.getElementById("tableChips");
        var cols = p.columns || [];
        var st = { q: "", filter: "", sortKey: null, dir: 1 };
        var filterCol = cols.filter(function (c) { return c.filter; })[0];

        function cellText(row, c) { var v = row[c.key]; return typeof v === "object" ? t(v) : String(v == null ? "" : v); }
        function rowMatches(row) {
          if (filterCol && st.filter && cellText(row, filterCol) !== st.filter) return false;
          if (!st.q) return true;
          return cols.some(function (c) { return cellText(row, c).toLowerCase().indexOf(st.q) !== -1; });
        }
        function paintHead() {
          thead.innerHTML = "<tr>" + cols.map(function (c) {
            var arrow = st.sortKey === c.key ? (st.dir > 0 ? " ▲" : " ▼") : "";
            return '<th class="th-sort" data-key="' + esc(c.key) + '" role="button" tabindex="0" aria-label="Sort by ' +
              esc(t(c.label)) + '">' + esc(t(c.label)) + esc(arrow) + "</th>";
          }).join("") + "</tr>";
          [].forEach.call(thead.querySelectorAll(".th-sort"), function (th) {
            th.addEventListener("click", function () { sortBy(th.dataset.key); });
            th.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sortBy(th.dataset.key); } });
          });
        }
        function sortBy(key) {
          if (st.sortKey === key) st.dir = -st.dir; else { st.sortKey = key; st.dir = 1; }
          paint();
        }
        function paint() {
          paintHead();
          var col = cols.filter(function (c) { return c.key === st.sortKey; })[0];
          var rows = (p.rows || []).filter(rowMatches).slice();
          if (col) {
            rows.sort(function (a, b) {
              var va = a[col.key], vb = b[col.key];
              if (col.type === "num") return (Number(va) - Number(vb)) * st.dir;
              return String(typeof va === "object" ? t(va) : va).localeCompare(String(typeof vb === "object" ? t(vb) : vb)) * st.dir;
            });
          }
          tbody.innerHTML = rows.map(function (row) {
            return "<tr data-item>" + cols.map(function (c) {
              if (c.type === "link") {
                var u = row[c.key];
                return '<td><a class="row-link" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u) + "</a></td>";
              }
              return "<td>" + esc(cellText(row, c)) + "</td>";
            }).join("") + "</tr>";
          }).join("");
        }
        if (filterCol) {
          var vals = [];
          (p.rows || []).forEach(function (row) { var v = cellText(row, filterCol); if (vals.indexOf(v) === -1) vals.push(v); });
          var allLabel = L.state.lang === "en" ? "All" : "全部";
          chipsBox.innerHTML = '<button class="chip chip--active" type="button" data-v="">' + esc(allLabel) + "</button>" +
            vals.map(function (v) { return '<button class="chip" type="button" data-v="' + esc(v) + '">' + esc(v) + "</button>"; }).join("");
          [].forEach.call(chipsBox.querySelectorAll(".chip"), function (chip) {
            chip.addEventListener("click", function () {
              [].forEach.call(chipsBox.querySelectorAll(".chip"), function (c) { c.classList.remove("chip--active"); });
              chip.classList.add("chip--active");
              st.filter = chip.dataset.v || "";
              paint();
            });
          });
        }
        if (search) search.addEventListener("input", function () { st.q = this.value.trim().toLowerCase(); paint(); });
        paint();
      },

      bento: function () { /* static */ },
      kanban: function () { /* static */ },

      faq: function () {
        var search = document.getElementById("search");
        var items = [].slice.call(pageEl.querySelectorAll(".acc-item"));
        if (search) search.addEventListener("input", function () {
          var q = this.value.trim().toLowerCase();
          items.forEach(function (it) {
            var hit = !q || (it.dataset.q || "").indexOf(q) !== -1;
            it.style.display = hit ? "" : "none";
          });
        });
      },

      comparison: function () { /* static */ },

      leaderboard: function (p) {
        var view = document.getElementById("lbView");
        var btns = [].slice.call(pageEl.querySelectorAll(".seg__btn"));
        var entries = (p.entries || []).slice().sort(function (a, b) { return b.score - a.score; });
        function row(e, rank) {
          return '<li class="lb-row" data-item>' +
            (rank ? '<span class="lb-rank">' + rank + "</span>" : "") +
            '<span class="lb-tier lb-tier--' + esc(e.tier || "") + '">' + esc(e.tier || "") + "</span>" +
            '<span class="lb-name">' + esc(t(e.name)) + "</span>" +
            '<span class="lb-meta">' + esc(t(e.meta)) + "</span>" +
            '<span class="lb-score">' + esc(String(e.score)) + "</span></li>";
        }
        function listView() {
          view.innerHTML = '<ol class="lb-list">' + entries.map(function (e, i) { return row(e, i + 1); }).join("") + "</ol>";
        }
        function tierView() {
          var tiers = [];
          entries.forEach(function (e) { if (tiers.indexOf(e.tier) === -1) tiers.push(e.tier); });
          view.innerHTML = tiers.map(function (tier) {
            var rows = entries.filter(function (e) { return e.tier === tier; }).map(function (e) { return row(e); }).join("");
            return '<div class="lb-tier-group"><div class="lb-tier-head lb-tier--' + esc(tier) + '">' + esc(tier) + "</div>" +
              '<ol class="lb-list">' + rows + "</ol></div>";
          }).join("");
        }
        btns.forEach(function (b) {
          b.addEventListener("click", function () {
            btns.forEach(function (x) { x.classList.remove("seg__btn--active"); });
            b.classList.add("seg__btn--active");
            if (b.dataset.view === "tier") tierView(); else listView();
          });
        });
        listView();
      },

      scrolly: function (p) {
        var visual = document.getElementById("scrollyVisual");
        var steps = [].slice.call(pageEl.querySelectorAll(".scrolly-step"));
        function paintVisual(i) {
          var s = (p.steps || [])[i]; if (!s) return;
          var v = s.visual || {};
          if (v.type === "bars") {
            visual.innerHTML = '<div class="chart-wrap">' + hbars(v.bars || []) + "</div>";
          } else {
            visual.innerHTML = '<div class="scrolly-stat" style="color:' + esc(v.color || "var(--primary)") + '">' +
              esc(t(v.value)) + "</div>";
          }
        }
        paintVisual(0);
        if ("IntersectionObserver" in window) {
          var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
              if (en.isIntersecting) {
                steps.forEach(function (s) { s.classList.remove("scrolly-step--active"); });
                en.target.classList.add("scrolly-step--active");
                paintVisual(parseInt(en.target.dataset.step, 10) || 0);
              }
            });
          }, { rootMargin: "-45% 0px -45% 0px" });
          steps.forEach(function (s) { io.observe(s); });
          teardowns.push(function () { io.disconnect(); });
        }
      },

      map: function (p) {
        var listEl = document.getElementById("mapList");
        var places = p.places || [];
        listEl.innerHTML = places.map(function (pl) {
          return '<li class="place" data-item data-slug="' + esc(pl.slug) + '" tabindex="0" role="button" ' +
            'aria-label="' + esc(t(pl.name)) + '"><b>' + esc(t(pl.name)) + "</b>" +
            '<span>' + esc(t(pl.body)) + "</span></li>";
        }).join("");

        if (typeof window.L === "undefined" || !window.L.map) {
          // Leaflet not loaded (offline / blocked): list-only graceful fallback.
          document.getElementById("map").innerHTML =
            '<div class="map-fallback">' + esc(L.state.lang === "en" ? "Map unavailable offline — see the list." : "離線時地圖無法載入 — 請看清單。") + "</div>";
          return;
        }
        var map = window.L.map("map", { scrollWheelZoom: false });
        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap", maxZoom: 19
        }).addTo(map);
        var markers = {}, group = [];
        places.forEach(function (pl) {
          /* alt + title give Leaflet's marker <img role="button"> an accessible name */
          var m = window.L.marker([pl.lat, pl.lng], { alt: t(pl.name), title: t(pl.name), keyboard: true })
            .addTo(map).bindPopup("<b>" + esc(t(pl.name)) + "</b><br>" + esc(t(pl.body)));
          markers[pl.slug] = m; group.push([pl.lat, pl.lng]);
        });
        if (group.length) map.fitBounds(group, { padding: [30, 30] });
        [].forEach.call(listEl.querySelectorAll(".place"), function (li) {
          function go() { var m = markers[li.dataset.slug]; if (m) { map.panTo(m.getLatLng()); m.openPopup(); } }
          li.addEventListener("click", go);
          li.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
        });
        teardowns.push(function () { try { map.remove(); } catch (e) {} });
      },

      /* ---- glossary: search filters the term list (reuses faq pattern) ---- */
      glossary: function () {
        var search = document.getElementById("search");
        var items = [].slice.call(pageEl.querySelectorAll(".gloss-item"));
        if (search) search.addEventListener("input", function () {
          var q = this.value.trim().toLowerCase();
          items.forEach(function (it) {
            var hit = !q || (it.dataset.q || "").indexOf(q) !== -1;
            it.style.display = hit ? "" : "none";
          });
        });
      },

      /* ---- flashcards: click / Enter / Space flips a card (div role=button) ---- */
      flashcards: function () {
        [].forEach.call(pageEl.querySelectorAll(".flashcard"), function (card) {
          function flip() { card.classList.toggle("is-flipped"); }
          card.addEventListener("click", flip);
          card.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") { e.preventDefault(); flip(); }
          });
        });
      },

      /* ---- quiz: one answer per question, reveal correct + explain, tally score ---- */
      quiz: function (p) {
        var total = (p.questions || []).length;
        var answered = {}, correct = 0;
        var scoreVal = document.getElementById("quizScoreVal");
        [].forEach.call(pageEl.querySelectorAll(".quiz-opt"), function (btn) {
          btn.addEventListener("click", function () {
            var qi = btn.dataset.q;
            var qEl = pageEl.querySelector('.quiz-q[data-q="' + qi + '"]');
            if (!qEl || answered[qi]) return;   // lock after first answer per question
            answered[qi] = true;
            var ans = parseInt(qEl.dataset.answer, 10);
            var chosen = parseInt(btn.dataset.o, 10);
            if (chosen === ans) correct++;
            [].forEach.call(qEl.querySelectorAll(".quiz-opt"), function (o) {
              var oi = parseInt(o.dataset.o, 10);
              o.disabled = true;
              o.classList.add("is-locked");
              var mark = o.querySelector(".quiz-opt__mark");
              if (oi === ans) { o.classList.add("is-correct"); if (mark) mark.textContent = "check"; }
              if (o === btn && chosen !== ans) { o.classList.add("is-wrong"); if (mark) mark.textContent = "close"; }
            });
            var ex = qEl.querySelector(".quiz-explain");
            if (ex) ex.hidden = false;
            if (scoreVal) scoreVal.textContent = correct + " / " + total;
          });
        });
      }
    };

    /* =====================================================================
       GSAP MOTION LAYER (progressive enhancement)

       Runs after each render and is fully optional: if GSAP failed to load or
       the visitor prefers reduced motion, nothing here runs. There are no
       scroll-triggered reveals any more — content below the fold is never set
       to opacity 0, so print, no-JS, full-page captures and readers who jump
       straight to an anchor all see everything. Only what is already on
       screen at load gets one short entrance (the page head, and the key
       figure drawing itself).
       ===================================================================== */
    var REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    function setupMotion() {
      var gsap = window.gsap;
      if (!gsap || REDUCED) return;                       // content is already fully visible
      document.documentElement.classList.add("has-gsap");
      var made = [];
      function keep(x) { if (x) made.push(x); return x; }
      var vh = window.innerHeight || 800;
      function inView(el) { var b = el.getBoundingClientRect(); return b.top < vh && b.bottom > 0; }

      // 1) page head settles in
      var heads = pageEl.querySelectorAll(".page-head > *");
      if (heads.length) keep(gsap.from(heads, { y: 14, opacity: 0, duration: .6, ease: "power3.out", stagger: .07 }));

      // 2) the key figure draws itself: lines sweep left → right, then the
      //    trait-RL end points and the annotations arrive. Only for a figure
      //    already on screen, so nothing below the fold is ever hidden.
      [].forEach.call(pageEl.querySelectorAll(".slope"), function (sl) {
        if (!inView(sl)) return;
        var svg = sl.querySelector(".slope__plot svg");
        var tl = gsap.timeline({ delay: .25 });
        if (svg) tl.fromTo(svg, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, ease: "power2.inOut", clearProps: "clipPath" });
        tl.from(sl.querySelectorAll(".slope__dot--rl, .slope__labels > *"), { opacity: 0, x: -6, duration: .4, stagger: .03 }, "-=.35");
        tl.from(sl.querySelectorAll(".slope__note"), { opacity: 0, scale: .8, duration: .4 }, "-=.1");
        keep(tl);
      });
      [].forEach.call(pageEl.querySelectorAll(".hbars"), function (hb) {
        if (!inView(hb)) return;
        keep(gsap.from(hb.querySelectorAll(".hbars__bar"), { scaleX: 0, transformOrigin: "left center", duration: .8, ease: "power2.out", stagger: .05 }));
      });

      teardowns.push(function () {
        made.forEach(function (x) { try { x.kill && x.kill(); } catch (e) {} });
        try { gsap.killTweensOf(pageEl.querySelectorAll("*")); } catch (e) {}
        try { gsap.set(pageEl.querySelectorAll("*"), { clearProps: "all" }); } catch (e) {}
      });
    }

    /* =====================================================================
       RENDER the current page
       ===================================================================== */
    function render() {
      teardowns.forEach(function (fn) { try { fn(); } catch (e) {} });
      teardowns = [];
      var p = L.currentPage();
      if (!p) { pageEl.innerHTML = '<p class="empty">No page data.</p>'; return; }
      var fn = RENDERERS[p.layout] || RENDERERS.gallery;
      pageEl.className = "page page--" + p.layout;
      pageEl.innerHTML = fn(p);
      var w = WIRE[p.layout];
      if (w) w(p);
      setupMotion();
    }

    render();
  }

  boot();
})();
