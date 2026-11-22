import sys,json,re,requests,bs4,concurrent.futures,collections,unicodedata,time,threading
from pathlib import Path
from urllib.parse import urljoin,urlsplit
here=Path('dcr-tag-70x20/catalog').resolve();sys.path.insert(0,str(here));import card_image_library as lib
from import_pokemon_tcg_images import download_image
out=here/'card-image-library';report=here/'research/image-gap-2026-11-22';db=lib.connect_index(out/'image-index.sqlite'); rows=[dict(x) for x in db.execute("select * from card_images where language='th' and status='http_404' order by set_id,local_id")];print('candidates',len(rows),flush=True)
def norm(s):return re.sub(r'\s+','',unicodedata.normalize('NFKC',s or ''))
def task(row):
 try:
  time.sleep(.2);r=requests.get('https://asia.pokemon-card.com/th/card-search/list/',params={'keyword':row['card_name']},timeout=20);r.raise_for_status();s=bs4.BeautifulSoup(r.content,'html.parser');links=list(dict.fromkeys(urljoin(r.url,a['href']) for a in s.select('a[href*="/card-search/detail/"]')))
  if len(links)>10:return row,None,None,'too many candidates'
  found=[]
  for page in links:
   time.sleep(.1);q=requests.get(page,timeout=20);q.raise_for_status();p=bs4.BeautifulSoup(q.content,'html.parser');h=p.select_one('h1.cardDetail')
   if not h:continue
   for z in h.select('.evolveMarker'):z.decompose()
   if norm(h.get_text())!=norm(row['card_name']):continue
   mark=[x.get('src','') for x in p.select('img[src*="/card-img/mark/"]')];txt=p.get_text(' ',strip=True)
   if not any(re.search(r'/'+re.escape(row['set_id'])+r'(?:_|@|\.)',m,re.I) for m in mark) or not re.search(r'(?<!\d)0*'+re.escape(str(int(row['local_id'])))+r'/\d+',txt):continue
   images=[x.get('src','') for x in p.select('img[src*="/card-img/th"]') if '/mark/' not in x.get('src','')];images=[x for x in images if urlsplit(x).hostname=='asia.pokemon-card.com']
   if len(images)==1:found.append((page,images[0]))
  if len(found)!=1:return row,None,None,'no unique exact match'
  page,url=found[0];return row,page,(url,download_image(row,url,out)),None
 except Exception as e:return row,None,None,str(e)[:200]
results=[];old=json.loads((out/'manifest.json').read_text(encoding='utf8'))
def flush():
 db.commit();m=lib.library_summary(db,here/'cards.sqlite',out)
 for k in ('pokemon_tcg_data_commit','cardcorpus_commit','cardcorpus_release','latest_import_report'):
  if k in old:m[k]=old[k]
 lib.write_json(out/'manifest.json',m);lib.write_json(report/'import-th-all-2026-11-22.json',{'results':results})
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for row,page,result,error in pool.map(task,rows):
  if result:
   url,data=result;path,size,sha,phash,w,h=data;db.execute("update card_images set status='downloaded',image_url_source='pokemon_asia_th',cached_image_url=?,image_path=?,bytes=?,sha256=?,phash=?,width=?,height=?,fetched_at_utc=?,http_status=200,error=NULL where source_path=? and language='th' and status='http_404'",(url,path,size,sha,phash,w,h,lib.utc_now(),row['source_path']));results.append({'id':row['api_id'],'status':'downloaded','page':page,'url':url,'path':path,'sha256':sha})
  else:results.append({'id':row['api_id'],'status':'unresolved','reason':error})
  if len(results)%25==0:flush();print('processed',len(results),'/',len(rows),'downloaded',sum(x['status']=='downloaded' for x in results),flush=True)
flush();print('RESULT',collections.Counter(x['status'] for x in results),flush=True)
