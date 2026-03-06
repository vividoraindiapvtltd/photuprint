import React, { useState, useMemo } from 'react';
import PageHeader from '../common/PageHeader';
import { FormField } from '../common';
import '../css/styles.css';

const SHIPPING_RATE_PER_500G = 74;
const VOLUMETRIC_DIVISOR = 5000; // (L×W×H) / 5000 = volumetric weight (kg)

const defaultForm = {
  productName: '',
  category: '',
  brand: '',
  costOfGoods: '',
  shippingCost: '0',
  shippingWidth: '',
  shippingHeight: '',
  shippingLength: '',
  shippingActualWeight: '',
  printingCharges: '0',
  packagingCharges: '0',
  adsCost: '0',
  promotionCost: '0',
  returnCost: '0',
  rtoOtherLoss: '0',
  platformFeeType: 'percent',
  platformFeeValue: '15',
  taxPercent: '18',
  targetMarginType: 'percent',
  targetMarginValue: '25',
  competitorAmazon: '',
  competitorFlipkart: '',
  averageMarketPrice: '',
  positioning: 'mid-range',
  priceSensitivity: 'medium',
};

function parseNum(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Sum of all per-unit cost components (before platform/tax on selling price) */
function totalBaseCost(costs) {
  return (costs.cost ?? 0) + (costs.shipping ?? 0) + (costs.printing ?? 0) + (costs.packaging ?? 0) +
    (costs.ads ?? 0) + (costs.promotion ?? 0) + (costs.return ?? 0) + (costs.rto ?? 0);
}

/** Break-even: selling price S such that S - platform - tax = total base cost (all per unit) */
function breakEvenPrice(baseCost, platformPct, platformFixed, taxPct) {
  const pct = (platformPct ?? 0) / 100 + (taxPct ?? 0) / 100;
  if (pct >= 1) return null;
  const denom = 1 - pct;
  return (baseCost + (platformFixed ?? 0)) / denom;
}

/** Recommended price from target margin (margin can be % of selling price or fixed amount) */
function recommendedPrice(baseCost, platformPct, platformFixed, taxPct, marginType, marginValue) {
  const pct = (platformPct ?? 0) / 100 + (taxPct ?? 0) / 100;
  if (marginType === 'amount') {
    const margin = marginValue ?? 0;
    if (pct >= 1) return null;
    return (baseCost + (platformFixed ?? 0) + margin) / (1 - pct);
  }
  const marginPct = (marginValue ?? 0) / 100;
  if (pct + marginPct >= 1) return null;
  return (baseCost + (platformFixed ?? 0)) / (1 - pct - marginPct);
}

function strategyExplanation(positioning, marginPct, sensitivity) {
  const parts = [];
  if (positioning === 'premium') parts.push('Premium positioning supports higher prices and stronger margins.');
  else if (positioning === 'budget') parts.push('Budget positioning favors volume; keep margin modest and price competitive.');
  else parts.push('Mid-range positioning balances margin and competitiveness.');
  if (marginPct != null && marginPct > 25) parts.push('Target margin is healthy; consider psychological pricing (e.g. 499, 999).');
  else if (marginPct != null && marginPct < 15) parts.push('Thin margin; ensure volume and low return rate.');
  if (sensitivity === 'high') parts.push('High price sensitivity: small discounts or bundles can improve conversion.');
  return parts.join(' ');
}

/** Suggest a psychological (charm) price: round up to 99/499/999 etc. */
function suggestDisplayPrice(price) {
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  const p = Math.ceil(price);
  if (p <= 100) return Math.ceil(p / 10) * 10 - 1 || 99; // e.g. 99
  if (p <= 500) return Math.ceil(p / 100) * 100 - 1;     // e.g. 499
  if (p <= 5000) return Math.ceil(p / 500) * 500 - 1;   // e.g. 999, 1499
  return Math.ceil(p / 1000) * 1000 - 1;                // e.g. 4999
}

const hasValidInput = (v) => v != null && (typeof v === 'number' ? true : String(v).trim() !== '');

export default function ProductCostCalculator() {
  const [form, setForm] = useState(defaultForm);

  const cost = parseNum(form.costOfGoods);
  const shipping = parseNum(form.shippingCost);
  const printing = parseNum(form.printingCharges);
  const packaging = parseNum(form.packagingCharges);
  const ads = parseNum(form.adsCost);
  const promotion = parseNum(form.promotionCost);
  const returnCost = parseNum(form.returnCost);
  const rtoOtherLoss = parseNum(form.rtoOtherLoss);
  const platformPct = form.platformFeeType === 'percent' ? parseNum(form.platformFeeValue) : null;
  const platformFixed = form.platformFeeType === 'amount' ? parseNum(form.platformFeeValue) : null;
  const taxPct = parseNum(form.taxPercent);
  const marginType = form.targetMarginType;
  const marginValue = parseNum(form.targetMarginValue);

  const baseCost = useMemo(() => totalBaseCost({
    cost, shipping, printing, packaging, ads, promotion, return: returnCost, rto: rtoOtherLoss,
  }), [cost, shipping, printing, packaging, ads, promotion, returnCost, rtoOtherLoss]);

  const results = useMemo(() => {
    const be = breakEvenPrice(baseCost, platformPct, platformFixed, taxPct);
    const rec = recommendedPrice(baseCost, platformPct, platformFixed, taxPct, marginType, marginValue);
    const usePrice = rec ?? be;
    const platformTaxAmount = usePrice != null ? usePrice * ((platformPct ?? 0) / 100 + (taxPct ?? 0) / 100) : 0;
    const totalCost = baseCost + (platformFixed ?? 0) + platformTaxAmount;
    const profit = usePrice != null && totalCost != null ? usePrice - totalCost : null;
    const marginPct = usePrice != null && usePrice > 0 && profit != null ? (profit / usePrice) * 100 : null;
    const compLow = parseNum(form.competitorAmazon?.split('-').map(s => s.trim())[0]) ?? parseNum(form.averageMarketPrice);
    const compHigh = parseNum(form.competitorAmazon?.split('-').map(s => s.trim())[1]) ?? parseNum(form.competitorFlipkart?.split('-').map(s => s.trim())[1]) ?? parseNum(form.averageMarketPrice);
    const compRange = (compLow != null || compHigh != null) ? { low: compLow ?? compHigh, high: compHigh ?? compLow } : null;
    const displayPrice = suggestDisplayPrice(rec ?? be);
    const totalCostAtDisplay = displayPrice != null
      ? baseCost + (platformFixed ?? 0) + displayPrice * ((platformPct ?? 0) / 100 + (taxPct ?? 0) / 100)
      : null;
    const profitAtDisplay = displayPrice != null && totalCostAtDisplay != null ? displayPrice - totalCostAtDisplay : null;
    const marginAtDisplay = displayPrice != null && displayPrice > 0 && profitAtDisplay != null ? (profitAtDisplay / displayPrice) * 100 : null;
    return {
      breakEven: be,
      recommended: rec,
      profitPerUnit: profit,
      marginPercent: marginPct,
      competitiveRange: compRange,
      strategy: strategyExplanation(form.positioning, marginPct, form.priceSensitivity),
      totalCost,
      platformTaxAmount,
      displayPrice,
      profitAtDisplay,
      marginAtDisplay,
    };
  }, [form, baseCost, platformPct, platformFixed, taxPct, marginType, marginValue]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const reset = () => setForm(defaultForm);

  const showResults = [cost, shipping, printing, packaging, ads, promotion, returnCost, rtoOtherLoss].some((v) => v != null);

  const shippingDimW = parseNum(form.shippingWidth);
  const shippingDimH = parseNum(form.shippingHeight);
  const shippingDimL = parseNum(form.shippingLength);
  const shippingActualGrams = parseNum(form.shippingActualWeight);
  const shippingActualKg = shippingActualGrams != null && shippingActualGrams > 0 ? shippingActualGrams / 1000 : null;

  const shippingCalc = useMemo(() => {
    if (shippingDimW == null || shippingDimH == null || shippingDimL == null || shippingDimW <= 0 || shippingDimH <= 0 || shippingDimL <= 0) return null;
    const volumetricKg = (shippingDimW * shippingDimH * shippingDimL) / VOLUMETRIC_DIVISOR;
    const chargeableKg = shippingActualKg != null ? Math.max(shippingActualKg, volumetricKg) : volumetricKg;
    const slots500g = Math.ceil(chargeableKg / 0.5);
    const costRupees = slots500g * SHIPPING_RATE_PER_500G;
    return { volumetricKg, chargeableKg, costRupees, slots500g };
  }, [shippingDimW, shippingDimH, shippingDimL, shippingActualKg]);

  const applyShippingCost = () => {
    if (shippingCalc?.costRupees != null) setForm((f) => ({ ...f, shippingCost: String(shippingCalc.costRupees) }));
  };

  const formatCurrency = (n) => (n != null && Number.isFinite(n) ? `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '–');

  return (
    <div className="paddingAll20">
      <PageHeader
        title="Product Cost Calculator"
        subtitle="Calculate optimal selling price, break-even, and profit with market context."
      />
      <div className="brandFormContainer paddingAll32 appendBottom30" style={{ width: '100%' }}>
        <form className="brandForm" onSubmit={(e) => e.preventDefault()}>
          <h2 className="listTitle font30 fontBold blackText appendBottom24">Cost inputs (per unit)</h2>
          <p className="font14 grayText appendBottom20">Enter your costs and target margin. Results update as you type.</p>

          <div className="makeFlex row gap16">
            <div className="flexOne">
              <FormField
                type="number"
                name="costOfGoods"
                label="Cost of goods (₹)"
                value={form.costOfGoods}
                onChange={handleChange}
                placeholder="e.g. 200"
                min={0}
                step={0.01}
                info="Manufacturing or purchase cost per unit (before any fees or tax)."
              />
            </div>
            <div className="flexOne">
              <FormField
                type="number"
                name="shippingCost"
                label="Shipping & logistics (₹)"
                value={form.shippingCost}
                onChange={handleChange}
                placeholder="0"
                min={0}
                step={0.01}
                info="Per-unit shipping and logistics. Use the dimension calculator below to get an estimate."
              />
            </div>
            <div className="flexOne">
              <FormField
                type="number"
                name="printingCharges"
                label="Printing charges (₹)"
                value={form.printingCharges}
                onChange={handleChange}
                placeholder="0"
                min={0}
                step={0.01}
                info="Per-unit printing cost."
              />
            </div>
            <div className="flexOne">
              <FormField
                type="number"
                name="packagingCharges"
                label="Packaging charges (₹)"
                value={form.packagingCharges}
                onChange={handleChange}
                placeholder="0"
                min={0}
                step={0.01}
                info="Per-unit packaging material and labour."
              />
            </div>
          </div>

          <div className="appendTop24 appendBottom20" style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
            <h3 className="font16 fontBold blackText appendBottom12">Shipping cost from dimensions (volumetric)</h3>
            <p className="font12 grayText appendBottom16">Enter package dimensions in cm. Rate: ₹74 per 500 g (volumetric or actual weight, whichever is higher).</p>
            <div className="makeFlex row gap16" style={{ flexWrap: 'wrap' }}>
              <div className="flexOne" style={{ minWidth: '100px' }}>
                <FormField
                  type="number"
                  name="shippingWidth"
                  label="Width (cm)"
                  value={form.shippingWidth}
                  onChange={handleChange}
                  placeholder="e.g. 20"
                  min={0}
                  step={0.1}
                />
              </div>
              <div className="flexOne" style={{ minWidth: '100px' }}>
                <FormField
                  type="number"
                  name="shippingHeight"
                  label="Height (cm)"
                  value={form.shippingHeight}
                  onChange={handleChange}
                  placeholder="e.g. 15"
                  min={0}
                  step={0.1}
                />
              </div>
              <div className="flexOne" style={{ minWidth: '100px' }}>
                <FormField
                  type="number"
                  name="shippingLength"
                  label="Length (cm)"
                  value={form.shippingLength}
                  onChange={handleChange}
                  placeholder="e.g. 10"
                  min={0}
                  step={0.1}
                />
              </div>
              <div className="flexOne" style={{ minWidth: '100px' }}>
                <FormField
                  type="number"
                  name="shippingActualWeight"
                  label="Actual weight (g, optional)"
                  value={form.shippingActualWeight}
                  onChange={handleChange}
                  placeholder="e.g. 350"
                  min={0}
                  step={1}
                />
              </div>
            </div>
            {shippingCalc && (
              <div className="makeFlex row gap16 appendTop12" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="font14">Volumetric weight: <strong>{(shippingCalc.volumetricKg * 1000).toFixed(0)} g</strong></span>
                <span className="font14">Chargeable weight: <strong>{(shippingCalc.chargeableKg * 1000).toFixed(0)} g</strong></span>
                <span className="font14">Shipping cost: <strong>{formatCurrency(shippingCalc.costRupees)}</strong> ({shippingCalc.slots500g} × 500 g)</span>
                <button type="button" className="btnPrimary" onClick={applyShippingCost}>Apply to Shipping & logistics</button>
              </div>
            )}
          </div>

          <div className="makeFlex row gap16">
            <div className="flexOne">
              <FormField
                type="number"
                name="adsCost"
                label="Ads cost (₹)"
                value={form.adsCost}
                onChange={handleChange}
                placeholder="0"
                min={0}
                step={0.01}
                info="Per-unit share of ad spend (e.g. Google, Facebook)."
              />
            </div>
            <div className="flexOne">
              <FormField
                type="number"
                name="promotionCost"
                label="Promotion (₹)"
                value={form.promotionCost}
                onChange={handleChange}
                placeholder="0"
                min={0}
                step={0.01}
                info="Per-unit discounts, coupons, or promotional cost."
              />
            </div>
            <div className="flexOne">
              <FormField
                type="number"
                name="returnCost"
                label="Customer return cost (₹)"
                value={form.returnCost}
                onChange={handleChange}
                placeholder="0"
                min={0}
                step={0.01}
                info="Per-unit buffer for returns and refund handling."
              />
            </div>
            <div className="flexOne">
              <FormField
                type="number"
                name="rtoOtherLoss"
                label="RTO + Other loss (₹)"
                value={form.rtoOtherLoss}
                onChange={handleChange}
                placeholder="0"
                min={0}
                step={0.01}
                info="Return-to-origin, damaged goods, and other loss per unit."
              />
            </div>
          </div>

          <div className="makeFlex row gap16">
            <div className="flexOne">
              <label className="formLabel appendBottom8">Platform fees</label>
              <div className="makeFlex row gap10" style={{ alignItems: 'flex-end' }}>
                <FormField
                  type="select"
                  name="platformFeeType"
                  value={form.platformFeeType}
                  onChange={handleChange}
                  options={[
                    { value: 'percent', label: '%' },
                    { value: 'amount', label: '₹ fixed' },
                  ]}
                />
                <FormField
                  type="number"
                  name="platformFeeValue"
                  value={form.platformFeeValue}
                  onChange={handleChange}
                  placeholder={form.platformFeeType === 'percent' ? 'e.g. 15' : '0'}
                  min={0}
                  step={form.platformFeeType === 'percent' ? 0.5 : 1}
                />
              </div>
              <p className="font12 grayText appendTop4">Marketplace commission (e.g. 15% for many platforms).</p>
            </div>
            <div className="flexOne">
              <FormField
                type="number"
                name="taxPercent"
                label="Tax / GST (%)"
                value={form.taxPercent}
                onChange={handleChange}
                placeholder="e.g. 18"
                min={0}
                max={100}
                step={0.5}
                info="Applied on selling price (e.g. 18% GST in India)."
              />
            </div>
            <div className="flexOne">
              <label className="formLabel appendBottom8">Target profit margin</label>
              <div className="makeFlex row gap10" style={{ alignItems: 'flex-end' }}>
                <FormField
                  type="select"
                  name="targetMarginType"
                  value={form.targetMarginType}
                  onChange={handleChange}
                  options={[
                    { value: 'percent', label: '% of price' },
                    { value: 'amount', label: '₹ per unit' },
                  ]}
                />
                <FormField
                  type="number"
                  name="targetMarginValue"
                  value={form.targetMarginValue}
                  onChange={handleChange}
                  placeholder={form.targetMarginType === 'percent' ? 'e.g. 25' : '0'}
                  min={0}
                  step={form.targetMarginType === 'percent' ? 1 : 0.01}
                />
              </div>
              <p className="font12 grayText appendTop4">Profit you want to keep after all costs and fees.</p>
            </div>
          </div>

          <h2 className="listTitle font20 fontBold blackText appendBottom16 appendTop24">Product info (optional)</h2>
          <div className="makeFlex row gap16">
            <div className="flexOne">
              <FormField
                type="text"
                name="productName"
                label="Product name"
                value={form.productName}
                onChange={handleChange}
                placeholder="e.g. Cotton T-Shirt"
              />
            </div>
            <div className="flexOne">
              <FormField
                type="text"
                name="category"
                label="Category"
                value={form.category}
                onChange={handleChange}
                placeholder="e.g. Apparel"
              />
            </div>
            <div className="flexOne">
              <FormField
                type="text"
                name="brand"
                label="Brand (optional)"
                value={form.brand}
                onChange={handleChange}
                placeholder="Brand / generic"
              />
            </div>
          </div>

          <h2 className="listTitle font20 fontBold blackText appendBottom16 appendTop24">Market & competitor (optional)</h2>
          <div className="makeFlex row gap16">
            <div className="flexOne">
              <FormField
                type="text"
                name="competitorAmazon"
                label="Competitor prices (Amazon) – range"
                value={form.competitorAmazon}
                onChange={handleChange}
                placeholder="e.g. 299 - 599"
              />
            </div>
            <div className="flexOne">
              <FormField
                type="text"
                name="competitorFlipkart"
                label="Competitor prices (Flipkart / others)"
                value={form.competitorFlipkart}
                onChange={handleChange}
                placeholder="e.g. 349 - 649"
              />
            </div>
            <div className="flexOne">
              <FormField
                type="number"
                name="averageMarketPrice"
                label="Average market price (₹)"
                value={form.averageMarketPrice}
                onChange={handleChange}
                placeholder="Optional"
                min={0}
                step={0.01}
              />
            </div>
          </div>

          <div className="makeFlex row gap16">
            <div className="flexOne">
              <FormField
                type="select"
                name="positioning"
                label="Positioning"
                value={form.positioning}
                onChange={handleChange}
                options={[
                  { value: 'premium', label: 'Premium' },
                  { value: 'mid-range', label: 'Mid-range' },
                  { value: 'budget', label: 'Budget' },
                ]}
              />
            </div>
            <div className="flexOne">
              <FormField
                type="select"
                name="priceSensitivity"
                label="Customer price sensitivity"
                value={form.priceSensitivity}
                onChange={handleChange}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
              />
            </div>
          </div>

          <div className="formActions paddingTop16">
            <button type="button" onClick={reset} className="btnSecondary">
              Reset all
            </button>
          </div>
        </form>

        {showResults && (
          <div className="appendTop32">
            <h2 className="listTitle font24 fontBold blackText appendBottom16">Price summary</h2>
            <div className="reportsSummaryTableWrap appendBottom20">
              <table className="fullWidth reportsTable">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="fontSemiBold">Minimum break-even price</td>
                    <td>{formatCurrency(results.breakEven)}</td>
                  </tr>
                  <tr>
                    <td className="fontSemiBold">Recommended selling price</td>
                    <td>{formatCurrency(results.recommended)}</td>
                  </tr>
                  {results.displayPrice != null && results.displayPrice !== results.recommended && (
                    <tr style={{ background: 'rgba(102, 126, 234, 0.08)' }}>
                      <td className="fontSemiBold">Suggested display price (charm pricing)</td>
                      <td>
                        {formatCurrency(results.displayPrice)}
                        {results.marginAtDisplay != null && (
                          <span className="font14 grayText appendLeft8">
                            (margin {results.marginAtDisplay.toFixed(1)}%, profit {formatCurrency(results.profitAtDisplay)}/unit)
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="fontSemiBold">Profit per unit (at recommended price)</td>
                    <td>{formatCurrency(results.profitPerUnit)}</td>
                  </tr>
                  {results.marginPercent != null && (
                    <tr>
                      <td className="fontSemiBold">Margin % (at recommended price)</td>
                      <td>{results.marginPercent.toFixed(1)}%</td>
                    </tr>
                  )}
                  {results.competitiveRange && (
                    <tr>
                      <td className="fontSemiBold">Competitive price range</td>
                      <td>
                        {formatCurrency(results.competitiveRange.low)} – {formatCurrency(results.competitiveRange.high)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <h3 className="font18 fontBold blackText appendBottom12">Cost breakdown (per unit)</h3>
            <div className="reportsSummaryTableWrap appendBottom20">
              <table className="fullWidth reportsTable">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Cost of goods</td><td>{formatCurrency(cost)}</td></tr>
                  <tr><td>Shipping & logistics</td><td>{formatCurrency(shipping)}</td></tr>
                  <tr><td>Printing charges</td><td>{formatCurrency(printing)}</td></tr>
                  <tr><td>Packaging charges</td><td>{formatCurrency(packaging)}</td></tr>
                  <tr><td>Ads cost</td><td>{formatCurrency(ads)}</td></tr>
                  <tr><td>Promotion</td><td>{formatCurrency(promotion)}</td></tr>
                  <tr><td>Customer return cost</td><td>{formatCurrency(returnCost)}</td></tr>
                  <tr><td>RTO + Other loss</td><td>{formatCurrency(rtoOtherLoss)}</td></tr>
                  {platformFixed != null && platformFixed > 0 && <tr><td>Platform fee (fixed)</td><td>{formatCurrency(platformFixed)}</td></tr>}
                  {(platformPct != null && platformPct > 0) || (taxPct != null && taxPct > 0) ? (
                    <tr><td>Platform % + Tax (on selling price)</td><td>{formatCurrency(results.platformTaxAmount)}</td></tr>
                  ) : null}
                  <tr className="fontSemiBold"><td>Total cost</td><td>{formatCurrency(results.totalCost)}</td></tr>
                </tbody>
              </table>
            </div>

            {results.strategy && (
              <p className="font14 appendTop8" style={{ color: '#495057', maxWidth: '720px' }}>
                <strong>Strategy:</strong> {results.strategy}
              </p>
            )}
          </div>
        )}
        {!showResults && (
          <p className="font14 grayText appendTop24">Enter <strong>cost of goods</strong> or any cost (shipping, printing, packaging, ads, promotion, return, RTO, etc.) to see the price summary and cost breakdown below.</p>
        )}
      </div>
    </div>
  );
}
