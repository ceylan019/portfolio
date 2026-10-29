// @vitest-environment happy-dom
import { wireCertificateDialogs } from '../../src/lib/certificate-dialog';

const MARKUP = `
  <a class="cert-thumb" href="/certificates/a.pdf" data-certificate="certificate-a">thumb</a>
  <dialog id="certificate-a">
    <div class="inner"><button type="button" data-close>Close</button><img alt="Certificate: A"></div>
  </dialog>
  <a class="cert-thumb" href="/certificates/b.pdf" data-certificate="certificate-missing">orphan</a>`;

function setUp() {
  document.body.innerHTML = MARKUP;
  wireCertificateDialogs(document);
  const trigger = document.querySelector<HTMLAnchorElement>('[data-certificate="certificate-a"]')!;
  const dialog = document.querySelector<HTMLDialogElement>('#certificate-a')!;
  return { trigger, dialog };
}

const click = (target: Element) => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
};

test('@REQ-CERT-07 clicking the thumbnail opens the preview as a modal instead of following the link', () => {
  const { trigger, dialog } = setUp();
  const event = click(trigger);
  expect(event.defaultPrevented).toBe(true);
  expect(dialog.open).toBe(true);
  expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
});

test('@REQ-CERT-07 the close button closes the preview and focus returns to the thumbnail', () => {
  const { trigger, dialog } = setUp();
  click(trigger);
  click(dialog.querySelector('[data-close]')!);
  expect(dialog.open).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

test('@REQ-CERT-07 a click outside the preview closes it, a click on the certificate does not', () => {
  const { trigger, dialog } = setUp();
  click(trigger);
  click(dialog.querySelector('img')!);
  expect(dialog.open).toBe(true);
  click(dialog);
  expect(dialog.open).toBe(false);
});

test('@REQ-CERT-07 a thumbnail without its preview stays a plain link', () => {
  setUp();
  const orphan = document.querySelector('[data-certificate="certificate-missing"]')!;
  expect(click(orphan).defaultPrevented).toBe(false);
  expect(orphan.hasAttribute('aria-haspopup')).toBe(false);
});
