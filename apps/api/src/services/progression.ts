export function levelForXp(xp: number) {
  return Math.min(20, 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 100)));
}
