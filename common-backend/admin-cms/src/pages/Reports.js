import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api/axios';
import PageHeader from '../common/PageHeader';
import { useAuth } from '../context/AuthContext';
import '../css/styles.css';

const REPORT_CONFIG = [
  { id: 'sales-summary', label: 'Sales Summary', category: 'Sales & Revenue', params: [] },
  { id: 'order-wise-sales', label: 'Order-wise Sales', category: 'Sales & Revenue', params: ['startDate', 'endDate', 'orderStatus', 'paymentMethod', 'page', 'limit'] },
  { id: 'product-wise-sales', label: 'Product-wise Sales', category: 'Sales & Revenue', params: ['startDate', 'endDate'] },
  { id: 'category-wise-sales', label: 'Category-wise Sales', category: 'Sales & Revenue', params: ['startDate', 'endDate'] },
  { id: 'customer-overview', label: 'Customer Overview', category: 'Customer', params: ['startDate', 'endDate'] },
  { id: 'customer-purchase', label: 'Customer Purchase', category: 'Customer', params: ['startDate', 'endDate', 'page', 'limit'] },
  { id: 'customer-lifetime-value', label: 'Customer Lifetime Value', category: 'Customer', params: [] },
  { id: 'inventory-stock', label: 'Inventory Stock', category: 'Product & Inventory', params: ['reorderLevel'] },
  { id: 'inventory-valuation', label: 'Inventory Valuation', category: 'Product & Inventory', params: [] },
  { id: 'payment-method', label: 'Payment Method', category: 'Payment & Finance', params: ['startDate', 'endDate'] },
  { id: 'refund-cancellation', label: 'Refund & Cancellation', category: 'Payment & Finance', params: ['startDate', 'endDate'] },
  { id: 'tax', label: 'Tax Report', category: 'Payment & Finance', params: ['startDate', 'endDate'] },
  { id: 'coupon-usage', label: 'Coupon Usage', category: 'Marketing', params: ['startDate', 'endDate'] },
  { id: 'shipping-performance', label: 'Shipping Performance', category: 'Shipping & Fulfillment', params: [] },
  { id: 'admin-activity', label: 'Admin Activity', category: 'Admin', params: [] },
];

const formatCurrency = (n) => (n != null && typeof n === 'number' ? `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-');
/** Use "Rs." for CSV/PDF so the symbol renders correctly in Excel and jsPDF default font */
const formatCurrencyExport = (n) => (n != null && typeof n === 'number' ? `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-');
const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : '-');

const REPORT_IDS = REPORT_CONFIG.map((r) => r.id);

