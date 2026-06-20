# Driver App — Improvement Tracker

> Codebase review findings. Organized by severity.

---

## 🔴 Critical Bugs

### 1. `handleLogout` closure is stale inside `useEffect`

- **File:** `app/(tabs)/index.tsx` — Lines 61–79
- `handleLogout` is defined outside the effect but captured inside it via `setOptions`. The deps array only lists `[navigation]` — not `handleLogout`. If `logout` ever becomes non-stable, the header button calls the stale version.
- **Fix:** Wrap `handleLogout` in `useCallback` and add it to the deps array, or inline the function inside the effect.

---

### 2. `SymbolView` `name` prop won't work on Android / Web

- **Files:** `app/login.tsx` L91, `components/CategoryPicker.tsx` L42, `components/EmptyState.tsx` L16, and many more
- We're passing `name` as `{ ios, android, web }` objects, but `expo-symbols` `SymbolView` expects a single SF Symbol name string. The multi-platform object syntax is **not a real API** — the `as any` casts silence TypeScript, but on Android/Web this will silently render nothing or crash.
- **Fix:** Create a cross-platform `Icon` component that switches between `SymbolView` (iOS) and `MaterialIcons` from `@expo/vector-icons` (Android/Web).

---

### 3. `authenticate` response not checked for HTTP errors

- **File:** `lib/api.ts` — Lines 23–29
- If the server returns a 500 or other HTTP error with a non-JSON body, `res.json()` will throw an unhandled parsing exception. All other API methods correctly check `res.ok`, but `authenticate` does not.
- **Fix:** Add `if (!res.ok) throw new Error(...)` before `res.json()`, or wrap in try/catch specifically for parse failures.

---

### 4. Stock deduction fires even when server returns `{ ok: false }` with HTTP 200

- **File:** `app/(tabs)/index.tsx` — Lines 123–130
- `deductStock` is called in `onSuccess`, which fires on any resolved promise. The worker can return `{ ok: false }` with a 200 status (e.g. for missing fields), so `onSuccess` still fires and stock is deducted incorrectly.
- **Fix:** Check the response body's `ok` field inside `mutationFn`:
  ```ts
  const result = await api.updateDeliveryItemStatus(itemId, status);
  if (!result.ok) throw new Error('Server rejected the update');
  return result;
  ```

---

## 🟠 Security Issues

### 5. Firebase config has placeholder values — app will crash at runtime

- **File:** `lib/firebase.ts` — Lines 9–16
- `initializeApp` with invalid config will silently initialize, then fail on the first Storage operation with a cryptic error.
- **Fix:** Add a runtime check: `if (firebaseConfig.apiKey.startsWith('YOUR_')) throw new Error('Firebase not configured')` — or use environment variables via `expo-constants`.

---

### 6. No authentication on driver API endpoints (Worker)

- **File:** `cloudflare/worker.js` — Lines 215–490
- All driver routes (deliveries, status updates, expenses, location) are completely unauthenticated. Anyone who knows a `driver_id` UUID can read all deliveries, mark orders as done/rejected, submit fake expenses, and report fake locations. The auth route verifies OTP, but the returned `driver_id` is used as a "token" with no actual session validation.
- **Fix:** Implement a JWT or bearer token that the worker validates on each request. Store it in SecureStore after login.

---

### 7. Edit delivery-item endpoint accepts any values without validation

- **File:** `cloudflare/worker.js` — Lines 437–460
- No check that `qty > 0`.
- No check that the item exists before updating.
- No check that the requesting `driver_id` owns this delivery item.
- A driver could edit items from other drivers' deliveries.
- **Fix:** Validate input, verify item existence, and confirm ownership before updating.

---

## 🟡 Architecture & Code Quality

### 8. Expense history is session-only (in-memory `useState`)

- **File:** `app/(tabs)/expenses.tsx` — Line 50
- The `history` state resets on every tab switch or app reload. Users will think their expenses disappeared.
- **Fix:** Either fetch expense history from the worker (needs a new `GET /driver/expenses` endpoint) or persist locally with AsyncStorage/SecureStore.

---

### 9. `setStock` and `deductStock` fire-and-forget SecureStore writes

- **File:** `store/app.ts` — Lines 97–112
- `SecureStore.setItemAsync(...)` is called without `await` — its promise is ignored. If the write fails, in-memory state diverges from persisted state. On next app launch, old stock values load.
- **Fix:** Make these `async`, `await` the write, or add `.catch(console.error)`.

---

### 10. "Today's Delivery Progress" label is misleading

- **File:** `app/(tabs)/index.tsx` — Line 307
- The query fetches **all** deliveries (`ORDER BY created_at DESC`), not just today's. The label is inaccurate.
- **Fix:** Either filter by today's date or change the label to "All Delivery Progress".

