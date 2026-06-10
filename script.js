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

let currentUser = null;
let currentAccountData = null;

function refreshLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons({ attrs: { "stroke-width": 2.4 } });
  }
}

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

async function loadMe() {
  try {
    const data = await apiRequest("/api/me");
    currentUser = data.user;
    currentAccountData = data;
    return data;
  } catch {
    currentUser = null;
    currentAccountData = null;
    return null;
  }
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

  const isAdmin = isAuth && ["ADMIN", "OWNER"].includes(String(currentUser.role || "").toUpperCase());
  document.body.classList.toggle("is-admin", isAdmin);

  refreshLucideIcons();

  const autoLoginStatus = document.getElementById("autoLoginStatus");
  if (autoLoginStatus && isAuth) {
    const enabled = currentUser.autoLoginEnabled !== false;
    autoLoginStatus.textContent = enabled ? "Включён" : "Отключён";
    autoLoginStatus.className = enabled ? "green-text" : "red-text";
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
      setAuthMessage(message, "Ник должен быть 3–16 символов: буквы, цифры и _", "error");
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
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatServerSince(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatLastLogin(value) {
  if (!value) return "—";
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
  if (!type) return "—";

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

function materialName(type) {
  return String(type || "AIR").toUpperCase().replace(/^MINECRAFT:/, "");
}

function materialIconBase(item) {
  const fromIcon = String(item?.icon || "").trim().replace(/^\/+/, "");
  if (fromIcon && fromIcon.endsWith(".png")) return fromIcon.replace(/\.png$/i, "");
  return materialName(item?.type).toLowerCase();
}

function localMaterialIconUrl(item) {
  const base = materialIconBase(item);
  if (!base || base === "air") return "";
  return `/minecraft/items/${encodeURIComponent(base)}.png`;
}

function remoteMaterialIconUrl(item) {
  const base = materialIconBase(item);
  if (!base || base === "air") return "";
  return `https://mc.nerothe.com/img/1.21.4/minecraft_${encodeURIComponent(base)}.png`;
}

function itemFallbackKind(type) {
  const normalized = materialName(type);

  if (!normalized || normalized === "AIR") return "book";

  if (
    normalized.includes("HELMET") ||
    normalized.includes("CHESTPLATE") ||
    normalized.includes("LEGGINGS") ||
    normalized.includes("BOOTS") ||
    normalized.includes("ELYTRA") ||
    normalized.includes("SHIELD")
  ) {
    return "shield";
  }

  if (
    normalized.includes("SWORD") ||
    normalized.includes("BOW") ||
    normalized.includes("CROSSBOW") ||
    normalized.includes("TRIDENT") ||
    normalized.includes("MACE")
  ) {
    return "sword";
  }

  if (
    normalized.includes("PICKAXE") ||
    normalized.includes("AXE") ||
    normalized.includes("SHOVEL") ||
    normalized.includes("HOE") ||
    normalized.includes("SHEARS") ||
    normalized.includes("FISHING_ROD") ||
    normalized.includes("FLINT_AND_STEEL") ||
    normalized.includes("BRUSH")
  ) {
    return "pickaxe";
  }

  return "book";
}

function fallbackIconSvg(kind) {
  const icons = {
    shield: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="M12 4.2v15.4"/></svg>`,
    sword: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 13 2-2"/></svg>`,
    pickaxe: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4.5 19 9"/><path d="M12 7 4 15l-1 5 5-1 8-8"/><path d="m8 16 3 3"/><path d="M11 5c3-2 7-2 10 1-3 0-5 1-7 3"/></svg>`,
    book: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/><path d="M8 6h8"/><path d="M8 10h6"/></svg>`
  };

  return icons[kind] || icons.book;
}

function fallbackItemIconHtml(type) {
  const kind = itemFallbackKind(type);
  return `<span class="mc-item-lucide mc-item-lucide-${kind}" title="Иконка-заглушка">${fallbackIconSvg(kind)}</span>`;
}

function shouldUseFallbackIcon(item) {
  const normalized = materialName(item?.type);

  if (!normalized || normalized === "AIR") return true;

  // Новые предметы могут отсутствовать в удалённом наборе minecraft-иконок.
  // В таком случае вообще не создаём <img>, чтобы не было пустых/битых слотов.
  if (normalized.startsWith("COPPER_") && itemFallbackKind(normalized) === "shield") return true;

  return false;
}

function renderItemIcon(item) {
  const kind = itemFallbackKind(item?.type);
  const remoteUrl = remoteMaterialIconUrl(item);

  if (shouldUseFallbackIcon(item) || !remoteUrl) {
    return fallbackItemIconHtml(item?.type);
  }

  return `<img class="mc-item-icon" src="${remoteUrl}" alt="${escapeHtml(prettyMaterial(item.type))}" loading="eager" decoding="async" data-fallback-kind="${kind}" onerror="handleItemIconError(this)">`;
}

function handleItemIconError(img) {
  const kind = img.getAttribute("data-fallback-kind") || "book";
  const wrap = document.createElement("span");
  wrap.className = `mc-item-lucide mc-item-lucide-${kind}`;
  wrap.title = "Иконка-заглушка";
  wrap.innerHTML = fallbackIconSvg(kind);
  img.replaceWith(wrap);
}
function parseInventoryJson(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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

function renderBarList(id, rows, typeKey, amountKey) {
  const list = document.getElementById(id);
  if (!list) return;

  if (!rows || rows.length === 0) {
    list.innerHTML = `<p><span>Пока нет данных</span><i><em style="width:0%"></em></i><b>—</b></p>`;
    return;
  }

  const max = Math.max(...rows.map((row) => Number(row[amountKey] || 0)), 1);
  list.innerHTML = rows.map((row) => {
    const amount = Number(row[amountKey] || 0);
    const width = Math.max(8, Math.round((amount / max) * 100));
    return `<p><span>${prettyMaterial(row[typeKey])}</span><i><em style="width:${width}%"></em></i><b>${formatNumber(amount)}</b></p>`;
  }).join("");
}

function renderSimpleList(id, rows, typeKey, amountKey) {
  const list = document.getElementById(id);
  if (!list) return;

  if (!rows || rows.length === 0) {
    list.innerHTML = `<p><span>Пока нет данных</span><b>—</b></p>`;
    return;
  }

  list.innerHTML = rows.map((row) => {
    return `<p><span>${prettyMaterial(row[typeKey])}</span><b>${formatNumber(row[amountKey])}</b></p>`;
  }).join("");
}

function renderEnchantments(enchantments) {
  const list = document.getElementById("enchantsList");
  if (!list) return;

  if (!enchantments) {
    list.innerHTML = `<p><span>Пока нет данных</span><b>—</b></p>`;
    return;
  }

  list.innerHTML = `
    <p><span>Потрачено уровней</span><b>${formatNumber(enchantments.levels_spent)}</b></p>
    <p><span>Всего зачарований</span><b>${formatNumber(enchantments.enchant_count)}</b></p>
    <p><span>Последнее обновление</span><b>${formatDate(enchantments.updated_at)}</b></p>
  `;
}

function getItemBySlot(items, slot) {
  return (items || []).find((entry) => Number(entry.slot) === Number(slot));
}

function itemTooltip(item) {
  if (!item || item.type === "AIR" || item.empty) return "";

  const displayName = item.name || prettyMaterial(item.type);
  const lines = [`<b>${escapeHtml(displayName)}</b>`, `<span>${escapeHtml(materialName(item.type))}</span>`];

  if (Number(item.amount || 0) > 1) lines.push(`<span>Количество: ${escapeHtml(item.amount)}</span>`);

  if (Array.isArray(item.enchantments) && item.enchantments.length) {
    lines.push(`<em>Зачарования</em>`);
    item.enchantments.slice(0, 6).forEach((enchant) => {
      lines.push(`<span>${escapeHtml(prettyMaterial(enchant.name || enchant.key))} ${escapeHtml(enchant.level || "")}</span>`);
    });
  }

  if (Number(item.max_durability || 0) > 0) {
    lines.push(`<span>Прочность: ${escapeHtml(item.durability_left ?? 0)} / ${escapeHtml(item.max_durability)}</span>`);
  }

  if (Array.isArray(item.lore) && item.lore.length) {
    item.lore.slice(0, 4).forEach((line) => lines.push(`<small>${escapeHtml(line)}</small>`));
  }

  return `<div class="mc-tooltip">${lines.join("")}</div>`;
}

function renderInventoryDetails(item) {
  const details = document.getElementById("inventoryDetails");
  if (!details) return;

  if (!item || item.type === "AIR" || item.empty || Number(item.amount || 0) <= 0) {
    details.innerHTML = `<div class="inventory-details-empty">Наведи на предмет, чтобы увидеть описание</div>`;
    return;
  }

  const displayName = item.name || prettyMaterial(item.type);
  const lines = [];

  if (Number(item.amount || 0) > 1) lines.push(`<p><span>Количество:</span><b>${escapeHtml(item.amount)}</b></p>`);
  if (Number(item.max_durability || 0) > 0) {
    lines.push(`<p><span>Прочность:</span><b>${escapeHtml(item.durability_left ?? 0)} / ${escapeHtml(item.max_durability)}</b></p>`);
  }

  if (Array.isArray(item.enchantments) && item.enchantments.length) {
    lines.push(`<h4>Зачарования</h4>`);
    item.enchantments.slice(0, 6).forEach((enchant) => {
      lines.push(`<p><span>${escapeHtml(prettyMaterial(enchant.name || enchant.key))}</span><b>${escapeHtml(enchant.level || "")}</b></p>`);
    });
  }

  if (Array.isArray(item.lore) && item.lore.length) {
    lines.push(`<h4>Описание</h4>`);
    item.lore.slice(0, 5).forEach((line) => lines.push(`<p class="lore">${escapeHtml(line)}</p>`));
  }

  details.innerHTML = `
    <div class="inventory-details-icon">${renderItemIcon(item)}</div>
    <h3>${escapeHtml(displayName)}</h3>
    <div class="inventory-details-material">minecraft:${escapeHtml(materialName(item.type).toLowerCase())}</div>
    <div class="inventory-details-list">${lines.join("") || `<p><span>Обычный предмет</span><b>—</b></p>`}</div>
  `;
}

function bindInventoryDetails() {
  const slots = document.querySelectorAll("#inventory .mc-slot[data-detail-id]");
  slots.forEach((slot) => {
    const id = slot.getAttribute("data-detail-id");
    const item = window.__inventoryDetailItems?.[id];
    slot.addEventListener("mouseenter", () => renderInventoryDetails(item));
    slot.addEventListener("focus", () => renderInventoryDetails(item));
    slot.addEventListener("click", () => renderInventoryDetails(item));
  });
}

function registerInventoryDetailItem(item) {
  if (!window.__inventoryDetailItems) window.__inventoryDetailItems = [];
  const id = window.__inventoryDetailItems.length;
  window.__inventoryDetailItems.push(item);
  return id;
}

function renderInventorySlot(item, options = {}) {
  const empty = !item || item.type === "AIR" || item.empty || Number(item.amount || 0) <= 0;
  const slotClass = ["mc-slot", options.className || "", options.active ? "active" : "", empty ? "empty" : ""].filter(Boolean).join(" ");
  const label = options.label ? `<span class="mc-slot-label">${escapeHtml(options.label)}</span>` : "";

  if (empty) {
    return `<span class="${slotClass}" title="Пусто">${label}</span>`;
  }

  const amount = Number(item.amount || 0) > 1 ? `<small>${escapeHtml(item.amount)}</small>` : "";
  const title = `${prettyMaterial(item.type)} x${item.amount}`;
  const detailId = registerInventoryDetailItem(item);
  return `<span class="${slotClass}" tabindex="0" data-detail-id="${detailId}" title="${escapeHtml(title)}">${label}${renderItemIcon(item)}${amount}</span>`;
}

function renderInventory(inventory) {
  const grid = document.getElementById("inventoryGrid");
  const armor = document.getElementById("armorColumn");
  if (!grid) return;

  window.__inventoryDetailItems = [];
  renderInventoryDetails(null);

  const items = parseInventoryJson(inventory?.inventory_json);
  const armorItems = parseInventoryJson(inventory?.armor_json);
  const offhandItems = parseInventoryJson(inventory?.offhand_json);
  const selectedHotbarSlot = Number(inventory?.selected_hotbar_slot ?? -1);

  const orderedSlots = [
    ...Array.from({ length: 27 }, (_, index) => index + 9),
    ...Array.from({ length: 9 }, (_, index) => index)
  ];

  grid.innerHTML = orderedSlots.map((slot) => {
    const item = getItemBySlot(items, slot);
    return renderInventorySlot(item, { active: slot === selectedHotbarSlot, className: slot <= 8 ? "hotbar" : "" });
  }).join("");

  if (armor) {
    const offhand = offhandItems[0] || getItemBySlot(offhandItems, 0);
    const armorSlots = [
      { item: armorItems[3], label: "Ш" },
      { item: armorItems[2], label: "Н" },
      { item: armorItems[1], label: "П" },
      { item: armorItems[0], label: "Б" },
      { item: offhand, label: "Л" }
    ];

    armor.innerHTML = armorSlots.map(({ item, label }) => renderInventorySlot(item, { label })).join("");
  }

  bindInventoryDetails();
}
function renderOnlinePlayers(players) {
  const list = document.getElementById("onlinePlayersList");
  const count = document.getElementById("serverOnlineCount");
  if (!list) return;

  const onlineCount = (players || []).filter((player) => player.online).length;
  if (count) count.textContent = `${onlineCount} / 20 игроков`;

  if (!players || players.length === 0) {
    list.innerHTML = `<p><span>Пока никого нет</span><b>—</b></p>`;
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

function renderAccountData(data) {
  if (!data) return;

  const player = data.player || {};
  const stats = data.stats || data.player || {};
  const blocks = data.blocks || [];
  const crafts = data.crafts || [];
  const blocksTotal = blocks.reduce((sum, block) => sum + Number(block.amount || 0), 0);

  const username = data.user?.username || player.nickname || "Игрок";

  setText("profileUsername", username);

  const roleRawOriginal = String(data.user?.role || player.role || "PLAYER").trim();
  const roleRaw = roleRawOriginal.toUpperCase();

  function resolveRole(raw) {
    const value = String(raw || "PLAYER").trim().toUpperCase();

    if (value.includes("OWNER") || value.includes("ВЛАДЕЛ")) {
      return { label: "Владелец", className: "owner" };
    }

    if (value.includes("ADMIN") || value.includes("АДМИН")) {
      return { label: "Администратор", className: "admin" };
    }

    if (value.includes("MODER") || value.includes("МОДЕР")) {
      return { label: "Модератор", className: "moderator" };
    }

    return { label: "Игрок", className: "player" };
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
  setText("quickAchievements", achievementsTotal > 0 ? formatNumber(achievementsTotal) : "—");
  setText("quickDeaths", formatNumber(stats.deaths || player.deaths));
  setText("quickMobKills", formatNumber(stats.mob_kills || player.mob_kills));

  renderStatsList(stats, blocksTotal);
  renderOnlinePlayers(data.onlinePlayers || []);
  renderBarList("blocksList", blocks, "block_type", "amount");
  renderSimpleList("craftsList", crafts, "item_type", "amount");
  renderEnchantments(data.enchantments);
  renderInventory(data.inventory);
  refreshLucideIcons();
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

  const data = await loadMe();
  refreshAuthUI();

  if (data) {
    renderAccountData(data);
  }
}

(async function init() {
  const data = await loadMe();
  refreshAuthUI();
  refreshLucideIcons();

  if (document.querySelector(".protected-page") && !currentUser) {
    window.location.href = "login.html";
    return;
  }

  if (data) renderAccountData(data);

  await initAdminPanel();

  if (document.querySelector(".account-page")) {
    setInterval(refreshAccountRealtime, 3000);
  }
})();


/* ===== ADMIN PANEL ===== */
let adminSelectedPlayer = null;
let adminPlayersCache = [];

function isCurrentUserAdmin() {
  return Boolean(currentUser && ["ADMIN", "OWNER"].includes(String(currentUser.role || "").toUpperCase()));
}

function resolveAdminRole(raw) {
  const value = String(raw || "PLAYER").trim().toUpperCase();

  if (value.includes("OWNER") || value.includes("ВЛАДЕЛ")) {
    return { label: "Владелец", className: "owner" };
  }

  if (value.includes("ADMIN") || value.includes("АДМИН")) {
    return { label: "Администратор", className: "admin" };
  }

  if (value.includes("MODER") || value.includes("МОДЕР")) {
    return { label: "Модератор", className: "moderator" };
  }

  return { label: "Игрок", className: "player" };
}

function adminRoleBadge(raw) {
  const role = resolveAdminRole(raw);
  return `<span class="role-badge role-${role.className} admin-role-badge">${role.label}</span>`;
}

function adminUserBadge(username, roleRaw) {
  return `<span class="admin-user-badge-name">${username || "Администратор"}</span>${adminRoleBadge(roleRaw)}`;
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
    adminPlayersCache = data.players || [];

    table.innerHTML = adminPlayersCache.length ? adminPlayersCache.map((player) => {
      const online = player.online === true;
      return `
        <tr class="${adminSelectedPlayer?.username_lower === player.username_lower ? "selected" : ""}">
          <td><span class="admin-player-cell"><img src="${minecraftHeadUrl(player.username, 28)}" alt=""> ${player.username || "—"}</span></td>
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
        if (player) renderAdminPlayerPanel(player);
      });
    });

    refreshLucideIcons();
  } catch (error) {
    table.innerHTML = `<tr><td colspan="6">${error.message || "Ошибка загрузки игроков."}</td></tr>`;
  }
}

