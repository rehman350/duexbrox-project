/* DUEXBROX collection filters: Section Rendering API refresh, price slider, mobile drawer. */
(() => {
  const init = (root) => {
    if (!root || root.dataset.dxColReady) return;
    root.dataset.dxColReady = '1';
    const sectionId = root.dataset.section;
    let ctrl;
    let timer;

    const openGroups = () =>
      [...root.querySelectorAll('.dx-flt__grp')].reduce((acc, d) => ((acc[d.dataset.grp] = d.open), acc), {});

    const render = async (url, push = true) => {
      const keep = openGroups();
      const main = root.querySelector('[data-dx-results]');
      main?.classList.add('is-loading');
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const u = new URL(url, location.origin);
        u.searchParams.set('section_id', sectionId);
        const res = await fetch(u, { signal: ctrl.signal });
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const fresh = doc.querySelector('[data-dx-col]');
        if (!fresh) throw new Error('No section');
        ['[data-dx-results]', '.dx-flt__form', '[data-dx-count]', '[data-dx-ftoggle]'].forEach((sel) => {
          const a = root.querySelector(sel);
          const b = fresh.querySelector(sel);
          if (a && b) a.replaceWith(b);
        });
        root.querySelectorAll('.dx-flt__grp').forEach((d) => {
          if (d.dataset.grp in keep) d.open = keep[d.dataset.grp];
        });
        u.searchParams.delete('section_id');
        if (push) history.pushState({ dxCol: true }, '', u.pathname + u.search);
        bind();
        window.DX?.boot?.(root);
      } catch (e) {
        if (e.name !== 'AbortError') location.href = url;
      } finally {
        root.querySelector('[data-dx-results]')?.classList.remove('is-loading');
      }
    };

    const urlFromForm = (form) => {
      const data = new FormData(form);
      const params = new URLSearchParams();
      for (const [k, v] of data.entries()) if (String(v).trim() !== '') params.append(k, v);
      const qs = params.toString();
      return form.action.split('?')[0] + (qs ? '?' + qs : '');
    };

    const initPrice = (wrap) => {
      const max = Number(wrap.dataset.max) || 0;
      const rmin = wrap.querySelector('[data-dx-rmin]');
      const rmax = wrap.querySelector('[data-dx-rmax]');
      const nmin = wrap.querySelector('[data-dx-nmin]');
      const nmax = wrap.querySelector('[data-dx-nmax]');
      const paint = () => {
        const lo = (Number(rmin.value) / (max || 1)) * 100;
        const hi = (Number(rmax.value) / (max || 1)) * 100;
        wrap.style.setProperty('--dx-lo', lo + '%');
        wrap.style.setProperty('--dx-hi', hi + '%');
      };
      const fromRange = (e) => {
        let a = Number(rmin.value);
        let b = Number(rmax.value);
        if (a > b) {
          if (e.target === rmin) a = b;
          else b = a;
          rmin.value = a;
          rmax.value = b;
        }
        nmin.value = a > 0 ? a : '';
        nmax.value = b < max ? b : '';
        paint();
      };
      const fromNumber = () => {
        rmin.value = nmin.value || 0;
        rmax.value = nmax.value || max;
        paint();
      };
      [rmin, rmax].forEach((r) => {
        r.addEventListener('input', fromRange);
        r.addEventListener('change', () => wrap.closest('form').dispatchEvent(new Event('input', { bubbles: true })));
      });
      [nmin, nmax].forEach((n) => n.addEventListener('input', fromNumber));
      paint();
    };

    const bind = () => {
      const form = root.querySelector('[data-dx-filter-form]');
      if (form && !form.dataset.bound) {
        form.dataset.bound = '1';
        const go = (delay) => {
          clearTimeout(timer);
          timer = setTimeout(() => render(urlFromForm(form)), delay);
        };
        form.addEventListener('change', (e) => {
          if (e.target.type === 'range') return;
          go(e.target.type === 'number' ? 600 : 0);
        });
        form.addEventListener('input', (e) => {
          if (e.target === form || e.target.type === 'number') go(700);
        });
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          render(urlFromForm(form));
        });
        form.querySelectorAll('[data-dx-price]').forEach(initPrice);
      }
      root.querySelectorAll('[data-dx-link]').forEach((a) => {
        if (a.dataset.bound) return;
        a.dataset.bound = '1';
        a.addEventListener('click', (e) => {
          e.preventDefault();
          render(a.href);
        });
      });
      const toggle = root.querySelector('[data-dx-ftoggle]');
      if (toggle && !toggle.dataset.bound) {
        toggle.dataset.bound = '1';
        toggle.addEventListener('click', () => {
          if (!window.matchMedia('(max-width: 899px)').matches) return;
          root.classList.add('is-flt');
          toggle.setAttribute('aria-expanded', 'true');
          root.querySelector('[data-dx-fclose]')?.focus();
        });
      }
    };

    const close = () => {
      root.classList.remove('is-flt');
      root.querySelector('[data-dx-ftoggle]')?.setAttribute('aria-expanded', 'false');
    };
    root.querySelector('[data-dx-fclose]')?.addEventListener('click', close);
    document.addEventListener('keydown', (e) => e.key === 'Escape' && close());
    document.addEventListener('click', (e) => {
      if (root.classList.contains('is-flt') && !e.target.closest('.dx-flt') && !e.target.closest('[data-dx-ftoggle]')) close();
    });
    window.addEventListener('popstate', () => render(location.href, false));
    bind();
  };

  const boot = () => document.querySelectorAll('[data-dx-col]').forEach(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('shopify:section:load', boot);
})();
