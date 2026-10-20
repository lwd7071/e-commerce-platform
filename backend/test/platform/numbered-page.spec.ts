import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { numberedPage, parseNumberedPage } from '../../src/platform/http/numbered-page.ts';
import { ValidationFailedError } from '../../src/platform/errors/app-error.ts';

describe('numbered admin pagination', () => {
  it('returns first and last page metadata for a filtered result set', () => {
    const query = { page: '2', page_size: '2', status: 'ACTIVE' };
    const { page, pageSize } = parseNumberedPage(query);
    assert.deepEqual(numberedPage(['a', 'b', 'c'], page, pageSize), {
      items: ['c'], limit: 2, page: 2, page_size: 2, total_items: 3, total_pages: 2, has_more: false, next_cursor: null,
    });
  });

  it('keeps an empty result on page one and rejects pages beyond the result', () => {
    assert.equal(numberedPage([], 1, 20).total_pages, 1);
    assert.throws(() => numberedPage(['a'], 2, 20), ValidationFailedError);
    assert.throws(() => parseNumberedPage({ page: '0' }), ValidationFailedError);
  });
});
