#!/usr/bin/env python3
"""Local SEO invariants. Requires lxml; pip install lxml."""
import json,re,subprocess
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit,unquote,urljoin
from lxml import html
from generate_sitemap import ROOT,BASE,generate
errors=[];count=0
for p in sorted(ROOT.rglob('*.html')):
 rel=p.relative_to(ROOT).as_posix()
 if rel.startswith(('seo/','node_modules/','.git/')):continue
 raw=p.read_text();s=html.fromstring(raw);count+=1
 lang=rel.split('/')[0] if rel.split('/')[0] in ['es','ca','pt','it','de','en'] else 'fr'
 if s.get('lang')!=lang:errors.append(rel+': html lang')
 for node in s.xpath('//script[@type="application/ld+json"]'):
  obj=json.loads(node.text)
  for n in obj.get('@graph',[obj]):
   if '@type' not in n:errors.append(rel+': missing @type')
   if n.get('@type')=='Article':
    for k in ['headline','datePublished','dateModified','inLanguage','author','publisher','mainEntityOfPage']:
     if not n.get(k):errors.append(rel+': Article '+k)
   if n.get('@type')=='FAQPage':
    visible=[' '.join(x.text_content().split()) for x in s.xpath('//section[@id="comprendre-simulateur"]//details')]
    for q in n['mainEntity']:
     if not any(q['name'] in x and q['acceptedAnswer']['text'] in x for x in visible):errors.append('FAQ differs from HTML')
 for tag,attr in [('a','href'),('iframe','src'),('script','src'),('link','href'),('img','src')]:
  for n in s.xpath('//'+tag+'[@'+attr+']'):
   v=n.get(attr);u=urlsplit(v)
   if u.scheme and u.scheme not in ['http','https'] or u.netloc and u.netloc!='team-lucky.com':continue
   if not u.path:continue
   path=unquote(u.path)
   if path.startswith('//'):continue
   if not path.startswith('/'):
    parent='/'+str(p.relative_to(ROOT).parent)+'/'
    path=urlsplit(urljoin(parent,path)).path
   target=ROOT/path.lstrip('/')
   if path.endswith('.html'):errors.append(rel+': redirecting .html '+v)
   exists=target.is_file() or path.endswith('/') and (target/'index.html').is_file() or not path.endswith('/') and Path(str(target)+'.html').is_file()
   if not exists:errors.append(rel+': missing/redirecting target '+v)
 for x in s.xpath('//article[@data-poa-start]'):
  if datetime.fromisoformat(x.get('data-poa-start'))<datetime.now().astimezone():errors.append(rel+': past session in upcoming cards')
 if 'meet.google.com/' in raw:errors.append(rel+': raw Meet URL')
 if rel in ['simulateur.html','preparer-mon-projet.html'] and s.xpath('//head/link[@hreflang]'):errors.append(rel+': fabricated alternates')
 # Existing noindex on the embedded simulator tool is preserved, never added.
 if 'noindex' in raw.lower() and rel not in ['404.html','simulateur-outil.html']:errors.append(rel+': unexpected noindex')
 # Compare forms and visual styles to pre-change Git revision when available.
 try:
  old=subprocess.check_output(['git','show','HEAD:'+rel],cwd=ROOT,stderr=subprocess.DEVNULL).decode();before=html.fromstring(old)
  for xp in ['//form','//style']:
   if [html.tostring(x,with_tail=False) for x in s.xpath(xp)]!=[html.tostring(x,with_tail=False) for x in before.xpath(xp)]:errors.append(rel+': modified '+xp)
 except subprocess.CalledProcessError:pass
xml,_,n=generate()
if (ROOT/'sitemap.xml').read_bytes()!=xml:errors.append('stale sitemap')
if errors:
 print('\n'.join(errors));raise SystemExit(1)
print(f'OK: {count} pages, {n} sitemap URLs; links, JSON-LD, FAQ parity, forms, styles, languages and sessions')
