export interface PageRequest {
  page: number
  pageSize: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export const pageOffset = ({ page, pageSize }: PageRequest) => (Math.max(page, 1) - 1) * pageSize

export function mapPaginated<T, R>(result: Paginated<T>, fn: (item: T) => R): Paginated<R> {
  return { ...result, items: result.items.map(fn) }
}
