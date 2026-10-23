(() => {
  const panelId = 'ig-export-unfollower';
  if (location.origin !== 'https://www.instagram.com') {
    alert('Open https://www.instagram.com/ and sign in before running this script.');
    return;
  }
  if (document.getElementById(panelId)) {
    alert('The unfollower is already open. Stop and close it before running another copy.');
    return;
  }
  const cookie = (name) => {
    const value = document.cookie.split('; ').find(part => part.startsWith(name + '='));
    return value ? decodeURIComponent(value.slice(name.length + 1)) : '';
  };
  const viewerId = cookie('ds_user_id');
  if (!viewerId || !cookie('csrftoken')) {
    alert('No signed-in Instagram session detected. Sign in and reload the page.');
    return;
  }
  const appId = '936619743392459';
  const asbdId = '129477';
  const friendlyName = 'usePolarisUnfollowMutation';
  const docId = '27789106940691111';
  let candidates = [];
  let busy = false;
  let stopped = false;
  let pauseTimer;
  let resumePause;
  const panel = document.createElement('section');
  panel.id = panelId;
  panel.setAttribute('aria-label', 'Instagram export unfollower');
  panel.innerHTML = `
    <header><strong>Instagram export unfollower</strong><button data-close type="button">Close</button></header>
    <p>Signed-in account ID: <span data-viewer></span></p>
    <label>Followers files<input data-followers type="file" accept=".html,text/html" multiple></label>
    <label>Following file<input data-following type="file" accept=".html,text/html"></label>
    <button data-compare type="button">Compare exports (local)</button>
    <p data-summary>No exports compared.</p>
    <label>Search profiles<input data-search type="search" autocomplete="off" spellcheck="false"></label>
    <div class="ig-eu-selection"><button data-select type="button" disabled>Select all profiles</button>
    <button data-clear type="button" disabled>Clear selection</button></div>
    <div data-list></div>
    <p data-count>0 selected; 0 verified.</p>
    <label>Profiles per lookup batch (1-100)<input data-scan-limit type="number" min="1" max="100" value="10"></label>
    <label>Pause between requests, seconds (3-60)<input data-delay type="number" min="3" max="60" value="5"></label>
    <label>Unfollows per batch (1-20)<input data-limit type="number" min="1" max="20" value="5"></label>
    <label>Pause between unfollows, seconds (3-60)<input data-unfollow-delay type="number" min="3" max="60" value="10"></label>
    <button data-run type="button" disabled>Unfollow</button>
    <button data-stop type="button" disabled>Stop</button>
    <pre data-status role="status" aria-live="polite">Nothing has been changed.</pre>`;
  const style = document.createElement('style');
  style.textContent = `#${panelId}{position:fixed;z-index:2147483647;right:16px;bottom:16px;width:min(480px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;box-sizing:border-box;padding:18px;background:#fff;color:#202624;border:1px solid #86998c;border-radius:6px;box-shadow:0 8px 32px #0003;font:14px/1.5 "Avenir Next","Segoe UI",sans-serif;letter-spacing:0}
    #${panelId} *{box-sizing:border-box}#${panelId} header{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:4px solid #146547;padding-top:10px}
    #${panelId} p{margin:10px 0}#${panelId} label{display:block;margin:10px 0}#${panelId} input{font:inherit;color:#202624;background:#fff;max-width:100%}
    #${panelId} input[type=file],#${panelId} input[type=search]{display:block;width:100%;margin-top:5px}#${panelId} input[type=number]{width:70px;margin-left:8px}
    #${panelId} button{font:inherit;background:#fff;color:#146547;border:1px solid #86998c;border-radius:4px;padding:6px 9px;margin:3px 3px 3px 0;cursor:pointer;white-space:normal}
    #${panelId} button:disabled{opacity:.5;cursor:default}#${panelId} [data-run]{background:#146547;color:#fff}#${panelId} [data-list]{max-height:240px;overflow:auto;border-block:1px solid #d6dfd9}
    #${panelId} .ig-eu-row{display:grid;grid-template-columns:20px minmax(0,1fr);gap:8px;padding:8px 0;border-bottom:1px solid #d6dfd9;margin:0}
    #${panelId} a{color:#146547;overflow-wrap:anywhere}#${panelId} small{display:block;color:#56615b}#${panelId} pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;max-height:140px;overflow:auto}
    #${panelId} :focus-visible{outline:3px solid #bb5b21;outline-offset:2px}#${panelId} [hidden]{display:none!important}`;
  document.head.append(style);
  document.body.append(panel);
  const el = selector => panel.querySelector(selector);
  el('[data-viewer]').textContent = viewerId;
  const say = text => { el('[data-status]').textContent = text; };
  const bounded = (selector, fallback, maximum) => Math.max(1, Math.min(maximum, Math.floor(Number(el(selector).value) || fallback)));
  const delay = () => Math.max(3, bounded('[data-delay]', 5, 60)) * 1000;
  const unfollowDelay = () => Math.max(3, bounded('[data-unfollow-delay]', 10, 60)) * 1000;
  const selectable = user => ['candidate', 'verified'].includes(user.state);
  const selected = () => candidates.filter(user => user.checkbox.checked && selectable(user));

  function refresh() {
    for (const input of panel.querySelectorAll('input, button')) input.disabled = busy;
    el('[data-close]').disabled = false;
    el('[data-stop]').disabled = !busy;
    for (const user of candidates) {
      user.checkbox.disabled = busy || !selectable(user);
      user.detail.textContent = user.state;
    }
    const selection = selected();
    el('[data-count]').textContent = `${selection.length} selected; ${selection.filter(user => user.state === 'verified').length} verified.`;
    el('[data-run]').disabled = busy || selection.length === 0;
    el('[data-select]').disabled = busy || !candidates.some(selectable);
    el('[data-clear]').disabled = busy || !selection.length;
  }

  function ensureSession() {
    if (stopped || !panel.isConnected) throw new Error('Stopped. No further unfollow will be sent.');
    if (cookie('ds_user_id') !== viewerId || !cookie('csrftoken')) {
      throw new Error('The signed-in session changed. Close the tool and reload Instagram.');
    }
  }

  function pause(milliseconds = delay()) {
    ensureSession();
    return new Promise(resolve => {
      resumePause = resolve;
      pauseTimer = setTimeout(() => { resumePause = null; resolve(); }, milliseconds);
    }).then(ensureSession);
  }

  function stop() {
    stopped = true;
    clearTimeout(pauseTimer);
    resumePause?.();
    resumePause = null;
  }

  function parseExport(text) {
    const template = document.createElement('template');
    template.innerHTML = text;
    const usernames = new Set();
    for (const anchor of template.content.querySelectorAll('a[href]')) {
      try {
        const url = new URL(anchor.getAttribute('href'));
        if (!['https:', 'http:'].includes(url.protocol) || !['www.instagram.com', 'instagram.com'].includes(url.hostname)) continue;
        let parts = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, '').split('/');
        if (parts.length === 2 && parts[0] === '_u') parts = parts.slice(1);
        if (parts.length === 1 && /^[a-zA-Z0-9_.]{1,30}$/.test(parts[0])) usernames.add(parts[0].toLowerCase());
      } catch {}
    }
    return usernames;
  }

  async function request(path, options = {}) {
    ensureSession();
    const response = await fetch(path, { ...options, credentials: 'same-origin', redirect: 'error' });
    if (response.status === 429 || response.status === 401 || response.status === 403) {
      throw new Error(`Instagram requires a pause, login or verification (HTTP ${response.status}). Stop and check Instagram manually.`);
    }
    return response;
  }

  function validateData(data) {
    if (!data || data.errors || data.error || data.status === 'fail' || data.spam === true ||
        /feedback_required|checkpoint|challenge_required|action_blocked|rate.?limit|try again later/i.test(JSON.stringify(data))) {
      throw new Error('Instagram rejected or blocked the request. Stopped; check Instagram manually before retrying.');
    }
  }

  async function friendship(id) {
    const response = await request(`/api/v1/friendships/show/${id}/`, {
      headers: { Accept: 'application/json', 'X-IG-App-ID': appId, 'X-ASBD-ID': asbdId,
        'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': cookie('csrftoken') },
    });
      if ([404, 410].includes(response.status)) return null;
    if (!response.ok) throw new Error(`Friendship lookup failed: HTTP ${response.status}.`);
    const data = await response.json();
    validateData(data);
    const status = data.friendship_status ?? data;
      if (status.blocking === true || status.blocked_by === true) return null;
    if (typeof status.following !== 'boolean' || typeof status.followed_by !== 'boolean') {
      throw new Error('Instagram did not return explicit following and followed_by values. Stopped.');
    }
    return status;
  }

  async function profile(username) {
    const response = await request(`/${encodeURIComponent(username)}/`, { headers: { Accept: 'text/html' } });
    if ([404, 410].includes(response.status)) return null;
    if (!response.ok) throw new Error(`Profile lookup failed for @${username}: HTTP ${response.status}.`);
    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const paths = Array.from(parsed.querySelectorAll('link[rel="alternate"]')).map(link => {
      try { return new URL(link.getAttribute('href'), location.origin).pathname.toLowerCase(); } catch { return ''; }
    });
    const id = /"profile_id":"?(\d+)"?/.exec(html)?.[1];
    if (!paths.includes(`/${username}/`) || !id || id === viewerId) return null;
    await pause();
    const status = await friendship(id);
    return status ? { id, status } : null;
  }

  function tokens() {
    try {
      const fbDtsg = window.require?.('DTSGInitialData')?.token;
      const lsd = window.require?.('LSD')?.token;
      if (fbDtsg && lsd) return { fbDtsg, lsd };
    } catch {}
    const html = document.documentElement.innerHTML;
    const fbDtsg = /"DTSGInitialData",\[\],\{"token":"([^"]+)"/.exec(html)?.[1] ?? /"dtsg":\{"token":"([^"]+)"/.exec(html)?.[1];
    const lsd = /"LSD",\[\],\{"token":"([^"]+)"/.exec(html)?.[1];
    if (!fbDtsg || !lsd) throw new Error('Session tokens unavailable. Reload Instagram and run the tool again.');
    return { fbDtsg, lsd };
  }

  async function unfollow(user) {
    const current = await profile(user.username);
    if (!current || current.id !== user.id || !current.status.following || current.status.followed_by) return false;
    await pause();
    const session = tokens();
    let sum = 0;
    for (const character of session.fbDtsg) sum += character.charCodeAt(0);
    const body = new URLSearchParams({
      av: viewerId, __d: 'www', __user: '0', __a: '1', __comet_req: '7',
      fb_dtsg: session.fbDtsg, jazoest: `2${sum}`, lsd: session.lsd,
      fb_api_caller_class: 'RelayModern', fb_api_req_friendly_name: friendlyName,
      variables: JSON.stringify({ target_user_id: current.id, container_module: 'profile',
        nav_chain: 'PolarisProfilePostsTabRoot:profilePage:1:via_cold_start' }),
      server_timestamps: 'true', doc_id: docId,
    });
    user.writeAttempted = true;
    const response = await request('/api/graphql', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded',
        'x-csrftoken': cookie('csrftoken'), 'x-fb-friendly-name': friendlyName,
        'x-fb-lsd': session.lsd, 'x-ig-app-id': appId, 'x-asbd-id': asbdId }, body: body.toString(),
    });
    const text = (await response.text()).replace(/^for\s*\(;;\);/, '');
    let data;
    try { data = JSON.parse(text); } catch { throw new Error(`Unfollow not confirmed for @${user.username}: response was not JSON. Do not retry without checking Instagram.`); }
    validateData(data);
    const result = data.data?.xdt_destroy_friendship?.friendship_status;
    if (!response.ok || result?.following !== false || result.outgoing_request === true) {
      throw new Error(`Unfollow not explicitly confirmed for @${user.username}. Check Instagram before retrying.`);
    }
    return true;
  }

  function draw() {
    const fragment = document.createDocumentFragment();
    for (const user of candidates) {
      const row = document.createElement('label');
      row.className = 'ig-eu-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.setAttribute('aria-label', `Select @${user.username}`);
      checkbox.addEventListener('change', refresh);
      const content = document.createElement('span');
      const link = document.createElement('a');
      link.href = `https://www.instagram.com/${user.username}/`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = '@' + user.username;
      const detail = document.createElement('small');
      user.checkbox = checkbox;
      user.detail = detail;
      user.row = row;
      content.append(link, detail);
      row.append(checkbox, content);
      fragment.append(row);
    }
    el('[data-list]').replaceChildren(fragment);
    refresh();
  }

  for (const input of [el('[data-followers]'), el('[data-following]')]) {
    input.addEventListener('change', () => { candidates = []; draw(); el('[data-summary]').textContent = 'Files changed. Compare exports again.'; });
  }
  el('[data-search]').addEventListener('input', () => {
    const query = el('[data-search]').value.trim().toLowerCase().replace(/^@/, '');
    for (const user of candidates) user.row.hidden = !user.username.includes(query);
  });
  el('[data-select]').addEventListener('click', () => {
    for (const user of candidates) if (selectable(user)) user.checkbox.checked = true;
    refresh();
  });
  el('[data-clear]').addEventListener('click', () => { for (const user of candidates) user.checkbox.checked = false; refresh(); });
  el('[data-compare]').addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    refresh();
    candidates = [];
    try {
      const files = Array.from(el('[data-followers]').files);
      const followingFile = el('[data-following]').files[0];
      if (!files.length || !followingFile) throw new Error('Select both exports first.');
      if (files.some(file => !/^followers_\d+\.html$/i.test(file.name)) || followingFile.name.toLowerCase() !== 'following.html') {
        throw new Error('Select followers_*.html and following.html from the same export.');
      }
      const followers = new Set();
      for (const file of files) for (const username of parseExport(await file.text())) followers.add(username);
      const following = parseExport(await followingFile.text());
      candidates = Array.from(following).filter(username => !followers.has(username)).sort().map(username => ({ username, state: 'candidate' }));
      el('[data-search]').value = '';
      el('[data-summary]').textContent = `${followers.size} followers; ${following.size} following; ${candidates.length} not following back; ${Array.from(followers).filter(username => !following.has(username)).length} followers you do not follow.`;
      say(!followers.size || !following.size ? 'Warning: an export contains no recognized profiles. Verify your files and counts. Nothing changed.' : 'Comparison complete. Select profiles, then click Unfollow to resolve IDs and unfollow after confirmation. Nothing changed.');
    } catch (error) { say(error.message); }
    finally { busy = false; draw(); }
  });

  async function run() {
    if (busy) return;
    const selection = selected();
    const lookupBatch = selection.filter(user => user.state === 'candidate').slice(0, bounded('[data-scan-limit]', 10, 100));
    const scope = selection.filter(user => user.state === 'verified' || lookupBatch.includes(user));
    const limit = bounded('[data-limit]', 5, 20);
    if (!scope.length) return;
    if (!confirm(`Resolve ${lookupBatch.length} new profile(s), then unfollow up to ${Math.min(limit, scope.length)} eligible profile(s) using account ID ${viewerId}?\n\nOnly these selected profiles are eligible in this run:\n${scope.map(user => '@' + user.username).join('\n')}\n\nUnavailable or blocked profiles will be skipped. This changes your account. Refollowing a private profile may require approval.`)) return;
    stopped = false;
    busy = true;
    refresh();
    let confirmed = 0;
    let checked = 0;
    let skipped = 0;
    let currentUser;
    try {
      ensureSession();
      for (const user of lookupBatch) {
        ensureSession();
        say(`Resolving selected IDs ${checked + 1}/${lookupBatch.length}: @${user.username}. ${confirmed} confirmed unfollows.`);
        const current = await profile(user.username);
        ensureSession();
        user.id = current?.id;
        user.state = !current ? 'skipped: unavailable or blocked' : !current.status.following ? 'no longer following' : current.status.followed_by ? 'follows you back now' : 'verified';
        if (user.state !== 'verified') {
          user.checkbox.checked = false;
          skipped += 1;
        }
        checked += 1;
        refresh();
        if (checked < lookupBatch.length) await pause();
      }
      const unfollowBatch = scope.filter(user => user.state === 'verified').slice(0, limit);
      if (lookupBatch.length && unfollowBatch.length) await pause();
      for (const user of unfollowBatch) {
        ensureSession();
        currentUser = user;
        say(`Rechecking before unfollow: @${user.username}. ${confirmed} confirmed unfollows.`);
        const changed = await unfollow(user);
        user.state = changed ? 'unfollowed (confirmed)' : 'skipped: unavailable, blocked, or relationship/identity changed';
        user.checkbox.checked = false;
        if (changed) confirmed += 1;
        else skipped += 1;
        currentUser = null;
        refresh();
        if (user !== unfollowBatch[unfollowBatch.length - 1]) {
          await pause(changed ? Math.max(delay(), unfollowDelay()) : delay());
        }
      }
      say(`Batch complete: ${checked} IDs checked; ${confirmed} confirmed unfollows; ${skipped} skipped. Remaining selected profiles can be processed with Unfollow again.`);
    } catch (error) {
      if (currentUser?.writeAttempted) {
        currentUser.state = 'unconfirmed: check Instagram manually';
        currentUser.checkbox.checked = false;
      }
      say(`${error.message}\n${confirmed} confirmed unfollows. ${currentUser?.writeAttempted ? 'An in-flight request may still have completed; check Instagram manually.' : 'No further unfollow will be sent.'}`);
    } finally { busy = false; refresh(); }
  }
  el('[data-run]').addEventListener('click', run);
  el('[data-stop]').addEventListener('click', () => { stop(); say('Stopping before the next request. An in-flight request may still complete.'); });
  el('[data-close]').addEventListener('click', () => { stop(); panel.remove(); style.remove(); });
  refresh();
})();