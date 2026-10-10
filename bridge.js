const packageName = "com.onepunchapp.girlpuzzle";
const page = new URLSearchParams(location.search);
const sourceOf = (tag) => tag === "ig" ? "instagram" : tag;
const source = page.get("s") || sourceOf(page.get("utm_source")) || "instagram";
const referrer = encodeURIComponent("utm_source=" + source + "&utm_campaign=prereg");
const storeAddress = "https://play.google.com/store/apps/details?id=" + packageName + "&referrer=" + referrer;
const playAppIntent = "intent://details?id=" + packageName + "&referrer=" + referrer +
  "#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url=" + encodeURIComponent(storeAddress) + ";end";
const chromeIntent = "intent://" + location.host + location.pathname + "?s=" + encodeURIComponent(source) +
  "#Intent;scheme=https;package=com.android.chrome;end";

const agent = navigator.userAgent;
const isAndroid = /Android/i.test(agent);
const isInAppBrowser = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|BytedanceWebview|; wv\)/i.test(agent);

const escape = document.getElementById("escape");
const leaving = document.getElementById("leaving");
const note = page.has("debug") ? writeOnPage : () => {};

function writeOnPage(line) {
  let sheet = document.getElementById("debug");
  if (!sheet) {
    sheet = document.createElement("pre");
    sheet.id = "debug";
    document.body.appendChild(sheet);
  }
  sheet.textContent += (performance.now() / 1000).toFixed(2) + "s " + line + "\n";
}

function showEscapeLoudly() {
  if (leaving) leaving.style.display = "none";
  escape.style.display = "block";
  escape.classList.add("loud");
}

function whenStillHereAfter(milliseconds, then) {
  let left = false;
  const markLeft = () => {
    if (document.hidden) left = true;
  };
  document.addEventListener("visibilitychange", markLeft);
  setTimeout(() => {
    document.removeEventListener("visibilitychange", markLeft);
    note(left ? "the page was hidden: something opened" : "still here after " + milliseconds + " ms");
    if (!left) then();
  }, milliseconds);
}

function openWithoutLeavingThePage(address) {
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  frame.src = address;
  document.body.appendChild(frame);
}

function leaveForPlayOnLoad() {
  if (!isAndroid) return;
  if (leaving) leaving.style.display = "block";
  if (!isInAppBrowser) {
    note("Android browser: straight to the Play app");
    location.replace(playAppIntent);
    return;
  }
  note("in-app browser: trying the Play app");
  openWithoutLeavingThePage(playAppIntent);
  whenStillHereAfter(1200, () => {
    note("trying Chrome");
    openWithoutLeavingThePage(chromeIntent);
    whenStillHereAfter(1200, showEscapeLoudly);
  });
}

const storeLinks = document.querySelectorAll("[data-play]");
storeLinks.forEach((link) => {
  link.href = isAndroid && isInAppBrowser ? playAppIntent : storeAddress;
  link.addEventListener("click", () => {
    note("tapped " + (link.id || "a store link"));
    whenStillHereAfter(1800, () => {
      if (isAndroid) showEscapeLoudly();
    });
  });
});
document.getElementById("chrome").href = chromeIntent;
if (!isAndroid) document.getElementById("android-only").style.display = "block";
if (isAndroid && isInAppBrowser && !leaving) escape.style.display = "block";
note((isAndroid ? "Android" : "not Android") + (isInAppBrowser ? ", in-app browser" : ", a browser") + ", source " + source);

if (document.body.hasAttribute("data-leave-for-play-on-load")) leaveForPlayOnLoad();
