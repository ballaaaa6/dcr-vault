// Header - RED + WHITE only, real DCR logo only
export function header(active){
  const items=[['#/','Home'],['#/search','Search Cards'],['#/vault','My Vault'],['#/label','Label']];
  return `<header class="header no-print"><div class="wrap header-in"><a class="logo-wrap" href="#/"><img class="logo" src="/assets/logo/dcr-mark.svg" alt="DCR Logo"><span>DCR Card Vault</span></a><nav class="nav">${items.map(([h,l])=>`<a href="${h}" class="${location.hash.replace('#','')===h.replace('#','')||(h==='#/'&&location.hash==='' )?'active':''}">${l}</a>`).join('')}</nav><a href="#/login" style="margin-left:auto;font-weight:600;color:var(--dcr-red)">Account</a></div></header><nav class="bottom-nav no-print">${items.map(([h,l])=>`<a href="${h}">${l}</a>`).join('')}</nav>`;
}
