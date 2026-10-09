#!/usr/bin/env bash
#
# Выкладка sparrow-ai.tech.
#
# Docroot на сервере — это сам git-клон репозитория, поэтому любой файл отсюда
# доступен по http. Скрипт лежит в точечном каталоге намеренно: nginx отдавать
# такие пути наружу отказывается. Адреса и устройство сервера — в .deploy/README.md.
#
# Запуск:  ./.deploy/deploy.sh
# Хост, docroot, домен и ветка переопределяются переменными DEPLOY_*.
#
set -euo pipefail

HOST="${DEPLOY_HOST:-ozon-kz}"
DOCROOT="${DEPLOY_DOCROOT:-/var/www/sparrow-ai}"
SITE="${DEPLOY_SITE:-https://sparrow-ai.tech}"
BRANCH="${DEPLOY_BRANCH:-main}"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=10 -o ServerAliveCountMax=3)

prev=""
step() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() {
  printf '\n\033[31mОстановка: %s\033[0m\n' "$*" >&2
  [ -n "$prev" ] && printf 'Сервер уже обновлён, предыдущий коммит %s. Порядок отката — в .deploy/README.md\n' "${prev:0:7}" >&2
  exit 1
}
# код 200 с двумя повторами: транзиентный сбой не должен валить выкладку
http() {
  local path="$1" code try
  for try in 1 2 3; do
    code=$(curl -sS -o /dev/null --max-time 20 -H 'Cache-Control: no-cache' -w '%{http_code}' "$SITE$path" 2>/dev/null) || code=000
    [ "$code" = "200" ] && { echo "$code"; return 0; }
    [ "$try" -lt 3 ] && sleep 2
  done
  echo "$code"
}

cd "$(dirname "$0")/.."

step "1/4 Рабочее дерево"
[ "$(git rev-parse --abbrev-ref HEAD)" = "$BRANCH" ] || die "вы не на ветке $BRANCH"
[ -z "$(git status --porcelain)" ] || die "есть незакоммиченные изменения"
want=$(git rev-parse HEAD)
echo "  $BRANCH @ ${want:0:7}"

step "2/4 Пуш в origin"
git push origin "$BRANCH"

step "3/4 Выкладка на $HOST:$DOCROOT"
out=$(ssh "${SSH_OPTS[@]}" "$HOST" "
  cd '$DOCROOT' || exit 11
  git rev-parse HEAD || exit 12
  git symbolic-ref --short HEAD || exit 13
  git pull --ff-only origin '$BRANCH' 1>&2 || exit 14
  git rev-parse HEAD || exit 15
  git status --porcelain | wc -l || exit 16
") || die "ssh или git pull завершились с кодом $?; origin уже на ${want:0:7}, состояние сервера не подтверждено — проверьте: ssh $HOST \"git -C $DOCROOT status\""
prev=$(sed -n 1p <<<"$out"); branch=$(sed -n 2p <<<"$out")
got=$(sed -n 3p <<<"$out");  dirty=$(sed -n 4p <<<"$out" | tr -d ' ')
[ "$branch" = "$BRANCH" ] || die "на сервере ветка «$branch», ожидалась «$BRANCH»"
[ "$got" = "$want" ] || die "на сервере ${got:0:7}, а ожидался ${want:0:7}"
[ "$dirty" = "0" ] || die "в docroot $dirty изменённых или лишних файлов — отдаётся не содержимое коммита"
echo "  сервер на ${got:0:7}, было ${prev:0:7}, дерево чистое"

step "4/4 Проверка сайта"
# Байтовая сверка: коды 200 не доказывают, что отдана новая версия.
# vendor/*.js сверяем так же, а не кодом 200: обрезанная копия библиотеки
# отдаётся с кодом 200, блок снимков от неё молча вернётся к обычной сетке,
# и по виду страницы этого не заметить.
for f in styles.css index.html motion.css motion.js shots-pin.js shots-pin.css \
         vendor/gsap.min.js vendor/ScrollTrigger.min.js; do
  curl -sS --max-time 25 -H 'Cache-Control: no-cache' "$SITE/$f?d=$want" \
    | cmp -s - "$f" || die "$f на домене не совпадает с локальным — отдаётся другая версия"
  printf '  %-32s совпадает побайтово\n' "/$f"
done
for path in /cases.html /assets/sparrow-mark-dark.svg \
            /assets/mp-hero.jpg /assets/mp-anom.jpg /assets/mp-queue.jpg; do
  code=$(http "$path"); [ "$code" = "200" ] || die "$path отдаёт $code"
  printf '  %-32s %s\n' "$path" "$code"
done
# служебные пути должны быть закрыты: наш nginx отвечает 404, deny all дал бы 403
code=$(curl -sS -o /dev/null --max-time 20 -w '%{http_code}' "$SITE/.git/config" 2>/dev/null) || code=000
case "$code" in 403|404) printf '  %-32s %s (закрыт)\n' "/.git/config" "$code" ;;
  *) die "/.git/config отдаёт $code — служебные файлы открыты наружу" ;; esac

printf '\n\033[32mВыложено.\033[0m  %s → %s\n' "${prev:0:7}" "${want:0:7}"
