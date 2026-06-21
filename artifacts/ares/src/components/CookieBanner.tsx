import { useState, useEffect } from "react";

const COOKIE_NAME = "jt_cookie_accepted";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function getCookieValue(name: string) {
  if (typeof document === "undefined") return null;
  return document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split("=")[1] ?? null;
}

function setConsentCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

export default function CookieBanner() {
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_NAME) === "1";
      const cookie = getCookieValue(COOKIE_NAME) === "1";
      setAccepted(stored || cookie);
    } catch {
      setAccepted(true);
    }
  }, []);

  const acceptCookies = () => {
    try {
      localStorage.setItem(COOKIE_NAME, "1");
      setConsentCookie();
    } catch {
      setAccepted(true);
      return;
    }
    setAccepted(true);
  };

  if (accepted === true) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-8 z-50">
      <div className="glass-card p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="font-semibold">We use cookies</div>
          <div className="text-sm text-muted-foreground">Accept cookies to enable site functionality and AdSense consent.</div>
        </div>
        <button className="btn" onClick={acceptCookies}>Accept</button>
      </div>
    </div>
  );
}
