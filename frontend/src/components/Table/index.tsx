import styles from './styles.module.css';

// ================================================
// Interface
// ================================================

export interface Column<T> {
    key: keyof T | string;
    header: string;
    width?: string;
    render?: (item: T) => React.ReactNode;
}

export interface TableProps<T> {
    columns: Column<T>[];
    data: T[];
    keyExtractor: (item: T) => string | number;
    emptyMessage?: string;
    onRowClick?: (item: T) => void;
}

// ================================================
// Component
// ================================================

function Table<T>({
    columns,
    data,
    keyExtractor,
    emptyMessage = 'No data available',
    onRowClick,
}: TableProps<T>) {
    const getCellValue = (item: T, column: Column<T>): React.ReactNode => {
        if (column.render) {
            return column.render(item);
        }
        const value = item[column.key as keyof T];
        if (value === null || value === undefined) {
            return '-';
        }
        return String(value);
    };

    return (
        <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th
                                key={String(column.key)}
                                style={{ width: column.width }}
                            >
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                className={styles.emptyCell}
                            >
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((item) => (
                            <tr
                                key={keyExtractor(item)}
                                onClick={() => onRowClick?.(item)}
                                className={onRowClick ? styles.clickable : ''}
                            >
                                {columns.map((column) => (
                                    <td key={String(column.key)}>
                                        {getCellValue(item, column)}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default Table;

