import sys,os,json,re,requests,bs4,collections,concurrent.futures,hashlib,io,datetime
from pathlib import Path
from urllib.parse import urljoin
from PIL import Image
here=Path('dcr-tag-70x20/catalog').resolve();sys.path.insert(0,str(here));import card_image_library as lib
from import_pokemon_tcg_images import download_image
out=here/'card-image-library';root=here/'research/missing-images-audit-2026-11-22';leads=json.loads((root/'image-leads.json').read_text(encoding='utf8'))['items'];job=root/('download-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'));job.mkdir(parents=True,exist_ok=False);db=lib.connect_index(out/'image-index.sqlite')
u='https://tcgjournal.de/en/cards/pokemon/30th-classic-collection/';r=requests.get(u,timeout=25);r.raise_for_status();s=bs4.BeautifulSoup(r.content,'html.parser');page={}
for img in s.select('img[alt][src]'):
 m=re.search(r'^(.*), card (\d{3}) from 30th Classic Collection$',img['alt'])
 if m:
  if m.group(2) in page:raise ValueError('Duplicate page ordinal')
  page[m.group(2)]=urljoin(u,img['src'])
if len(page)!=30:raise ValueError(f'Incomplete user-selected page: {len(page)}')
jobs=[];unsafe_terms=('multiple identity','illustrator not corroborated','illustrator unavailable','identity requires review','name differs','source set mapping requires review','numbering differs','manually mapped')
for item in leads:
 eligible=[l for l in item['leads'] if l.get('result')=='http_image']
 if item['language']=='en' and item['set_id']=='30th-c' and item['number'] in page:
  eligible.insert(0,{'source':'user-selected TCG Journal 30th collection','url':page[item['number']],'match':'user-selected page; ordinal from page','user_selected':True})
 rows=db.execute("select * from card_images where language=? and api_id=? and sha256 is null",(item['language'],item['card_id'])).fetchall()
 if len(rows)!=1 or not eligible:continue
 row=dict(rows[0]);safe_taken=False
 for index,lead in enumerate(eligible):
  evidence=lead.get('match','');safe=bool(lead.get('user_selected')) or (len(eligible)==1 and not any(term in evidence for term in unsafe_terms))
  if safe and not safe_taken:safe_taken=True;mode='library'
  else:mode='review'
  jobs.append({'row':row,'lead':lead,'mode':mode,'index':index})
print('job',job,'jobs',len(jobs),'modes',dict(collections.Counter(x['mode'] for x in jobs)),flush=True)
def task(x):
 try:
  row=x['row'];url=x['lead']['url']
  if x['mode']=='library':return x,download_image(row,url,out),None
  r=requests.get(url,timeout=(10,30),headers={'User-Agent':'DCR-Card-Vault/1.0'});r.raise_for_status()
  with Image.open(io.BytesIO(r.content)) as image:
   image.load();image.thumbnail((245,337),Image.Resampling.LANCZOS);buf=io.BytesIO();image.convert('RGB').save(buf,format='WEBP',quality=85)
  data=buf.getvalue();rel=Path('review')/row['language']/lib.safe_part(row['set_id'])/(lib.safe_part(row['api_id'])+'-'+str(x['index'])+'.webp');target=job/rel;target.parent.mkdir(parents=True,exist_ok=True)
  with target.open('xb') as f:f.write(data)
  return x,(rel.as_posix(),len(data),hashlib.sha256(data).hexdigest()),None
 except Exception as e:return x,None,f'{type(e).__name__}: {str(e)[:200]}'
results=[]
def flush():
 db.commit();old=json.loads((out/'manifest.json').read_text(encoding='utf8'));m=lib.library_summary(db,here/'cards.sqlite',out)
 for k in ('pokemon_tcg_data_commit','cardcorpus_commit','cardcorpus_release','latest_import_report'):
  if k in old:m[k]=old[k]
 lib.write_json(out/'manifest.json',m);lib.write_json(job/'report.json',{'source_report':str(root/'image-leads.json'),'user_selected_30th_page':u,'results':results})
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for x,data,error in pool.map(task,jobs):
  row=x['row'];lead=x['lead']
  if data and x['mode']=='library':
   path,size,sha,phash,w,h=data;source='tcgjournal_user_selected' if lead.get('user_selected') else ('cardcorpus' if lead['source']=='CardCorpus' else 'research_source');cur=db.execute("update card_images set status='downloaded',image_url_source=?,cached_image_url=?,image_path=?,bytes=?,sha256=?,phash=?,width=?,height=?,fetched_at_utc=?,http_status=200,error=NULL where source_path=? and language=? and sha256 is null",(source,lead['url'],path,size,sha,phash,w,h,lib.utc_now(),row['source_path'],row['language']));status='library' if cur.rowcount==1 else 'already_indexed';results.append({'id':row['api_id'],'language':row['language'],'status':status,'url':lead['url'],'path':path,'sha256':sha,'match':lead['match']})
  elif data:
   path,size,sha=data;results.append({'id':row['api_id'],'language':row['language'],'status':'review','url':lead['url'],'path':path,'sha256':sha,'match':lead['match'],'source_name':lead.get('source_name','')})
  else:results.append({'id':row['api_id'],'language':row['language'],'status':'failed','url':lead['url'],'error':error})
  if len(results)%50==0:flush();print('processed',len(results),'/',len(jobs),'status',dict(collections.Counter(v['status'] for v in results)),flush=True)
flush();print('RESULT',dict(collections.Counter(v['status'] for v in results)),'job',job,flush=True)
