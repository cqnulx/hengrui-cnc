import { frontendPath, language, serviceOffline, t, visitorRequest } from './site-api.js';

const dialog = document.querySelector('#chat-dialog');
const launch = document.querySelector('#chat-launch');
const form = dialog.querySelector('form');
const question = form.elements.namedItem('question');
const submit = form.querySelector('button[type=submit]');
const shortcuts = [...dialog.querySelectorAll('[data-chat-question]')];
const transcript = dialog.querySelector('.chat-messages');
const status = dialog.querySelector('.chat-status');
const modeLabel = dialog.querySelector('.chat-mode');
const transfer = dialog.querySelector('#chat-transfer');
const shortcutRow = dialog.querySelector('.chat-shortcuts');
const supportEnabled = dialog.dataset.support === 'on';
const offlineMessage = t('在线客服暂未接通，请通过联系页的微信二维码与我们沟通。');
const history = [];
let pending = false;
let transferring = false;
let mode = 'ai';
let cursor = 0;
let syncPromise;
let watcher;
let currentSend;
let optimistic;

function appendMessage(label,text,kind,extra = {}) {
  const line = document.createElement('li');
  line.className = 'chat-message ' + kind;
  const speaker = document.createElement('span');
  speaker.className = 'chat-speaker';
  speaker.textContent = label;
  const body = document.createElement('p');
  body.textContent = text;
  line.append(speaker);
  if (text) line.append(body);
  if (extra.general) {
    const heading = document.createElement('span');
    heading.className = 'chat-reference';
    heading.textContent = t('行业知识');
    const paragraph = document.createElement('p');
    paragraph.textContent = extra.general;
    line.append(heading,paragraph);
  }
  if (extra.outside) {
    if (text || extra.general) {
      const heading = document.createElement('span');
      heading.className = 'chat-reference';
      heading.textContent = t('其他问题');
      line.append(heading);
    }
    const paragraph = document.createElement('p');
    paragraph.textContent = extra.offline ? t(extra.outside) : extra.outside;
    line.append(paragraph);
  }
  if (extra.sources?.length) {
    const links = document.createElement('div');
    links.className = 'chat-sources';
    for (const source of extra.sources) {
      if (!source.href.startsWith('/') || source.href.startsWith('//')) continue;
      const link = document.createElement('a');
      link.href = frontendPath(source.href);
      link.textContent = source.title.split(' · ').map(part => t(part)).join(' · ');
      if (link.pathname === location.pathname && link.hash) link.addEventListener('click', () => dialog.close());
      links.append(link);
    }
    line.append(links);
  }
  if (supportEnabled && extra.handoff) {
    const suggestion = document.createElement('div');
    suggestion.className = 'chat-suggestion';
    const reason = document.createElement('p');
    reason.textContent = t(extra.handoff);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = t('转人工客服');
    button.dataset.chatTransfer = '';
    suggestion.append(reason,button);
    line.append(suggestion);
  }
  transcript.append(line);
  while (transcript.children.length > 41) transcript.firstElementChild.remove();
  if (kind === 'from-assistant' && line.offsetHeight >= transcript.clientHeight) {
    const top = line.getBoundingClientRect().top - transcript.getBoundingClientRect().top;
    transcript.scrollTop += top - 10;
  } else {
    transcript.scrollTop = transcript.scrollHeight;
  }
  return line;
}

const modes = {ai:'网站助手',waiting:'等待人工接入',human:'人工客服接待中'};

function updateControls() {
  modeLabel.textContent = t(modes[mode]);
  transfer.hidden = !supportEnabled || mode !== 'ai';
  transfer.disabled = transferring;
  shortcutRow.hidden = mode !== 'ai';
  submit.disabled = pending || transferring;
  shortcuts.forEach(button => { button.disabled = pending || transferring; });
  for (const suggestion of transcript.querySelectorAll('.chat-suggestion')) {
    suggestion.hidden = mode !== 'ai';
    suggestion.querySelector('button').disabled = transferring;
  }
  question.placeholder = t(mode === 'ai' ? '输入您的问题…' : '发送消息给人工客服…');
}

const captions = {visitor:'你',assistant:'网站助手',agent:'人工客服',system:'接待状态'};

