#!/usr/bin/env python3
"""Generate sitemap from canonical and hreflang HTML metadata (Python stdlib).

Initial/content update: python3 scripts/generate_sitemap.py --modified YYYY-MM-DD
Routine CI: python3 scripts/generate_sitemap.py --check
A content fingerprint keeps lastmod stable when nothing changed. The date is
explicit rather than the checkout mtime or every build's date. Fail closed when
content changed without an editorial modification date.
"""
import argparse,hashlib,json,re,sys
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
BASE='https://team-lucky.com'
S='http://www.sitemaps.org/schemas/sitemap/0.9';X='http://www.w3.org/1999/xhtml'
class Metadata(HTMLParser):
 def __init__(self):super().__init__();self.canonical=[];self.alternates=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='link' and a.get('rel')=='canonical':self.canonical.append(a.get('href'))
  if tag=='link' and a.get('rel')=='alternate' and 'hreflang' in a:self.alternates.append((a['hreflang'],a.get('href')))
def generate(modified=None):
 manifest=ROOT/'seo/content-dates.json';state=json.loads(manifest.read_text()) if manifest.exists() else {};new={};pages={}
 for p in sorted(ROOT.rglob('*.html')):
  rel=p.relative_to(ROOT).as_posix()
  if rel=='404.html' or rel.startswith(('seo/','node_modules/','.git/')):continue
  raw=p.read_text();m=Metadata();m.feed(raw)
  if re.search(r'<meta\b[^>]*content=[\"\'][^\"\']*noindex',raw,re.I):continue
  expected=BASE+('/'+rel[:-10] if rel.endswith('index.html') else '/'+rel[:-5])
  if m.canonical!=[expected]:raise ValueError(f'{rel}: canonical {m.canonical}, expected {expected}')
  digest=hashlib.sha256(raw.encode()).hexdigest();old=state.get(rel,{})
  if old.get('sha256')==digest:lastmod=old['lastmod']
  elif modified:lastmod=modified
  else:raise ValueError(f'{rel}: content changed; supply --modified with actual editorial change date')
  date.fromisoformat(lastmod)
  if lastmod>date.today().isoformat():raise ValueError('Future lastmod: '+rel)
  new[rel]={'sha256':digest,'lastmod':lastmod};pages[expected]=(m,lastmod)
 for u,(m,_) in pages.items():
  if len(m.alternates)!=len(dict(m.alternates)):raise ValueError('Duplicate hreflang '+u)
  for lang,target in m.alternates:
   if target not in pages:raise ValueError('Missing alternate '+str(target))
   if dict(pages[target][0].alternates)!=dict(m.alternates):raise ValueError('Non-reciprocal hreflang '+u)
 ET.register_namespace('',S);ET.register_namespace('xhtml',X);root=ET.Element('{'+S+'}urlset')
 for u,(m,lastmod) in pages.items():
  n=ET.SubElement(root,'{'+S+'}url');ET.SubElement(n,'{'+S+'}loc').text=u;ET.SubElement(n,'{'+S+'}lastmod').text=lastmod
  for lang,target in m.alternates:ET.SubElement(n,'{'+X+'}link',rel='alternate',hreflang=lang,href=target)
 ET.indent(root,space='  ')
 return ET.tostring(root,encoding='utf-8',xml_declaration=True)+b'\n',json.dumps(new,ensure_ascii=False,indent=2)+'\n',len(pages)
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--modified');a.add_argument('--check',action='store_true');args=a.parse_args()
 try:
  xml,state,n=generate(args.modified)
  if args.check:
   if (ROOT/'sitemap.xml').read_bytes()!=xml:raise ValueError('sitemap.xml is out of date')
  else:(ROOT/'sitemap.xml').write_bytes(xml);(ROOT/'seo/content-dates.json').write_text(state)
  print(f'OK: {n} canonical URLs, reciprocal hreflang, stable lastmod')
 except (ValueError,KeyError) as e:print(e,file=sys.stderr);sys.exit(1)
