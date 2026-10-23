from contextlib import redirect_stderr, redirect_stdout
from html.parser import HTMLParser
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from find_non_followers import ProfileParser, main, render_report


class ReportLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.links.append(dict(attrs))


class NonFollowersTests(unittest.TestCase):
    def test_profile_formats_case_duplicates_and_untrusted_links(self):
        parser = ProfileParser()
        parser.feed('''
            <a href="https://www.instagram.com/Alice/">Display name</a>
            <a href="https://instagram.com/_u/ALICE?x=1&amp;y=2">URL</a>
            <a href="https://www.instagram.com/_u/bob.name_">Bob</a>
            <a href="https://example.com/mallory">Other site</a>
            <a href="https://instagram.com.evil.test/mallory">Fake host</a>
            <a href="javascript:alert(1)">Script</a>
            <a href="https://www.instagram.com/p/post-id/">Post</a>
            <a href="https://www.instagram.com/%22%3Ebad">Unsafe name</a>
            <a href="http://[invalid">Malformed URL</a>
        ''')
        self.assertEqual(parser.usernames, {"alice", "bob.name_"})

    def test_report_contains_only_sorted_non_mutual_profile_links(self):
        report = render_report({"mutual", "follower_only"}, {"zebra", "mutual", "alice"})
        parser = ReportLinks()
        parser.feed(report)
        self.assertEqual([link["href"] for link in parser.links], [
            "https://www.instagram.com/alice/", "https://www.instagram.com/zebra/"
        ])
        self.assertTrue(all(link["rel"] == "noopener noreferrer" for link in parser.links))
        self.assertNotIn("$rows", report)
        self.assertIn('<html lang="en">', report)
        self.assertIn('<title>Instagram: Not Following Back</title>', report)
        self.assertIn('<label for="search">Search profiles</label>', report)
        self.assertIn('aria-label="Profiles not following you back"', report)
        self.assertIn("' of ' + rows.length + ' profiles'", report)
        self.assertRegex(report, r"Generated on \d{4}-\d{2}-\d{2}T\d{2}:\d{2}[+-]\d{2}:\d{2}")

    def test_empty_result(self):
        report = render_report({"alice"}, {"alice"})
        self.assertIn('<p id="empty">No profiles found.</p>', report)
        self.assertNotIn('<li data-username=', report)

    def test_split_exports_and_output_protection(self):
        with TemporaryDirectory() as directory:
            folder = Path(directory)
            (folder / "followers_1.html").write_text(
                '<a href="https://instagram.com/alice">Alice</a>', encoding="utf-8")
            (folder / "followers_2.html").write_text(
                '<a href="https://instagram.com/bob">Bob</a>', encoding="utf-8")
            following = '<a href="https://instagram.com/_u/BOB">Bob</a>'
            following += '<a href="https://instagram.com/_u/carol">Carol</a>'
            (folder / "following.html").write_text(following, encoding="utf-8")
            output = folder / "report.html"
            with redirect_stdout(StringIO()):
                self.assertEqual(main([str(folder), "-o", str(output)]), 0)
            parser = ReportLinks()
            parser.feed(output.read_text(encoding="utf-8"))
            self.assertEqual([link["href"] for link in parser.links],
                             ["https://www.instagram.com/carol/"])
            for target in (output, folder / "following.html", folder / "followers_1.html"):
                before = target.read_bytes()
                with redirect_stderr(StringIO()), self.assertRaises(SystemExit) as error:
                    main([str(folder), "-o", str(target)])
                self.assertEqual(error.exception.code, 1)
                self.assertEqual(target.read_bytes(), before)

    def test_missing_export_fails_without_output(self):
        with TemporaryDirectory() as directory:
            output = Path(directory) / "report.html"
            with redirect_stderr(StringIO()), self.assertRaises(SystemExit) as error:
                main([directory, "-o", str(output)])
            self.assertEqual(error.exception.code, 1)
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()