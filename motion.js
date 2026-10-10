/* Движение Sparrow · счётчики и пары «было → стало». Без JS страница
   читается целиком: финальные числа стоят в HTML, скрипт только
   проигрывает к ним путь. Один раз, без повторов. */
/* ---------- Устаивание страницы: общий механизм для всех появлений ---------- */
/* Одного прохода при загрузке мало: первый экран устаивается позже скрипта.
   Якорь приземляет читателя не в начало, и место приземления ползёт, пока
   дорисовываются шрифты и снимки (index.html#price: scrollY от 3619 до 4159
   px). Поэтому проход на каждом кадре: раз в 100 мс сдвиг вёрстки успевал
   попасть между тиками, и блок на десятую секунды мигал. Останавливаемся,
   как только читатель сам тронул страницу: колесо, палец, клавиша, нажатие.
   Якорь, довёрстка и скрытие адресной строки таких событий не дают — по ним
   и отличаем движение браузера от движения человека. Скрипт замера их тоже
   не даёт: ему нужно сперва дать `mouse.wheel`, иначе он увидит мёртвую
   страницу. */
var mTouched = false, mScrolled = 0;
['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (ev) {
  addEventListener(ev, function () { mTouched = true; }, { passive: true, once: true });
});
addEventListener('scroll', function () { mScrolled = Date.now(); }, { passive: true });

/* Якорь особый: при `scroll-behavior: smooth` событие приходит сразу, а
   прокрутка ещё едет; серия уже остановлена — щелчок сам дал `pointerdown`.
   Поэтому для якоря проходим заново, не глядя на ввод (замерено:
   index.html#why, .founder оставался на opacity 0). */
function mSettleAnchor(pass) {
  var until = Date.now() + 1500;
  (function step() {
    pass();
    if (Date.now() < until) requestAnimationFrame(step);
  })();
}

function mSettle(pass) {
  pass();
  if (mTouched) return;
  var until = Date.now() + 2000;
  requestAnimationFrame(function step() {
    pass();
    if (!mTouched && Date.now() < until) requestAnimationFrame(step);
  });
}

/* Окно изменили — проход заново: снизу открывается полоса, которой при
   первом проходе не было (замерено: products.html, 1440x900 -> 1440x1800,
   .products-grid высотой 1078 px с opacity 0,03). Задержка нужна из-за
   телефона: при первой прокрутке прячется адресная строка, окно растёт и
   приходит `resize`; без неё блок посередине появления скачком стал бы
   непрозрачным на глазах. */
function mOnResize(pass) {
  var timer = 0;
  function run() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (Date.now() - mScrolled < 400) return;
      pass();
    }, 150);
  }
  addEventListener('resize', run);
  addEventListener('orientationchange', run);
}

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

  /* Пара в нижней части экрана в наблюдатель не попадает: снизу отрезано
     12%, и нужно 40% площади. Если страница так и встала — у конца
     документа или после якоря, — «стало» осталось бы невидимым до
     прокрутки, а её может и не быть. Поэтому всё видимое показываем само.
     Ждём 700 мс: в hero на пару заказана задержка 620 мс. */
  function baShow() {
    var vh = innerHeight;
    pairs.forEach(function (el) {
      if (!el.classList.contains('ba-wait')) return;
      if (el.getBoundingClientRect().top >= vh) return;
      io.unobserve(el);
      el.classList.remove('ba-wait');
    });
  }
  setTimeout(function () { mSettle(baShow); }, 700);
  /* Только настоящий возврат из кэша: `pageshow` приходит и на обычной
     загрузке, сразу за `load`, и снял бы отметку раньше своих 700 мс —
     «→ 1%» опередило бы плашку (замерено: 701 мс вместо 1012). */
  addEventListener('pageshow', function (e) { if (e.persisted) mSettle(baShow); });
  addEventListener('hashchange', function () { mSettleAnchor(baShow); });
  mOnResize(baShow);
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

