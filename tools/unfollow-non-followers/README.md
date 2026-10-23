# Instagram Export Unfollower

This Chrome browser-console script compares your Instagram HTML follower and following exports, lists profiles that do not follow you back, and optionally unfollows profiles you explicitly select and confirm. All interface text is in English.

**Unfollowing changes your Instagram account.** Export comparison is local and read-only. The combined **Unfollow** action resolves IDs, checks live relationships, and unfollows eligible selected profiles only after you confirm the run.

This unofficial tool uses undocumented Instagram endpoints. They can change without notice. Instagram can restrict requests, require verification, or block your account's actions. Delays and small batches do not guarantee safety or compliance with Instagram's terms.

## 1. Export your Instagram information

1. In Instagram, open **Accounts Center** > **Your information and permissions** > **Download your information** (wording may vary).
2. Select your account and export **Followers and following** under **Connections** to your device.
3. Use the **All time** date range and **HTML** format.
4. Download and extract the archive. Find `following.html` and `followers_1.html` in `connections/followers_and_following`.
5. Keep every additional `followers_*.html` part from the same export. Missing parts or a limited date range can incorrectly classify profiles as not following back.

## 2. Open the console tool

1. Open `https://www.instagram.com/` in desktop Chrome and sign in to the account whose export you downloaded. Check the account yourself: exports are not automatically bound to the signed-in account.
2. Open Developer Tools Console: **Option+Command+J** on macOS or **Ctrl+Shift+J** on Windows/Linux.
3. Review [unfollow_non_followers.js](unfollow_non_followers.js), copy its contents, paste them into the console, and run them. Only follow Chrome's paste-warning instructions after reviewing the code.
4. The **Instagram export unfollower** panel appears. Its account ID identifies the session used for lookups and unfollows.
5. Under **Followers files**, select `followers_1.html` and all additional follower parts together. Under **Following file**, select `following.html` from the same export.
6. Click **Compare exports (local)**. This stage makes no network requests. Review the counts and clickable profile links. No profiles are selected automatically.

## 3. Select profiles and configure the run

1. Select profiles using their checkboxes, or click **Select all profiles** to select every eligible profile, including those hidden by the current search. **Clear selection** clears all selections. Filtering does not change the selection.
2. Set **Profiles per lookup batch (1-100)**: the maximum number of newly selected candidates to resolve in one run (default 10). Previously verified selected profiles do not consume this allowance, but are rechecked before unfollowing.
3. Set **Pause between requests, seconds (3-60)**: the request-pacing delay (default 5 seconds).
4. Set **Unfollows per batch (1-20)**: the maximum number of verified profiles to attempt to unfollow in one run (default 5). Start with one profile.
5. Set **Pause between unfollows, seconds (3-60)**: an additional minimum pause after a confirmed unfollow before processing the next profile (default 10 seconds). The tool uses at least the greater of this pause and the request pause, followed by the next profile's live checks. Actual time between unfollows can therefore be longer.

### Why limits and pauses matter

| Setting | Purpose |
| --- | --- |
| **Profiles per lookup batch** | Bounds how many new candidates are checked in one run. Smaller batches limit read-only network activity and the time spent resolving profiles before unfollowing begins. |
| **Pause between requests** | Spaces the profile and friendship-status lookups instead of sending rapid bursts. Read-only requests can also be rate-limited. |
| **Unfollows per batch** | Caps the number of account-changing attempts authorized by one confirmation. Small batches limit the scope of changes and let you review results before confirming another run. |
| **Pause between unfollows** | Adds spacing after each confirmed account change before the next profile is processed. It is separate from lookup pacing because account changes deserve their own, deliberate cadence. |

The lookup limit counts newly resolved profiles, not HTTP requests. Each profile requires multiple requests, and verified profiles are checked again before unfollowing. The unfollow limit counts attempts, so a profile skipped during the final check can result in fewer successful unfollows than the configured limit.

These are internal script limits, not Instagram-published allowances or guaranteed safe settings. Pauses control pacing, while batch limits control the scope of each run; neither bypasses Instagram's restrictions. Small batches and longer pauses may reduce request bursts, but cannot prevent rate limits, verification prompts, action blocks, or other account restrictions. The maximum values are not recommendations. Start small, inspect results, and stop when Instagram reports a restriction.

