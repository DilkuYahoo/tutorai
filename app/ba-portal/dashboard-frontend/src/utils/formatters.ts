// Format number for display in thousands (e.g., 1500000 → "1.5M")
export const formatInThousands = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${Math.round(value / 1000)}K`;
  }
  return value.toString();
};

// Parse thousands input back to actual value (e.g., "1.5K" → 1500)
export const parseThousandsInput = (input: string): number => {
  const trimmed = input.trim().toUpperCase();
  const num = parseFloat(trimmed);

  if (trimmed.endsWith('M')) {
    return Math.round(num * 1000000);
  } else if (trimmed.endsWith('K')) {
    return Math.round(num * 1000);
  }
  return isNaN(num) ? 0 : Math.round(num * 1000); // Default: assume input is in thousands
};
