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
  window.dispatchEvent(new Event('includes:ready'));
})();

/* ===== MOBILE-ONLY “Galleries” details/summary (desktop untouched) ===== */
(function(){
  const mq = window.matchMedia('(max-width:820px)');
  const isMobile = () => mq.matches;
  const navchk = () => document.getElementById('navchk');

  const getDropdown = (li) => li ? (li.querySelector(':scope > ul.dropdown') || li.querySelector('ul.dropdown')) : null;
  function getTopLink(li){
    if (!li) return null;
    const dd = getDropdown(li);
    if (!dd) return null;
    const anchors = Array.from(li.querySelectorAll(':scope > a[href], a[href]'));
    for (const a of anchors){ if (!dd.contains(a)) return a; }
    return null;
  }
  function getGalleriesLI(){
    const lis = document.querySelectorAll('nav.primary li');
    for (const li of lis){ if (getDropdown(li)) return li; }
    return null;
  }

  function transformToDetails(){
    if (!isMobile()) return;

    const li = getGalleriesLI();
    if (!li || li.dataset.detailsified) return;

    const dd = getDropdown(li);
    const a  = getTopLink(li);
    if (!dd || !a) return;

    // Remove any existing theme caret/chevron elements (not ours)
    li.querySelectorAll(':scope > .caret, :scope .caret, [class*="chev"], [class*="arrow"]').forEach(el => el.remove());

    // Build <details><summary> with link + our black caret button
    const details = document.createElement('details');

    const summary = document.createElement('summary');
    summary.className = 'g-sum';
    // iOS/Safari: nuke default disclosure marker in case CSS is delayed
    summary.style.listStyle = 'none';
    summary.style.appearance = 'none';
    summary.style.webkitAppearance = 'none';

    const link = document.createElement('a');
    link.className = 'g-link';
    link.href = a.getAttribute('href') || '/galleries.html';
    link.textContent = (a.textContent || 'Galleries').trim();

    const caret = document.createElement('button');
    caret.type = 'button';
    caret.className = 'g-caret';
    caret.setAttribute('aria-label','Toggle Galleries');

    summary.appendChild(link);
    summary.appendChild(caret);

    a.replaceWith(details);
    details.appendChild(summary);
    details.appendChild(dd);

    li.classList.add('m-galleries');
    li.dataset.detailsified = '1';
    details.open = false;

    link.addEventListener('click', (e)=>{ e.stopPropagation(); }); // allow normal nav
    caret.addEventListener('click', (e)=>{
      e.preventDefault(); e.stopPropagation();
      details.open = !details.open;
    });
    dd.addEventListener('click', (e)=> e.stopPropagation());
  }

  function syncDrawer(){
    const c = navchk();
    const open = !!(c && c.checked);
    document.body.classList.toggle('drawer-open', open);
    if (!open){
      const details = document.querySelector('nav.primary li.m-galleries details');
      if (details) details.open = false;
    }
    const label = document.querySelector('.nav-toggle-8');
    if (label) label.setAttribute('aria-expanded', String(open));
  }

  function wireDrawer(){
    const c = navchk();
    if (c && !c.dataset.syncWired){
      c.addEventListener('change', syncDrawer);
      c.dataset.syncWired = '1';
      syncDrawer();
    }
  }

  function wireHamburger(){
    const ham = document.querySelector('.nav-toggle-8');
    if (!ham || ham.dataset.wired) return;
    ham.addEventListener('click', (e)=>{
      if (!isMobile()) return;
      const c = navchk();
      if (!c) return;
      c.checked = !c.checked;
      syncDrawer();
      e.preventDefault(); e.stopPropagation();
    });
    ham.dataset.wired = '1';
  }

  function initMobile(){
    if (!isMobile()) return;
    transformToDetails();
    wireHamburger();
    wireDrawer();
  }

  if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', initMobile); }
  else { initMobile(); }

  mq.addEventListener('change', initMobile);
  window.addEventListener('includes:ready', initMobile);

  const mo = new MutationObserver(() => {
    if (document.querySelector('nav.primary') && document.querySelector('#navchk')) {
      initMobile(); mo.disconnect();
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', (e)=>{
    if (!isMobile()) return;
    const c = navchk();
    if (!c || !c.checked) return;
    const inside = e.target.closest('nav.primary') || e.target.closest('.nav-toggle-8');
    if (!inside) { c.checked = false; syncDrawer(); }
  }, true);
})();
