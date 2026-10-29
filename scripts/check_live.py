#!/usr/bin/env python3
"""Verify deployed sitemap URLs return direct HTTP 200, without following redirects."""
import concurrent.futures,urllib.request,urllib.error,xml.etree.ElementTree as ET
BASE='https://team-lucky.com'
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
def check(url):
 opener=urllib.request.build_opener(NoRedirect())
 try:
  with opener.open(urllib.request.Request(url,method='GET',headers={'User-Agent':'TeamLuckySEOCheck/1.0'}),timeout=25) as r:return url,r.status,r.headers.get('Location','')
 except urllib.error.HTTPError as e:return url,e.code,e.headers.get('Location','')
 except Exception as e:return url,str(e),''
if __name__=='__main__':
 with urllib.request.urlopen(BASE+'/sitemap.xml',timeout=25) as r:root=ET.fromstring(r.read())
 urls=[n.text for n in root.findall('{*}url/{*}loc')]
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:rows=list(pool.map(check,urls))
 for url,status,location in rows:print(status,url,location)
 bad=[r for r in rows if r[1]!=200]
 print(f'{len(rows)-len(bad)}/{len(rows)} direct HTTP 200')
 raise SystemExit(bool(bad))
