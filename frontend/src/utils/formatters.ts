export function formatCompactNumber(num: number): string {
  if (num < 1000) return num.toLocaleString();
  if (num < 1000000) return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(num / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
}
