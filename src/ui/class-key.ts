// 'Warrior' → 'warrior': the key the talent layout, the planner's URL and the
// class icons all use. Its own module so callers that just need the key are not
// made to load the talent layout with it (src/ui/talents-data.ts).
export const classKey = (className: string) => className.toLowerCase();
