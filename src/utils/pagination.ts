export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
  sort: Record<string, 1 | -1>;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export const buildPagination = (
  options: PaginationOptions,
  allowedSortFields: string[] = ['createdAt'],
): PaginationResult => {
  const page = Math.max(parseInt(String(options.page ?? 1), 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(String(options.limit ?? 20), 10) || 20, 1),
    100,
  );
  const skip = (page - 1) * limit;

  const sortBy = allowedSortFields.includes(options.sortBy ?? '')
    ? (options.sortBy as string)
    : 'createdAt';
  const sortOrder: 1 | -1 = options.sortOrder === 'asc' ? 1 : -1;

  return {
    page,
    limit,
    skip,
    sort: { [sortBy]: sortOrder },
  };
};

export const buildPaginatedMeta = (
  page: number,
  limit: number,
  total: number,
): PaginatedMeta => {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};