/** Build { headers, rows } for CSV/XLS/PDF export from current report result */
function getReportExportData(reportId, result, formatCurrency, formatDate) {
  if (!result) return { headers: [], rows: [] };
  const str = (v) => (v == null ? '' : String(v));
  switch (reportId) {
    case 'sales-summary':
      return {
        headers: ['Metric', 'Value'],
        rows: [
          ['Total revenue', formatCurrency(result.totalRevenue)],
          ['Total orders', result.totalOrders ?? 0],
          ['Average order value', formatCurrency(result.averageOrderValue)],
          ['Total discounts', formatCurrency(result.totalDiscounts)],
          ['Total tax', formatCurrency(result.totalTax)],
          ['Total shipping', formatCurrency(result.totalShipping)],
          ['Total refunded', formatCurrency(result.totalRefunded)],
          ['Net revenue', formatCurrency(result.netRevenue)],
        ],
      };
    case 'order-wise-sales':
      return {
        headers: ['Order #', 'Customer', 'Total', 'Status', 'Payment', 'Date'],
        rows: (result.data || []).map((r) => [
          str(r.orderNumber ?? r.orderId),
          str(r.customerName ?? r.customerEmail),
          formatCurrency(r.totalAmount),
          str(r.orderStatus),
          str(r.paymentMethod),
          formatDate(r.createdAt),
        ]),
      };
    case 'product-wise-sales':
      return {
        headers: ['Product', 'SKU', 'Units sold', 'Revenue', 'Returns'],
        rows: (result.data || []).map((r) => [
          str(r.productName),
          str(r.sku),
          r.unitsSold,
          formatCurrency(r.revenue),
          r.returnCount ?? 0,
        ]),
      };
    case 'category-wise-sales':
      return {
        headers: ['Category', 'Revenue', 'Units', '%'],
        rows: (result.data || []).map((r) => [
          str(r.categoryName),
          formatCurrency(r.revenue),
          r.unitsSold,
          r.contributionPercent != null ? `${r.contributionPercent.toFixed(1)}%` : '',
        ]),
      };
    case 'customer-overview':
      return {
        headers: ['Metric', 'Value'],
        rows: [
          ['Total customers', result.totalCustomers ?? 0],
          ['New (period)', result.newCustomers ?? '-'],
          ['Returning', result.returningCustomers ?? 0],
        ],
      };
    case 'customer-purchase':
      return {
        headers: ['Customer', 'Email', 'Total spend', 'Orders', 'Last order', 'AOV'],
        rows: (result.data || []).map((r) => [
          str(r.customerName),
          str(r.customerEmail),
          formatCurrency(r.totalSpend),
          r.totalOrders,
          formatDate(r.lastOrderDate),
          formatCurrency(r.averageOrderValue),
        ]),
      };
    case 'customer-lifetime-value':
      return {
        headers: ['Customer', 'Email', 'CLV', 'Orders', 'AOV'],
        rows: (result.data || []).map((r) => [
          str(r.customerName),
          str(r.customerEmail),
          formatCurrency(r.clv),
          r.orderCount,
          formatCurrency(r.averageOrderValue),
        ]),
      };
    case 'inventory-stock':
      return {
        headers: ['Product', 'SKU', 'Stock', 'Low stock'],
        rows: (result.data || []).map((r) => [
          str(r.name),
          str(r.sku),
          r.currentStock ?? 0,
          r.lowStock ? 'Yes' : 'No',
        ]),
      };
    case 'inventory-valuation':
      return {
        headers: ['Product', 'SKU', 'Stock', 'Unit price', 'Valuation'],
        rows: (result.data || []).map((r) => [
          str(r.name),
          str(r.sku),
          r.stock ?? 0,
          formatCurrency(r.unitPrice),
          formatCurrency(r.valuation),
        ]),
      };
    case 'payment-method':
      return {
        headers: ['Payment method', 'Total txns', 'Success', 'Failed', 'Refunded', 'Amount'],
        rows: (result.data || []).map((r) => [
          str(r.paymentMethod),
          r.totalTransactions,
          r.successfulTransactions,
          r.failedTransactions,
          r.refundedTransactions,
          formatCurrency(r.successfulAmount),
        ]),
      };
    case 'refund-cancellation':
      return {
        headers: ['Metric', 'Value'],
        rows: [
          ['Refunded count', result.refunded?.count ?? 0],
          ['Refunded amount', formatCurrency(result.refunded?.totalAmount)],
          ['Cancelled count', result.cancelled?.count ?? 0],
          ['Returned count', result.returned?.count ?? 0],
          ['Total paid revenue', formatCurrency(result.totalPaidRevenue)],
          ['Net revenue after refunds', formatCurrency(result.netRevenueAfterRefunds)],
        ],
      };
    case 'tax':
      return {
        headers: ['Date', 'Tax collected', 'Orders'],
        rows: (result.data || []).map((r) => [str(r._id), formatCurrency(r.taxCollected), r.orderCount ?? 0]),
      };
    case 'coupon-usage':
      return {
        headers: ['Code', 'Type', 'Value', 'Usage count', 'Revenue', 'Discount'],
        rows: (result.data || []).map((r) => [
          str(r.code),
          str(r.discountType),
          r.discountValue,
          r.usageCount,
          formatCurrency(r.revenueGenerated),
          formatCurrency(r.totalDiscountAmount),
        ]),
      };
    case 'shipping-performance':
      return {
        headers: ['Courier', 'Orders', 'Avg days', 'Delayed'],
        rows: (result.data || []).map((r) => [
          str(r.courierName),
          r.orderCount,
          r.averageDeliveryDays ?? '',
          r.delayedShipments ?? 0,
        ]),
      };
    case 'admin-activity':
      return {
        headers: ['Admin', 'Action', 'Entity', 'Date'],
        rows: (result.data || []).map((r) => [
          str(r.adminId),
          str(r.action),
          str(r.entity),
          formatDate(r.createdAt),
        ]),
      };
    default:
      return { headers: [], rows: [] };
  }
}

