import { AppError, MalformedContent, UnsupportedContent } from './errors';
import { Result, err, ok } from 'neverthrow';
import { APIGatewayProxyResultV2, APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

export function getJsonBody(
    event: APIGatewayProxyEventV2
): Result<string | null | undefined, UnsupportedContent> {
    if (event.headers['content-type'] && event.headers['content-type'] !== 'application/json') {
        return err({
            type: 'unsupported_content',
            message: 'Unsupported content type',
            expected: 'application/json',
            actual: event.headers['content-type']
        });
    }

    return ok(event.body);
}

export function parseJsonObjectBody(
    body: string | null | undefined
): Result<unknown, MalformedContent> {
    if (!body) {
        return err({
            type: 'malformed_content',
            message: 'Missing request body. JSON document expected'
        } as const);
    }

    try {
        return ok(JSON.parse(body));
    } catch (e) {
        return err({
            type: 'malformed_content',
            message: 'Failed to parse JSON body',
            reason: (e as SyntaxError).message
        } as const);
    }
}

export function toHttpResponse(
    result: Result<unknown, AppError>,
    successStatus: number = 200
): APIGatewayProxyStructuredResultV2 {
    if (result.isOk()) {
        return response(successStatus, result.value);
    }

    const { error } = result;

    switch (error.type) {
        case 'resource_invalid':
            return response(422, {
                type: error.type,
                error: error.message,
                context: {
                    form: error.form,
                    fields: error.fields,
                }
            });

        case 'resource_exists':
            return response(409, {
                type: error.type,
                error: `${error.resource} with ID ${error.type} already exists`,
                context: {
                    resource: error.resource,
                    id: error.id
                }
            });

        case 'malformed_content':
            return response(400, {
                type: error.type,
                error: error.message,
                context: {
                    reason: error.reason
                }
            });

        case 'unsupported_content':
            return response(415, {
                type: error.type,
                error: error.message,
                context: {
                    expected: error.expected,
                    actual: error.actual
                }
            });

        case 'not_found':
            return response(404, {
                type: error.type,
                error: `${error.resource} with ID ${error.type} not found`,
                context: {
                    resource: error.resource,
                    id: error.id
                }
            });

        case 'internal_failure':
            if (error.cause) {
                console.error(error);
            }
            return response(500, {
                type: error.type,
                message: error.message
            });

        case 'throttled':
            return response(429, {
                type: error.type,
                error: 'too many requests',
                context: {
                    retry_after_ms: error.retryAfterMs
                }
            });
    }
}

function response<T>(statusCode: number, body: T): APIGatewayProxyStructuredResultV2 {
    return {
        statusCode,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    }
}
