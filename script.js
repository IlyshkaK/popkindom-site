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

function itemIcon(type) {
  const normalized = materialName(type);
  if (!normalized || normalized === "AIR") return "";
  if (normalized.includes("DIAMOND")) return "💎";
  if (normalized.includes("EMERALD")) return "🟩";
  if (normalized.includes("GOLD")) return "🟨";
  if (normalized.includes("IRON")) return "⛓️";
  if (normalized.includes("NETHERITE")) return "⬛";
  if (normalized.includes("SWORD")) return "🗡️";
  if (normalized.includes("PICKAXE")) return "⛏️";
  if (normalized.includes("AXE")) return "🪓";
  if (normalized.includes("SHOVEL")) return "🥄";
  if (normalized.includes("BOW")) return "🏹";
  if (normalized.includes("SHIELD")) return "🛡️";
  if (normalized.includes("HELMET")) return "⛑️";
  if (normalized.includes("CHESTPLATE")) return "🛡️";
  if (normalized.includes("LEGGINGS")) return "👖";
  if (normalized.includes("BOOTS")) return "🥾";
  if (normalized.includes("LOG") || normalized.includes("WOOD")) return "🪵";
  if (normalized.includes("STONE") || normalized.includes("DEEPSLATE")) return "🪨";
  if (normalized.includes("BREAD")) return "🍞";
  if (normalized.includes("APPLE")) return "🍎";
  if (normalized.includes("POTION")) return "🧪";
  if (normalized.includes("TORCH")) return "🕯️";
  if (normalized.includes("BRICK")) return "🧱";
  if (normalized.includes("BUCKET")) return "🪣";
  if (normalized.includes("BOOK")) return "📕";
  return "▣";
}

function renderItemIcon(item) {
  const localUrl = localMaterialIconUrl(item);
  const remoteUrl = remoteMaterialIconUrl(item);
  const fallback = escapeHtml(itemIcon(item?.type));

  if (!localUrl) return fallback;

  return `<img class="mc-item-icon" src="${localUrl}" alt="${escapeHtml(prettyMaterial(item.type))}" loading="lazy" data-fallback-src="${remoteUrl}" data-fallback-text="${fallback}" onerror="handleItemIconError(this)">`;
}

function handleItemIconError(img) {
  const fallbackSrc = img.getAttribute("data-fallback-src");
  const fallbackText = img.getAttribute("data-fallback-text") || "▣";

  if (fallbackSrc && img.src !== fallbackSrc) {
    img.removeAttribute("data-fallback-src");
    img.src = fallbackSrc;
    return;
  }

  const span = document.createElement("span");
  span.className = "mc-item-fallback";
  span.textContent = fallbackText;
  img.replaceWith(span);
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

function renderInventorySlot(item, options = {}) {
  const empty = !item || item.type === "AIR" || item.empty || Number(item.amount || 0) <= 0;
  const slotClass = ["mc-slot", options.className || "", options.active ? "active" : "", empty ? "empty" : ""].filter(Boolean).join(" ");
  const label = options.label ? `<span class="mc-slot-label">${escapeHtml(options.label)}</span>` : "";

  if (empty) {
    return `<span class="${slotClass}" title="Пусто">${label}</span>`;
  }

  const amount = Number(item.amount || 0) > 1 ? `<small>${escapeHtml(item.amount)}</small>` : "";
  const title = `${prettyMaterial(item.type)} x${item.amount}`;
  return `<span class="${slotClass}" title="${escapeHtml(title)}">${label}${renderItemIcon(item)}${amount}${itemTooltip(item)}</span>`;
}

function renderInventory(inventory) {
  const grid = document.getElementById("inventoryGrid");
  const armor = document.getElementById("armorColumn");
  if (!grid) return;

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

  const roleMap = {
    PLAYER: "Игрок",
    MODERATOR: "Модератор",
    ADMIN: "Администратор",
    OWNER: "Владелец"
  };
  const roleRaw = String(data.user?.role || player.role || "PLAYER").toUpperCase();
  setText("profileRole", `Роль: ${roleMap[roleRaw] || roleRaw}`);

  const status = document.getElementById("profileOnlineStatus");
  if (status) {
    const online = player.online === true;
    status.textContent = online ? "Онлайн" : "Оффлайн";
    status.className = online ? "status online" : "status offline";
  }

  const playerHead = document.getElementById("playerHead");
  if (playerHead) {
    playerHead.src = `https://minotar.net/helm/${encodeURIComponent(username)}/120.png`;
    playerHead.onerror = () => {
      playerHead.src = `https://minotar.net/helm/Steve/120.png`;
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
const playBtn = document.getElementById("playBtn");
if (playBtn) {
  playBtn.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.href = currentUser ? "account.html" : "login.html";
  });
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

  if (document.querySelector(".account-page")) {
    setInterval(refreshAccountRealtime, 3000);
  }
})();