function renderAdminPlayerPanel(player) {
  adminSelectedPlayer = player;
  const panel = document.getElementById("adminPlayerPanel");
  if (!panel) return;

  panel.innerHTML = `
    <div class="admin-player-profile">
      <img src="${minecraftHeadUrl(player.username, 64)}" alt="">
      <div>
        <h2>${player.username}</h2>
        <div class="admin-selected-role">${adminRoleBadge(player.role)}</div>
        <div class="admin-tags">
          <span class="admin-status ${(player.online||player.isOnline)? "online":"offline"}">${(player.online||player.isOnline)? "Онлайн":"Офлайн"}</span>
          ${adminWhitelistBadge(player)}
          <span class="admin-status ${(player.hasPunishment||player.hasActivePunishments)? "offline":"online"}">${(player.hasPunishment||player.hasActivePunishments)? "Наказания: Есть":"Наказания: Нет"}</span>
        </div>
      </div>
    </div>

    <div class="admin-selected-grid">
      <form class="admin-action-form" id="adminActionForm">
        <label>Действие</label>
        <input id="adminActionType" type="hidden" value="BAN" />
        <div class="admin-action-picker" role="radiogroup" aria-label="Выбор действия">
          <button type="button" class="active danger" data-admin-action="BAN"><i data-lucide="ban"></i><span>Бан</span></button>
          <button type="button" class="danger" data-admin-action="TEMP_BAN"><i data-lucide="timer-off"></i><span>Временный бан</span></button>
          <button type="button" class="warn" data-admin-action="MUTE"><i data-lucide="message-circle-off"></i><span>Мут</span></button>
          <button type="button" class="warn" data-admin-action="TEMP_MUTE"><i data-lucide="clock-3"></i><span>Временный мут</span></button>
          <button type="button" class="safe" data-admin-action="UNBAN"><i data-lucide="shield-check"></i><span>Снять бан</span></button>
          <button type="button" class="safe" data-admin-action="UNMUTE"><i data-lucide="message-circle"></i><span>Снять мут</span></button>
          <button type="button" data-admin-action="KICK"><i data-lucide="log-out"></i><span>Кикнуть</span></button>
          <button type="button" data-admin-action="WHITELIST_REMOVE"><i data-lucide="user-minus"></i><span>Удалить из WL</span></button>
        </div>

        <label id="adminDurationLabel" hidden>Срок</label>
        <input id="adminActionDuration" type="text" placeholder="Например: 10m, 2h, 7d" hidden />

        <label>Причина</label>
        <textarea id="adminActionReason" rows="3" placeholder="Например: нарушение правил сервера"></textarea>

        <button type="submit" class="primary-btn"><i data-lucide="gavel"></i> Выполнить действие</button>
        <p class="auth-message" id="adminActionMessage"></p>
      </form>

      <div class="admin-history-box">
        <div class="admin-section-head compact">
          <div>
            <p class="eyebrow"><i data-lucide="history"></i> История</p>
            <h3>Наказания игрока</h3>
          </div>
          <button type="button" class="admin-mini-btn" id="adminHistoryRefresh"><i data-lucide="refresh-cw"></i></button>
        </div>
        <div id="adminPlayerHistory" class="admin-history-list">Загрузка…</div>
      </div>
    </div>
  `;

  const actionType = document.getElementById("adminActionType");
  const duration = document.getElementById("adminActionDuration");
  const durationLabel = document.getElementById("adminDurationLabel");
  const actionButtons = panel.querySelectorAll("[data-admin-action]");

  function syncDurationVisibility() {
    const needDuration = ["TEMP_BAN", "TEMP_MUTE"].includes(actionType.value);
    duration.hidden = !needDuration;
    durationLabel.hidden = !needDuration;
    if (!needDuration) duration.value = "";
  }

  function setAdminAction(action) {
    actionType.value = action;
    actionButtons.forEach((button) => button.classList.toggle("active", button.dataset.adminAction === action));
    syncDurationVisibility();
  }

  actionButtons.forEach((button) => {
    button.addEventListener("click", () => setAdminAction(button.dataset.adminAction));
  });

  syncDurationVisibility();

  document.getElementById("adminActionForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitAdminPlayerAction(player.username);
  });

  document.getElementById("adminHistoryRefresh")?.addEventListener("click", () => loadAdminPlayerHistory(player.username));

  loadAdminPlayerHistory(player.username);
  loadAdminPlayers();
  refreshLucideIcons();
}

