import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { v7 as uuidv7 } from 'uuid';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { OrderRepository, createOrderRepository } from "./repository";
import { CreateOrder, Order, getJsonBody, parseJsonObjectBody, toHttpResponse } from "@orders-sample/shared";
import { parse } from '@orders-sample/shared/src/errors';

export const handler = async (event: APIGatewayProxyEventV2): Promise<unknown> => {
    if (!process.env.TABLE_NAME) {
        console.error('Cannot run simulation without providing TABLE_NAME environment variable');
        process.exit(1);
    }

    const tableName = process.env.TABLE_NAME;
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    const orders = createOrderRepository(client, tableName);

    switch (event.routeKey) {
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

export async function handleCreateOrder(repository: OrderRepository, event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const result = await getJsonBody(event)
        .andThen(parseJsonObjectBody)
        .andThen((json) => parse(CreateOrder, json))
        .andThen((dto) => parse(Order, {
            orderId: uuidv7(),
            ...dto,
            createdAt: new Date().toISOString()
        }))
        .asyncAndThen((order) => repository.create(order));

    return toHttpResponse(result, 201);
}

export async function handleGetOrder(repository: OrderRepository, event: APIGatewayProxyEventV2): Promise<unknown> {
    const result = await repository.get(
        event.pathParameters?.customer_id ?? '',
        event.pathParameters?.order_id ?? ''
    );

    return {
        statusCode: 200,
        body: JSON.stringify(result.data)
    };
}

export async function handleCustomerOrders(repository: OrderRepository, event: APIGatewayProxyEventV2): Promise<unknown> {
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
