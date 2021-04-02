export * from './wsconn';
export * from './monad';
export * from './chatapp';

import {ChatApplication} from './chatapp';
import {ConnectionManager} from './wsconn';
import {apiGatewaySendMessageFunction, DynamoDBConnectionRepositoryImpl} from './impl';

import {DynamoDB, ApiGatewayManagementApi} from 'aws-sdk';

export interface ChatApplicationProps{
    connectionTableName: string,
    useridIndexName:string,
    websocketEndpoint: string
}

export function createChatApp(props: ChatApplicationProps): ChatApplication{
    const manager = new ConnectionManager(
        new DynamoDBConnectionRepositoryImpl(new DynamoDB.DocumentClient(), props.connectionTableName, props.useridIndexName),
        apiGatewaySendMessageFunction(new ApiGatewayManagementApi({endpoint: props.websocketEndpoint}))
    );
    
    return new ChatApplication(manager);
}