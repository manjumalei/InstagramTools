# InstagramTools

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Last commit](https://img.shields.io/github/last-commit/manjumalei/InstagramTools)

A collection of small, independent tools for managing and working with Instagram data.

## Tools

| Tool | Description | Guide |
| --- | --- | --- |
| [Cancel pending follow requests](tools/cancel-pending-follow-requests/) | Find and optionally withdraw outgoing follow requests using an Instagram data export and a browser console. | [Usage instructions](tools/cancel-pending-follow-requests/README.md) |
| [Find non-followers](tools/find-non-followers/index.html) | Select exported followers and following in your browser and create a searchable HTML report with direct profile links. Also available as a Python script. | [Usage instructions](tools/find-non-followers/README.md) |
| [Unfollow non-followers](tools/unfollow-non-followers/) | Compare HTML exports in the Instagram browser console, verify live relationships, and optionally unfollow explicitly selected profiles in confirmed batches. | [Usage instructions](tools/unfollow-non-followers/README.md) |

## Repository structure

Each tool lives in its own directory under `tools/` and includes its own usage instructions. Tools may have different prerequisites and risks; read the relevant guide before running one.

```text
tools/
	cancel-pending-follow-requests/
		README.md
		cancel_pending_follow_requests.js
	find-non-followers/
		README.md
		index.html
		find_non_followers.py
		test_find_non_followers.py
	unfollow-non-followers/
		README.md
		unfollow_non_followers.js
```

## Disclaimer

These are unofficial, community-maintained tools and are not affiliated with or endorsed by Instagram or Meta. Instagram's interfaces and undocumented endpoints can change. Use each tool only with accounts and data you are authorized to access, and review its source before running it.

## License

This repository is licensed under the MIT License. See [LICENSE](LICENSE) for the full license text.
