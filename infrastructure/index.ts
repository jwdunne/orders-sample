import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as path from 'path';

const stackName = pulumi.getStack();

const ordersTable = new aws.dynamodb.Table("Orders", {
    name: `orders-${stackName}`,
    billingMode: 'PAY_PER_REQUEST',
    hashKey: 'PK',
    rangeKey: 'SK',
    attributes: [
        { name: 'PK', type: 'S' },
        { name: 'SK', type: 'S' },
    ]
});

const configTable = new aws.dynamodb.Table("Config", {
    name: `config-${stackName}`,
    billingMode: 'PAY_PER_REQUEST',
    hashKey: 'PK',
    attributes: [
        { name: 'PK', type: 'S' }
    ]
});

const orderServiceLambdaRolePolicy = aws.iam.getPolicyDocument({
    statements: [
        {
            actions: ['sts:AssumeRole'],
            principals: [{ type: 'Service', identifiers: ['lambda.amazonaws.com'] }]
        }
    ]
});

const paymentServiceLambdaRolePolicy = aws.iam.getPolicyDocument({
    statements: [
        {
            actions: ['sts:AssumeRole'],
            principals: [{ type: 'Service', identifiers: ['lambda.amazonaws.com'] }]
        }
    ]
});

const orderServiceLambdaRole = new aws.iam.Role('OrderServiceRole', {
    assumeRolePolicy: orderServiceLambdaRolePolicy.then(policy => policy.json)
});

const paymentServiceLambdaRole = new aws.iam.Role('PaymentServiceRole', {
    assumeRolePolicy: paymentServiceLambdaRolePolicy.then(policy => policy.json)
});

new aws.iam.RolePolicyAttachment('OrderServiceLogsPolicy', {
    role: orderServiceLambdaRole.name,
    policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole
});

new aws.iam.RolePolicyAttachment('PaymentServiceLogsPolicy', {
    role: paymentServiceLambdaRole.name,
    policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole
});

const orderServiceRolePolicy = aws.iam.getPolicyDocumentOutput({
    statements: [{
        actions: [
            "dynamodb:GetItem",
            "dynamodb:PutItem",
            "dynamodb:Query",
            "dynamodb:Scan",
            "dynamodb:BatchWriteItem",
            "dynamodb:UpdateItem",
            "dynamodb:DeleteItem"
        ],
        resources: [
            pulumi.interpolate`${ordersTable.arn}`,
            pulumi.interpolate`${ordersTable.arn}/index/*`,
            pulumi.interpolate`${configTable.arn}`,
            pulumi.interpolate`${configTable.arn}/index/*`,
        ]
    }],
})

const paymentServiceRolePolicy = aws.iam.getPolicyDocumentOutput({
    statements: [{
        actions: [
            "dynamodb:GetItem",
            "dynamodb:PutItem",
            "dynamodb:Query",
            "dynamodb:Scan",
            "dynamodb:BatchWriteItem",
            "dynamodb:UpdateItem",
            "dynamodb:DeleteItem"
        ],
        resources: [
            pulumi.interpolate`${configTable.arn}`,
            pulumi.interpolate`${configTable.arn}/index/*`,
        ]
    }],
});

new aws.iam.RolePolicy('OrderServiceDynamoPolicy', {
    role: orderServiceLambdaRole.id,
    policy: orderServiceRolePolicy.json
});

new aws.iam.RolePolicy('PaymentServiceDynamoPolicy', {
    role: paymentServiceLambdaRole.id,
    policy: paymentServiceRolePolicy.json
});

const api = new aws.apigatewayv2.Api('OrdersApi', {
    protocolType: 'HTTP'
});

const orderHandler = new aws.lambda.Function("OrderHandler", {
    runtime: aws.lambda.Runtime.NodeJS20dX,
    handler: 'handler.handler',
    role: orderServiceLambdaRole.arn,
    code: new pulumi.asset.FileArchive(
        path.join(__dirname, '../packages/order-service/dist/lambda')
    ),
    environment: {
        variables: {
            ORDER_TABLE_NAME: ordersTable.name,
            PAYMENT_SERVICE_BASE_URL: pulumi.interpolate`${api.apiEndpoint}`
        }
    },
    timeout: 10,
    memorySize: 256
});

const paymentHandler = new aws.lambda.Function("PaymentHandler", {
    runtime: aws.lambda.Runtime.NodeJS20dX,
    handler: 'handler.handler',
    role: paymentServiceLambdaRole.arn,
    code: new pulumi.asset.FileArchive(
        path.join(__dirname, '../packages/payment-service/dist/lambda')
    ),
    environment: {
        variables: {
            ORDER_TABLE_NAME: ordersTable.name,
            CONFIG_TABLE_NAME: configTable.name

        }
    },
    timeout: 10,
    memorySize: 256
});

const orderIntegration = new aws.apigatewayv2.Integration('OrdersIntegration', {
    apiId: api.id,
    integrationType: 'AWS_PROXY',
    integrationUri: orderHandler.invokeArn,
    payloadFormatVersion: '2.0'
});

new aws.apigatewayv2.Route('OrderCreateRoute', {
    apiId: api.id,
    routeKey: 'POST /orders',
    target: pulumi.interpolate`integrations/${orderIntegration.id}`
});

new aws.apigatewayv2.Route('OrderGetRoute', {
    apiId: api.id,
    routeKey: 'GET /customers/{customerId}/orders/{orderId}',
    target: pulumi.interpolate`integrations/${orderIntegration.id}`
});

new aws.apigatewayv2.Route('OrderListForCustomerRoute', {
    apiId: api.id,
    routeKey: 'GET /customers/{customerId}/orders',
    target: pulumi.interpolate`integrations/${orderIntegration.id}`
});

const paymentIntegration = new aws.apigatewayv2.Integration('PaymentIntegration', {
    apiId: api.id,
    integrationType: 'AWS_PROXY',
    integrationUri: paymentHandler.invokeArn,
    payloadFormatVersion: '2.0'
});

new aws.apigatewayv2.Route('PaymentRoute', {
    apiId: api.id,
    routeKey: 'POST /payments/{customerId}',
    target: pulumi.interpolate`integrations/${paymentIntegration.id}`
});

new aws.apigatewayv2.Stage("OrdersStage", {
    apiId: api.id,
    name: '$default',
    autoDeploy: true
})

new aws.lambda.Permission('OrderApiPermission', {
    action: 'lambda:InvokeFunction',
    function: orderHandler.name,
    principal: 'apigateway.amazonaws.com',
    sourceArn: pulumi.interpolate`${api.executionArn}/*/*`
});

new aws.lambda.Permission('PaymentApiPermission', {
    action: 'lambda:InvokeFunction',
    function: paymentHandler.name,
    principal: 'apigateway.amazonaws.com',
    sourceArn: pulumi.interpolate`${api.executionArn}/*/*`
});

export const apiUrl = pulumi.interpolate`${api.apiEndpoint}`;
export const tableName = ordersTable.name;
