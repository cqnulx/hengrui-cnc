import { backend, published } from './site-api.js';

const desk = document.querySelector('#support-desk');
const find = id => desk.querySelector('#desk-' + id);
const filter = find('filter');
const groups = find('groups');
const profiles = find('profiles');
const detail = find('detail');
const events = find('events');
const reply = find('reply');
const message = find('message');
const finish = find('close');
const feedback = find('status');
const more = find('more');
const groupPages = find('group-pages');
const profilePages = find('profile-pages');
const login = find('login');
const logout = find('logout');
let authorization = '';
const modes = {ai:'网站助手',waiting:'等待人工',human:'人工接待中'};
const labels = {page:'浏览页面',click:'点击',lead:'表单提交',visitor:'访客',assistant:'网站助手',agent:'人工客服',system:'接待状态'};
const chatKinds = new Set(['visitor','assistant','agent','system']);
const clock = new Intl.DateTimeFormat('zh-CN',{dateStyle:'short',timeStyle:'medium'});
const formatTime = value => clock.format(new Date(value));

let search = '';
let mode = 'all';
let selectedIp = '';
let selectedId = '';
let view = 'chat';
let groupOffset = 0;
let profileOffset = 0;
let olderCursor = 0;
let hasOlder = false;
let refreshJob;
let sending = false;
const archive = new Map();
const signatures = new WeakMap();

function node(tag, text = '', className = '') {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}

async function request(path, fields) {
  const options = {headers:{Accept:'application/json'},signal:AbortSignal.timeout(8000)};
  if (fields) Object.assign(options,{method:'POST',body:new URLSearchParams(fields)});
  if (published) {
    options.headers.Authorization = authorization;
    options.credentials = 'omit';
    options.redirect = 'error';
  }
  const response = await fetch(backend + '/admin/support/' + path,options);
  if (response.status === 401) throw new Error('账号或密码不正确。');
  if (response.status === 429) throw new Error('操作过于频繁，请稍后再试。');
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || '客服工作台暂时不可用。');
  }
  return response.json();
}

const data = params => request('data?' + new URLSearchParams(params));

function renderChoices(parent, signature, records, render, empty) {
  if (signatures.get(parent) === signature) return;
  signatures.set(parent,signature);
  parent.replaceChildren(...(records.length ? records.map(render) : [node('p',empty,'desk-empty')]));
}

function choice(title, meta, active, select) {
  const button = node('button','','desk-choice');
  button.type = 'button';
  button.setAttribute('aria-pressed',String(active));
  button.append(node('strong',title),node('small',meta));
  button.addEventListener('click',select);
  return button;
}

function updatePages(parent, offset, hasMore) {
  parent.hidden = !offset && !hasMore;
  parent.querySelector('[data-step="-1"]').disabled = !offset;
  parent.querySelector('[data-step="1"]').disabled = !hasMore;
}

async function loadGroups() {
  const offset = groupOffset;
  const query = {search,mode,offset};
  const result = await data(query);
  if (groupOffset !== offset || search !== query.search || mode !== query.mode) return;
  renderChoices(groups,JSON.stringify([selectedIp,result.groups]),result.groups,(group) => {
    const summary = [`${group.browsers} 个档案`];
    if (group.waiting) summary.push(`${group.waiting} 等待人工`);
    if (group.active) summary.push(`${group.active} 接待中`);
    return choice(group.ip,summary.join(' · '),selectedIp === group.ip,() => {
      selectedIp = group.ip;
      profileOffset = 0;
      chooseProfile('');
      refresh(true);
    });
  },'没有符合条件的访客。');
  updatePages(groupPages,offset,result.more);
}

async function loadProfiles() {
  profiles.hidden = !selectedIp;
  if (!selectedIp) {
    profilePages.hidden = true;
    return;
  }
  const ip = selectedIp;
  const offset = profileOffset;
  const result = await data({ip,offset});
  if (ip !== selectedIp || offset !== profileOffset) return;
  renderChoices(profiles,JSON.stringify([selectedId,result.profiles]),result.profiles,profile =>
    choice('浏览器 ' + profile.id.slice(0,8),`${modes[profile.mode]} · ${formatTime(profile.last_seen)}`,
      selectedId === profile.id,() => {
        chooseProfile(profile.id);
        refresh(true);
      }), '该 IP 下没有访客。');
  updatePages(profilePages,offset,result.more);
}

function chooseProfile(id) {
  selectedId = id;
  olderCursor = 0;
  hasOlder = false;
  archive.clear();
  events.replaceChildren();
  detail.hidden = true;
  finish.hidden = true;
  find('visitor').textContent = id ? '正在加载访客…' : '访客详情';
  find('meta').textContent = id ? '' : '请选择一个浏览器档案。';
  message.value = '';
  feedback.textContent = '';
}

function renderEvents() {
  const list = [...archive.values()].filter(entry => view === 'timeline' || chatKinds.has(entry.kind));
  list.sort((a,b) => view === 'chat' ? a.id-b.id : b.id-a.id);
  renderChoices(events,JSON.stringify([view,list.map(entry=>entry.id)]),list,entry => {
    const item = node('li','','desk-event desk-event-' + entry.kind);
    const heading = node('div','','desk-event-label');
    heading.append(node('strong',labels[entry.kind]),node('time',formatTime(entry.at)));
    item.append(heading);
    if (entry.page) item.append(node('small',entry.page));
    const content = entry.reply ? [entry.reply.site,entry.reply.general,entry.reply.outside,entry.reply.handoff].filter(Boolean).join('\n\n') : entry.text;
    if (content) item.append(node('p',content));
    return item;
  },view === 'chat' ? '没有聊天消息。' : '没有访问记录。');
  more.hidden = !hasOlder;
}

