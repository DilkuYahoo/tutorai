// Format number for display as comma-separated dollars (e.g., 1500000 → "$1,500,000")
export const formatInThousands = (value: number): string => {
  if (!value) return '';
  return `$${Math.round(value).toLocaleString('en-AU')}`;
};

// Parse comma-separated dollar input back to actual value (e.g., "$1,500,000" → 1500000)
export const parseThousandsInput = (input: string): number => {
  const cleaned = input.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
};
