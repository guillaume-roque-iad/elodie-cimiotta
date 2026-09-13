(() => {
  const button = document.querySelector('.menu-toggle');
  const menu = document.getElementById('main-menu');
  if (!button || !menu) return;
  const close = () => { button.setAttribute('aria-expanded', 'false'); menu.classList.remove('is-open'); };
  button.addEventListener('click', () => { const open = button.getAttribute('aria-expanded') !== 'true'; button.setAttribute('aria-expanded', String(open)); menu.classList.toggle('is-open', open); });
  menu.addEventListener('click', e => { if (e.target.closest('a')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { close(); button.focus(); } });
})();
