import { useEffect, useMemo, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, makeTrpcClient } from "./lib/trpc";
import { useAuthStore, getStoredRefreshToken } from "./lib/store";
import {
  loadCachedUnlockedIdentity,
  useUnlockStore,
} from "./lib/unlockStore";
import { installSystemThemeListener } from "./lib/themeStore";
import { ensurePushSubscription } from "./lib/push";
import { readPendingInvite, clearPendingInvite } from "./lib/inviteRedirect";
import { LandingPage } from "./pages/LandingPage";
import { WelcomePage } from "./pages/WelcomePage";
import { EmailSignupPage } from "./pages/EmailSignupPage";
import { PhoneSignupPage } from "./pages/PhoneSignupPage";
import { RandomIdSignupPage } from "./pages/RandomIdSignupPage";
import { LoginPage } from "./pages/LoginPage";
import { RandomLoginPage } from "./pages/RandomLoginPage";
import { PhoneLoginPage } from "./pages/PhoneLoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ChatsPage } from "./pages/ChatsPage";
import { ChatThreadPage } from "./pages/ChatThreadPage";
import { ProfilePage } from "./pages/ProfilePage";
import { GroupsPage } from "./pages/GroupsPage";
import { GroupChatPage } from "./pages/GroupChatPage";
import { GroupSettingsPage } from "./pages/GroupSettingsPage";
import { InvitePage } from "./pages/InvitePage";
import { InviteRedeemPage } from "./pages/InviteRedeemPage";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { DiscoverProfilePage } from "./pages/DiscoverProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { VaultPage } from "./pages/VaultPage";
import { PrivacyReportPage } from "./pages/PrivacyReportPage";
import { UnderTheHoodPage } from "./pages/UnderTheHoodPage";
import { WhatWeStorePage } from "./pages/WhatWeStorePage";
import { FocusModePage } from "./pages/FocusModePage";
import { SoundPage } from "./pages/SoundPage";
import { PromisesPage } from "./pages/PromisesPage";
import { EncryptionPage } from "./pages/EncryptionPage";
import { WhatsappPrivacyPage } from "./pages/WhatsappPrivacyPage";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage";
import { TermsPage } from "./pages/TermsPage";
import { AboutPage } from "./pages/AboutPage";
import { SessionSync } from "./lib/SessionSync";
import { SessionGuard } from "./components/SessionGuard";
import { useStealthPrefs } from "./lib/stealthPrefs";
import { unlockAudioOnFirstGesture } from "./lib/sound";
import { InstallPrompt } from "./components/InstallPrompt";
import { PushPermissionPrompt } from "./components/PushPermissionPrompt";
import { DailyVerificationGate } from "./components/DailyVerificationGate";
import { AppErrorBoundary } from "./components/ErrorBoundary";
import { ToastViewport } from "./lib/toast";

