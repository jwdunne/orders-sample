import { beforeAll, afterAll } from 'vitest';
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { APIGatewayProxyEvent } from 'aws-lambda';

const rawClient = new DynamoDBClient({
    endpoint: 'http://localhost:8000',
    region: 'eu-west-2',
    credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
    }
});

const client = DynamoDBDocumentClient.from(rawClient);

export function useDynamoDBTable() {
    const tableName = `orders-test-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
        await rawClient.send(
            new CreateTableCommand({
                TableName: tableName,
                BillingMode: 'PAY_PER_REQUEST',
                KeySchema: [
                    { AttributeName: 'PK', KeyType: 'HASH' },
                    { AttributeName: 'SK', KeyType: 'RANGE' }
                ],
                AttributeDefinitions: [
                    { AttributeName: 'PK', AttributeType: 'S' },
                    { AttributeName: 'SK', AttributeType: 'S' }
                ]
            })
        );
    });

    afterAll(async () => {
        await rawClient.send(
            new DeleteTableCommand({ TableName: tableName })
        );
    });

    return { tableName, client };
}

export function mockAPIGatewayEvent<T extends Record<string, any> | null>(body: T, event?: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
    return {
        ...(event ?? {}),
        httpMethod: 'ANY',
        headers: {
            'content-type': 'application/json',
            ...event?.headers ?? {}
        },
        multiValueHeaders: event?.multiValueHeaders ?? {},
        isBase64Encoded: event?.isBase64Encoded ?? false,
        path: event?.path ?? '',
        pathParameters: event?.pathParameters ?? {},
        queryStringParameters: event?.queryStringParameters ?? {},
        multiValueQueryStringParameters: event?.multiValueQueryStringParameters ?? {},
        stageVariables: event?.stageVariables ?? {},
        requestContext: event?.requestContext ?? ({} as any),
        resource: event?.resource ?? '',
        body: body ? JSON.stringify(body) : body
    };
}
