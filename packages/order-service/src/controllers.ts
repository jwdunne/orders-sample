import { getJsonBody, parseJsonObjectBody, parseRequest, parseResource, toHttpResponse } from "@orders-sample/shared";
import { CreateOrder, CustomerId, Order } from './model';
import { v7 as uuidv7 } from 'uuid';
import { GetOrderParams, OrderRepository } from "./repository";
import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

export async function handleCreateOrder(repository: OrderRepository, event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const result = await getJsonBody(event)
        .andThen(parseJsonObjectBody)
        .andThen((json) => parseResource(CreateOrder, json))
        .andThen((dto) => parseResource(Order, {
            orderId: uuidv7(),
            ...dto,
            createdAt: new Date().toISOString()
        }))
        .asyncAndThen((order) => repository.create(order));

    return toHttpResponse(result, 201);
}

export async function handleGetOrder(repository: OrderRepository, event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    return toHttpResponse(
        await parseRequest(GetOrderParams, event.pathParameters)
            .asyncAndThen(repository.get)
    );
}

export async function handleCustomerOrders(repository: OrderRepository, event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    return toHttpResponse(
        await parseRequest(CustomerId, event.pathParameters?.customerId)
            .asyncAndThen((id) => repository.listByCustomer(id))
    );
}
