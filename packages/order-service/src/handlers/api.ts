import { APIGatewayProxyEvent } from "aws-lambda";
import { v7 as uuidv7 } from 'uuid';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

export type OrderItem = {
    product: string,
    quantity: number,
    price: number
};

export type Order = {
    orderId: string,
    customerId: string,
    status: string,
    items: OrderItem[],
    total: number,
    createdAt: string
};

export type StoreEnvelope<T> = {
    data: T,
    consumedCapacity: {
        total: number,
        rcu: number,
        wcu: number
    }
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const orders = {
    get: async (customerId: string, orderId: string): Promise<StoreEnvelope<Order>> => {
        const result = await client.send(new GetCommand({
            TableName: 'Orders',
            Key: {
                PK: `CUST#${customerId}`,
                SK: `ORDR#${orderId}`
            },
            ReturnConsumedCapacity: 'TOTAL'
        }));

        if (!result.Item) {
            throw Error(`Could not find order by ID #${orderId}`);
        }

        return {
            data: {
                orderId: result.Item.orderId,
                customerId: result.Item.customerId,
                status: result.Item.status,
                items: result.Item.items,
                total: result.Item.total,
                createdAt: result.Item.createdAt
            },
            consumedCapacity: {
                total: result.ConsumedCapacity?.CapacityUnits ?? 0,
                rcu: result.ConsumedCapacity?.ReadCapacityUnits ?? 0,
                wcu: result.ConsumedCapacity?.WriteCapacityUnits ?? 0
            }
        }
    },

    create: async (order: Order): Promise<void> => {
        await client.send(new PutCommand({
            TableName: 'Orders',
            Item: {
                PK: `CUST#${order.customerId}`,
                SK: `ORDR#${order.orderId}`,
                ...order
            }
        }))
    },

    batchCreate: async (orders: Order[]): Promise<void> => {
        await client.send(new BatchWriteCommand({
            RequestItems: {
                Orders: orders.map(order => ({
                    PutRequest: {
                        Item: {
                            PK: `CUST#${order.customerId}`,
                            SK: `ORDR#${order.orderId}`,
                            ...order
                        }
                    }
                }))
            }
        }));
    },

    listByCustomer: async (customerId: string): Promise<StoreEnvelope<Order[]>> => {
        const result = await client.send(new QueryCommand({
            TableName: 'Orders',
            KeyConditionExpression: 'PK = :PK AND begins_with(SK, :SK)',
            ExpressionAttributeValues: {
                ':PK': `CUST#${customerId}`,
                ':SK': 'ORDR#'
            },
            ReturnConsumedCapacity: 'TOTAL'
        }));

        const data = result.Items?.map((orderRecord) => {
            return {
                orderId: orderRecord.orderId as string,
                customerId: orderRecord.customerId as string,
                status: orderRecord.status as string,
                items: orderRecord.items as OrderItem[],
                total: orderRecord.total as number,
                createdAt: orderRecord.createdAt as string
            };
        }) ?? [];

        return {
            data,
            consumedCapacity: {
                total: result.ConsumedCapacity?.CapacityUnits ?? 0,
                rcu: result.ConsumedCapacity?.ReadCapacityUnits ?? 0,
                wcu: result.ConsumedCapacity?.WriteCapacityUnits ?? 0
            }
        }
    }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<unknown> => {
    switch (`${event.httpMethod} ${event.resource}`) {
        case 'GET /customers/{customer_id}/orders/{order_id}': {
            const result = await orders.get(
                event.pathParameters?.customer_id ?? '',
                event.pathParameters?.order_id ?? ''
            );

            return {
                statusCode: 200,
                body: JSON.stringify(result.data)
            };
        }


        case 'POST /orders': {
            const orderAttrs = JSON.parse(event.body ?? '{}');
            orderAttrs.orderId = uuidv7();
            await orders.create(orderAttrs);
            return {
                statusCode: 200,
                body: JSON.stringify(orderAttrs)
            };
        }

        case 'GET /customers/{customer_id}/orders': {
            try {
                const result = await orders.listByCustomer(event.pathParameters?.customer_id ?? '');
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
    }


    return {
        statusCode: 404,
        body: JSON.stringify({
            message: 'Not found'
        })
    }
}
