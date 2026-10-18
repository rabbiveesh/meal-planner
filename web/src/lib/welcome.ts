/** The welcome line shown when the app opens, greeting her by name when she has given one. */
export function welcomeMessage(name: string): string {
  const trimmed = name.trim()
  return trimmed ? `Let's get meal planning, ${trimmed}!` : "Let's get meal planning!"
}
