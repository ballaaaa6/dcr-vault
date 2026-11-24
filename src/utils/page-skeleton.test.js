import test from 'node:test';
import assert from 'node:assert/strict';
import {pageSkeleton, sheetPreviewSkeleton, usageResultsSkeleton} from '../components/page-skeleton.js';

test('page skeletons select the page layout and preserve loading status', () => {
  for (const [path, layout] of [['/', 'home-page'], ['/archive', 'intake-grid'], ['/vault', 'vault-selected'], ['/label', 'label-workspace'], ['/profile', 'profile-form'], ['/billing', 'billing-grid'], ['/gemini-usage', 'form-toolbar'], ['/import', 'import-list'], ['/privacy', 'sk-privacy']]) {
    const markup = pageSkeleton(path, false);
    assert.match(markup, /role="status"/);
    assert.match(markup, /aria-hidden="true" inert/);
    assert.ok(markup.includes(layout), `${path} missing ${layout}`);
  }
  assert.match(pageSkeleton('/unknown', false), /home-page/);
  assert.doesNotMatch(pageSkeleton('/verify', false), /sk-cert-result/);
  assert.match(pageSkeleton('/cert/12345678', true), /sk-cert-result/);
});

test('section skeletons describe loading and match sheet count', () => {
  assert.match(usageResultsSkeleton(), /Loading usage/);
  const preview = sheetPreviewSkeleton(4);
  assert.match(preview, /role="status"/);
  assert.equal((preview.match(/class="sheet-page"/g) || []).length, 4);
});
