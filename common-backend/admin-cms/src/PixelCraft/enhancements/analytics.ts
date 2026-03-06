/**
 * Analytics on template usage: track views, personalizations, conversions, revenue.
 * P1 feature - high business impact.
 */

export interface TemplateAnalytics {
  templateId: string;
  templateVersionId: string;
  views: number;
  personalizationsStarted: number;
  addToCartCount: number;
  orderCount: number;
  revenue: number;
  avgOrderValue: number;
  conversionRate: number; // orders / personalizationsStarted
  dateRange: {
    start: Date;
    end: Date;
  };
}

export interface AnalyticsEvent {
  event: string;
  templateId: string;
  templateVersionId?: string;
  productId?: string;
  userId?: string;
  sessionId?: string;
  variableValues?: Record<string, string>;
  timestamp: string;
}

/**
 * Track template view (admin or user).
 */
export async function trackTemplateView(
  templateId: string,
  templateVersionId?: string,
  userId?: string
): Promise<void> {
  await trackEvent({
    event: 'template_viewed',
    templateId,
    templateVersionId,
    userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track personalization started (user opened editor).
 */
export async function trackPersonalizationStarted(
  templateId: string,
  productId: string,
  templateVersionId?: string,
  userId?: string,
  sessionId?: string
): Promise<void> {
  await trackEvent({
    event: 'personalization_started',
    templateId,
    templateVersionId,
    productId,
    userId,
    sessionId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track add to cart.
 */
export async function trackAddToCart(
  templateId: string,
  productId: string,
  variableValues: Record<string, string>,
  templateVersionId?: string,
  userId?: string,
  sessionId?: string
): Promise<void> {
  await trackEvent({
    event: 'add_to_cart',
    templateId,
    templateVersionId,
    productId,
    variableValues,
    userId,
    sessionId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track order placed.
 */
export async function trackOrder(
  templateId: string,
  productId: string,
  orderId: string,
  revenue: number,
  templateVersionId?: string,
  userId?: string
): Promise<void> {
  await trackEvent({
    event: 'order_placed',
    templateId,
    templateVersionId,
    productId,
    userId,
    timestamp: new Date().toISOString(),
  });

  // Also track revenue (separate event or field)
  await trackRevenue(orderId, templateId, revenue);
}

/**
 * Internal: track event (send to analytics service).
 */
async function trackEvent(event: AnalyticsEvent): Promise<void> {
  // In production: send to analytics service (Segment, Mixpanel, PostHog, etc.)
  // For now: log or send to API
  try {
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

async function trackRevenue(orderId: string, templateId: string, revenue: number): Promise<void> {
  await fetch('/api/analytics/revenue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, templateId, revenue }),
  });
}

/**
 * Get template analytics for date range.
 */
export async function getTemplateAnalytics(
  templateId: string,
  dateRange: { start: Date; end: Date }
): Promise<TemplateAnalytics> {
  const response = await fetch(
    `/api/analytics/templates/${templateId}?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`
  );
  return response.json();
}
