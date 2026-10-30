#!/usr/bin/env python3
"""Generate the seven static agendas from editorial/presentations.json.

No network access or scheduled task. Pass --as-of for a reproducible build.
Only the agenda cards, archive items and presentation select are replaced.
"""
import argparse
from datetime import date, datetime
from html import escape
import json
from pathlib import Path
import re
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = ("fr", "es", "ca", "pt", "it", "de", "en")
MONTHS = {
    "fr": "janvier février mars avril mai juin juillet août septembre octobre novembre décembre".split(),
    "es": "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split(),
    "ca": "gener febrer març abril maig juny juliol agost setembre octubre novembre desembre".split(),
    "pt": "janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro".split(),
    "it": "gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre dicembre".split(),
    "de": "Januar Februar März April Mai Juni Juli August September Oktober November Dezember".split(),
    "en": "January February March April May June July August September October November December".split(),
}
UI = {
    "fr": {"timeZone": "Heure de Paris", "online": "En visio", "contact": "#contact"},
    "es": {"timeZone": "Hora de París", "online": "Por videoconferencia", "contact": "#contacto", "cta": "Solicitar participar ↗"},
    "ca": {"timeZone": "Hora de París", "online": "En línia", "contact": "#contacte", "cta": "Demanar de participar ↗"},
    "pt": {"timeZone": "Hora de Paris", "online": "Online", "contact": "#contact", "cta": "Pedir para participar ↗"},
    "it": {"timeZone": "Ora di Parigi", "online": "Online", "contact": "#contact", "cta": "Richiedi di partecipare ↗"},
    "de": {"timeZone": "Pariser Zeit", "online": "Online", "contact": "#contact", "cta": "Teilnahme anfragen ↗"},
    "en": {"timeZone": "Paris time", "online": "Online", "contact": "#contact", "cta": "Request to attend ↗"},
}


def localized_date(value, lang):
    """Format the calendar date itself, never a date in the visitor's timezone."""
    day = date.fromisoformat(value)
    month = MONTHS[lang][day.month - 1]
    if lang == "en":
        return f"{month} {day.day}, {day.year}"
    if lang == "de":
        return f"{day.day}. {month} {day.year}"
    if lang in ("es", "pt"):
        return f"{day.day} de {month} de {day.year}"
    if lang == "ca":
        prefix = "d’" if day.month in (4, 8, 10) else "de "
        return f"{day.day} {prefix}{month} del {day.year}"
    return f"{day.day} {month} {day.year}"


def event_start(event, timezone):
    return datetime.fromisoformat(event["date"] + "T" + event["start"]).replace(tzinfo=timezone)


def parse_as_of(value, timezone):
    instant = datetime.fromisoformat(value) if value else datetime.now(timezone)
    return instant.replace(tzinfo=timezone) if instant.tzinfo is None else instant.astimezone(timezone)


def load_source(root=ROOT):
    source = json.loads((root / "editorial/presentations.json").read_text())
    timezone = ZoneInfo(source["timeZone"])
    seen = set()
    for event in source["events"]:
        if event["id"] in seen:
            raise ValueError("Duplicate event id: " + event["id"])
        seen.add(event["id"])
        start = event_start(event, timezone)
        end = datetime.fromisoformat(event["date"] + "T" + event["end"]).replace(tzinfo=timezone)
        if end <= start or event["format"] not in ("visio", "presentiel"):
            raise ValueError("Invalid event time or format: " + event["id"])
        if not event["registrationUrl"].startswith("https://"):
            raise ValueError("Registration link must use HTTPS: " + event["id"])
        if not event["languages"] or set(event["languages"]) - set(LANGUAGES):
            raise ValueError("Invalid event languages: " + event["id"])
        source["venues"][event["venue"]]
    for value in source["archivedDates"]:
        date.fromisoformat(value)
    return source, timezone


def event_label(event, lang, source):
    label = localized_date(event["date"], lang)
    if lang == "fr":
        kind = "Présentation en visio (Google Meet)" if event["format"] == "visio" else "Présentation en présentiel (Narbonne)"
        return f"{kind} — {label} · {event['start']} – {event['end']} (heure de Paris)"
    venue = UI[lang]["online"] if event["format"] == "visio" else source["venues"][event["venue"]]["name"]
    return f"{label} · {event['start']} · {venue}"


def render_card(event, lang, source, timezone):
    start = event_start(event, timezone).isoformat(timespec="seconds")
    label = localized_date(event["date"], lang)
    venue = source["venues"][event["venue"]]
    badge = UI[lang]["online"] if event["format"] == "visio" else venue["name"]
    address = "<br>".join(escape(line) for line in venue["address"])
    if lang == "fr":
        online = event["format"] == "visio"
        attributes = ' class="textlink" href="' + escape(event["registrationUrl"], quote=True) + '"'
        if not online:
            attributes += ' target="_blank" rel="noopener"'
        attributes += ' data-evt="' + ("presentation-date" if online else "presentation-billetweb") + '"'
        cta = "Je m’inscris gratuitement ↗" if online else "Je m’inscris sur Billetweb ↗"
    else:
        attributes = ' href="' + UI[lang]["contact"] + '" data-presentation="' + escape(event_label(event, lang, source), quote=True) + '"'
        cta = UI[lang]["cta"]
    return (
        f'<article class="agenda-card" data-poa-start="{start}" data-presentation-id="{escape(event["id"], quote=True)}" data-poa-format="{event["format"]}">'
        f'<span class="eyebrow">{escape(badge)}</span><h3><time datetime="{start}">{escape(label)}</time></h3>'
        f'<p><strong>{event["start"]} – {event["end"]}</strong><br>{UI[lang]["timeZone"]}</p><p>{address}</p>'
        f'<a{attributes} data-presentation-id="{escape(event["id"], quote=True)}">{cta}</a></article>'
    )


