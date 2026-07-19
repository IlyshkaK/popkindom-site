document.querySelectorAll("a[href='#']").forEach((link) => {
  link.addEventListener("click", (event) => event.preventDefault());
});

const burgerBtn = document.getElementById("burgerBtn");
const mobileMenu = document.getElementById("mobileMenu");

if (burgerBtn && mobileMenu) {
  burgerBtn.addEventListener("click", () => {
    burgerBtn.classList.toggle("open");
    mobileMenu.classList.toggle("open");
  });
}


/* ===== Переключение обычной / мобильной версии ===== */
const SITE_VIEW_KEY = "popkindom_site_view_mode";
const viewportMeta = document.querySelector('meta[name="viewport"]');

function getPreferredViewMode() {
  try {
    return localStorage.getItem(SITE_VIEW_KEY) || "auto";
  } catch {
    return "auto";
  }
}

function setPreferredViewMode(mode) {
  try {
    localStorage.setItem(SITE_VIEW_KEY, mode);
  } catch {}
  applyViewMode(mode);
}

function applyViewMode(mode = getPreferredViewMode()) {
  const body = document.body;
  if (!body) return;

  body.classList.remove("force-desktop", "force-mobile");

  if (mode === "desktop") {
    body.classList.add("force-desktop");
    if (viewportMeta) viewportMeta.setAttribute("content", "width=1280");
  } else if (mode === "mobile") {
    body.classList.add("force-mobile");
    if (viewportMeta) viewportMeta.setAttribute("content", "width=device-width, initial-scale=1.0");
  } else if (viewportMeta) {
    viewportMeta.setAttribute("content", "width=device-width, initial-scale=1.0");
  }

  updateViewToggleLabels(mode);
}

function getNextViewMode() {
  const mode = getPreferredViewMode();
  if (mode === "desktop") return "mobile";
  if (mode === "mobile") return "desktop";
  return window.matchMedia("(max-width: 820px)").matches ? "desktop" : "mobile";
}

function updateViewToggleLabels(mode = getPreferredViewMode()) {
  const isMobileMode = mode === "mobile" || (mode === "auto" && window.matchMedia("(max-width: 820px)").matches);
  const text = isMobileMode ? "Обычная версия" : "Мобильная версия";
  document.querySelectorAll("[data-view-toggle]").forEach((button) => {
    const label = button.querySelector("b") || button;
    label.textContent = text;
    button.setAttribute("aria-label", text);
  });
}

function initViewSwitcher() {
  const header = document.querySelector(".header");
  const mobileMenuEl = document.getElementById("mobileMenu");

  if (header && !header.querySelector("[data-view-toggle]")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "view-toggle-btn";
    button.setAttribute("data-view-toggle", "");
    button.innerHTML = '<i data-lucide="smartphone"></i><b>Мобильная версия</b>';
    const authWrap = header.querySelector(".auth-menu-wrap");
    header.insertBefore(button, authWrap ? authWrap.nextSibling : header.lastElementChild);
  }

  if (mobileMenuEl && !mobileMenuEl.querySelector("[data-view-toggle]")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mobile-auth-link view-toggle-mobile";
    button.setAttribute("data-view-toggle", "");
    button.innerHTML = '<i data-lucide="monitor-smartphone"></i> <b>Обычная версия</b>';
    mobileMenuEl.appendChild(button);
  }

  document.querySelectorAll("[data-view-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      setPreferredViewMode(getNextViewMode());
      if (mobileMenu) mobileMenu.classList.remove("open");
      if (burgerBtn) burgerBtn.classList.remove("open");
      refreshLucideIcons();
    });
  });

  applyViewMode();
  refreshLucideIcons();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initViewSwitcher);
} else {
  initViewSwitcher();
}

window.addEventListener("resize", () => {
  if (getPreferredViewMode() === "auto") updateViewToggleLabels("auto");
});

let currentUser = null;
let currentAccountData = null;

function refreshLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons({ attrs: { "stroke-width": 2.4 } });
    return true;
  }
  return false;
}

window.refreshLucideIcons = refreshLucideIcons;

function ensureLucideIcons(attempt = 0) {
  if (refreshLucideIcons() || attempt >= 20) return;
  setTimeout(() => ensureLucideIcons(attempt + 1), 100);
}

ensureLucideIcons();
window.addEventListener("load", () => ensureLucideIcons());

function minecraftHeadUrl(username, size = 36) {
  const safeName = encodeURIComponent(username || "Steve");
  return `https://minotar.net/helm/${safeName}/${size}.png`;
}

function minecraftBustUrl(username, size = 512) {
  const safeName = encodeURIComponent(username || "Steve");
  // Берём именно скин по НИКУ игрока, а не по UUID, чтобы на пиратском сервере
  // не подставлялся стандартный Alex/Steve. mc-heads показывает body-render со second/outer layer.
  return `https://mc-heads.net/body/${safeName}/${size}`;
}

function minecraftBustFallbackUrl(username, size = 512) {
  const safeName = encodeURIComponent(username || "Steve");
  // Запасной вариант тоже по нику игрока.
  return `https://minotar.net/body/${safeName}/${size}.png`;
}

function setAuthButtonIcon(iconElement, username) {
  if (!iconElement) return;
  if (username) {
    iconElement.innerHTML = `<img class="auth-player-head" src="${minecraftHeadUrl(username, 36)}" alt="Голова игрока" onerror="this.src='https://minotar.net/helm/Steve/36.png'">`;
  } else {
    iconElement.innerHTML = `<i data-lucide="log-in"></i>`;
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

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || "Ошибка запроса.");
  }

  return data;
}

let loadMePromise = null;
let loadMeMode = null;
const ME_CACHE_KEY = "pd_me_summary_cache_v3";
const ME_CACHE_TTL = 7000;

function isAccountPage() {
  return Boolean(document.querySelector(".account-page"));
}

function readMeSummaryCache() {
  try {
    const raw = sessionStorage.getItem(ME_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || Date.now() - cached.time > ME_CACHE_TTL) return null;
    return cached.data || null;
  } catch {
    return null;
  }
}

function writeMeSummaryCache(data) {
  try {
    if (data?.user) sessionStorage.setItem(ME_CACHE_KEY, JSON.stringify({ time: Date.now(), data }));
  } catch {}
}

async function loadMe(options = {}) {
  const full = options.full ?? isAccountPage();
  const mode = full ? "full" : "summary";

  if (!full) {
    const cached = readMeSummaryCache();
    if (cached?.user && !options.force) {
      currentUser = cached.user;
      currentAccountData = cached;
      return cached;
    }
  }

  if (loadMePromise && loadMeMode === mode && !options.force) return loadMePromise;
  loadMeMode = mode;

  loadMePromise = (async () => {
    try {
      const data = await apiRequest(full ? "/api/me" : "/api/me?summary=1");
      currentUser = data.user;
      currentAccountData = data;
      if (!full) writeMeSummaryCache(data);
      return data;
    } catch {
      currentUser = null;
      currentAccountData = null;
      try { sessionStorage.removeItem(ME_CACHE_KEY); } catch {}
      return null;
    } finally {
      setTimeout(() => {
        loadMePromise = null;
        loadMeMode = null;
      }, 250);
    }
  })();

  return loadMePromise;
}

function refreshAuthUI() {
  const isAuth = Boolean(currentUser);
  document.body.classList.toggle("is-auth", isAuth);

  document.querySelectorAll(".auth-action-btn").forEach((button) => {
    const text = button.querySelector(".auth-action-text");
    const icon = button.querySelector(".auth-action-icon");

    if (isAuth) {
      button.href = "#";
      if (text) text.textContent = currentUser.username;
      setAuthButtonIcon(icon, currentUser.username);
    } else {
      button.href = "login.html";
      if (text) text.textContent = "Войти";
      setAuthButtonIcon(icon, null);
    }
  });

  document.querySelectorAll(".auth-action-mobile").forEach((button) => {
    if (isAuth) {
      button.href = "#";
      button.innerHTML = `<img class="mobile-auth-head" src="${minecraftHeadUrl(currentUser.username, 28)}" alt="Голова игрока"> ${currentUser.username}`;
    } else {
      button.href = "login.html";
      button.innerHTML = `<i data-lucide="log-in"></i> Войти`;
    }
  });

  const profileUsername = document.getElementById("profileUsername");
  if (profileUsername && isAuth) profileUsername.textContent = currentUser.username;

  const securityUsername = document.getElementById("securityUsername");
  if (securityUsername && isAuth) securityUsername.textContent = currentUser.username;

  const isAdmin = isAuth && ["MODERATOR", "ADMIN", "OWNER"].includes(normalizeAdminRole(currentUser.role));
  document.body.classList.toggle("is-admin", isAdmin);

  refreshLucideIcons();

  const autoLoginStatus = document.getElementById("autoLoginStatus");
  if (autoLoginStatus && isAuth) {
    const enabled = currentUser.autoLoginEnabled !== false;
    autoLoginStatus.textContent = enabled ? "Включён" : "Отключён";
    autoLoginStatus.className = enabled ? "green-text" : "red-text";
  }

  const pinStatus = document.getElementById("pinStatus");
  const pinHint = document.getElementById("pinHint");
  if (pinStatus && isAuth) {
    const hasPin = currentUser.hasPin === true;
    pinStatus.textContent = hasPin ? "Установлен" : "Не установлен";
    pinStatus.className = hasPin ? "green-text" : "red-text";
    if (pinHint) {
      pinHint.hidden = hasPin;
      pinHint.textContent = "Если PIN не установлен, задайте его в игре командой администратора аккаунта.";
    }
  }
}

const authMenuBtn = document.getElementById("authMenuBtn");
const authDropdown = document.getElementById("authDropdown");

if (authMenuBtn && authDropdown) {
  authMenuBtn.addEventListener("click", (event) => {
    if (!currentUser) return;
    event.preventDefault();
    authDropdown.classList.toggle("open");
  });

  document.addEventListener("click", (event) => {
    if (!authDropdown.classList.contains("open")) return;
    if (event.target.closest(".auth-menu-wrap")) return;
    authDropdown.classList.remove("open");
  });
}

async function logoutCurrentSession() {
  try {
    await apiRequest("/api/logout", { method: "POST" });
  } catch {}
  window.location.href = "login.html";
}

document.querySelectorAll("[data-logout], #logoutBtn").forEach((button) => {
  button.addEventListener("click", logoutCurrentSession);
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
      setAuthMessage(message, "Ник должен быть 3-16 символов: буквы, цифры и _", "error");
      return;
    }

    if (password.length < 6) {
      setAuthMessage(message, "Пароль должен быть минимум 6 символов.", "error");
      return;
    }

    if (password !== passwordRepeat) {
      setAuthMessage(message, "Пароли не совпадают.", "error");
      return;
    }

    try {
      await apiRequest("/api/register", {
        method: "POST",
        body: JSON.stringify({ username, password, passwordRepeat })
      });

      setAuthMessage(message, "Аккаунт создан. Открываем кабинет...", "success");
      setTimeout(() => window.location.href = "account.html", 800);
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
      await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });

      setAuthMessage(message, "Вход выполнен. Открываем кабинет...", "success");
      setTimeout(() => window.location.href = "account.html", 600);
    } catch (error) {
      setAuthMessage(message, error.message, "error");
    }
  });
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

    if (history.pushState) history.pushState(null, "", `#${sectionId}`);
  });
});

