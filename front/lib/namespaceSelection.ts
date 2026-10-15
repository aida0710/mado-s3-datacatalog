// Match the existing access-token API limits for named permissions.
export const NAMESPACE_MAX_LENGTH = 512
export const NAMESPACE_MAX_COUNT = 128

export function namespaceChoices(input: { available: string[]; selected: string[] }): string[] {
  return [...new Set([...input.available, ...input.selected])].filter(name => name !== '*').sort()
}
