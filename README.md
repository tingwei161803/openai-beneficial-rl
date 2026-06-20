# 有益強化學習 · Beneficial RL

> 把 OpenAI Alignment 論文《Reinforcement Learning Towards Broadly and Persistently Beneficial Models》整理成一個可瀏覽、可互動、雙語的研究導覽網站。

這是一個**非官方**的論文導覽站,把這篇研究的核心主張、15 個有益特質、12 個情境領域、方法、結果與「對齊持久性」拆成多個頁面呈現,並附上術語速查、特質字卡與隨堂測驗。內容整理自論文與 OpenAI Alignment 部落格頁;所有可見文字皆中英雙語、可一鍵全頁切換。

---

## 🔗 線上版 / Live

| | |
|---|---|
| 🌐 網站 | <https://openai-beneficial-rl.peteraim.com/> |
| 📄 原始論文 | <https://alignment.openai.com/beneficial-rl> |

> 直接點進去就能用,無需安裝。每個內容頁都有獨立網址(例如 `…/traits.html`、`…/results.html`),方便分享與 SEO;`traits.html` 的特質卡片支援 `#<slug>` 深連結。

---

## ✨ 功能特色

- 🌏 **中英雙語全頁切換** — 一鍵把整站(卡片、圖表、導覽、靜態文案、`<title>`)在中文 / English 間切換,不留殘字。
- 🌗 **深色 / 淺色模式** — 手動切換,選擇會記住。
- 🧭 **多頁面 + 跨頁導覽** — 12 個頁面共用同一套外框,語言/主題跨頁持久。
- 🃏 **15 個有益特質圖鑑** — 可搜尋、可依「held-out 評測子集 / 僅訓練用」篩選,點卡片看完整定義。
- 🔀 **基線 vs 有益特質模型對照** — 同一個使用者提示,並列兩個模型的回應(獎勵駭入、醫療安全、誠實陳述…)。
- 📊 **結果儀表板** — 關鍵統計卡 + 純 SVG 長條圖 + 評測差距表(零圖表函式庫)。
- 📜 **捲動敘事** — 用 scrollytelling 講「對齊持久性」的故事。
- 📚 **術語速查 / 特質字卡 / 隨堂測驗** — 可搜尋詞彙表、點擊翻面的字卡、附即時回饋與計分的測驗。
- 🔗 **深連結** — 特質卡片可用 `#<slug>` 直接分享。
- 📱 **響應式設計** — 手機、平板、桌機皆適配。
- ⚡ **純靜態、零 build** — 純 HTML/CSS/JS,無後端、載入快、可離線瀏覽。

---

## 📂 內容結構 / 資料來源

本站內容整理自 **OpenAI Alignment 論文《Reinforcement Learning Towards Broadly and Persistently Beneficial Models》(Jagadeesh、Arora、Saab、Malik、Trofimov、Tsimpourlas、Heidecke、Singhal,2026 年 6 月)** 與其 [部落格頁](https://alignment.openai.com/beneficial-rl)。

```
openai-beneficial-rl/
├── index.html            # 首頁 / 總覽(hub)
├── traits.html           # 15 個有益特質(圖鑑)
├── domains.html          # 12 個情境領域(bento)
├── method.html           # 研究方法(長文)
├── examples.html         # 基線 vs 有益特質模型對照
├── results.html          # 廣泛對齊泛化(儀表板)
├── persistence.html      # 對齊持久性(捲動敘事)
├── explanations.html     # 替代解釋逐一排除(問答)
├── glossary.html         # 術語速查
├── flashcards.html       # 特質字卡
├── quiz.html             # 隨堂測驗
├── references.html       # 精選參考文獻(表格)
├── data/data.js          # 單一資料層(SITE_META + SITE_PAGES,雙語)
├── assets/
│   ├── shell.js          # 共用外框:appbar / 跨頁導覽 / footer / dialog / 語言+主題
│   ├── app.js            # 版型引擎:依頁面 layout 渲染
│   └── styles.css        # 樣式(極簡編輯風 + 各版型)
├── favicon.svg
├── CNAME                 # 自訂網域綁定
└── .nojekyll
```

> ⚠️ **非官方**:本網站為個人整理之非官方研究導覽,內容整理自上述論文。數字與定義取自論文,長段文字經改寫/濃縮以利網頁閱讀;範例對話為論文圖示的精簡版。如有錯誤或出入,**請以官方論文為準**。

---

## 🛠 本機使用

```bash
# 1. clone 專案
git clone git@github.com:tingwei161803/openai-beneficial-rl.git
cd openai-beneficial-rl

# 2. 啟動本機伺服器(建議;跨頁導覽 / 深連結才正常)
uv run python -m http.server 4173
# 然後瀏覽 http://localhost:4173
```

> 純靜態網站,不需安裝任何依賴。本機 Python 一律使用 `uv run python`。

### 測試(選配)

```bash
uv run --with playwright playwright install chromium     # 首次
uv run --with playwright python <skill>/scripts/verify.py --dir .
```

---

## 📈 流量分析

本站使用 **Google Analytics 4**(GA4 property:`Beneficial RL (OpenAI) — GA4`)蒐集匿名瀏覽流量。追蹤碼僅在正式網域載入,本機預覽(`localhost` / `127.0.0.1`)不會送出數據。

---

## 📝 聲明 / License

- 本站為非官方整理,論文內容與研究成果之著作權歸 **OpenAI** 與原作者所有。
- 設計參考:極簡編輯風(warm monochrome、單一 teal spot accent),並參考並列對照(before/after)版面模式;僅取靈感、未照抄任何特定成品。
- 程式碼以 **MIT** 授權釋出。
- 如為權利人且希望調整或移除內容,請開 issue 聯絡。
