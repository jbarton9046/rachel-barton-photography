// /assets/include.js
// Inject partials, execute any <script> tags inside them,
// and reliably mark the current page link in the navbar.

(async () => {
  const markCurrentNav = () => {
    const normalize = (href) => {
      const url = new URL(href, location.origin);
      let p = url.pathname
        .replace(/\/+/g, "/")
        .replace(/\/index\.html?$/i, "")
        .replace(/\.html?$/i, "")
        .replace(/\/$/, "");
      return p === "" ? "/" : p;
    };
    const here = normalize(location.pathname);
    const links = document.querySelectorAll('.topbar nav.primary a[href]');
    if (!links.length) return false;
    links.forEach(a => {
      const target = normalize(a.href);
      if (target === here) {
        a.setAttribute('aria-current', 'page');
        a.classList.add('is-current');
      } else {
        a.removeAttribute('aria-current');
        a.classList.remove('is-current');
      }
    });
    return true;
  };

  const targets = document.querySelectorAll('[data-include]');
  for (const mount of targets) {
    const url = mount.getAttribute('data-include');
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      const html = await res.text();

      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;

      const parent = mount.parentNode;
      const nodes = Array.from(wrapper.childNodes);
      for (const n of nodes) parent.insertBefore(n, mount);
      parent.removeChild(mount);

      // Recreate <script> tags so they execute
      nodes.forEach(node => {
        if (node.querySelectorAll) {
          node.querySelectorAll('script').forEach(old => {
            const s = document.createElement('script');
            for (const { name, value } of Array.from(old.attributes)) s.setAttribute(name, value);
            if (!old.src) s.textContent = old.textContent || '';
            old.replaceWith(s);
          });
        }
      });

      const looksLikeNav =
        (typeof url === 'string' && url.includes('/partials/topnav.html')) ||
        nodes.some(n => n.querySelector && n.querySelector('.topbar nav.primary'));
      if (looksLikeNav) {
        markCurrentNav();
        requestAnimationFrame(markCurrentNav);
      }
    } catch (e) {
      console.warn('Include failed:', url, e);
    }
  }

  markCurrentNav();
  window.addEventListener('load', markCurrentNav, { once: true });
})();

/* ===== MOBILE-ONLY “Galleries” details/summary (desktop untouched) ===== */
(function(){
  const mq = window.matchMedia('(max-width:820px)');
  const isMobile = () => mq.matches;
  const navchk = () => document.getElementById('navchk');

  function sync(){
    const c = navchk();
    const open = !!(c && c.checked);
    document.body.classList.toggle('drawer-open', open);
    const label = document.querySelector('.nav-toggle-8');
    if (label) label.setAttribute('aria-expanded', String(open));

    if (!open) {
      const li = document.querySelector('nav.primary .is-collapsible');
      const btn = li && li.querySelector('.subtoggle');
      const dd  = li && li.querySelector('.dropdown');
      if (btn && dd){
        btn.setAttribute('aria-expanded','false');
        dd.hidden = true; dd.setAttribute('aria-hidden','true');
      }
    }
  }
  function closeMenu(){ const c = navchk(); if (c){ c.checked = false; sync(); } }

  // Hamburger (guarded so it doesn't double-wire)
  (function wireHamburger(){
    const ham = document.querySelector('.nav-toggle-8');
    if (!ham || ham.dataset.wired) return;
    ham.addEventListener('click', (e)=>{
      if (!isMobile()) return;
      const c = navchk(); if (!c) return;
      c.checked = !c.checked;
      sync();
      e.preventDefault(); e.stopPropagation();
    });
    ham.dataset.wired = '1';
  })();

  // Subtoggle (guarded)
  (function wireSubtoggle(){
    if (!isMobile()) return;
    const li  = document.querySelector('nav.primary .is-collapsible');
    const btn = li && li.querySelector('.subtoggle');
    const dd  = li && li.querySelector('.dropdown');
    if (!li || !btn || !dd || btn.dataset.wired) return;

    btn.setAttribute('aria-expanded','false');
    dd.hidden = true; dd.setAttribute('aria-hidden','true');

    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const next = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(next));
      dd.hidden = !next; dd.setAttribute('aria-hidden', String(!next));
    }, { passive:false });
    btn.dataset.wired = '1';
  })();

  // Close mechanics (guarded)
  (function wireClose(){
    const overlay = document.querySelector('.nav-overlay');
    if (overlay && !overlay.dataset.wired){
      overlay.addEventListener('click', closeMenu, { passive:true });
      overlay.dataset.wired = '1';
    }
    const closeX = document.querySelector('.nav-x');
    if (closeX && !closeX.dataset.wired){
      closeX.addEventListener('click', closeMenu);
      closeX.dataset.wired = '1';
    }

    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape' && isMobile() && navchk()?.checked) closeMenu();
    });

    const nav = document.querySelector('nav.primary');
    if (nav && !nav.dataset.wired){
      nav.addEventListener('click', (e)=>{
        const a = e.target.closest('a');
        if (a) closeMenu();
      }, { capture:true });
      nav.dataset.wired = '1';
    }
  })();

  // Initialize (and re-run on viewport change)
  function setInitial(){ if (isMobile()) sync(); }
  setInitial();
  window.matchMedia('(max-width:820px)').addEventListener('change', setInitial);

  document.addEventListener('click', (e)=>{
    if (!navchk()?.checked || !isMobile()) return;
    if (e.target.closest('nav.primary') || e.target.closest('.nav-toggle-8')) return;
    closeMenu();
  }, true);

  navchk()?.addEventListener('change', sync);

  // mark current page quickly (unchanged)
  (function markCurrent(){
    const normalize = (href) => {
      const url = new URL(href, location.origin);
      let p = url.pathname.replace(/\/+/g,"/").replace(/\/index\.html?$/i,"").replace(/\.html?$/i,"").replace(/\/$/,"");
      return p === "" ? "/" : p;
    };
    const here = normalize(location.pathname);
    const links = document.querySelectorAll('.topbar nav.primary a[href]');
    links.forEach(a => {
      const target = normalize(a.href);
      if (target === here){ a.setAttribute('aria-current','page'); a.classList.add('is-current'); }
      else { a.removeAttribute('aria-current'); a.classList.remove('is-current'); }
    });
  })();
})();
