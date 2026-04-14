import type { Ordered, Timestamped } from "@/types";

export const createdAt_asc_sort = (a: Timestamped, b: Timestamped): number => a.createdAt - b.createdAt;

export const createdAt_desc_sort = (a: Timestamped, b: Timestamped): number => b.createdAt - a.createdAt;

export const updatedAt_asc_sort = (a: Timestamped, b: Timestamped): number => a.updatedAt - b.updatedAt;

export const updatedAt_desc_sort = (a: Timestamped, b: Timestamped): number => b.updatedAt - a.updatedAt;

export const order_asc_sort = (a: Ordered, b: Ordered): number => a.order - b.order;
