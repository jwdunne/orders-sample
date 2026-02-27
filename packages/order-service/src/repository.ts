import { BatchWriteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { Order, OrderItem, StoreEnvelope } from "@orders-sample/shared";

export type OrderRepository = {
    create: (order: Order) => Promise<void>;

    batchCreate: (orders: Order[]) => Promise<void>;

    get: (customerId: string, orderId: string) => Promise<StoreEnvelope<Order>>;

    listByCustomer: (customerId: string) => Promise<StoreEnvelope<Order[]>>;
};

export function createOrderRepository(
    client: DynamoDBDocumentClient,
    tableName: string
): OrderRepository {
    return {
        create: async (order: Order): Promise<void> => {
            await client.send(new PutCommand({
                TableName: tableName,
                Item: {
                    PK: `CUST#${order.customerId}`,
                    SK: `ORDR#${order.orderId}`,
                    TYPE: 'Order',
                    ...order
                }
            }));
        },

        batchCreate: async (orders: Order[]): Promise<void> => {
            await client.send(new BatchWriteCommand({
                RequestItems: {
                    [tableName]: orders.map(order => ({
                        PutRequest: {
                            Item: {
                                PK: `CUST#${order.customerId}`,
                                SK: `ORDR#${order.orderId}`,
                                TYPE: 'Order',
                                ...order
                            }
                        }
                    }))
                }
            }));
        },

        get: async (customerId: string, orderId: string): Promise<StoreEnvelope<Order>> => {
            const result = await client.send(new GetCommand({
                TableName: tableName,
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
            };
        },

        listByCustomer: async (customerId: string): Promise<StoreEnvelope<Order[]>> => {
            const result = await client.send(new QueryCommand({
                TableName: tableName,
                KeyConditionExpression: 'PK = :PK AND begins_with(SK, :SK)',
                ExpressionAttributeValues: {
                    ':PK': `CUST#${customerId}`,
                    ':SK': 'ORDR#'
                },
                ReturnConsumedCapacity: 'TOTAL'
            }));

            const data = result.Items?.map((orderRecord) => {
                return Order.parse(orderRecord);
            }) ?? [];

            return {
                data,
                consumedCapacity: {
                    total: result.ConsumedCapacity?.CapacityUnits ?? 0,
                    rcu: result.ConsumedCapacity?.ReadCapacityUnits ?? 0,
                    wcu: result.ConsumedCapacity?.WriteCapacityUnits ?? 0
                }
            };
        }
    }
}
