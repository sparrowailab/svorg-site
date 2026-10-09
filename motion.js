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

/* ---------- объём: наклон под курсором ---------- */
(function () {
  // медиазапросы спрашиваем в момент события: мышь могут подключить позже,
  // а в превью-панели при загрузке они ещё не устоялись
  var mqFine = matchMedia('(hover: hover) and (pointer: fine)');
  var mqCalm = matchMedia('(prefers-reduced-motion: reduce)');
  function live() { return mqFine.matches && !mqCalm.matches; }

  // знак в первом экране ведёт за курсором
  var scene = document.querySelector('.hero-3d');
  var hero = document.querySelector('.hero');
  if (scene && hero) {
    var raf = 0, mx = 0, my = 0;
    hero.addEventListener('pointermove', function (e) {
      if (!live()) return;
      var r = hero.getBoundingClientRect();
      my = ((e.clientX - r.left) / r.width - 0.5) * 7;
      mx = (0.5 - (e.clientY - r.top) / r.height) * 5;
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
    hero.addEventListener('pointerleave', function () {
      mx = my = 0;
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
    function apply() {
      raf = 0;
      scene.style.setProperty('--mx', mx.toFixed(2) + 'deg');
      scene.style.setProperty('--my', my.toFixed(2) + 'deg');
    }
  }

  // слои расходятся при прокрутке там, где нет scroll-таймлайна (Safari)
  var noTimeline = !(window.CSS && CSS.supports && CSS.supports('animation-timeline', 'scroll()'));
  if (scene && noTimeline && !mqCalm.matches) {
    var sraf = 0;
    var onScroll = function () {
      if (sraf) return;
      sraf = requestAnimationFrame(function () {
        sraf = 0;
        var p = Math.min(1, Math.max(0, window.scrollY / (innerHeight * 0.78)));
        scene.style.setProperty('--sp', p.toFixed(3));
      });
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // карточки наклоняются под курсором
  var sel = '.case-card, .pc, .direction, .product-card';
  var craf = 0, pending = null;
  document.addEventListener('pointermove', function (e) {
    if (!live()) return;
    var card = e.target.closest && e.target.closest(sel);
    if (!card) return;
    pending = { card: card, x: e.clientX, y: e.clientY };
    if (craf) return;
    craf = requestAnimationFrame(function () {
      craf = 0;
      if (!pending) return;
      var c = pending.card, r = c.getBoundingClientRect();
      c.style.setProperty('--tx', (((pending.x - r.left) / r.width - 0.5) * 8).toFixed(2) + 'deg');
      c.style.setProperty('--ty', ((0.5 - (pending.y - r.top) / r.height) * 6).toFixed(2) + 'deg');
      c.classList.add('tilt');
    });
  }, { passive: true });
  document.addEventListener('pointerout', function (e) {
    var card = e.target.closest && e.target.closest(sel);
    if (!card || (e.relatedTarget && card.contains(e.relatedTarget))) return;
    pending = null;
    card.classList.remove('tilt');
    card.style.removeProperty('--tx');
    card.style.removeProperty('--ty');
  }, { passive: true });
})();
