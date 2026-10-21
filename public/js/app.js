let currentCategory = "";
let allCards = [];
let filteredCards = [];
let currentSub = "전체";
let quizCards = [];
let quizIndex = 0;
let quizCorrect = 0;

// DOM
const pages = {
  home: document.getElementById("page-home"),
  category: document.getElementById("page-category"),
  quiz: document.getElementById("page-quiz"),
  result: document.getElementById("page-result"),
};

const headerTitle = document.getElementById("header-title");
const btnBack = document.getElementById("btn-back");

const CATEGORY_NAMES = {
  english_word: "영어 단어",
  english_conversation: "영어 회화",
  english_pattern: "영어 패턴",
  cs: "CS 공부",
  coding_test: "코딩테스트",
  programming: "프로그래밍 언어",
};

// 예문을 코드 형태(고정폭, 들여쓰기 유지)로 보여줄 카테고리
const CODE_CATEGORIES = ["coding_test"];

const QUIZ_SIZE = 10;

// ===== 데이터 로드 =====

const cardCache = {};

// JSON 데이터 로드 (카테고리별 캐시)
async function loadCards(category) {
  if (!cardCache[category]) {
    const res = await fetch(`./data/${category}.json`);
    if (!res.ok) throw new Error(`데이터를 불러오지 못했어요 (${res.status})`);
    cardCache[category] = await res.json();
  }
  return cardCache[category];
}

// ===== 학습 기록 (Leitner 박스 방식 간격 반복) =====
// box 1~5: 맞히면 한 칸 올라가고 틀리면 1로 돌아간다
// due: 다음 복습 시각. box가 높을수록 복습 간격이 길어진다

const STORAGE_KEY = "pocket-study-log";
const MAX_BOX = 5;
const BOX_INTERVAL_DAYS = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };
const DAY_MS = 24 * 60 * 60 * 1000;

function getStudyLog() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveStudyResult(cardId, category, isCorrect) {
  const log = getStudyLog();
  const key = `${category}_${cardId}`;
  const entry = normalizeEntry(log[key]);

  if (isCorrect) {
    entry.correct++;
    entry.box = Math.min(entry.box + 1, MAX_BOX);
  } else {
    entry.wrong++;
    entry.box = 1;
  }
  entry.lastCorrect = isCorrect;
  entry.lastStudied = new Date().toISOString();
  entry.due = new Date(Date.now() + BOX_INTERVAL_DAYS[entry.box] * DAY_MS).toISOString();

  log[key] = entry;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // 저장 공간이 없거나 사파리 개인정보 보호 모드인 경우 기록만 생략
  }
}

// 이전 버전 기록(correct/wrong/lastStudied만 있음)도 박스 정보가 있는 형태로 맞춤
// 맞힌 횟수 - 틀린 횟수로 박스를 추정하고, 마지막 학습일 기준으로 다음 복습일을 계산
function normalizeEntry(entry) {
  const e = { correct: 0, wrong: 0, lastStudied: null, ...entry };
  if (!e.box) e.box = Math.min(Math.max(1 + e.correct - e.wrong, 1), MAX_BOX);
  if (!e.due && e.lastStudied) {
    e.due = new Date(new Date(e.lastStudied).getTime() + BOX_INTERVAL_DAYS[e.box] * DAY_MS).toISOString();
  }
  return e;
}

function getCardStats(cardId, category) {
  const entry = getStudyLog()[`${category}_${cardId}`];
  return entry ? normalizeEntry(entry) : null;
}

// 복습할 때가 된 카드 (한 번도 안 본 카드 포함)
function isDue(stats, now = Date.now()) {
  return !stats || !stats.due || new Date(stats.due).getTime() <= now;
}

// 마지막으로 틀린 카드
function isWrong(stats) {
  if (!stats) return false;
  // 이전 버전 기록은 마지막 결과가 없으므로 틀린 횟수가 더 많으면 오답으로 본다
  return stats.lastCorrect === undefined ? stats.wrong > stats.correct : !stats.lastCorrect;
}

