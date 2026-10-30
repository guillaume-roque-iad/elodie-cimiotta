#!/usr/bin/env python3
"""Regression checks for the multilingual dates and registration choices."""
from datetime import datetime
from html import unescape
from pathlib import Path
import re
import unittest

from generate_presentations import ROOT, LANGUAGES, event_start, load_source, localized_date, parse_as_of, render_page


def cards(markup):
    return re.findall(r'<article\b(?=[^>]*\bdata-poa-start="([^"]+)")(?=[^>]*\bdata-presentation-id="([^"]+)")[^>]*>(.*?)</article>', markup, re.S)


def options(markup):
    return re.findall(r'<option\b(?=[^>]*\bdata-poa-option="([^"]+)")(?=[^>]*\bdata-presentation-id="([^"]+)")(?=[^>]*\bvalue="([^"]+)")[^>]*>(.*?)</option>', markup, re.S)


class PresentationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source, cls.timezone = load_source()
        cls.now = parse_as_of("2026-10-30T10:00:00+01:00", cls.timezone)
        cls.pages = {lang: (ROOT / ("index.html" if lang == "fr" else lang + "/index.html")).read_text() for lang in LANGUAGES}

    def render(self, lang, at=None):
        return render_page(self.pages[lang], lang, self.source, self.timezone, at or self.now)

    def test_regression_calendar_labels(self):
        # These were one day early in the option values and click targets.
        self.assertEqual(localized_date("2027-04-20", "ca"), "20 d’abril del 2027")
        self.assertEqual(localized_date("2027-01-12", "de"), "12. Januar 2027")
        self.assertEqual(localized_date("2027-04-20", "de"), "20. April 2027")
        self.assertEqual(localized_date("2027-06-29", "en"), "June 29, 2027")

    def test_cards_clicks_and_submitted_values_agree_in_all_languages(self):
        expected_dates = ["2027-01-12", "2027-04-20", "2027-06-29"]
        for lang in LANGUAGES:
            with self.subTest(language=lang):
                page = self.render(lang)
                page_cards = cards(page)
                choices = {identifier: (start, unescape(value), unescape(text)) for start, identifier, value, text in options(page)}
                self.assertEqual(len(choices), 4 if lang == "fr" else 3)
                self.assertEqual([start[:10] for start, _, _ in page_cards], (["2026-11-10"] if lang == "fr" else []) + expected_dates)
                for start, identifier, card in page_cards:
                    choice_start, value, text = choices[identifier]
                    date_text = localized_date(start[:10], lang)
                    self.assertEqual(start, choice_start)
                    self.assertIn(date_text, unescape(card))
                    self.assertIn(date_text, value)
                    self.assertIn(date_text, text)
                    if lang != "fr":
                        click_value = re.search(r'\bdata-presentation="([^"]+)"', card).group(1)
                        self.assertEqual(unescape(click_value), value)

    def test_french_destinations_and_translated_contact_flow_are_preserved(self):
        fr = self.render("fr")
        self.assertIn('href="https://tribu-immo.com/presentation-opportunites-affaires?session=2026-11-10#inscription"', fr)
        for suffix in ("1", "2", "3"):
            self.assertIn('href="https://www.billetweb.fr/decouvrez-le-metier-de-conseiller-immobilier-iad-presentation-a-narbonne' + suffix + '"', fr)
        self.assertEqual(len(re.findall(r'<optgroup\b[^>]*data-meeting-format', fr)), 2)
        self.assertIn("Je souhaite d’abord des informations", fr)
        for lang, anchor in (("es", "#contacto"), ("ca", "#contacte"), ("pt", "#contact"), ("it", "#contact"), ("de", "#contact"), ("en", "#contact")):
            for _, _, card in cards(self.render(lang)):
                self.assertIn('href="' + anchor + '"', card)

    def test_expired_dates_are_only_in_archive_in_initial_html(self):
        for lang in LANGUAGES:
            page = self.render(lang)
            self.assertFalse(any(start.startswith("2026-10") for start, _, _, _ in options(page)))
            self.assertIn('data-presentation-date="2026-10-13"', page)
            self.assertIn('data-presentation-date="2026-10-27"', page)

    def test_expiry_boundary_matches_paris_time_even_with_utc_cutoff(self):
        before = parse_as_of("2027-01-12T17:29:59+00:00", self.timezone)
        boundary = parse_as_of("2027-01-12T17:30:00+00:00", self.timezone)
        self.assertIn("narbonne-2027-01-12", {identifier for _, identifier, _, _ in options(self.render("ca", before))})
        at = self.render("ca", boundary)
        self.assertNotIn("narbonne-2027-01-12", {identifier for _, identifier, _, _ in options(at)})
        self.assertNotIn("narbonne-2027-01-12", {identifier for _, identifier, _ in cards(at)})
        self.assertIn('data-presentation-date="2027-01-12"', at)
        events = {event["id"]: event for event in self.source["events"]}
        self.assertTrue(event_start(events["narbonne-2027-01-12"], self.timezone).isoformat().endswith("+01:00"))
        self.assertTrue(event_start(events["narbonne-2027-04-20"], self.timezone).isoformat().endswith("+02:00"))

    def test_no_future_event_leaves_contact_choices_and_archives(self):
        after_all = parse_as_of("2027-06-29T18:30:00+02:00", self.timezone)
        for lang in LANGUAGES:
            page = self.render(lang, after_all)
            self.assertEqual(cards(page), [])
            self.assertEqual(options(page), [])
            self.assertRegex(page, r'<p data-agenda-empty>')
            self.assertIn('<select id="presentation"', page)
            self.assertIn('data-presentation-date="2027-06-29"', page)

    def test_reproducible_generation_preserves_head_and_other_form_fields(self):
        for lang in LANGUAGES:
            original = self.pages[lang]
            generated = self.render(lang)
            self.assertEqual(render_page(generated, lang, self.source, self.timezone, self.now), generated)
            self.assertEqual(original.split('</head>', 1)[0], generated.split('</head>', 1)[0])
            select_pattern = r'<select\b(?=[^>]*\bid="presentation")[^>]*>.*?</select>'
            for pattern in (r'<form\b.*?</form>',):
                old_forms = re.findall(pattern, original, re.S)
                new_forms = re.findall(pattern, generated, re.S)
                self.assertEqual([re.sub(select_pattern, '', form, flags=re.S) for form in old_forms], [re.sub(select_pattern, '', form, flags=re.S) for form in new_forms])


if __name__ == "__main__":
    unittest.main()
