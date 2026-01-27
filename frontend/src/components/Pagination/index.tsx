import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight, faEllipsis } from "@fortawesome/free-solid-svg-icons";
import styles from "./styles.module.css";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) {
    return null;
  }

  const getPageNumbers = (): (number | "ellipsis")[] => {
    const pages: (number | "ellipsis")[] = [];

    // Always add first page
    pages.push(1);

    // Calculate range around current page
    const rangeStart = Math.max(2, currentPage - 2);
    const rangeEnd = Math.min(totalPages - 1, currentPage + 2);

    // Add ellipsis after first page if needed
    if (rangeStart > 2) {
      pages.push("ellipsis");
    }

    // Add pages in range
    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }

    // Add ellipsis before last page if needed
    if (rangeEnd < totalPages - 1) {
      pages.push("ellipsis");
    }

    // Always add last page (if different from first)
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <button
        className={`${styles.button} ${currentPage === 1 ? styles["button--disabled"] : ""}`}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        <FontAwesomeIcon icon={faChevronLeft} />
      </button>

      {pageNumbers.map((page, index) =>
        page === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className={styles.ellipsis}>
            <FontAwesomeIcon icon={faEllipsis} />
          </span>
        ) : (
          <button
            key={page}
            className={`${styles.button} ${page === currentPage ? styles["button--active"] : ""}`}
            onClick={() => onPageChange(page)}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </button>
        )
      )}

      <button
        className={`${styles.button} ${currentPage === totalPages ? styles["button--disabled"] : ""}`}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        <FontAwesomeIcon icon={faChevronRight} />
      </button>
    </nav>
  );
};

export default Pagination;