import {ApiGatewayManagementApi, DynamoDB} from 'aws-sdk';

import {Result, Ok, Err, Optional, Some, None} from './monad';
import {SendMessageFunction, ConnectionRepository, Connection} from './wsconn';

export const apiGatewaySendMessageFunction: (managementApi: ApiGatewayManagementApi) => SendMessageFunction 
    = (managementApi) => async(connectionId: string, messageText: string):Promise<Result<void, Error>> => {
        try{
            await managementApi.postToConnection({
                ConnectionId: connectionId,
                Data: messageText
            }).promise();
            
            return new Ok(undefined);
        }catch(e){
            return new Err(e);
        }
    }
    
export class DynamoDBConnectionRepositoryImpl implements ConnectionRepository{
    private readonly client: DynamoDB.DocumentClient;
    constructor(private readonly tableName: string, private readonly useridIdxName: string){
        this.client = new DynamoDB.DocumentClient();
    }
    
    private parseItem(item: {[key:string]: any}): Connection{
        return {
            id: item['h_key'],
            user: {
                id: item['user_id']
            }
        };
    }
    
    async findById(connectionId: string): Promise<Optional<Connection>>{
        const res = await this.client.get({
            TableName: this.tableName,
            Key: {
                'h_key': connectionId,
                's_key': connectionId
            }
        }).promise();
        
        return !res?.Item ? new None() : new Some(this.parseItem(res.Item));
    }
    async findByUserId(userId: string): Promise<Array<Connection>>{
        const res = await this.client.query({
            TableName: this.tableName,
            IndexName: this.useridIdxName,
            KeyConditionExpression: 'user_id = :uid',
            ExpressionAttributeValues: {
                ':uid': userId
            }
        }).promise();
        
        return !res?.Items ? [] : res.Items.map(item => this.parseItem(item));
    }
    
    async findAll(): Promise<Array<Connection>>{
        const res = await this.client.scan({
            TableName: this.tableName
        }).promise();
        
        return !res?.Items ? [] : res.Items.map(item => this.parseItem(item));
    }
    async save(connection: Connection): Promise<Result<void, Error>>{
        try{
            await this.client.put({
                TableName: this.tableName,
                Item: {
                    'h_key': connection.id,
                    's_key': connection.id,
                    'user_id': connection.user.id
                }
            }).promise();
            
            return new Ok(undefined);
        }catch(e){
            return new Err(e);
        }
    }
    
    async remove(connectionId: string): Promise<Result<void, Error>>{
        try{
            await this.client.delete({
                TableName: this.tableName,
                Key: {
                    'h_key': connectionId,
                    's_key': connectionId
                }
            }).promise();
            
            return new Ok(undefined);
        }catch(e){
            return new Err(e);
        }
    }
}