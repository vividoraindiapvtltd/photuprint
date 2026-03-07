import HomePage from "../components/HomePage"
import { getHomepageData } from "../src/lib/homepage-data"
import { getFooterData } from "../src/lib/footer-data"

export default async function Page() {
  const [homeData, footerData] = await Promise.all([getHomepageData(), getFooterData()])

  return <HomePage initialSections={homeData.sections} fallbackProducts={homeData.fallbackProducts} initialFooterSections={footerData.sections} initialFooterTheme={footerData.theme} />
}
