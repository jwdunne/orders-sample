import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createOrderRepository } from "./repository";
import { handleCreateOrder, handleCustomerOrders, handleGetOrder } from "./controllers";

const tableName = process.env.ORDER_TABLE_NAME ?? '';
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const repository = createOrderRepository(client, tableName);

const paymentServiceBaseUrl = process.env.PAYMENT_SERVICE_BASE_URL;

if (!paymentServiceBaseUrl) {
    console.error('Missing PAYMENT_SERVICE_BASE_URL environment variable');
    process.exit(1);
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    switch (event.routeKey) {
        case 'GET /customers/{customerId}/orders/{orderId}':
            return handleGetOrder({ repository, event, paymentServiceBaseUrl });

        case 'POST /orders':
            return handleCreateOrder({ repository, event });

        case 'GET /customers/{customerId}/orders':
            return handleCustomerOrders({ repository, event });

        default:
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: 'Not found'
                })
            }
    }
}