// ===== 유틸 =====

// Fisher-Yates 셔플 (새 배열 반환)
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// XSS 방지
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML.replaceAll("\n", "<br>");
}

function escapeAttr(text) {
  return String(text).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

// ===== 라우팅 (해시 기반: 휴대폰 뒤로가기 / 새로고침 / 즐겨찾기 지원) =====
// #/                          홈
// #/c/{category}              카테고리
// #/c/{category}/quiz         퀴즈
// #/c/{category}/result       결과

function parseRoute(hash = location.hash) {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "c" && CATEGORY_NAMES[parts[1]]) {
    return { page: parts[2] === "quiz" || parts[2] === "result" ? parts[2] : "category", category: parts[1] };
  }
  return { page: "home" };
}

function routeHash({ page, category }) {
  if (page === "home") return "#/";
  return page === "category" ? `#/c/${category}` : `#/c/${category}/${page}`;
}

// replace: 현재 기록을 대체 (퀴즈 -> 결과처럼 뒤로가기로 돌아가지 않을 화면)
function navigate(route, { replace = false } = {}) {
  const hash = routeHash(route);
  // inApp: 이 기록 바로 앞에 앱 화면이 있는지 (대체할 때는 기존 값 유지)
  const state = { inApp: replace ? Boolean(history.state?.inApp) : true };
  if (replace) history.replaceState(state, "", hash);
  else history.pushState(state, "", hash);
  render();
}

window.addEventListener("popstate", render);

let renderToken = 0;

async function render() {
  const route = parseRoute();
  const token = ++renderToken;

  if (route.page === "home") {
    showPage("home");
    return;
  }

  // 카테고리가 바뀌었으면 데이터 로드
  if (route.category !== currentCategory) {
    try {
      const cards = await loadCards(route.category);
      if (token !== renderToken) return; // 로딩 중 다른 화면으로 이동함
      currentCategory = route.category;
      allCards = cards;
      currentSub = "전체";
      filteredCards = allCards;
      quizCards = [];
    } catch (error) {
      if (token !== renderToken) return;
      alert(error.message);
      navigate({ page: "home" }, { replace: true });
      return;
    }
  }

  // 퀴즈 상태 없이 퀴즈/결과 화면에 들어오면 (새로고침 등) 카테고리로
  if ((route.page === "quiz" || route.page === "result") && quizCards.length === 0) {
    navigate({ page: "category", category: currentCategory }, { replace: true });
    return;
  }
  if (route.page === "quiz" && quizIndex >= quizCards.length) {
    navigate({ page: "result", category: currentCategory }, { replace: true });
    return;
  }

  showPage(route.page);
  if (route.page === "category") {
    renderSubTabs();
    renderCardList();
    renderQuizButtons();
  } else if (route.page === "quiz") {
    showQuizCard();
  } else if (route.page === "result") {
    showResult();
  }
}

// 페이지 전환
function showPage(name) {
  Object.values(pages).forEach((p) => p.classList.remove("active"));
  pages[name].classList.add("active");
  window.scrollTo(0, 0);

  if (name === "home") {
    headerTitle.textContent = "Pocket Study";
    btnBack.classList.add("hidden");
  } else {
    btnBack.classList.remove("hidden");
    if (name === "category") headerTitle.textContent = CATEGORY_NAMES[currentCategory];
    if (name === "quiz") headerTitle.textContent = "퀴즈";
    if (name === "result") headerTitle.textContent = "결과";
  }
}

// 뒤로가기 버튼: 앱 안에서 이동해 온 경우 브라우저 기록을 따라가고, 바로 들어온 경우 상위 화면으로
btnBack.addEventListener("click", () => {
  const route = parseRoute();
  if (history.state?.inApp) {
    history.back();
  } else {
    const parent = route.page === "category" ? { page: "home" } : { page: "category", category: route.category };
    navigate(parent, { replace: true });
  }
});

