import { APIGatewayProxyEvent } from "aws-lambda";

export const handler = async (_event: APIGatewayProxyEvent): Promise<unknown> => {
    return {
        statusCode: 200,
        body: ''
    };
}