if (accountSections.length) {
  const observer = new IntersectionObserver((entries) => {
    const visibleEntries = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

    if (visibleEntries[0]) setActiveAccountSection(visibleEntries[0].target.id);
  }, {
    root: null,
    rootMargin: "-22% 0px -58% 0px",
    threshold: [0.15, 0.35, 0.55, 0.75]
  });

  accountSections.forEach((section) => observer.observe(section));
}

/* ===== REAL ACCOUNT DATA FROM WEBBRIDGE ===== */
function formatNumber(value) {
  const number = Number(value || 0);
  return number.toLocaleString("ru-RU");
}

function formatTicks(ticks) {
  const seconds = Math.floor(Number(ticks || 0) / 20);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} ч. ${minutes} мин.`;
  return `${minutes} мин.`;
}

function cmToKm(value) {
  return `${(Number(value || 0) / 100000).toFixed(1)} км`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatServerSince(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatLastLogin(value) {
  if (!value) return "-";
  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  if (isToday) return `Сегодня в ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Вчера в ${time}`;

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function prettyMaterial(type) {
  if (!type) return "-";

  const normalized = String(type)
    .trim()
    .replace(/^minecraft:/i, "")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

  const map = {
    AIR: "Воздух",
    STONE: "Камень",
    GRANITE: "Гранит",
    POLISHED_GRANITE: "Полированный гранит",
    DIORITE: "Диорит",
    POLISHED_DIORITE: "Полированный диорит",
    ANDESITE: "Андезит",
    POLISHED_ANDESITE: "Полированный андезит",
    DEEPSLATE: "Глубинный сланец",
    COBBLED_DEEPSLATE: "Булыжный глубинный сланец",
    TUFF: "Туф",
    CALCITE: "Кальцит",
    DRIPSTONE_BLOCK: "Капельниковый блок",
    GRASS_BLOCK: "Дёрн",
    DIRT: "Земля",
    COARSE_DIRT: "Каменистая земля",
    PODZOL: "Подзол",
    ROOTED_DIRT: "Корнистая земля",
    MUD: "Грязь",
    CLAY: "Глина",
    SAND: "Песок",
    RED_SAND: "Красный песок",
    GRAVEL: "Гравий",
    SNOW: "Снег",
    SNOW_BLOCK: "Блок снега",
    ICE: "Лёд",
    PACKED_ICE: "Плотный лёд",
    BLUE_ICE: "Синий лёд",
    COBBLESTONE: "Булыжник",
    MOSSY_COBBLESTONE: "Замшелый булыжник",
    OBSIDIAN: "Обсидиан",
    CRYING_OBSIDIAN: "Плачущий обсидиан",
    BEDROCK: "Бедрок",
    NETHERRACK: "Незерак",
    SOUL_SAND: "Песок душ",
    SOUL_SOIL: "Почва душ",
    BASALT: "Базальт",
    POLISHED_BASALT: "Полированный базальт",
    BLACKSTONE: "Чернит",
    END_STONE: "Эндерняк",
    OAK_LOG: "Дубовое бревно",
    SPRUCE_LOG: "Еловое бревно",
    BIRCH_LOG: "Берёзовое бревно",
    JUNGLE_LOG: "Тропическое бревно",
    ACACIA_LOG: "Акациевое бревно",
    DARK_OAK_LOG: "Бревно тёмного дуба",
    MANGROVE_LOG: "Мангровое бревно",
    CHERRY_LOG: "Вишнёвое бревно",
    CRIMSON_STEM: "Багровый стебель",
    WARPED_STEM: "Искажённый стебель",
    OAK_WOOD: "Дубовая древесина",
    SPRUCE_WOOD: "Еловая древесина",
    BIRCH_WOOD: "Берёзовая древесина",
    JUNGLE_WOOD: "Тропическая древесина",
    ACACIA_WOOD: "Акациевая древесина",
    DARK_OAK_WOOD: "Древесина тёмного дуба",
    OAK_PLANKS: "Дубовые доски",
    SPRUCE_PLANKS: "Еловые доски",
    BIRCH_PLANKS: "Берёзовые доски",
    JUNGLE_PLANKS: "Тропические доски",
    ACACIA_PLANKS: "Акациевые доски",
    DARK_OAK_PLANKS: "Доски из тёмного дуба",
    MANGROVE_PLANKS: "Мангровые доски",
    CHERRY_PLANKS: "Вишнёвые доски",
    CRIMSON_PLANKS: "Багровые доски",
    WARPED_PLANKS: "Искажённые доски",
    OAK_LEAVES: "Дубовая листва",
    SPRUCE_LEAVES: "Еловая хвоя",
    BIRCH_LEAVES: "Берёзовая листва",
    JUNGLE_LEAVES: "Тропическая листва",
    ACACIA_LEAVES: "Акациевая листва",
    DARK_OAK_LEAVES: "Листва тёмного дуба",
    COAL_ORE: "Угольная руда",
    DEEPSLATE_COAL_ORE: "Глубинная угольная руда",
    IRON_ORE: "Железная руда",
    DEEPSLATE_IRON_ORE: "Глубинная железная руда",
    COPPER_ORE: "Медная руда",
    DEEPSLATE_COPPER_ORE: "Глубинная медная руда",
    GOLD_ORE: "Золотая руда",
    DEEPSLATE_GOLD_ORE: "Глубинная золотая руда",
    REDSTONE_ORE: "Редстоуновая руда",
    DEEPSLATE_REDSTONE_ORE: "Глубинная редстоуновая руда",
    LAPIS_ORE: "Лазуритовая руда",
    DEEPSLATE_LAPIS_ORE: "Глубинная лазуритовая руда",
    DIAMOND_ORE: "Алмазная руда",
    DEEPSLATE_DIAMOND_ORE: "Глубинная алмазная руда",
    EMERALD_ORE: "Изумрудная руда",
    DEEPSLATE_EMERALD_ORE: "Глубинная изумрудная руда",
    NETHER_GOLD_ORE: "Незерская золотая руда",
    NETHER_QUARTZ_ORE: "Незерская кварцевая руда",
    ANCIENT_DEBRIS: "Древние обломки",
    COAL: "Уголь",
    CHARCOAL: "Древесный уголь",
    RAW_IRON: "Рудное железо",
    IRON_INGOT: "Железный слиток",
    RAW_COPPER: "Рудная медь",
    COPPER_INGOT: "Медный слиток",
    RAW_GOLD: "Рудное золото",
    GOLD_INGOT: "Золотой слиток",
    DIAMOND: "Алмаз",
    EMERALD: "Изумруд",
    LAPIS_LAZULI: "Лазурит",
    REDSTONE: "Редстоун",
    QUARTZ: "Кварц",
    NETHERITE_SCRAP: "Незеритовый лом",
    NETHERITE_INGOT: "Незеритовый слиток",
    STICK: "Палка",
    TORCH: "Факел",
    CRAFTING_TABLE: "Верстак",
    FURNACE: "Печь",
    BLAST_FURNACE: "Плавильная печь",
    SMOKER: "Коптильня",
    CHEST: "Сундук",
    TRAPPED_CHEST: "Сундук-ловушка",
    BARREL: "Бочка",
    LADDER: "Лестница",
    SCAFFOLDING: "Подмостки",
    BOOK: "Книга",
    ENCHANTED_BOOK: "Зачарованная книга",
    PAPER: "Бумага",
    BREAD: "Хлеб",
    APPLE: "Яблоко",
    GOLDEN_APPLE: "Золотое яблоко",
    WATER_BUCKET: "Ведро воды",
    LAVA_BUCKET: "Ведро лавы",
    BUCKET: "Ведро",
    SHIELD: "Щит",
    BOW: "Лук",
    CROSSBOW: "Арбалет",
    ARROW: "Стрела",
    TRIDENT: "Трезубец",
    WOODEN_SWORD: "Деревянный меч",
    STONE_SWORD: "Каменный меч",
    IRON_SWORD: "Железный меч",
    GOLDEN_SWORD: "Золотой меч",
    DIAMOND_SWORD: "Алмазный меч",
    NETHERITE_SWORD: "Незеритовый меч",
    WOODEN_PICKAXE: "Деревянная кирка",
    STONE_PICKAXE: "Каменная кирка",
    IRON_PICKAXE: "Железная кирка",
    GOLDEN_PICKAXE: "Золотая кирка",
    DIAMOND_PICKAXE: "Алмазная кирка",
    NETHERITE_PICKAXE: "Незеритовая кирка",
    WOODEN_AXE: "Деревянный топор",
    STONE_AXE: "Каменный топор",
    IRON_AXE: "Железный топор",
    GOLDEN_AXE: "Золотой топор",
    DIAMOND_AXE: "Алмазный топор",
    NETHERITE_AXE: "Незеритовый топор",
    WOODEN_SHOVEL: "Деревянная лопата",
    STONE_SHOVEL: "Каменная лопата",
    IRON_SHOVEL: "Железная лопата",
    GOLDEN_SHOVEL: "Золотая лопата",
    DIAMOND_SHOVEL: "Алмазная лопата",
    NETHERITE_SHOVEL: "Незеритовая лопата",
    WOODEN_HOE: "Деревянная мотыга",
    STONE_HOE: "Каменная мотыга",
    IRON_HOE: "Железная мотыга",
    GOLDEN_HOE: "Золотая мотыга",
    DIAMOND_HOE: "Алмазная мотыга",
    NETHERITE_HOE: "Незеритовая мотыга",
    LEATHER_HELMET: "Кожаный шлем",
    LEATHER_CHESTPLATE: "Кожаная куртка",
    LEATHER_LEGGINGS: "Кожаные штаны",
    LEATHER_BOOTS: "Кожаные ботинки",
    IRON_HELMET: "Железный шлем",
    IRON_CHESTPLATE: "Железный нагрудник",
    IRON_LEGGINGS: "Железные поножи",
    IRON_BOOTS: "Железные ботинки",
    DIAMOND_HELMET: "Алмазный шлем",
    DIAMOND_CHESTPLATE: "Алмазный нагрудник",
    DIAMOND_LEGGINGS: "Алмазные поножи",
    DIAMOND_BOOTS: "Алмазные ботинки",
    NETHERITE_HELMET: "Незеритовый шлем",
    NETHERITE_CHESTPLATE: "Незеритовый нагрудник",
    NETHERITE_LEGGINGS: "Незеритовые поножи",
    NETHERITE_BOOTS: "Незеритовые ботинки"
  };

  if (map[normalized]) return map[normalized];

  const colors = {
    WHITE: "белый", ORANGE: "оранжевый", MAGENTA: "пурпурный", LIGHT_BLUE: "голубой",
    YELLOW: "жёлтый", LIME: "лаймовый", PINK: "розовый", GRAY: "серый",
    LIGHT_GRAY: "светло-серый", CYAN: "бирюзовый", PURPLE: "фиолетовый", BLUE: "синий",
    BROWN: "коричневый", GREEN: "зелёный", RED: "красный", BLACK: "чёрный"
  };
  for (const [prefix, color] of Object.entries(colors)) {
    if (normalized === `${prefix}_WOOL`) return `${color[0].toUpperCase()}${color.slice(1)} шерсть`;
    if (normalized === `${prefix}_BED`) return `${color[0].toUpperCase()}${color.slice(1)} кровать`;
    if (normalized === `${prefix}_CONCRETE`) return `${color[0].toUpperCase()}${color.slice(1)} бетон`;
    if (normalized === `${prefix}_TERRACOTTA`) return `${color[0].toUpperCase()}${color.slice(1)} керамика`;
    if (normalized === `${prefix}_STAINED_GLASS`) return `${color[0].toUpperCase()}${color.slice(1)} стекло`;
  }

  const fallbackWords = {
    OAK: "дубовый", SPRUCE: "еловый", BIRCH: "берёзовый", JUNGLE: "тропический",
    ACACIA: "акациевый", DARK: "тёмный", MANGROVE: "мангровый", CHERRY: "вишнёвый",
    CRIMSON: "багровый", WARPED: "искажённый", PLANKS: "доски", LOG: "бревно",
    WOOD: "древесина", STONE: "камень", DEEPSLATE: "глубинный сланец", COBBLESTONE: "булыжник",
    BRICKS: "кирпичи", BRICK: "кирпич", BLOCK: "блок", SLAB: "плита", STAIRS: "ступеньки",
    WALL: "ограда", DOOR: "дверь", TRAPDOOR: "люк", FENCE: "забор", GATE: "калитка",
    BUTTON: "кнопка", PRESSURE: "нажимная", PLATE: "плита", SWORD: "меч", PICKAXE: "кирка",
    AXE: "топор", SHOVEL: "лопата", HOE: "мотыга", HELMET: "шлем", CHESTPLATE: "нагрудник",
    LEGGINGS: "поножи", BOOTS: "ботинки", IRON: "железный", GOLDEN: "золотой", DIAMOND: "алмазный",
    NETHERITE: "незеритовый", WOODEN: "деревянный"
  };

  return normalized
    .split("_")
    .map((word) => fallbackWords[word] || word.toLowerCase())
    .join(" ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function renderStatsList(stats, blocksTotal) {
  const list = document.getElementById("detailedStatsList");
  if (!list) return;

  const rows = [
    ["Время в игре", formatTicks(stats?.play_time_ticks)],
    ["Пройдено пешком", cmToKm(stats?.walk_distance)],
    ["Сломано блоков", formatNumber(blocksTotal)],
    ["Смерти", formatNumber(stats?.deaths)],
    ["Убийства мобов", formatNumber(stats?.mob_kills)],
    ["Получено урона", formatNumber(stats?.damage_taken)],
    ["Нанесено урона", formatNumber(stats?.damage_dealt)],
    ["Прыжки", formatNumber(stats?.jump_count)],
    ["Раз поспал в кровати", formatNumber(stats?.sleep_count)],
    ["Открыто сундуков", formatNumber(stats?.open_chest)]
  ];

  list.innerHTML = rows.map(([label, value]) => `<p><span>${label}</span><b>${value}</b></p>`).join("");
}

function sortByAmountDesc(rows, amountKey) {
  return [...(rows || [])].sort((a, b) => Number(b?.[amountKey] || 0) - Number(a?.[amountKey] || 0));
}

function sortByDateDesc(rows) {
  return [...(rows || [])].sort((a, b) => {
    const dateA = new Date(a?.created_at || a?.createdAt || a?.updated_at || a?.updatedAt || 0).getTime() || 0;
    const dateB = new Date(b?.created_at || b?.createdAt || b?.updated_at || b?.updatedAt || 0).getTime() || 0;
    return dateB - dateA;
  });
}

function renderBarList(id, rows, typeKey, amountKey, limit = null) {
  const list = document.getElementById(id);
  if (!list) return;

  const preparedRows = sortByAmountDesc(rows, amountKey).slice(0, limit || undefined);

  if (!preparedRows.length) {
    list.innerHTML = `<p><span>Пока нет данных</span><i><em style="width:0%"></em></i><b>-</b></p>`;
    return;
  }

  const max = Math.max(...preparedRows.map((row) => Number(row[amountKey] || 0)), 1);
  list.innerHTML = preparedRows.map((row) => {
    const amount = Number(row[amountKey] || 0);
    const width = Math.max(8, Math.round((amount / max) * 100));
    return `<p><span>${prettyMaterial(row[typeKey])}</span><i><em style="width:${width}%"></em></i><b>${formatNumber(amount)}</b></p>`;
  }).join("");
}

function renderSimpleList(id, rows, typeKey, amountKey, limit = null) {
  const list = document.getElementById(id);
  if (!list) return;

  const preparedRows = sortByAmountDesc(rows, amountKey).slice(0, limit || undefined);

  if (!preparedRows.length) {
    list.innerHTML = `<p><span>Пока нет данных</span><b>-</b></p>`;
    return;
  }

  list.innerHTML = preparedRows.map((row) => {
    return `<p><span>${prettyMaterial(row[typeKey])}</span><b>${formatNumber(row[amountKey])}</b></p>`;
  }).join("");
}

function renderEnchantments(enchantments) {
  const list = document.getElementById("enchantsList");
  if (!list) return;

  if (!enchantments) {
    list.innerHTML = `<p><span>Пока нет данных</span><b>-</b></p>`;
    return;
  }

  list.innerHTML = `
    <p><span>Потрачено уровней</span><b>${formatNumber(enchantments.levels_spent)}</b></p>
    <p><span>Всего зачарований</span><b>${formatNumber(enchantments.enchant_count)}</b></p>
    <p><span>Последнее обновление</span><b>${formatDate(enchantments.updated_at)}</b></p>
  `;
}

function renderOnlinePlayers(players) {
  const list = document.getElementById("onlinePlayersList");
  const count = document.getElementById("serverOnlineCount");
  if (!list) return;

  const onlineCount = (players || []).filter((player) => player.online).length;
  if (count) count.textContent = `${onlineCount} / 20 игроков`;

  if (!players || players.length === 0) {
    list.innerHTML = `<p><span>Пока никого нет</span><b>-</b></p>`;
    return;
  }

  list.innerHTML = players.map((player) => {
    const label = player.online ? "Онлайн" : formatDate(player.updated_at);
    return `<p><span>${player.nickname}</span><b>${label}</b></p>`;
  }).join("");
}

function xpRequiredForNextLevel(level) {
  const lvl = Math.max(0, Number(level || 0));
  if (lvl <= 15) return 2 * lvl + 7;
  if (lvl <= 30) return 5 * lvl - 38;
  return 9 * lvl - 158;
}

function currentLevelXpFromProgress(level, progress) {
  const required = xpRequiredForNextLevel(level);
  const normalized = Math.max(0, Math.min(1, Number(progress || 0)));
  return Math.round(required * normalized);
}

function renderDeathHistory(items = []) {
  const list = document.getElementById("deathList");
  if (!list) return;

  const preparedItems = sortByDateDesc(items).slice(0, 3);

  if (!preparedItems.length) {
    list.innerHTML = `<article><b>Пока нет данных</b><span>История смертей появится после первой смерти игрока.</span></article>`;
    return;
  }

  list.innerHTML = preparedItems.map((item) => {
    const reason = item.death_reason || item.reason || "Игрок погиб";
    const date = formatLastLogin(item.created_at || item.createdAt);
    const world = item.world_name ? ` · ${escapeHtml(item.world_name)}` : "";
    return `<article><b>☠ ${escapeHtml(reason)}</b><span>${escapeHtml(date)}${world}</span></article>`;
  }).join("");
}

function renderRecentAchievements(items = []) {
  const list = document.getElementById("achievementList");
  if (!list) return;

  const preparedItems = sortByDateDesc(items).slice(0, 5);

  if (!preparedItems.length) {
    list.innerHTML = `<p><span>Пока нет данных</span><b>-</b></p>`;
    return;
  }

  list.innerHTML = preparedItems.map((item) => {
    const title = item.advancement_title || item.title || item.advancement_key || "Достижение";
    const date = formatLastLogin(item.created_at || item.createdAt);
    return `<p><span>🏆 ${escapeHtml(title)}</span><b>${escapeHtml(date)}</b></p>`;
  }).join("");
}

function renderAccountData(data) {
  if (!data) return;

  const player = data.player || {};
  const stats = data.stats || data.player || {};
  const blocks = (data.blocks || data.minedBlocks || data.topBlocks || []).slice(0, 3);
  const crafts = (data.crafts || data.craftedItems || data.topCrafts || []).slice(0, 3);
  const blocksTotal = blocks.reduce((sum, block) => sum + Number(block.amount || 0), 0);

  const username = data.user?.username || player.nickname || "Игрок";

  setText("profileUsername", username);

  const roleRawOriginal = String(data.user?.role || player.role || "default").trim();
  const roleRaw = roleRawOriginal.toUpperCase();

  function resolveRole(raw) {
    const value = String(raw || "default").trim().toUpperCase();

    if (value.includes("SPEC.ADMIN") || value.includes("OWNER") || value.includes("ВЛАДЕЛ")) {
      return { label: "Спец.Админ", className: "owner" };
    }

    if (value.includes("ADMIN") || value.includes("АДМИН")) {
      return { label: "Админ", className: "admin" };
    }

    if (value.includes("MODER") || value.includes("МОДЕР")) {
      return { label: "Модер", className: "moderator" };
    }

    return { label: "Участник", className: "player" };
  }

  const resolvedRole = resolveRole(roleRaw);
  const roleElement = document.getElementById("profileRole");
  if (roleElement) {
    roleElement.textContent = resolvedRole.label;
    roleElement.className = `role-badge role-${resolvedRole.className}`;
    roleElement.dataset.role = resolvedRole.className;
  }

  const status = document.getElementById("profileOnlineStatus");
  if (status) {
    const online = player.online === true;
    status.innerHTML = `<span class="status-dot" aria-hidden="true"></span>${online ? "Онлайн" : "Офлайн"}`;
    status.className = online ? "status online" : "status offline";
  }

  const playerHead = document.getElementById("playerHead");
  if (playerHead) {
    const skinName = player.nickname || data.user?.username || username || "Steve";
    playerHead.src = minecraftBustUrl(skinName, 512);
    playerHead.onerror = () => {
      playerHead.onerror = () => {
        playerHead.onerror = null;
        playerHead.src = minecraftBustFallbackUrl("Steve", 512);
      };
      playerHead.src = minecraftBustFallbackUrl(skinName, 512);
    };
  }

  const xpLevel = Number(player.xp_level || 0);
  const totalXp = Number(player.total_experience || 0);
  const expProgressRaw = Math.max(0, Math.min(1, Number(player.exp_progress || 0)));
  const xpProgress = Math.round(expProgressRaw * 100);
  const xpNeed = xpRequiredForNextLevel(xpLevel);
  const xpCurrent = currentLevelXpFromProgress(xpLevel, expProgressRaw);

  setText("profileXpText", `Уровень: ${xpLevel}`);
  setText("profileXpProgress", `${formatNumber(xpCurrent)} / ${formatNumber(xpNeed)} XP`);

  const progressLine = document.querySelector(".profile-hero .progress i");
  if (progressLine) {
    progressLine.style.width = `${xpProgress}%`;
  }

  const achievementsTotal = Number(data.achievements_count || data.achievementsCount || player.achievements_count || 0);

  setText("profileRegisteredAt", formatServerSince(data.user?.registeredAt || data.user?.registered_at || player.first_join_at || player.created_at || player.updated_at));
  setText("profileLastLogin", formatLastLogin(data.user?.lastServerLogin || data.user?.last_server_login || player.last_login_at || player.updated_at || data.meta?.updatedAt));
  setText("quickPlaytime", formatTicks(stats.play_time_ticks || player.play_time_ticks));
  setText("quickAchievements", achievementsTotal > 0 ? formatNumber(achievementsTotal) : "-");
  setText("quickDeaths", formatNumber(stats.deaths || player.deaths));
  setText("quickMobKills", formatNumber(stats.mob_kills || player.mob_kills));

  renderStatsList(stats, blocksTotal);
  renderOnlinePlayers(data.onlinePlayers || []);
  renderBarList("blocksList", blocks, "block_type", "amount", 3);
  renderSimpleList("craftsList", crafts, "item_type", "amount", 3);
  renderEnchantments(data.enchantments);
  renderDeathHistory((data.recentDeaths || data.deathsHistory || []).slice(0, 3));
  renderRecentAchievements((data.recentAchievements || data.achievements || []).slice(0, 5));
  loadProfileTitle();
  refreshLucideIcons();
}

async function loadProfileTitle() {
  const badge = document.getElementById('profileRole');
  if (!badge) return;
  try {
    const data = await apiRequest('/api/account/titles');
    const role = String(data.role || 'default').toLowerCase();
    const roleView = {
      default: { label: 'Участник', className: 'player' },
      moderator: { label: 'Модер', className: 'moderator' },
      admin: { label: 'Админ', className: 'admin' },
      'spec.admin': { label: 'Спец.Админ', className: 'owner' },
    }[role] || { label: 'Участник', className: 'player' };
    const activeTitle = (data.titles || []).find(title => title.id === data.activeTitleId);
    badge.textContent = activeTitle?.name || roleView.label;
    badge.className = `role-badge role-${roleView.className}`;
    badge.dataset.role = roleView.className;
    badge.dataset.titleId = activeTitle?.id || '';
  } catch (error) {
    console.warn('Не удалось загрузить выбранный титул:', error.message);
  }
}

/* ===== SECURITY PAGE ACTIONS ===== */
const securityMessage = document.getElementById("securityMessage");

async function securityPost(url, successText) {
  try {
    const data = await apiRequest(url, { method: "POST" });
    setAuthMessage(securityMessage, successText, "success");

    if (data.logout) {
      setTimeout(() => window.location.href = "login.html", 900);
      return;
    }

    const refreshed = await loadMe();
    refreshAuthUI();
    if (refreshed) renderAccountData(refreshed);
  } catch (error) {
    setAuthMessage(securityMessage, error.message || "Ошибка выполнения действия.", "error");
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
    securityPost("/api/logout-all", "Все сессии завершены.");
  });
}


const resetPasswordForm = document.getElementById("resetPasswordForm");
if (resetPasswordForm) {
  resetPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const pin = document.getElementById("resetPasswordPin")?.value?.trim() || "";
    const password = document.getElementById("resetNewPassword")?.value || "";
    const passwordRepeat = document.getElementById("resetNewPasswordRepeat")?.value || "";
    const message = document.getElementById("securityMessage");

    if (!/^\d{4}$/.test(pin)) {
      setAuthMessage(message, "PIN должен состоять из 4 цифр.", "error");
      return;
    }

    if (password !== passwordRepeat) {
      setAuthMessage(message, "Пароли не совпадают.", "error");
      return;
    }

    try {
      const result = await apiRequest("/api/security?action=reset-password", {
        method: "POST",
        body: JSON.stringify({ pin, password, passwordRepeat })
      });

      setAuthMessage(message, result.message || "Пароль сброшен.", "success");
      resetPasswordForm.reset();
    } catch (error) {
      setAuthMessage(message, error.message || "Ошибка сброса пароля.", "error");
    }
  });
}


/* ===== PLAY BUTTON AUTH REDIRECT ===== */
function goToStartDestination(event) {
  if (event) event.preventDefault();
  window.location.href = currentUser ? "account.html" : "register.html";
}

const playBtn = document.getElementById("playBtn");
if (playBtn) {
  playBtn.addEventListener("click", goToStartDestination);
}

const aboutFinalPlayBtn = document.getElementById("aboutFinalPlayBtn");
if (aboutFinalPlayBtn) {
  aboutFinalPlayBtn.addEventListener("click", goToStartDestination);
}

async function refreshAccountRealtime() {
  if (!document.querySelector(".account-page")) return;
  if (document.hidden) return;

  const data = await loadMe({ full: true, force: true });
  refreshAuthUI();

  if (data) {
    renderAccountData(data);
  }
}

(async function init() {
  const needsFullAccount = Boolean(document.querySelector(".account-page"));
  const needsAuthNow = Boolean(document.querySelector(".protected-page"));
  const data = await loadMe({ full: needsFullAccount });
  refreshAuthUI();
  refreshLucideIcons();

  if (needsAuthNow && !currentUser) {
    window.location.href = "login.html";
    return;
  }

  if (needsFullAccount && data) renderAccountData(data);

  await initAdminPanel();

  if (needsFullAccount) {
    setInterval(refreshAccountRealtime, 15000);
  }
})();


/* ===== ADMIN PANEL ===== */
let adminSelectedPlayer = null;
let adminPlayersCache = [];

function isCurrentUserAdmin() {
  return Boolean(currentUser && ["MODERATOR", "ADMIN", "OWNER"].includes(normalizeAdminRole(currentUser.role)));
}

function resolveAdminRole(raw) {
  const value = String(raw || "default").trim().toUpperCase();

  if (value.includes("SPEC.ADMIN") || value.includes("OWNER") || value.includes("ВЛАДЕЛ")) {
    return { label: "Спец.Админ", className: "owner" };
  }

  if (value.includes("ADMIN") || value.includes("АДМИН")) {
    return { label: "Админ", className: "admin" };
  }

  if (value.includes("MODER") || value.includes("МОДЕР")) {
    return { label: "Модер", className: "moderator" };
  }

  return { label: "Участник", className: "player" };
}

function adminRoleBadge(raw) {
  const role = resolveAdminRole(raw);
  return `<span class="role-badge role-${role.className} admin-role-badge">${role.label}</span>`;
}

function adminUserBadge(username, roleRaw) {
  return `<span class="admin-user-badge-name">${username || "Администратор"}</span>${adminRoleBadge(roleRaw)}`;
}


function currentAdminRole() {
  return normalizeAdminRole(currentUser?.role);
}

function normalizeAdminRole(raw) {
  const value = String(raw || "PLAYER").trim().toUpperCase();
  if (value.includes("SPEC.ADMIN") || value.includes("OWNER") || value.includes("ВЛАДЕЛ")) return "OWNER";
  if (value.includes("ADMIN") || value.includes("АДМИН")) return "ADMIN";
  if (value.includes("MODER") || value.includes("МОДЕР")) return "MODERATOR";
  return "PLAYER";
}

function canUseFullAdminActions() {
  return ["ADMIN", "OWNER"].includes(currentAdminRole());
}

function canUseOwnerActions() {
  return currentAdminRole() === "OWNER";
}

function canAdminActOnPlayer(player) {
  if (!player || !currentUser) return false;

  const adminRole = currentAdminRole();
  const targetRole = normalizeAdminRole(player.role);
  const adminName = String(currentUser.username || "").toLowerCase();
  const targetName = String(player.username || "").toLowerCase();

  if (adminName && targetName && adminName === targetName) return false;
  if (Number(currentUser.id) && Number(player.id) && Number(currentUser.id) === Number(player.id)) return false;

  if (adminRole === "OWNER") return true;
  if (adminRole === "ADMIN") return ["MODERATOR", "PLAYER"].includes(targetRole);
  if (adminRole === "MODERATOR") return targetRole === "PLAYER";
  return false;
}

function adminActionAllowedForCurrentUser(action, player = null) {
  const role = currentAdminRole();

  if (player && !canAdminActOnPlayer(player)) return false;

  if (role === "OWNER") return true;
  if (role === "ADMIN") return !["SET_ROLE"].includes(action);
  if (role === "MODERATOR") return ["MUTE", "TEMP_MUTE", "UNMUTE", "KICK", "PRIVATE_MESSAGE"].includes(action);
  return false;
}

function adminDefaultActionForCurrentUser(player = null) {
  const preferred = currentAdminRole() === "MODERATOR" ? "MUTE" : "BAN";
  if (adminActionAllowedForCurrentUser(preferred, player)) return preferred;

  const fallbackActions = ["MUTE", "TEMP_MUTE", "UNMUTE", "KICK", "PRIVATE_MESSAGE", "BAN", "TEMP_BAN", "UNBAN", "WHITELIST_REMOVE", "RESET_PASSWORD", "RESET_PIN", "SET_ROLE"];
  return fallbackActions.find((action) => adminActionAllowedForCurrentUser(action, player)) || "";
}

function adminRestrictionMessage(player) {
  if (!player) return "Выберите игрока.";
  const adminRole = currentAdminRole();
  const targetRole = normalizeAdminRole(player.role);
  const adminName = String(currentUser?.username || "").toLowerCase();
  const targetName = String(player.username || "").toLowerCase();

  if ((adminName && targetName && adminName === targetName) || (Number(currentUser?.id) && Number(player.id) && Number(currentUser.id) === Number(player.id))) {
    return "Вы не можете выполнять действия над своим аккаунтом.";
  }

  if (adminRole === "ADMIN" && ["OWNER", "ADMIN"].includes(targetRole)) {
    return "ADMIN может выполнять действия только с MODERATOR и PLAYER.";
  }

  if (adminRole === "MODERATOR" && targetRole !== "PLAYER") {
    return "MODERATOR может выполнять действия только с PLAYER.";
  }

  return "Недостаточно прав для выбранного игрока.";
}


function setAdminMessage(text, type = "error") {
  const message = document.getElementById("adminPinMessage");
  if (!message) return;
  message.className = `auth-message ${type}`;
  message.textContent = text;
}

function adminStatusBadges(player) {
  const badges = [];
  if (player.banned) badges.push(`<span class="admin-tag danger">Бан</span>`);
  if (player.muted) badges.push(`<span class="admin-tag warn">Мут</span>`);
  if (!badges.length) badges.push(`<span class="admin-tag ok">Нет</span>`);
  return badges.join("");
}

function adminWhitelistBadge(player) {
  return player.whitelisted
    ? `<span class="admin-tag ok">Да</span>`
    : `<span class="admin-tag muted">Нет</span>`;
}

async function loadAdminOverview() {
  const dashboard = document.getElementById("adminDashboard");
  if (!dashboard) return;

  const data = await apiRequest("/api/admin?section=overview");
  dashboard.hidden = false;

  const badge = document.getElementById("adminBadge");
  bindAdminPlayerModal();
  if (badge) badge.innerHTML = adminUserBadge(data.admin.username, data.admin.role);

  const usersCount = document.getElementById("adminUsersCount");
  const onlineCount = document.getElementById("adminOnlineCount");
  const adminsCount = document.getElementById("adminAdminsCount");
  const wlCount = document.getElementById("adminWhitelistRequestsCount");

  if (usersCount) usersCount.textContent = formatNumber(data.cards.usersCount);
  if (onlineCount) onlineCount.textContent = formatNumber(data.cards.onlineCount);
  if (adminsCount) adminsCount.textContent = formatNumber(data.cards.adminCount);
  if (wlCount) wlCount.textContent = formatNumber(data.cards.whitelistRequestsCount || 0);

  await Promise.all([loadAdminPlayers(), loadAdminWhitelistRequests()]);
  refreshLucideIcons();
}

async function loadAdminPlayers() {
  const table = document.getElementById("adminPlayersTable");
  if (!table) return;

  const search = document.getElementById("adminPlayerSearch")?.value?.trim() || "";
  table.innerHTML = `<tr><td colspan="6">Загрузка…</td></tr>`;

  try {
    const data = await apiRequest(`/api/admin?section=players&search=${encodeURIComponent(search)}`);
    adminPlayersCache = sortAdminPlayers(data.players || []);

    table.innerHTML = adminPlayersCache.length ? adminPlayersCache.map((player) => {
      const online = player.online === true;
      return `
        <tr class="${adminSelectedPlayer?.username_lower === player.username_lower ? "selected" : ""}">
          <td><span class="admin-player-cell"><img src="${minecraftHeadUrl(player.username, 28)}" alt=""> ${player.username || "-"}</span></td>
          <td>${adminRoleBadge(player.role)}</td>
          <td><span class="admin-status ${online ? "online" : "offline"}">${online ? "Онлайн" : "Офлайн"}</span></td>
          <td>${adminWhitelistBadge(player)}</td>
          <td><span class="admin-tags">${adminStatusBadges(player)}</span></td>
          <td><button type="button" class="admin-mini-btn" data-admin-select="${player.username}"><i data-lucide="settings-2"></i> Открыть</button></td>
        </tr>
      `;
    }).join("") : `<tr><td colspan="6">Игроки не найдены.</td></tr>`;

    table.querySelectorAll("[data-admin-select]").forEach((button) => {
      button.addEventListener("click", () => {
        const username = button.dataset.adminSelect;
        const player = adminPlayersCache.find((item) => item.username === username);
        if (player) {
          openAdminPlayerModalLoading();
          loadAdminPlayerDetails(player.username, player)
            .then((detailedPlayer) => renderAdminPlayerPanel(detailedPlayer))
            .catch((error) => {
              const content = document.getElementById("adminPlayerModalContent");
              if (content) {
                content.innerHTML = `<div class="admin-modal-loading admin-modal-error"><h2>Не удалось загрузить статистику</h2><p>${escapeHtml(error.message || "Ошибка загрузки данных игрока.")}</p></div>`;
              }
            });
        }
      });
    });

    refreshLucideIcons();
  } catch (error) {
    table.innerHTML = `<tr><td colspan="6">${error.message || "Ошибка загрузки игроков."}</td></tr>`;
  }
}


function openAdminPlayerModalLoading() {
  const modal = document.getElementById("adminPlayerModal");
  const content = document.getElementById("adminPlayerModalContent");
  if (!modal || !content) return;
  content.innerHTML = `
    <div class="admin-modal-loading">
      <span class="admin-modal-spinner" aria-hidden="true"></span>
      <h2 id="adminPlayerModalTitle">Загрузка игрока…</h2>
      <p>Подготавливаем меню взаимодействия.</p>
    </div>
  `;
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("admin-modal-open");
  requestAnimationFrame(() => modal.classList.add("open"));
  refreshLucideIcons();
}

function closeAdminPlayerModal() {
  const modal = document.getElementById("adminPlayerModal");
  if (!modal || modal.hidden) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("admin-modal-open");
  window.setTimeout(() => {
    if (!modal.classList.contains("open")) modal.hidden = true;
  }, 220);
}

async function loadAdminPlayerDetails(username, fallbackPlayer = null) {
  const safeUsername = String(username || fallbackPlayer?.username || "").trim();
  if (!safeUsername) throw new Error("Не выбран игрок.");

  const data = await apiRequest(`/api/admin?section=player-details&username=${encodeURIComponent(safeUsername)}`);
  const details = data.player || {};
  return {
    ...(fallbackPlayer || {}),
    ...details,
    stats: data.stats || details.stats || fallbackPlayer?.stats || {},
    blocks_total: Number(data.blocksTotal ?? details.blocks_total ?? fallbackPlayer?.blocks_total ?? 0),
    recent_deaths: data.recentDeaths || data.deathsHistory || details.recent_deaths || details.recentDeaths || [],
    recentDeaths: data.recentDeaths || data.deathsHistory || details.recentDeaths || details.recent_deaths || []
  };
}

function bindAdminPlayerModal() {
  const modal = document.getElementById("adminPlayerModal");
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = "true";
  modal.querySelectorAll("[data-admin-player-modal-close]").forEach((node) => {
    node.addEventListener("click", closeAdminPlayerModal);
  });
  document.getElementById("adminPlayerModalClose")?.addEventListener("click", closeAdminPlayerModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeAdminPlayerModal();
  });
}

function adminNameSortRank(username) {
  const first = String(username || "").trim().charAt(0);
  return /^[A-Za-zА-Яа-яЁё]$/.test(first) ? 0 : 1;
}

function sortAdminPlayers(players) {
  return [...(players || [])].sort((a, b) => {
    const onlineA = (a.online === true || a.isOnline === true) ? 0 : 1;
    const onlineB = (b.online === true || b.isOnline === true) ? 0 : 1;
    if (onlineA !== onlineB) return onlineA - onlineB;

    const rankA = adminNameSortRank(a.username);
    const rankB = adminNameSortRank(b.username);
    if (rankA !== rankB) return rankA - rankB;

    return String(a.username || "").localeCompare(String(b.username || ""), ["ru", "en"], {
      sensitivity: "base",
      numeric: true
    });
  });
}


function renderAdminRecentDeathsMini(items = []) {
  const preparedItems = Array.isArray(items) ? sortByDateDesc(items).slice(0, 3) : [];
  if (!preparedItems.length) {
    return `<article class="admin-death-mini-empty"><b>Нет данных</b><span>Последние смерти появятся после синхронизации статистики.</span></article>`;
  }
  return preparedItems.map((item) => {
    const reason = item.death_reason || item.reason || "Игрок погиб";
    const date = formatLastLogin(item.created_at || item.createdAt);
    const world = item.world_name || item.worldName || "";
    const coords = [item.x, item.y, item.z].every((value) => value !== undefined && value !== null)
      ? ` · ${Math.round(Number(item.x))}, ${Math.round(Number(item.y))}, ${Math.round(Number(item.z))}`
      : "";
    return `<article><b>☠ ${escapeHtml(reason)}</b><span>${escapeHtml(date)}${world ? ` · ${escapeHtml(world)}` : ""}${escapeHtml(coords)}</span></article>`;
  }).join("");
}


function getDeepValue(source, path) {
  if (!source || !path) return undefined;
  return String(path).split('.').reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : undefined), source);
}

function pickAdminNumber(player, paths, fallback = 0) {
  for (const path of paths) {
    const value = path.includes('.') ? getDeepValue(player, path) : player?.[path];
    if (value === null || value === undefined || value === '') continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return fallback;
}

function pickAdminArray(player, paths) {
  for (const path of paths) {
    const value = path.includes('.') ? getDeepValue(player, path) : player?.[path];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function normalizeAdminPlayTicks(raw) {
  const value = Number(raw || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  // VPS API может отдавать время как ticks, seconds или minutes.
  // Большие значения считаем тиками Minecraft, маленькие — минутами/секундами.
  return value;
}

function renderAdminPlayerPanel(player) {
  adminSelectedPlayer = player;
  const panel = document.getElementById("adminPlayerModalContent") || document.getElementById("adminPlayerPanel");
  if (!panel) return;

  const defaultAction = adminDefaultActionForCurrentUser(player);
  const actionButtons = [
    { action: "BAN", icon: "ban", label: "Бан", cls: "danger" },
    { action: "TEMP_BAN", icon: "timer-off", label: "Временный бан", cls: "danger" },
    { action: "MUTE", icon: "message-circle-off", label: "Мут", cls: "warn" },
    { action: "TEMP_MUTE", icon: "clock-3", label: "Временный мут", cls: "warn" },
    { action: "UNBAN", icon: "shield-check", label: "Снять бан", cls: "safe" },
    { action: "UNMUTE", icon: "message-circle", label: "Снять мут", cls: "safe" },
    { action: "KICK", icon: "log-out", label: "Кикнуть", cls: "" },
    { action: "PRIVATE_MESSAGE", icon: "send", label: "ЛС игроку", cls: "" },
    { action: "WHITELIST_REMOVE", icon: "user-minus", label: "Удалить из WL", cls: "" },
    { action: "RESET_PASSWORD", icon: "rotate-ccw-key", label: "Сбросить пароль", cls: "danger" },
    { action: "RESET_PIN", icon: "key-round", label: "Сбросить PIN", cls: "danger" },
    { action: "SET_ROLE", icon: "crown", label: "Установить роль", cls: "safe owner-only" }
  ].filter((item) => adminActionAllowedForCurrentUser(item.action, player));
  const canActOnSelected = canAdminActOnPlayer(player);
  const restrictionText = canActOnSelected ? "" : adminRestrictionMessage(player);
  const isOnline = player.online === true || player.isOnline === true;
  const hasBan = player.banned === true || player.active_ban === true;
  const hasMute = player.muted === true || player.active_mute === true;
  const hasPunishment = hasBan || hasMute || player.hasPunishment || player.hasActivePunishments;
  const lastSeen = player.last_server_login || player.last_web_login || player.last_seen || player.lastSeen || player.player_updated_at || player.updated_at;
  const blocksTotal = pickAdminNumber(player, [
    "blocks_total", "blocks_mined", "mined_blocks", "broken_blocks", "blocks",
    "stats.blocks_total", "stats.blocks_mined", "stats.mined_blocks", "stats.broken_blocks",
    "player_stats.blocks_total", "player_stats.blocks_mined", "detailed_stats.blocks_mined"
  ]);
  const playTicks = normalizeAdminPlayTicks(pickAdminNumber(player, [
    "play_time_ticks", "playtime_ticks", "playTimeTicks", "time_played_ticks", "stat_play_one_minute",
    "play_time", "playtime", "playTime", "online_time", "onlineTime", "time_played",
    "stats.play_time_ticks", "stats.playtime_ticks", "stats.online_time", "stats.play_time",
    "player_stats.play_time_ticks", "detailed_stats.play_time_ticks"
  ]));
  const mobsTotal = pickAdminNumber(player, [
    "mob_kills", "mobs_killed", "killed_mobs", "mobKills", "mob_kills_total",
    "stats.mob_kills", "stats.mobs_killed", "stats.killed_mobs",
    "player_stats.mob_kills", "detailed_stats.mob_kills"
  ]);
  const deathsTotal = pickAdminNumber(player, [
    "deaths", "death_count", "deaths_count", "total_deaths",
    "stats.deaths", "stats.death_count", "player_stats.deaths", "detailed_stats.deaths"
  ]);
  const roleInfo = resolveAdminRole(player.role);
  const playerUuid = player.uuid || player.minecraft_uuid || player.player_uuid || player.id || "-";
  const recentDeaths = pickAdminArray(player, ["recent_deaths", "recentDeaths", "death_history", "deathHistory", "latest_deaths", "latestDeaths", "stats.recent_deaths", "player_stats.recent_deaths"]).slice(0, 3);
  const formattedUuid = String(playerUuid || "-");
  const shortUuid = formattedUuid.length > 18 ? `${formattedUuid.slice(0, 8)}…${formattedUuid.slice(-6)}` : formattedUuid;

  panel.innerHTML = `
    <div class="admin-player-v2-shell">
      <header class="admin-player-v2-header">
        <div>
          <p class="eyebrow"><i data-lucide="shield-check"></i> Управление игроком</p>
          <h2 id="adminPlayerModalTitle">${escapeHtml(player.username || "Игрок")}</h2>

        </div>
        <button type="button" class="admin-mini-btn" id="adminPlayerRefresh"><i data-lucide="refresh-cw"></i> Обновить данные</button>
      </header>

      ${!canActOnSelected ? `<div class="admin-restriction-notice admin-restriction-notice-wide"><i data-lucide="shield-alert"></i><span>${restrictionText}</span></div>` : ""}

      <div class="admin-player-v2-grid">
        <aside class="admin-player-info-card admin-v2-card">
          <div class="admin-player-render-wrap">
            <img class="admin-player-render" src="${minecraftBustUrl(player.username, 420)}" alt="${escapeHtml(player.username || "Игрок")}" onerror="this.onerror=null;this.src='${minecraftBustFallbackUrl("Steve", 420)}'">
          </div>
          <div class="admin-player-info-main">
            <div class="admin-player-info-title">
              <h3>${escapeHtml(player.username || "-")}</h3>
              <div class="admin-player-info-tags">
                ${adminRoleBadge(player.role)}
                <span class="admin-status ${isOnline ? "online" : "offline"}">${isOnline ? "Онлайн" : "Офлайн"}</span>
              </div>
            </div>
            <div class="admin-player-info-list admin-player-info-list-clean">
              <p><span>White-List</span><b>${player.whitelisted ? "Добавлен" : "Нет"}</b></p>
              <p><span>Наказания</span><b class="${hasPunishment ? "admin-text-danger" : "admin-text-ok"}">${hasPunishment ? "Имеются" : "Нет"}</b></p>
              <p><span>На сервере с</span><b>${formatServerSince(player.registered_at)}</b></p>
              <p><span>Последний вход</span><b>${formatLastLogin(lastSeen)}</b></p>
              <p class="admin-player-info-full"><span>ID / UUID</span><b title="${escapeHtml(formattedUuid)}">${escapeHtml(shortUuid)}</b></p>
            </div>
            <div class="admin-death-mini">
              <div class="admin-v2-card-head compact-mini">
                <p class="eyebrow"><i data-lucide="skull"></i> Последние смерти</p>
              </div>
              <div class="admin-death-mini-list">
                ${renderAdminRecentDeathsMini(recentDeaths)}
              </div>
            </div>
          </div>
        </aside>

        <section class="admin-action-form admin-v2-card ${canActOnSelected ? "" : "admin-action-disabled"}" id="adminActionFormWrap">
          <form id="adminActionForm">
            <label>Действие</label>
            <input id="adminActionType" type="hidden" value="${defaultAction}" />
            <div class="admin-action-picker" role="radiogroup" aria-label="Выбор действия">
              ${canActOnSelected && actionButtons.length ? actionButtons.map((item) => `
                <button type="button" class="${item.action === defaultAction ? "active " : ""}${item.cls}" data-admin-action="${item.action}">
                  <i data-lucide="${item.icon}"></i><span>${item.label}</span>
                </button>
              `).join("") : (canActOnSelected ? `<div class="admin-no-actions">Нет доступных действий для выбранного игрока.</div>` : "")}
            </div>

            <label id="adminRoleLabel" hidden>Новая роль</label>
            <div id="adminRoleSelectWrap" class="admin-role-select-wrap" hidden>
              <select id="adminNewRole" class="admin-role-select">
                <option value="default">Участник</option>
                <option value="moderator">Модер</option>
                <option value="admin">Админ</option>
                <option value="spec.admin">Спец.Админ</option>
              </select>
            </div>

            <label id="adminDurationLabel" hidden>Срок</label>
            <input id="adminActionDuration" type="text" placeholder="Например: 10m, 2h, 7d" hidden />

            <label id="adminMessageLabel" hidden>Сообщение игроку</label>
            <textarea id="adminPrivateMessage" rows="3" placeholder="Текст личного сообщения игроку" hidden></textarea>

            <label id="adminReasonLabel">Причина</label>
            <textarea id="adminActionReason" rows="3" placeholder="Например: нарушение правил сервера"></textarea>

            <button type="submit" class="primary-btn" ${canActOnSelected ? "" : "disabled"}><i data-lucide="gavel"></i> Выполнить действие</button>
            <p class="auth-message" id="adminActionMessage"></p>
          </form>
        </section>

        <section class="admin-active-punishments admin-v2-card">
          <div class="admin-v2-card-head">
            <p class="eyebrow"><i data-lucide="shield-alert"></i> Активные наказания</p>
            <h3>${hasPunishment ? "Есть ограничения" : "Наказаний нет"}</h3>
          </div>
          <div class="admin-active-punishments-list">
            ${hasBan ? `<article class="admin-active-punishment danger"><b>BAN</b><span>${player.ban_expires_at ? `до ${formatDate(player.ban_expires_at)}` : "активен"}</span></article>` : ""}
            ${hasMute ? `<article class="admin-active-punishment warn"><b>MUTE</b><span>${player.mute_expires_at ? `до ${formatDate(player.mute_expires_at)}` : "активен"}</span></article>` : ""}
            ${!hasPunishment ? `<div class="admin-empty-mini"><i data-lucide="circle-check"></i><p>У игрока нет активных наказаний.</p></div>` : ""}
          </div>
        </section>

        <section class="admin-player-stats admin-v2-card">
          <div class="admin-v2-card-head">
            <p class="eyebrow"><i data-lucide="bar-chart-3"></i> Статистика</p>
            <h3>Кратко</h3>
          </div>
          <div class="admin-player-stats-grid">
            <p><span>Время</span><b>${formatTicks(playTicks)}</b></p>
            <p><span>Блоки</span><b>${formatNumber(blocksTotal)}</b></p>
            <p><span>Мобы</span><b>${formatNumber(mobsTotal)}</b></p>
            <p><span>Смерти</span><b>${formatNumber(deathsTotal)}</b></p>
          </div>
        </section>

        <section class="admin-history-box admin-v2-card">
          <div class="admin-section-head compact">
            <div>
              <p class="eyebrow"><i data-lucide="history"></i> История</p>
              <h3>Наказания игрока</h3>
            </div>
            <button type="button" class="admin-mini-btn" id="adminHistoryRefresh"><i data-lucide="refresh-cw"></i></button>
          </div>
          <div id="adminPlayerHistory" class="admin-history-list">Загрузка…</div>
        </section>
      </div>
    </div>
  `;

  panel.classList.add("admin-modal-content-ready");

  const actionType = document.getElementById("adminActionType");
  const duration = document.getElementById("adminActionDuration");
  const durationLabel = document.getElementById("adminDurationLabel");
  const privateMessage = document.getElementById("adminPrivateMessage");
  const privateMessageLabel = document.getElementById("adminMessageLabel");
  const reason = document.getElementById("adminActionReason");
  const reasonLabel = document.getElementById("adminReasonLabel");
  const roleSelect = document.getElementById("adminNewRole");
  const roleWrap = document.getElementById("adminRoleSelectWrap");
  const roleLabel = document.getElementById("adminRoleLabel");
  const submitButton = document.querySelector("#adminActionForm button[type='submit']");
  const buttons = panel.querySelectorAll("[data-admin-action]");

  function syncActionFields() {
    const action = actionType.value;
    if (!action) return;
    const needDuration = ["TEMP_BAN", "TEMP_MUTE"].includes(action);
    const isPrivateMessage = action === "PRIVATE_MESSAGE";
    const isRole = action === "SET_ROLE";
    const noReason = ["RESET_PASSWORD", "RESET_PIN", "SET_ROLE"].includes(action);

    duration.hidden = !needDuration;
    durationLabel.hidden = !needDuration;
    if (!needDuration) duration.value = "";

    privateMessage.hidden = !isPrivateMessage;
    privateMessageLabel.hidden = !isPrivateMessage;
    if (!isPrivateMessage) privateMessage.value = "";

    if (roleSelect) roleSelect.hidden = !isRole;
    if (roleWrap) roleWrap.hidden = !isRole;
    roleLabel.hidden = !isRole;

    if (submitButton) {
      submitButton.innerHTML = isRole
        ? `<i data-lucide="crown"></i> Установить роль`
        : `<i data-lucide="gavel"></i> Выполнить действие`;
      refreshLucideIcons();
    }

    reason.hidden = noReason || isPrivateMessage;
    reasonLabel.hidden = noReason || isPrivateMessage;
  }

  function setAdminAction(action) {
    actionType.value = action;
    buttons.forEach((button) => button.classList.toggle("active", button.dataset.adminAction === action));
    syncActionFields();
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => setAdminAction(button.dataset.adminAction));
  });

  setAdminAction(defaultAction);

  document.getElementById("adminActionForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitAdminPlayerAction(player.username);
  });

  document.getElementById("adminHistoryRefresh")?.addEventListener("click", () => loadAdminPlayerHistory(player.username));
  document.getElementById("adminPlayerRefresh")?.addEventListener("click", async () => {
    openAdminPlayerModalLoading();
    try {
      const fresh = await loadAdminPlayerDetails(player.username, player);
      renderAdminPlayerPanel(fresh);
      loadAdminPlayers();
    } catch (error) {
      const content = document.getElementById("adminPlayerModalContent");
      if (content) {
        content.innerHTML = `<div class="admin-modal-loading admin-modal-error"><h2>Не удалось обновить данные</h2><p>${escapeHtml(error.message || "Ошибка загрузки данных игрока.")}</p></div>`;
      }
    }
  });

  loadAdminPlayerHistory(player.username);
  loadAdminPlayers();
  refreshLucideIcons();
}


function ensureAdminConfirmModal() {
  let modal = document.getElementById("adminPunishmentConfirmModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "adminPunishmentConfirmModal";
  modal.className = "admin-confirm-modal";
  modal.innerHTML = `
    <div class="admin-confirm-card" role="dialog" aria-modal="true">
      <div class="admin-confirm-icon"><i data-lucide="shield-alert"></i></div>
      <h2>Подтверждение наказания</h2>
      <p>Вы уверены что хотите наказать игрока?</p>
      <div class="admin-confirm-actions">
        <button type="button" class="admin-confirm-yes"><i data-lucide="check"></i> Да</button>
        <button type="button" class="admin-confirm-no"><i data-lucide="x"></i> Нет</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  refreshLucideIcons();
  return modal;
}

