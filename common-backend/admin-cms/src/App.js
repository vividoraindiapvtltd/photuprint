import React, { useState } from "react"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import Products from "./components/Products"
import Status from "./pages/Status"
import RedirectPage from "./pages/RedirectPage"
import PrivateRoute from "./components/PrivateRoute"
import WebsiteSelection from "./components/WebsiteSelection"
import { AuthProvider } from "./context/AuthContext"
import { PermissionProvider } from "./context/PermissionContext"
import AccessDenied from "./pages/AccessDenied"
import AddColor from "./components/ColorManager"
import AddSize from "./components/SizeManager"
import AddCategory from "./components/CategoryManager"
import AddSubcategory from "./components/SubcategoryManager"
import AddReviewManager from "./components/ReviewManager"
import ReviewList from "./components/ReviewList"
import MaterialManager from "./components/MaterialManager"
import BrandManager from "./components/BrandManager"
import WidthManager from "./components/WidthManager"
import HeightManager from "./components/HeightManager"
import LengthManager from "./components/LengthManager"
import PatternManager from "./components/PatternManager"
import PrintingTypeManager from "./components/PrintingTypeManager"
import PrintSideManager from "./components/PrintSideManager"
import ProductAddonManager from "./components/ProductAddonManager"
import FitTypeManager from "./components/FitTypeManager"
import CapacityManager from "./components/CapacityManager"
import GSMManager from "./components/GSMManager"
import SleeveTypeManager from "./components/SleeveTypeManager"
import CollarStyleManager from "./components/CollarStyleManager"
import CountryOfOriginManager from "./components/CountryOfOriginManager"
import PinCodeManager from "./components/PinCodeManager"
import TemplateManager from "./components/TemplateManager"
import ProductMediaUploader from "./common/MediaUploaderWithVideos"
import CouponManager from "./components/CouponManager"
import UserManager from "./components/UserManager"
import OrderManager from "./components/OrderManager"
import ShippingManager from "./components/ShippingManager"
import ShippingCostManager from "./components/ShippingCostManager"
import GSTSlabManager from "./components/GSTSlabManager"
import CompanyManager from "./components/CompanyManager"
import WebsiteManager from "./components/WebsiteManager"
import VariationManager from "./components/VariationManager"
import DashboardHome from "./pages/DashboardHome"
import PixelCraft from "./components/PixelCraft"
import PixelCraftTemplates from "./components/PixelCraftTemplates"
import ElementManager from "./components/ElementManager"
import ElementImageManager from "./components/ElementImageManager"
import TemplateDimensionManager from "./components/TemplateDimensionManager"
import FontStyleManager from "./components/FontStyleManager"
import ImageToVector from "./components/ImageToVector"
import TestimonialManager from "./components/TestimonialManager"
import HomepageSectionManager from "./components/HomepageSectionManager"
import FooterManager from "./components/FooterManager"
import FooterSetting from "./components/FooterSetting"
import FrontendCarousel from "./components/FrontendCarousel"
import ClientManager from "./components/ClientManager"
import UserAccessManager from "./components/UserAccessManager"
import Reports from "./pages/Reports"
import ProductCostCalculator from "./pages/ProductCostCalculator"
import WalletCashbackOverview from "./components/WalletCashbackOverview"
import CashbackRulesManager from "./components/CashbackRulesManager"
import WalletLedgerAdmin from "./components/WalletLedgerAdmin"

