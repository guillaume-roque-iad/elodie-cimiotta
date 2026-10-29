#!/usr/bin/env python3
"""Verify deployed sitemap URLs return direct HTTP 200; Python stdlib + curl."""
import concurrent.futures,subprocess,xml.etree.ElementTree as ET
BASE='https://team-lucky.com'
def check(url):
 r=subprocess.run(['curl','-sS','--max-time','25','-o','/dev/null','-w','%{http_code}\t%{redirect_url}',url],text=True,capture_output=True)
 if r.returncode:return url,'NETWORK_ERROR',r.stderr.strip()
 code,_,location=r.stdout.partition('\t');return url,int(code),location
if __name__=='__main__':
 r=subprocess.run(['curl','-fsS','--max-time','25',BASE+'/sitemap.xml'],capture_output=True,check=True)
 root=ET.fromstring(r.stdout);urls=[n.text for n in root.findall('{*}url/{*}loc')]
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  rows=[]
  for row in pool.map(check,urls):
   rows.append(row);print(row[1],row[0],row[2],flush=True)
 bad=[r for r in rows if r[1]!=200]
 print(f'{len(rows)-len(bad)}/{len(rows)} direct HTTP 200')
 raise SystemExit(bool(bad))
