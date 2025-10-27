// /assets/include.js
// Inject partials, execute any <script> tags inside them,
// and reliably mark the current page link in the navbar.

(async () => {
  // ---- Helper: mark current page in the primary nav (idempotent) ----
  const markCurrentNav = () => {
    // Normalize any href/path: remove /index.html, .html, trailing slash; collapse slashes
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
        a.setAttribute('aria-current', 'page'); // mobile overlay/drawer hook
        a.classList.add('is-current');          // desktop highlight hook (no underline)
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

      // Parse fetched HTML into a fragment
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;

      // Insert parsed nodes before the mount and remove the placeholder
      const parent = mount.parentNode;
      const nodes = Array.from(wrapper.childNodes);
      for (const n of nodes) parent.insertBefore(n, mount);
      parent.removeChild(mount);

      // Recreate any <script> tags so the browser executes them
      nodes.forEach(node => {
        if (node.querySelectorAll) {
          node.querySelectorAll('script').forEach(old => {
            const s = document.createElement('script');
            // copy attributes
            for (const { name, value } of Array.from(old.attributes)) {
              s.setAttribute(name, value);
            }
            // inline code
            if (!old.src) s.textContent = old.textContent || '';
            old.replaceWith(s);
          });
        }
      });

      // If this include was the navbar (or contains it), mark active link now
      const looksLikeNav =
        (typeof url === 'string' && url.includes('/partials/topnav.html')) ||
        nodes.some(n => n.querySelector && n.querySelector('.topbar nav.primary'));
      if (looksLikeNav) {
        // try now and again on the next frame for safety
        markCurrentNav();
        requestAnimationFrame(markCurrentNav);
      }
    } catch (e) {
      console.warn('Include failed:', url, e);
    }
  }

  // Run once more after all includes are done (covers slow parses)
  markCurrentNav();
  // And once the page is fully loaded, as a final safety net
  window.addEventListener('load', markCurrentNav, { once: true });
})();

/* === MOBILE-ONLY enhancements: collapsible Galleries (if present), overlay/close, or fallback flatten
       + optional mobile centering toggle (adds html.nav-centered-mobile) === */
