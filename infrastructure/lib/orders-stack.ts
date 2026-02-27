import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as path from "path";

export class OrdersStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        new dynamodb.Table(this, 'OrderSampleTable', {
            tableName: 'Orders',
            partitionKey: {
                name: 'PK',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'SK',
                type: dynamodb.AttributeType.STRING
            }
        });

        const ordersFn = new lambda.NodejsFunction(this, 'OrdersApiFunction', {
            entry: path.join(__dirname, '../../packages/order-service/src/handler.ts'),
            handler: 'handler',
            runtime: Runtime.NODEJS_20_X
        });

        const api = new apigateway.LambdaRestApi(this, 'OrdersApi', {
            handler: ordersFn,
            proxy: false
        });

        // Orders endpoints
        const ordersResource = api.root.addResource('orders');
        ordersResource.addMethod('post');

        const customersResource = api.root.addResource('customers');
        const customerResource = customersResource.addResource('{customer_id}');
        const customerOrdersResource = customerResource.addResource('orders');
        customerOrdersResource.addMethod('get');

        const customerOrderResource = customerOrdersResource.addResource('{order_id}');
        customerOrderResource.addMethod('get');

        // Payments endpoints
        const paymentsFn = new lambda.NodejsFunction(this, 'PaymentsApiFunction', {
            entry: path.join(__dirname, '../../packages/payment-service/src/handler.ts'),
            handler: 'handler',
            runtime: Runtime.NODEJS_20_X
        });

        const paymentsResource = api.root.addResource('payments', {
            defaultIntegration: new apigateway.LambdaIntegration(paymentsFn)
        });

        paymentsResource
            .addResource('{order_id}')
            .addMethod('get');
    }
}
