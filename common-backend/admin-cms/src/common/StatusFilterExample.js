import React, { useState, useMemo } from 'react';
import { 
  StatusFilter, 
  calculateStandardStatusCounts, 
  calculateCustomStatusCounts,
  filterEntitiesByStatus 
} from './index';

/**
 * Example component demonstrating how to use StatusFilter in different scenarios
 * This can be used as a reference for implementing in other manager components
 */

// Example 1: Standard Status Filter (for entities with isActive and deleted fields)
export const StandardStatusFilterExample = ({ entities, loading }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter entities based on status and search
  const filteredEntities = useMemo(() => {
    let filtered = entities;
    
    // Apply status filter
    filtered = filterEntitiesByStatus(filtered, statusFilter);
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(entity => 
        entity.name.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [entities, searchQuery, statusFilter]);

  return (
    <div>
      <h2>Entities ({filteredEntities.length})</h2>
      
      <StatusFilter
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        counts={calculateStandardStatusCounts(entities)}
        disabled={loading}
      />
      
      {/* Render filtered entities */}
      {filteredEntities.map(entity => (
        <div key={entity._id}>{entity.name}</div>
      ))}
    </div>
  );
};

// Example 2: Custom Status Filter (for entities with custom status fields)
export const CustomStatusFilterExample = ({ orders, loading }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Custom status options for orders with colors
  const orderStatusOptions = [
    { key: 'all', label: 'All Orders', count: orders.length, color: 'black' },
    { key: 'pending', label: 'Pending', count: orders.filter(o => o.status === 'pending').length, color: 'orange' },
    { key: 'processing', label: 'Processing', count: orders.filter(o => o.status === 'processing').length, color: 'blue' },
    { key: 'shipped', label: 'Shipped', count: orders.filter(o => o.status === 'shipped').length, color: 'purple' },
    { key: 'delivered', label: 'Delivered', count: orders.filter(o => o.status === 'delivered').length, color: 'green' },
    { key: 'cancelled', label: 'Cancelled', count: orders.filter(o => o.status === 'cancelled').length, color: 'red' }
  ];

  // Filter orders based on status and search
  const filteredOrders = useMemo(() => {
    let filtered = orders;
    
    // Apply status filter using custom status field
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(order => 
        order.orderNumber.toLowerCase().includes(query) ||
        (order.customerName && order.customerName.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [orders, searchQuery, statusFilter]);

  return (
    <div>
      <h2>Orders ({filteredOrders.length})</h2>
      
      <StatusFilter
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        counts={calculateCustomStatusCounts(orders, 'status', {
          pending: 'Pending',
          processing: 'Processing',
          shipped: 'Shipped',
          delivered: 'Delivered',
          cancelled: 'Cancelled'
        })}
        statusOptions={orderStatusOptions}
        disabled={loading}
      />
      
      {/* Render filtered orders */}
      {filteredOrders.map(order => (
        <div key={order._id}>
          {order.orderNumber} - {order.customerName} - {order.status}
        </div>
      ))}
    </div>
  );
};

// Example 3: Status Filter without counts
export const StatusFilterWithoutCountsExample = ({ products, loading }) => {
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredProducts = useMemo(() => {
    return filterEntitiesByStatus(products, statusFilter);
  }, [products, statusFilter]);

  return (
    <div>
      <h2>Products ({filteredProducts.length})</h2>
      
      <StatusFilter
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        counts={calculateStandardStatusCounts(products)}
        showCounts={false} // Hide counts
        disabled={loading}
      />
      
      {/* Render filtered products */}
      {filteredProducts.map(product => (
        <div key={product._id}>{product.name}</div>
      ))}
    </div>
  );
};

// Example 4: Status Filter with Custom Colors for Different Entity Types
export const CustomColorStatusFilterExample = ({ products, loading }) => {
  const [statusFilter, setStatusFilter] = useState('all');

  // Custom status options with specific colors for products
  const productStatusOptions = [
    { key: 'all', label: 'All Products', count: products.length, color: 'black' },
    { key: 'inStock', label: 'In Stock', count: products.filter(p => p.stock > 0).length, color: 'green' },
    { key: 'lowStock', label: 'Low Stock', count: products.filter(p => p.stock <= 10 && p.stock > 0).length, color: 'orange' },
    { key: 'outOfStock', label: 'Out of Stock', count: products.filter(p => p.stock === 0).length, color: 'red' },
    { key: 'discontinued', label: 'Discontinued', count: products.filter(p => p.discontinued).length, color: 'gray' }
  ];

  const filteredProducts = useMemo(() => {
    if (statusFilter === 'all') return products;
    
    switch (statusFilter) {
      case 'inStock':
        return products.filter(p => p.stock > 0);
      case 'lowStock':
        return products.filter(p => p.stock <= 10 && p.stock > 0);
      case 'outOfStock':
        return products.filter(p => p.stock === 0);
      case 'discontinued':
        return products.filter(p => p.discontinued);
      default:
        return products;
    }
  }, [products, statusFilter]);

  return (
    <div>
      <h2>Products ({filteredProducts.length})</h2>
      
      <StatusFilter
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        counts={{
          total: products.length,
          inStock: products.filter(p => p.stock > 0).length,
          lowStock: products.filter(p => p.stock <= 10 && p.stock > 0).length,
          outOfStock: products.filter(p => p.stock === 0).length,
          discontinued: products.filter(p => p.discontinued).length
        }}
        statusOptions={productStatusOptions}
        disabled={loading}
      />
      
      {/* Render filtered products */}
      {filteredProducts.map(product => (
        <div key={product._id}>
          {product.name} - Stock: {product.stock}
        </div>
      ))}
    </div>
  );
};

export default StandardStatusFilterExample; 