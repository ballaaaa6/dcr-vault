// Cert helpers - English only
export function isValidCert(c){ return /^\d{7,8}$/.test(String(c).trim()); }
export function makeCert(){ return String(Math.floor(10000000 + Math.random()*89999999)); }