function confirmAdminPunishmentAction() {
  return new Promise((resolve) => {
    const modal = ensureAdminConfirmModal();
    const yes = modal.querySelector(".admin-confirm-yes");
    const no = modal.querySelector(".admin-confirm-no");

    function cleanup(result) {
      modal.classList.remove("open");
      yes?.removeEventListener("click", onYes);
      no?.removeEventListener("click", onNo);
      modal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onEsc);
      resolve(result);
    }

    function onYes() { cleanup(true); }
    function onNo() { cleanup(false); }
    function onBackdrop(event) {
      if (event.target === modal) cleanup(false);
    }
    function onEsc(event) {
      if (event.key === "Escape") cleanup(false);
    }

    yes?.addEventListener("click", onYes);
    no?.addEventListener("click", onNo);
    modal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onEsc);

    modal.classList.add("open");
    refreshLucideIcons();
    setTimeout(() => no?.focus(), 30);
  });
}


async function submitAdminPlayerAction(username) {
  const action = document.getElementById("adminActionType")?.value;
  const duration = document.getElementById("adminActionDuration")?.value?.trim() || "";
  const reason = document.getElementById("adminActionReason")?.value?.trim() || "Действие выполнено через админ-панель сайта";
  const privateMessage = document.getElementById("adminPrivateMessage")?.value?.trim() || "";
  const role = document.getElementById("adminNewRole")?.value || "";
  const message = document.getElementById("adminActionMessage");

  if (!action) {
    if (message) {
      message.className = "auth-message error";
      message.textContent = "Нет доступного действия для выбранного игрока.";
    }
    return;
  }

  if (adminSelectedPlayer && !canAdminActOnPlayer(adminSelectedPlayer)) {
    if (message) {
      message.className = "auth-message error";
      message.textContent = adminRestrictionMessage(adminSelectedPlayer);
    }
    return;
  }

  const needsConfirm = ["BAN", "TEMP_BAN", "MUTE", "TEMP_MUTE", "KICK"].includes(action);
  if (needsConfirm) {
    const confirmed = await confirmAdminPunishmentAction();
    if (!confirmed) {
      if (message) {
        message.className = "auth-message";
        message.textContent = "Действие отменено.";
      }
      return;
    }
  }

  if (message) {
    message.className = "auth-message";
    message.textContent = "Выполняю…";
  }

  try {
    const result = await apiRequest("/api/admin?section=player-action", {
      method: "POST",
      body: JSON.stringify({ username, action, duration, reason, message: privateMessage, role })
    });

    if (message) {
      message.className = "auth-message success";
      message.textContent = result.message || "Готово.";
    }

    await Promise.all([loadAdminPlayers(), loadAdminPlayerHistory(username)]);
  } catch (error) {
    if (message) {
      message.className = "auth-message error";
      message.textContent = error.message || "Ошибка действия.";
    }
  }
}

