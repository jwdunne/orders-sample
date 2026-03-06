import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { mockAPIGatewayEvent, useDynamoDBTable } from "@orders-sample/shared";
import { afterAll, afterEach, assert, beforeAll, describe, expect, test } from "vitest";
import { handleCreateOrder, handleCustomerOrders, handleGetOrder } from "./controllers";
import { createOrderRepository } from "./repository";
import { Order } from "./model";
import { v7 as uuidv7 } from "uuid";
import z from "zod";

const { client, tableName } = useDynamoDBTable();
const repo = createOrderRepository(client, tableName);

const setup = async (customerId: string) => {
    const createOrderResponse = await handleCreateOrder({
        repository: repo,
        event: mockAPIGatewayEvent({
            customerId,
            status: 'PENDING',
            items: [{
                product: 'Coffee',
                quantity: 2,
                price: 19.99
            }],
            total: 39.98,
        }),
        paymentServiceBaseUrl: 'http://payment.service'
    });

    return Order.parse(JSON.parse(createOrderResponse.body ?? ''));
};

describe('POST /orders', () => {
    test('creates order and returns 201', async () => {
        const customerId = uuidv7();
        const response = await handleCreateOrder({
            repository: repo,
            event: mockAPIGatewayEvent({
                customerId,
                status: 'PENDING',
                items: [{
                    product: 'Coffee',
                    quantity: 2,
                    price: 19.99
                }],
                total: 39.98,
            }),
            paymentServiceBaseUrl: 'http://payment.service'
        });

        expect(response.statusCode).toBe(201);

        const body = Order.parse(JSON.parse(response.body ?? ''));
        expect(body.customerId).toBe(customerId);
        expect(body.status).toBe('PENDING');
        expect(body.total).toBe(39.98);
        expect(body.createdAt).toBeDefined();

        assert(body.items.length > 0);
        const [item] = body.items;
        expect(item.price).toBe(19.99);
        expect(item.quantity).toBe(2);
        expect(item.product).toBe('Coffee');
    });

    test('responds with 400 when body missing', async () => {
        const response = await handleCreateOrder({
            repository: repo,
            event: mockAPIGatewayEvent()
        });

        expect(response.statusCode).toBe(400);
    });

    test('responds with 400 when body is malformed JSON', async () => {
        const response = await handleCreateOrder({
            repository: repo,
            event: mockAPIGatewayEvent(undefined, {
                body: 'malformed json string'
            })
        });

        expect(response.statusCode).toBe(400);
    });

    test('responds with 422 when fields are missing or invalid', async () => {
        const response = await handleCreateOrder({
            repository: repo,
            event: mockAPIGatewayEvent({
                status: 'cabbage',
                items: [{
                    product: 'Coffee',
                    quantity: -2,
                    price: 19.99
                }],
                total: 39.98,
            })
        });

        expect(response.statusCode).toBe(422);
    });

    test('responds with 406 when content type is not application/json', async () => {
        const response = await handleCreateOrder({
            repository: repo,
            event: mockAPIGatewayEvent({
                status: 'cabbage',
                items: [{
                    product: 'Coffee',
                    quantity: -2,
                    price: 19.99
                }],
                total: 39.98,
            }, {
                headers: {
                    'content-type': 'application/xml'
                }
            })
        })

        expect(response.statusCode).toBe(415);
    });
});

describe('GET /customers/{customer_id}/orders/{order_id}', () => {

    test('responds with previously created order', async () => {
        const customerId = uuidv7();
        const createdOrder = await setup(customerId);

        const response = await handleGetOrder({
            repository: repo,
            event: mockAPIGatewayEvent(undefined, {
                pathParameters: {
                    customerId,
                    orderId: createdOrder.orderId
                }
            })
        });

        expect(response.statusCode).toBe(200);
    });

    test('responds with 404 when customer not found', async () => {
        const customerId = uuidv7();
        const createdOrder = await setup(uuidv7());

        const response = await handleGetOrder({
            repository: repo,
            event: mockAPIGatewayEvent(undefined, {
                pathParameters: {
                    customerId,
                    orderId: createdOrder.orderId
                }
            })
        });

        expect(response.statusCode).toBe(404);
    });

    test('responds with 404 when order not found', async () => {
        const customerId = uuidv7();
        await setup(customerId);

        const response = await handleGetOrder({
            repository: repo,
            event: mockAPIGatewayEvent(undefined, {
                pathParameters: {
                    customerId,
                    orderId: uuidv7()
                }
            })
        });

        expect(response.statusCode).toBe(404);
    });

    test('responds with 400 if customer_id is not valid UUID', async () => {
        const response = await handleGetOrder({
            repository: repo,
            event: mockAPIGatewayEvent(undefined, {
                pathParameters: {
                    customerId: 'davis',
                    orderId: uuidv7()
                }
            })
        });

        expect(response.statusCode).toBe(400);
    });

    test('responds with 400 if order_id is not valid UUID', async () => {
        const response = await handleGetOrder({
            repository: repo,
            event: mockAPIGatewayEvent(undefined, {
                pathParameters: {
                    customerId: uuidv7(),
                    orderId: 'davis'
                }
            })
        });

        expect(response.statusCode).toBe(400);
    })
});

describe('GET /customers/{customer_id}/orders', () => {
    test('responds with orders sorted descending', async () => {
        const customerId = uuidv7();

        for (let i = 0; i < 10; i++) {
            await setup(customerId);
        }

        const response = await handleCustomerOrders({
            repository: repo,
            event: mockAPIGatewayEvent(undefined, {
                pathParameters: {
                    customerId
                }
            })
        });

        const orders = z.array(Order).parse(JSON.parse(response.body ?? ''));

        const sortedDescending = orders
            .map(({ createdAt }) => createdAt)
            .every((date, i, arr) =>
                i === 0 || arr[i - 1] >= date
            );

        expect(sortedDescending).toBe(true);
    });

    test('responds with empty list if no orders found', async () => {
        const response = await handleCustomerOrders({
            repository: repo,
            event: mockAPIGatewayEvent(undefined, {
                pathParameters: {
                    customerId: uuidv7()
                }
            })
        });

        expect(response.statusCode).toBe(200);
        assert(response.body !== undefined);
        expect(JSON.parse(response.body)).toEqual([]);
    });

    test('responds with at most 10 orders per page', () => {
        // ...
    });

    test('supports next query param for next page', () => {
        // ...
    });

    test('responds with 400 if customer_id not valid UUID', async () => {
        const response = await handleCustomerOrders({
            repository: repo,
            event: mockAPIGatewayEvent(undefined, {
                pathParameters: {
                    customerId: 'barney'
                }
            })
        });

        expect(response.statusCode).toBe(400);
    });
});

const paymentServer = setupServer(
    http.post('*/payments/:orderId', () => {
        return HttpResponse.json({ status: 'validated' });
    })
)

beforeAll(() => paymentServer.listen({
    onUnhandledRequest: (req, print) => {
        if (req.url.startsWith('http://localhost:8000')) {
            return;
        }

        print.warning();
    }
}));
afterEach(() => paymentServer.resetHandlers());
afterAll(() => paymentServer.close());
