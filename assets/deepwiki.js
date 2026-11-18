(function () {
  if (window.__launchpadDeepWiki) return;
  window.__launchpadDeepWiki = true;

  var REPO = 'agent-CI-Infra/bot';
  var ENDPOINT = 'https://mcp.deepwiki.com/mcp';
  var PAGE = 'https://deepwiki.com/' + REPO;
  var SETTINGS = window.LAUNCHPAD_DOCS || {};
  var GUIDE = SETTINGS.guide || PAGE;
  var zh = SETTINGS.lang === 'zh';
  var copy = zh ? {
    launcher: '问 DeepWiki',
    chat: '对话',
    openPage: '打开页面',
    newChat: '新对话',
    close: '关闭',
    about: '关于 DeepWiki 与 MCP',
    emptyTitle: '向 LaunchPad 提问',
    emptyText: '问任务生命周期、某个模块、隔离边界，或某个决定在哪里。回答来自 DeepWiki 索引；请核对它给出的源码链接。',
    placeholder: '问问 LaunchPad…',
    thinking: '正在检索索引…',
    stop: '停止',
    copy: '复制',
    copied: '已复制',
    copyFailed: '复制失败',
    copyUnavailable: '无法复制',
    retry: '重试',
    hint: 'DeepWiki 是第三方服务，回答由模型生成。关键结论请对照源码核实。',
    caveats: '说明',
    stopped: '已停止。准备好后再问。',
    unavailable: 'DeepWiki 暂时不可用：',
    noAnswer: 'DeepWiki 无法回答。',
    emptyAnswer: 'DeepWiki 返回了空答案。',
    openDeepWiki: '打开 DeepWiki 页面',
    prompts: [
      { q: '一个任务如何从 issue 走到 release？', t: '任务生命周期', s: 'issue、角色运行、PR、发布' },
      { q: '一个仓库的虚拟电脑隔离了什么？', t: '隔离边界', s: '容器、卷、网络、凭据' },
      { q: 'GitHub App 的凭据如何按仓库收紧？', t: '凭据与权限', s: '安装、token、最小权限' },
      { q: '独立分析里最需要补的治理缺口是什么？', t: '分析与风险', s: '成熟度、边界、下一步' }
    ]
  } : {
    launcher: 'Ask DeepWiki',
    chat: 'Chat',
    openPage: 'Open page',
    newChat: 'New chat',
    close: 'Close',
    about: 'About DeepWiki and MCP',
    emptyTitle: 'Ask LaunchPad',
    emptyText: 'Ask about the task lifecycle, a module, isolation, or where a decision lives. Answers come from the DeepWiki index; verify the source links.',
    placeholder: 'Ask about LaunchPad…',
    thinking: 'Searching the index…',
    stop: 'Stop',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    copyUnavailable: 'Copy unavailable',
    retry: 'Retry',
    hint: 'DeepWiki is third-party and model-generated. Verify load-bearing answers against the source.',
    caveats: 'Caveats',
    stopped: 'Stopped. Ask again when you are ready.',
    unavailable: 'DeepWiki is unavailable right now: ',
    noAnswer: 'DeepWiki could not answer.',
    emptyAnswer: 'DeepWiki returned an empty answer.',
    openDeepWiki: 'Open the DeepWiki page',
    prompts: [
      { q: 'How does a task move from an issue to a release?', t: 'Task lifecycle', s: 'issue, role run, PR, release' },
      { q: "What does one repository's virtual computer isolate?", t: 'Isolation boundary', s: 'container, volume, network, credentials' },
      { q: 'How are GitHub App credentials scoped per repository?', t: 'Credentials and permissions', s: 'installation, token, least privilege' },
      { q: 'What governance gap matters most in the independent analysis?', t: 'Analysis and risk', s: 'maturity, boundaries, next steps' }
    ]
  };

  var icons = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
    logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5z"/><path d="M5 4.5v17"/><path d="M9 7h7M9 10h7"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-5M12 8h.01"/></svg>'
  };

  function esc(text) {
    return String(text).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function promptsHtml() {
    return copy.prompts.map(function (prompt) {
      return '<button type="button" class="dw-prompt" data-q="' + esc(prompt.q) + '">' +
        '<span>' + esc(prompt.t) + '</span><small>' + esc(prompt.s) + '</small><b>\u2192</b></button>';
    }).join('');
  }

  var launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'dw-launcher';
  launcher.id = 'dw-launcher';
  launcher.title = copy.launcher;
  launcher.setAttribute('aria-label', copy.launcher);
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'dw-panel');
  launcher.innerHTML = icons.chat + '<span class="dw-launcher-text">' + copy.launcher + '</span><span class="dw-dot" aria-hidden="true"></span>';

  var panel = document.createElement('section');
  panel.className = 'dw-panel';
  panel.id = 'dw-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', copy.launcher);
  panel.innerHTML = [
    '<header class="dw-head">',
    '<div class="dw-brand"><span class="dw-logo">' + icons.logo + '</span>',
    '<div><strong>DeepWiki</strong><span class="dw-repo"><i></i>' + REPO + '</span></div></div>',
    '<div class="dw-head-actions">',
    '<a class="dw-icon-btn" href="' + GUIDE + '" title="' + copy.about + '" aria-label="' + copy.about + '">' + icons.info + '</a>',
    '<button type="button" class="dw-icon-btn" id="dw-new" aria-label="' + copy.newChat + '" title="' + copy.newChat + '">' + icons.refresh + '</button>',
    '<button type="button" class="dw-icon-btn" id="dw-close" aria-label="' + copy.close + '" title="' + copy.close + '">' + icons.close + '</button>',
    '</div></header>',
    '<div class="dw-tabs">',
    '<button type="button" class="dw-tab active">' + copy.chat + '</button>',
    '<a class="dw-tab" href="' + PAGE + '" target="_blank" rel="noopener">' + copy.openPage + ' \u2197</a>',
    '</div>',
    '<div class="dw-log" id="dw-log" role="log" aria-live="polite">',
    '<div class="dw-empty">',
    '<span class="dw-empty-icon">' + icons.spark + '</span>',
    '<h3>' + copy.emptyTitle + '</h3>',
    '<p>' + copy.emptyText + '</p>',
    '<div class="dw-prompts">' + promptsHtml() + '</div>',
    '</div></div>',
    '<form class="dw-form" id="dw-form">',
    '<div class="dw-input-wrap">',
    '<textarea id="dw-input" rows="1" placeholder="' + copy.placeholder + '" aria-label="' + copy.placeholder + '"></textarea>',
    '<button type="submit" class="dw-send" id="dw-send" aria-label="Send">' + icons.send + '</button>',
    '</div>',
    '<div class="dw-hint"><span>' + copy.hint + '</span><a href="' + GUIDE + '">' + copy.caveats + '</a></div>',
    '</form>'
  ].join('');

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  var log = panel.querySelector('#dw-log');
  var form = panel.querySelector('#dw-form');
  var input = panel.querySelector('#dw-input');
  var send = panel.querySelector('#dw-send');
  var close = panel.querySelector('#dw-close');
  var newChat = panel.querySelector('#dw-new');
  var emptyTemplate = log.querySelector('.dw-empty').cloneNode(true);
  var busy = false;
  var history = [];
  var controller = null;

  function scroll() { log.scrollTop = log.scrollHeight; }
  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    input.focus();
  }
  function closePanel() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }
  function bindPrompts(root) {
    Array.prototype.forEach.call(root.querySelectorAll('.dw-prompt'), function (prompt) {
      prompt.addEventListener('click', function () {
        input.value = prompt.getAttribute('data-q') || '';
        form.requestSubmit();
      });
    });
  }
  function resetChat() {
    if (controller) { controller.abort(); controller = null; }
    history = [];
    while (log.firstChild) log.removeChild(log.firstChild);
    var empty = emptyTemplate.cloneNode(true);
    log.appendChild(empty);
    bindPrompts(empty);
    input.value = '';
    input.style.height = 'auto';
    input.focus();
  }

  launcher.addEventListener('click', function () {
    if (panel.hidden) openPanel(); else closePanel();
  });
  close.addEventListener('click', closePanel);
  newChat.addEventListener('click', resetChat);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !panel.hidden) closePanel();
  });
  document.addEventListener('click', function (event) {
    if (!event.target || !event.target.closest) return;
    var trigger = event.target.closest('[data-deepwiki-open]');
    if (trigger) { event.preventDefault(); openPanel(); }
  });

  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  input.addEventListener('input', function () {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 112) + 'px';
  });

  function inline(text) {
    var value = esc(text);
    value = value.replace(/`([^`]+)`/g, '<code>$1</code>');
    value = value.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    value = value.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    value = value.replace(/\[([^\]]+)\]\((\/[^\s)]+)\)/g, '<a href="https://deepwiki.com$2" target="_blank" rel="noopener">$1</a>');
    return value;
  }
  function renderProse(text) {
    var lines = text.split(/\r?\n/);
    var html = '';
    var paragraph = [];
    var list = null;
    function flushParagraph() {
      if (paragraph.length) {
        html += '<p>' + inline(paragraph.join(' ')) + '</p>';
        paragraph = [];
      }
    }
    function closeList() {
      if (list) { html += '</' + list + '>'; list = null; }
    }
    lines.forEach(function (raw) {
      var line = raw.trim();
      if (!line) { flushParagraph(); closeList(); return; }
      var heading = line.match(/^(#{1,4})\s+(.*)$/);
      if (heading) { flushParagraph(); closeList(); html += '<h4>' + inline(heading[2]) + '</h4>'; return; }
      var unordered = line.match(/^[-*]\s+(.*)$/);
      if (unordered) {
        flushParagraph();
        if (list !== 'ul') { closeList(); html += '<ul>'; list = 'ul'; }
        html += '<li>' + inline(unordered[1]) + '</li>';
        return;
      }
      var ordered = line.match(/^\d+\.\s+(.*)$/);
      if (ordered) {
        flushParagraph();
        if (list !== 'ol') { closeList(); html += '<ol>'; list = 'ol'; }
        html += '<li>' + inline(ordered[1]) + '</li>';
        return;
      }
      var quote = line.match(/^>\s?(.*)$/);
      if (quote) { flushParagraph(); closeList(); html += '<blockquote>' + inline(quote[1]) + '</blockquote>'; return; }
      paragraph.push(line);
    });
    flushParagraph();
    closeList();
    return html;
  }
  function renderMarkdown(text) {
    var parts = String(text || '').split(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g);
    var html = '';
    for (var i = 0; i < parts.length; i += 2) {
      if (parts[i]) html += renderProse(parts[i]);
      if (i + 1 < parts.length) html += '<pre><code>' + esc(parts[i + 1].replace(/\n$/, '')) + '</code></pre>';
    }
    return html || '<p>' + esc(text) + '</p>';
  }

  function copyText(text, button) {
    if (!navigator.clipboard) { button.textContent = copy.copyUnavailable; return; }
    navigator.clipboard.writeText(text).then(function () {
      button.textContent = copy.copied;
      setTimeout(function () { button.textContent = copy.copy; }, 1400);
    }).catch(function () { button.textContent = copy.copyFailed; });
  }

  function message(role, text) {
    var row = document.createElement('div');
    row.className = 'dw-msg dw-' + role;
    if (role === 'bot') {
      var avatar = document.createElement('span');
      avatar.className = 'dw-avatar';
      avatar.textContent = 'DW';
      row.appendChild(avatar);
    }
    var bubble = document.createElement('div');
    bubble.className = 'dw-bubble';
    if (role === 'user') {
      bubble.textContent = text;
    } else {
      var meta = document.createElement('div');
      meta.className = 'dw-meta-row';
      var label = document.createElement('span');
      label.className = 'dw-meta';
      label.textContent = 'DeepWiki';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'dw-copy';
      button.textContent = copy.copy;
      button.addEventListener('click', function () { copyText(text, button); });
      meta.appendChild(label);
      meta.appendChild(button);
      var body = document.createElement('div');
      body.className = 'dw-md';
      body.innerHTML = renderMarkdown(text);
      bubble.appendChild(meta);
      bubble.appendChild(body);
    }
    row.appendChild(bubble);
    log.appendChild(row);
    scroll();
    return row;
  }

  function thinking() {
    var row = document.createElement('div');
    row.className = 'dw-msg dw-bot dw-thinking';
    row.innerHTML = '<span class="dw-avatar">DW</span><div class="dw-bubble"><span class="dw-dots"><i></i><i></i><i></i></span><span>' + copy.thinking + '</span><button type="button" class="dw-stop">' + copy.stop + '</button></div>';
    log.appendChild(row);
    scroll();
    return row;
  }

  function error(text, question) {
    var row = message('bot', text);
    row.querySelector('.dw-bubble').classList.add('dw-error');
    var link = document.createElement('p');
    link.innerHTML = '<a href="' + PAGE + '" target="_blank" rel="noopener">' + copy.openDeepWiki + ' \u2197</a>';
    row.querySelector('.dw-md').appendChild(link);
    if (question) {
      var retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'dw-retry';
      retry.textContent = copy.retry;
      retry.addEventListener('click', function () {
        row.remove();
        ask(question);
      });
      row.querySelector('.dw-md').appendChild(retry);
    }
    scroll();
  }

  function parseSse(raw) {
    var last = null;
    raw.split(/\r?\n/).forEach(function (line) {
      if (line.indexOf('data: ') !== 0) return;
      try {
        var obj = JSON.parse(line.slice(6));
        if (obj && (obj.result || obj.error)) last = obj;
      } catch (e) { /* keep-alive or partial event */ }
    });
    if (!last) {
      try {
        var direct = JSON.parse(raw);
        if (direct && (direct.result || direct.error)) last = direct;
      } catch (e) { /* not JSON */ }
    }
    return last;
  }

  function call(question, signal) {
    var body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'ask_wiki_question',
        arguments: { repoName: REPO, question: question }
      }
    };
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify(body),
      signal: signal
    }).then(function (response) {
      if (!response.ok) throw new Error('DeepWiki returned HTTP ' + response.status);
      return response.text();
    }).then(function (raw) {
      var payload = parseSse(raw);
      if (!payload) throw new Error('DeepWiki returned an unreadable response.');
      if (payload.error) throw new Error(payload.error.message || 'DeepWiki returned an error.');
      var result = payload.result || {};
      var text = (result.content || []).map(function (part) { return part.text || ''; }).join('\n').trim();
      if (result.isError) return { ok: false, text: text || copy.noAnswer };
      return { ok: true, text: text || copy.emptyAnswer };
    });
  }

  function ask(question) {
    if (busy) return;
    busy = true;
    send.disabled = true;
    var empty = log.querySelector('.dw-empty');
    if (empty) empty.remove();
    message('user', question);
    var pending = thinking();
    var stop = pending.querySelector('.dw-stop');
    if (stop) stop.addEventListener('click', function () {
      if (controller) controller.abort();
    });
    var context = history.slice(-2).map(function (item) {
      return 'Q: ' + item.q + '\nA: ' + item.a.slice(0, 900);
    }).join('\n\n');
    var prompt = context
      ? 'Previous conversation for context:\n' + context + '\n\nNew question: ' + question
      : question;
    controller = ('AbortController' in window) ? new AbortController() : null;
    call(prompt, controller ? controller.signal : undefined).then(function (result) {
      if (pending.parentNode) pending.remove();
      if (result.ok) {
        history.push({ q: question, a: result.text });
        if (history.length > 4) history.shift();
        message('bot', result.text);
      } else {
        error(result.text, question);
      }
    }).catch(function (failure) {
      if (pending.parentNode) pending.remove();
      if (failure && failure.name === 'AbortError') {
        error(copy.stopped, question);
      } else {
        error(copy.unavailable + failure.message, question);
      }
    }).then(function () {
      controller = null;
      busy = false;
      send.disabled = false;
      input.focus();
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var question = input.value.trim();
    if (!question) return;
    input.value = '';
    input.style.height = 'auto';
    ask(question);
  });
  bindPrompts(log);
})();
