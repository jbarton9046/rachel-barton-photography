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

/* === MOBILE-ONLY enhancements: caret-toggled Galleries submenu (no card/backdrop),
       overlay/close controls, optional fallback flatten, and mobile-centering hook.
       Desktop untouched. === */
(function(){
  const mq = window.matchMedia('(max-width:820px)');
  const isMobile = () => mq.matches;

  /* ---------- Drawer helpers (non-desktop only) ---------- */
  const navchk = () => document.getElementById('navchk');

  function syncDrawer(){
    const c = navchk();
    const open = !!(c && c.checked);
    document.body.classList.toggle('drawer-open', open);
    const label = document.querySelector('.nav-toggle-8');
    if (label) label.setAttribute('aria-expanded', String(open));

    // When the drawer closes, ensure the Galleries submenu is reset to hidden
    if (!open) {
      const li = document.querySelector('nav.primary .is-collapsible');
      const btn = li && li.querySelector('.subtoggle');
      const menu = li && li.querySelector('.dropdown');
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

  /* ---------- Safety: explicitly toggle drawer on hamburger click ---------- */
  function wireHamburger(){
    const ham = document.querySelector('.nav-toggle-8');
    if (!ham || ham.dataset.wired) return;
    ham.addEventListener('click', (e)=>{
      // Explicit toggle in case <label for="navchk"> association gets blocked by layout
      const c = navchk();
      if (!c) return;
      c.checked = !c.checked;
      syncDrawer();
      // Prevent double-toggles if native label behavior also fires
      e.preventDefault();
      e.stopPropagation();
    });
    ham.dataset.wired = '1';
  }

  /* ---------- Close mechanics: overlay, floating X, Esc, any link ---------- */
  function wireCloseBehaviors(){
    if (!isMobile()) return;

    // Overlay click closes (element exists in the partial; harmless if hidden)
    const overlay = document.querySelector('.nav-overlay');
    if (overlay && !overlay.dataset.wired){
      overlay.addEventListener('click', closeDrawer, { passive:true });
      overlay.dataset.wired = '1';
    }

    // Floating “×” button (top-right, class .nav-x)
    const closeX = document.querySelector('.nav-x');
    if (closeX && !closeX.dataset.wired){
      closeX.addEventListener('click', closeDrawer);
      closeX.dataset.wired = '1';
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

  /* ---------- Caret-toggled Galleries (inline dropdown; no card, no backdrop) ---------- */
  function wireCollapsibleGalleries(){
    if (!isMobile()) return false;

    const li = document.querySelector('nav.primary .is-collapsible');
    if (!li || li.dataset.wired) return !!li;

    const btn = li.querySelector('.subtoggle');      // the caret button (to the right of Galleries)
    const menu = li.querySelector('.dropdown');      // the <ul> submenu
    if (!btn || !menu) return !!li;

    // Initialize hidden state for accessibility
    btn.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
    menu.setAttribute('aria-hidden','true');

    // Tapping the caret toggles the submenu ONLY (the "Galleries" link itself still navigates)
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      e.preventDefault();
      const open = btn.getAttribute('aria-expanded') === 'true';
      const next = !open;
      btn.setAttribute('aria-expanded', String(next));
      menu.hidden = !next;
      menu.setAttribute('aria-hidden', String(!next));
    });

    // Prevent accidental close when tapping inside the submenu
    menu.addEventListener('click', (e)=> e.stopPropagation());

    li.dataset.wired = '1';
    return true;
  }

  /* ---------- Fallback: flatten submenu into the list (kept, styled to match) ---------- */
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

  /* ---------- Optional: center the entire mobile nav ---------- */
  function setMobileCentered(on){
    document.documentElement.classList.toggle('nav-centered-mobile', !!on);
    const nav = document.querySelector('nav.primary');
    if (nav) nav.setAttribute('data-centered', on ? '1' : '0');
  }

  /* ---------- Init flow (mobile only) ---------- */
  function initMobileEnhancements(){
    if (!isMobile()){ unflatten(); setMobileCentered(false); return; }

    // Enable centering hook for mobile
    setMobileCentered(true);

    // Ensure hamburger always toggles the drawer
    wireHamburger();

    wireCloseBehaviors();

    // Prefer the inline caret-toggled submenu when present;
    // otherwise, gracefully flatten as a fallback.
    const usedCollapsible = wireCollapsibleGalleries();
    if (!usedCollapsible){
      flattenSubmenu();
    }

    // Keep body class in sync if someone toggles #navchk outside this file
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

  // Click outside the nav closes (when open) — mobile only
  document.addEventListener('click', (e)=>{
    if (!isMobile()) return;
    const c = navchk();
    if (!c || !c.checked) return;
    const insideNav = e.target.closest('nav.primary') || e.target.closest('.nav-toggle-8');
    if (!insideNav) closeDrawer();
  }, true);
})();
