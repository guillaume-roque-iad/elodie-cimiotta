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


  function refreshDates() {
    var count = 0;
    document.querySelectorAll('[data-poa-start]').forEach(function(card) {
      card.hidden = Date.parse(card.dataset.poaStart) <= Date.now();
      if (!card.hidden) count++;
    });
    document.querySelectorAll('[data-poa-option]').forEach(function(option) {
      if (Date.parse(option.dataset.poaOption) <= Date.now()) option.remove();
    });
    var empty = document.querySelector('[data-agenda-empty]');
    if (empty) empty.hidden = count > 0;
  }
  refreshDates();
  document.querySelectorAll('[data-presentation]').forEach(function(link) {
    link.addEventListener('click', function() {
      refreshDates();
      document.getElementById('presentation').value = link.dataset.presentation;
      document.getElementById('name').focus({preventScroll:true});
    });
  });
  var form = document.querySelector('[data-contact-form]');
  if (form) {
    var busy = false;
    form.addEventListener('submit', async function(event) {
      event.preventDefault();
      if (busy || !form.reportValidity()) return;
      var fields = new FormData(form);
      if (fields.get('societe')) return;
      var ui = JSON.parse(form.dataset.formUi);
      var button = form.querySelector('[type=submit]');
      var status = form.querySelector('[data-form-status]');
      var original = button.innerHTML;
      var body = new FormData();
      body.set('nom', fields.get('name') || '');
      body.set('email', fields.get('email') || '');
      body.set('telephone', fields.get('phone') || '');
      body.set('ville', fields.get('city') || '');
      body.set('situation', fields.get('situation') || '');
      body.set('disponibilite', fields.get('presentation') || 'Échange individuel avec Élodie');
      body.set('consentement', fields.get('consentement') || '');
      body.set('societe', '');
      body.set('message', '[TEAM LUCKY — Élodie Cimiotta]\n'
        + 'Contact souhaité : Élodie Cimiotta\n'
        + 'Pays : ' + (fields.get('country') || '') + '\n'
        + 'Présentation : ' + (fields.get('presentation') || 'Échange individuel') + '\n'
        + 'Langue : ' + document.documentElement.lang + '\n'
        + 'Source : ' + location.origin + location.pathname + '\n'
        + 'Consentement : Élodie Cimiotta et Guillaume Roque, suivi partagé\n\n'
        + (fields.get('message') || ''));
      busy = true; button.disabled = true; button.textContent = ui.sending;
      status.hidden = true; status.removeAttribute('data-error');
      var controller = new AbortController();
      var timer = setTimeout(function(){controller.abort();},25000);
      try {
        var response = await fetch('https://script.google.com/macros/s/AKfycbz6ZtOtnaGlVn0vLQr-kBl5aIjmCr2oCBlfJFzq8EiVZVpsG4gTRREGtLxAWQFbn8360Q/exec', {method:'POST', body:body, signal:controller.signal});
        if (!response.ok) throw new Error('HTTP');
        var result = await response.json();
        if (result.ok !== true) throw new Error('Unconfirmed');
        status.textContent = ui.success; status.hidden = false; status.focus();
        form.reset();
      } catch(error) {
        status.textContent = ui.error; status.dataset.error = ''; status.hidden = false; status.focus();
      } finally {
        clearTimeout(timer); busy = false; button.disabled = false; button.innerHTML = original;
      }
    });
  }
})();


// Accès au simulateur France depuis les pages du site.
(()=>{const nav=document.querySelector('.nav-links');if(!nav||nav.querySelector('a[href="/simulateur"]'))return;const a=document.createElement('a');a.href='/simulateur';const lang=document.documentElement.lang.split('-')[0];a.textContent=({fr:'Simulateur',es:'Simulador (FR)',ca:'Simulador (FR)',pt:'Simulador (FR)',it:'Simulatore (FR)',de:'Simulator (FR)',en:'Simulator (FR)'})[lang]||'Simulateur (FR)';nav.insertBefore(a,nav.querySelector('.btn'));a.addEventListener('click',()=>{nav.classList.remove('open');document.querySelector('.menu-toggle')?.setAttribute('aria-expanded','false');});})();
