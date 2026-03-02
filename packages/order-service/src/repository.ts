import { BatchWriteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { CustomerId, Order, OrderId } from "./model";
import { DBError, createDynamoErrorHandler, nullishToNotFound, parseResource } from "@orders-sample/shared/src/errors";
import { ResultAsync } from 'neverthrow';
import z from "zod";

export const GetOrderParams = z.object({
    orderId: OrderId,
    customerId: CustomerId
});

export type GetOrderParams = z.infer<typeof GetOrderParams>;

type DBResult<T> = ResultAsync<T, DBError>

export type OrderRepository = {
    create: (order: Order) => DBResult<Order>;

    batchCreate: (orders: Order[]) => Promise<void>;

    get: (params: GetOrderParams) => DBResult<Order>;

    listByCustomer: (customerId: CustomerId) => DBResult<Order[]>;
};

export function createOrderRepository(
    client: DynamoDBDocumentClient,
    tableName: string
): OrderRepository {
    return {
        create: (order: Order): DBResult<Order> => {
            return ResultAsync.fromPromise(
                client.send(new PutCommand({
                    TableName: tableName,
                    Item: {
                        PK: `CUST#${order.customerId}`,
                        SK: `ORDR#${order.orderId}`,
                        TYPE: 'Order',
                        ...order
                    },
                    ConditionExpression: 'attribute_not_exists(PK)'
                })),
                createDynamoErrorHandler('order', `${order.customerId}:${order.orderId}`)
            ).map(() => order);
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

        get: ({ customerId, orderId }): DBResult<Order> => {
            const id = `${customerId}:${orderId}`;

            const result = ResultAsync.fromPromise(
                client.send(new GetCommand({
                    TableName: tableName,
                    Key: {
                        PK: `CUST#${customerId}`,
                        SK: `ORDR#${orderId}`
                    }
                })),
                createDynamoErrorHandler('order', id)
            );

            return result
                .andThen(({ Item }) => nullishToNotFound(Item, 'order', id))
                .andThen((item) => parseResource(Order, item));
        },

        listByCustomer: (customerId: CustomerId): DBResult<Order[]> => {
            const result = ResultAsync.fromPromise(
                client.send(new QueryCommand({
                    TableName: tableName,
                    KeyConditionExpression: 'PK = :PK AND begins_with(SK, :SK)',
                    ExpressionAttributeValues: {
                        ':PK': `CUST#${customerId}`,
                        ':SK': 'ORDR#'
                    },
                    ScanIndexForward: false
                })),
                createDynamoErrorHandler('customer', customerId)
            );

            return result.andThen(({ Items }) => parseResource(z.array(Order), Items));
        }
    }
}
