import {createChatApp, ChatApplicationProps, Result, Ok, Err} from './app';
import {APIGatewayProxyEventBase, APIGatewayProxyResult} from 'aws-lambda';

type WebsocketEvent = APIGatewayProxyEventBase<{}>

function parsePropsFromEnvs(): Result<ChatApplicationProps, Error>{
    const CONNECTION_TABLE_NAME = process.env['CONNECTION_TABLE_NAME'];
    const USERID_INDEX_NAME = process.env['USERID_INDEX_NAME'];
    const WEBSOCKET_ENDPOINT = process.env['WEBSOCKET_ENDPOINT'];
    
    if(!!CONNECTION_TABLE_NAME && !!USERID_INDEX_NAME && !!WEBSOCKET_ENDPOINT){
        return new Ok({
            connectionTableName: CONNECTION_TABLE_NAME,
            useridIndexName:USERID_INDEX_NAME,
            websocketEndpoint: WEBSOCKET_ENDPOINT
        });
    }else{
        return new Err(new Error('Environment Variables "CONNECTION_TABLE_NAME","USERID_INDEX_NAME","WEBSOCKET_ENDPOINT", are required'));
    }
}

export const onConnectHandler = async (event: WebsocketEvent):Promise<APIGatewayProxyResult> => {
    const appResult = parsePropsFromEnvs().map(props => createChatApp(props));
    
    if(appResult.isErr()) throw appResult.value;
    const app = appResult.value;
    
    const connectionId = event.requestContext.connectionId;
    const user = event.queryStringParameters?.user;
    
    if(!!connectionId && !!user){
        const results = await app.onConnect(connectionId, user);
        results.filter((r): r is Err<void, Error> => r.isErr()).forEach(err => console.error(err.value));

        return {statusCode: 200, body: ""}
    }else{
        console.error('Invalid Connect Event');
        console.error(JSON.stringify(event));

        return {statusCode: 500, body: ""}
    }
    
}

export const onDisconnectHandler = async (event: WebsocketEvent): Promise<APIGatewayProxyResult> => {
    const appResult = parsePropsFromEnvs().map(props => createChatApp(props));
    
    if(appResult.isErr()) throw appResult.value;
    const app = appResult.value;
    
    const connectionId = event.requestContext.connectionId;
    
    if(!!connectionId){
        const results = await app.onDisconnect(connectionId);
        results.filter((r): r is Err<void, Error> => r.isErr()).forEach(err => console.error(err.value));

        return {statusCode:200, body:""}
    }else{
        console.error('Invalid Disconnect Event');
        console.error(JSON.stringify(event));

        return {statusCode:500, body:""}
    }
}

interface RoomMessageBody {
    data: {
        message: string
    }
}

function isRoomMessageBody(obj: any): obj is RoomMessageBody{
    return !!obj.data && !!obj.data.message && typeof obj.data.message === 'string';
}

interface DirectMessageBody {
    data: {
        message: string,
        to: string
    }
}

function isDirectMessageBody(obj: any): obj is DirectMessageBody{
    return !!obj.data 
        && !!obj.data.message && typeof obj.data.message === 'string'
        && !!obj.data.to && typeof obj.data.to === 'string';
}

function parseBody<T>(event: WebsocketEvent, typeGuard: (obj:any) => obj is T): Result<T, Error>{
    if(!event.body) return new Err(Error('Cannot parse empty request body.'));
    
    const body = JSON.stringify(event.body);
    
    return typeGuard(body) ? new Ok(body) : new Err(new Error(`Cannot parse request body:${body}`));
}

export const roomMessageHandler = async (event: WebsocketEvent):Promise<APIGatewayProxyResult> =>{
    const appResult = parsePropsFromEnvs().map(props => createChatApp(props));
    
    if(appResult.isErr()) throw appResult.value;
    const app = appResult.value;
    
    const parseBodyResult = parseBody(event, isRoomMessageBody);
    const connectionId = event.requestContext.connectionId;
    
    if(parseBodyResult.isOk() && !!connectionId){
        const results = await app.onChatAction(connectionId, {type:"RoomMessage", payload: parseBodyResult.value.data});
        results.filter((r): r is Err<void, Error> => r.isErr()).forEach(err => console.error(err.value));

        return {statusCode:200, body:""}
    }else{
        console.error('Invalid room message Event');
        console.error(JSON.stringify(event));
        if(parseBodyResult.isErr()) console.error(parseBodyResult.value);

        return {statusCode: 500, body: ""}
    }
} 

export const directMessageHandler = async (event: WebsocketEvent): Promise<APIGatewayProxyResult> =>{
    const appResult = parsePropsFromEnvs().map(props => createChatApp(props));
    
    if(appResult.isErr()) throw appResult.value;
    const app = appResult.value;
    
    const parseBodyResult = parseBody(event, isDirectMessageBody);
    const connectionId = event.requestContext.connectionId;
    
    if(parseBodyResult.isOk() && !!connectionId){
        const results = await app.onChatAction(connectionId, {type:"DirectMessage", payload: parseBodyResult.value.data});
        results.filter((r): r is Err<void, Error> => r.isErr()).forEach(err => console.error(err.value));

        return {statusCode:200, body:""}
    }else{
        console.error('Invalid direct message Event');
        console.error(JSON.stringify(event));
        if(parseBodyResult.isErr()) console.error(parseBodyResult.value);

        return {statusCode:500,body:""}
    }
}

export const userListRequestHandler = async (event: WebsocketEvent): Promise<APIGatewayProxyResult> => {
    const appResult = parsePropsFromEnvs().map(props => createChatApp(props));
    
    if(appResult.isErr()) throw appResult.value;
    const app = appResult.value;
    
    const connectionId = event.requestContext.connectionId;
    
    if(!!connectionId){
        const results = await app.onChatAction(connectionId, {type: "UserlistRequest"});
        results.filter((r): r is Err<void, Error> => r.isErr()).forEach(err => console.error(err.value));

        return {statusCode:200, body:""}
    }else{
        console.error('Invalid Disconnect Event');
        console.error(JSON.stringify(event));

        return {statusCode:500, body:""}
    }
}


