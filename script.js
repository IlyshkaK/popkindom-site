document.querySelectorAll("a[href='#']").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
  });
});

const burgerBtn = document.getElementById("burgerBtn");
const mobileMenu = document.getElementById("mobileMenu");

if (burgerBtn && mobileMenu) {
  burgerBtn.addEventListener("click", () => {
    burgerBtn.classList.toggle("open");
    mobileMenu.classList.toggle("open");
  });
}

const inventoryGrid = document.getElementById("inventoryGrid");
if (inventoryGrid) {
  const items = ["🪵","🪨","⛏️","💎","🔥","🍞","🧪","🌱","🍎","🗡️","🛡️","🏹","🕯️","🧱","🪙","🪣","🧭","📕","","","","","","","","",""];
  inventoryGrid.innerHTML = items.map((item) => `<span>${item}</span>`).join("");
}

/* ===== ACCOUNT SIDEBAR SCROLL SPY ===== */
const accountLinks = Array.from(document.querySelectorAll(".account-sidebar .side-link[href^='#']"));
const accountSections = accountLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

function setActiveAccountSection(sectionId, highlight = false) {
  accountLinks.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${sectionId}`);
  });

  if (!highlight) return;

  const section = document.getElementById(sectionId);
  if (!section) return;

  section.classList.remove("section-focus");
  void section.offsetWidth;
  section.classList.add("section-focus");

  window.clearTimeout(section._focusTimer);
  section._focusTimer = window.setTimeout(() => {
    section.classList.remove("section-focus");
  }, 1400);
}

accountLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const sectionId = link.getAttribute("href").slice(1);
    const section = document.getElementById(sectionId);

    if (!section) return;

    event.preventDefault();
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveAccountSection(sectionId, true);

    if (history.pushState) {
      history.pushState(null, "", `#${sectionId}`);
    }
  });
});

if (accountSections.length) {
  const observer = new IntersectionObserver((entries) => {
    const visibleEntries = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

    if (visibleEntries[0]) {
      setActiveAccountSection(visibleEntries[0].target.id);
    }
  }, {
    root: null,
    rootMargin: "-22% 0px -58% 0px",
    threshold: [0.15, 0.35, 0.55, 0.75]
  });

  accountSections.forEach((section) => observer.observe(section));
}

/* ===== REAL BACKEND AUTH ===== */
let currentSession = null;

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.message || "Ошибка запроса к серверу.";
    throw new Error(message);
  }

  return data;
}

async function getSession() {
  try {
    const data = await apiRequest("/api/me");
    return data.user || null;
  } catch {
    return null;
  }
}

function setAuthMessage(element, text, type) {
  if (!element) return;
  element.className = `auth-message ${type}`;
  element.textContent = text;
}

function isValidMinecraftNick(username) {
  return /^[a-zA-Z0-9_]{3,16}$/.test(username);
}

function refreshAuthUI(user = currentSession) {
  document.body.classList.toggle("is-auth", Boolean(user));

  document.querySelectorAll(".auth-action-btn").forEach((button) => {
    const text = button.querySelector(".auth-action-text");
    const icon = button.querySelector(".auth-action-icon");

    if (user) {
      button.href = "#";
      if (text) text.textContent = user.username;
      if (icon) icon.textContent = "👤";
    } else {
      button.href = "login.html";
      if (text) text.textContent = "Войти";
      if (icon) icon.textContent = "👥";
    }
  });

  document.querySelectorAll(".auth-action-mobile").forEach((button) => {
    if (user) {
      button.href = "#";
      button.textContent = `👤 ${user.username}`;
    } else {
      button.href = "login.html";
      button.textContent = "Войти";
    }
  });

  const profileUsername = document.getElementById("profileUsername");
  if (profileUsername && user) {
    profileUsername.textContent = user.username;
  }

  const securityUsername = document.getElementById("securityUsername");
  if (securityUsername && user) {
    securityUsername.textContent = user.username;
  }
}

function applyAccountData(data) {
  if (!data) return;

  const user = data.user;
  const player = data.player;
  const stats = data.stats;

  const profileUsername = document.getElementById("profileUsername");
  if (profileUsername && user) profileUsername.textContent = user.username;

  const profileUuid = document.querySelector(".profile-info p");
  if (profileUuid && player?.uuid) profileUuid.textContent = `UUID: ${player.uuid}`;

  const status = document.querySelector(".profile-title .status");
  if (status && player) status.textContent = player.online ? "Онлайн" : "Оффлайн";

  const quickCards = document.querySelectorAll(".quick-grid .stat-card b");
  if (quickCards.length >= 4 && stats) {
    quickCards[0].textContent = `${Math.floor((stats.play_time_ticks || 0) / 20 / 60 / 60)} ч.`;
    quickCards[1].textContent = "—";
    quickCards[2].textContent = stats.deaths ?? 0;
    quickCards[3].textContent = stats.mob_kills ?? 0;
  }
}

