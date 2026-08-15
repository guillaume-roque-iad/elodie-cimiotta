// Page d'accueil — logique spécifique (filtre d'articles + carrousel avis).
// Externalisé depuis un <script> inline pour rester compatible avec la
// Content-Security-Policy du site (script-src 'self' ..., sans 'unsafe-inline').
(function () {
  function filterArticles(cat, btn) {
    document.querySelectorAll('.btab').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    document.querySelectorAll('#blogGrid .bcard').forEach(function (card) {
      card.style.display = (cat === 'tous' || card.dataset.cat === cat) ? 'block' : 'none';
    });
  }

  document.querySelectorAll('.btabs .btab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterArticles(btn.dataset.cat, btn);
    });
  });

  // Carrousel avis
  (function () {
    const track = document.getElementById('avTrack');
    if (!track) return;
    const cards = track.querySelectorAll('.avcard');
    const prev = document.getElementById('avPrev');
    const next = document.getElementById('avNext');
    const dotsBox = document.getElementById('avDots');
    const total = cards.length;
    function perView() { const w = window.innerWidth; if (w <= 640) return 1; if (w <= 960) return 2; return 3; }
    let current = 0, timer = null, paused = false;
    const pages = () => Math.max(1, total - perView() + 1);
    function render() {
      const gap = 20;
      const offset = (cards[0].offsetWidth + gap) * current;
      track.style.transform = 'translateX(-' + offset + 'px)';
      dotsBox.querySelectorAll('.avdot').forEach((d, i) => d.classList.toggle('active', i === current));
      prev.disabled = current === 0; next.disabled = current >= pages() - 1;
    }
    function buildDots() {
      dotsBox.innerHTML = '';
      for (let i = 0; i < pages(); i++) {
        const b = document.createElement('button');
        b.className = 'avdot' + (i === 0 ? ' active' : '');
        b.type = 'button';
        b.setAttribute('aria-label', 'Afficher le groupe d’avis ' + (i + 1));
        b.onclick = () => { current = i; render(); restart(); };
        dotsBox.appendChild(b);
      }
    }
    function go(dir) { current = Math.max(0, Math.min(pages() - 1, current + dir)); render(); }
    function autoplay() { stop(); timer = setInterval(() => { if (paused) return; current = current >= pages() - 1 ? 0 : current + 1; render(); }, 6000); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function restart() { stop(); autoplay(); }
    prev.onclick = () => { go(-1); restart(); };
    next.onclick = () => { go(1); restart(); };
    track.closest('.avis').addEventListener('mouseenter', () => paused = true);
    track.closest('.avis').addEventListener('mouseleave', () => paused = false);
    let sx = 0;
    track.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) { go(dx < 0 ? 1 : -1); restart(); } }, { passive: true });
    let rto = null;
    window.addEventListener('resize', () => { clearTimeout(rto); rto = setTimeout(() => { current = Math.min(current, pages() - 1); buildDots(); requestAnimationFrame(render); }, 150); });
    buildDots(); requestAnimationFrame(render); autoplay();
  })();
})();
