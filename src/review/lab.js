(function () {
  'use strict'

  var state = {
    scopes: [],
    packs: [],
    packId: 'all',
    pack: null,
    quotes: [],
    status: { llm: false, tts: false },
    pet: null,
    feature: null,
    speech: {},
    recorder: null,
    newsTimer: null,
    dungeon: null,
    subtitle: null,
    dictation: null,
    shadow: null,
  }

  var FEATURES = [
    { id: 'dictation', title: '听写诊所', icon: '✍️', tags: ['听', '写'], needsPack: true, ai: false, desc: '听写词库例句，逐词对照；可选 AI 听音提示。' },
    { id: 'shadowing', title: '影子跟读', icon: '🗣️', tags: ['说', '听'], needsPack: true, ai: false, desc: '跟读词库例句；一句句听、跟、录、回放，只在本机。' },
    { id: 'life', title: '生活例句', icon: '🏠', tags: ['写', '词'], needsPack: false, ai: true, desc: '把一个词放进你的工作、旅行、爱好或日常。' },
  ]

  function $(selector, root) { return (root || document).querySelector(selector) }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)) }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  var toastTimer = null
  function toast(message) {
    var node = $('#lab-toast')
    if (!node) return
    node.textContent = message
    node.hidden = false
    clearTimeout(toastTimer)
    toastTimer = setTimeout(function () { node.hidden = true }, 3600)
  }

  async function api(path, options) {
    var opts = options || {}
    if (opts.body && typeof opts.body !== 'string') {
      opts.body = JSON.stringify(opts.body)
      opts.headers = Object.assign({ 'content-type': 'application/json' }, opts.headers || {})
    }
    var response = await fetch(path, opts)
    var data = await response.json().catch(function () { return {} })
    if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status))
    return data
  }

  function post(path, body) {
    return api(path, { method: 'POST', body: body || {} })
  }

  function setBusy(button, busy, label) {
    if (!button) return
    if (busy) {
      button.dataset.label = button.textContent
      button.disabled = true
      button.textContent = label || '处理中…'
    } else {
      button.disabled = false
      if (button.dataset.label) button.textContent = button.dataset.label
    }
  }

  function themeChoice() {
    try { return localStorage.getItem('closeread-theme') || 'auto' } catch (error) { return 'auto' }
  }
  function prefersDark() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
  }
  function applyTheme(choice) {
    var dark = choice === 'dark' || (choice === 'auto' && prefersDark())
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    var button = $('#lab-theme')
    if (button) button.textContent = choice === 'light' ? '日间' : choice === 'dark' ? '夜间' : '自动'
  }
  function cycleTheme() {
    var order = ['auto', 'light', 'dark']
    var next = order[(order.indexOf(themeChoice()) + 1) % order.length]
    try { localStorage.setItem('closeread-theme', next) } catch (error) {}
    applyTheme(next)
  }

  function renderStatus() {
    var node = $('#lab-status')
    if (!node) return
    var bits = []
    bits.push(state.status.llm ? '模型 ✓' : '模型未配置')
    bits.push(state.status.tts ? '语音 ✓' : '语音不可用')
    node.textContent = bits.join(' · ')
  }

  function initCustomSelects(root) {
    (root || document).querySelectorAll('.cselect[data-cselect]').forEach(function (wrap) {
      if (wrap.dataset.ready === '1') return
      wrap.dataset.ready = '1'
      var input = wrap.querySelector('input[type="hidden"]')
      var trigger = wrap.querySelector('.cselect-trigger')
      var label = wrap.querySelector('.cselect-label')
      var menu = wrap.querySelector('.cselect-menu')
      if (!input || !trigger || !label || !menu) return
      function sync() {
        var selected = menu.querySelector('.cselect-option[data-value="' + String(input.value).replace(/"/g, '\\"') + '"]')
        label.textContent = selected ? selected.textContent : ''
        menu.querySelectorAll('.cselect-option').forEach(function (option) {
          option.classList.toggle('is-selected', option === selected)
        })
      }
      function close() {
        menu.hidden = true
        trigger.setAttribute('aria-expanded', 'false')
      }
      function open() {
        document.querySelectorAll('.cselect-menu').forEach(function (other) {
          if (other !== menu) {
            other.hidden = true
            var otherTrigger = other.parentElement && other.parentElement.querySelector('.cselect-trigger')
            if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false')
          }
        })
        menu.hidden = false
        trigger.setAttribute('aria-expanded', 'true')
      }
      trigger.addEventListener('click', function (event) {
        event.stopPropagation()
        if (menu.hidden) open(); else close()
      })
      menu.addEventListener('click', function (event) {
        event.stopPropagation()
        var option = event.target.closest ? event.target.closest('.cselect-option') : null
        if (!option) return
        input.value = option.getAttribute('data-value') || ''
        sync()
        close()
        input.dispatchEvent(new Event('change', { bubbles: true }))
      })
      trigger.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') close()
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          open()
        }
      })
      document.addEventListener('click', function (event) {
        if (!wrap.contains(event.target)) close()
      })
      wrap._sync = sync
      sync()
    })
  }

  function renderPackSelect() {
    var input = $('#lab-scope')
    if (!input) return
    var wrap = input.closest('.cselect')
    var menu = wrap && wrap.querySelector('.cselect-menu')
    if (menu) {
      menu.innerHTML = state.scopes.map(function (scope) {
        return '<button class="cselect-option" type="button" role="option" data-value="' + esc(scope.id) + '">' + esc(scope.title) + '</button>'
      }).join('')
    }
    input.value = state.packId || 'all'
    if (wrap && wrap._sync) wrap._sync()
    var meta = $('#lab-pack-meta')
    if (meta) {
      meta.textContent = state.pack
        ? state.pack.title + ' · ' + state.pack.cefr + ' · ' + state.pack.wordCount + ' 个学习词 · 本轮 ' + state.pack.itemCount + ' 个'
        : '词库还是空的'
    }
  }

  function renderDashboard() {
    var host = $('#lab-dashboard')
    if (!host) return
    if (!state.pack) {
      host.innerHTML = '<div class="empty">还没有可练习的带例句学习词。先 <a href="/?tab=import">读一篇文章</a>，或在 <a href="/?tab=library">词库 → 词书库</a> 加入 IELTS 等带例句词书。</div>'
      return
    }
    host.innerHTML = FEATURES.map(function (feature) {
      var unavailable = feature.needsPack && !state.pack
      var tags = feature.tags.map(function (tag) { return '<span class="mission-tag">' + esc(tag) + '</span>' }).join('')
      tags += feature.ai ? '<span class="mission-tag ai">AI</span>' : '<span class="mission-tag">本地</span>'
      return '<button class="mission-card" type="button" data-feature="' + feature.id + '"' + (unavailable ? ' disabled' : '') + '>' +
        '<span class="mission-icon">' + feature.icon + '</span>' +
        '<span class="mission-title">' + esc(feature.title) + '</span>' +
        '<span class="mission-desc">' + esc(feature.desc) + '</span>' +
        '<span class="mission-meta">' + tags + '</span>' +
      '</button>'
    }).join('')
  }

  async function load(scope) {
    var nextScope = scope || state.packId || 'all'
    var data = await api('/api/lab?scope=' + encodeURIComponent(nextScope))
    state.scopes = data.scopes || data.packs || []
    state.packs = state.scopes
    state.pack = data.source || data.pack || null
    state.packId = state.pack ? String(state.pack.id).replace(/^vocab:/, '') : 'all'
    state.quotes = data.quotes || []
    state.status = data.status || { llm: false, tts: false }
    state.pet = data.pet || null
    renderStatus()
    renderPackSelect()
    renderDashboard()
    if (state.feature) renderFeature(state.feature)
  }

  function clearMedia() {
    if (state.newsTimer) {
      clearInterval(state.newsTimer)
      state.newsTimer = null
    }
    var player = $('#lab-player')
    if (player) {
      player.pause()
      player.removeAttribute('src')
      player.hidden = true
    }
    if (state.recorder && state.recorder.recorder && state.recorder.recorder.state !== 'inactive') {
      try { state.recorder.recorder.stop() } catch (error) {}
    }
    state.recorder = null
    state.speech = {}
  }

  function stageHead(feature) {
    var stage = $('#lab-stage')
    stage.hidden = false
    $('#lab-dashboard').hidden = true
    var hero = $('.lab-hero')
    if (hero) hero.hidden = true
    stage.innerHTML =
      '<div class="stage-head"><div>' +
        '<button class="stage-back" id="lab-back" type="button">← 实验室</button>' +
        '<h2 class="stage-title">' + feature.icon + ' ' + esc(feature.title) + '</h2>' +
        '<p class="stage-sub">' + esc(feature.desc) + '</p>' +
      '</div><div class="row">' + feature.tags.map(function (tag) { return '<span class="mission-tag">' + esc(tag) + '</span>' }).join('') + '</div></div>' +
      '<div class="stage-body" id="lab-stage-body"></div>'
    $('#lab-back').addEventListener('click', backToLab)
    return $('#lab-stage-body')
  }

  function openFeature(id) {
    var feature = FEATURES.find(function (entry) { return entry.id === id })
    if (!feature) return
    if (feature.needsPack && !state.pack) {
      toast('先给词库加入一些学习词。')
      return
    }
    state.feature = id
    state.speech = {}
    state.dungeon = null
    state.subtitle = null
    state.dictation = null
    state.shadow = null
    clearMedia()
    renderFeature(id)
  }

  function backToLab() {
    state.feature = null
    clearMedia()
    var stage = $('#lab-stage')
    if (stage) {
      stage.hidden = true
      stage.innerHTML = ''
    }
    var dashboard = $('#lab-dashboard')
    if (dashboard) dashboard.hidden = false
    var hero = $('.lab-hero')
    if (hero) hero.hidden = false
    load().catch(function (error) { toast(error.message) })
  }

  function renderFeature(id) {
    var feature = FEATURES.find(function (entry) { return entry.id === id })
    if (!feature) return
    var body = stageHead(feature)
    var render = {
      quote: renderQuote,
      register: renderRegister,
      podcast: function (host) { renderPodcast(host, 'solo') },
      dungeon: renderDungeon,
      life: renderLife,
      pet: renderPet,
      argument: renderArgument,
      news: renderNews,
      subtitle: renderSubtitle,
      duo: function (host) { renderPodcast(host, 'duo') },
      dictation: renderDictation,
      dubbing: renderDubbing,
      shadowing: renderShadowing,
      adventure: renderAdventure,
    }[id]
    if (render) render(body)
  }

  function speechKey(text, rate) {
    var key = 's' + Object.keys(state.speech).length
    state.speech[key] = { text: text, rate: rate || 1 }
    return key
  }

  function speechButton(text, label, rate) {
    if (!text) return ''
    var key = speechKey(text, rate)
    return '<button class="btn small" type="button" data-speak="' + key + '">' + esc(label || '🔊 播放') + '</button>'
  }

  async function playSpeech(key, button) {
    var entry = state.speech[key]
    if (!entry) return
    var player = $('#lab-player')
    setBusy(button, true, '生成语音…')
    try {
      var data = await post('/api/lab/tts', { text: entry.text })
      player.src = data.url
      player.playbackRate = entry.rate || 1
      player.hidden = false
      await player.play().catch(function () {})
    } catch (error) {
      toast('语音不可用：' + error.message)
    } finally {
      setBusy(button, false)
    }
  }

  function recorderHtml(id) {
    return '<div class="recorder" data-recorder-box="' + esc(id) + '">' +
      '<button class="btn small" type="button" data-record="' + esc(id) + '">● 录音</button>' +
      '<button class="btn small" type="button" data-stop="' + esc(id) + '" disabled>■ 停止</button>' +
      '<audio id="rec-' + esc(id) + '" controls hidden></audio>' +
      '<span class="small muted">录音只在本机播放，不上传。</span>' +
    '</div>'
  }

  async function startRecording(id) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      toast('当前浏览器不支持录音。')
      return
    }
    if (state.recorder && state.recorder.recorder && state.recorder.recorder.state !== 'inactive') {
      toast('已经在录音了。')
      return
    }
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      var recorder = new MediaRecorder(stream)
      var chunks = []
      state.recorder = { recorder: recorder, stream: stream, chunks: chunks, id: id }
      recorder.ondataavailable = function (event) { if (event.data && event.data.size) chunks.push(event.data) }
      recorder.onstop = function () {
        var blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        var url = URL.createObjectURL(blob)
        var audio = document.getElementById('rec-' + id)
        if (audio) {
          audio.src = url
          audio.hidden = false
        }
        stream.getTracks().forEach(function (track) { track.stop() })
        var box = document.querySelector('[data-recorder-box="' + id + '"]')
        if (box) {
          var start = box.querySelector('[data-record]')
          var stop = box.querySelector('[data-stop]')
          if (start) start.disabled = false
          if (stop) stop.disabled = true
        }
      }
      recorder.start()
      var box = document.querySelector('[data-recorder-box="' + id + '"]')
      if (box) {
        var start = box.querySelector('[data-record]')
        var stop = box.querySelector('[data-stop]')
        if (start) start.disabled = true
        if (stop) stop.disabled = false
      }
    } catch (error) {
      toast('无法打开麦克风：' + error.message)
    }
  }

  function stopRecording(id) {
    if (state.recorder && state.recorder.recorder && state.recorder.recorder.state !== 'inactive') {
      state.recorder.recorder.stop()
    } else {
      toast('还没有开始录音。')
    }
  }

  function packParagraphs() {
    return (state.pack && state.pack.paragraphs) || []
  }

  function paragraphSelect(id) {
    var first = packParagraphs()[0]
    return '<input type="hidden" id="' + id + '" value="' + (first ? first.index : 0) + '">' +
      '<div class="chips paragraph-chips">' + packParagraphs().map(function (paragraph) {
        return '<button class="chip' + (paragraph === first ? ' active' : '') + '" type="button" data-para-choice="' + paragraph.index + '">' +
          '第 ' + (paragraph.index + 1) + ' 句 · ' + esc(paragraph.original.slice(0, 46)) + '</button>'
      }).join('') + '</div>'
  }

  function requireModel() {
    if (state.status.llm) return true
    toast('这个功能需要配置模型 API Key；本地练习仍可使用。')
    return false
  }

  // ---------- 金句墙 ----------
  function renderQuote(body) {
    var candidates = (state.pack && state.pack.snippets || []).slice(0, 10)
    var list = state.quotes.map(function (quote) {
      return '<div class="quote-card">' +
        '<div class="quote-text">“' + esc(quote.text) + '”</div>' +
        (quote.translation ? '<div class="quote-zh">' + esc(quote.translation) + '</div>' : '') +
        (quote.commentary ? '<div class="quote-note">' + esc(quote.commentary) + '</div>' : '') +
        '<div class="quote-src">' + esc(quote.sourceTitle || '本机金句') + ' · ' + esc(String(quote.createdAt).slice(0, 10)) + '</div>' +
        '<div class="row" style="margin-top:8px">' +
          (state.status.llm && !quote.commentary ? '<button class="btn small" data-quote-ai="' + esc(quote.id) + '">AI 点评</button>' : '') +
          '<button class="btn small danger" data-quote-delete="' + esc(quote.id) + '">删除</button>' +
        '</div>' +
      '</div>'
    }).join('')
    body.innerHTML =
      '<div class="panel"><h3>从词库例句里挑一句</h3>' +
        (candidates.length ? candidates.map(function (snippet) {
          return '<div class="candidate"><div class="candidate-text">' + esc(snippet.text) + '</div>' +
            '<button class="btn small" data-quote-candidate="' + esc(snippet.text) + '">选中</button></div>'
        }).join('') : '<p class="muted">词库还没有可用于摘录的例句。</p>') +
        '<label class="field" for="quote-text">或者自己写一句</label>' +
        '<textarea id="quote-text" placeholder="Paste or write a sentence you want to keep…"></textarea>' +
        '<div class="row" style="margin-top:8px"><button class="btn primary" id="quote-add" type="button">收进金句墙</button>' +
        '<span class="small muted">只保存在本机 data/quotes.json</span></div>' +
      '</div>' +
      '<div class="panel"><h3>金句墙 · ' + state.quotes.length + '</h3>' +
        (list || '<div class="empty">还没有金句。选一句你愿意再读一遍的。</div>') +
      '</div>'
    body.querySelectorAll('[data-quote-candidate]').forEach(function (button) {
      button.addEventListener('click', function () {
        $('#quote-text').value = button.getAttribute('data-quote-candidate')
      })
    })
    $('#quote-add').addEventListener('click', async function () {
      var text = $('#quote-text').value.trim()
      if (!text) return toast('先写一句。')
      setBusy(this, true)
      try {
        await post('/api/lab/quotes', { text: text, scope: state.packId, sourceTitle: state.pack ? state.pack.title : '' })
        toast('已收进金句墙。')
        await load(state.packId)
        renderQuote(body)
      } catch (error) { toast(error.message) } finally { setBusy(this, false) }
    })
    body.querySelectorAll('[data-quote-ai]').forEach(function (button) {
      button.addEventListener('click', async function () {
        if (!requireModel()) return
        setBusy(button, true, '点评中…')
        try {
          await post('/api/lab/quotes/' + encodeURIComponent(button.getAttribute('data-quote-ai')) + '/commentary', {})
          await load(state.packId)
          renderQuote(body)
        } catch (error) { toast(error.message) } finally { setBusy(button, false) }
      })
    })
    body.querySelectorAll('[data-quote-delete]').forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          await api('/api/lab/quotes/' + encodeURIComponent(button.getAttribute('data-quote-delete')), { method: 'DELETE' })
          await load(state.packId)
          renderQuote(body)
        } catch (error) { toast(error.message) }
      })
    })
  }

  // ---------- 文体变形记 ----------
  function renderRegister(body) {
    body.innerHTML =
      '<div class="panel"><h3>选一段，换一种说法</h3>' +
        '<label class="field" for="reg-para">词库例句</label>' + paragraphSelect('reg-para') +
        '<div class="chips" id="reg-styles">' +
          ['tweet', 'email', 'headline', 'poem'].map(function (style, index) {
            return '<button class="chip' + (index === 0 ? ' active' : '') + '" type="button" data-style="' + style + '">' +
              ({ tweet: '推文', email: '邮件', headline: '新闻标题', poem: '四行诗' }[style]) + '</button>'
          }).join('') +
        '</div>' +
        '<label class="field" for="reg-text">你的改写（可留空，让 AI 先示范）</label>' +
        '<textarea id="reg-text" placeholder="Write your version here…"></textarea>' +
        '<div class="row" style="margin-top:10px"><button class="btn primary" id="reg-run" type="button">生成反馈</button>' +
        '<span class="small muted">AI 会指出语域问题，不会替你重写整篇。</span></div>' +
      '</div>' +
      '<div class="panel" id="reg-result" hidden></div>'
    var target = 'tweet'
    body.querySelectorAll('[data-para-choice]').forEach(function (button) {
      button.addEventListener('click', function () {
        $('#reg-para').value = button.getAttribute('data-para-choice')
        body.querySelectorAll('[data-para-choice]').forEach(function (entry) { entry.classList.toggle('active', entry === button) })
      })
    })
    body.querySelectorAll('[data-style]').forEach(function (button) {
      button.addEventListener('click', function () {
        target = button.getAttribute('data-style')
        body.querySelectorAll('[data-style]').forEach(function (entry) { entry.classList.toggle('active', entry === button) })
      })
    })
    $('#reg-run').addEventListener('click', async function () {
      if (!requireModel()) return
      setBusy(this, true, '生成中…')
      try {
        var data = await post('/api/lab/generate', {
          feature: 'register',
          scope: state.packId,
          paragraphIndex: Number($('#reg-para').value),
          target: target,
          text: $('#reg-text').value.trim(),
        })
        var result = data.result
        var host = $('#reg-result')
        host.hidden = false
        host.innerHTML = '<h3>AI 的示范</h3><div class="feedback good">' + esc(result.model) + '</div>' +
          '<h3 style="margin-top:14px">反馈</h3><div class="feedback">' + esc(result.feedback) + '</div>' +
          (result.score ? '<p class="small muted">语域匹配度：' + result.score + ' / 5</p>' : '') +
          (result.notes && result.notes.length ? '<ul>' + result.notes.map(function (note) { return '<li>' + esc(note) + '</li>' }).join('') + '</ul>' : '')
      } catch (error) { toast(error.message) } finally { setBusy(this, false) }
    })
  }

  // ---------- 播客 ----------
  function renderPodcast(body, mode) {
    var duo = mode === 'duo'
    body.innerHTML =
      '<div class="panel"><h3>' + (duo ? '两个主持人，聊这组学习词' : '90 秒单人播客') + '</h3>' +
        '<p class="muted">' + (duo ? 'A 和 B 会有一点分歧，最后给一个 practical takeaway。' : '像电台 briefing：hook、2–3 个观点、一个 takeaway。') + '</p>' +
        '<button class="btn primary" id="podcast-run" type="button">' + (duo ? '生成双人播客' : '生成播客') + '</button>' +
      '</div><div class="panel" id="podcast-result" hidden></div>'
    $('#podcast-run').addEventListener('click', async function () {
      if (!requireModel()) return
      setBusy(this, true, '写稿中…')
      try {
        var data = await post('/api/lab/generate', { feature: 'podcast', scope: state.packId, mode: mode })
        var result = data.podcast
        var host = $('#podcast-result')
        host.hidden = false
        host.innerHTML = '<h3>' + esc(result.title) + '</h3>' +
          '<div class="audio-row">' + speechButton(result.script, '▶ 播放播客') + '<span class="audio-note">约 ' + (duo ? '70–100' : '70–100') + ' 秒</span></div>' +
          (duo && result.turns
            ? '<ul class="script">' + result.turns.map(function (turn) {
                return '<li><span class="speaker">' + esc(turn.speaker === 'A' ? 'HOST A' : 'HOST B') + '</span><span>' + esc(turn.text) + '</span></li>'
              }).join('') + '</ul>'
            : '<div class="feedback">' + esc(result.script) + '</div>') +
          (result.segments ? '<div class="chips">' + result.segments.map(function (segment) {
            return '<span class="chip">' + esc(segment.heading) + '</span>'
          }).join('') + '</div>' : '') +
          (result.questions && result.questions.length
            ? '<h3 style="margin-top:14px">听完答一答</h3>' + result.questions.map(function (question, index) {
                return '<details class="quiz"><summary>Q' + (index + 1) + ' · ' + esc(question.question) + '</summary>' +
                  '<p class="small muted">' + esc(question.answer || '再听一遍，然后用自己的话回答。') + '</p></details>'
              }).join('')
            : '')
      } catch (error) { toast(error.message) } finally { setBusy(this, false) }
    })
  }

  // ---------- 单词宠物 ----------
  function renderPet(body) {
    var pet = state.pet || {}
    var percent = pet.nextXp ? Math.min(100, Math.round((pet.xp / pet.nextXp) * 100)) : 100
    body.innerHTML =
      '<div class="pet-card"><div class="pet-emoji">' + esc(pet.emoji || '🌱') + '</div>' +
        '<div style="flex:1"><h3 class="pet-name">' + esc(pet.name || '词芽') + '</h3>' +
        '<div class="pet-mood">' + esc(pet.mood || '好奇地张望') + '</div>' +
        '<div class="pet-bar"><span style="width:' + percent + '%"></span></div>' +
        '<div class="small muted">' + (pet.xp || 0) + ' / ' + (pet.nextXp || 0) + ' XP</div>' +
        '<div class="pet-stats"><span>🔥 连续 ' + (pet.streak || 0) + ' 天</span><span>🧠 ' + (pet.reviews || 0) + ' 次复习</span><span>🌱 ' + (pet.known || 0) + ' 个已掌握</span></div>' +
        '<div class="row" style="margin-top:12px"><button class="btn primary" id="pet-say" type="button">让它说一句</button><a class="btn" href="/?tab=review">去复习喂它</a></div>' +
        '<div id="pet-line"></div></div></div>'
    $('#pet-say').addEventListener('click', async function () {
      if (!requireModel()) return
      setBusy(this, true, '它正在想…')
      try {
        var data = await post('/api/lab/generate', { feature: 'pet' })
        $('#pet-line').innerHTML = '<div class="pet-say">' + esc(data.line) + '</div>'
      } catch (error) { toast(error.message) } finally { setBusy(this, false) }
    })
  }

  // ---------- 生活例句 ----------
  async function renderLife(body) {
    body.innerHTML = '<div class="panel"><div class="loading">正在找到期词…</div></div>'
    var data
    try {
      var scope = state.packId === 'favorites' ? 'all' : state.packId
      data = await api('/api/queue?limit=20&type=word&scope=' + encodeURIComponent(scope || 'all'))
    } catch (error) {
      body.innerHTML = '<div class="empty">' + esc(error.message) + '</div>'
      return
    }
    var items = data.items || []
    if (state.packId === 'favorites') items = items.filter(function (item) { return item.favorite })
    if (!items.length) {
      body.innerHTML = '<div class="empty">当前范围没有可用词。换一个词库范围，或先去复习。</div>'
      return
    }
    var selected = items[0].id
    body.innerHTML =
      '<div class="panel"><h3>把一个词放进你的生活</h3>' +
        '<label class="field">选一个到期词</label><div class="chips" id="life-words">' +
          items.slice(0, 10).map(function (item) {
            return '<button class="chip' + (item.id === selected ? ' active' : '') + '" type="button" data-word="' + esc(item.id) + '">' + esc(item.lemma) + '</button>'
          }).join('') + '</div>' +
        '<label class="field">放在什么场景</label><div class="chips" id="life-contexts">' +
          ['工作', '旅行', '爱好', '日常', '考试'].map(function (context, index) {
            return '<button class="chip' + (index === 3 ? ' active' : '') + '" type="button" data-context="' + context + '">' + context + '</button>'
          }).join('') + '</div>' +
        '<button class="btn primary" id="life-run" type="button">生成三个例句</button>' +
      '</div><div class="panel" id="life-result" hidden></div>'
    var context = '日常'
    body.querySelectorAll('[data-word]').forEach(function (button) {
      button.addEventListener('click', function () {
        selected = button.getAttribute('data-word')
        body.querySelectorAll('[data-word]').forEach(function (entry) { entry.classList.toggle('active', entry === button) })
      })
    })
    body.querySelectorAll('[data-context]').forEach(function (button) {
      button.addEventListener('click', function () {
        context = button.getAttribute('data-context')
        body.querySelectorAll('[data-context]').forEach(function (entry) { entry.classList.toggle('active', entry === button) })
      })
    })
    $('#life-run').addEventListener('click', async function () {
      if (!requireModel()) return
      setBusy(this, true, '写例句…')
      try {
        var result = await post('/api/lab/generate', { feature: 'life-examples', itemId: selected, context: context })
        var host = $('#life-result')
        host.hidden = false
        host.innerHTML = '<h3>你的' + esc(context) + '场景</h3>' +
          result.examples.map(function (example) {
            return '<div class="quiz"><p>' + esc(example.en) + '</p><p class="small muted">' + esc(example.zh) + '</p>' +
              '<div class="row">' + speechButton(example.en, '🔊 听') + '</div></div>'
          }).join('') + (result.note ? '<p class="small muted">' + esc(result.note) + '</p>' : '')
      } catch (error) { toast(error.message) } finally { setBusy(this, false) }
    })
  }

  // ---------- 论证地图 ----------
  function renderArgument(body) {
    body.innerHTML =
      '<div class="panel"><h3>把一组词的用法拆开看</h3>' +
        '<p class="muted">AI 会从词库例句里找出 claim、evidence、未说出口的 assumption，以及一个反方视角。</p>' +
        '<button class="btn primary" id="arg-run" type="button">生成论证地图</button>' +
      '</div><div class="panel" id="arg-result" hidden></div>'
    $('#arg-run').addEventListener('click', async function () {
      if (!requireModel()) return
      setBusy(this, true, '拆解中…')
      try {
        var data = await post('/api/lab/generate', { feature: 'argument-map', scope: state.packId })
        var map = data.argument
        var host = $('#arg-result')
        host.hidden = false
        host.innerHTML = '<div class="map">' +
          '<div class="map-col claim"><h4>CLAIM</h4><p>' + esc(map.claim) + '</p></div>' +
          '<div class="map-col"><h4>EVIDENCE</h4>' + map.evidence.map(function (entry, index) {
            return '<div class="evidence-item"><button type="button" data-para="' + (entry.paragraph == null ? '' : entry.paragraph) + '">' +
              esc(entry.text) + '</button>' + (entry.paragraph == null ? '' : '<div class="small muted">第 ' + (Number(entry.paragraph) + 1) + ' 段</div>') + '</div>'
          }).join('') + '</div>' +
          '<div class="map-col"><h4>ASSUMPTION</h4><ul>' + map.assumptions.map(function (item) { return '<li>' + esc(item) + '</li>' }).join('') + '</ul></div>' +
        '</div>' +
        '<div class="panel" style="margin-top:12px"><h4 style="margin-top:0">反方视角</h4><ul>' + map.counterpoints.map(function (item) { return '<li>' + esc(item) + '</li>' }).join('') + '</ul></div>' +
        '<div id="arg-para" class="explain" hidden></div>'
        host.querySelectorAll('[data-para]').forEach(function (button) {
          button.addEventListener('click', function () {
            var raw = button.getAttribute('data-para')
            var paragraph = packParagraphs().find(function (entry) { return String(entry.index) === raw })
            var box = $('#arg-para')
            if (!paragraph) {
              box.hidden = false
              box.textContent = '这一句没有可显示的原文。'
              return
            }
            box.hidden = false
            box.textContent = '第 ' + (paragraph.index + 1) + ' 段：' + paragraph.original
          })
        })
      } catch (error) { toast(error.message) } finally { setBusy(this, false) }
    })
  }

  // ---------- AI 新闻短片 ----------
  function newsSceneHtml(scenes, index) {
    var scene = scenes[index] || scenes[0] || { caption: '', narration: '' }
    var caption = $('#news-caption')
    var narration = $('#news-narration')
    var kicker = $('#news-kicker')
    if (caption) caption.textContent = scene.caption
    if (narration) narration.textContent = scene.narration
    if (kicker) kicker.textContent = 'SHOT ' + String(index + 1).padStart(2, '0') + ' / ' + String(scenes.length).padStart(2, '0')
  }

  function renderNews(body) {
    body.innerHTML =
      '<div class="panel"><h3>30 秒竖屏新闻</h3>' +
        '<p class="muted">AI 写 3–4 个镜头；音频按旁白读，画面按秒数推进。不是视频生成，是可读的字幕短片。</p>' +
        '<button class="btn primary" id="news-run" type="button">生成短片</button>' +
      '</div><div class="panel" id="news-result" hidden></div>'
    $('#news-run').addEventListener('click', async function () {
      if (!requireModel()) return
      setBusy(this, true, '写分镜…')
      try {
        var data = await post('/api/lab/generate', { feature: 'news-short', scope: state.packId })
        var news = data.news
        var host = $('#news-result')
        host.hidden = false
        var total = news.scenes.reduce(function (sum, scene) { return sum + Number(scene.seconds || 0) }, 0)
        host.innerHTML = '<h3>' + esc(news.title) + '</h3>' +
          '<div class="row" style="margin-bottom:10px"><button class="btn primary" id="news-play" type="button">▶ 播放旁白</button>' +
            '<button class="btn small" id="news-prev" type="button">上一幕</button>' +
            '<button class="btn small" id="news-next" type="button">下一幕</button>' +
            '<span class="small muted">约 ' + total + ' 秒</span></div>' +
          '<div class="news-phone"><div class="news-screen">' +
            '<div class="news-kicker" id="news-kicker">SHOT 01</div>' +
            '<div class="news-caption" id="news-caption"></div>' +
            '<div class="news-narration" id="news-narration"></div>' +
            '<div class="news-progress"><span id="news-progress"></span></div>' +
            '<div class="news-tags">' + (news.hashtags || []).map(function (tag) { return '#' + esc(tag) }).join(' ') + '</div>' +
          '</div></div>'
        var index = 0
        newsSceneHtml(news.scenes, index)
        $('#news-prev').addEventListener('click', function () { index = Math.max(0, index - 1); newsSceneHtml(news.scenes, index) })
        $('#news-next').addEventListener('click', function () { index = Math.min(news.scenes.length - 1, index + 1); newsSceneHtml(news.scenes, index) })
        $('#news-play').addEventListener('click', async function () {
          setBusy(this, true, '生成旁白…')
          try {
            var speech = await post('/api/lab/tts', { text: news.script })
            var player = $('#lab-player')
            player.src = speech.url
            player.hidden = false
            player.currentTime = 0
            index = 0
            newsSceneHtml(news.scenes, 0)
            if (state.newsTimer) clearInterval(state.newsTimer)
            var starts = []
            var cursor = 0
            news.scenes.forEach(function (scene) { starts.push(cursor); cursor += Number(scene.seconds || 0) })
            player.onended = function () {
              if (state.newsTimer) clearInterval(state.newsTimer)
              state.newsTimer = null
              var bar = $('#news-progress')
              if (bar) bar.style.width = '100%'
            }
            state.newsTimer = setInterval(function () {
              var current = player.currentTime || 0
              var active = 0
              for (var i = 0; i < starts.length; i += 1) if (current >= starts[i]) active = i
              if (active !== index) {
                index = active
                newsSceneHtml(news.scenes, index)
              }
              var bar = $('#news-progress')
              if (bar) bar.style.width = Math.min(100, (current / (cursor || 1)) * 100) + '%'
            }, 180)
            await player.play().catch(function () {})
          } catch (error) { toast('旁白不可用：' + error.message) } finally { setBusy(this, false) }
        })
      } catch (error) { toast(error.message) } finally { setBusy(this, false) }
    })
  }

  // ---------- 字幕猎人 ----------
  function renderSubtitle(body) {
    body.innerHTML =
      '<div class="panel"><h3>四行字幕，只有一行有鬼</h3>' +
        '<p class="muted">先听旁白，再看字幕。点出你觉得有问题的那一行，然后选出正确说法。</p>' +
        '<button class="btn primary" id="sub-run" type="button">出题</button>' +
      '</div><div class="panel" id="sub-result" hidden></div>'
    $('#sub-run').addEventListener('click', async function () {
      if (!requireModel()) return
      setBusy(this, true, '埋错误…')
      try {
        var data = await post('/api/lab/generate', { feature: 'subtitle-hunter', scope: state.packId })
        var puzzle = data.subtitle
        state.subtitle = { puzzle: puzzle, answered: false, found: false }
        var host = $('#sub-result')
        host.hidden = false
        host.innerHTML = '<h3>' + esc(puzzle.title) + '</h3>' +
          '<div class="audio-row">' + speechButton(puzzle.script, '▶ 听旁白') + '<span class="audio-note">旁白读的是正确版本</span></div>' +
          puzzle.lines.map(function (line, index) {
            return '<button class="subtitle-line" type="button" data-sub-line="' + index + '"><span class="n">' + (index + 1) + '</span><span>' + esc(line) + '</span></button>'
          }).join('') +
          '<div id="sub-feedback"></div>'
        host.querySelectorAll('[data-sub-line]').forEach(function (button) {
          button.addEventListener('click', function () {
            if (state.subtitle.answered || state.subtitle.found) return
            var index = Number(button.getAttribute('data-sub-line'))
            if (index !== puzzle.errorLine) {
              button.classList.add('picked')
              toast('这一行读起来没问题，再听一遍。')
              return
            }
            button.classList.add('ok')
            state.subtitle.found = true
            $('#sub-feedback').innerHTML = '<div class="quiz"><p>找到问题了。选一个正确的替换：</p>' +
              puzzle.options.map(function (option, optionIndex) {
                return '<button class="option" type="button" data-sub-option="' + optionIndex + '">' + esc(option) + '</button>'
              }).join('') + '</div>'
            host.querySelectorAll('[data-sub-option]').forEach(function (optionButton) {
              optionButton.addEventListener('click', function () {
                if (state.subtitle.answered) return
                state.subtitle.answered = true
                var chosen = optionButton.textContent
                var correct = chosen.toLowerCase() === puzzle.correct.toLowerCase()
                host.querySelectorAll('[data-sub-option]').forEach(function (entry) {
                  entry.disabled = true
                  if (entry.textContent.toLowerCase() === puzzle.correct.toLowerCase()) entry.classList.add('correct')
                  if (entry === optionButton && !correct) entry.classList.add('wrong')
                })
                $('#sub-feedback').innerHTML += '<div class="feedback ' + (correct ? 'good' : 'bad') + '">' +
                  (correct ? '命中！' : '差一点。') + ' ' + esc(puzzle.explanation) + '</div>'
              })
            })
          })
        })
      } catch (error) { toast(error.message) } finally { setBusy(this, false) }
    })
  }

  // ---------- 听写诊所 ----------
  function wordsOf(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ').split(/\s+/).filter(Boolean)
  }

  function diffWords(target, typed) {
    var a = wordsOf(target)
    var b = wordsOf(typed)
    var dp = []
    for (var i = 0; i <= a.length; i += 1) {
      dp.push([])
      for (var j = 0; j <= b.length; j += 1) dp[i][j] = 0
    }
    for (var x = 1; x <= a.length; x += 1) {
      for (var y = 1; y <= b.length; y += 1) {
        dp[x][y] = a[x - 1] === b[y - 1] ? dp[x - 1][y - 1] + 1 : Math.max(dp[x - 1][y], dp[x][y - 1])
      }
    }
    var ops = []
    var p = a.length
    var q = b.length
    while (p > 0 || q > 0) {
      if (p > 0 && q > 0 && a[p - 1] === b[q - 1]) {
        ops.unshift({ type: 'same', word: a[p - 1] })
        p -= 1
        q -= 1
      } else if (q > 0 && (p === 0 || dp[p][q - 1] >= dp[p - 1][q])) {
        ops.unshift({ type: 'extra', word: b[q - 1] })
        q -= 1
      } else {
        ops.unshift({ type: 'miss', word: a[p - 1] })
        p -= 1
      }
    }
    var same = ops.filter(function (op) { return op.type === 'same' }).length
    return {
      html: ops.map(function (op) {
        if (op.type === 'same') return '<span>' + esc(op.word) + '</span>'
        if (op.type === 'miss') return '<del>' + esc(op.word) + '</del>'
        return '<ins>' + esc(op.word) + '</ins>'
      }).join(' '),
      accuracy: a.length ? Math.round((same / a.length) * 100) : 0,
    }
  }

  function pickSentences() {
    var snippets = (state.pack && state.pack.snippets || []).slice()
    for (var i = snippets.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1))
      var temp = snippets[i]
      snippets[i] = snippets[j]
      snippets[j] = temp
    }
    return snippets.slice(0, 3)
  }

  function renderDictation(body) {
    state.dictation = { sentences: pickSentences(), index: 0, scores: [] }
    if (!state.dictation.sentences.length) {
      body.innerHTML = '<div class="empty">词库还没有可听写的例句。</div>'
      return
    }
    renderDictationRound(body)
  }

  function renderDictationRound(body) {
    var session = state.dictation
    var snippet = session.sentences[session.index]
    body.innerHTML =
      '<div class="panel"><div class="row"><span class="badge">第 ' + (session.index + 1) + ' / ' + session.sentences.length + ' 句</span>' +
        speechButton(snippet.text, '🔊 正常语速') + speechButton(snippet.text, '🐢 慢速', 0.72) + '</div>' +
        '<label class="field" for="dict-input">写下你听到的句子</label>' +
        '<input id="dict-input" style="width:100%" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type what you hear…">' +
        '<div class="row" style="margin-top:8px"><button class="btn primary" id="dict-check" type="button">检查</button></div>' +
        '<div id="dict-result"></div></div>'
    $('#dict-check').addEventListener('click', function () {
      var field = $('#dict-input')
      if (field.disabled) return
      field.disabled = true
      this.disabled = true
      var typed = field.value.trim()
      var diff = diffWords(snippet.text, typed)
      session.scores.push(diff.accuracy)
      var host = $('#dict-result')
      host.innerHTML = '<div class="diff">' + diff.html + '</div>' +
        '<p class="small muted">词级匹配：' + diff.accuracy + '% · 原文：' + esc(snippet.text) + '</p>' +
        '<div class="row" style="margin-top:8px"><button class="btn" id="dict-next" type="button">下一句</button>' +
          (state.status.llm ? '<button class="btn" id="dict-hint" type="button">AI 听音提示</button>' : '') + '</div>' +
        '<div id="dict-hint-box"></div>'
      $('#dict-next').addEventListener('click', function () {
        session.index += 1
        if (session.index >= session.sentences.length) {
          var average = Math.round(session.scores.reduce(function (sum, value) { return sum + value }, 0) / session.scores.length)
          body.innerHTML = '<div class="panel"><h3>听写完成</h3><p>平均词级匹配：<strong>' + average + '%</strong></p>' +
            '<p class="muted small">红色是漏掉的词，绿色是多余的词。下一轮可以换一个词库范围。</p>' +
            '<button class="btn primary" id="dict-again" type="button">再来一轮</button></div>'
          $('#dict-again').addEventListener('click', function () { renderDictation(body) })
          return
        }
        renderDictationRound(body)
      })
      var hintButton = $('#dict-hint')
      if (hintButton) {
        hintButton.addEventListener('click', async function () {
          setBusy(hintButton, true, '分析中…')
          try {
            var data = await post('/api/lab/generate', { feature: 'dictation-hint', sentence: snippet.text, typed: typed })
            $('#dict-hint-box').innerHTML = '<div class="feedback"><strong>' + esc(data.focus) + '</strong><br>' + esc(data.hint) + '</div>'
          } catch (error) { toast(error.message) } finally { setBusy(hintButton, false) }
        })
      }
    })
    var inputField = $('#dict-input')
    if (inputField) {
      inputField.focus()
      inputField.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault()
          $('#dict-check').click()
        }
      })
    }
  }

  // ---------- AI 配音剧场 ----------
  function renderDubbing(body) {
    body.innerHTML =
      '<div class="panel"><h3>把学习词演出来</h3>' +
        '<p class="muted">AI 会把目标词编成 2–3 个角色的小剧场。选一个角色，先听，再自己读。</p>' +
        '<button class="btn primary" id="dub-run" type="button">生成剧本</button>' +
      '</div><div class="panel" id="dub-result" hidden></div>'
    $('#dub-run').addEventListener('click', async function () {
      if (!requireModel()) return
      setBusy(this, true, '写剧本…')
      try {
        var data = await post('/api/lab/generate', { feature: 'dubbing', scope: state.packId })
        renderDubbingScript($('#dub-result'), data.dubbing)
        $('#dub-result').hidden = false
      } catch (error) { toast(error.message) } finally { setBusy(this, false) }
    })
  }

  function renderDubbingScript(host, script) {
    var selected = script.roles[0]
    function draw() {
      var mine = script.lines.filter(function (line) { return line.role === selected })
      host.innerHTML = '<h3>' + esc(script.title) + '</h3><p class="muted">' + esc(script.setting) + '</p>' +
        '<label class="field">你演谁</label><div class="chips" id="dub-roles">' +
          script.roles.map(function (role) {
            return '<button class="chip' + (role === selected ? ' active' : '') + '" type="button" data-role="' + esc(role) + '">' + esc(role) + '</button>'
          }).join('') + '</div>' +
        '<div class="row" style="margin-bottom:8px">' + speechButton(mine.map(function (line) { return line.text }).join(' '), '🔊 播放我的角色') + '</div>' +
        '<ul class="script">' + script.lines.map(function (line) {
          var isMine = line.role === selected
          return '<li' + (isMine ? ' style="background:var(--accent-soft);margin:0 -8px;padding:9px 8px;border-radius:7px"' : '') + '>' +
            '<span class="speaker">' + esc(line.role) + '</span><span>' + esc(line.text) +
            (line.translation ? '<span class="zh">' + esc(line.translation) + '</span>' : '') +
            '<span style="display:block;margin-top:3px">' + speechButton(line.text, '🔊 听这句') + '</span></span></li>'
        }).join('') + '</ul>' +
        recorderHtml('dub') +
        '<p class="small muted">先听 AI 读，再点录音读你的角色；回放时注意重音和停顿。</p>'
      host.querySelectorAll('[data-role]').forEach(function (button) {
        button.addEventListener('click', function () {
          selected = button.getAttribute('data-role')
          draw()
        })
      })
    }
    draw()
  }

  // ---------- 影子跟读 ----------
  function renderShadowing(body) {
    state.shadow = { sentences: pickSentences(), index: 0 }
    if (!state.shadow.sentences.length) {
      body.innerHTML = '<div class="empty">词库还没有适合跟读的例句。</div>'
      return
    }
    renderShadowRound(body)
  }

  function renderShadowRound(body) {
    var session = state.shadow
    var snippet = session.sentences[session.index]
    body.innerHTML =
      '<div class="panel"><div class="row"><span class="badge">第 ' + (session.index + 1) + ' / ' + session.sentences.length + ' 句</span>' +
        speechButton(snippet.text, '🔊 正常') + speechButton(snippet.text, '🐢 慢速', 0.72) + '</div>' +
        '<div class="quote-text" style="margin:14px 0">' + esc(snippet.text) + '</div>' +
        '<p class="small muted">先听两遍，再跟读。录音只保存在本机，可以反复回放对比。</p>' +
        recorderHtml('shadow') +
        '<div class="row" style="margin-top:10px"><button class="btn" id="shadow-next" type="button">下一句</button></div></div>'
    $('#shadow-next').addEventListener('click', function () {
      session.index += 1
      if (session.index >= session.sentences.length) {
        body.innerHTML = '<div class="panel"><h3>跟读完成</h3><p class="muted">三句都过了一遍。明天可以换一段，重点听连读和句重音。</p>' +
          '<button class="btn primary" id="shadow-again" type="button">再来一轮</button></div>'
        $('#shadow-again').addEventListener('click', function () { renderShadowing(body) })
        return
      }
      renderShadowRound(body)
    })
  }

  // ---------- 单词地牢 ----------
  function shuffle(list) {
    var copy = list.slice()
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1))
      var temp = copy[i]
      copy[i] = copy[j]
      copy[j] = temp
    }
    return copy
  }

  function buildDungeon(items) {
    var rounds = []
    for (var index = 0; index < Math.min(3, items.length); index += 1) {
      var item = items[index]
      var correct = item.definitionZh || item.definition
      var others = items.filter(function (entry) { return entry.id !== item.id })
        .map(function (entry) { return entry.definitionZh || entry.definition })
        .filter(function (value) { return value && value !== correct })
      var options = [correct]
      others.forEach(function (value) { if (options.length < 3 && options.indexOf(value) === -1) options.push(value) })
      if (options.length < 3) continue
      options = shuffle(options)
      rounds.push({
        lemma: item.lemma,
        sentence: item.context || '',
        question: 'Which meaning matches “' + item.lemma + '”?',
        options: options,
        answer: options.indexOf(correct),
        explanation: item.definitionZh || item.definition,
      })
    }
    return rounds
  }

  async function renderDungeon(body) {
    body.innerHTML = '<div class="panel"><div class="loading">正在把到期词摆进地牢…</div></div>'
    var data
    try { data = await api('/api/queue?limit=20&type=word') } catch (error) {
      body.innerHTML = '<div class="empty">' + esc(error.message) + '</div>'
      return
    }
    var items = data.items || []
    var rounds = buildDungeon(items)
    if (rounds.length < 3) {
      body.innerHTML = '<div class="empty">到期词不够开一局。先去复习，攒够至少 3 个词。</div>'
      return
    }
    state.dungeon = { hp: 3, room: 0, rounds: rounds, done: false, won: false, flavor: null, log: [] }
    if (state.status.llm) {
      post('/api/lab/generate', { feature: 'dungeon', scope: state.packId, words: rounds.map(function (round) { return round.lemma }) })
        .then(function (result) {
          if (state.dungeon && !state.dungeon.done) {
            state.dungeon.flavor = result.dungeon
            renderDungeonRound(body)
          }
        }).catch(function () {})
    }
    renderDungeonRound(body)
  }

  function renderDungeonRound(body) {
    var game = state.dungeon
    if (!game) return
    if (game.done) {
      body.innerHTML = '<div class="panel"><h3>' + (game.won ? '🏆 地牢通关' : '💀 这次倒下了') + '</h3>' +
        '<p class="muted">' + (game.won ? (game.flavor ? esc(game.flavor.victory) : '三个房间都清空了。') : 'HP 归零。没关系的，练习局不计入复习。') + '</p>' +
        '<p class="small muted">' + esc(game.log.join(' · ')) + '</p>' +
        '<button class="btn primary" id="dungeon-again" type="button">再来一局</button></div>'
      $('#dungeon-again').addEventListener('click', function () { renderDungeon(body) })
      return
    }
    var room = game.rounds[game.room]
    var flavor = game.flavor && game.flavor.rooms && game.flavor.rooms[game.room]
    body.innerHTML = '<div class="panel"><div class="row" style="justify-content:space-between">' +
      '<span class="hp">' + '❤️'.repeat(game.hp) + '🖤'.repeat(3 - game.hp) + '</span>' +
      '<span class="badge">ROOM ' + (game.room + 1) + ' / 3</span></div>' +
      '<div class="dungeon-room"><div class="enemy">' + esc(flavor ? flavor.enemy : ['THE CLUTTER', 'THE ECHO', 'THE GATEKEEPER'][game.room]) + '</div>' +
      '<h3>' + esc(flavor ? flavor.name : ['词义之门', '语境回廊', '遗忘王座'][game.room]) + '</h3>' +
      '<p class="small muted">' + esc(flavor ? flavor.intro : '用词义击退它。答错扣 1 HP。') + '</p></div>' +
      '<div class="quiz"><p>' + esc(room.question) + '</p>' +
      (room.sentence ? '<p class="small muted">' + esc(room.sentence) + '</p>' : '') +
      room.options.map(function (option, index) {
        return '<button class="option" type="button" data-dungeon-option="' + index + '">' + esc(option) + '</button>'
      }).join('') + '</div>' +
      '<div class="row"><span class="small muted">练习局，不计入 FSRS。</span></div></div>'
    body.querySelectorAll('[data-dungeon-option]').forEach(function (button) {
      button.addEventListener('click', function () {
        var chosen = Number(button.getAttribute('data-dungeon-option'))
        var correct = chosen === room.answer
        body.querySelectorAll('[data-dungeon-option]').forEach(function (entry) {
          entry.disabled = true
          if (Number(entry.getAttribute('data-dungeon-option')) === room.answer) entry.classList.add('correct')
          if (entry === button && !correct) entry.classList.add('wrong')
        })
        if (correct) {
          game.log.push('✓ ' + room.lemma)
          game.room += 1
          if (game.room >= 3) {
            game.done = true
            game.won = true
          }
        } else {
          game.hp -= 1
          game.log.push('✗ ' + room.lemma)
          if (game.hp <= 0) game.done = true
        }
        setTimeout(function () { renderDungeonRound(body) }, 650)
      })
    })
  }

  // ---------- 词汇冒险写作 ----------
  async function renderAdventure(body) {
    body.innerHTML = '<div class="panel"><div class="loading">正在取到期词…</div></div>'
    var data
    try { data = await api('/api/queue?limit=20&type=word') } catch (error) {
      body.innerHTML = '<div class="empty">' + esc(error.message) + '</div>'
      return
    }
    var words = (data.items || []).slice(0, 5)
    if (words.length < 3) {
      body.innerHTML = '<div class="empty">到期词不够。先去复习，攒够至少 3 个词。</div>'
      return
    }
    body.innerHTML = '<div class="panel"><h3>用这些词写一个 50 词故事</h3>' +
      '<div class="chips">' + words.map(function (item) { return '<span class="chip">' + esc(item.lemma) + '</span>' }).join('') + '</div>' +
      '<p class="small muted">目标不是把五个词都塞进去，而是让它们自然地出现。少用一两个也可以。</p>' +
      '<textarea id="adv-text" placeholder="Write a tiny story in 40–70 words…"></textarea>' +
      '<div class="row" style="margin-top:8px"><button class="btn primary" id="adv-run" type="button">让 AI 看看</button></div></div>' +
      '<div class="panel" id="adv-result" hidden></div>'
    $('#adv-run').addEventListener('click', async function () {
      if (!requireModel()) return
      var text = $('#adv-text').value.trim()
      if (!text) return toast('先写几句。')
      setBusy(this, true, '阅读中…')
      try {
        var result = await post('/api/lab/generate', {
          feature: 'word-adventure',
          scope: state.packId,
          words: words.map(function (item) { return item.lemma }),
          text: text,
        })
        var feedback = result.result
        var host = $('#adv-result')
        host.hidden = false
        host.innerHTML = '<h3>AI 的反馈</h3><div class="feedback">' + esc(feedback.feedback) + '</div>' +
          (feedback.natural && feedback.natural.length ? '<p class="small muted">用得自然：' + feedback.natural.map(esc).join('、') + '</p>' : '') +
          (feedback.awkward && feedback.awkward.length ? '<div class="quiz">' + feedback.awkward.map(function (entry) {
            return '<p><strong>' + esc(entry.word) + '</strong>：' + esc(entry.why) + '</p>'
          }).join('') + '</div>' : '') +
          '<h3 style="margin-top:12px">参考改写</h3><div class="feedback good">' + esc(feedback.rewrite) + '</div>'
      } catch (error) { toast(error.message) } finally { setBusy(this, false) }
    })
  }

  // ---------- 启动与全局事件 ----------
  function bindGlobal() {
    var theme = $('#lab-theme')
    if (theme) theme.addEventListener('click', cycleTheme)
    if (window.matchMedia) {
      var media = window.matchMedia('(prefers-color-scheme: dark)')
      var onChange = function () { if (themeChoice() === 'auto') applyTheme('auto') }
      if (media.addEventListener) media.addEventListener('change', onChange)
      else if (media.addListener) media.addListener(onChange)
    }

    var select = $('#lab-scope')
    if (select) {
      select.addEventListener('change', function () {
        load(select.value).catch(function (error) { toast(error.message) })
      })
    }

    var dashboard = $('#lab-dashboard')
    if (dashboard) {
      dashboard.addEventListener('click', function (event) {
        var card = event.target.closest('[data-feature]')
        if (card && !card.disabled) openFeature(card.getAttribute('data-feature'))
      })
    }

    document.addEventListener('click', function (event) {
      var speak = event.target.closest('[data-speak]')
      if (speak) {
        playSpeech(speak.getAttribute('data-speak'), speak)
        return
      }
      var record = event.target.closest('[data-record]')
      if (record) {
        startRecording(record.getAttribute('data-record'))
        return
      }
      var stop = event.target.closest('[data-stop]')
      if (stop) {
        stopRecording(stop.getAttribute('data-stop'))
      }
    })
  }

  async function boot() {
    applyTheme(themeChoice())
    bindGlobal()
    initCustomSelects()
    try {
      await load()
    } catch (error) {
      toast(error.message)
      var host = $('#lab-dashboard')
      if (host) host.innerHTML = '<div class="empty">实验室加载失败：' + esc(error.message) + '</div>'
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
