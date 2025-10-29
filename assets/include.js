// /assets/include.js
// Inject partials, execute any <script> tags inside them,
// and reliably mark the current page link in the navbar.

(async () => {
  // ---- Helper: mark current page in the primary nav (idempotent) ----
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

  // ---- Include all [data-include] mounts ----
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
            for (const { name, value } of Array.from(old.attributes)) {
              s.setAttribute(name, value);
            }
            if (!old.src) s.textContent = old.textContent || '';
            old.replaceWith(s);
          });
        }
      });

      // If this include contains the navbar, mark active link
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

  // Run once more after all includes are done
  markCurrentNav();
  window.addEventListener('load', markCurrentNav, { once: true });

  // >>> tell the rest of the app that includes are ready
  window.dispatchEvent(new Event('includes:ready'));
})();

/* === MOBILE-ONLY enhancements: convert Galleries caret to inline button,
       keep label centered, prevent left drift, close mechanics, etc. === */
(function(){
  const mq = window.matchMedia('(max-width:820px)');
  const isMobile = () => mq.matches;

  /* ---------- Drawer helpers ---------- */
  const navchk = () => document.getElementById('navchk');

  function syncDrawer(){
    const c = navchk();
    const open = !!(c && c.checked);
    document.body.classList.toggle('drawer-open', open);
    const label = document.querySelector('.nav-toggle-8');
    if (label) label.setAttribute('aria-expanded', String(open));

    // When closing the drawer, collapse Galleries submenu
    if (!open) {
      const li = getGalleriesLI();
      const btn = li && li.querySelector('.subtoggle');
      const menu = li && getDropdown(li);
      if (btn && menu) {
        btn.setAttribute('aria-expanded', 'false');
        menu.hidden = true;
        menu.setAttribute('aria-hidden','true');
      }
    }
  }

  function closeDrawer(){
    const c = navchk();
    if (c && c.checked) { c.checked = false; syncDrawer(); }
  }

  /* ---------- DOM helpers ---------- */
  function getDropdown(li){
    return li ? (li.querySelector(':scope > ul.dropdown') || li.querySelector('ul.dropdown')) : null;
  }
  function getTopLink(li){
    if (!li) return null;
    const dd = getDropdown(li);
    const anchors = Array.from(li.querySelectorAll('a[href]'));
    for (const a of anchors){
      if (!dd || !dd.contains(a)) return a; // first anchor not inside dropdown
    }
    return null;
  }
  function getGalleriesLI(){
    // find the first li that owns a dropdown (works even if no special class)
    const lis = document.querySelectorAll('nav.primary li');
    for (const li of lis){
      const dd = getDropdown(li);
      if (dd) return li;
    }
    return null;
  }

  /* ---------- Wire hamburger (explicit toggle) ---------- */
  function wireHamburger(){
    const ham = document.querySelector('.nav-toggle-8');
    if (!ham || ham.dataset.wired) return false;
    ham.addEventListener('click', (e)=>{
      if (!isMobile()) return;
      const c = navchk();
      if (!c) return;
      c.checked = !c.checked;
      syncDrawer();
      e.preventDefault();
      e.stopPropagation();
    });
    ham.dataset.wired = '1';
    return true;
  }

  /* ---------- Close mechanics ---------- */
  function wireCloseBehaviors(){
    if (!isMobile()) return;

    const overlay = document.querySelector('.nav-overlay');
    if (overlay && !overlay.dataset.wired){
      overlay.addEventListener('click', closeDrawer, { passive:true });
      overlay.dataset.wired = '1';
    }

    const closeX = document.querySelector('.nav-x');
    if (closeX && !closeX.dataset.wired){
      closeX.addEventListener('click', closeDrawer);
      closeX.dataset.wired = '1';
    }

    if (!document.body.dataset.navEscWired){
      document.addEventListener('keydown', (e)=>{
        if (e.key === 'Escape' && isMobile() && navchk()?.checked) closeDrawer();
      });
      document.body.dataset.navEscWired = '1';
    }

    const nav = document.querySelector('nav.primary');
    if (nav && !nav.dataset.closeOnLink){
      nav.addEventListener('click', (e)=>{
        const a = e.target.closest('a');
        if (a) closeDrawer();
      }, { capture:true });
      nav.dataset.closeOnLink = '1';
    }
  }

  /* ---------- Build inline caret button, intercept link tap ---------- */
  function wireGalleries(){
    if (!isMobile()) return false;

    const li = getGalleriesLI();
    if (!li || li.dataset.wired) return !!li;

    const anchor = getTopLink(li);
    const menu = getDropdown(li);
    if (!anchor || !menu) return !!li;

    // force centering/inline caret regardless of markup
    li.classList.add('is-collapsible','dropdown-overlay');

    Object.assign(li.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      width: 'auto',
      marginInline: 'auto',
      gap: '8px'
    });

    // Make/tune caret button
    let btn = li.querySelector(':scope > .subtoggle');
    if (!btn){
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'subtoggle';
      btn.textContent = '▾';
      anchor.insertAdjacentElement('afterend', btn);
    }
    btn.setAttribute('aria-expanded','false');

    // Start hidden
    menu.hidden = true;
    menu.setAttribute('aria-hidden','true');
    menu.style.textAlign = 'center';

    // Toggle (button)
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      const open = btn.getAttribute('aria-expanded') === 'true';
      const next = !open;
      btn.setAttribute('aria-expanded', String(next));
      menu.hidden = !next;
      menu.setAttribute('aria-hidden', String(!next));
    });

    // Intercept anchor tap on mobile to toggle (no navigation / no shift)
    anchor.addEventListener('click', (e)=>{
      if (!isMobile()) return;
      e.preventDefault();
      btn.click();
    });

    // Keep clicks inside menu from bubbling and closing drawer
    menu.addEventListener('click', (e)=> e.stopPropagation());

    li.dataset.wired = '1';
    return true;
  }

  /* ---------- Init (mobile only) ---------- */
  function initMobileEnhancements(){
    if (!isMobile()) return;

    wireHamburger();
    wireCloseBehaviors();
    wireGalleries();

    const c = navchk();
    if (c && !c.dataset.syncWired){
      c.addEventListener('change', syncDrawer);
      c.dataset.syncWired = '1';
      syncDrawer();
    }
  }

  // Initial run if the nav is already in the DOM
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initMobileEnhancements);
  } else {
    initMobileEnhancements();
  }

  // Re-run when viewport crosses the mobile breakpoint
  mq.addEventListener('change', initMobileEnhancements);

  // Re-run after includes finish injecting the navbar
  window.addEventListener('includes:ready', initMobileEnhancements);

  // MutationObserver fallback — wire as soon as nav controls show up
  const mo = new MutationObserver(() => {
    if (document.querySelector('.nav-toggle-8') && document.querySelector('#navchk')) {
      initMobileEnhancements();
      mo.disconnect();
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Click outside the nav closes (when open) — mobile only
  document.addEventListener('click', (e)=>{
    if (!isMobile()) return;
    const c = navchk();
    if (!c || !c.checked) return;
    const insideNav = e.target.closest('nav.primary') || e.target.closest('.nav-toggle-8');
    if (!insideNav) closeDrawer();
  }, true);
})();
