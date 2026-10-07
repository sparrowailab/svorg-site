# Выкладка sparrow-ai.tech

Лежит в точечном каталоге намеренно: docroot сайта — сам клон репозитория, и nginx
не отдаёт наружу пути, начинающиеся с точки. Здесь адреса, которых не должно быть
в публичных файлах.

## Где живёт сайт

| | |
|---|---|
| Хост | ssh-алиас `ozon-kz` |
| Docroot | `/var/www/sparrow-ai` — git-клон этого репозитория, ветка `main` |
| Веб-сервер | контейнер `ozon-calculator-nginx-1` проекта `/root/ozon-calculator` |
| Конфиг | `/root/ozon-calculator/deploy/nginx.conf`, блок `server_name sparrow-ai.tech` |
| Монт | `/var/www/sparrow-ai` → `/var/www/sparrow-ai` (ro), строка в `docker-compose.yml` |

Тот же nginx обслуживает `ozon-calculator.ru` и зеркало `sparrow-ai.ru`. Перезапуск
контейнера задевает их тоже: правки конфига применять через `nginx -s reload`,
а не пересозданием, и после каждой проверять все три домена.

## Выкладка

    ./.deploy/deploy.sh

Пушит в origin, делает `git pull --ff-only` в docroot, сверяет, что сервер встал
на тот же коммит, и проверяет домен. Перезапуск nginx не нужен: статика читается
с диска через монт.

## Что настроено отдельно

- Служебные пути закрыты: `location ~ /\.(?!well-known) { return 404; }` в блоке сайта.
  Исключение для `well-known` оставлено ради продления сертификата.
- Сертификат продлевает `certbot renew --webroot -w /var/www/certbot` по 80-му порту.
- Старый docroot был в `/root/.gemini/antigravity/scratch/` — скрэтч-папке чужого
  инструмента. Переехал в `/var/www/sparrow-ai`, старая копия удалена.
