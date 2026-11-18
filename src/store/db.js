// Simple local store - IndexedDB fallback to localStorage
const KEY='dcr-cards-v1';
export function loadCards(){
  try{ return JSON.parse(localStorage.getItem(KEY)||'[]'); }catch{ return []; }
}
export function saveCards(list){ localStorage.setItem(KEY, JSON.stringify(list)); }
export function seedIfEmpty(){
  if(loadCards().length) return loadCards();
  const seed=[
    {id:'dcr-000001',game:'pokemon',name:'Charizard',setName:'Base Set',year:'1999',cardNumber:'#4',rarity:'R',gradeLabel:'GEM MT 10',certNumber:'01234567',status:'in-vault',buyPrice:3500,sellPrice:'',buyDate:'2026-01-10',soldDate:'',boughtFrom:'Bangkok Card Shop',soldTo:'',notes:'Top card',frontImage:'',backImage:''},
    {id:'dcr-000002',game:'pokemon',name:'Blastoise',setName:'Base Set',year:'1999',cardNumber:'#9',rarity:'R',gradeLabel:'GEM MT 9',certNumber:'01892344',status:'in-vault',buyPrice:1800,sellPrice:'',buyDate:'2026-01-12',soldDate:'',boughtFrom:'Chatuchak',soldTo:'',notes:'',frontImage:'',backImage:''},
    {id:'dcr-000003',game:'pokemon',name:'Pikachu',setName:'Base Set',year:'1999',cardNumber:'#25',rarity:'C',gradeLabel:'GEM MT 10',certNumber:'04451276',status:'for-sale',buyPrice:900,sellPrice:1500,buyDate:'2026-02-01',soldDate:'',boughtFrom:'Online',soldTo:'',notes:'',frontImage:'',backImage:''},
    {id:'dcr-000004',game:'pokemon',name:'Venusaur',setName:'Base Set',year:'1999',cardNumber:'#15',rarity:'R',gradeLabel:'GEM MT 9',certNumber:'02341298',status:'in-vault',buyPrice:1500,sellPrice:'',buyDate:'2026-02-05',soldDate:'',boughtFrom:'Friend',soldTo:'',notes:'',frontImage:'',backImage:''}
  ];
  saveCards(seed); return seed;
}
