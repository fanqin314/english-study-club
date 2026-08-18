/* ============================================================
   speech.js — 发音封装（Web Speech API / SpeechSynthesis）
   生词本「发音」、练习听写等场景复用。无可用语音时静默失败。
   ============================================================ */
(function (global) {
  'use strict';
  const Mobile = (global.Mobile = global.Mobile || {});

  let cachedVoices = [];
  function loadVoices() {
    if (!('speechSynthesis' in window)) return [];
    cachedVoices = window.speechSynthesis.getVoices() || [];
    return cachedVoices;
  }
  if ('speechSynthesis' in window) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  function pickVoice() {
    const en = cachedVoices.filter((v) => /en[-_]/i.test(v.lang) || /english/i.test(v.name));
    return en[0] || cachedVoices[0] || null;
  }

  function speak(text, opts = {}) {
    if (!('speechSynthesis' in window) || !text) return false;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) u.voice = v;
      u.lang = (v && v.lang) || 'en-US';
      u.rate = opts.rate || 0.95;
      u.pitch = opts.pitch || 1;
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) {
      console.warn('[speech] speak failed', e);
      return false;
    }
  }

  function stop() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  Mobile.Speech = { speak, stop, supported: () => 'speechSynthesis' in window };
})(window);
