import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { OrdersStack } from "../lib/orders-stack";

const app = new cdk.App();

new OrdersStack(app, "OrdersStack", {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT ?? '000000000000',
        region: process.env.CDK_DEFAULT_REGION ?? 'eu-west-1'
    }
});
