import zipfile,json,sqlite3,re,unicodedata,collections
from pathlib import Path
root=Path('dcr-tag-70x20/catalog/research/missing-images-audit-2026-11-22');z=zipfile.ZipFile('archive/source-packages/cardcorpus-dataset-2026-11-21.zip');base='cardcorpus-dataset-2026-11-21/v1/';p=zipfile.ZipFile('archive/source-packages/ptcg-database-18e0de2feb7a35ebe4296ede0ba6cc768961489b.zip');pbase='PTCG-database-18e0de2feb7a35ebe4296ede0ba6cc768961489b/'
norm=lambda s:re.sub(r'\s+','',unicodedata.normalize('NFKC',str(s or ''))).casefold()
def nk(s):
 s=norm(s).split('/')[0].lstrip('#')
 return str(int(s)) if s.isdigit() else s
c=sqlite3.connect('file:dcr-tag-70x20/catalog/card-image-library/image-index.sqlite?mode=ro',uri=True);c.row_factory=sqlite3.Row;c.execute("attach database 'file:dcr-tag-70x20/catalog/cards.sqlite?mode=ro' as cat")
rows=c.execute("select i.*,l.set_name,c.raw_json from card_images i join cat.cards c on c.source_path=i.source_path left join cat.card_locales l on l.source_path=i.source_path and l.language=i.language where i.language in ('th','ja','en') and i.sha256 is null order by i.language,i.set_id,i.local_id").fetchall();results={}
for r in rows:results[(r['language'],r['api_id'])]={'language':r['language'],'card_id':r['api_id'],'set_id':r['set_id'],'set_name':r['set_name'] or '', 'number':r['local_id'],'name':r['card_name'],'prior_status':r['status'],'leads':[]}
# Match Japanese historical releases by known set names. Ordinals in local database are not printed collector numbers.
alias={'PMCG1':'japanese/expansion-pack-base-set','PMCG2':'japanese/pokemon-jungle','PMCG3':'japanese/mystery-of-the-fossils','PMCG4':'japanese/rocket-gang','PMCG5':'japanese/leader-s-stadium-gym-heroes','PMCG6':'japanese/challenge-from-the-darkness-gym-challenge','neo1':'japanese/gold-silver-to-a-new-world-neo-genesis','neo2':'japanese/crossing-the-ruins-neo-discovery','neo3':'japanese/awakening-legends-neo-revelation','neo4':'japanese/darkness-and-to-light-neo-destiny'}
cache={}
for row in rows:
 if row['language']!='ja' or row['set_id'] not in alias:continue
 sid=alias[row['set_id']]
 if sid not in cache:cache[sid]=json.loads(z.read(base+'sets/'+sid+'.json'))['cards']
 src=json.loads(row['raw_json']);dex=set(src.get('dexId') or []);artist=norm(src.get('illustrator'));name=norm(row['card_name']);opts=[]
 for x in cache[sid]:
  species={i.get('id') for i in x.get('species',[]) if i.get('id') is not None};credit=norm(x.get('credit'));xname=norm(x.get('name'))
  if dex and species and dex!=species:continue
  if artist and credit and artist!=credit:continue
  if not ((dex and species and dex==species and artist and credit and artist==credit) or (name and name==xname and artist and credit and artist==credit)):continue
  picture=(x.get('picture') or {}).get('front',{}).get('image','')
  if re.fullmatch('[0-9a-f]{32}',picture or ''):opts.append((x,picture))
 for x,pic in opts:
  results[('ja',row['api_id'])]['leads'].append({'source':'CardCorpus','source_set':sid,'source_card':x.get('id'),'source_name':x.get('name'),'source_number':(x.get('number') or {}).get('printed'),'url':'https://img.cardcorpus.com/s1/240/'+pic+'.avif','match':'unique species/name and illustrator' if len(opts)==1 else 'multiple identity candidates; review','status':'untested'})
# PTCG-database English metadata, require exact set name, card number, and name.
missing=[r for r in rows if r['language']=='en'];wanted=collections.defaultdict(list)
for r in missing:wanted[(norm(r['set_name']),nk(r['local_id']),norm(r['card_name']))].append(r)
prefix=pbase+'data_en/'
for f in p.namelist():
 if not f.startswith(prefix) or not f.endswith('.json'):continue
 try:x=json.loads(p.read(f))
 except (ValueError,KeyError):continue
 key=(norm(x.get('set_full_name')),nk(x.get('number')),norm(x.get('name')))
 if key not in wanted:continue
 url=x.get('img','')
 if not url.startswith('https://'):continue
 for row in wanted[key]:results[('en',row['api_id'])]['leads'].append({'source':'PTCG-database / '+str(x.get('url','')),'source_set':x.get('set_full_name'),'source_card':x.get('number'),'url':url,'match':'exact set name, number and name; print check needed','status':'untested'})
# Pocket dataset provides English source and number mapping.
for row in missing:
 if row['set_id']!='B2a':continue
 try:x=json.loads(p.read(pbase+'data_pocket/B2a/'+str(int(row['local_id']))+'.json'))
 except (ValueError,KeyError):continue
 url=x.get('img','')
 if norm(row['card_name'])==norm(x.get('name')) and x.get('set_code')=='B2a' and url.endswith('_EN_SM.webp'):
  results[('en',row['api_id'])]['leads'].append({'source':'Limitless TCG Pocket','source_set':'B2a','source_card':x.get('number'),'url':url,'match':'exact set, number and name; print check needed','status':'untested'})
# Thai official detail was confirmed in previous work, but its image URL returned an empty body.
if ('th','S5a-012') in results:results[('th','S5a-012')]['leads'].append({'source':'Official Thai','page':'https://asia.pokemon-card.com/th/card-search/detail/1190/','url':'https://asia.pokemon-card.com/th/card-img/th00001190.png','match':'name, HP, attacks and number match','status':'previously 200 with empty body'})
items=list(results.values());(root/'image-leads.json').write_text(json.dumps({'source_cardcorpus':'2026-11-21','source_ptcg_database':'18e0de2feb7a35ebe4296ede0ba6cc768961489b','items':items},ensure_ascii=False,indent=2),encoding='utf8')
print('cards',len(items),'with leads',collections.Counter(x['language'] for x in items if x['leads']),'total leads',sum(len(x['leads']) for x in items))