export function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
        },
      }),
  );
  const [trpcClient] = useState(() => makeTrpcClient());

  // Theme system no longer follows the OS preference — VeilChat always opens
  // in the Light theme unless the user explicitly picked another from
  // Settings. The call is kept (as a no-op) to preserve the existing import
  // shape and avoid breaking anyone wiring against this hook.
  useEffect(() => installSystemThemeListener(), []);

  // Hydrate stealth/UI prefs early so sound + haptic toggles are
  // honoured the moment the user first taps anything.
  const hydratePrefs = useStealthPrefs((s) => s.hydrate);
  useEffect(() => {
    void hydratePrefs();
  }, [hydratePrefs]);

  // Browsers gate the AudioContext behind a first user gesture. Wire
  // up a one-shot unlocker so our send/receive tones can fire as soon
  // as the user actually does anything.
  useEffect(() => unlockAudioOnFirstGesture(), []);

  // Privacy: blur the entire app when the tab loses focus or is hidden,
  // making screenshots / app-switcher previews far less useful to a
  // shoulder-surfer. Honours the user's `screenshotBlurEnabled` toggle.
  usePrivacyBlur();

  return (
    <AppErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <SessionBootstrap />
          <SessionSync />
          <SessionGuard />
          <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/signup/email" element={<EmailSignupPage />} />
          <Route path="/signup/phone" element={<PhoneSignupPage />} />
          <Route path="/signup/random" element={<RandomIdSignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/phone" element={<PhoneLoginPage />} />
          <Route path="/login/random" element={<RandomLoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/chats" element={<ChatsPage />} />
          <Route path="/chats/:peerId" element={<ChatThreadPage />} />
          <Route path="/profile/:peerId" element={<ProfilePage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/:groupId" element={<GroupChatPage />} />
          <Route path="/groups/:groupId/settings" element={<GroupSettingsPage />} />
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/discover/:userId" element={<DiscoverProfilePage />} />
          <Route path="/settings/*" element={<SettingsPage />} />
          <Route path="/vault" element={<VaultPage />} />
          <Route path="/privacy-report" element={<PrivacyReportPage />} />
          <Route path="/under-the-hood" element={<UnderTheHoodPage />} />
          <Route path="/what-we-store" element={<WhatWeStorePage />} />
          <Route path="/focus-mode" element={<FocusModePage />} />
          <Route path="/sound" element={<SoundPage />} />
          <Route path="/promises" element={<PromisesPage />} />
          <Route path="/encryption" element={<EncryptionPage />} />
          <Route path="/blog/whatsapp-privacy-truth" element={<WhatsappPrivacyPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/i/:token" element={<InviteRedeemPage />} />
          <Route path="*" element={<WelcomePage />} />
        </Routes>
        <InstallPrompt />
        <PushPermissionPrompt />
        <DailyVerificationGate />
        <ToastViewport />
        </QueryClientProvider>
      </trpc.Provider>
    </AppErrorBoundary>
  );
}

/**
 * Runs once on mount:
 *  - hydrate unlocked identity from IndexedDB (PIN-once-per-browser),
 *  - refresh the auth session via the long-lived refresh cookie,
 *  - if there's a pending invite + we're now signed in, jump straight
 *    to the invite redeem page no matter what path we landed on.
 */
function SessionBootstrap() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const hydrate = useUnlockStore((s) => s.hydrate);
  const navigate = useNavigate();
  const location = useLocation();
  const refresh = trpc.auth.refresh.useMutation();
  const ran = useMemo(() => ({ done: false }), []);

  useEffect(() => {
    if (ran.done) return;
    ran.done = true;

    // Try to reload the cached, already-decrypted identity so the user
    // doesn't have to re-enter their PIN on every refresh.
    void loadCachedUnlockedIdentity().then((id) => {
      if (id) hydrate(id);
    });

    // Silently re-bind any pre-existing push subscription. We never
    // prompt for permission here — that happens on user action (a
    // dedicated toggle on the Settings screen).
    void ensurePushSubscription({ requestPermission: false });

    // Helper: route an already-authenticated user away from the
    // pre-auth landing/login pages. Pending invite (if any) wins.
    const routeAuthenticated = () => {
      const pending = readPendingInvite();
      const onAuthLandingPath =
        location.pathname === "/" ||
        location.pathname === "/welcome" ||
        location.pathname === "/login" ||
        location.pathname === "/login/phone" ||
        location.pathname === "/login/random" ||
        location.pathname === "/signup/email" ||
        location.pathname === "/signup/phone" ||
        location.pathname === "/signup/random";
      if (pending) {
        clearPendingInvite();
        navigate(`/i/${encodeURIComponent(pending)}`, { replace: true });
      } else if (onAuthLandingPath) {
        navigate("/chats", { replace: true });
      }
    };

    // FAST PATH: if the auth store already hydrated a valid session
    // from localStorage, route the user immediately so they aren't
    // stuck on the landing/login page while we wait for the network
    // round-trip. The background refresh below still runs to mint a
    // fresh access token.
    const { accessToken: existingAccess, user: existingUser } =
      useAuthStore.getState();
    if (existingAccess && existingUser) {
      routeAuthenticated();
    }

    // Skip the refresh attempt entirely when there's no persisted
    // refresh token. On the deployed Vercel ↔ Render setup the
    // `veil_refresh` cookie is third-party and is often blocked by
    // browsers, so calling refresh without a stored token would just
    // produce a noisy 401 in the console for logged-out visitors.
    if (!getStoredRefreshToken()) {
      return;
    }

    // Use the long-lived refresh cookie / x-refresh-token header to
    // mint a new access token.
    refresh
      .mutateAsync()
      .then((r) => {
        setAuth({
          accessToken: r.accessToken,
          refreshToken: r.refreshToken,
          refreshExpiresIn: r.refreshExpiresIn,
          user: r.user,
        });
        // If we hadn't already taken the fast path above, route now.
        if (!existingAccess || !existingUser) {
          routeAuthenticated();
        }
      })
      .catch(() => {
        /* No valid refresh cookie → user stays on the current page. */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export { useNavigate };

/**
 * Apply a heavy CSS blur (and optional black overlay) to the whole app
 * whenever the tab is hidden / window is blurred. Cleared the moment
 * the user comes back. Disable via Settings → Privacy.
 */
function usePrivacyBlur() {
  const enabled = useStealthPrefs(
    (s) => s.prefs?.screenshotBlurEnabled ?? true,
  );
  useEffect(() => {
    const cls = "veil-privacy-blur";
    const root = document.documentElement;

    // Hold-blur timer: when a screenshot keystroke fires, we can't
    // un-blur immediately (the OS captures a few frames after the key
    // press on some platforms), so we keep the screen blacked out for
    // a short window before falling back to passive focus-based blur.
    let holdUntil = 0;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let captureActive = false;

    function apply() {
      if (!enabled) {
        root.classList.remove(cls);
        return;
      }
      const focusBlur =
        document.visibilityState === "hidden" || !document.hasFocus();
      const holding = Date.now() < holdUntil;
      root.classList.toggle(cls, focusBlur || holding || captureActive);
    }

    function holdBlur(ms: number) {
      holdUntil = Math.max(holdUntil, Date.now() + ms);
      if (holdTimer) clearTimeout(holdTimer);
      apply();
      holdTimer = setTimeout(() => {
        holdTimer = null;
        apply();
      }, ms);
    }

    function isScreenshotKey(e: KeyboardEvent): boolean {
      const k = e.key;
      // PrintScreen / Snapshot — Windows + Linux.
      if (k === "PrintScreen" || k === "Snapshot") return true;
      // Windows: Win+Shift+S (Snipping Tool), Win+PrintScreen.
      if (e.shiftKey && (k === "S" || k === "s") && (e.metaKey || e.getModifierState("OS"))) {
        return true;
      }
      // macOS: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5, Cmd+Shift+6.
      if (e.metaKey && e.shiftKey && (k === "3" || k === "4" || k === "5" || k === "6")) {
        return true;
      }
      // ChromeOS: Ctrl+Show-Windows / Ctrl+Shift+Show-Windows.
      if (e.ctrlKey && (k === "F5" || k === "MediaPlayPause")) return true;
      return false;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!enabled) return;
      if (isScreenshotKey(e)) {
        // Prevent default where browsers allow it (PrintScreen on some
        // platforms is interceptable; OS-level shortcuts are not, but
        // the hold-blur still kicks in for the post-keystroke frames).
        e.preventDefault();
        holdBlur(2500);
        // Best-effort: stomp the clipboard so the captured image (if
        // any) doesn't survive a paste into another app.
        try {
          if (navigator.clipboard && "writeText" in navigator.clipboard) {
            void navigator.clipboard.writeText("");
          }
        } catch {
          /* clipboard write may be blocked — safe to ignore. */
        }
      }
    }

    // Detect when the tab itself is being captured/recorded (browser
    // screen-share, OBS browser source, etc). We monkey-patch
    // getDisplayMedia so any capture started from this page activates
    // the blur, and we listen for the resulting MediaStream's
    // "inactive" event to clear it.
    const md = navigator.mediaDevices as
      | (MediaDevices & {
          getDisplayMedia?: (c?: DisplayMediaStreamOptions) => Promise<MediaStream>;
        })
      | undefined;
    const originalGDM = md?.getDisplayMedia?.bind(md);
    if (md && originalGDM) {
      md.getDisplayMedia = async (constraints?: DisplayMediaStreamOptions) => {
        const stream = await originalGDM(constraints);
        captureActive = true;
        apply();
        const clear = () => {
          captureActive = false;
          apply();
        };
        stream.getTracks().forEach((t) => t.addEventListener("ended", clear));
        stream.addEventListener("inactive", clear);
        return stream;
      };
    }

    apply();
    window.addEventListener("blur", apply);
    window.addEventListener("focus", apply);
    document.addEventListener("visibilitychange", apply);
    window.addEventListener("keydown", onKeyDown, { capture: true });

    return () => {
      window.removeEventListener("blur", apply);
      window.removeEventListener("focus", apply);
      document.removeEventListener("visibilitychange", apply);
      window.removeEventListener("keydown", onKeyDown, { capture: true } as EventListenerOptions);
      if (holdTimer) clearTimeout(holdTimer);
      if (md && originalGDM) {
        md.getDisplayMedia = originalGDM;
      }
      root.classList.remove(cls);
    };
  }, [enabled]);
}
