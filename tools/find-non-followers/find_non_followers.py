import argparse
from datetime import datetime
from html import escape
from html.parser import HTMLParser
from pathlib import Path
import re
from string import Template
import sys
from urllib.parse import unquote, urlsplit


class ProfileParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.usernames = set()

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        href = dict(attrs).get("href")
        if not href:
            return
        try:
            url = urlsplit(href)
        except ValueError:
            return
        if url.scheme not in ("https", "http") or url.hostname not in (
            "instagram.com", "www.instagram.com"
        ):
            return
        parts = unquote(url.path).strip("/").split("/")
        if len(parts) == 2 and parts[0] == "_u":
            parts = parts[1:]
        if len(parts) == 1 and re.fullmatch(r"[A-Za-z0-9_.]{1,30}", parts[0]):
            self.usernames.add(parts[0].lower())


def read_profiles(path):
    parser = ProfileParser()
    parser.feed(path.read_text(encoding="utf-8-sig"))
    parser.close()
    return parser.usernames


REPORT = Template("""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Instagram: Not Following Back</title>
<style>
:root { --ink: #202624; --muted: #56615b; --accent: #146547; --line: #d6dfd9; }
* { box-sizing: border-box; }
body { margin: 0; color: var(--ink); background: #f8faf9;
  font: 16px/1.6 "Avenir Next", "Segoe UI", sans-serif; letter-spacing: 0; }
main { max-width: 880px; margin: auto; padding: 40px 20px; }
header { border-top: 5px solid var(--accent); padding-top: 20px; }
h1 { font-size: 28px; line-height: 1.25; margin: 0 0 12px; overflow-wrap: anywhere; }
p { color: var(--muted); margin: 8px 0; }
.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px; border-block: 1px solid var(--line); margin: 24px 0; padding: 18px 0; }
.stats dt { font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }
.stats dd { margin: 0; font-size: 26px; font-weight: 600; }
label { display: block; font-weight: 600; margin-bottom: 6px; }
input { width: 100%; font: inherit; padding: 10px 12px; border: 1px solid #86998c;
  border-radius: 4px; background: white; color: var(--ink); }
input:focus-visible, a:focus-visible { outline: 3px solid #bb5b21; outline-offset: 3px; }
ol { margin: 16px 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
li { border-bottom: 1px solid var(--line); }
a { display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 12px 4px; color: var(--accent); text-decoration: none; overflow-wrap: anywhere; }
a:hover { background: #eaf1ec; text-decoration: underline; }
a:visited { color: #75451f; }
.handle { min-width: 0; }
.arrow { flex-shrink: 0; }
[hidden] { display: none !important; }
footer { margin-top: 28px; font-size: 13px; color: var(--muted); }
@media (max-width: 420px) { main { padding: 24px 16px; } h1 { font-size: 24px; }
  .stats { gap: 8px; } .stats dd { font-size: 22px; } }
@media print { .search { display: none; } main { max-width: none; padding: 0; }
  li[hidden] { display: block !important; } a { padding: 4px 0; } }
</style>
</head>
<body>
<main>
<header>
<h1>Instagram: Not Following Back</h1>
<p>Profiles you follow that do not follow you back, based on your export.</p>
</header>
<dl class="stats">
<div><dt>Followers</dt><dd>$followers_count</dd></div>
<div><dt>Following</dt><dd>$following_count</dd></div>
<div><dt>Not following back</dt><dd>$missing_count</dd></div>
</dl>
<div class="search" hidden>
<label for="search">Search profiles</label>
<input id="search" type="search" autocomplete="off" spellcheck="false">
<p id="visible-count" role="status" aria-live="polite"></p>
</div>
<ol aria-label="Profiles not following you back">
$rows
</ol>
<p id="empty"$empty_hidden>No profiles found.</p>
<footer>Generated on $created. Data source: your Instagram export.
Changes made after the export are not included.</footer>
</main>
<script>
const search = document.getElementById('search');
const rows = Array.from(document.querySelectorAll('li'));
document.querySelector('.search').hidden = false;
function filterProfiles() {
  const query = search.value.trim().toLowerCase().replace(/^@/, '');
  let visible = 0;
  for (const row of rows) {
    row.hidden = !row.dataset.username.includes(query);
    if (!row.hidden) visible += 1;
  }
  document.getElementById('visible-count').textContent =
    visible + ' of ' + rows.length + ' profiles';
  document.getElementById('empty').hidden = visible !== 0;
}
search.addEventListener('input', filterProfiles);
filterProfiles();
</script>
</body>
</html>
""")


def render_report(followers, following):
    missing = sorted(following - followers)
    rows = "\n".join(
        '<li data-username="{username}"><a href="https://www.instagram.com/{username}/" '
        'target="_blank" rel="noopener noreferrer">'
        '<span class="handle">@{username}</span>'
        '<span class="arrow" aria-hidden="true">&#8599;</span></a></li>'.format(
            username=escape(username, quote=True)
        )
        for username in missing
    )
    return REPORT.substitute(
        followers_count=len(followers),
        following_count=len(following),
        missing_count=len(missing),
        rows=rows,
        empty_hidden=" hidden" if missing else "",
        created=datetime.now().astimezone().isoformat(timespec="minutes"),
    )


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Compare Instagram HTML exports and generate a local non-followers report."
    )
    parser.add_argument("export_directory", type=Path,
                        help="Folder containing followers_*.html and following.html")
    parser.add_argument("-o", "--output", type=Path, default=Path("non_followers.html"),
                        help="Output HTML path (default: non_followers.html; must not exist)")
    args = parser.parse_args(argv)
    try:
        folder = args.export_directory.expanduser()
        follower_files = sorted(folder.glob("followers_*.html"))
        if not follower_files:
            raise ValueError("No followers_*.html files found in the export directory.")
        followers = set()
        for path in follower_files:
            followers.update(read_profiles(path))
        following = read_profiles(folder / "following.html")
        if not followers or not following:
            print("Warning: one export contains no recognized profile links. "
                  "Verify the files and report counts before using the results.", file=sys.stderr)
        output = args.output.expanduser()
        if output.resolve() in {path.resolve() for path in follower_files} | {
            (folder / "following.html").resolve()
        }:
            raise ValueError("The output must not be an input export file.")
        with output.open("x", encoding="utf-8") as report:
            report.write(render_report(followers, following))
    except (OSError, UnicodeError, ValueError) as error:
        parser.exit(1, f"Error: {error}\n")
    print(f"Followers: {len(followers)} | Following: {len(following)} | "
          f"Not following back: {len(following - followers)}")
    print(f"Report: {output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())