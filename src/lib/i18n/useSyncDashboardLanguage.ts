import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { setDashboardLanguage } from "@/lib/i18n";

/** Called once from the authenticated layout route -- makes the
 * already-working `PUT /users/me` language save actually take visible
 * effect. Also guards against a stale `localStorage` language cache
 * (left over from a previous account in the same browser) leaking into a
 * freshly-logged-in user's session: this effect re-fires whenever
 * `user.language` changes, including the moment `/auth/me` resolves right
 * after login, so it overwrites the cache with the real signed-in user's
 * preference rather than trusting whatever the last session left behind. */
export function useSyncDashboardLanguage() {
  const { user } = useAuth();
  useEffect(() => {
    if (user?.language) setDashboardLanguage(user.language);
  }, [user?.language]);
}
