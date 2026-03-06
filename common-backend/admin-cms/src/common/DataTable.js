import React, { useState, useMemo } from 'react';

const DataTable = ({
  // Data
  data = [],
  columns = [],
  
  // Pagination
  pagination = true,
  itemsPerPage = 10,
  currentPage = 1,
  onPageChange = null,
  
  // Sorting
  sorting = true,
  sortField = null,
  sortDirection = 'asc',
  onSort = null,
  
  // Filtering
  filtering = true,
  searchQuery = '',
  onSearchChange = null,
  searchPlaceholder = 'Search...',
  
  // Actions
  actions = null,
  onRowClick = null,
  selectable = false,
  selectedRows = [],
  onSelectionChange = null,
  
  // Styling
  className = '',
  size = 'normal', // 'small', 'normal', 'large'
  variant = 'default', // 'default', 'striped', 'bordered', 'hoverable'
  
  // State
  loading = false,
  emptyMessage = 'No data available',
  
  // Additional props
  ...props
}) => {
  
  // Local state for internal pagination/sorting if not controlled externally
  const [internalPage, setInternalPage] = useState(1);
  const [internalSortField, setInternalSortField] = useState(null);
  const [internalSortDirection, setInternalSortDirection] = useState('asc');
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  
  // Use external or internal state
  const currentPageState = onPageChange ? currentPage : internalPage;
  const sortFieldState = onSort ? sortField : internalSortField;
  const sortDirectionState = onSort ? sortDirection : internalSortDirection;
  const searchQueryState = onSearchChange ? searchQuery : internalSearchQuery;
  
  // Size-based classes
  const sizeClasses = {
    small: 'dataTableSmall',
    normal: 'dataTableNormal',
    large: 'dataTableLarge'
  };

  // Variant-based classes
  const variantClasses = {
    default: 'dataTableDefault',
    striped: 'dataTableStriped',
    bordered: 'dataTableBordered',
    hoverable: 'dataTableHoverable'
  };

  const tableClassName = `dataTable ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;
  
  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!searchQueryState.trim()) return data;
    
    const query = searchQueryState.toLowerCase().trim();
    return data.filter(item => 
      columns.some(column => {
        const value = column.accessor ? column.accessor(item) : item[column.key];
        if (value == null) return false;
        return String(value).toLowerCase().includes(query);
      })
    );
  }, [data, columns, searchQueryState]);
  
  // Sort data
  const sortedData = useMemo(() => {
    if (!sortFieldState) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aValue = columns.find(col => col.key === sortFieldState)?.accessor?.(a) ?? a[sortFieldState];
      const bValue = columns.find(col => col.key === sortFieldState)?.accessor?.(b) ?? b[sortFieldState];
      
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      
      let comparison = 0;
      if (typeof aValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else {
        comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
      
      return sortDirectionState === 'desc' ? -comparison : comparison;
    });
  }, [filteredData, sortFieldState, sortDirectionState, columns]);
  
  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    
    const startIndex = (currentPageState - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, pagination, currentPageState, itemsPerPage]);
  
  // Calculate total pages
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  
  // Handle sorting
  const handleSort = (field) => {
    if (!sorting) return;
    
    const newDirection = field === sortFieldState && sortDirectionState === 'asc' ? 'desc' : 'asc';
    
    if (onSort) {
      onSort(field, newDirection);
    } else {
      setInternalSortField(field);
      setInternalSortDirection(newDirection);
    }
  };
  
  // Handle page change
  const handlePageChange = (page) => {
    if (onPageChange) {
      onPageChange(page);
    } else {
      setInternalPage(page);
    }
  };
  
  // Handle search change
  const handleSearchChange = (e) => {
    const value = e.target.value;
    if (onSearchChange) {
      onSearchChange(value);
    } else {
      setInternalSearchQuery(value);
    }
    
    // Reset to first page when searching
    if (onPageChange) {
      onPageChange(1);
    } else {
      setInternalPage(1);
    }
  };
  
  // Handle row selection
  const handleRowSelection = (rowId) => {
    if (!selectable || !onSelectionChange) return;
    
    const newSelection = selectedRows.includes(rowId)
      ? selectedRows.filter(id => id !== rowId)
      : [...selectedRows, rowId];
    
    onSelectionChange(newSelection);
  };
  
  // Handle select all
  const handleSelectAll = () => {
    if (!selectable || !onSelectionChange) return;
    
    const allIds = paginatedData.map(item => item._id || item.id);
    const newSelection = selectedRows.length === allIds.length ? [] : allIds;
    onSelectionChange(newSelection);
  };
  
  // Render sort indicator
  const renderSortIndicator = (column) => {
    if (!sorting || !column.sortable) return null;
    
    const isSorted = column.key === sortFieldState;
    const direction = isSorted ? sortDirectionState : null;
    
    return (
      <span className="sortIndicator">
        {direction === 'asc' && '↑'}
        {direction === 'desc' && '↓'}
        {!direction && '↕'}
      </span>
    );
  };
  
  // Render cell content
  const renderCell = (item, column) => {
    if (column.render) {
      return column.render(item, column);
    }
    
    const value = column.accessor ? column.accessor(item) : item[column.key];
    
    if (value == null) return column.defaultValue || '-';
    
    // Handle different data types
    if (column.type === 'date') {
      return new Date(value).toLocaleDateString();
    }
    
    if (column.type === 'datetime') {
      return new Date(value).toLocaleString();
    }
    
    if (column.type === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    if (column.type === 'status') {
      return (
        <span className={`status status${value ? 'Active' : 'Inactive'}`}>
          {value ? 'Active' : 'Inactive'}
        </span>
      );
    }
    
    if (column.type === 'image') {
      return (
        <img 
          src={value} 
          alt={column.alt || 'Image'} 
          className="tableImage"
          onError={(e) => e.target.style.display = 'none'}
        />
      );
    }
    
    return value;
  };
  
  return (
    <div className={tableClassName} {...props}>
      {/* Search and Actions Bar */}
      {(filtering || actions) && (
        <div className="dataTableToolbar">
          {filtering && (
            <div className="dataTableSearch">
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQueryState}
                onChange={handleSearchChange}
                className="dataTableSearchInput"
              />
            </div>
          )}
          
          {actions && (
            <div className="dataTableActions">
              {actions}
            </div>
          )}
        </div>
      )}
      
      {/* Table */}
      <div className="dataTableContainer">
        <table className="dataTableTable">
          <thead className="dataTableHeader">
            <tr className="dataTableHeaderRow">
              {/* Selection checkbox */}
              {selectable && (
                <th className="dataTableHeaderCell dataTableHeaderCellSelect">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === paginatedData.length && paginatedData.length > 0}
                    onChange={handleSelectAll}
                    className="dataTableCheckbox"
                  />
                </th>
              )}
              
              {/* Column headers */}
              {columns.map((column, index) => (
                <th
                  key={column.key || index}
                  className={`dataTableHeaderCell ${column.sortable && sorting ? 'dataTableHeaderCellSortable' : ''}`}
                  onClick={() => column.sortable && handleSort(column.key)}
                  style={{ width: column.width, minWidth: column.minWidth }}
                >
                  <div className="dataTableHeaderContent">
                    <span className="dataTableHeaderText">{column.header}</span>
                    {renderSortIndicator(column)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody className="dataTableBody">
            {loading ? (
              <tr className="dataTableRow dataTableRowLoading">
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="dataTableLoadingCell">
                  <div className="dataTableLoading">Loading...</div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr className="dataTableRow dataTableRowEmpty">
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="dataTableEmptyCell">
                  <div className="dataTableEmpty">{emptyMessage}</div>
                </td>
              </tr>
            ) : (
              paginatedData.map((item, rowIndex) => (
                <tr
                  key={item._id || item.id || rowIndex}
                  className={`dataTableRow ${onRowClick ? 'dataTableRowClickable' : ''}`}
                  onClick={() => onRowClick && onRowClick(item)}
                >
                  {/* Selection checkbox */}
                  {selectable && (
                    <td className="dataTableCell dataTableCellSelect">
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(item._id || item.id)}
                        onChange={() => handleRowSelection(item._id || item.id)}
                        className="dataTableCheckbox"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}
                  
                  {/* Data cells */}
                  {columns.map((column, cellIndex) => (
                    <td
                      key={column.key || cellIndex}
                      className="dataTableCell"
                      style={{ width: column.width, minWidth: column.minWidth }}
                    >
                      {renderCell(item, column)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="dataTablePagination">
          <div className="dataTablePaginationInfo">
            Showing {((currentPageState - 1) * itemsPerPage) + 1} to {Math.min(currentPageState * itemsPerPage, filteredData.length)} of {filteredData.length} entries
          </div>
          
          <div className="dataTablePaginationControls">
            <button
              onClick={() => handlePageChange(currentPageState - 1)}
              disabled={currentPageState === 1}
              className="dataTablePaginationButton"
            >
              Previous
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`dataTablePaginationButton ${page === currentPageState ? 'dataTablePaginationButtonActive' : ''}`}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={() => handlePageChange(currentPageState + 1)}
              disabled={currentPageState === totalPages}
              className="dataTablePaginationButton"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable; 