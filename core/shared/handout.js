/* ============================================================
   shared/handout.js — 可打印讲义/测验导出 核心（两端复用）
   · 面向桌面端 features/history/history_detail_ui.js 与移动端
     views/history_detail.js 的「导出讲义/测验」功能。
   · 纯计算 + 工具：生成独立 HTML、打开打印窗口、下载文件、
     从文章聚合生词。不依赖 Vue 等框架，不直接操作应用内 DOM。
   · 挂载：window.EnglishStudyShared.Handout
   ============================================================ */
(function (global) {
  'use strict';

  var Shared = (global.EnglishStudyShared = global.EnglishStudyShared || {});
  var Handout = (Shared.Handout = Shared.Handout || {});

  // 转义 HTML 特殊字符
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 正则特殊字符转义
  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // 简单拆句（仅在未提供 article.sentences 时兜底）
  function splitSentences(text) {
    var s = String(text || '');
    var m = s.match(/[^.!?。！？]+[.!?。！？]*/g);
    return m && m.length ? m : (s ? [s] : []);
  }

  // 在句子列表中查找首次包含该词的原句（忽略大小写、按词边界匹配）
  function findExample(word, sentences) {
    var re = new RegExp('\\b' + escapeRegExp(word) + '\\b', 'i');
    for (var i = 0; i < sentences.length; i++) {
      var sentence = String(sentences[i]);
      if (re.test(sentence)) return sentence;
    }
    return '';
  }

  // 把句子中首次出现的该词替换为下划线（挖空）
  function makeCloze(sentence, word) {
    var s = String(sentence == null ? '' : sentence);
    if (!s || !word) return s;
    var re = new RegExp('\\b(' + escapeRegExp(word) + ')\\b', 'i');
    var m = s.match(re);
    if (m) {
      return s.slice(0, m.index) + '________' + s.slice(m.index + m[0].length);
    }
    return s;
  }

  /* ---------------- 构建讲义 HTML ---------------- */
  /**
   * 生成完整独立 HTML 字符串（含 DOCTYPE / meta / 内联 CSS / 打印样式）。
   * @param {{title:string, text:string, fullTranslation?:string, words:Array}} opts
   *        words: [{word, pos, meaning, example}]
   * @returns {string}
   */
  function buildHandout(opts) {
    opts = opts || {};
    var title = opts.title || '英语学习讲义';
    var text = String(opts.text || '').replace(/\r\n?/g, '\n');
    var fullTranslation = opts.fullTranslation || '';
    var words = opts.words || [];

    var dateStr = new Date().toLocaleDateString('zh-CN');
    var total = words.length;

    // —— 原文段落（保留换行，每段 <p>）——
    var parasHtml = '';
    var paras = text.split(/\n{2,}/);
    for (var i = 0; i < paras.length; i++) {
      var p = paras[i].trim();
      if (!p) continue;
      parasHtml += '<p class="para">' + esc(p) + '</p>';
    }
    if (!parasHtml) parasHtml = '<p class="muted">（无原文）</p>';

    // —— 全文翻译（可选）——
    var translationSection = fullTranslation
      ? '<h2>全文翻译</h2><p class="translation">' + esc(fullTranslation) + '</p>'
      : '';

    // —— 生词表（表格：单词 / 词性 / 释义 / 例句）——
    var vocabRows = '';
    for (var v = 0; v < words.length; v++) {
      var w = words[v];
      vocabRows += '<tr>'
        + '<td>' + esc(w.word) + '</td>'
        + '<td class="pos">' + esc(w.pos) + '</td>'
        + '<td>' + esc(w.meaning || '—') + '</td>'
        + '<td class="example">' + esc(w.example || '—') + '</td>'
        + '</tr>';
    }
    var vocabSection = total > 0
      ? '<h2>生词表（' + total + ' 个）</h2>'
        + '<table class="vocab-table"><thead><tr><th>单词</th><th>词性</th><th>释义</th><th>例句</th></tr></thead>'
        + '<tbody>' + vocabRows + '</tbody></table>'
      : '<h2>生词表</h2><p class="muted">本篇暂未标注生词。</p>';

    // —— 挖空练习（逐条、序号）——
    var clozeHtml = '';
    for (var c = 0; c < words.length; c++) {
      var cw = words[c];
      var cloze = makeCloze(cw.example, cw.word);
      clozeHtml += '<div class="cloze-item">'
        + '<span class="num">' + (c + 1) + '.</span>'
        + '<span class="cloze-text">' + (cloze ? esc(cloze) : '<span class="muted">（无例句）</span>') + '</span>'
        + '</div>';
    }
    var clozeSection = total > 0
      ? '<h2>挖空练习</h2><p class="hint">根据上下文填入适当的单词。</p>' + clozeHtml
      : '';

    // —— 答案区（对应每条给出 word）——
    var ansHtml = '';
    for (var a = 0; a < words.length; a++) {
      var aw = words[a];
      var ans = esc(aw.word)
        + (aw.pos ? ' · ' + esc(aw.pos) : '')
        + (aw.meaning ? ' — ' + esc(aw.meaning) : '');
      ansHtml += '<div class="ans-item"><span class="num">' + (a + 1) + '.</span><span class="ans-word">' + ans + '</span></div>';
    }
    var ansSection = total > 0
      ? '<h2 class="page-break">答案</h2><div class="answers">' + ansHtml + '</div>'
      : '';

    var css = ''
      + '*{box-sizing:border-box}'
      + 'body{margin:0;background:#f2f4f7;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.7}'
      + '.toolbar{position:sticky;top:0;display:flex;align-items:center;gap:14px;padding:12px 20px;background:#fff;border-bottom:1px solid #e5e7eb;z-index:10}'
      + '.toolbar button{padding:8px 18px;font-size:14px;border:none;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer}'
      + '.toolbar button:hover{background:#1d4ed8}'
      + '.toolbar-hint{color:#6b7280;font-size:13px}'
      + '.handout{max-width:820px;margin:24px auto;padding:36px 44px;background:#fff;border-radius:12px;box-shadow:0 1px 6px rgba(0,0,0,.08)}'
      + 'h1.title{margin:0 0 6px;font-size:26px;color:#111827}'
      + '.meta{margin:0 0 24px;color:#6b7280;font-size:13px}'
      + 'h2{margin:28px 0 12px;font-size:18px;color:#111827;border-left:4px solid #2563eb;padding-left:10px}'
      + 'p.para{margin:0 0 12px;white-space:pre-wrap;word-break:break-word}'
      + 'p.translation{color:#374151}'
      + '.hint{color:#6b7280;font-size:13px;margin:0 0 12px}'
      + '.muted{color:#9ca3af}'
      + 'table.vocab-table{width:100%;border-collapse:collapse;font-size:14px}'
      + 'table.vocab-table th,table.vocab-table td{border:1px solid #e5e7eb;padding:8px 10px;text-align:left;vertical-align:top}'
      + 'table.vocab-table th{background:#f9fafb;color:#374151;font-weight:600}'
      + 'table.vocab-table td.pos{white-space:nowrap;color:#2563eb}'
      + 'table.vocab-table td.example{color:#4b5563}'
      + '.cloze-item,.ans-item{display:flex;gap:10px;padding:8px 0;border-bottom:1px dashed #e5e7eb;page-break-inside:avoid}'
      + '.num{flex-shrink:0;font-weight:600;color:#2563eb;min-width:26px}'
      + '.cloze-text{flex:1}'
      + '.ans-word{font-weight:600;color:#111827}'
      + '.answers{margin-bottom:8px}'
      + '@media print{'
      +   '.no-print{display:none !important}'
      +   'body{background:#fff}'
      +   '.handout{max-width:none;margin:0;padding:0;box-shadow:none;border-radius:0}'
      +   'h2.page-break{page-break-before:always}'
      +   'table.vocab-table tr,.cloze-item,.ans-item{break-inside:avoid}'
      + '}'
      + '@page{size:A4;margin:14mm}';

    return '<!DOCTYPE html>\n'
      + '<html lang="zh-CN">\n'
      + '<head>\n'
      + '<meta charset="UTF-8">\n'
      + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
      + '<title>' + esc(title) + '</title>\n'
      + '<style>' + css + '</style>\n'
      + '</head>\n<body>\n'
      + '<div class="toolbar no-print">'
      +   '<button type="button" onclick="window.print()">打印</button>'
      +   '<span class="toolbar-hint">提示：可直接使用「打印」（Ctrl/Cmd + P）输出，或另存为 PDF。</span>'
      + '</div>\n'
      + '<main class="handout">'
      +   '<h1 class="title">' + esc(title) + '</h1>'
      +   '<p class="meta">生成日期：' + esc(dateStr) + ' ｜ 生词数：' + total + ' 个</p>'
      +   '<section><h2>原文</h2>' + parasHtml + '</section>'
      +   translationSection
      +   '<section>' + vocabSection + '</section>'
      +   clozeSection
      +   ansSection
      + '</main>\n'
      + '</body>\n</html>';
  }

  /* ---------------- 打开打印窗口 ---------------- */
  /**
   * 新窗口打开讲义 HTML；窗口内含顶部「打印」按钮。
   * @returns {Window|null} 打开的窗口（被拦截时为 null）
   */
  function openHandout(html) {
    var w = global.open('', '_blank');
    if (!w) return null;
    w.document.open();
    w.document.write(html);
    w.document.close();
    return w;
  }

  /* ---------------- 下载为 .html 文件 ---------------- */
  /** Blob 下载 text/html;charset=utf-8 */
  function downloadHandout(filename, html) {
    var blob = new Blob(['\uFEFF' + html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'handout.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 100);
  }

  /* ---------------- 聚合文章生词 ---------------- */
  /**
   * 从文章聚合生词（按小写去重）。
   * @param {object} article { originalText, fullTranslation, sentences, sentenceData }
   *        sentenceData: { 0: { pos: { pos: [ {word, pos}, ... ] } } }
   * @param {object} [opts] { getMeaning: async (word, pos) => string | '' }
   *        回调返回字符串作为释义；也可返回 { meaning, pos } 对象以覆盖词性。
   * @returns {Promise<Array<{word,pos,meaning,example}>>}
   */
  function collectWords(article, opts) {
    opts = opts || {};
    var sd = (article && article.sentenceData) || {};
    var sentences = (article && article.sentences) || [];
    if (!Array.isArray(sentences)) sentences = [];
    if (!sentences.length && article && article.originalText) {
      sentences = splitSentences(article.originalText);
    }

    // 按小写去重，保留首次出现的原词与标注词性
    var seen = {};
    var order = [];
    for (var key in sd) {
      var item = sd[key];
      if (!item || !item.pos || typeof item.pos !== 'object') continue;
      var arr = item.pos.pos;
      if (!Array.isArray(arr)) continue;
      for (var j = 0; j < arr.length; j++) {
        var el = arr[j];
        if (!el || !el.word) continue;
        var low = String(el.word).toLowerCase();
        if (!seen[low]) {
          seen[low] = { word: String(el.word), pos: el.pos || '' };
          order.push(low);
        }
      }
    }

    return Promise.all(order.map(function (low) {
      var info = seen[low];
      var p = opts.getMeaning ? opts.getMeaning(info.word, info.pos) : '';
      return Promise.resolve(p).then(function (cb) {
        var meaning = '';
        var cbPos = '';
        if (cb && typeof cb === 'object') {
          meaning = cb.meaning || '';
          cbPos = cb.pos || '';
        } else {
          meaning = cb || '';
        }
        // 词性：优先用标注值，标注缺失时取回调返回的词性
        var pos = info.pos || cbPos || '';
        return {
          word: info.word,
          pos: pos,
          meaning: meaning,
          example: findExample(info.word, sentences)
        };
      });
    }));
  }

  Handout.buildHandout = buildHandout;
  Handout.openHandout = openHandout;
  Handout.downloadHandout = downloadHandout;
  Handout.collectWords = collectWords;
})(typeof window !== 'undefined' ? window : globalThis);
