document.documentElement.classList.remove('no-js');
document.documentElement.classList.add('js');

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#primary-nav');

if (menuButton && navigation) {
  const setMenu = (open) => {
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    navigation.classList.toggle('nav--open', open);
  };

  menuButton.addEventListener('click', () => {
    setMenu(menuButton.getAttribute('aria-expanded') !== 'true');
  });

  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setMenu(false);
      menuButton.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 700) setMenu(false);
  });
}

const reviewTrack = document.querySelector('.review-track');
const reviewToggle = document.querySelector('[data-review-toggle]');

if (reviewTrack && reviewToggle) {
  reviewToggle.addEventListener('click', () => {
    const paused = reviewTrack.classList.toggle('is-paused');
    reviewToggle.setAttribute('aria-pressed', String(paused));
    reviewToggle.textContent = paused ? 'Resume rotation' : 'Pause rotation';
    reviewToggle.setAttribute('aria-label', paused ? 'Resume review rotation' : 'Pause review rotation');
  });
}

const contactForm = document.querySelector('#contact-form');
const contactOptions = document.querySelector('#form-contact-options');

if (contactForm && contactOptions) {
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!contactForm.reportValidity()) return;
    contactForm.reset();
    contactForm.hidden = true;
    contactOptions.hidden = false;
    contactOptions.focus();
  });
  contactForm.hidden = false;
}

document.querySelectorAll('[data-year]').forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});
