/** Service keyは、名前を挙げたNamespaceか、明示したワイルドカードで全Namespaceを許可する。 */
export function namespaceAllowed(namespace: string, allowed: readonly string[]): boolean {
  return allowed.includes('*') || allowed.includes(namespace)
}