def render_option(event, lang, source, timezone):
    start = event_start(event, timezone).isoformat(timespec="seconds")
    label = event_label(event, lang, source)
    visible = f"{localized_date(event['date'], lang)} · {event['start']} – {event['end']}" if lang == "fr" else label
    return f'<option data-poa-option="{start}" data-presentation-id="{escape(event["id"], quote=True)}" value="{escape(label, quote=True)}">{escape(visible)}</option>'


def replace_exactly_one(pattern, replacement, text, name):
    result, count = re.subn(pattern, replacement, text, count=0, flags=re.S)
    if count != 1:
        raise ValueError(f"Expected exactly one {name}; found {count}")
    return result


def render_page(original, lang, source, timezone, as_of):
    visible = sorted((event for event in source["events"] if lang in event["languages"]), key=lambda event: event_start(event, timezone))
    upcoming = [event for event in visible if event_start(event, timezone) > as_of]
    archived = sorted(set(source["archivedDates"]) | {event["date"] for event in visible if event_start(event, timezone) <= as_of})

    def agenda(match):
        section = match.group(0)
        cards = '<div class="agenda-grid">' + ''.join(render_card(event, lang, source, timezone) for event in upcoming) + '</div>'
        section = replace_exactly_one(r'<div class="agenda-grid">.*?</div>', lambda _: cards, section, "agenda grid")
        items = ''.join(f'<li data-presentation-date="{value}">{escape(localized_date(value, lang))}</li>' for value in archived)
        section = replace_exactly_one(r'(<details\b[^>]*\bdata-presentation-archive(?:="[^"]*")?[^>]*>.*?<ul>).*?(</ul>)', lambda m: m.group(1) + items + m.group(2), section, "archive list")
        section = replace_exactly_one(r'<p\b(?=[^>]*\bdata-agenda-empty)[^>]*>', lambda _: '<p data-agenda-empty' + (' hidden' if upcoming else '') + '>', section, "empty-agenda message")
        return section

    result = replace_exactly_one(r'<section\b(?=[^>]*\bid="presentations")[^>]*>.*?</section>', agenda, original, "presentations section")

    def select(match):
        start, content, end = match.groups()
        # Keep the non-date choices verbatim, including the specific French flow.
        fixed = re.findall(r'<option\b(?![^>]*\bdata-poa-option)[^>]*>.*?</option>', content, re.S)
        if lang == "fr":
            if len(fixed) != 2:
                raise ValueError("French meeting select must keep its two non-date choices")
            groups = []
            for kind, title in (("visio", "Présentation en visio · Google Meet"), ("presentiel", "Présentation en présentiel · Narbonne")):
                options = ''.join(render_option(event, lang, source, timezone) for event in upcoming if event["format"] == kind)
                if options:
                    groups.append(f'<optgroup label="{title}" data-meeting-format="{kind}">{options}</optgroup>')
            content = fixed[0] + ''.join(groups) + fixed[1]
        else:
            if len(fixed) != 1:
                raise ValueError("Translated meeting select must keep its individual-conversation choice")
            content = fixed[0] + ''.join(render_option(event, lang, source, timezone) for event in upcoming)
        return start + content + end

    return replace_exactly_one(r'(<select\b(?=[^>]*\bid="presentation")[^>]*>)(.*?)(</select>)', select, result, "presentation select")


def generate(root=ROOT, as_of=None, check=False):
    source, timezone = load_source(root)
    instant = parse_as_of(as_of, timezone)
    changed = []
    for lang in LANGUAGES:
        relative = Path("index.html") if lang == "fr" else Path(lang) / "index.html"
        path = root / relative
        original = path.read_text()
        generated = render_page(original, lang, source, timezone, instant)
        if original != generated:
            changed.append(relative.as_posix())
            if not check:
                path.write_text(generated)
    return changed, instant


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--as-of", help="ISO timestamp/date; a timezone-less value is interpreted in Europe/Paris")
    parser.add_argument("--check", action="store_true", help="Compare generated HTML without writing files")
    args = parser.parse_args()
    changes, instant = generate(as_of=args.as_of, check=args.check)
    print(f"Agenda source: editorial/presentations.json ; cutoff: {instant.isoformat()}")
    if changes:
        print(("Stale generated agendas: " if args.check else "Updated agendas: ") + ", ".join(changes))
    else:
        print("All seven static agendas match the source.")
    raise SystemExit(1 if args.check and changes else 0)
