function clinicRuntime() {
  const toggle = document.querySelector('[data-menu]');
  const nav = document.querySelector('[data-nav]');
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open)); nav?.classList.toggle('open', open);
  });
  nav?.addEventListener('click', () => { toggle?.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
      const returnFocus = nav?.contains(document.activeElement);
      nav?.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false');
      if (returnFocus) toggle.focus();
    }
  });
  const reviews = document.querySelector('[data-reviews]');
  const pause = document.querySelector('[data-pause]');
  const previous = document.querySelector('[data-review-prev]');
  const next = document.querySelector('[data-review-next]');
  let paused = false, hover = false, focused = false, last = 0, position = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const setPaused = value => {
    paused = value;pause?.setAttribute('aria-pressed', String(paused));
    if(pause) pause.textContent = paused ? 'Resume reviews' : 'Pause reviews';
  };
  pause?.addEventListener('click', () => setPaused(!paused));
  reviews?.addEventListener('mouseenter', () => { hover = true; });
  reviews?.addEventListener('mouseleave', () => { hover = false; });
  reviews?.addEventListener('focusin', () => { focused = true; });
  reviews?.addEventListener('focusout', () => { focused = false; });
  if (reviews) {
    const originals = Array.from(reviews.children);
    const clones = originals.map(card => {
      const copy = card.cloneNode(true);copy.setAttribute('aria-hidden', 'true');copy.inert = true;
      copy.setAttribute('data-review-copy', '');reviews.append(copy);return copy;
    });
    const width = () => clones.length ? clones[0].getBoundingClientRect().left - originals[0].getBoundingClientRect().left : 0;
    const canMove = () => loopWidth > reviews.clientWidth + 1;
    const updateMotion = () => {
      const active = canMove() && !reduced.matches;
      clones.forEach(copy => {copy.hidden = !active;});
      if(pause) pause.hidden = !active;
      if(previous) previous.disabled = !canMove();
      if(next) next.disabled = !canMove();
    };
    // Measure before hiding duplicates; hidden nodes have no position.
    let loopWidth = width();
    const measure = () => {
      clones.forEach(copy => {copy.hidden = false;});loopWidth = width();
      updateMotion();position = reviews.scrollLeft;
    };
    measure();
    const observer = new ResizeObserver(measure);observer.observe(reviews);
    reduced.addEventListener('change', measure);
    const step = direction => {
      setPaused(true);
      const cardWidth = originals.length > 1 ? originals[1].offsetLeft-originals[0].offsetLeft : originals[0]?.getBoundingClientRect().width || 340;
      let target = reviews.scrollLeft + direction*cardWidth;
      if(!reduced.matches && loopWidth>reviews.clientWidth) target = (target+loopWidth)%loopWidth;
      reviews.scrollLeft = target;position = reviews.scrollLeft;
    };
    previous?.addEventListener('click', () => step(-1));next?.addEventListener('click', () => step(1));
    reviews.addEventListener('keydown', e => {
      if(e.key==='ArrowLeft' || e.key==='ArrowRight') {e.preventDefault();step(e.key==='ArrowLeft'?-1:1);}
    });
    reviews.addEventListener('pointerdown', () => setPaused(true));
    reviews.addEventListener('wheel', () => setPaused(true), {passive:true});
    const move = time => {
      const dt = last ? Math.min(time - last, 64) : 0; last = time;
      if (!paused && !hover && !focused && !document.hidden && !reduced.matches && loopWidth > reviews.clientWidth) {
        position = (position+dt*0.025)%loopWidth;reviews.scrollLeft = position;
      } else position = reviews.scrollLeft;
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
        window.open(link, '_blank', 'noopener,noreferrer');
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
