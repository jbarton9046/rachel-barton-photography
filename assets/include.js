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

/* === MOBILE-ONLY enhancements: caret-toggled Galleries (no card/backdrop),
       robust hamburger wiring (handles late-loaded navbar), close controls,
       fallback flatten, and mobile-centering hook. Desktop untouched. === */
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

  /* ---------- Inject a mobile-only style to kill ::after caret on Galleries link ---------- */
  function injectCaretKiller(){
    if (document.getElementById('js-caret-kill')) return;
    const style = document.createElement('style');
    style.id = 'js-caret-kill';
    style.textContent = `
      @media (max-width:820px){
        nav.primary li.has-sub.js-caret-fix > a::after{ content:none !important; }
        nav.primary li.has-sub.js-caret-fix{ display:inline-flex !important; align-items:center !important; gap:8px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ---------- Convert the Galleries caret into a real button & center the row ---------- */
  function hardFixGalleriesRow(){
    if (!isMobile()) return false;

    const parentLi =
      document.querySelector('nav.primary li.has-sub') ||
      document.querySelector('nav.primary .is-collapsible');

    if (!parentLi || parentLi.dataset.hardfixed) return !!parentLi;

    const anchor = parentLi.querySelector(':scope > a');
    const dropdown = parentLi.querySelector(':scope > ul.dropdown');
    if (!anchor || !dropdown) return !!parentLi;

    injectCaretKiller();

    // Tag for the CSS caret killer + centering
    parentLi.classList.add('is-collapsible','dropdown-overlay','js-caret-fix');

    // Ensure inline-flex centering even if CSS fails to load first
    Object.assign(parentLi.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      width: 'auto',
      marginInline: 'auto'
    });

    // Build a real caret button if not present
    let btn = parentLi.querySelector(':scope > .subtoggle');
    if (!btn){
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'subtoggle';
      btn.setAttribute('aria-expanded','false');
      btn.setAttribute('aria-label','Toggle Galleries');
      btn.textContent = '▾';
      anchor.insertAdjacentElement('afterend', btn);
    }

    // Hide dropdown initially
    dropdown.hidden = true;
    dropdown.setAttribute('aria-hidden','true');
    dropdown.style.textAlign = 'center';

    // Toggle handler
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      const open = btn.getAttribute('aria-expanded') === 'true';
      const next = !open;
      btn.setAttribute('aria-expanded', String(next));
      dropdown.hidden = !next;
      dropdown.setAttribute('aria-hidden', String(!next));
    }, { passive:false });

    // Keep click inside menu from bubbling and closing drawer
    dropdown.addEventListener('click', (e)=> e.stopPropagation());

    parentLi.dataset.hardfixed = '1';
    return true;
  }

  /* ---------- Caret-toggled Galleries (soft wiring; may be skipped by hard fix) ---------- */
  function wireCollapsibleGalleries(){
    if (!isMobile()) return false;

    const li = document.querySelector('nav.primary .is-collapsible');
    if (!li || li.dataset.wired) return !!li;

    const btn = li.querySelector('.subtoggle');
    const menu = li.querySelector('.dropdown');
    if (!btn || !menu) return !!li;

    li.style.display = 'flex';
    li.style.justifyContent = 'center';
    li.style.alignItems = 'center';
    li.style.textAlign = 'center';
    menu.style.textAlign = 'center';

    btn.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
    menu.setAttribute('aria-hidden','true');

    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      e.preventDefault();
      const open = btn.getAttribute('aria-expanded') === 'true';
      const next = !open;
      btn.setAttribute('aria-expanded', String(next));
      menu.hidden = !next;
      menu.setAttribute('aria-hidden', String(!next));
    });

    menu.addEventListener('click', (e)=> e.stopPropagation());

    li.dataset.wired = '1';
    return true;
  }

  /* ---------- Fallback: flatten submenu (only if needed) ---------- */
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

  /* ---------- Init (mobile only) ---------- */
  function initMobileEnhancements(){
    if (!isMobile()){ unflatten(); setMobileCentered(false); return; }

    setMobileCentered(true);
    wireHamburger();
    wireCloseBehaviors();

    // NEW: hard fix first (creates real caret and kills ::after)
    const hard = hardFixGalleriesRow();

    // If hard fix didn’t wire (e.g., markup different), try soft wiring
    if (!hard) {
      const usedCollapsible = wireCollapsibleGalleries();
      if (!usedCollapsible){
        flattenSubmenu();
      }
    }

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
