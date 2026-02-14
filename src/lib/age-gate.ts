/**
 * Age verification gate: cookie (primary) + localStorage (fallback).
 * Cookie: 30 gün, Path=/, SameSite=Lax, Secure (https).
 */

const COOKIE_NAME = "ch_age_verified";
const STORAGE_KEY = "ch_age_verified";
const MAX_AGE_DAYS = 30;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[^.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAgeDays: number): void {
  if (typeof document === "undefined") return;
  const maxAge = maxAgeDays * 24 * 60 * 60;
  const secure = typeof location !== "undefined" && location.protocol === "https:";
  let cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  if (secure) cookie += "; Secure";
  document.cookie = cookie;
}

/** Öncelik cookie, yoksa localStorage. Varsayılan: doğrulanmadı. */
export function getAgeVerified(): boolean {
  if (typeof window === "undefined") return false;
  const fromCookie = getCookie(COOKIE_NAME);
  if (fromCookie === "1" || fromCookie === "true") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** 18+ onayını kaydet; cookie + localStorage fallback. */
export function setAgeVerified(): void {
  if (typeof window === "undefined") return;
  setCookie(COOKIE_NAME, "1", MAX_AGE_DAYS);
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore
  }
}
