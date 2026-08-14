<div class="name-wall" data-wall>
  <?php foreach ($wallProfiles as $profile): $profileArticles = array_slice($profileWallArticles[$profile['slug']] ?? [], 0, 3); $logo = discoverImage($profile['logo_url'] ?? ''); ?>
    <article class="profile-block" data-search="<?= htmlspecialchars($profile['title'] . ' ' . $profile['description'], ENT_QUOTES, 'UTF-8') ?>">
      <div class="profile-top">
        <?php if ($logo): ?><img class="avatar" src="<?= htmlspecialchars($logo, ENT_QUOTES, 'UTF-8') ?>" alt="" loading="lazy"><?php else: ?><span class="avatar" aria-hidden="true"><?= htmlspecialchars(strtoupper(substr($profile['title'], 0, 1)), ENT_QUOTES, 'UTF-8') ?></span><?php endif; ?>
        <div><h3><?= htmlspecialchars($profile['title'], ENT_QUOTES, 'UTF-8') ?></h3><small><?= (int)$profile['post_count'] ?> contenuti pubblicati</small></div>
      </div>
      <div class="profile-stories">
        <?php foreach ($profileArticles as $article): ?><a class="profile-story" href="/<?= rawurlencode($article['site_slug']) ?>/<?= rawurlencode($article['slug']) ?>"><strong><?= htmlspecialchars($article['title'], ENT_QUOTES, 'UTF-8') ?></strong><span><?= htmlspecialchars(discoverDate($article['published_at']), ENT_QUOTES, 'UTF-8') ?></span></a><?php endforeach; ?>
      </div>
      <a class="profile-link" href="/<?= rawurlencode($profile['slug']) ?>">Visita lo spazio →</a>
    </article>
  <?php endforeach; ?>
</div>
