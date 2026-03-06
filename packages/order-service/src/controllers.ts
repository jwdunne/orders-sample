import { getJsonBody, parseJsonObjectBody, parseRequest, parseResource, toHttpResponse } from "@orders-sample/shared";
import { CreateOrder, CustomerId, Order } from './model';
import { v7 as uuidv7 } from 'uuid';
import { GetOrderParams, OrderRepository } from "./repository";
import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { ResultAsync, err, ok } from "neverthrow";

type OrderParams = {
    repository: OrderRepository;
    event: APIGatewayProxyEventV2;
    paymentServiceBaseUrl?: string;
}

type Response = APIGatewayProxyStructuredResultV2;

export async function handleCreateOrder({
    repository,
    event,
    paymentServiceBaseUrl = ''
}: OrderParams): Promise<Response> {
    const result = await getJsonBody(event)
        .andThen(parseJsonObjectBody)
        .andThen((json) => parseResource(CreateOrder, json))
        .andThen((dto) => parseResource(Order, {
            orderId: uuidv7(),
            ...dto,
            createdAt: new Date().toISOString()
        }))
        .asyncAndThen((order) =>
            ResultAsync.fromPromise(
                fetch(
                    `${paymentServiceBaseUrl}/payments/${order.orderId}`,
                    {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                            customerId: order.customerId,
                            total: order.total
                        })
                    }
                ),
                (e: unknown) => ({
                    type: 'internal_failure',
                    message: 'Fetch failed',
                    cause: e
                } as const)
            ).andThen((res) => {
                if (!res.ok) {
                    return err({
                        type: 'internal_failure',
                        message: 'Payment validation failed'
                    } as const);
                }

                return ok(order);
            })
        )
        .andThen((order) => repository.create(order));

    return toHttpResponse(result, 201);
}

export async function handleGetOrder({
    repository,
    event
}: OrderParams): Promise<Response> {
    return toHttpResponse(
        await parseRequest(GetOrderParams, event.pathParameters)
            .asyncAndThen(repository.get)
    );
}

export async function handleCustomerOrders({
    repository,
    event
}: OrderParams): Promise<Response> {
    return toHttpResponse(
        await parseRequest(CustomerId, event.pathParameters?.customerId)
            .asyncAndThen((id) => repository.listByCustomer(id))
    );
}
