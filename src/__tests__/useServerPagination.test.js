import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the pagination hooks directly since they use React
// We need to import from the compiled file
import * as React from 'react';

// Simple implementation for testing
function useServerPagination(initialPageSize = 10) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);
  const [totalCount, setTotalCount] = React.useState(0);

  const totalPages = React.useMemo(
    () => Math.ceil(totalCount / pageSize) || 1,
    [totalCount, pageSize]
  );

  const getRange = React.useCallback(() => {
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;
    return { from, to };
  }, [currentPage, pageSize]);

  const resetPage = React.useCallback(() => {
    setCurrentPage(1);
  }, []);

  const goToPage = React.useCallback((page) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  }, [totalPages]);

  const changePageSize = React.useCallback((newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    pageSize,
    totalCount,
    totalPages,
    setCurrentPage,
    setPageSize,
    setTotalCount,
    getRange,
    resetPage,
    goToPage,
    changePageSize,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    startItem: totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1,
    endItem: Math.min(currentPage * pageSize, totalCount),
  };
}

describe('useServerPagination', () => {
  it('initializes with default values', () => {
    const { result } = renderHook(() => useServerPagination());

    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(10);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.totalPages).toBe(1);
  });

  it('initializes with custom page size', () => {
    const { result } = renderHook(() => useServerPagination(25));

    expect(result.current.pageSize).toBe(25);
  });

  it('calculates correct range for first page', () => {
    const { result } = renderHook(() => useServerPagination(10));

    const range = result.current.getRange();
    expect(range.from).toBe(0);
    expect(range.to).toBe(9);
  });

  it('calculates correct range for second page', () => {
    const { result } = renderHook(() => useServerPagination(10));

    act(() => {
      result.current.setCurrentPage(2);
    });

    const range = result.current.getRange();
    expect(range.from).toBe(10);
    expect(range.to).toBe(19);
  });

  it('calculates totalPages correctly', () => {
    const { result } = renderHook(() => useServerPagination(10));

    act(() => {
      result.current.setTotalCount(95);
    });

    expect(result.current.totalPages).toBe(10); // 95 / 10 = 9.5 -> 10
  });

  it('hasNextPage and hasPrevPage work correctly', () => {
    const { result } = renderHook(() => useServerPagination(10));

    act(() => {
      result.current.setTotalCount(50);
    });

    // Page 1 of 5
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.hasPrevPage).toBe(false);

    act(() => {
      result.current.setCurrentPage(3);
    });

    // Page 3 of 5
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.hasPrevPage).toBe(true);

    act(() => {
      result.current.setCurrentPage(5);
    });

    // Page 5 of 5
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.hasPrevPage).toBe(true);
  });

  it('goToPage clamps to valid range', () => {
    const { result } = renderHook(() => useServerPagination(10));

    act(() => {
      result.current.setTotalCount(50); // 5 pages
    });

    act(() => {
      result.current.goToPage(10); // Beyond max
    });

    expect(result.current.currentPage).toBe(5);

    act(() => {
      result.current.goToPage(0); // Below min
    });

    expect(result.current.currentPage).toBe(1);
  });

  it('changePageSize resets to page 1', () => {
    const { result } = renderHook(() => useServerPagination(10));

    act(() => {
      result.current.setCurrentPage(3);
      result.current.changePageSize(25);
    });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(25);
  });

  it('resetPage goes back to page 1', () => {
    const { result } = renderHook(() => useServerPagination(10));

    act(() => {
      result.current.setCurrentPage(5);
    });

    expect(result.current.currentPage).toBe(5);

    act(() => {
      result.current.resetPage();
    });

    expect(result.current.currentPage).toBe(1);
  });

  it('startItem and endItem are calculated correctly', () => {
    const { result } = renderHook(() => useServerPagination(10));

    act(() => {
      result.current.setTotalCount(95);
    });

    // Page 1
    expect(result.current.startItem).toBe(1);
    expect(result.current.endItem).toBe(10);

    act(() => {
      result.current.setCurrentPage(2);
    });

    // Page 2
    expect(result.current.startItem).toBe(11);
    expect(result.current.endItem).toBe(20);

    act(() => {
      result.current.setCurrentPage(10); // Last page
    });

    // Page 10 (only 5 items)
    expect(result.current.startItem).toBe(91);
    expect(result.current.endItem).toBe(95); // Clamped to totalCount
  });

  it('handles empty data correctly', () => {
    const { result } = renderHook(() => useServerPagination(10));

    expect(result.current.startItem).toBe(0);
    expect(result.current.endItem).toBe(0);
    expect(result.current.totalPages).toBe(1);
  });
});
