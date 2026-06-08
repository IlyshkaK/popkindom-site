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
      if (icon) icon.textContent = "👤";
    } else {
      button.href = "login.html";
      if (text) text.textContent = "Войти";
      if (icon) icon.textContent = "👥";
    }
  });

  document.querySelectorAll(".auth-action-mobile").forEach((button) => {
    if (isAuth) {
      button.href = "#";
      button.textContent = `👤 ${currentUser.username}`;
    } else {
      button.href = "login.html";
      button.textContent = "Войти";
    }
  });

  const profileUsername = document.getElementById("profileUsername");
  if (profileUsername && isAuth) profileUsername.textContent = currentUser.username;

  const securityUsername = document.getElementById("securityUsername");
  if (securityUsername && isAuth) securityUsername.textContent = currentUser.username;

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

function xpToNextLevel(level) {
  const lvl = Math.max(0, Number(level || 0));
  if (lvl >= 30) return 112 + (lvl - 30) * 9;
  if (lvl >= 15) return 37 + (lvl - 15) * 5;
  return 7 + lvl * 2;
}

function getSkinHeadUrl(username, uuid) {
  const value = (username || uuid || "Steve").toString();
  return `https://minotar.net/helm/${encodeURIComponent(value)}/120.png`;
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

function prettyMaterial(type) {
  if (!type) return "—";
  const map = {
    STONE: "Камень",
    COBBLESTONE: "Булыжник",
    DIRT: "Земля",
    GRASS_BLOCK: "Дёрн",
    OAK_LOG: "Дубовое бревно",
    SPRUCE_LOG: "Еловое бревно",
    BIRCH_LOG: "Берёзовое бревно",
    COAL_ORE: "Угольная руда",
    IRON_ORE: "Железная руда",
    COPPER_ORE: "Медная руда",
    GOLD_ORE: "Золотая руда",
    DIAMOND_ORE: "Алмазная руда",
    ANCIENT_DEBRIS: "Древние обломки",
    CRAFTING_TABLE: "Верстак",
    FURNACE: "Печь",
    TORCH: "Факел",
    BREAD: "Хлеб",
    IRON_PICKAXE: "Железная кирка",
    DIAMOND_PICKAXE: "Алмазная кирка",
    NETHERITE_SWORD: "Незеритовый меч"
  };
  return map[type] || type.toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function itemIcon(type) {
  if (!type || type === "AIR") return "";
  if (type.includes("DIAMOND")) return "💎";
  if (type.includes("EMERALD")) return "🟩";
  if (type.includes("GOLD")) return "🟨";
  if (type.includes("IRON")) return "⛓️";
  if (type.includes("NETHERITE")) return "⬛";
  if (type.includes("SWORD")) return "🗡️";
  if (type.includes("PICKAXE")) return "⛏️";
  if (type.includes("AXE")) return "🪓";
  if (type.includes("SHOVEL")) return "🥄";
  if (type.includes("BOW")) return "🏹";
  if (type.includes("SHIELD")) return "🛡️";
  if (type.includes("HELMET")) return "⛑️";
  if (type.includes("CHESTPLATE")) return "🛡️";
  if (type.includes("LEGGINGS")) return "👖";
  if (type.includes("BOOTS")) return "🥾";
  if (type.includes("LOG") || type.includes("WOOD")) return "🪵";
  if (type.includes("STONE") || type.includes("DEEPSLATE")) return "🪨";
  if (type.includes("BREAD")) return "🍞";
  if (type.includes("APPLE")) return "🍎";
  if (type.includes("POTION")) return "🧪";
  if (type.includes("TORCH")) return "🕯️";
  if (type.includes("BRICK")) return "🧱";
  if (type.includes("BUCKET")) return "🪣";
  if (type.includes("BOOK")) return "📕";
  return "▣";
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
    ["Полетено", cmToKm(stats?.fly_distance)],
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

function renderInventory(inventory) {
  const grid = document.getElementById("inventoryGrid");
  const armor = document.getElementById("armorColumn");
  if (!grid) return;

  const items = parseInventoryJson(inventory?.inventory_json);
  const armorItems = parseInventoryJson(inventory?.armor_json);

  const slots = Array.from({ length: 36 }, (_, index) => {
    const item = items.find((entry) => Number(entry.slot) === index);
    if (!item || item.type === "AIR" || Number(item.amount || 0) <= 0) return `<span title="Пусто"></span>`;
    const title = `${prettyMaterial(item.type)} x${item.amount}`;
    const amount = Number(item.amount || 0) > 1 ? `<small>${item.amount}</small>` : "";
    return `<span title="${title}">${itemIcon(item.type)}${amount}</span>`;
  });

  grid.innerHTML = slots.join("");

  if (armor) {
    armor.innerHTML = [3, 2, 1, 0].map((index) => {
      const item = armorItems[index];
      if (!item || item.type === "AIR") return `<span title="Пусто">—</span>`;
      return `<span title="${prettyMaterial(item.type)}">${itemIcon(item.type)}</span>`;
    }).join("");
  }
}

function renderOnlinePlayers(players) {
  const list = document.getElementById("onlinePlayersList");
  const count = document.getElementById("serverOnlineCount");
  if (!list) return;

  const onlineCount = (players || []).filter((player) => player.online).length;
  if (count) count.textContent = `${onlineCount} онлайн`;

  if (!players || players.length === 0) {
    list.innerHTML = `<p><span>Пока никого нет</span><b>—</b></p>`;
    return;
  }

  list.innerHTML = players.map((player) => {
    const label = player.online ? "Онлайн" : formatDate(player.updated_at);
    return `<p><span>${player.nickname}</span><b>${label}</b></p>`;
  }).join("");
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
  setText("profileUuid", `UUID: ${player.uuid || data.user?.last_uuid || "—"}`);

  const status = document.getElementById("profileOnlineStatus");
  if (status) {
    const online = player.online === true;
    status.textContent = online ? "Онлайн" : "Оффлайн";
    status.className = online ? "status online" : "status offline";
  }

  const playerHead = document.getElementById("playerHead");
  if (playerHead) {
    playerHead.src = getSkinHeadUrl(username, player.uuid);
    playerHead.onerror = () => {
      playerHead.src = getSkinHeadUrl("Steve");
    };
  }

  const xpLevel = Number(player.xp_level || 0);
  const totalXp = Number(player.total_experience || 0);
  const nextLevelXp = xpToNextLevel(xpLevel);
  const rawProgress = Math.max(0, Math.min(1, Number(player.exp_progress || 0)));
  const currentLevelXp = Math.floor(rawProgress * nextLevelXp);
  const xpProgress = Math.round(rawProgress * 100);

  setText("profileXpText", `Уровень: ${xpLevel}`);
  setText("profileXpProgress", `${formatNumber(currentLevelXp)} / ${formatNumber(nextLevelXp)} XP`);
  setText("sidebarPlayerLevel", `${xpLevel}`);
  setText("sidebarPlayerXp", `${formatNumber(currentLevelXp)} / ${formatNumber(nextLevelXp)} XP`);

  const progressLine = document.querySelector(".profile-hero .progress i");
  if (progressLine) {
    progressLine.style.width = `${xpProgress}%`;
    progressLine.title = `${formatNumber(currentLevelXp)} / ${formatNumber(nextLevelXp)} XP`;
  }

  setText("quickPlaytime", formatTicks(stats.play_time_ticks || player.play_time_ticks));
  setText("quickBlocks", formatNumber(blocksTotal));
  setText("quickDeaths", formatNumber(stats.deaths || player.deaths));
  setText("quickMobKills", formatNumber(stats.mob_kills || player.mob_kills));

  renderStatsList(stats, blocksTotal);
  renderOnlinePlayers(data.onlinePlayers || []);
  renderBarList("blocksList", blocks, "block_type", "amount");
  renderSimpleList("craftsList", crafts, "item_type", "amount");
  renderEnchantments(data.enchantments);
  renderInventory(data.inventory);
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

  if (document.querySelector(".protected-page") && !currentUser) {
    window.location.href = "login.html";
    return;
  }

  if (data) renderAccountData(data);

  if (document.querySelector(".account-page")) {
    setInterval(refreshAccountRealtime, 5000);
  }
})();