async function sync() {
  if (!supportEnabled) return;
  if (syncPromise) await syncPromise.catch(() => {});
  const request = (async () => {
    const response = await visitorRequest('/api/support?after=' + cursor,{signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error(t('暂时无法同步对话。'));
    const data = await response.json();
    if (!data.available) return;
    const previous = mode;
    mode = data.mode;
    for (const entry of data.messages) {
      if (entry.id <= cursor) continue;
      const reply = entry.reply || {};
      const body = reply.site || entry.text;
      appendMessage(t(captions[entry.kind]),entry.kind === 'system' || reply.offline ? t(body) : body,'from-' + (entry.kind === 'visitor' ? 'user' : entry.kind),reply);
      cursor = entry.id;
    }
    if (previous !== 'ai' && mode === 'ai') status.textContent = '';
    updateControls();
  })();
  syncPromise = request;
  try { await request; } finally { if (syncPromise === request) syncPromise = undefined; }
}

async function askForAgent() {
  if (!supportEnabled || transferring || mode !== 'ai') return;
  if (serviceOffline) {
    status.textContent = offlineMessage;
    return;
  }
  transferring = true;
  updateControls();
  try {
    const response = await visitorRequest('/api/support/transfer',{method:'POST',body:new URLSearchParams(),signal:AbortSignal.timeout(8000)});
    const data = await response.json();
    if (!response.ok) throw new Error(t(data.message,'暂时无法转接。'));
    mode = data.mode;
    currentSend?.abort();
    optimistic?.remove();
    status.textContent = '';
    await sync();
  } catch (error) {
    status.textContent = error.name === 'Error' ? error.message : t('暂时无法转接。');
  } finally {
    transferring = false;
    updateControls();
    question.focus();
  }
}

launch.addEventListener('click', () => {
  if (dialog.open) {
    dialog.close();
    return;
  }
  dialog.show();
  launch.setAttribute('aria-expanded','true');
  if (!matchMedia('(pointer: coarse)').matches) question.focus();
  if (supportEnabled && !serviceOffline) {
    sync().catch(() => { status.textContent = t('暂时无法同步对话。'); });
    clearInterval(watcher);
    watcher = setInterval(() => {
      if (!pending && !transferring && !syncPromise && !document.hidden) sync().catch(() => {});
    },2000);
  }
});
dialog.querySelector('.chat-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  if (dialog.open) return;
  clearInterval(watcher);
  launch.setAttribute('aria-expanded','false');
  launch.focus();
});
for (const control of [launch,dialog]) {
  control.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dialog.open) {
      event.stopPropagation();
      dialog.close();
    }
  });
}
transfer.addEventListener('click',askForAgent);
transcript.addEventListener('click',event => { if (event.target.closest('[data-chat-transfer]')) askForAgent(); });

async function send(value) {
  const text = value.trim();
  if (pending || transferring || !text || text.length > 500) return;
  if (serviceOffline) {
    status.textContent = offlineMessage;
    return;
  }
  pending = true;
  updateControls();
  question.value = '';
  optimistic = appendMessage(t('你'),text,'from-user');
  status.textContent = t(mode === 'ai' ? '正在回答…' : '正在发送…');
  const controller = new AbortController();
  currentSend = controller;
  let submitted = false;

  const fields = new URLSearchParams({language});
  for (const entry of [...history.slice(-6),text]) fields.append('message',entry);
  try {
    const response = await visitorRequest('/api/chat',{
      method:'POST',
      body:fields,
      headers:{Accept:'application/json'},
      signal:AbortSignal.any([AbortSignal.timeout(55000),controller.signal]),
    });
    const data = await response.json();
    if (response.ok && data.stored && supportEnabled) {
      submitted = true;
      optimistic.remove();
      mode = data.mode;
      await sync();
      status.textContent = '';
      return;
    }
    if (!response.ok || typeof data.site !== 'string' || typeof data.general !== 'string' ||
        typeof data.outside !== 'string' || !(data.site || data.general || data.outside)) {
      throw new Error(t(data.message,'暂时无法回答，请稍后重试。'));
    }
    appendMessage(t('网站助手'),data.site,'from-assistant',data);
    if (!data.offline) {
      const context = [data.site,data.general,data.outside].filter(Boolean);
      const partLimit = Math.floor((3000 - context.length + 1) / context.length);
      history.push(text,context.map(part => part.slice(0,partLimit)).join('\n'));
      if (history.length > 6) history.splice(0,2);
    }
    status.textContent = '';
  } catch (error) {
    optimistic?.remove();
    if (!controller.signal.aborted) {
      if (!submitted && !question.value) question.value = text;
      status.textContent = submitted ? t('消息已发送，正在等待同步。') : error.name === 'Error'
        ? error.message : t('暂时无法发送，请稍后重试。');
    }
  } finally {
    pending = false;
    currentSend = undefined;
    optimistic = undefined;
    updateControls();
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  send(question.value);
});
for (const button of shortcuts) {
  button.addEventListener('click', () => {
    question.focus();
    send(button.textContent);
  });
}

updateControls();
