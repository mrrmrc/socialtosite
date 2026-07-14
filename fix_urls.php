<?php
require_once 'config/db.php';
DB::query("UPDATE posts SET media_url = REPLACE(media_url, 'https://socialtosite.sviluppo.host', 'https://allsocialtoweb.com')");
DB::query("UPDATE posts SET source_url = REPLACE(source_url, 'https://socialtosite.sviluppo.host', 'https://allsocialtoweb.com')");
DB::query("UPDATE drafts SET media_url = REPLACE(media_url, 'https://socialtosite.sviluppo.host', 'https://allsocialtoweb.com')");
DB::query("UPDATE drafts SET source_url = REPLACE(source_url, 'https://socialtosite.sviluppo.host', 'https://allsocialtoweb.com')");
DB::query("UPDATE social_sources SET url = REPLACE(url, 'https://socialtosite.sviluppo.host', 'https://allsocialtoweb.com')");
DB::query("UPDATE sites SET logo_url = REPLACE(logo_url, 'https://socialtosite.sviluppo.host', 'https://allsocialtoweb.com')");
DB::query("UPDATE sites SET cover_url = REPLACE(cover_url, 'https://socialtosite.sviluppo.host', 'https://allsocialtoweb.com')");
echo "Fatto";
