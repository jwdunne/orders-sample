import { beforeAll, afterAll } from 'vitest';
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

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

export function mockAPIGatewayEvent<T extends Record<string, any>>(body?: T, event?: Partial<APIGatewayProxyEventV2>): APIGatewayProxyEventV2 {
    return {
        version: '',
        routeKey: '',
        rawPath: '',
        rawQueryString: '',
        isBase64Encoded: false,
        pathParameters: {},
        queryStringParameters: {},
        stageVariables: {},
        requestContext: {} as any,
        body: body ? JSON.stringify(body) : body,
        ...(event ?? {}),
        headers: {
            'content-type': 'application/json',
            ...event?.headers ?? {}
        },
    };
}
