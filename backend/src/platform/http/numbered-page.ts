import { ValidationFailedError } from '../errors/app-error.ts';

export function parseNumberedPage(query: Record<string, unknown>) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.page_size === undefined && query.limit === undefined ? 20 : Number(query.page_size ?? query.limit);
  if (!Number.isInteger(page) || page < 1) throw new ValidationFailedError('page must be a positive integer', { field: 'page' });
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new ValidationFailedError('page_size must be from 1 to 100', { field: 'page_size' });
  return { page, pageSize };
}

export function numberedPage<T>(items: T[], page: number, pageSize: number) {
  // shortcut: array-backed reads still load all rows; move paging into repositories when list volume grows.
  const total_items = items.length;
  const total_pages = Math.max(1, Math.ceil(total_items / pageSize));
  if (page > total_pages) throw new ValidationFailedError('page exceeds total_pages', { field: 'page', total_pages });
  const data = items.slice((page - 1) * pageSize, page * pageSize);
  return {
    items: data,
    limit: pageSize,
    page,
    page_size: pageSize,
    total_items,
    total_pages,
    has_more: page < total_pages,
    next_cursor: null,
  };
}