const authMenuBtn = document.getElementById("authMenuBtn");
const authDropdown = document.getElementById("authDropdown");

if (authMenuBtn && authDropdown) {
  authMenuBtn.addEventListener("click", (event) => {
    if (!currentSession) return;

    event.preventDefault();
    authDropdown.classList.toggle("open");
  });

  document.addEventListener("click", (event) => {
    if (!authDropdown.classList.contains("open")) return;
    if (event.target.closest(".auth-menu-wrap")) return;
    authDropdown.classList.remove("open");
  });
}

document.querySelectorAll("[data-logout], #logoutBtn").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      await apiRequest("/api/logout", { method: "POST", body: "{}" });
    } catch {}

    currentSession = null;
    window.location.href = "login.html";
  });
});

const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("registerUsername").value.trim();
    const password = document.getElementById("registerPassword").value;
    const passwordRepeat = document.getElementById("registerPasswordRepeat").value;
    const message = document.getElementById("registerMessage");

    if (!isValidMinecraftNick(username)) {
      setAuthMessage(message, "Ник должен быть 3–16 символов: буквы, цифры и _", "error");
      return;
    }

    if (password.length < 8) {
      setAuthMessage(message, "Пароль должен быть минимум 8 символов.", "error");
      return;
    }

    if (password !== passwordRepeat) {
      setAuthMessage(message, "Пароли не совпадают.", "error");
      return;
    }

    try {
      const data = await apiRequest("/api/register", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });

      currentSession = data.user;
      refreshAuthUI(currentSession);
      setAuthMessage(message, "Аккаунт создан. Открываем кабинет...", "success");

      setTimeout(() => {
        window.location.href = "account.html";
      }, 800);
    } catch (error) {
      setAuthMessage(message, error.message, "error");
    }
  });
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;
    const message = document.getElementById("loginMessage");

    try {
      const data = await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });

      currentSession = data.user;
      refreshAuthUI(currentSession);
      setAuthMessage(message, "Вход выполнен. Открываем кабинет...", "success");

      setTimeout(() => {
        window.location.href = "account.html";
      }, 700);
    } catch (error) {
      setAuthMessage(message, error.message, "error");
    }
  });
}

/* ===== PLAY BUTTON AUTH REDIRECT ===== */
const playBtn = document.getElementById("playBtn");
if (playBtn) {
  playBtn.addEventListener("click", (event) => {
    event.preventDefault();

    if (currentSession) {
      window.location.href = "account.html";
    } else {
      window.location.href = "login.html";
    }
  });
}

async function initAuth() {
  const data = await (async () => {
    try {
      return await apiRequest("/api/me");
    } catch {
      return null;
    }
  })();

  currentSession = data?.user || null;
  refreshAuthUI(currentSession);

  if (document.querySelector(".protected-page") && !currentSession) {
    window.location.href = "login.html";
    return;
  }

  if (document.querySelector(".account-page") && data) {
    applyAccountData(data);
  }
}

const securityMessage = document.getElementById("securityMessage");

async function securityPost(url, successText) {
  try {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include"
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setAuthMessage(securityMessage, data.error || "Ошибка выполнения действия.", "error");
      return;
    }

    setAuthMessage(securityMessage, successText, "success");

    if (data.logout) {
      setTimeout(() => {
        window.location.href = "login.html";
      }, 900);
    }
  } catch {
    setAuthMessage(securityMessage, "Сервер недоступен.", "error");
  }
}

const disableAutoLoginBtn = document.getElementById("disableAutoLoginBtn");
if (disableAutoLoginBtn) {
  disableAutoLoginBtn.addEventListener("click", () => {
    securityPost("/api/disable-autologin", "Автовход в игре отключён.");
  });
}

const logoutAllBtn = document.getElementById("logoutAllBtn");
if (logoutAllBtn) {
  logoutAllBtn.addEventListener("click", () => {
    securityPost("/api/logout-all", "Все сессии завершены.", true);
  });
}

initAuth();