async function loadDetail(older = false) {
  const id = selectedId;
  if (!id) return;
  const result = await data({id,...(older ? {before:olderCursor} : {})});
  if (id !== selectedId) return;
  const visitor = result.visitor;
  const atBottom = events.scrollHeight - events.scrollTop - events.clientHeight < 40;
  const previousHeight = events.scrollHeight;
  if (older || !olderCursor || (result.events.at(-1)?.id || 0) < olderCursor) {
    olderCursor = result.events.at(-1)?.id || olderCursor;
    hasOlder = result.more;
  }
  for (const entry of result.events) archive.set(entry.id,entry);
  find('visitor').textContent = `${visitor.ip} · ${visitor.id.slice(0,8)}`;
  find('meta').textContent = `${modes[visitor.mode]} · 首次 ${formatTime(visitor.first_seen)} · 最近 ${formatTime(visitor.last_seen)}`;
  detail.hidden = false;
  reply.hidden = visitor.mode === 'ai';
  finish.hidden = visitor.mode === 'ai';
  renderEvents();
  if (view === 'chat') {
    if (older) events.scrollTop += events.scrollHeight - previousHeight;
    else if (atBottom || !previousHeight) events.scrollTop = events.scrollHeight;
  }
}

async function refresh(again = false) {
  if (refreshJob) {
    if (again) { await refreshJob; return refresh(); }
    return;
  }
  refreshJob = Promise.all([loadGroups(),loadProfiles(),loadDetail()]).catch(error => {
    feedback.textContent = error.message;
  });
  try { await refreshJob; } finally { refreshJob = undefined; }
}

filter.addEventListener('submit',event => {
  event.preventDefault();
  search = filter.elements.search.value.trim();
  mode = filter.elements.mode.value;
  groupOffset = 0;
  refresh(true);
});
filter.elements.mode.addEventListener('change',() => filter.requestSubmit());
groupPages.addEventListener('click',event => {
  const step = Number(event.target.dataset.step);
  if (!step) return;
  groupOffset = Math.max(0,groupOffset + step*25);
  refresh(true);
});
profilePages.addEventListener('click',event => {
  const step = Number(event.target.dataset.step);
  if (!step) return;
  profileOffset = Math.max(0,profileOffset + step*25);
  refresh(true);
});

for (const button of desk.querySelectorAll('[data-view]')) {
  button.addEventListener('click',() => {
    view = button.dataset.view;
    for (const candidate of desk.querySelectorAll('[data-view]')) candidate.setAttribute('aria-pressed',String(candidate === button));
    renderEvents();
    events.scrollTop = view === 'chat' ? events.scrollHeight : 0;
  });
}
more.addEventListener('click',async () => {
  more.disabled = true;
  try { await loadDetail(true); } catch (error) { feedback.textContent = error.message; } finally { more.disabled = false; }
});

async function action(type) {
  if (!selectedId || sending) return;
  const text = message.value.trim();
  if (type === 'reply' && !text) return;
  const id = selectedId;
  sending = true;
  finish.disabled = true;
  reply.querySelector('button').disabled = true;
  try {
    await request('action',{id,action:type,message:text});
    if (id === selectedId) {
      if (type === 'reply' && message.value.trim() === text) message.value = '';
      feedback.textContent = type === 'reply' ? '消息已发送。' : '人工接待已结束。';
    }
    await refresh(true);
  } catch (error) {
    feedback.textContent = error.message;
  } finally {
    sending = false;
    finish.disabled = false;
    reply.querySelector('button').disabled = false;
  }
}
reply.addEventListener('submit',event => {event.preventDefault(); action('reply');});
finish.addEventListener('click',() => action('close'));

if (login) {
  const submit = login.querySelector('button');
  submit.disabled = false;
  login.addEventListener('submit',async event => {
    event.preventDefault();
    const user = login.elements.username.value.trim();
    const password = login.elements.password.value;
    const status = find('login-status');
    submit.disabled = true;
    status.textContent = '正在登录…';
    try {
      const bytes = new TextEncoder().encode(user + ':' + password);
      authorization = 'Basic ' + btoa(Array.from(bytes,byte=>String.fromCharCode(byte)).join(''));
      await data({});
      login.reset();
      login.hidden = true;
      logout.hidden = false;
      desk.querySelector('.desk-layout').hidden = false;
      refresh();
    } catch (error) {
      authorization = '';
      status.textContent = ['TypeError','TimeoutError'].includes(error.name)
        ? '无法连接客服服务器。请确认托管电脑和公网连接正在运行。'
        : error.message;
    } finally {
      submit.disabled = false;
    }
  });
  logout.addEventListener('click',() => location.reload());
}
if (!published) refresh();
if (!published || login) setInterval(() => { if ((!published || authorization && login.hidden) && !document.hidden && !sending) refresh(); },2500);
