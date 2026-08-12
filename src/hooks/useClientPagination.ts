import { useEffect, useMemo, useState } from "react";

type ClientPaginationOptions = {
  page?: number;
  onPageChange?: (page: number) => void;
};

export function useClientPagination<T>(
  items: T[],
  pageSize = 50,
  options?: ClientPaginationOptions,
) {
  const [internalPage, setInternalPage] = useState(options?.page ?? 1);
  const page = options?.page ?? internalPage;
  const setPage = options?.onPageChange ?? setInternalPage;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  useEffect(() => {
    if (options?.page != null && options.page !== internalPage) {
      setInternalPage(options.page);
    }
  }, [options?.page, internalPage]);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page, setPage]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    page: safePage,
    setPage,
    pageItems,
    totalPages,
    total,
    pageSize,
  };
}
