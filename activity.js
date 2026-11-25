import { currentPage, published, serviceOffline, visitorRequest } from './site-api.js';

const page = currentPage();
const endpoint = '/api/visitor/activity';

function track(fields) {
  if (serviceOffline) return;
  if (!published && navigator.sendBeacon(endpoint,fields)) return;
  visitorRequest(endpoint,{method:'POST',body:fields,keepalive:true}).catch(() => {});
}

if (published) track(new URLSearchParams({kind:'page',page}));

document.addEventListener('click', event => {
  if (!event.isTrusted || !(event.target instanceof Element)) return;
  const target = event.target.closest('a, button, summary');
  if (!target || target.closest('.chat-message') && !target.matches('[data-chat-transfer], .chat-sources a')) return;
  const label = (target.getAttribute('aria-label') || target.textContent).replace(/\s+/g,' ').trim().slice(0,120);
  if (!label) return;
  track(new URLSearchParams({page,label}));
});
