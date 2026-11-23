const plans = [
  {name: 'Basic', description: 'Essential features at an affordable price.', price: '28', features: ['10 Projects', 'Custom Branding', 'Customer Support', '5 Integrations', 'Data Security']},
  {name: 'Pro', description: 'Advanced features for enhanced productivity.', price: '38', featured: true, features: ['10 Projects', 'Custom Branding', 'Customer Support', '5 Integrations', 'Data Security']},
  {name: 'Premium', description: 'Comprehensive solutions for growing businesses.', price: '48', features: ['Unlimited Projects', 'Custom Branding', 'Customer Support', '15 Integrations', 'Data Security']},
];

function planCard(plan) {
  return `<article class="billing-card ${plan.featured ? 'billing-card-featured' : ''}"><div class="billing-card-title"><h2>${plan.name}</h2>${plan.featured ? '<span class="billing-badge">Most popular</span>' : ''}</div><p class="billing-description">${plan.description}</p>${plan.featured ? '<p class="billing-trial">30 days free trial included</p>' : ''}<p class="billing-price"><strong>$${plan.price}</strong> <span>/ month</span></p><ul class="billing-features">${plan.features.map(feature => `<li><span aria-hidden="true">✓</span>${feature}</li>`).join('')}</ul><button class="billing-features-button" type="button" disabled>All features <span aria-hidden="true">→</span></button><button class="billing-purchase" type="button" disabled>Purchase</button><small>*simple notes about pricing</small></article>`;
}

export function billing() {
  return `<main class="app-page billing-page"><header class="page-heading billing-heading"><h1>Tailored pricing for every stage of your journey</h1><p class="page-description">Whether you're a startup or an enterprise, find the pricing plan that perfectly aligns with your growth trajectory.</p></header><p class="billing-placeholder">Example plans and prices shown for layout preview.</p><section class="billing-grid" aria-label="Example pricing plans">${plans.map(planCard).join('')}</section></main>`;
}