/* ---------- «До и после»: запасной путь там, где нет scroll-таймлайна ---------- */
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;
  // где есть view()-таймлайн, колонку набирает CSS — JS не нужен
  if (window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()')) return;

  var tables = [].slice.call(document.querySelectorAll('.compare'));
  if (!tables.length) return;

  tables.forEach(function (table) {
    var cells = [].slice.call(table.querySelectorAll('tbody td:nth-child(3), tbody td:nth-child(4)'));
    if (!cells.length) return;
    cells.forEach(function (td) { td.classList.add('cmp-wait'); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var rows = [].slice.call(table.querySelectorAll('tbody tr'));
        rows.forEach(function (tr, i) {
          setTimeout(function () {
            [].slice.call(tr.querySelectorAll('td:nth-child(3), td:nth-child(4)'))
              .forEach(function (td, j) {
                setTimeout(function () { td.classList.remove('cmp-wait'); }, j * 70);
              });
          }, i * 110);
        });
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.25 });

    io.observe(table);
  });
})();

/* ---------- Появление блоков: что уже в первом экране, то не приходит ---------- */
/* Блок, стоящий при загрузке внизу экрана, читателя встречал посередине
   анимации — вплоть до полной прозрачности: появление привязано к нижней
   кромке окна. Отмечаем такие блоки `m-seen` и только потом разрешаем
   появление классом `m-ready` — до этого страница читается целиком.
   Проход повторяется, пока страница устаивается, и после разворота окна,
   якоря, возврата «назад» и шрифтов; механизм в начале файла. */
(function () {
  var root = document.documentElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!(window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()'))) return;

  var SEL = 'body > section:not(:first-of-type) > *:not(.shots-grid):not(.case-grid):not(.compare),'
          + '.case-grid > .case-card,.compare tbody td,.shot-frame';

  function mark() {
    var vh = innerHeight;
    [].slice.call(document.querySelectorAll(SEL)).forEach(function (el) {
      if (el.classList.contains('m-seen')) return;
      if (el.getBoundingClientRect().top < vh) el.classList.add('m-seen');
    });
  }

  mSettle(mark);
  root.classList.add('m-ready');
  mOnResize(mark);
  addEventListener('hashchange', function () { mSettleAnchor(mark); });
  addEventListener('pageshow', function (e) { if (e.persisted) mSettle(mark); });
  addEventListener('load', function () { mSettle(mark); });
  /* Tab доводит фокус до ссылки, браузер доскроливает её минимально — к
     кромке, где блок ещё прозрачный, и человек не видит ни ссылку, ни рамку
     фокуса (замерено: .proof-more, opacity 0,12). Серия тут бессильна: Tab —
     это `keydown`, он её и останавливает. Показываем блок сразу. */
  addEventListener('focusin', function (e) {
    var el = e.target && e.target.closest && e.target.closest(SEL);
    if (el) el.classList.add('m-seen');
  });
  /* Шрифты доезжают и двигают вёрстку — но только пока читатель не начал
     листать сам: иначе поздняя загрузка сняла бы появление у блоков,
     к которым он как раз подошёл. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { if (!mTouched) mark(); });
  }
})();

/* ---------- Отложенные снимки: догрузить сразу после первого экрана ---------- */
/* Семь снимков на mpshine и opencowork отмечены `loading="lazy"`: они далеко
   внизу. Но к печати браузер отложенный снимок не грузит — лист уходил с
   пустыми рамками (naturalWidth 0), а `beforeprint` не спасает: лист уже
   свёрстан. Снимаем отметку в событии `load`, когда первый экран отрисован:
   цена 4 мс из 1444. В разметке нельзя — те же снимки отнимают канал у
   styles.css и отодвигают первый экран на 400 мс. Цифры и остаточная щель —
   в решении от 10 октября в docs/DESIGN.md. */
addEventListener('load', function () {
  [].slice.call(document.querySelectorAll('img[loading="lazy"]'))
    .forEach(function (img) { img.loading = 'eager'; });
});
