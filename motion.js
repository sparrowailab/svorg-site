/* Движение Sparrow · счётчики и пары «было → стало».
   Без JS страница полностью читается: финальные числа стоят в HTML,
   скрипт только проигрывает к ним путь. Один раз, без повторов. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;

  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
  var inHero = function (el) { return !!el.closest('.hero'); };

  /* Счётчик: 900 мс, только целые числа (50+, 12, 4, 2) */
  function count(el) {
    var target = parseInt(el.dataset.target, 10);
    if (!(target > 1)) return;
    var pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
    var t0 = null, dur = 900, done = false, fin = pre + target + suf;
    el.textContent = pre + '0' + suf;
    // вкладка ушла в фон посреди счёта — ставим финал, а не «3+»
    document.addEventListener('visibilitychange', function () {
      if (!done) { done = true; el.textContent = fin; }
    }, { once: true });
    function step(ts) {
      if (done) return;
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      el.textContent = pre + Math.round(target * ease(k)) + suf;
      if (k < 1) requestAnimationFrame(step); else done = true;
    }
    requestAnimationFrame(step);
  }

  var counters = [].slice.call(document.querySelectorAll('[data-target]'));
  var pairs = [].slice.call(document.querySelectorAll('.ba'));
  pairs.forEach(function (el) { el.classList.add('ba-wait'); });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      io.unobserve(el);
      // в hero ждём, пока плашка со статистикой доедет на место
      var delay = inHero(el) ? (el.classList.contains('ba') ? 620 : 260) : 0;
      setTimeout(function () {
        if (el.classList.contains('ba')) el.classList.remove('ba-wait');
        else count(el);
      }, delay);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.4 });

  counters.forEach(function (el) { io.observe(el); });
  pairs.forEach(function (el) { io.observe(el); });
})();
