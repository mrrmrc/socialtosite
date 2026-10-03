// Shared by self-contained exports and the PHP public page (CSP: script-src self).
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