export default function App() {
  const [media, setMedia] = useState([])
  const handleSubmit = (e) => {
    e.preventDefault()

    if (media.length === 0) {
      alert("Please upload at least the main image.")
      return
    }

    const formData = new FormData()
    media.forEach((item) => formData.append("media", item.file))

    // append other product fields here...

    fetch("/api/products", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        alert("Product added!")
        setMedia([])
      })
      .catch((err) => console.error(err))
  }
  return (
    <AuthProvider>
      <PermissionProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/redirect" element={<RedirectPage />} />
            <Route path="/status" element={<Status />} />
            <Route path="/access-denied" element={<AccessDenied />} />
            <Route 
              path="/select-website" 
              element={<WebsiteSelection />} 
            />

          {/* Dashboard Layout with Left & Right containers */}
          <Route
            path="/dashboard/*"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          >
            <Route
              index
              element={
                <PrivateRoute>
                  <DashboardHome />
                </PrivateRoute>
              }
            />
            <Route
              path="addproducts"
              element={
                <PrivateRoute>
                  <Products />
                </PrivateRoute>
              }
            />
            <Route
              path="addcolor"
              element={
                <PrivateRoute>
                  <AddColor />
                </PrivateRoute>
              }
            />
            <Route
              path="addsize"
              element={
                <PrivateRoute>
                  <AddSize />
                </PrivateRoute>
              }
            />
            <Route
              path="addcategory"
              element={
                <PrivateRoute>
                  <AddCategory />
                </PrivateRoute>
              }
            />
            <Route
              path="addsubcategory"
              element={
                <PrivateRoute>
                  <AddSubcategory />
                </PrivateRoute>
              }
            />
            <Route
              path="variationmanager"
              element={
                <PrivateRoute>
                  <VariationManager />
                </PrivateRoute>
              }
            />

            <Route
              path="reviewmanager"
              element={
                <PrivateRoute>
                  <AddReviewManager />
                </PrivateRoute>
              }
            />
            <Route
              path="testimonialmanager"
              element={
                <PrivateRoute>
                  <TestimonialManager />
                </PrivateRoute>
              }
            />
            <Route
              path="homepage-sections"
              element={
                <PrivateRoute>
                  <HomepageSectionManager />
                </PrivateRoute>
              }
            />
            <Route
              path="frontend"
              element={
                <PrivateRoute>
                  <FrontendCarousel />
                </PrivateRoute>
              }
            />
            <Route
              path="footer-sections"
              element={
                <PrivateRoute>
                  <FooterManager />
                </PrivateRoute>
              }
            />
            <Route
              path="footer-settings"
              element={
                <PrivateRoute>
                  <FooterSetting />
                </PrivateRoute>
              }
            />
            <Route
              path="clients"
              element={
                <PrivateRoute>
                  <ClientManager />
                </PrivateRoute>
              }
            />
            <Route
              path="user-access"
              element={
                <PrivateRoute requiredPermissions={['user_access_view', 'user_access_manage']}>
                  <UserAccessManager />
                </PrivateRoute>
              }
            />
            <Route
              path="templatemanager"
              element={
                <PrivateRoute>
                  <TemplateManager />
                </PrivateRoute>
              }
            />
            <Route
              path="reviewlist"
              element={
                <PrivateRoute>
                  <ReviewList />
                </PrivateRoute>
              }
            />
            <Route
              path="addmaterial"
              element={
                <PrivateRoute>
                  <MaterialManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addbrand"
              element={
                <PrivateRoute>
                  <BrandManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addwidth"
              element={
                <PrivateRoute>
                  <WidthManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addheight"
              element={
                <PrivateRoute>
                  <HeightManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addlength"
              element={
                <PrivateRoute>
                  <LengthManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addpattern"
              element={
                <PrivateRoute>
                  <PatternManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addprintingtype"
              element={
                <PrivateRoute>
                  <PrintingTypeManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addprintside"
              element={
                <PrivateRoute>
                  <PrintSideManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addproductaddon"
              element={
                <PrivateRoute>
                  <ProductAddonManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addfittype"
              element={
                <PrivateRoute>
                  <FitTypeManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addcapacity"
              element={
                <PrivateRoute>
                  <CapacityManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addgsm"
              element={
                <PrivateRoute>
                  <GSMManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addsleevetype"
              element={
                <PrivateRoute>
                  <SleeveTypeManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addcollarstyle"
              element={
                <PrivateRoute>
                  <CollarStyleManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addcountryoforigin"
              element={
                <PrivateRoute>
                  <CountryOfOriginManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addpincode"
              element={
                <PrivateRoute>
                  <PinCodeManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addcoupon"
              element={
                <PrivateRoute>
                  <CouponManager />
                </PrivateRoute>
              }
            />
            <Route
              path="adduser"
              element={
                <PrivateRoute>
                  <UserManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addorder"
              element={
                <PrivateRoute>
                  <OrderManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addshipping"
              element={
                <PrivateRoute>
                  <ShippingManager />
                </PrivateRoute>
              }
            />
            <Route
              path="shipping-cost-manager"
              element={
                <PrivateRoute>
                  <ShippingCostManager />
                </PrivateRoute>
              }
            />
            <Route
              path="product-cost-calculator"
              element={
                <PrivateRoute>
                  <ProductCostCalculator />
                </PrivateRoute>
              }
            />
            <Route
              path="addgstslab"
              element={
                <PrivateRoute>
                  <GSTSlabManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addcompany"
              element={
                <PrivateRoute>
                  <CompanyManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addwebsite"
              element={
                <PrivateRoute>
                  <WebsiteManager />
                </PrivateRoute>
              }
            />
            <Route
              path="addMedia"
              element={
                <PrivateRoute>
                  <ProductMediaUploader media={media} setMedia={setMedia} />
                </PrivateRoute>
              }
            />
            <Route
              path="reports"
              element={
                <PrivateRoute>
                  <Reports />
                </PrivateRoute>
              }
            />
            <Route
              path="reports/:reportId"
              element={
                <PrivateRoute>
                  <Reports />
                </PrivateRoute>
              }
            />
            <Route
              path="pixelcraft"
              element={
                <PrivateRoute>
                  <PixelCraft />
                </PrivateRoute>
              }
            >
              <Route index element={<PixelCraftTemplates />} />
              <Route path="elements" element={<ElementManager />} />
              <Route path="element-images" element={<ElementImageManager />} />
              <Route path="dimensions" element={<TemplateDimensionManager />} />
              <Route path="fonts" element={<FontStyleManager />} />
              <Route path="image-to-vector" element={<ImageToVector />} />
            </Route>
            <Route
              path="wallet-cashback"
              element={
                <PrivateRoute>
                  <WalletCashbackOverview />
                </PrivateRoute>
              }
            />
            <Route
              path="wallet-cashback/rules"
              element={
                <PrivateRoute>
                  <CashbackRulesManager />
                </PrivateRoute>
              }
            />
            <Route
              path="wallet-cashback/ledger"
              element={
                <PrivateRoute>
                  <WalletLedgerAdmin />
                </PrivateRoute>
              }
            />
          </Route>

          {/* Catch-all route - redirect any unknown route */}
            <Route path="*" element={<RedirectPage />} />
          </Routes>
        </Router>
      </PermissionProvider>
    </AuthProvider>
    // <AuthProvider>
    //   <Router>
    //     <Routes>
    //     /* {/*<Route path="/" element={<Login />} />
    //       <Route path="/status" element={<Status />} />
    //       <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
    //       <Route path="/products" element={<PrivateRoute><Products /></PrivateRoute>} />  */}
    //       <Route path="/dashboard" element={<Dashboard />}>
    //         <Route path="addbrand" element={<BrandManager />} />
    //         <Route path="products" element={<Products />} />
    //         <Route path="addcolor" element={<AddColor />} />
    //         <Route path="addsize" element={<AddSize />} />
    //         <Route path="addcategory" element={<AddCategory />} />
    //         <Route path="addsubcategory" element={<AddSubcategory />} />
    //         <Route path="addreview" element={<AddReviewManager />} />
    //         <Route path="reviewlist" element={<ReviewList />} />
    //         <Route path="addmaterial" element={<MaterialManager />} />
    //         <Route path="addbrand" element={<BrandManager />} />
    //         <Route path="addwidth" element={<WidthManager />} />
    //         <Route path="addheight" element={<HeightManager />} />
    //         <Route path="addlength" element={<LengthManager />} />
    //         <Route path="addpattern" element={<PatternManager />} />
    //         <Route path="addfittype" element={<FitTypeManager />} />
    //         <Route path="addsleevetype" element={<SleeveTypeManager />} />
    //         <Route path="addcollarstyle" element={<CollarStyleManager />} />
    //         <Route path="addcountryoforigin" element={<CountryOfOriginManager />} />
    //         <Route path="addpincode" element={<PinCodeManager />} />
    //         <Route path="addMedia" element={<ProductMediaUploader media={media} setMedia={setMedia} />} />
    //       </Route>
    //     </Routes>
    //   </Router>
    // </AuthProvider>
  )
}
