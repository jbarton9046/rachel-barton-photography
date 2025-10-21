// /assets/mobile-menu.js
(() => {
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  let lastFocus = null;

  function lockScroll(lock) {
    const b = document.body;
    if (lock) {
      const y = window.scrollY || document.documentElement.scrollTop;
      b.dataset.scrollY = String(y);
      b.style.position = 'fixed'; b.style.top = `-${y}px`;
      b.style.left = '0'; b.style.right = '0'; b.style.width = '100%';
    } else {
      const y = parseInt(document.body.dataset.scrollY || "0", 10);
      b.style.position = ''; b.style.top = ''; b.style.left = ''; b.style.right = ''; b.style.width = '';
      window.scrollTo(0, y); delete b.dataset.scrollY;
    }
  }

  function openMenu() {
    const overlay = qs('.nav-overlay');
    const sheet = qs('.nav-sheet');
    if (!overlay || !sheet) return;
    overlay.hidden = false; sheet.hidden = false;
    overlay.classList.add('is-open'); sheet.classList.add('is-open');
    lockScroll(true);
    const focusables = qsa('a,button,[tabindex]:not([tabindex="-1"])', sheet).filter(el => !el.disabled && el.offsetParent !== null);
    lastFocus = document.activeElement;
    if (focusables[0]) focusables[0].focus({ preventScroll:true });
    document.documentElement.classList.add('menu-open');
  }

  function closeMenu() {
    const overlay = qs('.nav-overlay');
    const sheet = qs('.nav-sheet');
    if (!overlay || !sheet) return;
    overlay.classList.remove('is-open'); sheet.classList.remove('is-open');
    overlay.hidden = true; sheet.hidden = true;
    lockScroll(false);
    document.documentElement.classList.remove('menu-open');
    const chk = qs('#navchk'); if (chk) chk.checked = false; // keep legacy checkbox in sync
    if (lastFocus) try { lastFocus.focus({ preventScroll:true }); } catch {}
  }

  function handleEsc(e){ if (e.key === 'Escape') closeMenu(); }
  function outsideClick(e){
    const sheet = qs('.nav-sheet');
    if (sheet && !sheet.contains(e.target)) closeMenu();
  }

  function init(){
    const chk = qs('#navchk');
    const overlay = qs('.nav-overlay');
    const closeBtn = qs('.nav-close');

    // Wire your existing checkbox toggle
    if (chk) {
      chk.addEventListener('change', () => {
        if (chk.checked) openMenu(); else closeMenu();
      });
    }
    closeBtn?.addEventListener('click', (e) => { e.preventDefault(); closeMenu(); });
    overlay?.addEventListener('click', outsideClick);
    document.addEventListener('keydown', handleEsc);

    // Close when a nav link is clicked
    qsa('.nav-sheet a[href]').forEach(a => a.addEventListener('click', () => closeMenu()));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
