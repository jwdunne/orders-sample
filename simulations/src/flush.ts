import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

if (!process.env.TABLE_NAME) {
    console.error('Cannot run simulation without providing TABLE_NAME environment variable');
    process.exit(1);
}

const tableName = process.env.TABLE_NAME;

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function main() {
    let deleted = 0;
    let lastKey: Record<string, any> | undefined;

    do {
        const scan = await client.send(
            new ScanCommand({
                TableName: tableName,
                ExclusiveStartKey: lastKey,
                ProjectionExpression: 'PK, SK'
            })
        );

        const items = scan.Items ?? [];
        lastKey = scan.LastEvaluatedKey;

        for (let i = 0; i < items.length; i += 25) {
            const batch = items.slice(i, i + 25);
            await client.send(
                new BatchWriteCommand({
                    RequestItems: {
                        [tableName]: batch.map(item => ({
                            DeleteRequest: {
                                Key: {
                                    PK: item.PK ?? '',
                                    SK: item.SK ?? ''
                                }
                            }
                        }))
                    }
                })
            );
            deleted += batch.length;
        }
    } while (lastKey);

    console.log(`Deleted ${deleted} records from ${tableName}`);
}

main()
    .then(() => process.exit(0))
    .catch(console.error);
