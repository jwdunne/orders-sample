import { BatchWriteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { CustomerId, Order, OrderId } from "./model";
import { DBError, createDynamoErrorHandler, nullishToNotFound, parseResource } from "@orders-sample/shared/src/errors";
import { ResultAsync, err, ok } from 'neverthrow';
import z from "zod";

export const GetOrderParams = z.object({
    orderId: OrderId,
    customerId: CustomerId
});

export type GetOrderParams = z.infer<typeof GetOrderParams>;

export type OrderRepository = {
    create: (order: Order) => ResultAsync<Order, DBError>;

    batchCreate: (orders: Order[]) => Promise<void>;

    get: (params: GetOrderParams) => ResultAsync<Order, DBError>;

    listByCustomer: (customerId: string) => Promise<Order[]>;
};

export function createOrderRepository(
    client: DynamoDBDocumentClient,
    tableName: string
): OrderRepository {
    return {
        create: (order: Order): ResultAsync<Order, DBError> => {
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

        get: ({ customerId, orderId }): ResultAsync<Order, DBError> => {
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

        listByCustomer: async (customerId: string): Promise<Order[]> => {
            const result = await client.send(new QueryCommand({
                TableName: tableName,
                KeyConditionExpression: 'PK = :PK AND begins_with(SK, :SK)',
                ExpressionAttributeValues: {
                    ':PK': `CUST#${customerId}`,
                    ':SK': 'ORDR#'
                },
                ReturnConsumedCapacity: 'TOTAL'
            }));

            return result.Items?.map((orderRecord) => {
                return Order.parse(orderRecord);
            }) ?? [];
        }
    }
}
