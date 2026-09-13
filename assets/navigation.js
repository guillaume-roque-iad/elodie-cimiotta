(() => {
  const button = document.querySelector('.menu-toggle');
  const menu = document.getElementById('main-menu');
  if (!button || !menu) return;
  const close = () => { button.setAttribute('aria-expanded', 'false'); menu.classList.remove('is-open'); };
  button.addEventListener('click', () => { const open = button.getAttribute('aria-expanded') !== 'true'; button.setAttribute('aria-expanded', String(open)); menu.classList.toggle('is-open', open); });
  menu.addEventListener('click', e => { if (e.target.closest('a')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { close(); button.focus(); } });
})();

// Élodie accompagne exclusivement les acquéreurs pour les biens en France.
(() => {
 const country = document.querySelector('#fme [name="pays"]');
 const project = document.querySelector('#fme [name="projet"]');
 if (!country || !project) return;
 const note = document.createElement('p');
 note.setAttribute('role','status');
 note.style.cssText='font-size:14px;line-height:1.6;margin:12px 0';
 const locale=document.documentElement.lang;
 note.innerHTML='En France, Élodie accompagne uniquement les acquéreurs. Pour vendre ou faire estimer votre bien, contactez <a href="mailto:guillaume.roque@iadfrance.fr">Guillaume Roque</a> au <a href="tel:+33662108396">06 62 10 83 96</a>.';
 if(locale==='es') note.innerHTML='En Francia, Élodie acompaña únicamente a compradores. Para vender o valorar su propiedad, contacte con <a href="mailto:guillaume.roque@iadfrance.fr">Guillaume Roque</a> en el <a href="tel:+33662108396">06 62 10 83 96</a>.';
 if(locale==='ca') note.innerHTML='A França, Élodie acompanya exclusivament els compradors. Per vendre o valorar el vostre immoble, contacteu amb <a href="mailto:guillaume.roque@iadfrance.fr">Guillaume Roque</a> al <a href="tel:+33662108396">06 62 10 83 96</a>.';
 project.parentElement.after(note);
 function sync(){
  const france=country.value==='France';
  note.hidden=!france;
  [...project.options].forEach(option=>{
   const seller=/Vendre|Estimer/.test(option.value);
   if(seller){option.disabled=france;option.hidden=france;if(france&&option.selected)project.value='';}
  });
 }
 country.addEventListener('change',sync);sync();
})();

// Preserve the current section when switching language, if one is selected.
document.querySelectorAll('.language-switcher a').forEach(a => {
 a.addEventListener('click', () => { if(location.hash && !a.hash) a.hash=location.hash; });
});
