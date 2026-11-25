import { languages, normalizeLanguage, translateInterface } from './i18n.js';

const settings = document.documentElement.dataset;
export const published = settings.service === 'pages';
export const backend = settings.backend || '';
export const serviceOffline = published && !backend;
const basePath = settings.siteBase || '';
export const language = normalizeLanguage(document.documentElement.lang.split('-')[0]);
const languagePrefix = languages[language].prefix;
export const t = (key, fallback) => translateInterface(language,key,fallback);
let visitor;

function visitorToken() {
  if (visitor) return visitor;
  const key = 'hengrui-visitor' + basePath;
  try { visitor = localStorage.getItem(key); } catch {}
  if (!/^[a-f0-9]{64}$/.test(visitor || '')) {
    visitor = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2,'0')).join('');
    try { localStorage.setItem(key,visitor); } catch {}
  }
  return visitor;
}

export function visitorRequest(path, options = {}) {
  if (!published) return fetch(path,options);
  if (serviceOffline) return Promise.reject(new Error('在线服务暂未接通。'));
  const headers = new Headers(options.headers);
  headers.set('X-CNC-Visitor',visitorToken());
  return fetch(backend + path,{...options,headers,credentials:'omit',redirect:'error'});
}

export function frontendPath(path) {
  return basePath + languagePrefix + path;
}

export function currentPage() {
  const path = location.pathname.slice(basePath.length + languagePrefix.length) || '/';
  return path.endsWith('/index.html') ? path.slice(0,-10) : path;
}
