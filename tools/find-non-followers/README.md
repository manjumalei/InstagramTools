# Instagram Non-Followers Report

This local browser tool compares your exported followers and following lists. It generates a standalone HTML report listing the profiles you follow that do not follow you back, with alphabetical sorting, a username search, summary counts, and clickable Instagram profile links. A Python command-line version is also available.

Neither version signs in to Instagram, makes network requests, or unfollows anyone. All tool messages and report labels are in English. The browser version needs no installation or server; the Python version requires no third-party packages.

## 1. Export your Instagram information

1. In Instagram, open **Accounts Center** and choose **Your information and permissions** > **Download your information** (the wording may vary slightly).
2. Choose the Instagram account you want to check, then choose to export information to your device.
3. Set the date range to **All time**.
4. Select **Followers and following** under **Connections**. No other information is needed.
5. Choose **HTML** as the export format and request the export.
6. Download and extract the archive. Locate the `connections/followers_and_following` folder containing `following.html` and `followers_1.html`. If there are additional files such as `followers_2.html`, keep them in the same folder; the script reads all `followers_*.html` files automatically.

## 2. Generate the report in your browser

1. Open [index.html](index.html) from your local copy of this repository in a current desktop browser such as Chrome, Edge, Firefox, or Safari. JavaScript must be enabled. You can double-click the file; no terminal or Python installation is needed. GitHub's source view does not run the tool.
2. Under **Followers files**, select `followers_1.html`. If your export includes additional parts such as `followers_2.html`, select all follower parts together.
3. Under **Following file**, select `following.html` from the same export.
4. Click **Create report**. The results appear on the page, with counts and an alphabetical list of clickable profile links. Use **Search profiles** to filter the list.
5. Click **Download HTML** to save a standalone copy of the report. It includes all results, even when a search filter is active, and its search also works offline. Your browser manages the download location and any existing filenames.

The selected files are read locally in your browser, not uploaded. Selecting a different file hides the old report until you click **Create report** again. Opening a profile requires an internet connection and may require signing in to Instagram.

## Alternative: Python command line

1. Install **Python 3.9 or newer** if needed. Check availability with `python3 --version` (on Windows, use `py -3 --version`).
2. Open a terminal in the root of this repository.
3. Run the script with the path to the extracted followers-and-following folder:

   ```sh
   python3 tools/find-non-followers/find_non_followers.py \
     "/path/to/instagram-export/connections/followers_and_following"
   ```

   On Windows, replace `python3` with `py -3` and put the command on one line.

4. The terminal prints the number of unique followers, followed profiles, profiles not following back, and the report's full path. By default, the report is written as `non_followers.html` in the terminal's current directory.
5. Open the generated HTML file in your browser. Click a username to open its Instagram profile in a new tab. The report works offline; opening Instagram profiles requires an internet connection and may require signing in.

To choose a different output location:

```sh
python3 tools/find-non-followers/find_non_followers.py \
  "/path/to/instagram-export/connections/followers_and_following" \
  --output "$HOME/Downloads/instagram_non_followers.html"
```

Existing files are never overwritten. To generate another report, choose a new output filename or remove the previous report yourself. The output folder must already exist. Use `--help` to see the command-line options.

## Important notes

- All processing happens locally. The browser tool and reports contain no external scripts, fonts, images, or analytics. Only clicking a profile link contacts Instagram.
- No Instagram-related batch limits or request pauses are needed: comparison and report generation read local files without querying Instagram or changing your account. Large exports are limited by your device's available memory and processing capacity, not an Instagram API allowance. This does not apply to the separate console tools that perform live lookups or account actions.
- Use follower and following files from the **same export**, with the **All time** range. Include every follower part; missing parts can incorrectly classify profiles as not following back. Keep unrelated exports in separate folders.
- The result reflects the export's contents, not live Instagram status. Accounts may have followed, unfollowed, changed their username, or been deleted since the export was created. The date shown in the report is its generation date, not the export date. It uses ISO 8601 format with a UTC offset (or `Z` for UTC) to avoid regional date ambiguity.
- The script reads usernames from `instagram.com/username` and `instagram.com/_u/username` profile links, independently of the export's display language. Usernames are compared case-insensitively and duplicates are removed.
- Missing or unreadable files cause an error. If either list has no recognized profile links, the tool displays a warning but still generates the report, since an account can genuinely have zero followers or follow nobody. Check the reported counts against your export, especially after a warning. JSON exports are not supported.
- The report contains personal account information. Keep both the export and generated report private; do not commit them to this repository.
- This is an unofficial tool, not affiliated with Instagram or Meta. Export formats can change.

## Tests

For the Python version, from the repository root:

```sh
python3 -B -m unittest discover -s tools/find-non-followers -v
```

For the browser version, verify file selection, multiple follower parts, case-insensitive comparison, search (including an empty result), and the downloaded report. Counts should match the Python version when using the same export. Check that selecting a new file hides the previous result and that invalid filenames produce an error.

## License

This tool is covered by the repository's MIT License. See the [repository license](../../LICENSE) for the full terms.