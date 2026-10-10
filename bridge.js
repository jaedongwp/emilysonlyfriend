const bridgeScript = document.currentScript;
const packageName = "com.onepunchapp.girlpuzzle";
const page = new URLSearchParams(location.search);
const sourceOf = (tag) => tag === "ig" ? "instagram" : tag;
const source = page.get("s") || sourceOf(page.get("utm_source")) || "instagram";
const referrer = encodeURIComponent("utm_source=" + source + "&utm_campaign=prereg");
const storeAddress = "https://play.google.com/store/apps/details?id=" + packageName + "&referrer=" + referrer;
const playAppIntent = "intent://details?id=" + packageName + "&referrer=" + referrer +
  "#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url=" + encodeURIComponent(storeAddress) + ";end";
const marketAddress = "market://details?id=" + packageName + "&referrer=" + referrer;
const thisPageAddress = location.host + location.pathname + "?s=" + encodeURIComponent(source);
const chromeIntent = "intent://" + thisPageAddress + "#Intent;scheme=https;package=com.android.chrome;end";
const instagramOpenInBrowser = "instagram://extbrowser/?url=" + encodeURIComponent("https://" + thisPageAddress);

const routes = [
  { name: "Play app, intent link", address: playAppIntent },
  { name: "Play app, market link", address: marketAddress },
  { name: "Chrome, intent link", address: chromeIntent },
  { name: "Instagram's open-in-browser link", address: instagramOpenInBrowser },
  { name: "Play website", address: storeAddress },
];

const agent = navigator.userAgent;
const isAndroid = /Android/i.test(agent);
const isApple = /iPhone|iPad|iPod/i.test(agent) || (/Macintosh/i.test(agent) && navigator.maxTouchPoints > 1);
const isInAppBrowser = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|BytedanceWebview|; wv\)/i.test(agent);
const tapAddress = isAndroid && isInAppBrowser ? playAppIntent : storeAddress;

const isTesting = bridgeScript.hasAttribute("data-test-panel") || page.has("debug");
const isCounting = bridgeScript.hasAttribute("data-count") && !isTesting && !page.has("dry");
const platform = isAndroid ? "android" : isApple ? "iphone" : "other";
const logKey = "bridge-log";
const autoTriedKey = "bridge-auto-tried";