---

### 11. Polling interval fixed at 15s — no backoff, no pause when backgrounded

- **File:** `app/(tabs)/index.tsx` — Line 90
- `refetchInterval: 15000` polls every 15 seconds even when the app is backgrounded. This wastes battery and network.
- **Fix:** Add `refetchIntervalInBackground: false` explicitly and consider using `AppState` to pause polling when backgrounded.

---

### 12. QueryClient `retry: 2` is aggressive for mobile

- **File:** `app/_layout.tsx` — Lines 17–21
- On spotty mobile networks, 3 total attempts (1 + 2 retries) at 15-second intervals means up to 9 requests/minute when the server is down.
- **Fix:** Add `retryDelay` with exponential backoff.

---

## ⚪ Dead Code / Scaffold Remnants

### 13. Unused scaffold files to delete

The following files are leftover from the Expo template scaffold. They are not used by any active screen and should be deleted:

| File | Reason |
|------|--------|
| `app/modal.tsx` | Scaffold screen, uses `EditScreenInfo` — never navigated to |
| `components/EditScreenInfo.tsx` | Only used by `modal.tsx` |
| `components/StyledText.tsx` | Only used by `EditScreenInfo.tsx` |
| `components/Themed.tsx` | Only used by `modal.tsx`, `+not-found.tsx`, `EditScreenInfo.tsx` |
| `components/ExternalLink.tsx` | Only used by `EditScreenInfo.tsx` |
| `components/useClientOnlyValue.ts` | Not imported anywhere |
| `components/useClientOnlyValue.web.ts` | Not imported anywhere |
| `components/useColorScheme.ts` | Only used by `Themed.tsx` (dead chain) |
| `components/useColorScheme.web.ts` | Only used by `Themed.tsx` (dead chain) |

> Note: `app/+not-found.tsx` imports `Themed`, so update it to use plain RN components before deleting `Themed.tsx`.

---

## 🟢 UX / Edge Cases

### 14. Weight shows raw floating point — no rounding

- **File:** `app/(tabs)/stock.tsx` — Line 81
- If a driver enters `10.5` kg and deducts `3.2`, the displayed weight could be `7.300000000000001` due to IEEE 754 floating point.
- **Fix:** Display with `stock.weight.toFixed(2)` or use integer-based weights (grams).

---

### 15. No loading/disabled state for "Done ✓" / "Reject ✗" buttons during mutation

- **File:** `components/OrderCard.tsx` — Lines 165–188
- If the driver taps "Done ✓" and the mutation is slow, they can tap it multiple times triggering duplicate requests. The optimistic update hides the buttons after the first tap (status changes from 'pending'), but there's a brief window for double-taps.
- **Fix:** Pass `statusMutation.isPending` to `OrderCard` and disable the buttons during mutation.

---

### 16. Camera permission: no fallback for "Don't Allow"

- **File:** `components/CameraCapture.tsx` — Lines 67–93
- If the user taps "Don't Allow" on the system dialog, `permission.granted` remains `false` and the UI shows "Grant Permission" again. But on iOS, tapping again won't re-show the system prompt — it silently does nothing. The user is stuck.
- **Fix:** After a denied permission, show instructions to open Settings instead, using `Linking.openSettings()`.

---

### 17. No error state for delivery fetch failure

- **File:** `app/(tabs)/index.tsx` — Lines 82–91
- The `error` from `useQuery` is destructured but never used in the UI. If the initial fetch fails, the user sees a perpetual loading spinner.
- **Fix:** Add an error state UI block before the main return.

---

## 🔵 Backend Gaps (Worker)

### 18. No `GET /driver/expenses` endpoint

- The expense form submits successfully, but there's no way to fetch past expenses. The app uses session-local state, which resets.
- **Fix:** Add a `GET /driver/expenses?driver_id=...` endpoint to the worker.

---

### 19. N+1 query in `/driver/deliveries`

- **File:** `cloudflare/worker.js` — Lines 399–424
- One SQL query is executed per delivery. For a driver with 20 deliveries, that's 21 queries per poll (every 15s). D1 has per-request limits.
- **Fix:** Fetch all items in one query with `WHERE delivery_id IN (...)` and group in JS.

---

## Summary

| Category | Count | Priority |
|----------|-------|----------|
| 🔴 Critical Bugs | 4 | Fix before device testing |
| 🟠 Security | 3 | Fix before release |
| 🟡 Architecture | 5 | Fix for production readiness |
| ⚪ Dead Code | 9 files | Cleanup |
| 🟢 UX Edge Cases | 4 | Fix for polish |
| 🔵 Backend Gaps | 2 | Add for completeness |