// 메뉴 클릭
document.querySelectorAll(".menu-card").forEach((card) => {
  card.addEventListener("click", () => {
    navigate({ page: "category", category: card.dataset.category });
  });
});

// ===== 카테고리 화면 =====

// 서브 탭
function renderSubTabs() {
  const container = document.getElementById("sub-tabs");
  const subs = [...new Set(allCards.map((c) => c.sub).filter(Boolean))];
  if (subs.length <= 1) {
    container.classList.add("hidden");
    return;
  }
  container.classList.remove("hidden");
  container.innerHTML = ["전체", ...subs]
    .map(
      (s) =>
        `<button class="sub-tab ${s === currentSub ? "active" : ""}" data-sub="${escapeAttr(s)}">${escapeHtml(s)}</button>`
    )
    .join("");

  container.querySelectorAll(".sub-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentSub = btn.dataset.sub;
      filteredCards =
        currentSub === "전체"
          ? allCards
          : allCards.filter((c) => c.sub === currentSub);
      renderSubTabs();
      renderCardList();
      renderQuizButtons();
    });
  });
}

// 카드 목록 렌더링
function renderCardList() {
  const list = document.getElementById("card-list");
  const emptyMsg = document.getElementById("empty-msg");
  const countEl = document.getElementById("card-count");

  if (filteredCards.length === 0) {
    list.innerHTML = "";
    countEl.textContent = "";
    emptyMsg.classList.remove("hidden");
    return;
  }

  emptyMsg.classList.add("hidden");
  const isConversation = currentCategory === "english_conversation";
  const isCode = CODE_CATEGORIES.includes(currentCategory);
  const now = Date.now();
  let studied = 0;

  list.innerHTML = filteredCards
    .map((c) => {
      const stats = getCardStats(c.id, currentCategory);
      if (stats) studied++;
      const statsHtml = stats
        ? `<span class="card-stats ${isWrong(stats) ? "wrong" : ""}">
            <span class="card-level">Lv.${stats.box}</span>
            O ${stats.correct} / X ${stats.wrong}
            ${isDue(stats, now) ? '<span class="card-due">복습</span>' : ""}
          </span>`
        : "";
      return `
        <div class="card-item" onclick="toggleCardDetail(this)">
          <div class="card-item-content">
            <div class="card-item-front">${escapeHtml(c.front)}</div>
            <div class="card-item-back ${isConversation ? "spoiler" : ""}">${escapeHtml(c.back)}</div>
            ${c.example ? `<div class="card-item-example ${isCode ? "code" : ""} hidden">${escapeHtml(c.example)}</div>` : ""}
          </div>
          ${statsHtml}
        </div>`;
    })
    .join("");

  countEl.textContent = `${filteredCards.length}장 중 ${studied}장 학습`;
}

function toggleCardDetail(el) {
  const spoiler = el.querySelector(".spoiler");
  if (spoiler) spoiler.classList.toggle("revealed");
  const example = el.querySelector(".card-item-example");
  if (example) example.classList.toggle("hidden");
}

// ===== 퀴즈 =====

// 퀴즈 모드별 출제 카드
const QUIZ_MODES = {
  // 복습: 복습할 때가 된 카드 중 오래 기다린 카드부터, 처음 보는 카드는 그 뒤에
  review() {
    const now = Date.now();
    const withStats = filteredCards.map((c) => ({ card: c, stats: getCardStats(c.id, currentCategory) }));
    const dueStudied = shuffle(withStats.filter((x) => x.stats && isDue(x.stats, now)))
      .sort((a, b) => a.stats.box - b.stats.box || new Date(a.stats.due) - new Date(b.stats.due));
    const unseen = shuffle(withStats.filter((x) => !x.stats));
    return [...dueStudied, ...unseen].map((x) => x.card);
  },
  // 오답: 마지막에 틀린 카드
  wrong() {
    return shuffle(filteredCards.filter((c) => isWrong(getCardStats(c.id, currentCategory))));
  },
  // 전체: 무작위
  all() {
    return shuffle(filteredCards);
  },
};