async function loadAdminPlayerHistory(username) {
  const box = document.getElementById("adminPlayerHistory");
  if (!box) return;

  box.textContent = "Загрузка…";

  try {
    const data = await apiRequest(`/api/admin?section=player-history&username=${encodeURIComponent(username)}`);
    const rows = data.history || [];

    box.innerHTML = rows.length ? rows.map((row) => {
      const active = row.active === true;
      const until = row.expires_at ? `до ${formatDate(row.expires_at)}` : "навсегда";
      return `
        <div class="admin-history-item">
          <div><b>${row.type}</b> <span class="admin-tag ${active ? "ok" : "muted"}">${active ? "Активно" : "Снято"}</span></div>
          <p>${row.reason || "Без причины"}</p>
          <small>${formatDate(row.created_at)} · ${until} · ${row.moderator_name || "-"} · ${row.source || "SERVER"}</small>
        </div>
      `;
    }).join("") : `<div class="admin-empty-mini">Истории наказаний нет.</div>`;
  } catch (error) {
    box.textContent = error.message || "Ошибка загрузки истории.";
  }
}

async function loadAdminWhitelistRequests() {
  const table = document.getElementById("adminWhitelistRequestsTable");
  if (!table) return;

  table.innerHTML = `<tr><td colspan="4">Загрузка…</td></tr>`;

  try {
    const data = await apiRequest("/api/admin?section=whitelist-requests");
    const rows = data.requests || [];

    table.innerHTML = rows.length ? rows.map((request) => `
      <tr>
        <td><span class="admin-player-cell"><img src="${minecraftHeadUrl(request.player_name, 28)}" alt=""> ${request.player_name}</span></td>
        <td>${formatDate(request.created_at)}</td>
        <td>${adminRoleBadge(request.role)}</td>
        <td class="admin-request-actions">
          <button type="button" class="admin-mini-btn approve" data-request-approve="${request.id}"><i data-lucide="check"></i> Одобрить</button>
          <button type="button" class="admin-mini-btn reject" data-request-reject="${request.id}"><i data-lucide="x"></i> Отклонить</button>
        </td>
      </tr>
    `).join("") : `<tr><td colspan="4">Активных заявок нет.</td></tr>`;

    table.querySelectorAll("[data-request-approve]").forEach((button) => {
      button.addEventListener("click", () => reviewWhitelistRequest(button.dataset.requestApprove, "APPROVE"));
    });

    table.querySelectorAll("[data-request-reject]").forEach((button) => {
      button.addEventListener("click", () => reviewWhitelistRequest(button.dataset.requestReject, "REJECT"));
    });

    refreshLucideIcons();
  } catch (error) {
    table.innerHTML = `<tr><td colspan="4">${error.message || "Ошибка загрузки заявок."}</td></tr>`;
  }
}

