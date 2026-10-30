#!/usr/bin/env python3
"""Check live indexing policy with Python stdlib + curl (no redirects followed).

Production: python3 scripts/check_live.py --check-www
Pages dev:  python3 scripts/check_live.py --base-url http://127.0.0.1:8788
Canonical URLs and hreflang must always retain the production origin.
"""
import argparse
import concurrent.futures
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from urllib.parse import urljoin, urlsplit
import uuid
import xml.etree.ElementTree as ET

BASE = 'https://team-lucky.com'
TECHNICAL = ['/seo/liens-tribu-immo', '/seo/liens-elodie-cimiotta',
             '/seo/verification.md', '/scripts/generate_sitemap.py',
             '/editorial/publications.json']


def excludes_indexing(values):
    return any(re.search(r'\b(?:noindex|none)\b', value, re.I) for value in values)


class Metadata(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonical, self.alternates, self.robots = [], [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'meta' and (a.get('name') or '').lower() in ('robots', 'googlebot', 'bingbot'):
            self.robots.append(a.get('content') or '')
        if tag == 'link':
            rel = (a.get('rel') or '').lower().split()
            if 'canonical' in rel:
                self.canonical.append(a.get('href') or '')
            if 'alternate' in rel and 'hreflang' in a:
                self.alternates.append((a.get('hreflang') or '', a.get('href') or ''))


def fetch(url):
    with tempfile.TemporaryDirectory(prefix='team-lucky-check-') as tmp:
        headers_path, body_path = Path(tmp) / 'headers', Path(tmp) / 'body'
        command = ['curl', '--disable', '-sS', '--max-time', '20', '--connect-timeout', '10',
                   '-D', str(headers_path), '-o', str(body_path), '-w', '%{http_code}', url]
        try:
            result = subprocess.run(command, text=True, capture_output=True, timeout=22)
        except (OSError, subprocess.TimeoutExpired) as error:
            raise RuntimeError(str(error)) from error
        if result.returncode:
            raise RuntimeError(result.stderr.strip() or f'curl exit {result.returncode}')
        headers = {}
        for line in headers_path.read_text(errors='replace').splitlines():
            if line.startswith('HTTP/'):
                headers = {}  # Discard proxy CONNECT and interim response headers.
            elif ':' in line:
                name, value = line.split(':', 1)
                headers.setdefault(name.lower(), []).append(value.strip())
        return int(result.stdout), headers, body_path.read_text(encoding='utf-8', errors='replace')


def check(url, kind, canonical=None, alternates=()):
    try:
        code, headers, body = fetch(url)
    except (RuntimeError, ValueError) as error:
        return url, [f'NETWORK_ERROR: {error}']
    errors = []
    if kind == 'www':
        locations = headers.get('location', [])
        if code not in (301, 308) or len(locations) != 1 or urljoin(url, locations[0]) != canonical:
            errors.append(f'expected one permanent redirect to {canonical}; HTTP {code}, Location {locations}')
        return url, errors
    expected_status = 404 if kind == 'missing' else 200
    if code != expected_status:
        return url, [f'expected direct HTTP {expected_status}; HTTP {code}, Location {headers.get("location", [])}']
    header_noindex = excludes_indexing(headers.get('x-robots-tag', []))
    if kind == 'technical':
        if not header_noindex:
            errors.append('missing X-Robots-Tag: noindex')
    elif kind in ('page', 'tool'):
        metadata = Metadata()
        metadata.feed(body)
        meta_noindex = excludes_indexing(metadata.robots)
        if kind == 'tool' and not meta_noindex:
            errors.append('embedded simulator lost its HTML noindex')
        if kind == 'page':
            if header_noindex or meta_noindex:
                errors.append('sitemap page excluded by X-Robots-Tag or meta robots/googlebot/bingbot')
            if metadata.canonical != [canonical]:
                errors.append(f'canonical {metadata.canonical}, expected {canonical}')
            if sorted(metadata.alternates) != sorted(alternates):
                errors.append('HTML hreflang differs from live sitemap annotations')
    return url, errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default=BASE, help='Production or Pages dev origin; no path')
    parser.add_argument('--check-www', action='store_true', help='Also check permanent www redirects in production')
    args = parser.parse_args()
    base = args.base_url.rstrip('/')
    parsed = urlsplit(base)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.password:
        parser.error('--base-url must be an HTTP(S) origin without credentials, path, query or fragment')
    if args.check_www and base != BASE:
        parser.error('--check-www is only valid with the production --base-url')
    try:
        code, _, body = fetch(base + '/sitemap.xml')
        if code != 200:
            raise ValueError(f'sitemap expected direct HTTP 200; HTTP {code}')
        root = ET.fromstring(body)
        tasks, seen = [], set()
        for node in root.findall('{*}url'):
            canonical = node.findtext('{*}loc', default='').strip()
            u = urlsplit(canonical)
            if u.scheme != 'https' or u.netloc != 'team-lucky.com' or u.query or u.fragment or canonical in seen:
                raise ValueError(f'invalid or duplicate sitemap URL: {canonical}')
            seen.add(canonical)
            alternates = [(x.get('hreflang', ''), x.get('href', '')) for x in node.findall('{http://www.w3.org/1999/xhtml}link')]
            tasks.append((base + u.path, 'page', canonical, alternates))
        if not tasks:
            raise ValueError('sitemap contains no page URLs')
    except (RuntimeError, ValueError, ET.ParseError) as error:
        print(f'FAIL sitemap: {error}', file=sys.stderr)
        return 1
    page_count = len(tasks)
    tasks.extend((base + path, 'technical') for path in TECHNICAL)
    tasks += [(base + '/simulateur-outil', 'tool'), (base + '/__seo-check-' + uuid.uuid4().hex, 'missing')]
    if args.check_www:
        tasks.extend((scheme + '://www.team-lucky.com' + path, 'www', BASE + path)
                     for scheme in ('http', 'https') for path in ('/', '/es/'))
    failed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for url, errors in pool.map(lambda task: check(*task), tasks):
            failed += bool(errors)
            print(('FAIL' if errors else 'OK'), url, '; '.join(errors), flush=True)
    print(f'{len(tasks) - failed}/{len(tasks)} checks passed; {page_count} sitemap pages checked')
    return int(bool(failed))


if __name__ == '__main__':
    raise SystemExit(main())