async function submitAdminPlayerAction(username) {
  const action = document.getElementById("adminActionType")?.value;
  const duration = document.getElementById("adminActionDuration")?.value?.trim() || "";
  const reason = document.getElementById("adminActionReason")?.value?.trim() || "Действие выполнено через админ-панель сайта";
  const message = document.getElementById("adminActionMessage");

  if (message) {
    message.className = "auth-message";
    message.textContent = "Выполняю…";
  }

  try {
    const result = await apiRequest("/api/admin?section=player-action", {
      method: "POST",
      body: JSON.stringify({ username, action, duration, reason })
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
          <small>${formatDate(row.created_at)} · ${until} · ${row.moderator_name || "—"} · ${row.source || "SERVER"}</small>
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

  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  if (!isCurrentUserAdmin()) {
    if (badge) badge.textContent = "Доступ закрыт";
    if (dashboard) dashboard.hidden = true;
    document.body.classList.add("admin-pin-locked");
    if (pinOverlay) pinOverlay.hidden = false;
    if (pinGate) {
      pinGate.innerHTML = `
        <div class="admin-pin-icon"><i data-lucide="ban"></i></div>
        <h2>Недостаточно прав</h2>
        <p>Админ-панель доступна только ролям ADMIN и OWNER.</p>
        <a class="primary-btn" href="account.html"><i data-lucide="user-round"></i> Вернуться в кабинет</a>
      `;
    }
    refreshLucideIcons();
    return;
  }

  try {
    const status = await apiRequest("/api/admin?section=status");
    if (badge) badge.innerHTML = adminUserBadge(status.user.username, status.user.role);

    if (status.verified) {
      document.body.classList.remove("admin-pin-locked");
      if (pinOverlay) pinOverlay.hidden = true;
      if (dashboard) dashboard.hidden = false;
      await loadAdminOverview();
      bindAdminControls();
      return;
    }

    document.body.classList.add("admin-pin-locked");
    if (dashboard) dashboard.hidden = false;
    if (pinOverlay) pinOverlay.hidden = false;

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
    if (pinOverlay) pinOverlay.hidden = false;
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
        if (pinOverlay) pinOverlay.hidden = true;
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