async function reviewWhitelistRequest(id, decision) {
  const reason = decision === "APPROVE" ? "Заявка одобрена через админ-панель" : "Заявка отклонена через админ-панель";

  await apiRequest("/api/admin?section=whitelist-requests", {
    method: "POST",
    body: JSON.stringify({ id: Number(id), decision, reason })
  });

  await Promise.all([loadAdminWhitelistRequests(), loadAdminPlayers(), loadAdminOverview()]);
}

async function initAdminPanel() {
  if (!document.querySelector(".admin-page")) return;

  const pinOverlay = document.getElementById("adminPinOverlay");
  const pinGate = document.getElementById("adminPinGate");
  const dashboard = document.getElementById("adminDashboard");
  const pinForm = document.getElementById("adminPinForm");
  const pinTitle = document.getElementById("adminPinTitle");
  const pinText = document.getElementById("adminPinText");
  const pinInput = document.getElementById("adminPinInput");
  const pinRepeat = document.getElementById("adminPinRepeat");
  const pinSubmit = document.getElementById("adminPinSubmit");
  const badge = document.getElementById("adminBadge");
  bindAdminPlayerModal();

  function cancelAdminPinCheck() {
    if (pinOverlay) pinOverlay.classList.remove("open");
    document.body.classList.remove("admin-pin-locked");
    window.setTimeout(() => { window.location.href = "index.html"; }, 180);
  }

  document.getElementById("adminPinCancel")?.addEventListener("click", cancelAdminPinCheck);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && pinOverlay && !pinOverlay.hidden && pinForm?.dataset.mode === "verify") cancelAdminPinCheck();
  });

  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  if (!isCurrentUserAdmin()) {
    if (badge) badge.textContent = "Доступ закрыт";
    if (dashboard) dashboard.hidden = true;
    document.body.classList.add("admin-pin-locked");
    if (pinOverlay) { pinOverlay.hidden = false; requestAnimationFrame(() => pinOverlay.classList.add("open")); }
    if (pinGate) {
      pinGate.innerHTML = `
        <div class="admin-pin-icon"><i data-lucide="ban"></i></div>
        <h2>Недостаточно прав</h2>
        <p>Админ-панель доступна группам moderator, admin и spec.admin.</p>
        <a class="primary-btn" href="account.html"><i data-lucide="user-round"></i> Вернуться в кабинет</a>
      `;
    }
    refreshLucideIcons();
    return;
  }

  try {
    const status = await apiRequest("/api/admin?section=status");
    if (badge) badge.innerHTML = adminUserBadge(status.user.username, status.user.role);
    document.body.classList.toggle("admin-limited", normalizeAdminRole(status.user.role) === "MODERATOR");
    document.body.classList.toggle("admin-full", ["ADMIN", "OWNER"].includes(normalizeAdminRole(status.user.role)));

    if (status.verified) {
      document.body.classList.remove("admin-pin-locked");
      if (pinOverlay) { pinOverlay.classList.remove("open"); pinOverlay.hidden = true; }
      if (dashboard) dashboard.hidden = false;
      await loadAdminOverview();
      bindAdminControls();
      return;
    }

    document.body.classList.add("admin-pin-locked");
    if (dashboard) dashboard.hidden = false;
    if (pinOverlay) { pinOverlay.hidden = false; requestAnimationFrame(() => pinOverlay.classList.add("open")); }

    if (!status.hasPin) {
      pinTitle.textContent = "Создайте PIN-код";
      pinText.textContent = "PIN нужен для дополнительной защиты админ-панели. Используйте 4 цифры.";
      pinRepeat.hidden = false;
      pinSubmit.innerHTML = `<i data-lucide="key-round"></i> Создать PIN`;
      pinForm.dataset.mode = "setup";
    } else {
      pinTitle.textContent = "Введите PIN-код";
      pinText.textContent = "Подтвердите 4-значный PIN-код, чтобы открыть админ-панель.";
      pinRepeat.hidden = true;
      pinSubmit.innerHTML = `<i data-lucide="unlock-keyhole"></i> Войти`;
      pinForm.dataset.mode = "verify";
    }

    refreshLucideIcons();
  } catch (error) {
    setAdminMessage(error.message || "Ошибка проверки доступа.", "error");
    document.body.classList.add("admin-pin-locked");
    if (pinOverlay) { pinOverlay.hidden = false; requestAnimationFrame(() => pinOverlay.classList.add("open")); }
  }

  if (pinForm) {
    pinForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const mode = pinForm.dataset.mode || "verify";
      const pin = pinInput.value.trim();
      const pinRepeatValue = pinRepeat.value.trim();

      if (!/^\d{4}$/.test(pin)) {
        setAdminMessage("PIN должен состоять из 4 цифр.", "error");
        return;
      }

      if (mode === "setup" && pin !== pinRepeatValue) {
        setAdminMessage("PIN-коды не совпадают.", "error");
        return;
      }

      try {
        pinSubmit.disabled = true;
        await apiRequest(mode === "setup" ? "/api/admin?section=setup-pin" : "/api/admin?section=verify-pin", {
          method: "POST",
          body: JSON.stringify({ pin, pinRepeat: pinRepeatValue })
        });

        setAdminMessage(mode === "setup" ? "PIN создан. Открываем панель..." : "Доступ разрешён. Открываем панель...", "success");
        pinInput.value = "";
        pinRepeat.value = "";
        document.body.classList.remove("admin-pin-locked");
        if (pinOverlay) { pinOverlay.classList.remove("open"); pinOverlay.hidden = true; }
        if (dashboard) dashboard.hidden = false;
        await loadAdminOverview();
        bindAdminControls();
      } catch (error) {
        setAdminMessage(error.message, "error");
      } finally {
        pinSubmit.disabled = false;
      }
    });
  }
}

