(function () {
  'use strict'
  var body = document.body
  var packId = body.getAttribute('data-pack-id') || ''
  var total = Number(body.getAttribute('data-total') || 0)
  var read = new Set((body.getAttribute('data-read') || '').split(',').filter(Boolean).map(Number))
  var finished = body.getAttribute('data-finished') === '1'
  var toastTimer = null

  function toast(message) {
    var node = document.getElementById('reader-toast')
    if (!node) return
    node.textContent = message
    node.hidden = false
    clearTimeout(toastTimer)
    toastTimer = setTimeout(function () { node.hidden = true }, 3200)
  }

  function themeChoice() {
    try { return localStorage.getItem('closeread-theme') || 'auto' } catch (error) { return 'auto' }
  }
  function prefersDark() { return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) }
  function applyTheme(choice) {
    var dark = choice === 'dark' || (choice === 'auto' && prefersDark())
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    var button = document.getElementById('reader-theme')
    if (button) button.textContent = choice === 'light' ? '日间' : choice === 'dark' ? '夜间' : '自动'
  }
  function cycleTheme() {
    var order = ['auto', 'light', 'dark']
    var next = order[(order.indexOf(themeChoice()) + 1) % order.length]
    try { localStorage.setItem('closeread-theme', next) } catch (error) {}
    applyTheme(next)
  }

  function paintProgress() {
    var percent = total > 0 ? Math.round((read.size / total) * 100) : 0
    var fill = document.getElementById('reader-fill')
    var label = document.getElementById('reader-percent')
    if (fill) fill.style.width = percent + '%'
    if (label) label.textContent = percent + '%'
    document.querySelectorAll('[data-mark]').forEach(function (button) {
      var index = Number(button.getAttribute('data-mark'))
      button.textContent = read.has(index) ? '✓ 已读' : '标记已读'
      var paragraph = button.closest('.r-para')
      if (paragraph) paragraph.classList.toggle('is-read', read.has(index))
    })
    var finishButtons = [document.getElementById('reader-finish'), document.getElementById('reader-finish-bottom')]
    finishButtons.forEach(function (button) { if (button) button.textContent = finished ? '已完成' : '完成精读' })
  }

  async function save(finishedNow) {
    var ordered = Array.from(read).sort(function (a, b) { return a - b })
    var response = await fetch('/api/packs/' + encodeURIComponent(packId) + '/reading', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        readParagraphs: ordered,
        lastParagraph: ordered.length ? ordered[ordered.length - 1] : 0,
        totalParagraphs: total,
        finished: finishedNow
      })
    })
    var data = await response.json().catch(function () { return {} })
    if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status))
    return data
  }

  async function mark(index) {
    read.add(index)
    paintProgress()
    try {
      await save(false)
      toast('已标记第 ' + (index + 1) + ' 段')
    } catch (error) {
      toast('保存失败：' + error.message)
    }
  }

  async function finish() {
    Array.from({ length: total }, function (_, index) { return index }).forEach(function (index) { read.add(index) })
    finished = true
    paintProgress()
    try {
      await save(true)
      toast('已完成精读，去复习吧。')
    } catch (error) {
      toast('保存失败：' + error.message)
    }
  }

  document.querySelectorAll('[data-mark]').forEach(function (button) {
    button.addEventListener('click', function () { mark(Number(button.getAttribute('data-mark'))) })
  })
  document.querySelectorAll('[data-translate]').forEach(function (button) {
    button.addEventListener('click', function () {
      var index = button.getAttribute('data-translate')
      var block = document.querySelector('[data-translation="' + index + '"]')
      if (!block) return
      block.hidden = !block.hidden
      button.textContent = block.hidden ? '显示翻译' : '隐藏翻译'
    })
  })
  var themeButton = document.getElementById('reader-theme')
  if (themeButton) themeButton.addEventListener('click', cycleTheme)
  if (window.matchMedia) {
    var media = window.matchMedia('(prefers-color-scheme: dark)')
    var onChange = function () { if (themeChoice() === 'auto') applyTheme('auto') }
    if (media.addEventListener) media.addEventListener('change', onChange)
    else if (media.addListener) media.addListener(onChange)
  }
  var finishTop = document.getElementById('reader-finish')
  var finishBottom = document.getElementById('reader-finish-bottom')
  if (finishTop) finishTop.addEventListener('click', finish)
  if (finishBottom) finishBottom.addEventListener('click', finish)
  var audioButton = document.getElementById('reader-audio')
  var player = document.getElementById('reader-player')
  var sentenceEls = Array.prototype.slice.call(document.querySelectorAll('.r-sentence'))
  var sentencePlayer = document.getElementById('reader-sentence-player')
  var sentenceBar = document.getElementById('reader-sentence-bar')
  var sentenceLabel = document.getElementById('reader-sentence-label')
  var sentencePrev = document.querySelector('[data-sentence-prev]')
  var sentenceNext = document.querySelector('[data-sentence-next]')
  var sentenceToggle = document.querySelector('[data-sentence-toggle]')
  var sentenceClose = document.querySelector('[data-sentence-close]')
  var sentenceStart = document.getElementById('reader-sentence-start')
  var sentenceIndex = -1
  var sentenceToken = 0
  var sentenceFallback = false
  var sentenceLoading = false

  function clearSentenceHighlight() {
    sentenceEls.forEach(function (node) { node.classList.remove('is-speaking') })
  }

  function scrollSentenceIntoView(node) {
    if (!node || !node.scrollIntoView) return
    var rect = node.getBoundingClientRect()
    if (rect.top >= 80 && rect.bottom <= window.innerHeight - 90) return
    node.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  function updateSentenceBar() {
    if (!sentenceBar) return
    if (sentenceIndex < 0) {
      sentenceBar.hidden = true
      return
    }
    sentenceBar.hidden = false
    if (sentenceLabel) sentenceLabel.textContent = '第 ' + (sentenceIndex + 1) + ' / ' + sentenceEls.length + ' 句'
    if (sentencePrev) sentencePrev.disabled = sentenceIndex <= 0
    if (sentenceNext) sentenceNext.disabled = sentenceIndex >= sentenceEls.length - 1
    if (sentenceToggle) {
      sentenceToggle.disabled = sentenceLoading
      sentenceToggle.textContent = sentenceLoading
        ? '准备中…'
        : sentenceFallback
          ? '停止'
          : sentencePlayer && !sentencePlayer.paused
            ? '暂停'
            : '播放'
    }
  }

  function stopSentence(hideBar) {
    sentenceToken++
    sentenceFallback = false
    sentenceLoading = false
    if (sentencePlayer) {
      sentencePlayer.pause()
      sentencePlayer.onended = null
      sentencePlayer.onerror = null
      sentencePlayer.removeAttribute('src')
      sentencePlayer.load()
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    clearSentenceHighlight()
    sentenceIndex = -1
    if (hideBar && sentenceBar) sentenceBar.hidden = true
    updateSentenceBar()
  }

  function speakSentenceInBrowser(node, token) {
    if (sentenceFallback) return
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      toast('当前浏览器不支持朗读，也没有可用的本地语音。')
      stopSentence(true)
      return
    }
    sentenceFallback = true
    sentenceLoading = false
    updateSentenceBar()
    window.speechSynthesis.cancel()
    var utterance = new SpeechSynthesisUtterance(node.textContent || '')
    utterance.lang = 'en-US'
    utterance.rate = 0.95
    utterance.onend = function () {
      if (token !== sentenceToken) return
      if (sentenceIndex + 1 < sentenceEls.length) playSentence(sentenceIndex + 1)
      else stopSentence(true)
    }
    utterance.onerror = function () {
      if (token !== sentenceToken) return
      stopSentence(true)
    }
    window.speechSynthesis.speak(utterance)
  }

  function playSentence(index) {
    if (index < 0 || index >= sentenceEls.length) {
      stopSentence(true)
      return
    }
    stopSentence(false)
    var token = ++sentenceToken
    var node = sentenceEls[index]
    sentenceIndex = index
    sentenceFallback = false
    sentenceLoading = true
    clearSentenceHighlight()
    node.classList.add('is-speaking')
    updateSentenceBar()
    scrollSentenceIntoView(node)
    var text = (node.textContent || '').replace(/\s+/g, ' ').trim()
    if (!text) {
      stopSentence(true)
      return
    }
    var paragraph = Number(node.getAttribute('data-para') || 0)
    var local = Number(node.getAttribute('data-sentence') || 0)
    if (sentencePlayer) {
      sentencePlayer.pause()
      sentencePlayer.removeAttribute('src')
      sentencePlayer.load()
    }
    fetch('/api/pack/' + encodeURIComponent(packId) + '/sentence-audio', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paragraph: paragraph, sentence: local })
    }).then(function (response) {
      return response.json().catch(function () { return {} }).then(function (data) {
        if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status))
        return data
      })
    }).then(function (data) {
      if (token !== sentenceToken) return
      if (!data.audio || !sentencePlayer) throw new Error('没有拿到句子音频。')
      sentenceLoading = false
      sentenceFallback = false
      sentencePlayer.onended = function () {
        if (token !== sentenceToken) return
        if (sentenceIndex + 1 < sentenceEls.length) playSentence(sentenceIndex + 1)
        else stopSentence(true)
      }
      sentencePlayer.onerror = function () {
        if (token !== sentenceToken) return
        speakSentenceInBrowser(node, token)
      }
      sentencePlayer.src = data.audio
      updateSentenceBar()
      sentencePlayer.play().catch(function () {
        if (token === sentenceToken) speakSentenceInBrowser(node, token)
      })
    }).catch(function () {
      if (token !== sentenceToken) return
      speakSentenceInBrowser(node, token)
    })
  }

  function toggleSentence() {
    if (sentenceIndex < 0) {
      playSentence(0)
      return
    }
    if (sentenceFallback) {
      stopSentence(true)
      return
    }
    if (!sentencePlayer || sentenceLoading) return
    if (sentencePlayer.paused) sentencePlayer.play().catch(function () { toast('音频暂时无法播放。') })
    else sentencePlayer.pause()
    updateSentenceBar()
  }

  function firstUnreadSentence() {
    for (var index = 0; index < sentenceEls.length; index++) {
      if (!read.has(Number(sentenceEls[index].getAttribute('data-para')))) return index
    }
    return 0
  }

  sentenceEls.forEach(function (node, index) {
    node.addEventListener('click', function () {
      var selection = window.getSelection ? window.getSelection() : null
      if (selection && !selection.isCollapsed && selection.toString().trim()) return
      if (sentenceIndex === index) toggleSentence()
      else playSentence(index)
    })
    node.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      node.click()
    })
  })
  if (sentenceStart) sentenceStart.addEventListener('click', function () { playSentence(firstUnreadSentence()) })
  if (sentencePrev) sentencePrev.addEventListener('click', function () { playSentence(Math.max(0, sentenceIndex - 1)) })
  if (sentenceNext) sentenceNext.addEventListener('click', function () { playSentence(Math.min(sentenceEls.length - 1, sentenceIndex + 1)) })
  if (sentenceToggle) sentenceToggle.addEventListener('click', toggleSentence)
  if (sentenceClose) sentenceClose.addEventListener('click', function () { stopSentence(true) })
  if (sentencePlayer) {
    sentencePlayer.addEventListener('play', updateSentenceBar)
    sentencePlayer.addEventListener('pause', updateSentenceBar)
  }

  if (audioButton && player) {
    audioButton.addEventListener('click', async function () {
      stopSentence(true)
      if (player.paused) {
        var current = player.getAttribute('src')
        if (!current) {
          audioButton.disabled = true
          audioButton.textContent = '生成音频…'
          try {
            var response = await fetch('/api/pack/' + encodeURIComponent(packId) + '/audio', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: '{}'
            })
            var data = await response.json().catch(function () { return {} })
            if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status))
            var relative = data.audio && data.audio.reading
            if (!relative) throw new Error('这篇文章还没有可朗读的正文。')
            current = '/pack/' + encodeURIComponent(packId) + '/' + relative
            player.setAttribute('src', current)
            audioButton.setAttribute('data-src', current)
          } catch (error) {
            toast('音频生成失败：' + error.message)
            return
          } finally {
            audioButton.disabled = false
            audioButton.textContent = '▶ 听全文'
          }
        }
        player.hidden = false
        player.play().catch(function () { toast('音频暂时无法播放。') })
      } else {
        player.pause()
      }
    })
  }

  var selectPop = document.getElementById('reader-select')
  var selectText = document.getElementById('reader-select-text')
  var selectAnalysis = document.getElementById('reader-select-analysis')
  var noteBox = document.getElementById('reader-note-box')
  var noteInput = document.getElementById('reader-note-input')
  var pendingSelection = null
  var selectButtons = selectPop ? Array.prototype.slice.call(selectPop.querySelectorAll('[data-reader-add]')) : []

  function escapeText(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function hideSelection() {
    if (selectPop) selectPop.hidden = true
    if (selectAnalysis) {
      selectAnalysis.hidden = true
      selectAnalysis.innerHTML = ''
    }
    if (noteBox) noteBox.hidden = true
    if (noteInput) noteInput.value = ''
    pendingSelection = null
  }

  function showSelection() {
    if (!selectPop || !selectText) return
    var selection = window.getSelection ? window.getSelection() : null
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return hideSelection()
    var text = selection.toString().replace(/\s+/g, ' ').trim()
    if (!text || text.length > 240) return hideSelection()
    var range = selection.getRangeAt(0)
    var node = selection.anchorNode
    var element = node && node.nodeType === 3 ? node.parentElement : node
    if (!element || !element.closest) return hideSelection()
    var paragraph = element.closest('.r-para')
    var original = paragraph && paragraph.querySelector('.r-original')
    if (!paragraph || !original || !original.contains(element)) return hideSelection()
    var rect = range.getBoundingClientRect()
    if (!rect || (!rect.width && !rect.height)) return hideSelection()
    pendingSelection = {
      text: text,
      paragraph: Number(paragraph.getAttribute('data-para') || 0)
    }
    if (selectAnalysis) {
      selectAnalysis.hidden = true
      selectAnalysis.innerHTML = ''
    }
    if (noteBox) noteBox.hidden = true
    if (noteInput) noteInput.value = ''
    selectText.textContent = text
    var wordButton = selectPop.querySelector('[data-reader-add="word"]')
    if (wordButton) wordButton.hidden = text.split(/\s+/).length > 8
    selectPop.hidden = false
    var left = Math.max(12, Math.min(window.innerWidth - 12, rect.left + rect.width / 2))
    var above = rect.top > 110
    selectPop.style.left = left + 'px'
    selectPop.style.top = (above ? rect.top - 10 : rect.bottom + 10) + 'px'
    selectPop.style.transform = above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)'
  }

  async function analyzeSelection(button) {
    if (!pendingSelection || !selectAnalysis) return
    button.disabled = true
    var label = button.textContent
    button.textContent = '分析中…'
    try {
      var paragraph = document.querySelector('.r-para[data-para="' + pendingSelection.paragraph + '"] .r-original')
      var response = await fetch('/api/pack/' + encodeURIComponent(packId) + '/analyze-selection', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: pendingSelection.text,
          context: paragraph ? paragraph.textContent : ''
        })
      })
      var data = await response.json().catch(function () { return {} })
      if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status))
      var analysis = data.analysis || {}
      pendingSelection.phrase = analysis.phrase || pendingSelection.text
      var lines = []
      if (analysis.meaningZh) lines.push('<b>释义</b> ' + escapeText(analysis.meaningZh))
      if (analysis.translation) lines.push('<b>译文</b> ' + escapeText(analysis.translation))
      if (analysis.annotation) lines.push('<b>提示</b> ' + escapeText(analysis.annotation))
      if (analysis.phrase && analysis.phrase !== pendingSelection.text) lines.push('<b>建议加入</b> ' + escapeText(analysis.phrase))
      if (Array.isArray(analysis.parts) && analysis.parts.length) {
        lines.push('<b>可学的部分</b> ' + analysis.parts.map(function (part) {
          return '<span class="analysis-part">' + escapeText(part.text) + '</span>'
        }).join(''))
      }
      selectAnalysis.innerHTML = lines.join('<br>') || '没有额外的释义；可以直接加入词卡，或展开词卡查看完整释义。'
      selectAnalysis.hidden = false
    } catch (error) {
      selectAnalysis.innerHTML = '分析失败：' + escapeText(error.message)
      selectAnalysis.hidden = false
    } finally {
      button.disabled = false
      button.textContent = label
    }
  }

  async function saveAnnotation(button) {
    if (!pendingSelection) return
    button.disabled = true
    var label = button.textContent
    button.textContent = '保存中…'
    try {
      var response = await fetch('/api/packs/' + encodeURIComponent(packId) + '/annotations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          paragraph: pendingSelection.paragraph,
          quote: pendingSelection.text,
          note: noteInput ? noteInput.value : ''
        })
      })
      var data = await response.json().catch(function () { return {} })
      if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status))
      toast('批注已保存。')
      hideSelection()
      setTimeout(function () { location.reload() }, 450)
    } catch (error) {
      toast('保存批注失败：' + error.message)
    } finally {
      button.disabled = false
      button.textContent = label
    }
  }

  async function addSelection(kind, button) {
    if (!pendingSelection) return
    selectButtons.forEach(function (entry) { entry.disabled = true })
    var label = button.textContent
    button.textContent = '加入中…'
    try {
      var endpoint = kind === 'sentence' ? 'sentence' : 'add'
      var body = kind === 'sentence'
        ? { sentence: pendingSelection.text }
        : { word: pendingSelection.phrase || pendingSelection.text, paragraphIndex: pendingSelection.paragraph }
      var response = await fetch('/api/pack/' + encodeURIComponent(packId) + '/' + endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })
      var data = await response.json().catch(function () { return {} })
      if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status))
      toast(data.duplicate ? '这张卡已经在学习包里了。' : (kind === 'sentence' ? '已加入句子卡。' : '已加入词卡。'))
      hideSelection()
    } catch (error) {
      toast('加入失败：' + error.message)
    } finally {
      selectButtons.forEach(function (entry) { entry.disabled = false })
      button.textContent = label
    }
  }

  if (selectPop) {
    selectPop.querySelectorAll('[data-reader-add]').forEach(function (button) {
      button.addEventListener('click', function () {
        addSelection(button.getAttribute('data-reader-add'), button)
      })
    })
    var analyzeButton = selectPop.querySelector('[data-reader-analyze]')
    if (analyzeButton) analyzeButton.addEventListener('click', function () { analyzeSelection(analyzeButton) })
    var annotateButton = selectPop.querySelector('[data-reader-annotate]')
    if (annotateButton) annotateButton.addEventListener('click', function () {
      if (!noteBox) return
      noteBox.hidden = !noteBox.hidden
      if (!noteBox.hidden && noteInput) noteInput.focus()
    })
    var noteSave = document.getElementById('reader-note-save')
    if (noteSave) noteSave.addEventListener('click', function () { saveAnnotation(noteSave) })
    var closeButton = document.getElementById('reader-select-close')
    if (closeButton) closeButton.addEventListener('click', hideSelection)
    document.addEventListener('mouseup', function (event) {
      if (selectPop.contains(event.target)) return
      setTimeout(showSelection, 0)
    })
    document.addEventListener('touchend', function (event) {
      if (selectPop.contains(event.target)) return
      setTimeout(showSelection, 20)
    })
    document.addEventListener('mousedown', function (event) {
      if (!selectPop.contains(event.target)) hideSelection()
    })
    window.addEventListener('scroll', hideSelection, { passive: true })
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') hideSelection()
    })
  }
  var paragraphs = Array.prototype.slice.call(document.querySelectorAll('.r-para'))
  function toggleNearestTranslation() {
    var middle = window.innerHeight / 2
    var nearest = null
    var distance = Infinity
    paragraphs.forEach(function (paragraph) {
      var rect = paragraph.getBoundingClientRect()
      var next = Math.abs(rect.top + rect.height / 2 - middle)
      if (next < distance) { distance = next; nearest = paragraph }
    })
    if (!nearest) return
    var button = nearest.querySelector('[data-translate]')
    if (button) button.click()
  }
  document.addEventListener('keydown', function (event) {
    var tag = (event.target && event.target.tagName) || ''
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || event.metaKey || event.ctrlKey || event.altKey) return
    if (event.key === '?') {
      event.preventDefault()
      setPanel('outline', false)
      setPanel('type', false)
      setPanel('help', true)
      return
    }
    if (event.key === 't' || event.key === 'T') {
      event.preventDefault()
      toggleNearestTranslation()
      return
    }
    if (event.key !== 'j' && event.key !== 'k' && event.key !== 'J' && event.key !== 'K') return
    event.preventDefault()
    var middle = window.innerHeight / 2
    var index = 0
    paragraphs.forEach(function (paragraph, position) {
      var rect = paragraph.getBoundingClientRect()
      if (rect.top <= middle) index = position
    })
    if (event.key === 'j' || event.key === 'J') index = Math.min(paragraphs.length - 1, index + 1)
    else index = Math.max(0, index - 1)
    var target = paragraphs[index]
    if (target) target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  })
  document.querySelectorAll('[data-annotation-delete]').forEach(function (button) {
    button.addEventListener('click', async function () {
      if (!confirm('删除这条批注？')) return
      button.disabled = true
      try {
        var response = await fetch('/api/packs/' + encodeURIComponent(packId) + '/annotations/' + encodeURIComponent(button.getAttribute('data-annotation-delete')), {
          method: 'DELETE'
        })
        var data = await response.json().catch(function () { return {} })
        if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status))
        toast('批注已删除。')
        setTimeout(function () { location.reload() }, 350)
      } catch (error) {
        button.disabled = false
        toast('删除批注失败：' + error.message)
      }
    })
  })

  var nextHost = document.getElementById('reader-next')
  var nextList = document.getElementById('reader-next-list')
  if (nextHost && nextList) {
    fetch('/api/packs/' + encodeURIComponent(packId) + '/recommend?limit=3')
      .then(function (response) { return response.ok ? response.json() : null })
      .then(function (data) {
        var items = data && data.recommendations ? data.recommendations : []
        if (!items.length) return
        nextList.innerHTML = items.map(function (item) {
          return '<a class="reader-next-card" href="' + escapeText(item.url) + '">' +
            '<b>' + escapeText(item.title) + '</b>' +
            (item.titleZh ? '<small>' + escapeText(item.titleZh) + '</small>' : '') +
            '<small>' + escapeText(item.cefr + ' · ' + item.wordCount + ' 词 · ' + item.readingMinutes + ' 分钟') + '</small>' +
            '<em>' + escapeText(item.reason) + '</em>' +
            '</a>'
        }).join('')
        nextHost.hidden = false
      })
      .catch(function () {})
  }

  function closeReaderMore() {
    var sheet = document.getElementById('reader-mobile-more')
    if (sheet) sheet.hidden = true
  }
  var readerMoreButton = document.querySelector('[data-reader-more]')
  if (readerMoreButton) readerMoreButton.addEventListener('click', function () {
    var sheet = document.getElementById('reader-mobile-more')
    if (sheet) sheet.hidden = !sheet.hidden
  })
  document.querySelectorAll('[data-reader-more-close]').forEach(function (button) {
    button.addEventListener('click', closeReaderMore)
  })
  var readerMore = document.getElementById('reader-mobile-more')
  if (readerMore) readerMore.addEventListener('click', function (event) {
    if (event.target === readerMore) closeReaderMore()
  })

  var focusButton = document.getElementById('reader-focus')
  function applyFocus(on) {
    document.body.classList.toggle('reader-focus', on)
    if (focusButton) {
      focusButton.textContent = on ? '显示侧栏' : '专注'
      focusButton.setAttribute('aria-pressed', on ? 'true' : 'false')
    }
  }
  var focusOn = false
  try { focusOn = localStorage.getItem('closeread-reader-focus') === '1' } catch (error) {}
  applyFocus(focusOn)
  if (focusButton) focusButton.addEventListener('click', function () {
    focusOn = !document.body.classList.contains('reader-focus')
    applyFocus(focusOn)
    try { localStorage.setItem('closeread-reader-focus', focusOn ? '1' : '0') } catch (error) {}
  })


  function prefersReducedMotion() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
}

