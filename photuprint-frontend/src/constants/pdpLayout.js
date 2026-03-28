/**
 * Product details page (PDP) layout — full width on small screens, 85% from md up, centered.
 * Use for main PDP blocks; append utilities e.g. `pt-6`, `pt-8` as needed.
 */
/** min-w-0 lets flex/grid children shrink so inner overflow-x-auto scroll regions get a real width (fixes “stuck” horizontal scroll on mobile). */
export const PDP_PAGE_CONTAINER_CLASS =
  "w-full max-w-full min-w-0 mx-auto px-4 sm:px-6 lg:px-8 md:w-[85%]"

/**
 * Same width/centering without horizontal padding — for sections that add `px-4` themselves (e.g. Recently Viewed inner wrapper).
 */
export const PDP_PAGE_INNER_WIDTH_CLASS = "w-full max-w-full min-w-0 mx-auto md:w-[85%]"