function bindAdminControls() {
  const search = document.getElementById("adminPlayerSearch");
  const refreshPlayers = document.getElementById("adminPlayersRefresh");
  const refreshRequests = document.getElementById("adminRequestsRefresh");

  if (search && !search.dataset.bound) {
    search.dataset.bound = "true";
    let timer = null;
    search.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(loadAdminPlayers, 250);
    });
  }

  if (refreshPlayers && !refreshPlayers.dataset.bound) {
    refreshPlayers.dataset.bound = "true";
    refreshPlayers.addEventListener("click", loadAdminPlayers);
  }

  if (refreshRequests && !refreshRequests.dataset.bound) {
    refreshRequests.dataset.bound = "true";
    refreshRequests.addEventListener("click", loadAdminWhitelistRequests);
  }
}


/* ===== TOP PAGE ===== */
const topTableBody = document.getElementById("topTableBody");
const topFilters = document.getElementById("topFilters");
const topRefreshBtn = document.getElementById("topRefreshBtn");
const topRefreshHeroBtn = document.getElementById("topRefreshHeroBtn");
const topDescription = document.getElementById("topDescription");
const topMetricTitle = document.getElementById("topMetricTitle");
const topPodium = document.getElementById("topPodium");
const topPodiumTitle = document.getElementById("topPodiumTitle");
const topCategoryTitle = document.getElementById("topCategoryTitle");
const topCategoryNote = document.getElementById("topCategoryNote");
const topUpdatedAt = document.getElementById("topUpdatedAt");
const topHeroLeader = document.getElementById("topHeroLeader");
const topHeroLeaderValue = document.getElementById("topHeroLeaderValue");
const topStatsGrid = document.getElementById("topStatsGrid");
let currentTopCategory = "playtime";
let topLoadController = null;
const topDataCache = new Map();