var typeState = { size: 'md', width: 'md', face: 'serif' }
  try {
    var savedType = JSON.parse(localStorage.getItem('closeread-reader-type') || '{}')
    if (savedType && typeof savedType === 'object') {
      if (savedType.size === 'sm' || savedType.size === 'md' || savedType.size === 'lg') typeState.size = savedType.size
      if (savedType.width === 'sm' || savedType.width === 'md' || savedType.width === 'lg') typeState.width = savedType.width
      if (savedType.face === 'serif' || savedType.face === 'sans') typeState.face = savedType.face
    }
  } catch (error) {}
  function applyType() {
    document.body.classList.remove('type-size-sm', 'type-size-md', 'type-size-lg')
    document.body.classList.remove('type-width-sm', 'type-width-md', 'type-width-lg')
    document.body.classList.remove('type-face-serif', 'type-face-sans')
    document.body.classList.add('type-size-' + typeState.size)
    document.body.classList.add('type-width-' + typeState.width)
    document.body.classList.add('type-face-' + typeState.face)
    document.querySelectorAll('[data-type-size]').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-type-size') === typeState.size)
    })
    document.querySelectorAll('[data-type-width]').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-type-width') === typeState.width)
    })
    document.querySelectorAll('[data-type-face]').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-type-face') === typeState.face)
    })
    try { localStorage.setItem('closeread-reader-type', JSON.stringify(typeState)) } catch (error) {}
  }
  applyType()
  document.querySelectorAll('[data-type-size]').forEach(function (button) {
    button.addEventListener('click', function () { typeState.size = button.getAttribute('data-type-size'); applyType() })
  })
  document.querySelectorAll('[data-type-width]').forEach(function (button) {
    button.addEventListener('click', function () { typeState.width = button.getAttribute('data-type-width'); applyType() })
  })
  document.querySelectorAll('[data-type-face]').forEach(function (button) {
    button.addEventListener('click', function () { typeState.face = button.getAttribute('data-type-face'); applyType() })
  })

  var outlinePanel = document.getElementById('reader-outline-panel')
  var typePanel = document.getElementById('reader-type-panel')
  var helpPanel = document.getElementById('reader-help-panel')
  var searchPanel = document.getElementById('reader-search-panel')
  var outlineButton = document.getElementById('reader-outline')
  var typeButton = document.getElementById('reader-type')
  var helpButton = document.getElementById('reader-help')
  var searchButton = document.getElementById('reader-search')
  function setPanel(name, open) {
    if (name === 'outline' && outlinePanel) outlinePanel.hidden = !open
    if (name === 'type' && typePanel) typePanel.hidden = !open
    if (name === 'help' && helpPanel) helpPanel.hidden = !open
    if (name === 'search' && searchPanel) searchPanel.hidden = !open
    if (outlineButton) outlineButton.setAttribute('aria-expanded', outlinePanel && !outlinePanel.hidden ? 'true' : 'false')
    if (typeButton) typeButton.setAttribute('aria-expanded', typePanel && !typePanel.hidden ? 'true' : 'false')
    if (helpButton) helpButton.setAttribute('aria-expanded', helpPanel && !helpPanel.hidden ? 'true' : 'false')
    if (searchButton) searchButton.setAttribute('aria-expanded', searchPanel && !searchPanel.hidden ? 'true' : 'false')
  }
  if (outlineButton) outlineButton.addEventListener('click', function () {
    var open = outlinePanel && outlinePanel.hidden
    setPanel('type', false)
    setPanel('help', false)
    setPanel('search', false)
    setPanel('outline', open)
  })
  if (typeButton) typeButton.addEventListener('click', function () {
    var open = typePanel && typePanel.hidden
    setPanel('outline', false)
    setPanel('help', false)
    setPanel('search', false)
    setPanel('type', open)
  })
  if (helpButton) helpButton.addEventListener('click', function () {
    var open = helpPanel && helpPanel.hidden
    setPanel('outline', false)
    setPanel('type', false)
    setPanel('search', false)
    setPanel('help', open)
  })
  document.querySelectorAll('[data-outline-link]').forEach(function (link) {
    link.addEventListener('click', function () { setPanel('outline', false) })
  })
  document.addEventListener('click', function (event) {
    if (event.target.closest && event.target.closest('.reader-outline-panel, .reader-type-panel, .reader-help-panel, #reader-outline, #reader-type, #reader-help, #reader-search')) return
    setPanel('outline', false)
    setPanel('type', false)
    setPanel('help', false)
    setPanel('search', false)
  })
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      setPanel('outline', false)
      setPanel('type', false)
      setPanel('help', false)
      setPanel('search', false)
    }
  })

  var searchInput = document.getElementById('reader-search-input')
  var searchCount = document.getElementById('reader-search-count')
  var searchNext = document.getElementById('reader-search-next')
  var searchPrev = document.getElementById('reader-search-prev')
  var searchMatches = []
  var searchIndex = -1

  function clearSearchHit() {
    document.querySelectorAll('.r-para.is-search-hit').forEach(function (node) {
      node.classList.remove('is-search-hit')
    })
  }

  function runSearch(query) {
    clearSearchHit()
    searchMatches = []
    searchIndex = -1
    var needle = String(query || '').trim().toLowerCase()
    if (!needle) {
      if (searchCount) searchCount.textContent = '输入后按回车跳到下一处。'
      return
    }
    paragraphs.forEach(function (paragraph) {
      if ((paragraph.textContent || '').toLowerCase().indexOf(needle) >= 0) searchMatches.push(paragraph)
    })
    if (!searchMatches.length) {
      if (searchCount) searchCount.textContent = '没有找到「' + query + '」。'
      return
    }
    jumpSearch(0)
  }

  function jumpSearch(step) {
    if (!searchMatches.length) return
    clearSearchHit()
    searchIndex = (searchIndex + step + searchMatches.length) % searchMatches.length
    var node = searchMatches[searchIndex]
    node.classList.add('is-search-hit')
    node.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })
    if (searchCount) searchCount.textContent = '第 ' + (searchIndex + 1) + ' / ' + searchMatches.length + ' 处'
  }

  if (searchButton) searchButton.addEventListener('click', function () {
    var open = searchPanel && searchPanel.hidden
    setPanel('outline', false)
    setPanel('type', false)
    setPanel('help', false)
    setPanel('search', open)
    if (open && searchInput) setTimeout(function () { searchInput.focus(); }, 30)
  })
  var searchedQuery = ''
  var searchTimer = null
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer)
      searchTimer = setTimeout(function () {
        searchedQuery = searchInput.value.trim().toLowerCase()
        runSearch(searchInput.value)
      }, 180)
    })
    searchInput.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return
      event.preventDefault()
      var query = searchInput.value.trim().toLowerCase()
      if (query !== searchedQuery) {
        searchedQuery = query
        runSearch(searchInput.value)
        return
      }
      if (searchMatches.length) jumpSearch(event.shiftKey ? -1 : 1)
    })
  }
  if (searchNext) searchNext.addEventListener('click', function () { jumpSearch(1) })
  if (searchPrev) searchPrev.addEventListener('click', function () { jumpSearch(-1) })
  document.addEventListener('keydown', function (event) {
    if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'f') {
      event.preventDefault()
      setPanel('outline', false)
      setPanel('type', false)
      setPanel('help', false)
      setPanel('search', true)
      if (searchInput) { searchInput.focus(); searchInput.select(); }
    }
  })
  document.querySelectorAll('[data-panel-close]').forEach(function (button) {
    button.addEventListener('click', function () { setPanel(button.getAttribute('data-panel-close'), false) })
  })

  applyTheme(themeChoice())
  paintProgress()
  document.body.setAttribute('data-reader-ready', '1')
})()
