(function () {
  const modal = document.getElementById('supportModal');
  const openBtn = document.getElementById('supportOpenBtn');
  if (!modal || !openBtn) return;

  let closeTimer = null;

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ attrs: { 'stroke-width': 2.4 } });
    }
  }

  function openModal() {
    window.clearTimeout(closeTimer);
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('support-modal-open');
    requestAnimationFrame(() => modal.classList.add('open'));
    setTimeout(() => document.getElementById('supportSubject')?.focus(), 120);
    refreshIcons();
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('support-modal-open');
    closeTimer = window.setTimeout(() => {
      modal.hidden = true;
    }, 220);
  }

  openBtn.addEventListener('click', openModal);
  modal.querySelectorAll('[data-support-close]').forEach((element) => {
    element.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
  });

  const message = document.getElementById('supportMessage');
  if (message) {
    const observer = new MutationObserver(() => {
      if (!message.classList.contains('success') || !message.textContent.trim()) return;
      window.setTimeout(closeModal, 1700);
    });
    observer.observe(message, { childList: true, characterData: true, subtree: true, attributes: true });
  }
})();
