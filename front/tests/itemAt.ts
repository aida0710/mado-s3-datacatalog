/**
 * テストで、あるはずの位置の要素を取り出す。無ければその場で失敗させる。
 * noUncheckedIndexedAccess の下で `list[0]` は undefined を含むので、確かめずに使わないためにここを通す。
 */
export function itemAt<T>(items: ArrayLike<T> | Iterable<T>, index: number): T {
  const list = Array.from(items)
  const item = list[index]
  if (item === undefined) throw new Error(`expected an item at index ${index}, but the list has ${list.length}`)
  return item
}
