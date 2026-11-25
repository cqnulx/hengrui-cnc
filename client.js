import { serviceOffline, t, visitorRequest } from './site-api.js';

const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#nav');
const drop = document.querySelector('.drop-toggle');
const serviceNav = document.querySelector('#services-nav');
const languageMenu = document.querySelector('.language-menu');
const languageButton = languageMenu.querySelector('summary');
const languageLinks = [...languageMenu.querySelectorAll('a[data-language-link]')].map(link => [link,link.pathname]);

function updateLanguageLinks() {
  for (const [link,path] of languageLinks) link.href = path + location.search + location.hash;
}
updateLanguageLinks();
window.addEventListener('hashchange', updateLanguageLinks);
window.addEventListener('popstate', updateLanguageLinks);
languageMenu.addEventListener('toggle', () => {
  if (languageMenu.open) {
    updateLanguageLinks();
    setMenu(false);
    setDrop(false);
  }
});

function setMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', t(open ? '关闭主菜单' : '打开主菜单'));
  nav.classList.toggle('open', open);
}
let dropPinned = false;
function setDrop(open, pinned = false) {
  dropPinned = open && pinned;
  drop.setAttribute('aria-expanded', String(open));
  drop.setAttribute('aria-label', t(open ? '收起加工服务' : '展开加工服务'));
  serviceNav.hidden = !open;
}
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  if (open) languageMenu.open = false;
  setMenu(open);
  if (!open) setDrop(false);
});
drop.addEventListener('click', () => setDrop(!dropPinned, true));
const serviceMenu = drop.closest('.nav-service');
const desktopMenu = matchMedia('(min-width: 1101px) and (hover: hover)');
serviceMenu.addEventListener('pointerenter', () => {
  if (desktopMenu.matches && serviceNav.hidden) setDrop(true);
});
serviceMenu.addEventListener('pointerleave', () => {
  if (desktopMenu.matches && !dropPinned && !serviceMenu.contains(document.activeElement)) setDrop(false);
});
serviceMenu.addEventListener('focusout', event => {
  if (desktopMenu.matches && !serviceMenu.contains(event.relatedTarget)) setDrop(false);
});
document.addEventListener('click', event => {
  if (!event.target.closest('.nav-service')) setDrop(false);
  if (!languageMenu.contains(event.target)) languageMenu.open = false;
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (languageMenu.open) {
    languageMenu.open = false;
    languageButton.focus();
  } else if (!serviceNav.hidden) {
    setDrop(false);
    drop.focus();
  } else if (nav.classList.contains('open') && getComputedStyle(menu).display !== 'none') {
    setMenu(false);
    menu.focus();
  }
});

const cookiePanel = document.querySelector('#cookie-panel');
const cookieOptions = document.querySelector('#cookie-options');
const mapConsent = document.querySelector('#map-consent');
const customize = cookiePanel.querySelector('[data-cookie-customize]');
const maps = document.querySelectorAll('[data-map-src]');
const consentKey = 'hengrui-consent-v1';
let currentConsent = '';
try { currentConsent = localStorage.getItem(consentKey) || ''; } catch {}
function renderMaps() {
  for (const map of maps) {
    const active = map.querySelector('iframe');
    if (currentConsent === 'all' && !active) {
      const frame = document.createElement('iframe');
      frame.src = map.dataset.mapSrc;
      frame.title = map.dataset.mapTitle;
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer';
      for (const node of map.children) node.hidden = true;
      map.append(frame);
    } else if (currentConsent !== 'all' && active) {
      active.remove();
      for (const node of map.children) node.hidden = false;
    }
  }
}
renderMaps();
if (!currentConsent) cookiePanel.show();
function showCustomization(show) {
  cookieOptions.hidden = !show;
  customize.setAttribute('aria-expanded', String(show));
  if (show && mapConsent) {
    mapConsent.checked = currentConsent === 'all';
    mapConsent.focus();
  }
}
function saveConsent(consent) {
  currentConsent = consent;
  try { localStorage.setItem(consentKey, consent); } catch {}
  renderMaps();
  cookiePanel.close();
}
document.querySelectorAll('[data-cookie-settings]').forEach(button => {
  button.addEventListener('click', () => {
    if (cookiePanel.open) cookiePanel.close();
    cookiePanel.showModal();
    showCustomization(true);
  });
});
customize.addEventListener('click', () => showCustomization(cookieOptions.hidden));
cookiePanel.querySelector('[data-save-consent]').addEventListener('click', () => {
  saveConsent(mapConsent?.checked ? 'all' : 'essential');
});
cookiePanel.querySelectorAll('[data-consent]').forEach(button => {
  button.addEventListener('click', () => saveConsent(button.dataset.consent));
});

