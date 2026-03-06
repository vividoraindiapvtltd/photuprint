/**
 * Generates a consistent color for brand logo placeholders based on brand ID and name
 * @param {string} brandId - The brand's unique identifier
 * @param {string} brandName - The brand's name
 * @returns {string} CSS color value (hex, rgb, or hsl)
 */
const generateBrandColor = (brandId, brandName) => {
  // Use brandId if available, otherwise fall back to brandName
  const seed = brandId || brandName || 'default';
  
  // Generate a hash from the seed string
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use absolute value to ensure positive numbers
  const absHash = Math.abs(hash);
  
  // Generate different color schemes based on the hash
  const colorScheme = absHash % 4;
  
  switch (colorScheme) {
    case 0:
      // Blue theme
      return `hsl(${200 + (absHash % 40)}, ${60 + (absHash % 20)}%, ${70 + (absHash % 20)}%)`;
    
    case 1:
      // Green theme
      return `hsl(${120 + (absHash % 40)}, ${50 + (absHash % 30)}%, ${65 + (absHash % 25)}%)`;
    
    case 2:
      // Purple theme
      return `hsl(${280 + (absHash % 40)}, ${55 + (absHash % 25)}%, ${70 + (absHash % 20)}%)`;
    
    case 3:
      // Orange theme
      return `hsl(${30 + (absHash % 30)}, ${70 + (absHash % 20)}%, ${65 + (absHash % 25)}%)`;
    
    default:
      // Fallback to a neutral color
      return `hsl(${200}, 60%, 75%)`;
  }
};

export default generateBrandColor; 