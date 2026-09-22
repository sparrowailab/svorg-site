#!/usr/bin/env bash
#
# Выкладка sparrow-ai.tech.
#
# Docroot на сервере — это сам git-клон репозитория, поэтому любой файл отсюда
# доступен по http. Скрипт лежит в точечном каталоге намеренно: nginx отдавать
# такие пути наружу отказывается (location ~ /\. в deploy/nginx.conf на сервере).
#
# Запуск:  ./.deploy/deploy.sh
# Хост, docroot и домен переопределяются переменными DEPLOY_*.
#
set -euo pipefail

HOST="${DEPLOY_HOST:-ozon-kz}"
DOCROOT="${DEPLOY_DOCROOT:-/var/www/sparrow-ai}"
SITE="${DEPLOY_SITE:-https://sparrow-ai.tech}"
BRANCH="${DEPLOY_BRANCH:-main}"

step() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die()  { printf '\n\033[31mОстановка: %s\033[0m\n' "$*" >&2; exit 1; }

cd "$(dirname "$0")/.."

step "1/4 Рабочее дерево"
[ "$(git rev-parse --abbrev-ref HEAD)" = "$BRANCH" ] || die "вы не на ветке $BRANCH"
[ -z "$(git status --porcelain)" ] || die "есть незакоммиченные изменения"
want=$(git rev-parse HEAD)
echo "  $BRANCH @ ${want:0:7}"

step "2/4 Пуш в origin"
git push origin "$BRANCH"

step "3/4 Выкладка на $HOST:$DOCROOT"
got=$(ssh "$HOST" "cd '$DOCROOT' && git pull --ff-only origin '$BRANCH' 1>&2 && git rev-parse HEAD")
[ "$got" = "$want" ] || die "на сервере ${got:0:7}, а ожидался ${want:0:7}"
echo "  сервер на ${got:0:7}"

step "4/4 Проверка сайта"
for path in / /styles.css /cases.html /assets/sparrow-mark-dark.svg; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$SITE$path")
  [ "$code" = 200 ] || die "$path отдаёт $code"
  printf '  %-32s %s\n' "$path" "$code"
done
code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$SITE/.git/config")
[ "$code" = 404 ] || die "/.git/config отдаёт $code — служебные файлы открыты наружу"
printf '  %-32s %s\n' "/.git/config" "$code (закрыт)"
curl -sS --max-time 20 "$SITE/" | grep -o '<title>[^<]*</title>' | sed 's/^/  /'

printf '\n\033[32mВыложено.\033[0m\n'
