# Fase 1: Compilazione del Frontend (React + Vite)
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# Fase 2: Configurazione Server Web (Apache + PHP 8)
FROM php:8.2-apache

# Abilita moduli di Apache necessari
RUN a2enmod rewrite headers

# Installa dipendenze di sistema ed estensioni PHP per le API e DB
RUN apt-get update && apt-get install -y \
    libzip-dev \
    unzip \
    curl \
    && docker-php-ext-install pdo pdo_mysql mysqli zip

# Configura php.ini (per dare più memoria ed esecuzione lunga a Gemini/Apify)
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" && \
    sed -i 's/memory_limit = 128M/memory_limit = 1024M/g' "$PHP_INI_DIR/php.ini" && \
    sed -i 's/max_execution_time = 30/max_execution_time = 300/g' "$PHP_INI_DIR/php.ini" && \
    sed -i 's/upload_max_filesize = 2M/upload_max_filesize = 50M/g' "$PHP_INI_DIR/php.ini" && \
    sed -i 's/post_max_size = 8M/post_max_size = 50M/g' "$PHP_INI_DIR/php.ini"

WORKDIR /var/www/html

# Copia l'intero progetto (backend, configurazioni, script)
COPY . ./

# Rimuovi eventuale cartella frontend originaria dal container (occupa solo spazio, ci serve solo la dist compilata)
RUN rm -rf frontend/

# Copia il frontend compilato (file statici in radice) dalla Fase 1
COPY --from=frontend-builder /app/dist/ ./

# Crea la cartella media per i volumi e imposta i permessi per Apache
RUN mkdir -p /var/www/html/public/media \
    && chown -R www-data:www-data /var/www/html

EXPOSE 80
