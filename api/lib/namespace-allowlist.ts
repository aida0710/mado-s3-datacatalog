/** Service keys grant named namespaces, or all namespaces with the explicit wildcard. */
export function namespaceAllowed(namespace: string, allowed: readonly string[]): boolean {
  return allowed.includes('*') || allowed.includes(namespace)
}
