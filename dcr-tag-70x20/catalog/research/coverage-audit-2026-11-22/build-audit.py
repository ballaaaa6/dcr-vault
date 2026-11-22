import sqlite3,zipfile,json,collections,unicodedata,re,hashlib,datetime
from pathlib import Path
root=Path('dcr-tag-70x20/catalog');out=root/'research/coverage-audit-2026-11-22';archive=Path('archive/source-packages/cardcorpus-dataset-2026-11-21.zip');z=zipfile.ZipFile(archive);prefix='cardcorpus-dataset-2026-11-21/v1/'
db=sqlite3.connect('file:dcr-tag-70x20/catalog/cards.sqlite?mode=ro',uri=True);db.row_factory=sqlite3.Row;db.execute("attach database 'file:dcr-tag-70x20/catalog/card-image-library/image-index.sqlite?mode=ro' as img")
norm=lambda x:re.sub(r'\s+','',unicodedata.normalize('NFKC',str(x or ''))).casefold()
def nk(x):
 x=norm(x).lstrip('#').split('/')[0]
 return str(int(x)) if x.isdigit() else x

def esc(x):return str(x or '').replace('|','\\|').replace('\n',' ')
summary=[]
for language,collection in [('en','english'),('ja','japanese'),('th','thai')]:
 rows=db.execute("""select l.*,c.api_id,c.illustrator,c.rarity,i.status image_status,i.image_path,i.sha256 from card_locales l join cards c on c.source_path=l.source_path left join img.card_images i on i.source_path=l.source_path and i.language=l.language where l.language=? order by l.set_id,l.local_id""",(language,)).fetchall()
 local=collections.defaultdict(list)
 for r in rows:local[r['set_id']].append(r)
 remote=json.loads(z.read(prefix+'sets/'+collection+'.json'))['sets'];nm=collections.defaultdict(set);code=collections.defaultdict(set)
 for sid,items in local.items():
  for item in items:
   if norm(item['set_name']):nm[norm(item['set_name'])].add(sid)
  code[norm(sid)].add(sid)
 candidates={}
 for s in remote:
  found=set()
  for n in (s.get('name'),s.get('englishName')):found|=nm.get(norm(n),set())
  method='exact_name'
  if not found and s.get('code'):found=code.get(norm(s['code']),set()).copy();method='exact_code'
  candidates[s['id']]=(found,method)
 inverse=collections.Counter(next(iter(v[0])) for v in candidates.values() if len(v[0])==1)
 mapped={s['id']:(next(iter(candidates[s['id']][0])),candidates[s['id']][1]) for s in remote if len(candidates[s['id']][0])==1 and inverse[next(iter(candidates[s['id']][0]))]==1}
 stats=collections.Counter();setlines=['# Set coverage: '+language,'','Snapshot: local catalog and image index; comparison CardCorpus release 2026-11-21. Pairings are automatic leads, not verified equivalence. Unmapped does not mean missing. Images are indexed status, not individually verified.','','## Local sets','', '| Local set ID | Set name | Catalog records | Images indexed | No image | Comparison set |','| --- | --- | ---: | ---: | ---: | --- |']
 reverse={v[0]:k for k,v in mapped.items()}
 for sid,items in sorted(local.items()):
  present=sum(bool(r['sha256']) for r in items);name=next((r['set_name'] for r in items if r['set_name']),'')
  setlines.append(f'| {esc(sid)} | {esc(name)} | {len(items)} | {present} | {len(items)-present} | {esc(reverse.get(sid,"unmapped - review"))} |')
 setlines+=['','## Reference sets (CardCorpus)','', '| Reference set | Name | Code | Reference records | Candidate local set | Pairing basis |','| --- | --- | --- | ---: | --- | --- |']
 cardlines=['# Reference cards requiring review: '+language,'','This is a lead list, not a confirmed list of missing real-world cards. Reference-only sets may overlap, subdivide releases or describe promotional distributions. Cards in mapped sets without a local collector-number match are candidates for missing data; name conflicts and ambiguous numbers require review. Image links are source URL candidates, not tested or approved for redistribution.','','| Reference set | Reference card ID | Printed number | Name | Local set | Finding | Source image candidate |','| --- | --- | --- | --- | --- | --- | --- |']
 image_lines=['# Local cards without indexed images: '+language,'','An absent indexed image is not proof no image exists. Source lead: [CardCorpus data](https://github.com/cardcorpus/pokemon-card-dataset), [TCGdex](https://tcgdex.dev/), official [Thai](https://asia.pokemon-card.com/th/card-search/), [Japanese](https://www.pokemon-card.com/card-search/), or [English](https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/) search as appropriate.','','| Local set | Card ID | Number | Name | Image status |','| --- | --- | --- | --- | --- |']
 for r in rows:
  if not r['sha256']:image_lines.append(f"| {esc(r['set_id'])} | {esc(r['api_id'])} | {esc(r['local_id'])} | {esc(r['card_name'])} | {esc(r['image_status'] or 'not indexed')} |")
 for s in remote:
  sid=s['id'];loc=mapped.get(sid); opts=candidates[sid][0]
  detail=loc[0] if loc else ('ambiguous: '+', '.join(sorted(opts)) if opts else 'unmapped - review')
  setlines.append(f"| {esc(sid)} | {esc(s.get('name'))} | {esc(s.get('code'))} | {s.get('cardCount',0)} | {esc(detail)} | {loc[1] if loc else 'unverified'} |")
  try:cards=json.loads(z.read(prefix+'sets/'+sid+'.json'))['cards']
  except (KeyError,ValueError):stats['source_file_missing']+=1;continue
  indexed=collections.defaultdict(list)
  if loc:
   for r in local[loc[0]]:indexed[nk(r['local_id'])].append(r)
  for card in cards:
   stats['reference_cards']+=1;number=card.get('number') or {};short=number.get('short') or card.get('id','');printed=number.get('printed') or short
   match=indexed.get(nk(short),[]) if loc and nk(short) else []
   if not loc:status='set not mapped - review';stats['unmapped_set_cards']+=1
   elif len(match)==0:status='no local number match - candidate missing data';stats['no_number_match']+=1
   elif len(match)>1:status='multiple local number matches - review';stats['multiple_number_matches']+=1
   elif norm(match[0]['card_name'])!=norm(card.get('name')):status='number match, name differs - review';stats['name_conflict']+=1
   else:stats['number_and_name_match']+=1;continue
   pic=(card.get('picture') or {}).get('front',{}).get('image','');link=f'https://img.cardcorpus.com/s1/240/{pic}.avif' if re.fullmatch('[0-9a-f]{32}',pic or '') else ''
   if link:stats['review_with_source_picture_id']+=1
   cardlines.append(f"| {esc(sid)} | {esc(card.get('id'))} | {esc(printed)} | {esc(card.get('name'))} | {esc(loc[0] if loc else '')} | {status} | {('[image]('+link+')') if link else 'not listed'} |")
 for name,lines in [('sets',setlines),('reference-review',cardlines),('local-missing-images',image_lines)]: (out/f'{language}-{name}.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
 summary.append({'language':language,'local_records':len(rows),'local_sets':len(local),'indexed_images':sum(bool(x['sha256']) for x in rows),'reference_sets':len(remote),'reference_set_pairs':len(mapped),'local_sets_paired':len(reverse),'comparison':dict(stats),'missing_set_name':sum(not x['set_name'] for x in rows),'missing_release_date':sum(not x['release_date'] for x in rows),'missing_illustrator':sum(not x['illustrator'] for x in rows),'missing_rarity':sum(not x['rarity'] or str(x['rarity']).strip().casefold() in ('none','null','undefined') for x in rows)})
 print(language,summary[-1],flush=True)
(out/'summary.json').write_text(json.dumps({'source_zip':'cardcorpus-dataset-2026-11-21.zip','source_zip_sha256':'9a32e343a18e43c293cbbff6a9a91f8e9c4784de5205e75fbbb86a64d900c95a','comparison_limitations':'automatic exact set-name or unique code leads; source-set subdivisions, translations, promos, variants and duplicates require review','languages':summary},ensure_ascii=False,indent=2),encoding='utf8')
