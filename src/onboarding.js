import { API_URL } from "./config.js";

const ONBOARDING_SEEN_KEY = "camino-onboarding-seen";
const ONBOARDING_LEGACY_KEY = "camino-onboarded";
const ONBOARDING_COOKIE_MAX_AGE_SECONDS = 31536000;
const VISITOR_ID_STORAGE_KEY = "camino_visitor_id";

function readPersistentFlag(flagKey) {
  try {
    if (localStorage.getItem(flagKey) === "1") {
      return true;
    }
  } catch (error) {}

  try {
    return document.cookie
      .split(";")
      .map((cookiePart) => cookiePart.trim())
      .some((cookiePart) => cookiePart === `${flagKey}=1`);
  } catch (error) {
    return false;
  }
}

function writePersistentFlag(flagKey) {
  try {
    localStorage.setItem(flagKey, "1");
  } catch (error) {}

  try {
    document.cookie = `${flagKey}=1; path=/; max-age=${ONBOARDING_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  } catch (error) {}
}

function hasSeenOnboarding() {
  return (
    readPersistentFlag(ONBOARDING_SEEN_KEY) ||
    readPersistentFlag(ONBOARDING_LEGACY_KEY)
  );
}

function markOnboardingSeen() {
  writePersistentFlag(ONBOARDING_SEEN_KEY);
  writePersistentFlag(ONBOARDING_LEGACY_KEY);
}

function isValidVisitorId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{16,128}$/.test(value);
}

function generateVisitorId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID().replace(/-/g, "");
  }

  const fallback = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2)}${Math.random().toString(36).slice(2)}`;
  return fallback.slice(0, 64);
}

function getOrCreateVisitorId() {
  try {
    const existingId = localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (isValidVisitorId(existingId)) {
      return existingId;
    }
  } catch (error) {}

  const newVisitorId = generateVisitorId();
  if (!isValidVisitorId(newVisitorId)) {
    return "";
  }

  try {
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, newVisitorId);
  } catch (error) {}

  return newVisitorId;
}

function updateVisitorCounterLabel(uniqueVisitors) {
  const counter = document.getElementById("visitor-counter");
  if (!counter || !Number.isFinite(uniqueVisitors) || uniqueVisitors < 0) {
    return;
  }

  counter.textContent = `Visiteurs uniques : ${new Intl.NumberFormat("fr-FR").format(Math.trunc(uniqueVisitors))}`;
}

export async function loadUniqueVisitorCounter() {
  const counter = document.getElementById("visitor-counter");
  if (!counter) {
    return;
  }

  const visitorId = getOrCreateVisitorId();
  if (!visitorId) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/visitors/hit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId }),
    });

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const uniqueVisitors = Number(payload.uniqueVisitors);
    if (Number.isFinite(uniqueVisitors)) {
      updateVisitorCounterLabel(uniqueVisitors);
    }
  } catch (error) {}
}

function setOnboardingVisibility(showBanner) {
  const banner = document.getElementById("onboarding-banner");
  if (!banner) {
    return;
  }

  if (showBanner) {
    banner.classList.remove("hidden");
    banner.style.display = "flex";
    return;
  }

  banner.classList.add("hidden");
  banner.style.display = "none";
}

export function initOnboardingBanner() {
  const closeButton = document.getElementById("onboarding-close");
  if (closeButton && !closeButton.__onboardingBound) {
    closeButton.__onboardingBound = true;
    closeButton.addEventListener("click", () => {
      markOnboardingSeen();
      setOnboardingVisibility(false);
    });
  }

  if (hasSeenOnboarding()) {
    setOnboardingVisibility(false);
    return;
  }

  markOnboardingSeen();
  setOnboardingVisibility(true);
}
