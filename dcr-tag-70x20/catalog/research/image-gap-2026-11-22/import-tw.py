import sys,json,collections,concurrent.futures,time
from pathlib import Path
from urllib.parse import urlsplit
here=Path('dcr-tag-70x20/catalog').resolve();sys.path.insert(0,str(here));import card_image_library as lib
from import_pokemon_tcg_images import download_image
out=here/'card-image-library';report=here/'research/image-gap-2026-11-22';db=lib.connect_index(out/'image-index.sqlite');cand=json.loads((report/'ptcg-database-candidates.json').read_text(encoding='utf8'));jobs=[]
for x in cand:
 rows=db.execute("select * from card_images where language=? and api_id=? and status='http_404'",(x['language'],x['id'])).fetchall()
 if len(rows)==1 and urlsplit(x['url']).hostname=='asia.pokemon-card.com' and urlsplit(x['url']).path.startswith('/tw/card-img/tw'):jobs.append((dict(rows[0]),x))
print('candidates',len(jobs),flush=True)
def task(job):
 try:time.sleep(.2);return job,download_image(job[0],job[1]['url'],out),None
 except Exception as e:return job,None,str(e)[:200]
results=[]
def flush():
 db.commit();old=json.loads((out/'manifest.json').read_text(encoding='utf8'));m=lib.library_summary(db,here/'cards.sqlite',out)
 for k in ('pokemon_tcg_data_commit','cardcorpus_commit','cardcorpus_release','latest_import_report'):
  if k in old:m[k]=old[k]
 lib.write_json(out/'manifest.json',m);lib.write_json(report/'import-tw-2026-11-22.json',{'results':results})
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for (row,item),data,error in pool.map(task,jobs):
  if data:
   path,size,sha,phash,w,h=data;db.execute("update card_images set status='downloaded',image_url_source='pokemon_asia_tw',cached_image_url=?,image_path=?,bytes=?,sha256=?,phash=?,width=?,height=?,fetched_at_utc=?,http_status=200,error=NULL where source_path=? and language=? and status='http_404'",(item['url'],path,size,sha,phash,w,h,lib.utc_now(),row['source_path'],row['language']));db.commit();results.append({'id':row['api_id'],'status':'downloaded','url':item['url'],'page':item['page'],'path':path,'sha256':sha})
  else:results.append({'id':row['api_id'],'status':'failed','error':error})
  if len(results)%50==0:flush();print('processed',len(results),'/',len(jobs),'downloaded',sum(x['status']=='downloaded' for x in results),flush=True)
flush();print('RESULT',collections.Counter(x['status'] for x in results),flush=True)
