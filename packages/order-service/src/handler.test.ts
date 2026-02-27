import { Order, mockAPIGatewayEvent, useDynamoDBTable } from "@orders-sample/shared";
import { assert, describe, expect, test } from "vitest";
import { handleCreateOrder } from "./handler";
import { createOrderRepository } from "./repository";
import { v7 as uuidv7 } from "uuid";
import { APIGatewayProxyEvent } from "aws-lambda";

const { client, tableName } = useDynamoDBTable();

describe('POST /orders', () => {
    test('creates order and returns 201', async () => {
        const customerId = uuidv7();
        const repo = createOrderRepository(client, tableName);
        const response = await handleCreateOrder(repo, mockAPIGatewayEvent({
            customerId,
            status: 'PENDING',
            items: [{
                product: 'Coffee',
                quantity: 2,
                price: 19.99
            }],
            total: 39.98,
        }));

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body) as Order;
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
        const repo = createOrderRepository(client, tableName);
        const response = await handleCreateOrder(repo, mockAPIGatewayEvent(null));

        expect(response.statusCode).toBe(400);
    });

    test('responds with 400 when body is malformed JSON', async () => {
        const repo = createOrderRepository(client, tableName);
        const response = await handleCreateOrder(repo, mockAPIGatewayEvent(null, {
            body: 'malformed json string'
        }));
        expect(response.statusCode).toBe(400);
    });

    test('responds with 422 when fields are missing or invalid', async () => {
        const repo = createOrderRepository(client, tableName);
        const response = await handleCreateOrder(repo, mockAPIGatewayEvent({
            status: 'cabbage',
            items: [{
                product: 'Coffee',
                quantity: -2,
                price: 19.99
            }],
            total: 39.98,
        }))

        expect(response.statusCode).toBe(422);
    });

    test('responds with 406 when content type is not application/json', async () => {
        const repo = createOrderRepository(client, tableName);
        const response = await handleCreateOrder(repo, mockAPIGatewayEvent({
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
        }))

        expect(response.statusCode).toBe(406);
    });
});

describe('GET /customers/{customer_id}/orders/{order_id}', () => {
    test('responds with previously created order', () => {
        // ...
    });

    test('responds with 404 when customer not found', () => {
        // ...
    });

    test('responds with 404 when order not found', () => {
        // ...
    });

    test('responds with 400 if customer_id is not valid UUID', () => {
        // ...
    });

    test('responds with 400 if order_id is not valid UUID', () => {
        // ...
    })
});

describe('GET /customers/{customer_id}/orders', () => {
    test('responds with orders sorted descending', () => {
        // ...
    });

    test('responds with at most 10 orders per page', () => {
        // ...
    });

    test('supports next query param for next page', () => {
        // ...
    });

    test('responds with 404 if customer not found', () => {
        // ...
    });

    test('responds with 400 if customer_id not valid UUID', () => {
        // ...
    });
});
