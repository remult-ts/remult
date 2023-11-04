import type { Repository } from '../../../core/'

export async function deleteAll<entityType>(
  r: Repository<entityType>,
): Promise<Repository<entityType>> {
  await Promise.all((await r.find()).map((x) => r.delete(x)))
  return r
}
