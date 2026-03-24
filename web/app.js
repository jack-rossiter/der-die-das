(function () {
  "use strict";

  const ARTICLES = { m: "der", f: "die", n: "das" };
  const GENDER_CLASS = { m: "gender-m", f: "gender-f", n: "gender-n" };
  const MAX_SUGGESTIONS = 8;
  const HISTORY_KEY = "ddd_history";
  const MAX_HISTORY = 100;
  const HISTORY_BIAS = 0.35;

  // nounMap: word -> [gender, english?]
  let nounMap = null;
  let sortedKeys = [];
  let activeIdx = -1;

  const input = document.getElementById("search");
  const suggestionsList = document.getElementById("suggestions");
  const resultDiv = document.getElementById("result");
  const statusEl = document.getElementById("status");
  const randomDiv = document.getElementById("random");

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
      return [];
    }
  }

  function recordLookup(word) {
    let hist = getHistory().filter((w) => w !== word);
    hist.unshift(word);
    if (hist.length > MAX_HISTORY) hist = hist.slice(0, MAX_HISTORY);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    } catch {}
  }

  async function loadData() {
    try {
      const res = await fetch("data/nouns.json");
      const data = await res.json();
      nounMap = new Map(Object.entries(data));
      sortedKeys = Array.from(nounMap.keys()).sort((a, b) =>
        a.localeCompare(b, "de")
      );
      statusEl.textContent = `${nounMap.size.toLocaleString("de-DE")} Nomen geladen`;
      input.focus();
      showRandomNoun();
    } catch (e) {
      statusEl.textContent = "Fehler beim Laden des Wörterbuchs.";
      console.error(e);
    }
  }

  function pickRandomWord() {
    const hist = getHistory().filter((w) => nounMap.has(w));
    if (hist.length > 0 && Math.random() < HISTORY_BIAS) {
      return hist[Math.floor(Math.random() * hist.length)];
    }
    const withTranslation = sortedKeys.filter((k) => nounMap.get(k).length > 1);
    const pool = withTranslation.length > 0 ? withTranslation : sortedKeys;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function showRandomNoun() {
    if (!nounMap || nounMap.size === 0) return;
    const word = pickRandomWord();
    const entry = nounMap.get(word);
    const gender = entry[0];
    const en = entry[1] || "";
    const article = ARTICLES[gender];
    const cls = GENDER_CLASS[gender];

    randomDiv.innerHTML =
      `<span class="random-article ${cls}">${article}</span> ` +
      `<span class="random-noun">${word}</span>` +
      (en ? `<span class="random-en">${en}</span>` : "");
    randomDiv.style.display = "";
  }

  function findMatches(query) {
    if (!nounMap || query.length === 0) return [];
    const lower = query.toLowerCase();
    const exact = [];
    const prefix = [];
    const contains = [];

    for (const word of sortedKeys) {
      const wl = word.toLowerCase();
      if (wl === lower) {
        exact.push(word);
      } else if (wl.startsWith(lower)) {
        prefix.push(word);
      } else if (contains.length < MAX_SUGGESTIONS && wl.includes(lower)) {
        contains.push(word);
      }
      if (exact.length + prefix.length >= MAX_SUGGESTIONS) break;
    }

    return [...exact, ...prefix, ...contains].slice(0, MAX_SUGGESTIONS);
  }

  function showSuggestions(matches) {
    activeIdx = -1;
    suggestionsList.innerHTML = "";

    if (matches.length === 0) {
      suggestionsList.classList.remove("open");
      return;
    }

    for (const word of matches) {
      const entry = nounMap.get(word);
      const gender = entry[0];
      const en = entry[1] || "";
      const li = document.createElement("li");
      li.setAttribute("role", "option");

      const left = document.createElement("span");
      left.classList.add("suggestion-left");
      left.innerHTML =
        `<span class="suggestion-word">${word}</span>` +
        (en ? `<span class="suggestion-en">${en}</span>` : "");

      const right = document.createElement("span");
      right.className = `article ${GENDER_CLASS[gender]}`;
      right.textContent = ARTICLES[gender];

      li.appendChild(left);
      li.appendChild(right);
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        selectWord(word);
      });
      suggestionsList.appendChild(li);
    }

    suggestionsList.classList.add("open");
  }

  function selectWord(word) {
    input.value = word;
    suggestionsList.classList.remove("open");
    showResult(word);
  }

  function showResult(word) {
    const entry = nounMap ? nounMap.get(word) : undefined;
    if (entry) {
      const gender = entry[0];
      const en = entry[1] || "";
      const article = ARTICLES[gender];
      const cls = GENDER_CLASS[gender];
      resultDiv.innerHTML =
        `<span class="article ${cls}">${article}</span>` +
        `<span class="noun">${word}</span>` +
        (en ? `<span class="translation">${en}</span>` : "");
      randomDiv.style.display = "none";
      recordLookup(word);
    } else if (word.length > 0) {
      resultDiv.innerHTML = `<span class="not-found">\u201E${word}\u201C nicht gefunden</span>`;
    } else {
      resultDiv.innerHTML = "";
    }
  }

  function navigateSuggestions(direction) {
    const items = suggestionsList.querySelectorAll("li");
    if (items.length === 0) return;

    if (activeIdx >= 0) items[activeIdx].classList.remove("active");
    activeIdx += direction;
    if (activeIdx < 0) activeIdx = items.length - 1;
    if (activeIdx >= items.length) activeIdx = 0;
    items[activeIdx].classList.add("active");
    items[activeIdx].scrollIntoView({ block: "nearest" });
  }

  input.addEventListener("input", () => {
    const q = input.value.trim();
    const matches = findMatches(q);
    showSuggestions(matches);

    if (matches.length === 1 && matches[0].toLowerCase() === q.toLowerCase()) {
      showResult(matches[0]);
    } else if (q.length === 0) {
      resultDiv.innerHTML = "";
      showRandomNoun();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      navigateSuggestions(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      navigateSuggestions(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const items = suggestionsList.querySelectorAll("li");
      if (activeIdx >= 0 && items[activeIdx]) {
        const word = items[activeIdx].querySelector(".suggestion-word").textContent;
        selectWord(word);
      } else if (items.length > 0) {
        const word = items[0].querySelector(".suggestion-word").textContent;
        selectWord(word);
      } else {
        showResult(input.value.trim());
      }
    } else if (e.key === "Escape") {
      suggestionsList.classList.remove("open");
    }
  });

  input.addEventListener("blur", () => {
    setTimeout(() => suggestionsList.classList.remove("open"), 150);
  });

  input.addEventListener("focus", () => {
    if (input.value.trim().length > 0) {
      const matches = findMatches(input.value.trim());
      showSuggestions(matches);
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  loadData();
})();
