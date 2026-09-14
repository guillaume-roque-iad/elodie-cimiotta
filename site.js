(function () {
  'use strict';

  var toggle = document.querySelector('.menu-toggle');
  var menu = document.querySelector('.nav-links');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  document.querySelectorAll('[data-year]').forEach(function (node) {
    node.textContent = String(new Date().getFullYear());
  });

  var reveal = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveal.forEach(function (node) { observer.observe(node); });
  } else {
    reveal.forEach(function (node) { node.classList.add('visible'); });
  }

  var form = document.querySelector('[data-contact-form]');
  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      var data = new FormData(form);
      var labels = JSON.parse(form.getAttribute('data-mail-labels') || '{}');
      var subject = labels.subject || 'Projet professionnel avec Élodie Cimiotta';
      var lines = [
        (labels.name || 'Nom') + ' : ' + (data.get('name') || ''),
        (labels.email || 'Email') + ' : ' + (data.get('email') || ''),
        (labels.phone || 'Téléphone') + ' : ' + (data.get('phone') || ''),
        (labels.city || 'Ville') + ' : ' + (data.get('city') || ''),
        (labels.country || 'Pays') + ' : ' + (data.get('country') || ''),
        (labels.situation || 'Situation') + ' : ' + (data.get('situation') || ''),
        '',
        (labels.message || 'Message') + ' :',
        data.get('message') || ''
      ];
      window.location.href = 'mailto:elodie.cimiotta@iadespana.es?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
    });
  }
})();