const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const heroVideo = document.querySelector('#hero-video');
if (heroVideo) {
  const toggle = document.querySelector('[data-video-toggle]');
  let playRequested = !motionPreference.matches;
  async function updateVideo() {
    if (!playRequested || document.hidden) {
      heroVideo.pause();
      return;
    }
    if (!heroVideo.hasAttribute('src')) heroVideo.src = heroVideo.dataset.videoSrc;
    try {
      await heroVideo.play();
    } catch {
      if (!document.hidden) toggle.textContent = t('播放背景');
    }
  }
  heroVideo.addEventListener('playing', () => {
    heroVideo.classList.add('playing-video');
    toggle.textContent = t('暂停背景');
  });
  heroVideo.addEventListener('pause', () => { toggle.textContent = t('播放背景'); });
  heroVideo.addEventListener('error', () => {
    heroVideo.classList.remove('playing-video');
    toggle.hidden = true;
  });
  toggle.addEventListener('click', () => {
    playRequested = heroVideo.paused;
    void updateVideo();
  });
  motionPreference.addEventListener('change', event => {
    playRequested = !event.matches;
    void updateVideo();
  });
  document.addEventListener('visibilitychange', updateVideo);
  toggle.hidden = false;
  void updateVideo();
}

if (!motionPreference.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const node = entry.target;
      const target = Number(node.dataset.count);
      let start;
      const tick = now => {
        start ??= now;
        const progress = Math.min(1, (now - start) / 720);
        node.textContent = String(Math.round(target * (1 - (1 - progress) ** 3)));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      observer.unobserve(node);
    }
  }, {threshold:.4});
  document.querySelectorAll('[data-count]').forEach(node => observer.observe(node));
}

const filters = document.querySelectorAll('[data-filter]');
const machines = document.querySelectorAll('[data-machine]');
for (const filter of filters) {
  filter.addEventListener('click', () => {
    filters.forEach(button => button.setAttribute('aria-pressed', String(button === filter)));
    for (const group of machines) {
      group.hidden = filter.dataset.filter !== 'all' && filter.dataset.filter !== group.dataset.machine;
    }
  });
}

const form = document.querySelector('[data-lead-form]');
form?.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = form.querySelector('button[type=submit]');
  const result = form.querySelector('.form-result');
  if (serviceOffline) {
    result.dataset.error = 'true';
    result.textContent = t('在线提交暂未接通，请通过联系页的微信二维码与我们沟通。');
    return;
  }
  result.textContent = t('正在提交…');
  result.removeAttribute('data-error');
  form.querySelectorAll('.field-error').forEach(error => { error.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach(input => input.removeAttribute('aria-invalid'));
  submit.disabled = true;
  try {
    const response = await visitorRequest('/api/' + form.dataset.leadForm, {
      method: 'POST',
      body: new URLSearchParams(new FormData(form)),
      headers: { Accept: 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) {
      let invalid = null;
      for (const [name, message] of Object.entries(data.errors || {})) {
        const input = form.elements.namedItem(name);
        const fieldError = document.getElementById(name + '-error');
        if (input && fieldError) {
          input.setAttribute('aria-invalid','true');
          fieldError.textContent = t(message);
          invalid ||= input;
        }
      }
      result.dataset.error = 'true';
      result.textContent = t(data.message,'请检查表单并重试。');
      invalid?.focus();
    } else {
      form.reset();
      result.textContent = t('提交成功。受理编号') + ' ' + data.reference;
    }
  } catch {
    result.dataset.error = 'true';
    result.textContent = t('暂时无法提交，请稍后重试。');
  } finally {
    submit.disabled = false;
  }
});
if (form) form.querySelector('button[type=submit]').disabled = false;