## 4. Resolve and unfollow with one button

1. Click **Unfollow**. Review the confirmation dialog's account ID, maximum unfollow count, and list of profiles eligible for this run. Cancel to perform no lookups or unfollows.
2. After confirmation, the script first resolves up to the lookup-batch limit from the selected candidates. It verifies each profile's alternate link and ID and reads its current friendship status. There is no separate Resolve button.
3. Only profiles explicitly showing `following: true` and `followed_by: false` become **verified**. Unavailable profiles, explicitly blocked relationships (`blocking: true` or `blocked_by: true`), accounts you no longer follow, and profiles that now follow you back are skipped. HTTP 404/410 on either the profile page or friendship lookup skips that profile and continues the batch. Missing or mismatched profile identity also causes a skip. Missing relationship fields instead stop the run.
4. The script then processes selected verified profiles sequentially, up to the unfollow-batch limit. Immediately before each unfollow, it resolves the username again, verifies the same ID, and checks the live relationship again. Changed relationships, identities, and unavailable or blocked profiles are skipped.
5. A result is counted as successful only if Instagram returns the expected GraphQL result with explicit `following: false` and no pending outgoing request. HTTP 200 alone is not success. Unconfirmed results are marked for manual review and are not automatically retried.
6. Unprocessed candidates and verified profiles beyond the unfollow limit remain selected. Click **Unfollow** again and confirm a new run to continue. Completed and skipped profiles are deselected. There is no automatic continuation into another batch.
7. Use **Stop** to prevent subsequent requests, or **Close** to stop and remove the panel. An already-sent request can still finish. Check Instagram manually before retrying an uncertain action.

## Important notes

- Unfollowing is not undone by this tool. Refollowing a private account may require approval.
- The script only processes usernames in the selected export difference, not your entire live following list. Old exports can omit newer non-followers. Summary counts also include followers you do not follow; only profiles in your exported following-minus-followers list are offered as unfollow candidates.
- Keep the tab open and signed in to the same account. A changed account ID or missing session cookies stops subsequent requests.
- Requests use the signed-in browser session and are sent only to Instagram. Files are read locally. No credentials are requested, logged, or sent to another service. Nothing is persisted between runs.
- Rate limits, login or verification errors, malformed responses, and uncertain results stop the current batch. There are no automatic retries, proxy workarounds, or rate-limit bypasses. Stop and wait if Instagram limits actions; do not lower delays to evade restrictions.
- Instagram does not always distinguish a deactivated, deleted, renamed, or blocked profile. The tool labels recognized unavailable or blocked profiles **skipped: unavailable or blocked** rather than claiming a specific cause. HTTP 401/403/429 and ambiguous errors still stop the batch; they are not interpreted as evidence that an individual profile is deactivated.
- A new comparison clears prior lookup results. Do not use it to blindly retry an unconfirmed action. Verify the actual relationship on Instagram first.
- Do not run another unfollow/cancellation tool concurrently. Closing this panel stops its future requests but cannot undo one already sent. Wait for in-flight requests to settle before starting another run.
- Instagram's persisted GraphQL document ID and page structure can change. Failure is not evidence of success. The script deliberately stops rather than falling back to unverified legacy endpoints.
- For a purely offline report without any account actions, use [Find non-followers](../find-non-followers/README.md).

## Verification

The workflow was checked in Chromium against simulated Instagram responses, without changing a real account. Checks cover local comparison, selection across search filters, combined resolution and unfollow, independent batch limits and pauses, explicit confirmation, confirmed and ambiguous mutation results, changed relationships/IDs, unavailable or blocked profiles, stop behavior, and rate limiting. A successful live unfollow is not guaranteed; verify one small batch manually before proceeding.

## References

- [Existing pending follow request tool](../cancel-pending-follow-requests/README.md): local session-token and profile-ID lookup approach.
- [InstagramUnfollowers](https://github.com/davidarroyo1234/InstagramUnfollowers), particularly [the GraphQL unfollow change](https://github.com/davidarroyo1234/InstagramUnfollowers/commit/29b0c071ee3865d5b409c57f50a36ada680e66e7): reference for the current mutation and the need for explicit result verification. This tool does not embed or load that project's bundle.

## License

This tool is covered by the repository's MIT License. See the [repository license](../../LICENSE) for the full terms.