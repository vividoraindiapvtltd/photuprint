/**
 * Generate dynamic color for brand logo placeholders
 * Creates unique, visually appealing colors based on brand ID and name
 * @param {string} brandId - The brand ID
 * @param {string} brandName - The brand name
 * @returns {string} HSL color string
 */
export const generateBrandColor = (brandId, brandName) => {
  // Create a hash from brand ID and name for consistent colors
  const hash = (brandId + brandName).split('').reduce((a, b) => {
    a = ((a << 5) - a + b.charCodeAt(0)) & 0xffffffff;
    return a;
  }, 0);
  
  // Generate colors using the hash with better variation
  const hue = Math.abs(hash) % 360;
  
  // Create different color schemes based on hash
  const colorScheme = Math.abs(hash) % 4;
  
  let saturation, lightness;
  
  switch (colorScheme) {
    case 0: // Bright, vibrant colors
      saturation = 70 + (Math.abs(hash) % 20); // 70-90%
      lightness = 50 + (Math.abs(hash) % 20); // 50-70%
      break;
    case 1: // Muted, professional colors
      saturation = 40 + (Math.abs(hash) % 25); // 40-65%
      lightness = 55 + (Math.abs(hash) % 20); // 55-75%
      break;
    case 2: // Deep, rich colors
      saturation = 60 + (Math.abs(hash) % 25); // 60-85%
      lightness = 35 + (Math.abs(hash) % 20); // 35-55%
      break;
    case 3: // Soft, pastel colors
      saturation = 50 + (Math.abs(hash) % 20); // 50-70%
      lightness = 65 + (Math.abs(hash) % 20); // 65-85%
      break;
    default:
      saturation = 60 + (Math.abs(hash) % 20);
      lightness = 45 + (Math.abs(hash) % 15);
  }
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

/**
 * Generate dynamic color for any entity (categories, materials, etc.)
 * Creates unique colors based on entity ID and name
 * @param {string} entityId - The entity ID
 * @param {string} entityName - The entity name
 * @returns {string} HSL color string
 */
export const generateEntityColor = (entityId, entityName) => {
  // Create a hash from entity ID and name for consistent colors
  const hash = (entityId + entityName).split('').reduce((a, b) => {
    a = ((a << 5) - a + b.charCodeAt(0)) & 0xffffffff;
    return a;
  }, 0);
  
  // Generate colors using the hash with professional variation
  const hue = Math.abs(hash) % 360;
  
  // Create different color schemes based on hash
  const colorScheme = Math.abs(hash) % 3;
  
  let saturation, lightness;
  
  switch (colorScheme) {
    case 0: // Professional, muted colors
      saturation = 45 + (Math.abs(hash) % 20); // 45-65%
      lightness = 60 + (Math.abs(hash) % 20); // 60-80%
      break;
    case 1: // Rich, deep colors
      saturation = 65 + (Math.abs(hash) % 20); // 65-85%
      lightness = 40 + (Math.abs(hash) % 20); // 40-60%
      break;
    case 2: // Soft, elegant colors
      saturation = 55 + (Math.abs(hash) % 20); // 55-75%
      lightness = 70 + (Math.abs(hash) % 15); // 70-85%
      break;
    default:
      saturation = 55 + (Math.abs(hash) % 20);
      lightness = 60 + (Math.abs(hash) % 20);
  }
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

/**
 * Generate a color based on a string (useful for initials, tags, etc.)
 * @param {string} text - The text to generate color from
 * @returns {string} HSL color string
 */
export const generateTextColor = (text) => {
  // Create a hash from text
  const hash = text.split('').reduce((a, b) => {
    a = ((a << 5) - a + b.charCodeAt(0)) & 0xffffffff;
    return a;
  }, 0);
  
  const hue = Math.abs(hash) % 360;
  const saturation = 60 + (Math.abs(hash) % 25); // 60-85%
  const lightness = 50 + (Math.abs(hash) % 20); // 50-70%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

/**
 * Generate a complementary color for text (for better contrast)
 * @param {string} backgroundColor - The background color in HSL format
 * @returns {string} HSL color string for text
 */
export const generateContrastColor = (backgroundColor) => {
  // Extract HSL values
  const match = backgroundColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return '#ffffff'; // Default to white if parsing fails
  
  const [, h, s, l] = match;
  const hue = parseInt(h);
  const saturation = parseInt(s);
  const lightness = parseInt(l);
  
  // Generate contrasting text color
  if (lightness > 60) {
    // Dark text for light backgrounds
    return `hsl(${hue}, ${Math.min(saturation + 20, 100)}%, ${Math.max(lightness - 40, 20)}%)`;
  } else {
    // Light text for dark backgrounds
    return `hsl(${hue}, ${Math.max(saturation - 20, 0)}%, ${Math.min(lightness + 40, 80)}%)`;
  }
}; 