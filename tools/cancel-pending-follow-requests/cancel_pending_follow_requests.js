(() => {
  document.getElementById('ig-request-canceller')?.remove();
  const docId = '27789106940691111';
  const friendlyName = 'usePolarisUnfollowMutation';
  const appId = '936619743392459';
  const asbdId = '129477';
  const usernames = new Set();
  const resolved = new Map();
  let matches = [];
  let stopped = false;
  let scanIndex = 0;

  const panel = document.createElement('section');
  panel.id = 'ig-request-canceller';
  panel.innerHTML = '<strong>Instagram sended following request cleaner</strong> <button data-close>Close</button>'
    + '<p>Select pending_follow_requests.html. ID lookup is read-only and only checks usernames in that export.</p>'
    + '<input data-file type="file" accept=".html,text/html">'
    + '<p>Usernames per scan run (1-200): <input data-scan-limit type="number" min="1" max="200" value="200"></p>'
    + '<p>Pause between ID lookups (3-60): <input data-scan-delay type="number" min="3" max="60" value="3"></p>'
    + '<button data-scan disabled>Resolve IDs (read-only)</button> <button data-reset disabled>Reset lookup progress</button>'
    + '<p>Requests per cancel run (1-2000): <input data-limit type="number" min="1" max="2000" value="2000"></p>'
    + '<p>Delay in seconds (3-60): <input data-delay type="number" min="3" max="60" value="4"></p>'
    + '<button data-run disabled>Cancel selected requests</button> <button data-stop disabled>Stop</button>'
    + '<pre data-status>Choose the export file. Nothing has been changed.</pre>';
  const style = document.createElement('style');
  style.textContent = '#ig-request-canceller{position:fixed;z-index:2147483647;right:20px;bottom:20px;width:min(440px,calc(100vw - 40px));box-sizing:border-box;padding:16px;background:white;color:#202124;border:1px solid #999;border-radius:6px;box-shadow:0 8px 32px #0003;font:14px/1.45 -apple-system,BlinkMacSystemFont,sans-serif}#ig-request-canceller p{margin:10px 0}#ig-request-canceller input[type=number]{width:64px}#ig-request-canceller button{padding:6px 9px;margin:3px;cursor:pointer}#ig-request-canceller pre{max-height:160px;overflow:auto;white-space:pre-wrap}';
  document.head.append(style);
  document.body.append(panel);
  const el = (selector) => panel.querySelector(selector);
  const say = (text) => { el('[data-status]').textContent = text; };
  const getCookie = (name) => document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1] ?? '';
  const csrf = decodeURIComponent(getCookie('csrftoken'));
  const viewerId = getCookie('ds_user_id');

  function getTokens() {
    try {
      const req = window.require;
      const fbDtsg = typeof req === 'function' ? req('DTSGInitialData')?.token : null;
      const lsd = typeof req === 'function' ? req('LSD')?.token : null;
      if (fbDtsg && lsd) return { fbDtsg, lsd };
    } catch {}
    const html = document.documentElement.innerHTML;
    const fbDtsg = /"DTSGInitialData",\[\],\{"token":"([^"]+)"/.exec(html)?.[1] ?? /"dtsg":\{"token":"([^"]+)"/.exec(html)?.[1];
    const lsd = /"LSD",\[\],\{"token":"([^"]+)"/.exec(html)?.[1];
    return fbDtsg && lsd ? { fbDtsg, lsd } : null;
  }

  function parseExport(text) {
    const parsed = new DOMParser().parseFromString(text, 'text/html');
    for (const row of parsed.querySelectorAll('tr')) {
      const cells = [...row.querySelectorAll('td')];
      const index = cells.findIndex((cell) => cell.textContent.trim() === 'Benutzername');
      if (index < 0) continue;
      const username = cells[index + 1]?.textContent.trim();
      if (username) usernames.add(username.toLowerCase());
    }
  }

  async function getProfileUser(username) {
    const headers = { Accept: '*/*', 'X-IG-App-ID': appId, 'X-ASBD-ID': asbdId, 'X-Requested-With': 'XMLHttpRequest' };
    if (csrf) headers['X-CSRFToken'] = csrf;
    const delay = Math.max(3, Math.min(60, Number(el('[data-scan-delay]').value) || 5)) * 1000;
    const profileResponse = await fetch(`/${encodeURIComponent(username)}/`, {
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
    });
    if (profileResponse.status === 429) throw new Error('Instagram rate-limited the profile page. Stopped; no cancellation was sent. Wait before resuming.');
    if (profileResponse.status === 404 || profileResponse.status === 410) return null;
    if (!profileResponse.ok) throw new Error(`Profile page lookup failed for @${username}: HTTP ${profileResponse.status}`);
    const responsePath = new URL(profileResponse.url || `/${encodeURIComponent(username)}/`, location.origin).pathname;
    if (/\/(accounts\/login|challenge|checkpoint)(\/|$)/i.test(responsePath)) {
      throw new Error('Instagram requires login or verification. Stopped.');
    }
    const profileHtml = await profileResponse.text();
    const parsedProfile = new DOMParser().parseFromString(profileHtml, 'text/html');
    const expectedPath = `/${username.toLowerCase()}/`;
    const profilePaths = [...parsedProfile.querySelectorAll('link[rel="alternate"]')].map((link) => {
      try { return new URL(link.href).pathname.toLowerCase(); } catch { return ''; }
    });
    const profileId = /"profile_id":"?(\d+)"?/.exec(profileHtml)?.[1];
    if (!profilePaths.includes(expectedPath) || !profileId) {
      console.info(`Skipped @${username}: profile unavailable or profile ID could not be safely read.`);
      return null;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
    const statusResponse = await fetch(`/api/v1/friendships/show/${profileId}/`, { credentials: 'same-origin', headers });
    if (statusResponse.status === 429) throw new Error('Instagram rate-limited the friendship-status lookup. Stopped; no cancellation was sent. Wait before resuming.');
    if (statusResponse.status === 404 || statusResponse.status === 410) return null;
    if (!statusResponse.ok) throw new Error(`Friendship status lookup failed for @${username}: HTTP ${statusResponse.status}`);
    const statusData = await statusResponse.json();
    const friendship = statusData.friendship_status ?? statusData;
    const outgoingRequest = friendship.outgoing_request;
    if (statusData.status === 'fail' || typeof outgoingRequest !== 'boolean') {
      throw new Error(`Instagram did not return outgoing_request status for @${username}; no cancellation will be attempted.`);
    }
    return { username: username.toLowerCase(), id: profileId, outgoingRequest };
  }

  async function cancel(user, tokens) {
    const scanDelay = Math.max(3, Math.min(60, Number(el('[data-scan-delay]').value) || 5)) * 1000;
    const current = await getProfileUser(user.username);
    if (!current || !current.outgoingRequest) return false;
    await new Promise((resolve) => setTimeout(resolve, scanDelay));
    if (stopped) throw new Error('Stopped before sending the cancellation.');
    let sum = 0;
    for (const char of tokens.fbDtsg) sum += char.charCodeAt(0);
    const params = new URLSearchParams({
      av: viewerId, __d: 'www', __user: '0', __a: '1', __comet_req: '7',
      fb_dtsg: tokens.fbDtsg, jazoest: `2${sum}`, lsd: tokens.lsd,
      fb_api_caller_class: 'RelayModern', fb_api_req_friendly_name: friendlyName,
      variables: JSON.stringify({ target_user_id: current.id, container_module: 'profile', nav_chain: 'PolarisProfilePostsTabRoot:profilePage:1:via_cold_start' }),
      server_timestamps: 'true', doc_id: docId,
    });
    const response = await fetch('https://www.instagram.com/api/graphql', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrftoken': csrf, 'x-fb-friendly-name': friendlyName, 'x-fb-lsd': tokens.lsd, 'x-ig-app-id': appId, 'x-asbd-id': asbdId },
      body: params.toString(),
    });
    const text = (await response.text()).replace(/^for\s*\(;;\);/, '');
    let data;
    try { data = JSON.parse(text); } catch { throw new Error(`Unexpected response for @${user.username}: HTTP ${response.status}`); }
    const error = JSON.stringify(data.errors ?? data.error ?? data.message ?? '');
    if (response.status === 429 || /feedback_required|checkpoint|action_blocked|rate.?limit/i.test(error)) throw new Error(`Instagram blocked or rate-limited the action: ${error}`);
    const result = data.data?.xdt_destroy_friendship;
    if (!response.ok || result?.friendship_status?.outgoing_request !== false) throw new Error(`Instagram did not confirm withdrawal for @${user.username}.`);
    return true;
  }

  el('[data-file]').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    usernames.clear();
    resolved.clear();
    matches = [];
    scanIndex = 0;
    parseExport(await file.text());
    el('[data-limit]').max = String(Math.min(2000, usernames.size));
    el('[data-limit]').value = String(Math.min(2000, usernames.size || 1));
    el('[data-scan]').disabled = usernames.size === 0;
    el('[data-reset]').disabled = usernames.size === 0;
    say(usernames.size ? `Loaded ${usernames.size} usernames. No requests changed.` : 'No usernames found. Choose pending_follow_requests.html.');
  });

  el('[data-reset]').addEventListener('click', () => {
    resolved.clear();
    matches = [];
    scanIndex = 0;
    el('[data-run]').disabled = true;
    say('Lookup progress reset. No requests changed.');
  });

  el('[data-scan]').addEventListener('click', async () => {
    if (!getCookie('ds_user_id') || !getCookie('csrftoken')) {
      say('Instagram session not detected. Reload Instagram and try again.');
      return;
    }
    stopped = false;
    el('[data-scan]').disabled = true;
    el('[data-stop]').disabled = false;
    const names = [...usernames];
    const scanLimit = Math.max(1, Math.min(200, Number(el('[data-scan-limit]').value) || 25));
    const scanEnd = Math.min(names.length, scanIndex + scanLimit);
    const delay = Math.max(3, Math.min(60, Number(el('[data-scan-delay]').value) || 5)) * 1000;
    el('[data-file]').disabled = true;
    el('[data-reset]').disabled = true;
    el('[data-run]').disabled = true;
    try {
      for (let index = scanIndex; index < scanEnd; index++) {
        if (stopped) break;
        const username = names[index];
        say(`Read-only ID lookup ${index + 1}/${names.length}: @${username}`);
        const profile = await getProfileUser(username);
        resolved.set(username, profile ?? { username, outgoingRequest: false, unavailable: true });
        scanIndex = index + 1;
        matches = [...resolved.values()].filter((user) => user.outgoingRequest);
        say(`${profile ? 'Looked up' : 'Skipped unavailable profile'} @${username}. Processed ${scanIndex}/${names.length}. ${matches.length} requests still show as outgoing. No requests changed.`);
        if (index + 1 < names.length && !stopped) await new Promise((resolve) => setTimeout(resolve, delay));
      }
      const skipped = [...resolved.values()].filter((user) => user.unavailable).length;
      if (scanIndex === names.length) say(`Lookup complete: ${matches.length} exported accounts still show an outgoing request. Skipped ${skipped} unavailable profiles. No requests changed.`);
      else if (scanIndex === scanEnd) say(`Scan batch complete: ${scanIndex}/${names.length}. Skipped ${skipped} unavailable profiles. Click Resolve IDs to continue. No requests changed.`);
      else say(`Lookup paused at ${scanIndex}/${names.length}. Click Resolve IDs to continue. No requests changed.`);
    } catch (error) {
      say(`${error.message}\nLookup paused at ${scanIndex}/${names.length}. No cancellation was sent.`);
    } finally {
      el('[data-scan]').disabled = scanIndex === names.length;
      el('[data-stop]').disabled = true;
      el('[data-file]').disabled = false;
      el('[data-reset]').disabled = false;
      el('[data-run]').disabled = matches.length === 0;
    }
  });

  el('[data-stop]').addEventListener('click', () => { stopped = true; });
  el('[data-run]').addEventListener('click', async () => {
    const limit = Math.max(1, Math.min(2000, matches.length, Number(el('[data-limit]').value) || matches.length));
    const delay = Math.max(3, Math.min(60, Number(el('[data-delay]').value) || 10)) * 1000;
    const batch = matches.slice(0, limit);
    if (!batch.length || !confirm(`Withdraw ${batch.length} matched request(s), starting with @${batch[0].username}? Requests will be processed one at a time; the run stops if Instagram rate-limits it.`)) return;
    const tokens = getTokens();
    if (!tokens || !csrf || !viewerId) { say('Session tokens unavailable. Reload Instagram and try again.'); return; }
    stopped = false;
    el('[data-run]').disabled = true;
    el('[data-stop]').disabled = false;
    el('[data-scan]').disabled = true;
    el('[data-file]').disabled = true;
    el('[data-reset]').disabled = true;
    let done = 0;
    let skipped = 0;
    try {
      for (const user of batch) {
        if (stopped) break;
        say(`Withdrawing ${done + skipped + 1}/${batch.length}: @${user.username}`);
        const withdrawn = await cancel(user, tokens);
        if (withdrawn) done++;
        else skipped++;
        resolved.set(user.username, { ...user, outgoingRequest: false });
        matches = matches.filter((item) => String(item.username).toLowerCase() !== String(user.username).toLowerCase());
        say(`Confirmed ${done}; skipped ${skipped} unavailable or no longer pending; ${matches.length} outgoing requests remain.`);
        if (done + skipped < batch.length && !stopped) await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) { say(`${error.message}\nStopped after ${done} confirmed cancellation(s).`); }
    finally {
      el('[data-run]').disabled = matches.length === 0;
      el('[data-scan]').disabled = scanIndex === usernames.size;
      el('[data-stop]').disabled = true;
      el('[data-file]').disabled = false;
      el('[data-reset]').disabled = false;
    }
  });
  el('[data-close]').addEventListener('click', () => { style.remove(); panel.remove(); });
})();
