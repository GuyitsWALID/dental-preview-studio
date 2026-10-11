function clinicRuntime() {
  const toggle = document.querySelector('[data-menu]');
  const nav = document.querySelector('[data-nav]');
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open)); nav?.classList.toggle('open', open);
  });
  nav?.addEventListener('click', () => { toggle?.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { nav?.classList.remove('open'); toggle?.setAttribute('aria-expanded', 'false'); }
  });
  const reviews = document.querySelector('[data-reviews]');
  const pause = document.querySelector('[data-pause]');
  let paused = false, hover = false, focused = false, last = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  pause?.addEventListener('click', () => {
    paused = !paused; pause.setAttribute('aria-pressed', String(paused));
    pause.textContent = paused ? 'Resume reviews' : 'Pause reviews';
  });
  reviews?.addEventListener('mouseenter', () => { hover = true; });
  reviews?.addEventListener('mouseleave', () => { hover = false; });
  reviews?.addEventListener('focusin', () => { focused = true; });
  reviews?.addEventListener('focusout', () => { focused = false; });
  if (reviews) {
    const move = time => {
      const dt = last ? Math.min(time - last, 64) : 0; last = time;
      if (!paused && !hover && !focused && !reduced.matches && reviews.scrollWidth > reviews.clientWidth) {
        reviews.scrollLeft += dt * 0.025;
        if (reviews.scrollLeft >= reviews.scrollWidth - reviews.clientWidth - 1) reviews.scrollLeft = 0;
      }
      requestAnimationFrame(move);
    };
    requestAnimationFrame(move);
  }
  document.querySelectorAll('[data-enquiry]').forEach(container => {
    const form = container.querySelector('form');
    const button = container.querySelector('[data-send]');
    const result = container.querySelector('[data-result]');
    const mode = container.dataset.mode;
    const announce = message => { result.textContent = message; result.hidden = false; result.focus(); };
    const send = async event => {
      event.preventDefault();
      if (mode === 'demo') { announce('This is a website preview. Nothing was sent. Use the clinic’s direct contact links.'); return; }
      if (!form?.reportValidity()) return;
      const values = new FormData(form);
      if (values.get('_gotcha')) return;
      if (mode === 'whatsapp') {
        const text = ['Hello, I would like to enquire about a visit.', `Name: ${values.get('name') || ''}`, `Contact: ${values.get('phone') || values.get('email') || ''}`, String(values.get('message') || '')].join('\n');
        const link = `https://wa.me/${container.dataset.phone}?text=${encodeURIComponent(text)}`;
        const opened = window.open(link, '_blank', 'noopener,noreferrer');
        announce('Your WhatsApp enquiry is ready. Review the message and select Send in WhatsApp.');
        const fallback = document.createElement('a'); fallback.href = link; fallback.target = '_blank'; fallback.rel = 'noopener noreferrer'; fallback.textContent = 'Open WhatsApp';
        result.append(document.createTextNode(' '), fallback);
        return;
      }
      button.disabled = true; button.textContent = 'Sending…';
      try {
        const response = await fetch(form.action, { method: 'POST', body: values, headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Submission was not accepted');
        form.reset(); announce('Your enquiry was accepted. The clinic will respond using the contact details you supplied.');
      } catch {
        announce('Your enquiry could not be confirmed. Your entries are still here. Try again or call the clinic directly.');
      } finally { button.disabled = false; button.textContent = 'Send enquiry'; }
    };
    form?.addEventListener('submit', send);
    if (mode !== 'email') button?.addEventListener('click', send);
  });
}
export const SITE_SCRIPT = `(${clinicRuntime.toString()})();`;
