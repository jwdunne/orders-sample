import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createOrderRepository } from "./repository";
import { handleCreateOrder, handleCustomerOrders, handleGetOrder } from "./controllers";

if (!process.env.TABLE_NAME) {
    console.error('Cannot without valid TABLE_NAME environment variable');
    process.exit(1);
}

const tableName = process.env.TABLE_NAME;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const orders = createOrderRepository(client, tableName);

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    switch (event.routeKey) {
        case 'GET /customers/{customerId}/orders/{orderId}':
            return handleGetOrder(orders, event);

        case 'POST /orders':
            return handleCreateOrder(orders, event);

        case 'GET /customers/{customerId}/orders':
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