function downloadReportCSV(reportName, reportId, result, formatDate) {
  const { headers, rows } = getReportExportData(reportId, result, formatCurrencyExport, formatDate);
  if (!headers.length) return;
  const escape = (v) => (v == null ? '' : `"${String(v).replace(/"/g, '""')}"`);
  const line = (arr) => arr.map(escape).join(',');
  const csv = [line(headers), ...rows.map((r) => line(r))].join('\r\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${reportName.replace(/\s+/g, '-')}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadReportXLS(reportName, reportId, result, formatDate) {
  const { headers, rows } = getReportExportData(reportId, result, formatCurrencyExport, formatDate);
  if (!headers.length) return;
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, `${reportName.replace(/\s+/g, '-')}-${Date.now()}.xlsx`);
}

function downloadReportPDF(reportName, reportId, result, formatDate) {
  const { headers, rows } = getReportExportData(reportId, result, formatCurrencyExport, formatDate);
  if (!headers.length) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' });
  doc.setFontSize(14);
  doc.text(reportName, 40, 30);
  autoTable(doc, {
    startY: 45,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [73, 80, 87] },
  });
  doc.save(`${reportName.replace(/\s+/g, '-')}-${Date.now()}.pdf`);
}

export default function Reports() {
  const { reportId } = useParams();
  const { selectedWebsite } = useAuth();
  const [selectedReport, setSelectedReport] = useState(() =>
    reportId && REPORT_IDS.includes(reportId) ? reportId : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', orderStatus: '', paymentMethod: '', page: 1, limit: 20, reorderLevel: 10 });
  const [downloadFormat, setDownloadFormat] = useState('csv');

  const hasTenantContext = !!selectedWebsite?._id;

  useEffect(() => {
    if (reportId && REPORT_IDS.includes(reportId)) {
      setSelectedReport(reportId);
      setResult(null);
      setError('');
    } else if (!reportId) {
      setSelectedReport(null);
    }
  }, [reportId]);

  const fetchReport = useCallback(async () => {
    if (!selectedReport) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.orderStatus) params.set('orderStatus', filters.orderStatus);
      if (filters.paymentMethod) params.set('paymentMethod', filters.paymentMethod);
      if (filters.page) params.set('page', filters.page);
      if (filters.limit) params.set('limit', filters.limit);
      if (filters.reorderLevel != null) params.set('reorderLevel', filters.reorderLevel);
      const url = `/reports/${selectedReport}${params.toString() ? `?${params.toString()}` : ''}`;
      const { data } = await api.get(url);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.msg || err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [selectedReport, filters]);

  const config = REPORT_CONFIG.find((r) => r.id === selectedReport);

  return (
    <div className="paddingAll20">
      <PageHeader
        title="Reports"
        subtitle={selectedWebsite ? `Ecommerce analytics for ${selectedWebsite.name} (${selectedWebsite.domain})` : 'Ecommerce analytics and reports'}
      />
      {!hasTenantContext && (
        <div className="brandFormContainer paddingAll32 appendBottom30" style={{ width: '100%' }}>
          <p className="font14 grayText">Select a website from the header to view reports for that tenant.</p>
        </div>
      )}
      {hasTenantContext && (
      <div className="brandFormContainer paddingAll32 appendBottom30" style={{ width: '100%' }}>
        {selectedReport ? (
          <>
            <h2 className="listTitle font30 fontBold blackText appendBottom24">{config?.label}</h2>
            <p className="font14 grayText appendBottom16">Data for: <strong>{selectedWebsite.name}</strong> ({selectedWebsite.domain})</p>
            <div className="makeFlex row gap10 appendBottom20">
              {(config?.params?.includes('startDate') || config?.params?.includes('endDate')) && (
                <>
                  <div className="makeFlex column gap8">
                    <label className="formLabel">Start date</label>
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                      className="formInput"
                      style={{ padding: '8px 12px', border: '1px solid #d8d8d8', borderRadius: '6px' }}
                    />
                  </div>
                  <div className="makeFlex column gap8">
                    <label className="formLabel">End date</label>
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
                      className="formInput"
                      style={{ padding: '8px 12px', border: '1px solid #d8d8d8', borderRadius: '6px' }}
                    />
                  </div>
                </>
              )}
              {config?.params?.includes('orderStatus') && (
                <div className="makeFlex column gap8">
                  <label className="formLabel">Order status</label>
                  <select
                    value={filters.orderStatus}
                    onChange={(e) => setFilters((f) => ({ ...f, orderStatus: e.target.value }))}
                    style={{ padding: '8px 12px', border: '1px solid #d8d8d8', borderRadius: '6px', minWidth: '160px' }}
                  >
                    <option value="">All</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="returned">Returned</option>
                  </select>
                </div>
              )}
              {config?.params?.includes('paymentMethod') && (
                <div className="makeFlex column gap8">
                  <label className="formLabel">Payment method</label>
                  <select
                    value={filters.paymentMethod}
                    onChange={(e) => setFilters((f) => ({ ...f, paymentMethod: e.target.value }))}
                    style={{ padding: '8px 12px', border: '1px solid #d8d8d8', borderRadius: '6px', minWidth: '180px' }}
                  >
                    <option value="">All</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="debit_card">Debit Card</option>
                    <option value="paypal">PayPal</option>
                    <option value="cash_on_delivery">Cash on Delivery</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}
              {config?.params?.includes('reorderLevel') && (
                <div className="makeFlex column gap8">
                  <label className="formLabel">Reorder level</label>
                  <input
                    type="number"
                    min={0}
                    value={filters.reorderLevel}
                    onChange={(e) => setFilters((f) => ({ ...f, reorderLevel: parseInt(e.target.value, 10) || 0 }))}
                    style={{ padding: '8px 12px', border: '1px solid #d8d8d8', borderRadius: '6px', width: '100px' }}
                  />
                </div>
              )}
            </div>
            <div className="makeFlex row gap10 appendBottom20">
              <button type="button" className="btnPrimary" onClick={fetchReport} disabled={loading}>
                {loading ? 'Loading...' : 'Run report'}
              </button>
            </div>
            {error && <div className="font14" style={{ color: '#c00', marginBottom: 12 }}>{error}</div>}
            {result && !loading && (
              <>
                <div className="makeFlex row gap10 appendBottom20" style={{ flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <span className="formLabel">Download</span>
                  <select
                    value={downloadFormat}
                    onChange={(e) => setDownloadFormat(e.target.value)}
                    className="formSelect"
                    style={{ width: 'auto', minWidth: 72 }}
                  >
                    <option value="csv">CSV</option>
                    <option value="xls">XLS</option>
                    <option value="pdf">PDF</option>
                  </select>
                  <button
                    type="button"
                    className="btnPrimary"
                    onClick={() => {
                      const name = config?.label || 'Report';
                      if (downloadFormat === 'csv') downloadReportCSV(name, selectedReport, result, formatDate);
                      else if (downloadFormat === 'xls') downloadReportXLS(name, selectedReport, result, formatDate);
                      else downloadReportPDF(name, selectedReport, result, formatDate);
                    }}
                  >
                    Download
                  </button>
                </div>
                <ReportResult reportId={selectedReport} result={result} formatCurrency={formatCurrency} formatDate={formatDate} />
              </>
            )}
          </>
        ) : (
          <div className="textCenter paddingAll60 grayText font16">
            Select a report from the sidebar to run it.
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function ReportResult({ reportId, result, formatCurrency, formatDate }) {
  if (reportId === 'sales-summary') {
    const rows = [
      { label: 'Total revenue', value: formatCurrency(result.totalRevenue) },
      { label: 'Total orders', value: result.totalOrders ?? 0 },
      { label: 'Average order value', value: formatCurrency(result.averageOrderValue) },
      { label: 'Total discounts', value: formatCurrency(result.totalDiscounts) },
      { label: 'Total tax', value: formatCurrency(result.totalTax) },
      { label: 'Total shipping', value: formatCurrency(result.totalShipping) },
      { label: 'Total refunded', value: formatCurrency(result.totalRefunded) },
      { label: 'Net revenue', value: formatCurrency(result.netRevenue) },
    ];
    return (
      <div className="reportsSummaryTableWrap">
        <table className="fullWidth reportsTable">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="fontSemiBold">{row.label}</td>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (reportId === 'order-wise-sales' && result.data) {
    return (
      <div>
        <p>Total: {result.pagination?.totalCount ?? result.data.length} orders</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="fullWidth reportsTable">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((row) => (
                <tr key={row.orderId}>
                  <td>{row.orderNumber ?? row.orderId}</td>
                  <td>{row.customerName ?? row.customerEmail}</td>
                  <td>{formatCurrency(row.totalAmount)}</td>
                  <td>{row.orderStatus}</td>
                  <td>{row.paymentMethod}</td>
                  <td>{formatDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  if (reportId === 'product-wise-sales' && result.data) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="fullWidth reportsTable">
          <thead>
            <tr><th>Product</th><th>SKU</th><th>Units sold</th><th>Revenue</th><th>Returns</th></tr>
          </thead>
          <tbody>
            {result.data.map((row, i) => (
              <tr key={row.productId || i}>
                <td>{row.productName}</td>
                <td>{row.sku}</td>
                <td>{row.unitsSold}</td>
                <td>{formatCurrency(row.revenue)}</td>
                <td>{row.returnCount ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (reportId === 'category-wise-sales' && result.data) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <p>Total revenue: {formatCurrency(result.totalRevenue)}</p>
        <table className="fullWidth reportsTable">
          <thead>
            <tr><th>Category</th><th>Revenue</th><th>Units</th><th>%</th></tr>
          </thead>
          <tbody>
            {result.data.map((row, i) => (
              <tr key={row.categoryId || i}>
                <td>{row.categoryName}</td>
                <td>{formatCurrency(row.revenue)}</td>
                <td>{row.unitsSold}</td>
                <td>{row.contributionPercent?.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (reportId === 'customer-overview') {
    const rows = [
      { label: 'Total customers', value: result.totalCustomers ?? 0 },
      ...(result.newCustomers != null ? [{ label: 'New (period)', value: result.newCustomers }] : []),
      { label: 'Returning', value: result.returningCustomers ?? 0 },
    ];
    return (
      <div className="reportsSummaryTableWrap">
        <table className="fullWidth reportsTable">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="fontSemiBold">{row.label}</td>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (reportId === 'customer-purchase' && result.data) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="fullWidth reportsTable">
          <thead>
            <tr><th>Customer</th><th>Email</th><th>Total spend</th><th>Orders</th><th>Last order</th><th>AOV</th></tr>
          </thead>
          <tbody>
            {result.data.map((row, i) => (
              <tr key={row.userId || i}>
                <td>{row.customerName}</td>
                <td>{row.customerEmail}</td>
                <td>{formatCurrency(row.totalSpend)}</td>
                <td>{row.totalOrders}</td>
                <td>{formatDate(row.lastOrderDate)}</td>
                <td>{formatCurrency(row.averageOrderValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (reportId === 'customer-lifetime-value' && result.data) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <p>{result.description}</p>
        <table className="fullWidth reportsTable">
          <thead>
            <tr><th>Customer</th><th>Email</th><th>CLV</th><th>Orders</th><th>AOV</th></tr>
          </thead>
          <tbody>
            {result.data.map((row, i) => (
              <tr key={row.userId || i}>
                <td>{row.customerName}</td>
                <td>{row.customerEmail}</td>
                <td>{formatCurrency(row.clv)}</td>
                <td>{row.orderCount}</td>
                <td>{formatCurrency(row.averageOrderValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (reportId === 'inventory-stock' && result.data) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <p>Reorder level: {result.reorderLevel}</p>
        <table className="fullWidth reportsTable">
          <thead>
            <tr><th>Product</th><th>SKU</th><th>Stock</th><th>Low stock</th></tr>
          </thead>
          <tbody>
            {result.data.map((row, i) => (
              <tr key={row.productId || i}>
                <td>{row.name}</td>
                <td>{row.sku}</td>
                <td>{row.currentStock}</td>
                <td>{row.lowStock ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (reportId === 'inventory-valuation' && result.data) {
    return (
      <div>
        <p><strong>Total valuation:</strong> {formatCurrency(result.totalValuation)}</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="fullWidth reportsTable">
            <thead>
              <tr><th>Product</th><th>SKU</th><th>Stock</th><th>Unit price</th><th>Valuation</th></tr>
            </thead>
            <tbody>
              {result.data.map((row, i) => (
                <tr key={row.productId || i}>
                  <td>{row.name}</td>
                  <td>{row.sku}</td>
                  <td>{row.stock}</td>
                  <td>{formatCurrency(row.unitPrice)}</td>
                  <td>{formatCurrency(row.valuation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  if (reportId === 'payment-method' && result.data) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="fullWidth reportsTable">
          <thead>
            <tr><th>Method</th><th>Total txns</th><th>Success</th><th>Failed</th><th>Refunded</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {result.data.map((row, i) => (
              <tr key={row.paymentMethod || i}>
                <td>{row.paymentMethod}</td>
                <td>{row.totalTransactions}</td>
                <td>{row.successfulTransactions}</td>
                <td>{row.failedTransactions}</td>
                <td>{row.refundedTransactions}</td>
                <td>{formatCurrency(row.successfulAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (reportId === 'refund-cancellation') {
    const rows = [
      { label: 'Refunded (orders)', value: result.refunded?.count ?? 0 },
      { label: 'Refunded (amount)', value: formatCurrency(result.refunded?.totalAmount) },
      { label: 'Cancelled (orders)', value: result.cancelled?.count ?? 0 },
      { label: 'Cancelled (amount)', value: formatCurrency(result.cancelled?.totalAmount) },
      { label: 'Returned (orders)', value: result.returned?.count ?? 0 },
      { label: 'Returned (amount)', value: formatCurrency(result.returned?.totalAmount) },
      { label: 'Total paid revenue', value: formatCurrency(result.totalPaidRevenue) },
      { label: 'Net revenue after refunds', value: formatCurrency(result.netRevenueAfterRefunds) },
    ];
    return (
      <div>
        <div className="reportsSummaryTableWrap">
          <table className="fullWidth reportsTable">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="fontSemiBold">{row.label}</td>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.impactNote && <p style={{ marginTop: 12, color: '#666' }}>{result.impactNote}</p>}
      </div>
    );
  }
  if (reportId === 'tax' && result.data) {
    return (
      <div>
        <p><strong>Total tax:</strong> {formatCurrency(result.totalTax)}</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="fullWidth reportsTable">
            <thead>
              <tr><th>Date</th><th>Tax collected</th><th>Orders</th></tr>
            </thead>
            <tbody>
              {result.data.map((row, i) => (
                <tr key={row._id || i}>
                  <td>{row._id}</td>
                  <td>{formatCurrency(row.taxCollected)}</td>
                  <td>{row.orderCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  if (reportId === 'coupon-usage' && result.data) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="fullWidth reportsTable">
          <thead>
            <tr><th>Code</th><th>Type</th><th>Value</th><th>Usage count</th><th>Revenue</th><th>Discount</th></tr>
          </thead>
          <tbody>
            {result.data.map((row, i) => (
              <tr key={row.couponId || i}>
                <td>{row.code}</td>
                <td>{row.discountType}</td>
                <td>{row.discountValue}</td>
                <td>{row.usageCount}</td>
                <td>{formatCurrency(row.revenueGenerated)}</td>
                <td>{formatCurrency(row.totalDiscountAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (reportId === 'shipping-performance') {
    return (
      <div>
        <p>Average delivery time: {result.averageDeliveryTimeDays != null ? `${result.averageDeliveryTimeDays} days` : '-'}</p>
        <p>Total delivered: {result.totalDeliveredOrders ?? 0}</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="fullWidth reportsTable">
            <thead>
              <tr><th>Courier</th><th>Orders</th><th>Avg days</th><th>Delayed</th></tr>
            </thead>
            <tbody>
              {(result.data || []).map((row, i) => (
                <tr key={row.courierName || i}>
                  <td>{row.courierName}</td>
                  <td>{row.orderCount}</td>
                  <td>{row.averageDeliveryDays}</td>
                  <td>{row.delayedShipments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  if (reportId === 'admin-activity') {
    return (
      <div>
        {result.message && <p>{result.message}</p>}
        {(result.data && result.data.length > 0) ? (
          <table className="fullWidth reportsTable"><thead><tr><th>Admin</th><th>Action</th><th>Entity</th><th>Date</th></tr></thead><tbody>
            {result.data.map((row, i) => (
              <tr key={i}><td>{row.adminId}</td><td>{row.action}</td><td>{row.entity}</td><td>{formatDate(row.createdAt)}</td></tr>
            ))}</tbody></table>
        ) : null}
      </div>
    );
  }
  return <pre style={{ fontSize: 12, overflow: 'auto' }}>{JSON.stringify(result, null, 2)}</pre>;
}
