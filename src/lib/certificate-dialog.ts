export function wireCertificateDialogs(root: Document): void {
  for (const trigger of root.querySelectorAll<HTMLAnchorElement>('a[data-certificate]')) {
    const dialog = root.getElementById(trigger.dataset.certificate ?? '') as HTMLDialogElement | null;
    if (typeof dialog?.showModal !== 'function') continue;
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      dialog.showModal();
    });
    dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => trigger.focus());
  }
}
