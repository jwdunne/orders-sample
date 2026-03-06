import { mockAPIGatewayEvent, useDynamoDBTable } from '@orders-sample/shared';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Config, handleCreatePayment } from './handler';
import { PutCommand } from '@aws-sdk/lib-dynamodb';

const { configTableName, client } = useDynamoDBTable();

describe('POST /payments/{orderId}', () => {
    const configure = (config: Config): Promise<unknown> => {
        return client.send(new PutCommand({
            TableName: configTableName,
            Item: {
                PK: 'CFG#payment-service',
                ...config
            }
        }));
    }

    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('responds with 200 by default', async () => {
        const response = await handleCreatePayment({
            client,
            configTableName,
            event: mockAPIGatewayEvent()
        });

        expect(response.statusCode).toBe(200);
    });

    test('responds with 500 after simulated failure', async () => {
        await configure({
            FAILURE_RATE: 100,
            LATENCY_MS: 0,
            TIMEOUT_RATE: 0
        });

        const response = await handleCreatePayment({
            client,
            configTableName,
            event: mockAPIGatewayEvent()
        });

        expect(response.statusCode).toBe(500);

        const body = JSON.parse(response.body ?? '{}');
        expect(body.error).toBe('simulated_failure');
    });

    test('responds with 200 after simulated latency', async () => {
        await configure({
            FAILURE_RATE: 0,
            LATENCY_MS: 5_000,
            TIMEOUT_RATE: 0
        });

        const responsePromise = handleCreatePayment({
            client,
            configTableName,
            event: mockAPIGatewayEvent()
        });

        let resolved = false;
        responsePromise.then(() => { resolved = true });

        await vi.advanceTimersByTimeAsync(4_999);
        expect(resolved).toBe(false);

        await vi.runAllTimersAsync();
        expect(resolved).toBe(true);

        const response = await responsePromise;
        expect(response.statusCode).toBe(200);
    });

    test('simulated timeout times out longer than configured timeout', async () => {
        await configure({
            FAILURE_RATE: 0,
            LATENCY_MS: 0,
            TIMEOUT_RATE: 100
        });

        let resolved = false;

        const responsePromise = handleCreatePayment({
            client,
            configTableName,
            event: mockAPIGatewayEvent()
        });

        responsePromise.then(() => { resolved = true });

        await vi.advanceTimersByTimeAsync(10_000);
        expect(resolved).toBe(false);
    });

});
