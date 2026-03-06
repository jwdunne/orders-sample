import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import z from "zod";

type Request = APIGatewayProxyEventV2;
type Response = APIGatewayProxyStructuredResultV2;

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const Config = z.object({
    FAILURE_RATE: z.number().nonnegative(),
    LATENCY_MS: z.number().nonnegative(),
    TIMEOUT_RATE: z.number().nonnegative()
});

export type Config = z.infer<typeof Config>;

export const handler = (_event: Request): Promise<Response> => {
    if (!process.env.CONFIG_TABLE_NAME) {
        console.log({
            error: 'config_error',
            reason: 'CONFIG_TABLE_NAME not provided'
        });

        return Promise.resolve({ statusCode: 500 });
    }

    return handleCreatePayment({
        client,
        configTableName: process.env.CONFIG_TABLE_NAME,
        event: _event
    });
};

type HandleCreatePaymentParams = {
    client: DynamoDBDocumentClient,
    configTableName: string,
    event: Request
};

export const handleCreatePayment = async ({
    client,
    configTableName
}: HandleCreatePaymentParams): Promise<Response> => {
    const result = await client.send(
        new GetCommand({
            TableName: configTableName,
            Key: {
                PK: `CFG#payment-service`
            }
        })
    );

    const config = Config.safeParse(result.Item ?? {
        FAILURE_RATE: 0,
        LATENCY_MS: 0,
        TIMEOUT_RATE: 0
    });

    if (!config.success) {
        console.error({
            error: 'config_error',
            reason: config.error
        });

        return { statusCode: 500 };
    }

    const { FAILURE_RATE, LATENCY_MS, TIMEOUT_RATE } = config.data;

    if (LATENCY_MS > 0) {
        await new Promise((resolve) => {
            setTimeout(() => resolve(null), LATENCY_MS);
        });
    }

    const roll = Math.random() * 100;

    if (roll < FAILURE_RATE) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'simulated_failure'
            })
        };
    }

    if (roll < TIMEOUT_RATE) {
        await new Promise((resolve) => {
            setTimeout(() => resolve(null), 30_000);
        });

        return {
            statusCode: 504,
            body: JSON.stringify({
                error: 'simulated_timeout'
            })
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Hello, world!' })
    };
}
