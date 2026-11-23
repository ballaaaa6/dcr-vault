export function discardDialog() {
  return `<dialog class="two-choice-dialog" id="discard-changes-dialog" aria-labelledby="discard-title" aria-describedby="discard-description">
    <h2 id="discard-title">Discard unsaved changes?</h2><p id="discard-description" class="two-choice-description">Your changes will be lost.</p>
    <div class="two-choice-actions"><button class="btn btn-primary" type="button" data-discard>Discard changes</button><button class="btn btn-ghost" type="button" data-cancel autofocus>Cancel</button></div>
  </dialog>`;
}

export function confirmDiscard() {
  const dialog = document.getElementById('discard-changes-dialog');
  if (dialog.open) return Promise.resolve(false);
  return new Promise(resolve => {
    dialog.querySelector('[data-discard]').onclick = () => dialog.close('discard');
    dialog.querySelector('[data-cancel]').onclick = () => dialog.close('cancel');
    dialog.onclose = () => { resolve(dialog.returnValue === 'discard'); };
    dialog.returnValue = '';
    dialog.showModal();
  });
}
