/* Закреплённый блок «Как это выглядит» — только страница кейса MPShine.
   Секция держит экран, пока по прокрутке сменяются три снимка системы.
   Это единственное место на сайте, где нужен GSAP: закрепить секцию и
   проматывать по ней таймлайн средствами CSS нельзя. Остальной моушен
   остаётся в motion.css и motion.js, этот файл их не трогает.

   Без GSAP, без JS, при `prefers-reduced-motion: reduce` и ниже 901 px
   блок остаётся обычной сеткой из трёх кадров: вёрстка и подписи
   читаются сами, движение — надстройка. */
(function () {
  /* Молча выходим только там, где блок честно устроен иначе: один кадр или
     ни одного — это рабочий случай, обычная сетка справится сама. А вот
     пропавшая секция или сетка значит, что разметку переименовали, а скрипт
     остался подключён: снаружи страница выглядит целой, и заметить это
     без сообщения нельзя. */
  var section = document.querySelector('.shots-section');
  if (!section) {
    if (window.console) console.warn('shots-pin: на странице нет .shots-section, закреплять нечего');
    return;
  }
  var grid = section.querySelector('.shots-grid');
  if (!grid) {
    if (window.console) console.warn('shots-pin: в .shots-section нет .shots-grid, закреплять нечего');
    return;
  }

  var frames = Array.prototype.slice.call(grid.querySelectorAll('.shot-frame'));
  if (frames.length < 2) return;

  if (!window.gsap || !window.ScrollTrigger) {
    // страница сама просит эти файлы, поэтому молчать нельзя: иначе блок
    // выглядит «выключенным нарочно», а на деле не загрузился vendor
    if (window.console) console.warn('shots-pin: нет GSAP или ScrollTrigger, блок снимков остался обычной сеткой');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  var mm = gsap.matchMedia();

  /* Доводка прокрутки после отката ветки — см. комментарий в функции отката.
     Хранится снаружи, чтобы повторный вход в ветку успел её выполнить:
     иначе `scroll-behavior` останется снятым навсегда. */
  var settle = null;
  function runSettle() { if (settle) settle(); }

  /* 760 px высоты — порог, ниже которого на снимок остаётся меньше 300 px:
     закреплять нечего, лучше обычная сетка.
     `hover`/`pointer` отсекают планшеты, которые по ширине прошли бы: там
     высота окна меняется сама, когда при прокрутке убирается адресная строка,
     и длина закрепления пересчитывалась бы под рукой читателя. Тот же гард
     стоит у наведения на кадры в motion-scroll.css. */
  mm.add('(min-width: 901px) and (min-height: 760px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', function () {
    runSettle();
    section.classList.add('shots-pinned');

    /* Класс сам ничего не гарантирует: если shots-pin.css не доехал, кадры
       останутся в трёх колонках по 200 px, а скрипт начнёт их гасить и
       закрепит секцию — человек увидит одну треть блока и пустоту.
       Поэтому спрашиваем у браузера, применилось ли правило сетки. */
    if (String(getComputedStyle(grid).gridTemplateAreas || '').indexOf('stage') < 0) {
      section.classList.remove('shots-pinned');
      if (window.console) console.warn('shots-pin: shots-pin.css не применился, блок снимков остался обычной сеткой');
      return;
    }

    /* `html{scroll-behavior:smooth}` ломает ScrollTrigger: при пересчёте границ
       он на миг отматывает страницу в ноль и читает позицию, а плавная прокрутка
       не успевает — начало блока уезжает ровно на текущую прокрутку, и дальше
       кадры меняются не там. Проверено: с `auto` после `refresh()` границы
       остаются 4095/6525, со `smooth` становятся −905/1525.
       На этой странице якорей внутри страницы нет, терять нечего. */
    var root = document.documentElement;
    var keepBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';

    // точки-шаги: по одной на кадр
    var steps = document.createElement('div');
    steps.className = 'shots-steps';
    steps.setAttribute('aria-hidden', 'true');
    frames.forEach(function () { steps.appendChild(document.createElement('i')); });
    grid.insertAdjacentElement('afterend', steps);
    var dots = Array.prototype.slice.call(steps.children);
    var zooms = frames.map(function (f) { return f.querySelector('.shot-zoom'); });

    /* Кадры гасим прозрачностью, а не `autoAlpha`: `visibility:hidden` убирает
       подписи из дерева доступности, а они здесь и есть доказательство, что
       система существует — читающей программе достаются все три, а не одна.
       Печать и поиск по странице это не спасает: на бумаге погашенные кадры
       всё равно не видны, а подсветка совпадения нарисована в прозрачном кадре.
       Взамен снимаем у погашенных кадров события мыши (все три стоят в одной
       ячейке сетки, иначе клик уйдёт в невидимый верхний), убираем их ссылки
       из обхода Tab и уводим с них фокус. */
    var live = -1;
    function mark(i) {
      if (i === live) return;      // onUpdate зовётся на каждый кадр прокрутки
      live = i;
      dots.forEach(function (d, n) { d.classList.toggle('on', n === i); });
      frames.forEach(function (f, n) { f.classList.toggle('is-live', n === i); });
      zooms.forEach(function (z, n) {
        if (!z) return;
        if (n === i) z.removeAttribute('tabindex');
        else z.setAttribute('tabindex', '-1');
      });
      /* `tabindex` убирает кадр из обхода Tab, но не снимает фокус, который на
         нём уже стоит: человек дошёл Tab'ом до ссылки первого снимка и дальше
         прокручивает колесом. Кольцо фокуса осталось бы внутри прозрачного
         кадра, а Enter открыл бы снимок, которого на экране нет. Поэтому ведём
         фокус за живым кадром. `preventScroll` — иначе `focus()` дёрнет
         закреплённую секцию. */
      var act = document.activeElement;
      if (zooms[i] && act && act !== zooms[i] && zooms.indexOf(act) > -1) {
        zooms[i].focus({ preventScroll: true });
      }
    }
    mark(0);

    // первый кадр виден, остальные ждут своей очереди
    gsap.set(frames[0], { opacity: 1, y: 0 });
    gsap.set(frames.slice(1), { opacity: 0, y: 24 });

    var fade = 0.35;

    var tl = gsap.timeline({ defaults: { ease: 'none', duration: fade } });
    for (var i = 1; i < frames.length; i++) {
      var at = i - fade / 2;
      tl.to(frames[i - 1], { opacity: 0, y: -24 }, at);
      tl.fromTo(frames[i], { opacity: 0, y: 24 }, { opacity: 1, y: 0 }, at);
    }
    /* Хвост: без него последний кадр исчезает на последнем пикселе прокрутки.
       `1 - fade` выравнивает выдержки — у первого кадра она длиннее на половину
       перехода просто потому, что до него ничего не было, у остальных одинаковая.
       Хвост здесь постоянный; равные выдержки держит шаг между переходами, он
       равен единице, поэтому четвёртый снимок не обделит последний. */
    tl.to({}, { duration: 1 - fade });

    // середины переходов в долях таймлайна: точка загорается там, где кадр
    // сменился наполовину, а не по равным третям прокрутки
    var total = tl.duration();
    var bounds = [];
    for (var k = 1; k < frames.length; k++) bounds.push(k / total);

    /* Куда вернуть человека, если окно стало неподходящим, решаем заранее.
       Внутри функции отката это уже не узнать: к тому моменту браузер
       переверстал страницу под новую ширину и сам сдвинул прокрутку —
       замерено, `scrollY` успевает уехать с 5400 на 6538, и человек,
       читавший блок, выглядит ушедшим ниже него. Поэтому пишем ответ на
       прокрутке и только пока ширина та же, при которой блок закреплён:
       события прокрутки, которые браузер шлёт уже при новой ширине, запись
       не портят. Ширину обновляем на пересчёте границ — иначе после любого
       безобидного изменения окна запись замерла бы навсегда. */
    var builtWidth = window.innerWidth;
    var tailEnd = 0;
    var wasInside = false;

    var st = ScrollTrigger.create({
      animation: tl,
      trigger: section,
      // Шапка сайта закреплена сверху и перекрыла бы надпись над заголовком,
      // если центрировать секцию по всему окну. Поэтому середину сдвигаем вниз
      // на половину шапки: секция встаёт по центру того, что под шапкой видно.
      start: function () {
        var nav = document.querySelector('.nav');
        var navH = nav ? nav.getBoundingClientRect().height : 0;
        return 'center center+=' + Math.round(navH / 2);
      },
      // 90% высоты экрана на кадр — решение от 9 октября 2026
      end: function () { return '+=' + Math.round(frames.length * 0.9 * window.innerHeight); },
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      scrub: true,
      invalidateOnRefresh: true,
      onRefresh: function (self) {
        builtWidth = window.innerWidth;
        /* Закрепление кончается, когда сменился третий кадр, но секция после
           этого ещё уезжает с экрана своей высотой — человек всё это время
           смотрит на блок. Поэтому «у блока» считаем до конца секции.
           А вот участок до начала закрепления сюда не входит, хотя секция
           там уже видна снизу: человек только подходит к блоку, и подтянуть
           секцию под шапку значило бы протащить его вперёд через текст,
           который он не прочитал. Там страницу укорачивают ниже него,
           и браузер справляется сам. */
        tailEnd = self.end + section.getBoundingClientRect().height;
      },
      onUpdate: function (self) {
        var n = 0;
        while (n < bounds.length && self.progress >= bounds[n]) n++;
        mark(n);
      }
    });
    function note() {
      if (window.innerWidth !== builtWidth) return;
      var y = window.scrollY;
      wasInside = y >= st.start && y <= tailEnd;
    }
    tailEnd = st.end + section.getBoundingClientRect().height;
    note();
    window.addEventListener('scroll', note, { passive: true });

    /* Шапка и подзаголовок набраны веб-шрифтом: пока он не приехал, высота
       секции другая, а от неё считаются начало и конец закрепления. Свой
       слушатель на `load` здесь не нужен — ScrollTrigger сам пересчитывает
       границы на `load`, `DOMContentLoaded` и `resize`, а шрифт не ждёт никто. */
    if (document.fonts && document.fonts.status !== 'loaded') {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }

    return function () {
      /* Закрепление уже снято, документ стал короче на всю длину прокрутки
         блока, и человека унесло вперёд — мимо секции, которую он читал.
         Вернуть его сразу нельзя: следом ScrollTrigger пересчитывает границы
         и восстанавливает свою запомненную позицию, перетирая нашу —
         проверено, прокрутка становилась 6512 вместо 4082. Поэтому ждём
         события `refresh` (или таймера, если его не будет) и только тогда
         считаем положение секции заново, ставя её под шапку.
         `scroll-behavior` до этого момента держим снятым, чтобы человек не
         ехал туда плавной перемоткой через полстраницы.

         Того, у кого блока на экране уже нет, не трогаем вовсе: страницу над
         ним укоротили, и браузер сам держит прочитанное на месте — замерено,
         сдвиг 0,3 px. Своя доводка там только мешала: пиксельный сдвиг уносил
         человека на 1763 px назад, потому что в одной колонке текст выше и
         прежнее число пикселей указывает уже не на тот абзац. */
      window.removeEventListener('scroll', note);
      var inside = wasInside;
      var timer = 0;
      settle = function () {
        settle = null;
        clearTimeout(timer);
        ScrollTrigger.removeEventListener('refresh', settle0);
        if (inside) {
          var nav = document.querySelector('.nav');
          var navH = nav ? nav.getBoundingClientRect().height : 0;
          var top = window.scrollY + section.getBoundingClientRect().top - navH - 24;
          window.scrollTo(0, Math.max(0, Math.round(top)));
        }
        root.style.scrollBehavior = keepBehavior;
      };
      function settle0() { runSettle(); }
      ScrollTrigger.addEventListener('refresh', settle0);
      timer = setTimeout(settle0, 500);

      section.classList.remove('shots-pinned');
      frames.forEach(function (f) { f.classList.remove('is-live'); });
      zooms.forEach(function (z) { if (z) z.removeAttribute('tabindex'); });
      steps.remove();
    };
  });
})();
