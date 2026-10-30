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


  // Dates and labels are generated into the initial HTML from one agenda source.
  // This guard only expires choices between deployments; it never invents dates.
  var presentationSelect = document.getElementById('presentation');
  var expiredSelection = false;
  function refreshDates() {
    var now = Date.now();
    var count = 0;
    document.querySelectorAll('[data-poa-start]').forEach(function(card) {
      var start = Date.parse(card.dataset.poaStart);
      if (!Number.isFinite(start) || start <= now) {
        var archive = card.closest('section')?.querySelector('[data-presentation-archive] ul');
        var date = card.dataset.poaStart.slice(0, 10);
        if (archive && !archive.querySelector('[data-presentation-date="' + date + '"]')) {
          var item = document.createElement('li');
          item.dataset.presentationDate = date;
          item.textContent = (card.querySelector('time') || card.querySelector('h3')).textContent.trim();
          archive.append(item);
        }
        card.remove();
      } else {
        count++;
      }
    });
    document.querySelectorAll('[data-poa-option]').forEach(function(option) {
      var start = Date.parse(option.dataset.poaOption);
      if (!Number.isFinite(start) || start <= now) {
        if (option.selected) expiredSelection = true;
        option.remove();
      }
    });
    if (expiredSelection && presentationSelect) presentationSelect.selectedIndex = 0;
    document.querySelectorAll('optgroup[data-meeting-format]').forEach(function(group) {
      if (!group.children.length) group.remove();
    });
    var empty = document.querySelector('[data-agenda-empty]');
    if (empty) empty.hidden = count > 0;
    return expiredSelection;
  }
  refreshDates();
  // Recheck a tab that stayed open across the start of a presentation.
  window.addEventListener('pageshow', refreshDates);
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) refreshDates();
  });
  if (presentationSelect) {
    presentationSelect.addEventListener('focus', refreshDates);
    presentationSelect.addEventListener('change', function() { expiredSelection = false; });
  }
  document.querySelectorAll('.agenda-card a[data-presentation-id]').forEach(function(link) {
    link.addEventListener('click', function(event) {
      refreshDates();
      if (!link.isConnected) {
        event.preventDefault();
        return;
      }
      // French external registration links keep their existing destination.
      if (!link.hasAttribute('data-presentation') || !presentationSelect) return;
      var option = Array.from(presentationSelect.options).find(function(candidate) {
        return candidate.dataset.presentationId === link.dataset.presentationId;
      });
      if (!option) { event.preventDefault(); return; }
      presentationSelect.value = option.value;
      expiredSelection = false;
      document.getElementById('name')?.focus({preventScroll:true});
    });
  });
  var form = document.querySelector('[data-contact-form]');
  if (form) {
    var busy = false;
    form.addEventListener('submit', async function(event) {
      event.preventDefault();
      if (refreshDates()) {
        var dateStatus = form.querySelector('[data-form-status]');
        var dateMessages = {
          fr: 'Cette présentation a commencé. Choisissez un autre rendez-vous ou un entretien individuel.',
          es: 'Esta presentación ya ha comenzado. Elige otra fecha o una conversación individual.',
          ca: 'Aquesta presentació ja ha començat. Tria una altra data o una conversa individual.',
          pt: 'Esta apresentação já começou. Escolha outra data ou uma conversa individual.',
          it: 'Questa presentazione è già iniziata. Scegli un’altra data o un colloquio individuale.',
          de: 'Diese Präsentation hat bereits begonnen. Wählen Sie einen anderen Termin oder ein persönliches Gespräch.',
          en: 'This presentation has started. Choose another date or an individual conversation.'
        };
        if (dateStatus) {
          dateStatus.textContent = dateMessages[document.documentElement.lang.slice(0, 2)] || dateMessages.fr;
          dateStatus.dataset.error = '';
          dateStatus.hidden = false;
        }
        presentationSelect?.focus();
        expiredSelection = false;
        return;
      }
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
      body.set('action','lead_capture');
      body.set('source_site','Team Lucky');
      body.set('page',location.href.split('#')[0]);
      body.set('referent',document.referrer);
      body.set('submission_id',form.dataset.submissionId||(form.dataset.submissionId=crypto.randomUUID()));
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
        form.reset(); delete form.dataset.submissionId;
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

// Recruitment planning entry point; the detailed page is currently in French.

// Reprise temporaire des coordonnées dans le même onglet, sans inscription automatique.
(()=>{try{const key='lucky-simulation-contact',raw=sessionStorage.getItem(key);if(!raw)return;const data=JSON.parse(raw);sessionStorage.removeItem(key);if(Date.now()-data.at>30*60*1000)return;const form=document.querySelector('[data-contact-form]');if(!form)return;['name','email','phone','city'].forEach(name=>{const field=form.elements.namedItem(name);if(field&&!field.value)field.value=data[name]||'';});}catch{}})();
