// Public forms use native validation; mailto explicitly hands delivery to the visitor's email client.
document.querySelectorAll('form[data-site-form]').forEach(function(form) {
  form.addEventListener('submit', function(event) {
    var status = form.querySelector('[data-form-status]');
    if (form.dataset.formReady !== 'true' || !form.reportValidity()) {
      event.preventDefault();
      if (status) status.textContent = 'Completa i campi e la presa visione della privacy. Il modulo deve avere un recapito configurato.';
      return;
    }
    if (form.hasAttribute('action')) return; // The configured POST service handles delivery and its response.
    event.preventDefault();
    var recipient = form.dataset.recipient || '';
    if (!/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(recipient)) return;
    var data = new FormData(form);
    var body = 'Nome: ' + data.get('name') + '\nEmail: ' + data.get('email') + '\n\n' + data.get('message') + '\n\nInformativa privacy presa in visione.';
    if (status) status.textContent = 'Conferma l’invio nel tuo programma email. Il sito non ha ancora inviato il messaggio.';
    window.location.href = 'mailto:' + encodeURIComponent(recipient) + '?subject=' + encodeURIComponent('Messaggio dal sito') + '&body=' + encodeURIComponent(body);
  });
});
