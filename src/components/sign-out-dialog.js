export function signOutDialog() {
  return `<dialog class="two-choice-dialog" id="sign-out-dialog" aria-labelledby="sign-out-title" aria-describedby="sign-out-description">
    <h2 id="sign-out-title">Log out?</h2><p id="sign-out-description" class="two-choice-description">Are you sure you want to log out?</p>
    <div class="two-choice-actions"><button class="btn btn-primary" type="button" data-confirm-sign-out>Log out</button><button class="btn btn-ghost" type="button" data-cancel-sign-out autofocus>Cancel</button></div>
    <p data-sign-out-status role="status" aria-live="polite"></p>
  </dialog>`;
}

export function bindSignOut(button, dialog, signOut) {
  const confirm = dialog.querySelector('[data-confirm-sign-out]');
  const cancel = dialog.querySelector('[data-cancel-sign-out]');
  const status = dialog.querySelector('[data-sign-out-status]');
  button.addEventListener('click', () => { status.textContent = ''; dialog.showModal(); });
  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => { if (confirm.disabled) event.preventDefault(); });
  confirm.addEventListener('click', async () => {
    confirm.disabled = true; cancel.disabled = true; status.textContent = '';
    try { await signOut(); }
    catch (error) { status.textContent = error.message || 'Could not log out.'; confirm.disabled = false; cancel.disabled = false; }
  });
}
