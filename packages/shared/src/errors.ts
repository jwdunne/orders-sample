import { ConditionalCheckFailedException, ProvisionedThroughputExceededException, RequestLimitExceeded } from '@aws-sdk/client-dynamodb';
import { type Result, ok, err } from 'neverthrow';
import { z } from 'zod/v4';

/**
 * Represents a failure to parse a resource to a valid form.
 */
export type ResourceInvalid = {
    type: 'resource_invalid';
    message: string;
    form?: string[];
    fields?: Record<string, string[] | undefined>;
};

/**
 * Represents a failure to parse a request to a valid form.
 */
export type RequestInvalid = {
    type: 'request_invalid',
    message: string;
    form?: string[];
    fields?: Record<string, string[] | undefined>;
}

/**
 * Represents a failure to decode data to a form that can be parsed.
 */
export type MalformedContent = {
    type: 'malformed_content';
    message: string;
    reason?: string;
};

/**
 * Represents a failure from receiving an unacceptable content type.
 */
export type UnsupportedContent = {
    type: 'unsupported_content';
    message: string;
    expected: string;
    actual?: string;
}

/**
 * Represents a failure to find a requested resource.
 */
export type ResourceNotFound = {
    type: 'not_found';
    resource: string;
    id: string;
};

/**
 * Represents a failure to create the request resource because it exists.
 */
export type ResourceExists = {
    type: 'resource_exists';
    resource: string;
    id: string;
};

/**
 * Represents a serious or unaccounted for failure that cannot be handled
 * and the consume can do nothing about.
 */
export type InternalFailure = {
    type: 'internal_failure';
    message: string;
    cause?: unknown;
};

/**
 * Represents a temporary failure due to too many requests.
 */
export type Throttled = {
    type: 'throttled';
    retryAfterMs?: number;
}

export type AppError =
    | ResourceInvalid
    | RequestInvalid
    | MalformedContent
    | UnsupportedContent
    | ResourceNotFound
    | ResourceExists
    | InternalFailure
    | Throttled;

/**
 * Parse a Zod resource schema to `Result`, conforming to our error taxonomy.
 */
export function parseResource<T>(
    schema: z.ZodType<T>,
    data: unknown
): Result<T, ResourceInvalid> {
    const result = schema.safeParse(data);

    if (result.success) {
        return ok(result.data);
    }

    const { fieldErrors: fields, formErrors: form } = z.flattenError(result.error);


    return err({
        type: 'resource_invalid',
        message: 'Resource is invalid',
        form,
        fields
    })
}

/**
 * Parse a Zod request schema to `Result`, conforming to our error taxonomy.
 */
export function parseRequest<S extends z.ZodTypeAny>(
    schema: S,
    data: unknown
): Result<z.output<S>, RequestInvalid> {
    const result = schema.safeParse(data);

    if (result.success) {
        return ok(result.data);
    }

    const { fieldErrors: fields, formErrors: form } = z.flattenError(result.error);

    return err({
        type: 'request_invalid',
        message: 'Request is invalid',
        form,
        fields
    })
}

export type DBError =
    | ResourceExists
    | ResourceNotFound
    | InternalFailure
    | ResourceInvalid
    | Throttled;

export function createDynamoErrorHandler(
    resource: string,
    id: string,
): (error: unknown) => DBError {
    return error => {
        if (error instanceof ConditionalCheckFailedException) {
            return {
                type: 'resource_exists',
                resource,
                id
            };
        }

        if (
            error instanceof ProvisionedThroughputExceededException ||
            error instanceof RequestLimitExceeded
        ) {
            return {
                type: 'throttled'
            }
        }

        return {
            type: 'internal_failure',
            message: 'Unknown database error',
            cause: error
        }
    }
}

export function nullishToNotFound<T>(item: T | null | undefined, resource: string, id: string): Result<T, ResourceNotFound> {
    return !item ? err({
        type: 'not_found',
        resource,
        id
    } as const) : ok(item);
}
