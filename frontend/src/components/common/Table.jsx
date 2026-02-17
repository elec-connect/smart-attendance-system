import React from 'react';
import clsx from 'clsx';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';

const Table = ({
  columns,
  data,
  onRowClick,
  sortConfig,
  onSort,
  emptyMessage = 'Aucune donnée disponible',
  className = ''
}) => {
  const handleSort = (key) => {
    if (onSort) {
      onSort(key);
    }
  };

  const getSortIcon = (key) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <FaSort className="w-3 h-3" />;
    }
    
    return sortConfig.direction === 'asc' ? 
      <FaSortUp className="w-3 h-3" /> : 
      <FaSortDown className="w-3 h-3" />;
  };

  return (
    <div className="overflow-x-auto">
      <table className={clsx('min-w-full divide-y divide-gray-200', className)}>
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={clsx(
                  'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
                  column.sortable && 'cursor-pointer hover:bg-gray-100',
                  column.align === 'right' && 'text-right',
                  column.align === 'center' && 'text-center'
                )}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                <div className={clsx(
                  'flex items-center',
                  column.align === 'right' && 'justify-end',
                  column.align === 'center' && 'justify-center'
                )}>
                  {column.title}
                  {column.sortable && (
                    <span className="ml-2">
                      {getSortIcon(column.key)}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        
        <tbody className="bg-white divide-y divide-gray-200">
          {data.length > 0 ? (
            data.map((row, rowIndex) => (
              <tr
                key={row.id || rowIndex}
                onClick={() => onRowClick && onRowClick(row)}
                className={clsx(
                  onRowClick && 'cursor-pointer hover:bg-gray-50',
                  rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                )}
              >
                {columns.map((column) => (
                  <td
                    key={`${row.id || rowIndex}-${column.key}`}
                    className={clsx(
                      'px-6 py-4 whitespace-nowrap',
                      column.align === 'right' && 'text-right',
                      column.align === 'center' && 'text-center'
                    )}
                  >
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-6 py-12 text-center">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 mb-4 text-gray-400">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;