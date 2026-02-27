import z from "zod";

export const OrderItem = z.object({
    product: z.string().nonempty(),
    quantity: z.number().positive().int(),
    price: z.number().positive()
});

export type OrderItem = z.infer<typeof OrderItem>;

export const Order = z.object({
    orderId: z.uuidv7(),
    customerId: z.uuidv7(),
    status: z.enum(['PENDING', 'CANCELLED', 'ACCEPTED', 'DISPATCHED']),
    items: z.array(OrderItem).nonempty(),
    total: z.number().positive(),
    createdAt: z.iso.datetime()
});

export type Order = z.infer<typeof Order>;

export const CreateOrder = Order.omit({
    orderId: true,
    createdAt: true
});

export type CreateOrder = z.infer<typeof CreateOrder>;

export type StoreEnvelope<T> = {
    data: T,
    consumedCapacity: {
        total: number,
        rcu: number,
        wcu: number
    }
}
