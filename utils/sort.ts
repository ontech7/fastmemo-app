export const createdAt_asc_sort = <T extends { createdAt: number }>(
  a: T,
  b: T
) => a.createdAt - b.createdAt;

export const createdAt_desc_sort = <T extends { createdAt: number }>(
  a: T,
  b: T
) => b.createdAt - a.createdAt;

export const order_asc_sort = <T extends { order: number }>(a: T, b: T) =>
  a.order - b.order;
