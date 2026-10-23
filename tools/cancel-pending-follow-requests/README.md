# Instagram Pending Follow Request Canceller

This browser-console script helps you find and withdraw outgoing Instagram follow requests that are still pending. It uses the Instagram account that is currently signed in in your browser.

The script is an unofficial tool and uses Instagram endpoints that are not documented as a public API. Instagram may change them, restrict requests, or temporarily block actions. Use it only with your own account and proceed in small batches.

## 1. Export your Instagram information

1. In Instagram, open **Accounts Center** and choose **Your information and permissions** > **Download your information** (the wording may vary slightly).
2. Choose the Instagram account you want to check, then choose to export information to your device.
3. Set the date range to **All time**.
4. Select **Followers and following** under **Connections** (in German: **Kontakte: Follower und Gefolgt**). No other information is needed.
5. Choose **HTML** as the export format and request the export.
6. Download and extract the archive. Find `pending_follow_requests.html`, usually in the followers-and-following folder. Keep this file on your device; the script reads it locally in the browser.

The current script expects the export's table header to be `Benutzername` (German for "Username"). If it reports that no usernames were found, check that you selected the HTML export and that the downloaded file uses the expected German header.

## 2. Run the script in your browser

1. Open `https://www.instagram.com/` in a desktop browser and sign in to the account whose export you downloaded.
2. Open the browser's Developer Tools Console. In Chrome or Edge on macOS, use **Option+Command+J**.
3. Open `cancel_pending_follow_requests.js` in a text editor, review the code, copy its contents, and paste them into the console. Run the code. If the browser displays a paste warning, follow its instructions only after reviewing the code.
4. The script adds a control panel to the Instagram page. Choose `pending_follow_requests.html` with its file picker.
5. Click **Resolve IDs (read-only)**. This checks the exported usernames against profile and friendship status pages. This stage does not withdraw any requests. Lookups run in batches of up to 200 accounts, with a configurable pause between requests. Click the button again to continue another batch.
6. When the lookup is complete, review the number of accounts still showing an outgoing request. Set the cancellation batch size and delay, then click **Cancel selected requests** only if you want to proceed.
7. Confirm the prompt. Requests are processed one at a time. Use **Stop** to stop before the next cancellation. The script stops if Instagram reports rate limiting or an action block.
8. Close the panel when finished.

## Why limits and pauses matter

| Setting | Purpose |
| --- | --- |
| **Usernames per scan run** | Bounds the number of exported profiles checked per click. Smaller lookup batches keep read-only network activity manageable and give you a chance to review progress before continuing. |
| **Pause between ID lookups** | Spaces profile and friendship-status requests instead of sending them in a rapid burst. Read-only lookups still make requests to Instagram and can be rate-limited. |
| **Requests per cancel run** | Caps the number of pending follow requests considered for withdrawal in one confirmed run. Small batches limit the scope of account changes and let you review results before authorizing more. The maximum is not a recommended batch size. |
| **Delay in seconds** | Adds spacing between cancellation attempts. Each attempt also rechecks the current relationship, so the total time between withdrawals can be longer than this setting. |

Batch sizes count profiles or cancellation attempts, not individual HTTP requests: one profile can require multiple requests. Pauses control pacing; batch limits control the amount of work per run. Increasing a batch size does not make Instagram permit more requests.

These ranges are internal script limits, not Instagram-published allowances or guaranteed safe settings. Small batches and longer pauses may reduce request bursts, but cannot prevent rate limits, verification prompts, action blocks, or other account restrictions. Start small, review each batch, and stop if Instagram reports a restriction rather than repeatedly retrying or lowering the delays.

## Important notes

- The export file is read locally by the script; it is not uploaded to another service. The script does make requests to Instagram using your signed-in browser session to look up account status and, if you confirm, withdraw requests.
- The ID lookup is read-only. The withdrawal step changes your Instagram account and cannot be undone by this script.
- Start with a small cancellation batch. Do not reduce the delays to try to bypass Instagram's limits. If Instagram rate-limits or blocks an action, stop and wait before trying again.
- Keep the browser tab open and signed in while the script runs. If Instagram requests verification or the session expires, stop and reload Instagram after resolving it.
- Instagram's page structure and internal endpoints can change without notice. The script may stop working; do not assume a request was withdrawn unless the script confirms it.
- The script processes usernames from the selected export, not every account on Instagram.

## License

This tool is covered by the repository's MIT License. See the [repository license](../../LICENSE) for the full terms.