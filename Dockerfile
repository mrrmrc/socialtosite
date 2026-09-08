# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS frontend-build
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/index.html frontend/vite.config.js ./
COPY frontend/public ./public
COPY frontend/src ./src
RUN npm run build

FROM php:8.3-apache-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl libcurl4-openssl-dev libonig-dev libxml2-dev \
    && docker-php-ext-install -j"$(nproc)" curl mbstring pdo_mysql xml \
    && a2enmod headers rewrite \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html
COPY --from=frontend-build /build/frontend/dist/ ./
COPY api/index.php ./api/index.php
COPY api/middleware/jwt.php api/middleware/response.php api/middleware/ratelimit.php ./api/middleware/
COPY api/routes/auth.php ./api/routes/auth.php
COPY api/services/raw_import.php api/services/refetcher.php api/services/website_source.php ./api/services/
COPY config/db.php config/config.docker.php ./config/
COPY docker/apache-vhost.conf /etc/apache2/sites-available/000-default.conf
COPY docker/entrypoint.sh /usr/local/bin/linkseoweb-entrypoint

RUN cp config/config.docker.php config/config.php \
    && chmod -R a+rX /var/www/html \
    && chmod +x /usr/local/bin/linkseoweb-entrypoint

EXPOSE 80
ENTRYPOINT ["linkseoweb-entrypoint"]
CMD ["apache2-foreground"]