function renderQuizButtons() {
  const counts = {
    review: QUIZ_MODES.review().length,
    wrong: QUIZ_MODES.wrong().length,
    all: filteredCards.length,
  };
  document.querySelectorAll("[data-quiz-mode]").forEach((btn) => {
    const count = counts[btn.dataset.quizMode];
    btn.querySelector(".quiz-count").textContent = count;
    btn.disabled = count === 0;
  });
}

document.querySelectorAll("[data-quiz-mode]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const cards = QUIZ_MODES[btn.dataset.quizMode]();
    if (cards.length === 0) return;

    quizCards = cards.slice(0, QUIZ_SIZE);
    quizIndex = 0;
    quizCorrect = 0;
    navigate({ page: "quiz", category: currentCategory });
  });
});

function showQuizCard() {
  const card = quizCards[quizIndex];
  document.getElementById("quiz-current").textContent = quizIndex + 1;
  document.getElementById("quiz-total").textContent = quizCards.length;
  document.getElementById("quiz-front").innerHTML = escapeHtml(card.front);
  document.getElementById("quiz-back").innerHTML = escapeHtml(card.back);

  const example = document.getElementById("quiz-example");
  example.innerHTML = escapeHtml(card.example || "");
  example.classList.toggle("code", CODE_CATEGORIES.includes(currentCategory));

  // 답이 길면 작은 글씨 + 왼쪽 정렬
  const backLength = card.back.length + (card.example || "").length;
  const isLong = backLength > 80 || card.back.includes("\n") || (card.example || "").includes("\n");

  const flashcard = document.getElementById("flashcard");
  flashcard.classList.toggle("long", isLong);
  flashcard.classList.remove("flipped");
  flashcard.querySelectorAll(".flashcard-front, .flashcard-back").forEach((face) => (face.scrollTop = 0));
}

// 플래시카드 뒤집기
document.getElementById("flashcard").addEventListener("click", () => {
  document.getElementById("flashcard").classList.toggle("flipped");
});

// 정답/오답
function nextQuiz(correct) {
  if (correct) quizCorrect++;
  saveStudyResult(quizCards[quizIndex].id, currentCategory, correct);

  quizIndex++;
  if (quizIndex >= quizCards.length) {
    // 결과 화면에서 뒤로가기하면 끝난 퀴즈가 아닌 카테고리로 가도록 퀴즈 기록을 대체
    navigate({ page: "result", category: currentCategory }, { replace: true });
  } else {
    showQuizCard();
  }
}

document.getElementById("btn-correct").addEventListener("click", () => nextQuiz(true));
document.getElementById("btn-wrong").addEventListener("click", () => nextQuiz(false));

// 결과
function showResult() {
  document.getElementById("result-correct").textContent = quizCorrect;
  document.getElementById("result-total").textContent = quizCards.length;

  const ratio = quizCorrect / quizCards.length;
  let msg = "";
  if (ratio === 1) msg = "완벽해요!";
  else if (ratio >= 0.8) msg = "잘하고 있어요!";
  else if (ratio >= 0.5) msg = "조금 더 복습해봐요!";
  else msg = "다시 한번 도전해봐요!";

  document.getElementById("result-msg").textContent = msg;
}

document.getElementById("btn-retry").addEventListener("click", () => {
  quizIndex = 0;
  quizCorrect = 0;
  quizCards = shuffle(quizCards);
  navigate({ page: "quiz", category: currentCategory }, { replace: true });
});

document.getElementById("btn-home").addEventListener("click", () => navigate({ page: "home" }));

// 첫 화면
history.replaceState({ inApp: false }, "", location.hash || "#/");
render();
