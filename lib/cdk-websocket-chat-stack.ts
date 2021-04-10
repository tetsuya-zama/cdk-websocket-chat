import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as lmd from '@aws-cdk/aws-lambda';
import * as lmdjs from '@aws-cdk/aws-lambda-nodejs';
import * as apigw from '@aws-cdk/aws-apigatewayv2';
import * as iam from '@aws-cdk/aws-iam';
import * as watch from '@aws-cdk/aws-cloudwatch';
import {LambdaWebSocketIntegration} from '@aws-cdk/aws-apigatewayv2-integrations';
import { RemovalPolicy } from '@aws-cdk/core';
import { GraphWidget } from '@aws-cdk/aws-cloudwatch';

export type StageName = 'unittest' | 'local' | 'staging' | 'e2e' | 'prod' 
export interface CdkWebsocketChatStackProps extends cdk.StackProps{
  stage: StageName
}

export class CdkWebsocketChatStack extends cdk.Stack {
  public readonly webScoketEndpoint: string;

  constructor(scope: cdk.Construct, id: string, props: CdkWebsocketChatStackProps) {
    super(scope, id, props);

    const connectionTable = new dynamodb.Table(this, 'connection-table', {
      partitionKey: {name: "h_key", type: dynamodb.AttributeType.STRING},
      sortKey: {name: "s_key", type: dynamodb.AttributeType.STRING},
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: props.stage === 'e2e' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN
    });

    const useridIdxName = "user_id_idx";
    connectionTable.addGlobalSecondaryIndex({
      indexName: useridIdxName,
      partitionKey: {name: "user_id", type: dynamodb.AttributeType.STRING}
    });

    const websocketApi = new apigw.WebSocketApi(this, 'chat-ws-api', {routeSelectionExpression: '$request.body.action'});
    const websocketPostPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [`arn:aws:execute-api:${this.region}:${this.account}:${websocketApi.apiId}/${props.stage}/POST/@connections/*`],
      actions: ["execute-api:ManageConnections"]
    });

    const lmdEnvironments = {
      CONNECTION_TABLE_NAME: connectionTable.tableName,
      USERID_INDEX_NAME: useridIdxName
    }

    const onConnect = new lmdjs.NodejsFunction(this, 'on-connect', {
      entry: "./lib/handlers.ts",
      handler: "onConnectHandler",
      tracing: (props.stage === 'prod' || props.stage === 'staging' || props.stage === 'e2e') ? lmd.Tracing.ACTIVE : lmd.Tracing.DISABLED,
      environment: lmdEnvironments
    });

    onConnect.addToRolePolicy(websocketPostPolicy);
    connectionTable.grantReadWriteData(onConnect);

    const onDisconnect = new lmdjs.NodejsFunction(this, 'on-disconnect', {
      entry: "lib/handlers.ts",
      handler: "onDisconnectHandler",
      environment: lmdEnvironments
    });

    onDisconnect.addToRolePolicy(websocketPostPolicy);
    connectionTable.grantReadWriteData(onDisconnect);

    const onRoomMessage = new lmdjs.NodejsFunction(this, 'on-room-message', {
      entry: "lib/handlers.ts",
      handler: "roomMessageHandler",
      environment: lmdEnvironments
    });

    onRoomMessage.addToRolePolicy(websocketPostPolicy);
    connectionTable.grantReadData(onRoomMessage);

    const onDirectMessage = new lmdjs.NodejsFunction(this, 'on-direct-message', {
      entry: "lib/handlers.ts",
      handler: "directMessageHandler",
      environment: lmdEnvironments
    });

    onDirectMessage.addToRolePolicy(websocketPostPolicy);
    connectionTable.grantReadData(onDirectMessage);

    const onUserlistRequest = new lmdjs.NodejsFunction(this, 'on-userlist-request', {
      entry: "lib/handlers.ts",
      handler: "userListRequestHandler",
      environment: lmdEnvironments
    });

    onUserlistRequest.addToRolePolicy(websocketPostPolicy);
    connectionTable.grantReadData(onUserlistRequest);

    websocketApi.addRoute('$connect', {
      integration: new LambdaWebSocketIntegration({handler: onConnect})
    });
    websocketApi.addRoute('$disconnect', {
      integration: new LambdaWebSocketIntegration({handler: onDisconnect})
    });
    websocketApi.addRoute('$default', {
      integration: new LambdaWebSocketIntegration({handler: onUserlistRequest})
    });
    websocketApi.addRoute('roommessage', {
      integration: new LambdaWebSocketIntegration({handler: onRoomMessage})
    });
    websocketApi.addRoute('directmessage', {
      integration: new LambdaWebSocketIntegration({handler: onDirectMessage})
    });
    websocketApi.addRoute('userlistrequest', {
      integration: new LambdaWebSocketIntegration({handler: onUserlistRequest})
    });

    const currentStage = new apigw.WebSocketStage(this, props.stage, {
      stageName: props.stage,
      webSocketApi: websocketApi,
      autoDeploy: true
    });

    this.webScoketEndpoint = `${websocketApi.apiEndpoint}/${props.stage}`;

    if(props.stage === 'prod' || props.stage === 'staging'){
      const dashboard = new watch.Dashboard(this, `wabchatdashboard`, {
        dashboardName: `webchat-${props.stage}`,
      });

      dashboard.addWidgets(
        new GraphWidget({
          title: 'connect count',
          left: [currentStage.metric('ConnectCount', {region:""})]
        })
      );
      dashboard.addWidgets(
        new GraphWidget({
          title: 'message count',
          left: [currentStage.metric('MessageCount')]
        })
      );
      dashboard.addWidgets(
        new GraphWidget({
          title: 'latency',
          left: [currentStage.metric('IntegrationLatency')]
        })
      );
      dashboard.addWidgets(
        new GraphWidget({
          title: 'errors',
          left: [currentStage.metric('IntegrationLatency')],
          right: [currentStage.metric('ClientError')]
        })
      );
    }
  }
}
