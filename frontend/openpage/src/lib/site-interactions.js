// Shared by self-contained exports and the PHP public page (CSP: script-src self).
var homeMeta = document.querySelector('meta[name="sts-home"]');
if (homeMeta) {
  document.querySelectorAll('.site-render a[href="#progetti"], .site-render a[href="#projects"]').forEach(function(link) {
    if (document.getElementById(link.hash.slice(1))) return;
    var heading = Array.from(document.querySelectorAll('.site-render h2')).find(function(item) { return /progett|iniziativ|applicativ|projects/i.test(item.textContent); });
    var section = heading && heading.closest('[id]');
    if (section) link.href = '#' + section.id;
  });
  // Repair stock scaffolding in already-published Italian drafts without dropping sections.
  if (document.documentElement.lang.toLowerCase().startsWith('it')) {
    var firstMenu = document.querySelector('[data-site-menu-links]');
    var firstBrand = firstMenu && firstMenu.closest('nav').querySelector('strong');
    document.querySelectorAll('[data-site-menu-links]').forEach(function(menu) {
      var brand = menu.closest('nav').querySelector('strong');
      if (brand && brand.textContent.trim() === 'Brand' && firstBrand && brand !== firstBrand) {
        brand.textContent = firstBrand.textContent;
        var destinations = { Features: 'Progetti', Pricing: 'Contatti', About: 'Chi Sono', Contact: 'Contatti' };
        menu.querySelectorAll('a').forEach(function(link) {
          var label = destinations[link.textContent.trim()];
          if (!label) return;
          var source = Array.from(firstMenu.querySelectorAll('a')).find(function(item) { return item.textContent.trim().toLowerCase() === label.toLowerCase(); });
          link.textContent = label;
          link.href = source ? source.href : homeMeta.content + '#sts-contact';
        });
      }
    });
    document.querySelectorAll('.site-render a').forEach(function(link) {
      if (link.textContent.trim() === 'Learn More') link.textContent = 'Scopri di più';
      if (link.textContent.trim() === 'Get Started') { link.textContent = 'Contattami'; link.href = homeMeta.content + '#sts-contact'; }
    });
  }
  document.querySelectorAll('[data-site-menu-links]').forEach(function(menu) {
    var home = Array.from(menu.querySelectorAll('a')).find(function(link) { return link.textContent.trim().toLowerCase() === 'home'; });
    if (!home) { home = document.createElement('a'); home.textContent = 'Home'; home.className = 'text-text-1 hover:text-green'; }
    home.href = homeMeta.content;
    menu.prepend(home);
  });
}
document.querySelectorAll('[data-site-menu]').forEach(function(button) {
      button.addEventListener('click', function() {
        var open = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(open));
        var links = button.closest('nav').querySelector('[data-site-menu-links]');
        if (links) { links.classList.toggle('hidden', !open); links.classList.toggle('flex', open); }
      });
    });
    document.querySelectorAll('[data-faq-toggle]').forEach(function(button) {
      button.addEventListener('click', function() {
        var open = button.getAttribute('aria-expanded') !== 'true';
        button.closest('section').querySelectorAll('[data-faq-toggle]').forEach(function(other) {
          var expanded = other === button && open;
          other.setAttribute('aria-expanded', String(expanded));
          other.nextElementSibling.style.maxHeight = expanded ? '500px' : '0';
          other.nextElementSibling.style.paddingBottom = expanded ? '1rem' : '0';
          var chevron = other.querySelector('svg');
          if (chevron) { chevron.classList.toggle('rotate-180', expanded); chevron.classList.toggle('text-green', expanded); }
        });
      });
    });