function formatTopValue(value, format) {
  if (format === "ticks") return formatTicks(value);
  if (format === "damage") return `${formatNumber(value)} ед.`;
  return formatNumber(value);
}

function getActiveTopButton(category = currentTopCategory) {
  return topFilters?.querySelector(`[data-top-category="${CSS.escape(category)}"]`) || topFilters?.querySelector(".active");
}

function setTopMeta(data) {
  const activeButton = getActiveTopButton(data.category || currentTopCategory);
  const title = activeButton?.dataset.title || data.label || "Рейтинг";
  const note = activeButton?.dataset.note || data.description || "Топ игроков сезона.";

  if (topDescription) topDescription.textContent = data.description || note;
  if (topMetricTitle) topMetricTitle.textContent = data.label || "Значение";
  if (topPodiumTitle) topPodiumTitle.textContent = `Лучшие: ${title}`;
  if (topCategoryTitle) topCategoryTitle.textContent = title;
  if (topCategoryNote) topCategoryNote.textContent = note;
  if (topUpdatedAt) topUpdatedAt.textContent = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function renderTopPodium(data) {
  if (!topPodium) return;
  const players = data.players || [];
  const order = [1, 0, 2];

  if (!players.length) {
    topPodium.innerHTML = `<div class="top-podium-empty">Пока нет данных для пьедестала.</div>`;
    return;
  }

  topPodium.innerHTML = order.map((playerIndex) => {
    const player = players[playerIndex];
    const place = playerIndex + 1;
    if (!player) {
      return `<div class="top-podium-card top-podium-card-empty"><span>#${place}</span><b>Место свободно</b><small>Ждём статистику</small></div>`;
    }

    const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";
    return `
      <article class="top-podium-card top-podium-${place}">
        <div class="top-podium-medal">${medal}</div>
        <img src="${minecraftHeadUrl(player.username, 72)}" alt="${escapeHtml(player.username)}" onerror="this.src='https://minotar.net/helm/Steve/72.png'">
        <span>#${place}</span>
        <b>${escapeHtml(player.username)}</b>
        <small>${formatTopValue(player.value, data.format)}</small>
      </article>
    `;
  }).join("");
}

function renderTopStats(data) {
  const players = data.players || [];
  const leader = players[0];
  const total = players.reduce((sum, player) => sum + Number(player.value || 0), 0);
  const activeButton = getActiveTopButton(data.category || currentTopCategory);
  const categoryTitle = activeButton?.dataset.title || data.label || "Рейтинг";

  if (topHeroLeader) topHeroLeader.textContent = leader ? leader.username : "Пока нет лидера";
  if (topHeroLeaderValue) topHeroLeaderValue.textContent = leader ? formatTopValue(leader.value, data.format) : "Нет данных";

  if (topStatsGrid) {
    topStatsGrid.innerHTML = `
      <div><b>${players.length}</b><span>игроков</span></div>
      <div><b>${escapeHtml(categoryTitle)}</b><span>категория</span></div>
      <div><b>${formatTopValue(total, data.format)}</b><span>всего</span></div>
    `;
  }
}

function renderTopRows(data) {
  if (!topTableBody) return;

  const players = data.players || [];
  setTopMeta(data);
  renderTopStats(data);
  renderTopPodium(data);

  if (!players.length) {
    topTableBody.innerHTML = `<tr><td colspan="4" class="top-empty">Пока нет данных для этого рейтинга.</td></tr>`;
    refreshLucideIcons();
    return;
  }

  topTableBody.innerHTML = players.map((player, index) => {
    const place = index + 1;
    const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : `#${place}`;
    const placeClass = place <= 3 ? `top-place top-place-${place}` : "top-place";
    const statusText = place === 1 ? "Лидер" : place <= 3 ? "Топ-3" : place <= 10 ? "Топ-10" : "Участник";

    return `
      <tr>
        <td><span class="${placeClass}">${medal}</span></td>
        <td>
          <div class="top-player-cell">
            <img src="${minecraftHeadUrl(player.username, 42)}" alt="${escapeHtml(player.username)}" onerror="this.src='https://minotar.net/helm/Steve/42.png'">
            <div><b>${escapeHtml(player.username)}</b><small>Игрок сезона</small></div>
          </div>
        </td>
        <td><span class="top-value">${formatTopValue(player.value, data.format)}</span></td>
        <td><span class="top-row-status top-row-status-${Math.min(place, 4)}">${statusText}</span></td>
      </tr>
    `;
  }).join("");

  refreshLucideIcons();
}

async function loadTop(category = currentTopCategory) {
  if (!topTableBody) return;
  currentTopCategory = category;

  const cached = topDataCache.get(category);
  if (cached && Date.now() - cached.time < 30000) {
    renderTopRows(cached.data);
    return;
  }

  topTableBody.innerHTML = `<tr><td colspan="4" class="top-empty">Загрузка…</td></tr>`;
  if (topPodium) topPodium.innerHTML = `<div class="top-podium-empty">Загрузка лидеров…</div>`;

  if (topLoadController) topLoadController.abort();
  topLoadController = new AbortController();

  try {
    const response = await fetch(`/api/top?category=${encodeURIComponent(category)}`, {
      credentials: "include",
      signal: topLoadController.signal,
      headers: { "Accept": "application/json" }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || "Ошибка загрузки топа.");
    topDataCache.set(category, { time: Date.now(), data });
    renderTopRows(data);
  } catch (error) {
    if (error.name === "AbortError") return;
    topTableBody.innerHTML = `<tr><td colspan="4" class="top-empty error">${escapeHtml(error.message || "Ошибка загрузки топа.")}</td></tr>`;
    if (topPodium) topPodium.innerHTML = `<div class="top-podium-empty error">Не удалось загрузить пьедестал.</div>`;
  }
}

if (topFilters) {
  topFilters.querySelectorAll("[data-top-category]").forEach((button) => {
    button.addEventListener("click", () => {
      topFilters.querySelectorAll("[data-top-category]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      loadTop(button.dataset.topCategory);
    });
  });
}

if (topRefreshBtn) topRefreshBtn.addEventListener("click", () => loadTop(currentTopCategory));
if (topRefreshHeroBtn) topRefreshHeroBtn.addEventListener("click", () => loadTop(currentTopCategory));

if (topTableBody) {
  loadTop(currentTopCategory);
}

document.addEventListener('DOMContentLoaded',()=>{
 const open=document.getElementById('openResetModal');
 const modal=document.getElementById('resetModal');
 if(open&&modal){
  open.onclick=()=>modal.classList.add('show');
  modal.addEventListener('click',e=>{if(e.target===modal) modal.classList.remove('show');});
 }
});


/* ===== SECURITY PAGE MODAL CLEAN LOGIC ===== */
document.addEventListener("DOMContentLoaded", () => {
  const openResetModal = document.getElementById("openResetModal");
  const resetModal = document.getElementById("resetModal");
  const closeResetModal = document.getElementById("closeResetModal");
  const resetPasswordForm = document.getElementById("resetPasswordForm");
  const pinMissingNotice = document.getElementById("pinMissingNotice");
  const pinMissingOk = document.getElementById("pinMissingOk");

  function hasCurrentUserPin() {
    return currentUser?.hasPin === true || currentAccountData?.user?.hasPin === true;
  }

  function setResetModalMode() {
    const hasPin = hasCurrentUserPin();

    if (resetPasswordForm) resetPasswordForm.hidden = !hasPin;
    if (pinMissingNotice) pinMissingNotice.hidden = hasPin;

    if (hasPin) {
      setTimeout(() => document.getElementById("resetPasswordPin")?.focus(), 50);
    } else {
      setTimeout(() => pinMissingOk?.focus(), 50);
    }
  }

  function openSecurityResetModal() {
    if (!resetModal) return;

    setResetModalMode();
    resetModal.classList.add("open", "show");
    resetModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("security-modal-open");
    refreshLucideIcons();
  }

  function closeSecurityResetModal() {
    if (!resetModal) return;

    resetModal.classList.remove("open", "show");
    resetModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("security-modal-open");
  }

  if (openResetModal) {
    openResetModal.onclick = (event) => {
      event.preventDefault();
      openSecurityResetModal();
    };
  }

  if (closeResetModal) {
    closeResetModal.addEventListener("click", (event) => {
      event.preventDefault();
      closeSecurityResetModal();
    });
  }

  if (pinMissingOk) {
    pinMissingOk.addEventListener("click", (event) => {
      event.preventDefault();
      closeSecurityResetModal();
    });
  }

  if (resetModal) {
    resetModal.addEventListener("click", (event) => {
      if (event.target === resetModal) closeSecurityResetModal();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && resetModal?.classList.contains("open")) {
      closeSecurityResetModal();
    }
  });
});



/* ===== SERVER OPENING COUNTDOWN / IP REVEAL ===== */
const POPKINDOM_SERVER_OPEN_AT = Date.UTC(2026, 5, 20, 14, 0, 0); // 20.06.2026 17:00 МСК
const POPKINDOM_SERVER_ADDRESS = "pdcraft.aboba.host";

function formatOpeningCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days} д. ${hours} ч. ${minutes} мин.`;
  if (hours > 0) return `${hours} ч. ${minutes} мин. ${seconds} сек.`;
  return `${minutes} мин. ${seconds} сек.`;
}

function updateServerAddressCountdown() {
  const nodes = document.querySelectorAll("[data-server-address]");
  if (!nodes.length) return;

  const remaining = POPKINDOM_SERVER_OPEN_AT - Date.now();
  const isOpen = remaining <= 0;
  const value = isOpen ? POPKINDOM_SERVER_ADDRESS : formatOpeningCountdown(remaining);
  const title = isOpen ? "IP сервера" : "До открытия сервера";

  nodes.forEach((node) => {
    node.textContent = value;
    node.classList.toggle("is-open", isOpen);
    node.classList.toggle("is-countdown", !isOpen);

    const card = node.closest(".server-ip-card, .server-info-row");
    const label = card?.querySelector("span");
    if (label) label.textContent = title;
  });
}

updateServerAddressCountdown();
setInterval(updateServerAddressCountdown, 1000);

/* ===== Mega menu touch support ===== */
(function initMegaMenu() {
  const wrap = document.querySelector('.nav-more-wrap');
  const btn = document.querySelector('.nav-more-btn');
  if (!wrap || !btn) return;

  btn.addEventListener('click', (event) => {
    event.preventDefault();
    const isOpen = wrap.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  document.addEventListener('click', (event) => {
    if (wrap.contains(event.target)) return;
    wrap.classList.remove('open');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  });
})();

(function initNavPlayButton() {
  const navPlayBtn = document.getElementById('playNavBtn');
  const playBtn = document.getElementById('playBtn');
  if (!navPlayBtn) return;

  navPlayBtn.addEventListener('click', (event) => {
    event.preventDefault();
    if (playBtn) {
      playBtn.click();
      return;
    }
    window.location.href = '/login';
  });
})();


/* ===== Копирование Discord на странице команды ===== */
document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.getAttribute("data-copy") || "";
    const label = button.querySelector("span");
    const oldText = label ? label.innerHTML : "";

    try {
      await navigator.clipboard.writeText(value);
      button.classList.add("copied");
      if (label) label.innerHTML = "Discord скопирован";
      setTimeout(() => {
        button.classList.remove("copied");
        if (label) label.innerHTML = oldText;
      }, 1400);
    } catch {
      if (label) label.innerHTML = "Скопируй: <b>" + value + "</b>";
    }
  });
});
