import z from 'zod';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { v7 as uuidv7 } from 'uuid';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { OrderRepository, createOrderRepository } from "./repository";
import { CreateOrder, Order } from "@orders-sample/shared";

export const handler = async (event: APIGatewayProxyEvent): Promise<unknown> => {
    if (!process.env.TABLE_NAME) {
        console.error('Cannot run simulation without providing TABLE_NAME environment variable');
        process.exit(1);
    }

    const tableName = process.env.TABLE_NAME;
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

    const orders = createOrderRepository(client, tableName);

    switch (`${event.httpMethod} ${event.resource}`) {
        case 'GET /customers/{customer_id}/orders/{order_id}':
            return handleGetOrder(orders, event);

        case 'POST /orders':
            return handleCreateOrder(orders, event);

        case 'GET /customers/{customer_id}/orders':
            return handleCustomerOrders(orders, event);

        default:
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: 'Not found'
                })
            }
    }
}

export async function handleCreateOrder(repository: OrderRepository, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    if (event.headers['content-type'] && event.headers['content-type'] !== 'application/json') {
        return {
            statusCode: 406,
            body: JSON.stringify({
                type: 'error',
                message: 'Not acceptable. Only application/json is supported.'
            })
        }
    }

    if (event.body === null) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                type: 'error',
                status: 'Bad request',
                message: 'Body is missing. Expected order data encoded as JSON'
            })
        }
    }

    let rawOrderRecord;
    try {
        rawOrderRecord = JSON.parse(event.body);
    } catch (e: unknown) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                type: 'error',
                message: 'Malformed request. Failed to parse JSON.',
                reason: e instanceof Error ? e.message : e
            })
        }
    }

    let parsedOrderRequest;
    try {
        parsedOrderRequest = CreateOrder.parse(rawOrderRecord);
    } catch (e) {
        return {
            statusCode: 422,
            body: JSON.stringify({
                type: 'error',
                message: 'Unprocessable entity. Some fields missing or malformed.',
                reason: e instanceof z.ZodError
                    ? e.issues
                    : e instanceof Error
                        ? e.message
                        : e
            })
        }
    }

    let order;
    try {
        order = Order.parse({
            orderId: uuidv7(),
            ...parsedOrderRequest,
            createdAt: new Date().toISOString()
        });
    } catch (e) {
        return {
            statusCode: 422,
            body: JSON.stringify({
                type: 'error',
                message: 'Unprocessable entity. Some fields missing or malformed.',
                reason: e instanceof z.ZodError
                    ? e.issues
                    : e instanceof Error
                        ? e.message
                        : e
            })
        }
    }

    await repository.create(order);
    return {
        statusCode: 201,
        body: JSON.stringify(order)
    };
}

export async function handleGetOrder(repository: OrderRepository, event: APIGatewayProxyEvent): Promise<unknown> {
    const result = await repository.get(
        event.pathParameters?.customer_id ?? '',
        event.pathParameters?.order_id ?? ''
    );

    return {
        statusCode: 200,
        body: JSON.stringify(result.data)
    };
}

export async function handleCustomerOrders(repository: OrderRepository, event: APIGatewayProxyEvent): Promise<unknown> {
    try {
        const result = await repository.listByCustomer(event.pathParameters?.customer_id ?? '');
        return {
            statusCode: 200,
            body: JSON.stringify(result.data)
        };
    } catch (e: unknown) {
        return {
            statusCode: 500,
            body: JSON.stringify(e)
        }
    }
}