function readStored(key, fallback) {
  try {
    return JSON.parse(sessionStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function store(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function note(line) {
  if (!isTesting) return;
  const entries = readStored(logKey, []);
  entries.push(new Date().toTimeString().slice(0, 8) + "  " + line);
  store(logKey, entries);
  showLog();
}

function startCounting() {
  window.goatcounter = { path: location.pathname, referrer: source };
  const counter = document.createElement("script");
  counter.async = true;
  counter.src = "https://gc.zgo.at/count.js";
  counter.dataset.goatcounter = "https://emilysonlyfriend.goatcounter.com/count";
  document.head.appendChild(counter);
}

function count(action) {
  if (isCounting && window.goatcounter.count) window.goatcounter.count({ path: action + "-" + source + "-" + platform, event: true });
}

function whenReady(then) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", then);
  else then();
}

function whenStillHereAfter(milliseconds, then) {
  let left = false;
  const markLeft = () => {
    if (document.hidden) left = true;
  };
  document.addEventListener("visibilitychange", markLeft);
  setTimeout(() => {
    document.removeEventListener("visibilitychange", markLeft);
    if (!left) then();
  }, milliseconds);
}

function go(route, label) {
  note(label + ": " + route.name);
  if (!page.has("dry")) location.href = route.address;
  whenStillHereAfter(1500, () => note(label + ": nothing happened"));
}

function showEscapeLoudly() {
  whenReady(() => {
    const leaving = document.getElementById("leaving");
    const escape = document.getElementById("escape");
    if (leaving) leaving.style.display = "none";
    escape.style.display = "block";
    escape.classList.add("loud");
  });
}

function leaveForPlayOnLoad() {
  if (page.has("stay") || isApple) return;
  if (!isAndroid) {
    location.replace(storeAddress);
    return;
  }
  if (readStored(autoTriedKey, false)) {
    note("auto: already tried in this visit, waiting for a tap");
    showEscapeLoudly();
    return;
  }
  store(autoTriedKey, true);
  whenReady(() => {
    const leaving = document.getElementById("leaving");
    if (leaving) leaving.style.display = "block";
    go(routes[0], "auto 1");
    if (!isInAppBrowser) return;
    whenStillHereAfter(1500, () => {
      go(routes[2], "auto 2");
      whenStillHereAfter(1500, showEscapeLoudly);
    });
  });
}

function openPlayOnAnyTap() {
  document.addEventListener("click", (event) => {
    if (event.target.closest("a, button, #test-panel")) return;
    note("tap on the page: " + (isAndroid && isInAppBrowser ? routes[0].name : routes[4].name));
    count("tap");
    if (!page.has("dry")) location.href = tapAddress;
    whenStillHereAfter(1500, () => note("tap on the page: nothing happened"));
  });
  document.body.style.cursor = "pointer";
}

function wireStoreLinks() {
  document.querySelectorAll("[data-play]").forEach((link) => {
    link.href = tapAddress;
    link.addEventListener("click", () => {
      note("tap on " + (link.id || "a store link"));
      count("tap");
      whenStillHereAfter(1800, () => {
        note("tap on " + (link.id || "a store link") + ": nothing happened");
        if (isAndroid) showEscapeLoudly();
      });
    });
  });
  const chrome = document.getElementById("chrome");
  chrome.href = chromeIntent;
  chrome.addEventListener("click", () => {
    note("tap on Open in Chrome");
    count("chrome");
  });
}

function showPlatformLines() {
  if (!isAndroid) document.getElementById("android-only").style.display = "block";
  if (isAndroid && isInAppBrowser && !bridgeScript.hasAttribute("data-leave-for-play-on-load")) {
    document.getElementById("escape").style.display = "block";
  }
}

function showLog() {
  const log = document.getElementById("test-log");
  if (!log) return;
  log.textContent = readStored(logKey, []).slice(-14).join("\n");
  log.scrollTop = log.scrollHeight;
}

function buildTestPanel() {
  const panel = document.createElement("section");
  panel.id = "test-panel";
  const heading = document.createElement("p");
  const instagramVersion = (agent.match(/Instagram ([\d.]+)/) || [])[1];
  heading.textContent = "TEST · " + (isAndroid ? "Android" : isApple ? "iPhone" : "computer") +
    (isInAppBrowser ? " · in-app browser" : " · a browser") + (instagramVersion ? " · Instagram " + instagramVersion : "") +
    " · source " + source;
  const buttons = document.createElement("div");
  routes.forEach((route, index) => {
    const button = document.createElement("button");
    button.textContent = index + 1 + " " + route.name;
    button.addEventListener("click", () => go(route, "button " + (index + 1)));
    buttons.appendChild(button);
  });
  const clear = document.createElement("button");
  clear.textContent = "clear log";
  clear.addEventListener("click", () => {
    store(logKey, []);
    store(autoTriedKey, false);
    showLog();
  });
  buttons.appendChild(clear);
  const log = document.createElement("pre");
  log.id = "test-log";
  panel.append(heading, buttons, log);
  document.body.appendChild(panel);
  showLog();
}

if (isTesting) {
  note("page opened · " + location.pathname + location.search);
  document.addEventListener("visibilitychange", () => note(document.hidden ? "page hidden (an app opened?)" : "page visible again"));
  addEventListener("pagehide", () => note("page left (another page loaded)"));
  addEventListener("pageshow", (event) => {
    if (event.persisted) note("back on the page");
  });
}

whenReady(() => {
  wireStoreLinks();
  showPlatformLines();
  if (bridgeScript.hasAttribute("data-tap-anywhere")) openPlayOnAnyTap();
  if (isTesting) buildTestPanel();
});

if (isCounting) startCounting();
if (bridgeScript.hasAttribute("data-leave-for-play-on-load")) leaveForPlayOnLoad();
