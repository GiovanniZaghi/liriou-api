import type { Paginated } from '../../application/pagination'

export interface PaginatedResponse<T> {
  data: T[]
  meta: { total: number; page: number; pageSize: number; totalPages: number }
}

export function presentPaginated<T, R>(result: Paginated<T>, present: (item: T) => R): PaginatedResponse<R> {
  return {
    data: result.items.map(present),
    meta: {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: Math.ceil(result.total / result.pageSize),
    },
  }
}
