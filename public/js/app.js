let currentCategory = "";
let allCards = [];
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
};

// JSON 데이터 로드
async function loadCards(category) {
  const res = await fetch(`./data/${category}.json`);
  return res.json();
}

// localStorage 학습 기록
function getStudyLog() {
  return JSON.parse(localStorage.getItem("pocket-study-log") || "{}");
}

function saveStudyResult(cardId, category, isCorrect) {
  const log = getStudyLog();
  const key = `${category}_${cardId}`;
  if (!log[key]) {
    log[key] = { correct: 0, wrong: 0, lastStudied: null };
  }
  if (isCorrect) log[key].correct++;
  else log[key].wrong++;
  log[key].lastStudied = new Date().toISOString();
  localStorage.setItem("pocket-study-log", JSON.stringify(log));
}

function getCardStats(cardId, category) {
  const log = getStudyLog();
  return log[`${category}_${cardId}`] || { correct: 0, wrong: 0 };
}

// 페이지 전환
function showPage(name) {
  Object.values(pages).forEach((p) => p.classList.remove("active"));
  pages[name].classList.add("active");

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

// 뒤로가기
btnBack.addEventListener("click", () => {
  const activePage = document.querySelector(".page.active");
  if (activePage === pages.result || activePage === pages.quiz) {
    showPage("category");
  } else {
    showPage("home");
  }
});

// 메뉴 클릭
document.querySelectorAll(".menu-card").forEach((card) => {
  card.addEventListener("click", async () => {
    currentCategory = card.dataset.category;
    allCards = await loadCards(currentCategory);
    showPage("category");
    renderCardList();
  });
});

// 카드 목록 렌더링
function renderCardList() {
  const list = document.getElementById("card-list");
  const emptyMsg = document.getElementById("empty-msg");

  if (allCards.length === 0) {
    list.innerHTML = "";
    emptyMsg.classList.remove("hidden");
    return;
  }

  emptyMsg.classList.add("hidden");
  list.innerHTML = allCards
    .map((c) => {
      const stats = getCardStats(c.id, currentCategory);
      const statsHtml =
        stats.correct + stats.wrong > 0
          ? `<span class="card-stats">O ${stats.correct} / X ${stats.wrong}</span>`
          : "";
      return `
        <div class="card-item" onclick="toggleCardDetail(this)">
          <div class="card-item-content">
            <div class="card-item-front">${escapeHtml(c.front)}</div>
            <div class="card-item-back">${escapeHtml(c.back)}</div>
            ${c.example ? `<div class="card-item-example hidden">${escapeHtml(c.example)}</div>` : ""}
          </div>
          ${statsHtml}
        </div>`;
    })
    .join("");
}

function toggleCardDetail(el) {
  const example = el.querySelector(".card-item-example");
  if (example) example.classList.toggle("hidden");
}

// 퀴즈
document.getElementById("btn-quiz").addEventListener("click", () => {
  if (allCards.length === 0) {
    alert("카드가 없어요.");
    return;
  }

  quizCards = [...allCards].sort(() => Math.random() - 0.5).slice(0, 10);
  quizIndex = 0;
  quizCorrect = 0;
  showPage("quiz");
  showQuizCard();
});

function showQuizCard() {
  const card = quizCards[quizIndex];
  document.getElementById("quiz-current").textContent = quizIndex + 1;
  document.getElementById("quiz-total").textContent = quizCards.length;
  document.getElementById("quiz-front").textContent = card.front;
  document.getElementById("quiz-back").textContent = card.back;
  document.getElementById("quiz-example").textContent = card.example || "";

  const flashcard = document.getElementById("flashcard");
  flashcard.classList.remove("flipped");
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
    showResult();
  } else {
    showQuizCard();
  }
}

document.getElementById("btn-correct").addEventListener("click", () => nextQuiz(true));
document.getElementById("btn-wrong").addEventListener("click", () => nextQuiz(false));

// 결과
function showResult() {
  showPage("result");
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
  quizCards.sort(() => Math.random() - 0.5);
  showPage("quiz");
  showQuizCard();
});

document.getElementById("btn-home").addEventListener("click", () => showPage("home"));

// XSS 방지
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
