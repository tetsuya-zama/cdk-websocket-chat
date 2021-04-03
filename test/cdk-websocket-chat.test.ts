import '@aws-cdk/assert/jest';
import * as cdk from '@aws-cdk/core';
import * as CdkWebsocketChat from '../lib/cdk-websocket-chat-stack';

test('Websocket chat Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new CdkWebsocketChat.CdkWebsocketChatStack(app, 'MyTestStack');
    // THEN
    expect(stack).toHaveResourceLike('AWS::DynamoDB::Table', {
      "KeySchema": [
        {
          "AttributeName": "h_key",
          "KeyType": "HASH"
        },
        {
          "AttributeName": "s_key",
          "KeyType": "RANGE"
        }
      ],
      "AttributeDefinitions": [
        {
          "AttributeName": "h_key",
          "AttributeType": "S"
        },
        {
          "AttributeName": "s_key",
          "AttributeType": "S"
        },
        {
          "AttributeName": "user_id",
          "AttributeType": "S"
        }
      ],
      "BillingMode": "PAY_PER_REQUEST",
      "GlobalSecondaryIndexes": [
        {
          "IndexName": "user_id_idx",
          "KeySchema": [
            {
              "AttributeName": "user_id",
              "KeyType": "HASH"
            }
          ],
          "Projection": {
            "ProjectionType": "ALL"
          }
        }
      ]
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::Api', {
      "Name": "chat-ws-api",
      "ProtocolType": "WEBSOCKET",
      "RouteSelectionExpression": "$request.body.action"
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::Route', {
      "RouteKey": "$connect"
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::Route', {
      "RouteKey": "$disconnect"
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::Route', {
      "RouteKey": "$default"
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::Route', {
      "RouteKey": "roommessage"
    });

    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::Route', {
      "RouteKey": "directmessage"
    });
    
    expect(stack).toHaveResourceLike('AWS::ApiGatewayV2::Route', {
      "RouteKey": "userlistrequest"
    });

    expect(stack).toHaveResourceLike('AWS::Lambda::Function')
});
