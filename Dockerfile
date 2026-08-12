# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS frontend-build
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-bookworm-slim AS scraper-build
ENV PUPPETEER_SKIP_DOWNLOAD=true
WORKDIR /build/scraper
COPY scraper/package*.json ./
RUN npm ci --omit=dev

FROM php:8.3-apache-bookworm

ENV APACHE_DOCUMENT_ROOT=/var/www/html \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_DOWNLOAD=true

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates chromium curl ffmpeg libcurl4-openssl-dev libonig-dev libxml2-dev \
    && docker-php-ext-install -j"$(nproc)" curl mbstring pdo_mysql xml \
    && a2enmod headers rewrite \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html
COPY . ./
COPY --from=frontend-build /build/frontend/dist/ ./
COPY --from=frontend-build /usr/local/bin/node /usr/local/bin/node
COPY --from=scraper-build /build/scraper/node_modules/ ./scraper/node_modules/
COPY docker/apache-vhost.conf /etc/apache2/sites-available/000-default.conf
COPY docker/entrypoint.sh /usr/local/bin/linkseoweb-entrypoint
COPY docker/run-cron.sh /usr/local/bin/linkseoweb-cron
RUN cp config/config.docker.php config/config.php \
    && chmod -R a+rX /var/www/html \
    && chmod +x /usr/local/bin/linkseoweb-entrypoint /usr/local/bin/linkseoweb-cron \
    && mkdir -p public/media \
    && chown -R www-data:www-data public/media

EXPOSE 80
ENTRYPOINT ["linkseoweb-entrypoint"]
CMD ["apache2-foreground"]
