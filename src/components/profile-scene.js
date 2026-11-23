const sceneUrl = '/assets/profile/sakura-scene.webp';

function placeScene(form, cards, image) {
  if (!form.isConnected) return;
  const frame = form.getBoundingClientRect();
  const scale = Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  form.style.setProperty('--scene-width', `${width}px`);
  form.style.setProperty('--scene-height', `${height}px`);
  form.style.setProperty('--petal-distance', `${frame.height + 30}px`);
  cards.forEach((card, index) => {
    const box = card.getBoundingClientRect();
    card.style.setProperty('--scene-x', `${frame.right - width - box.left}px`);
    card.style.setProperty('--scene-y', `${frame.bottom - height - box.top}px`);
    const rect = form.querySelectorAll('.profile-petal-clip rect')[index];
    for (const [name, value] of Object.entries({x: box.left - frame.left, y: box.top - frame.top, width: box.width, height: box.height})) rect.setAttribute(name, value);
  });
}

export function initializeProfileScene(form) {
  const cards = [...form.querySelectorAll('.profile-identity, .profile-section')];
  const image = new Image();
  const update = () => placeScene(form, cards, image);
  image.onload = () => {
    update();
    const observer = new ResizeObserver(() => {
      if (!form.isConnected) observer.disconnect();
      else update();
    });
    observer.observe(form);
    cards.forEach(card => observer.observe(card));
  };
  image.src = sceneUrl;
}

export function profilePetals() {
  const petals = Array.from({length: 16}, (_, index) => `<i class="profile-petal profile-petal-${index + 1}"></i>`).join('');
  return `<svg class="profile-petal-definitions" aria-hidden="true"><defs><clipPath id="profile-petal-clip" clipPathUnits="userSpaceOnUse"><rect rx="20"></rect><rect rx="20"></rect></clipPath></defs></svg><div class="profile-petals" aria-hidden="true">${petals}</div>`;
}