(function(){
  const mq = window.matchMedia('(max-width:820px)');
  const isMobile = () => mq.matches;

  /* ---------- Drawer helpers (non-desktop only) ---------- */
  const navchk = () => document.getElementById('navchk');
  function openDrawer(){ const c = navchk(); if (c) { c.checked = true; syncDrawer(); } }
  function closeDrawer(){ const c = navchk(); if (c) { c.checked = false; syncDrawer(); } }
  function syncDrawer(){
    const c = navchk();
    document.body.classList.toggle('drawer-open', !!(c && c.checked));
    const label = document.querySelector('.nav-toggle-8');
    if (label) label.setAttribute('aria-expanded', String(!!(c && c.checked)));
  }

  /* ---------- Professional close: overlay, Close button, Esc, link taps ---------- */
  function wireCloseBehaviors(){
    if (!isMobile()) return;

    // Backdrop overlay
    const overlay = document.querySelector('.nav-overlay');
    if (overlay && !overlay.dataset.wired){
      overlay.addEventListener('click', closeDrawer);
      overlay.dataset.wired = '1';
    }

    // Floating “×” button (top-right, class .nav-x)
    const closeX = document.querySelector('.nav-x');
    if (closeX && !closeX.dataset.wired){
      closeX.addEventListener('click', closeDrawer);
      closeX.dataset.wired = '1';
    }

    // Visible "Close" button at top of drawer (if present)
    const closeBtn = document.querySelector('nav.primary .nav-close');
    if (closeBtn && !closeBtn.dataset.wired){
      closeBtn.addEventListener('click', closeDrawer);
      closeBtn.dataset.wired = '1';
    }

    // Esc key closes
    if (!document.body.dataset.navEscWired){
      document.addEventListener('keydown', (e)=>{
        if (e.key === 'Escape' && isMobile() && navchk()?.checked) closeDrawer();
      });
      document.body.dataset.navEscWired = '1';
    }

    // Any link tap inside the drawer closes it as we navigate
    const nav = document.querySelector('nav.primary');
    if (nav && !nav.dataset.closeOnLink){
      nav.addEventListener('click', (e)=>{
        const a = e.target.closest('a');
        if (a) closeDrawer();
      }, { capture:true });
      nav.dataset.closeOnLink = '1';
    }
  }

  /* ---------- Option A: Collapsible Galleries (preferred if HTML has subtoggle) ---------- */
  function wireCollapsibleGalleries(){
    if (!isMobile()) return false;

    const li = document.querySelector('nav.primary .is-collapsible');
    if (!li || li.dataset.wired) return !!li;

    const btn = li.querySelector('.subtoggle');
    const menu = li.querySelector('.dropdown');
    if (!btn || !menu) return !!li;

    // initialize hidden state for accessibility
    btn.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
    menu.setAttribute('aria-hidden','true');

    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const open = btn.getAttribute('aria-expanded') === 'true';
      const next = !open;
      btn.setAttribute('aria-expanded', String(next));
      menu.hidden = !next;
      menu.setAttribute('aria-hidden', String(!next));
      openDrawer(); // keep the drawer open while toggling
    });

    li.dataset.wired = '1';
    return true;
  }

  /* ---------- Option B: Fallback — freeze during submenu taps & flatten the submenu into same list ---------- */
  function freezeDuringTap(){
    try{
      const menu = document.querySelector('.topbar .is-galleries-dropdown') ||
                   document.querySelector('.topbar .has-sub .dropdown');
      if(!menu) return;
      const links = menu.querySelectorAll('a[href]');
      function startFreeze(){
        document.documentElement.classList.add('submenu-tap');
        document.body.classList.add('drawer-open'); // harmless for overlay
        const c = navchk();
        if (c) c.checked = true;
        setTimeout(() => {
          document.documentElement.classList.remove('submenu-tap');
        }, 700);
      }
      function cleanup(){
        document.documentElement.classList.remove('submenu-tap');
      }
      links.forEach(a=>{
        a.addEventListener('touchstart', startFreeze, { passive:true, capture:true });
        a.addEventListener('mousedown',   startFreeze, { capture:true });
        a.addEventListener('touchend',    cleanup,     { passive:true, capture:true });
        a.addEventListener('mouseup',     cleanup,     { capture:true });
        a.addEventListener('click', (e)=>{
          e.stopPropagation();
          document.body.classList.add('drawer-open');
          const c = navchk();
          if (c) c.checked = true;
        }, { capture:true });
      });
      window.addEventListener('beforeunload', () => {
        document.body.classList.remove('drawer-open');
        document.documentElement.classList.remove('submenu-tap');
      }, { once:true });
      window.addEventListener('pagehide', () => {
        document.body.classList.remove('drawer-open');
        document.documentElement.classList.remove('submenu-tap');
      }, { once:true });
    }catch(e){}
  }

  let flattened = false;
  function flattenSubmenu(){
    if (!isMobile()) { unflatten(); return; }
    if (flattened) return;

    const nav = document.querySelector('.topbar nav.primary ul');
    const parentLi = nav && nav.querySelector('li.has-sub');
    const dropdown = parentLi && parentLi.querySelector(':scope > ul.dropdown');
    if (!nav || !parentLi || !dropdown) return;

    const afterNode = parentLi;
    const items = Array.from(dropdown.querySelectorAll(':scope > li > a[href]'));
    items.forEach(a => {
      const li = document.createElement('li');
      li.className = 'nav-subitem';
      const clone = a.cloneNode(true);
      li.appendChild(clone);
      afterNode.parentNode.insertBefore(li, afterNode.nextSibling);
    });

    document.documentElement.classList.add('nav-flattened');
    flattened = true;
  }
  function unflatten(){
    if (!flattened) return;
    document.querySelectorAll('nav.primary li.nav-subitem').forEach(li => li.remove());
    document.documentElement.classList.remove('nav-flattened');
    flattened = false;
  }

  /* ---------- Optional: center the entire mobile nav ----------
     This sets a hook class on <html> you can style in CSS:
       html.nav-centered-mobile nav.primary { /* your centering rules */ /* }
     We also add a data flag on the nav for convenience. */
  function setMobileCentered(on){
    document.documentElement.classList.toggle('nav-centered-mobile', !!on);
    const nav = document.querySelector('nav.primary');
    if (nav) nav.setAttribute('data-centered', on ? '1' : '0');
  }

  /* ---------- Init flow (mobile only) ---------- */
  function initMobileEnhancements(){
    if (!isMobile()){ unflatten(); setMobileCentered(false); return; }

    // enable centering hook for mobile
    setMobileCentered(true);

    wireCloseBehaviors();

    // If the HTML contains the collapsible structure, use it.
    // Otherwise, fall back to flatten + freeze.
    const usedCollapsible = wireCollapsibleGalleries();
    if (!usedCollapsible){
      flattenSubmenu();
      freezeDuringTap();
    }

    // keep body class in sync if someone toggles #navchk outside this file
    const c = navchk();
    if (c && !c.dataset.syncWired){
      c.addEventListener('change', syncDrawer);
      c.dataset.syncWired = '1';
      syncDrawer();
    }
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initMobileEnhancements);
  } else {
    initMobileEnhancements();
  }
  mq.addEventListener('change', initMobileEnhancements);
})();
