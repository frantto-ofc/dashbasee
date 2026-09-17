import assert from 'node:assert/strict';
import test from 'node:test';
import { safeNextPath } from '../lib/supabase/redirect.ts';

test('allows the password recovery destination', () => {
  assert.equal(safeNextPath('/update-password'), '/update-password');
});

test('rejects external, encoded, protocol-relative and auth-loop destinations', () => {
  for (const input of [null, '', 'https://example.com', '//example.com', '/\\example.com', '/%2f%2fexample.com', '/login', '/auth/signout', '/update-password/../login', '\n//example.com']) {
    assert.equal(safeNextPath(input), '/');
  }
});
