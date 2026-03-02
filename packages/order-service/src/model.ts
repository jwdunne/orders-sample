import z from "zod";

export const OrderId = z.uuidv7().brand<'OrderId'>();
export type OrderId = z.infer<typeof OrderId>;

export const CustomerId = z.uuidv7().brand<'CustomerId'>();
export type CustomerId = z.infer<typeof CustomerId>;

export const OrderItem = z.object({
    product: z.string().nonempty(),
    quantity: z.number().positive().int(),
    price: z.number().positive()
});

export type OrderItem = z.infer<typeof OrderItem>;

export const Order = z.object({
    orderId: OrderId,
    customerId: CustomerId,
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
