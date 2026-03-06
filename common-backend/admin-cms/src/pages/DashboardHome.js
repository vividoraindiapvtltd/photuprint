import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AlertMessage } from '../common';
import '../css/styles.css';

const StatCard = ({ title, value, icon, color, subtitle, onClick, clickable = false }) => {
  const colorStyles = {
    blue: { bg: '#3B82F6', lightBg: '#DBEAFE' },
    green: { bg: '#10B981', lightBg: '#D1FAE5' },
    orange: { bg: '#F59E0B', lightBg: '#FEF3C7' },
    purple: { bg: '#8B5CF6', lightBg: '#E9D5FF' },
    red: { bg: '#EF4444', lightBg: '#FEE2E2' },
    indigo: { bg: '#6366F1', lightBg: '#E0E7FF' },
    teal: { bg: '#14B8A6', lightBg: '#CCFBF1' },
    pink: { bg: '#EC4899', lightBg: '#FCE7F3' }
  };

  const selectedColor = colorStyles[color] || colorStyles.blue;

  return (
    <div 
      style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '24px',
        transition: 'all 0.3s ease',
        cursor: clickable ? 'pointer' : 'default'
      }}
      onClick={clickable && onClick ? onClick : undefined}
      onMouseEnter={(e) => {
        if (clickable) {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (clickable) {
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#6B7280', fontSize: '14px', fontWeight: '500', marginBottom: '8px', margin: 0 }}>
            {title}
          </p>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#1F2937', margin: '4px 0' }}>
            {value}
          </p>
          {subtitle && (
            <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px', margin: 0 }}>
              {subtitle}
            </p>
          )}
        </div>
        <div style={{
          backgroundColor: selectedColor.lightBg,
          borderRadius: '50%',
          width: '64px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <span style={{ fontSize: '28px' }}>{icon}</span>
        </div>
      </div>
    </div>
  );
};

export default function DashboardHome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/dashboard/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError('Failed to load dashboard statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '60vh',
        flexDirection: 'column'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid #E5E7EB',
          borderTop: '4px solid #007bff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ marginTop: '16px', color: '#6B7280' }}>Loading dashboard statistics...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px' }}>
        <AlertMessage type="error" message={error} onClose={() => setError('')} />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1F2937', marginBottom: '8px' }}>
          Dashboard Overview
        </h1>
        <p style={{ color: '#6B7280', fontSize: '16px' }}>
          Welcome back! Here's what's happening with your store.
        </p>
      </div>

      {/* Orders Section */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#374151', marginBottom: '20px' }}>
          Orders
        </h2>
        <div className="gridStyle" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <StatCard
            title="Today's Orders"
            value={stats.orders?.today || 0}
            icon="📦"
            color="blue"
            subtitle="Orders placed today"
            clickable={true}
            onClick={() => navigate('/dashboard/addorder?filter=today')}
          />
          <StatCard
            title="Pending Orders"
            value={stats.orders?.pending || 0}
            icon="⏳"
            color="orange"
            subtitle="Awaiting confirmation"
            clickable={true}
            onClick={() => navigate('/dashboard/addorder?orderStatus=pending')}
          />
          <StatCard
            title="Processing"
            value={stats.orders?.processing || 0}
            icon="🔄"
            color="indigo"
            subtitle="Being processed"
            clickable={true}
            onClick={() => navigate('/dashboard/addorder?orderStatus=confirmed')}
          />
          <StatCard
            title="Shipped"
            value={stats.orders?.shipped || 0}
            icon="🚚"
            color="teal"
            subtitle="Out for delivery"
            clickable={true}
            onClick={() => navigate('/dashboard/addorder?orderStatus=shipped')}
          />
          <StatCard
            title="Delivered"
            value={stats.orders?.delivered || 0}
            icon="✅"
            color="green"
            subtitle="Successfully delivered"
            clickable={true}
            onClick={() => navigate('/dashboard/addorder?orderStatus=delivered')}
          />
          <StatCard
            title="Cancelled"
            value={stats.orders?.cancelled || 0}
            icon="❌"
            color="red"
            subtitle="Cancelled orders"
            clickable={true}
            onClick={() => navigate('/dashboard/addorder?orderStatus=cancelled')}
          />
          <StatCard
            title="Weekly Orders"
            value={stats.orders?.weekly || 0}
            icon="📊"
            color="purple"
            subtitle="Last 7 days"
            clickable={true}
            onClick={() => navigate('/dashboard/addorder?filter=weekly')}
          />
          <StatCard
            title="Monthly Orders"
            value={stats.orders?.monthly || 0}
            icon="📈"
            color="blue"
            subtitle="Last 30 days"
            clickable={true}
            onClick={() => navigate('/dashboard/addorder?filter=monthly')}
          />
          <StatCard
            title="Total Orders"
            value={stats.orders?.total || 0}
            icon="📋"
            color="indigo"
            subtitle="All time"
            clickable={true}
            onClick={() => navigate('/dashboard/addorder')}
          />
        </div>
      </div>

      {/* Revenue Section */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#374151', marginBottom: '20px' }}>
          Revenue
        </h2>
        <div className="gridStyle" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <StatCard
            title="Today's Revenue"
            value={formatCurrency(stats.revenue?.today || 0)}
            icon="💰"
            color="green"
            subtitle="Paid orders today"
          />
          <StatCard
            title="Weekly Revenue"
            value={formatCurrency(stats.revenue?.weekly || 0)}
            icon="💵"
            color="teal"
            subtitle="Last 7 days"
          />
          <StatCard
            title="Monthly Revenue"
            value={formatCurrency(stats.revenue?.monthly || 0)}
            icon="💸"
            color="blue"
            subtitle="Last 30 days"
          />
          <StatCard
            title="Total Revenue"
            value={formatCurrency(stats.revenue?.total || 0)}
            icon="💳"
            color="purple"
            subtitle="All time"
          />
        </div>
      </div>

      {/* Users Section */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#374151', marginBottom: '20px' }}>
          Users
        </h2>
        <div className="gridStyle" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <StatCard
            title="New Users Today"
            value={stats.users?.today || 0}
            icon="👤"
            color="blue"
            subtitle="Registered today"
            clickable={true}
            onClick={() => navigate('/dashboard/adduser?filter=today')}
          />
          <StatCard
            title="Weekly Users"
            value={stats.users?.weekly || 0}
            icon="👥"
            color="green"
            subtitle="Last 7 days"
            clickable={true}
            onClick={() => navigate('/dashboard/adduser?filter=weekly')}
          />
          <StatCard
            title="Monthly Users"
            value={stats.users?.monthly || 0}
            icon="👨‍👩‍👧‍👦"
            color="purple"
            subtitle="Last 30 days"
            clickable={true}
            onClick={() => navigate('/dashboard/adduser?filter=monthly')}
          />
          <StatCard
            title="Total Users"
            value={stats.users?.total || 0}
            icon="🌐"
            color="indigo"
            subtitle="All registered users"
            clickable={true}
            onClick={() => navigate('/dashboard/adduser')}
          />
        </div>
      </div>

      {/* Products Section */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#374151', marginBottom: '20px' }}>
          Products
        </h2>
        <div className="gridStyle" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <StatCard
            title="Total Products"
            value={stats.products?.total || 0}
            icon="🛍️"
            color="blue"
            subtitle="All products"
            clickable={true}
            onClick={() => navigate('/dashboard/addproducts')}
          />
          <StatCard
            title="Active Products"
            value={stats.products?.active || 0}
            icon="✅"
            color="green"
            subtitle="Currently active"
            clickable={true}
            onClick={() => navigate('/dashboard/addproducts?status=active')}
          />
          <StatCard
            title="Low Stock"
            value={stats.products?.lowStock || 0}
            icon="⚠️"
            color="orange"
            subtitle="10 or less items"
            clickable={true}
            onClick={() => navigate('/dashboard/addproducts?filter=lowStock')}
          />
          <StatCard
            title="Out of Stock"
            value={stats.products?.outOfStock || 0}
            icon="❌"
            color="red"
            subtitle="Need restocking"
            clickable={true}
            onClick={() => navigate('/dashboard/addproducts?filter=outOfStock')}
          />
        </div>
      </div>

      {/* Reviews Section */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#374151', marginBottom: '20px' }}>
          Product Reviews
        </h2>
        <div className="gridStyle" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <StatCard
            title="Total Reviews"
            value={stats.reviews?.total || 0}
            icon="⭐"
            color="blue"
            subtitle="All reviews"
            clickable={true}
            onClick={() => navigate('/dashboard/reviewmanager')}
          />
          <StatCard
            title="Pending Reviews"
            value={stats.reviews?.pending || 0}
            icon="⏳"
            color="orange"
            subtitle="Awaiting approval"
            clickable={true}
            onClick={() => navigate('/dashboard/reviewmanager?status=pending')}
          />
          <StatCard
            title="Approved Reviews"
            value={stats.reviews?.approved || 0}
            icon="✅"
            color="green"
            subtitle="Published reviews"
            clickable={true}
            onClick={() => navigate('/dashboard/reviewmanager?status=approved')}
          />
          <StatCard
            title="Rejected Reviews"
            value={stats.reviews?.rejected || 0}
            icon="❌"
            color="red"
            subtitle="Rejected reviews"
            clickable={true}
            onClick={() => navigate('/dashboard/reviewmanager?status=rejected')}
          />
          <StatCard
            title="Today's Reviews"
            value={stats.reviews?.today || 0}
            icon="📝"
            color="purple"
            subtitle="Submitted today"
            clickable={true}
            onClick={() => navigate('/dashboard/reviewmanager?filter=today')}
          />
          <StatCard
            title="Weekly Reviews"
            value={stats.reviews?.weekly || 0}
            icon="📊"
            color="indigo"
            subtitle="Last 7 days"
            clickable={true}
            onClick={() => navigate('/dashboard/reviewmanager?filter=weekly')}
          />
          <StatCard
            title="Monthly Reviews"
            value={stats.reviews?.monthly || 0}
            icon="📈"
            color="teal"
            subtitle="Last 30 days"
            clickable={true}
            onClick={() => navigate('/dashboard/reviewmanager?filter=monthly')}
          />
          <StatCard
            title="Average Rating"
            value={stats.reviews?.averageRating ? `${stats.reviews.averageRating.toFixed(1)} ⭐` : '0 ⭐'}
            icon="🌟"
            color="pink"
            subtitle="From approved reviews"
            clickable={false}
          />
          <StatCard
            title="User Reviews"
            value={stats.reviews?.fromUsers || 0}
            icon="👤"
            color="blue"
            subtitle="From customers"
            clickable={true}
            onClick={() => navigate('/dashboard/reviewmanager?source=user')}
          />
          <StatCard
            title="Admin Reviews"
            value={stats.reviews?.fromAdmin || 0}
            icon="👨‍💼"
            color="purple"
            subtitle="Created by admin"
            clickable={true}
            onClick={() => navigate('/dashboard/reviewmanager?source=admin')}
          />
        </div>
        
        {/* Rating Breakdown */}
        {stats.reviews?.ratingBreakdown && (
          <div style={{ marginTop: '24px', background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
              Rating Breakdown
            </h3>
            <div className="gridStyle" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              {[5, 4, 3, 2, 1].map(rating => (
                <div key={rating} style={{
                  textAlign: 'center',
                  padding: '16px',
                  background: '#F9FAFB',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                    {'⭐'.repeat(rating)}
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1F2937' }}>
                    {stats.reviews.ratingBreakdown[rating] || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                    {rating} Star{rating !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Testimonials Section */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#374151', marginBottom: '20px' }}>
          Customer Testimonials
        </h2>
        <div className="gridStyle" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <StatCard
            title="Total Testimonials"
            value={stats.testimonials?.total || 0}
            icon="💬"
            color="blue"
            subtitle="All testimonials"
            clickable={true}
            onClick={() => navigate('/dashboard/testimonialmanager')}
          />
          <StatCard
            title="Pending Approval"
            value={stats.testimonials?.pending || 0}
            icon="⏳"
            color="orange"
            subtitle="Awaiting review"
            clickable={true}
            onClick={() => navigate('/dashboard/testimonialmanager?status=pending')}
          />
          <StatCard
            title="Approved"
            value={stats.testimonials?.approved || 0}
            icon="✅"
            color="green"
            subtitle="Published testimonials"
            clickable={true}
            onClick={() => navigate('/dashboard/testimonialmanager?status=approved')}
          />
          <StatCard
            title="Rejected"
            value={stats.testimonials?.rejected || 0}
            icon="❌"
            color="red"
            subtitle="Not published"
            clickable={true}
            onClick={() => navigate('/dashboard/testimonialmanager?status=rejected')}
          />
          <StatCard
            title="Featured"
            value={stats.testimonials?.featured || 0}
            icon="⭐"
            color="purple"
            subtitle="Highlighted testimonials"
            clickable={true}
            onClick={() => navigate('/dashboard/testimonialmanager?featured=true')}
          />
          <StatCard
            title="Today"
            value={stats.testimonials?.today || 0}
            icon="📝"
            color="indigo"
            subtitle="Submitted today"
            clickable={true}
            onClick={() => navigate('/dashboard/testimonialmanager?filter=today')}
          />
          <StatCard
            title="This Week"
            value={stats.testimonials?.weekly || 0}
            icon="📊"
            color="teal"
            subtitle="Last 7 days"
            clickable={true}
            onClick={() => navigate('/dashboard/testimonialmanager?filter=weekly')}
          />
          <StatCard
            title="This Month"
            value={stats.testimonials?.monthly || 0}
            icon="📈"
            color="blue"
            subtitle="Last 30 days"
            clickable={true}
            onClick={() => navigate('/dashboard/testimonialmanager?filter=monthly')}
          />
          <StatCard
            title="Average Rating"
            value={stats.testimonials?.averageRating ? `${stats.testimonials.averageRating.toFixed(1)} ⭐` : '0 ⭐'}
            icon="🌟"
            color="pink"
            subtitle="From approved testimonials"
            clickable={false}
          />
        </div>
        
        {/* Testimonial Rating Breakdown */}
        {stats.testimonials?.ratingBreakdown && (
          <div style={{ marginTop: '24px', background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
              Testimonial Ratings
            </h3>
            <div className="gridStyle" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              {[5, 4, 3, 2, 1].map(rating => (
                <div key={rating} style={{
                  textAlign: 'center',
                  padding: '16px',
                  background: '#F9FAFB',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                    {'⭐'.repeat(rating)}
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1F2937' }}>
                    {stats.testimonials.ratingBreakdown[rating] || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                    {rating} Star{rating !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category Breakdown */}
        {stats.testimonials?.categoryBreakdown && Object.keys(stats.testimonials.categoryBreakdown).length > 0 && (
          <div style={{ marginTop: '24px', background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
              By Category
            </h3>
            <div className="gridStyle" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
              {Object.entries(stats.testimonials.categoryBreakdown).map(([category, count]) => (
                <div key={category} style={{
                  textAlign: 'center',
                  padding: '12px',
                  background: '#F0F9FF',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                onClick={() => navigate(`/dashboard/testimonialmanager?category=${category}`)}
                >
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3B82F6' }}>
                    {count}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px', textTransform: 'capitalize' }}>
                    {category}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Source Breakdown */}
        {stats.testimonials?.sourceBreakdown && Object.keys(stats.testimonials.sourceBreakdown).length > 0 && (
          <div style={{ marginTop: '24px', background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
              By Source
            </h3>
            <div className="gridStyle" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
              {Object.entries(stats.testimonials.sourceBreakdown).map(([source, count]) => (
                <div key={source} style={{
                  textAlign: 'center',
                  padding: '12px',
                  background: '#FDF4FF',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                onClick={() => navigate(`/dashboard/testimonialmanager?source=${source}`)}
                >
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8B5CF6' }}>
                    {count}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px', textTransform: 'capitalize' }}>
                    {source}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
