import {loadCards, saveCards, seedIfEmpty} from './db.js';
export function getCards(){ return seedIfEmpty(); }
export function findByCert(cert){ return getCards().find(c=>String(c.certNumber)===String(cert).trim()); }
export function addCard(card){ const list=getCards(); list.unshift(card); saveCards(list); return card; }
export function updateCard(id, patch){ const list=getCards(); const i=list.findIndex(c=>c.id===id); if(i>=0){ list[i]={...list[i],...patch, updatedAt:Date.now()}; saveCards(list);} }
