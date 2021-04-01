import {ConnectionManager, ConnectionRepository,Message, MessageTarget, ConnectionMessageTarget,UserMessageTarget, BroadcastMessageTarget, User} from './wsconn';
import {Result, Ok, Err} from './monad';

class WelcomeMessage implements Message<ConnectionMessageTarget>{
    public readonly type = 'WelcomeMessage';
    constructor(public readonly target: ConnectionMessageTarget){}
    
    toJsonString():string {
        return JSON.stringify({
            type: this.type,
            message: `ようこそチャットルームへ!!`
        });
    }
}

class JoinMessage implements Message<BroadcastMessageTarget>{
    public readonly type = 'JoinMessage';
    public readonly target: BroadcastMessageTarget = new BroadcastMessageTarget()
    
    constructor(private readonly userId: string, private readonly currentUsers: Array<string>){}
    
    toJsonString():string{
        return JSON.stringify({
            type: this.type,
            message: `${this.userId}さんが入室しました。あいさつしまししょう。`,
            currentUsers: this.currentUsers
        })
    }
}

class LeaveMessage implements Message<BroadcastMessageTarget>{
    public readonly type = 'LeaveMessage' as const;
    public readonly target: BroadcastMessageTarget = new BroadcastMessageTarget()
    
    constructor(private readonly userId: string, private readonly currentUsers: Array<string>){}

    toJsonString():string{
        return JSON.stringify({
            type: this.type,
            message: `${this.userId}さんが退出しました。`,
            currentUsers: this.currentUsers 
        })
    }
}

class RoomMessage implements Message<BroadcastMessageTarget>{
    public readonly type = 'RoomMessage' as const;
    public readonly target: BroadcastMessageTarget = new BroadcastMessageTarget()
    
    constructor(private readonly from: string, private readonly message: string){}
    
    toJsonString():string{
        return JSON.stringify({
            type: this.type,
            from: this.from,
            message: this.message, 
        })
    }
}

class DirectMessage implements Message<UserMessageTarget>{
    public readonly type = 'DirectMessage' as const;
    
    constructor(public readonly target: UserMessageTarget, public readonly from: string, public readonly message: string){}
    
    toJsonString():string{
        return JSON.stringify({
            type: this.type,
            to: this.target.userId,
            from: this.from,
            message: this.message, 
        })
    }
}

class UserlistResponseMessage implements Message<ConnectionMessageTarget>{
    public readonly type = 'UserlistResponseMessage' as const;
    
    constructor(public readonly target: ConnectionMessageTarget, private userIds: Array<string>){}
    
    toJsonString():string{
        return JSON.stringify({
            type: this.type,
            userIds: this.userIds
        })
    }
}


export type ChatAction = RoomMessageAction | DirectMessageAction | UserlistRequestAction;

export interface RoomMessageAction{
    type: 'RoomMessage',
    payload: {
        message: string
    }
} 

export interface DirectMessageAction{
    type: 'DirectMessage',
    payload: {
        to: string
        message: string
    }
}


export interface UserlistRequestAction{
    type: 'UserlistRequest' 
}


export class ChatApplication{
    constructor(private readonly manager: ConnectionManager<ConnectionRepository, MessageTarget>){}
    
    async onConnect(connectionId: string, userId: string): Promise<Array<Result<void, Error>>>{
        const currentUsers = await this.manager.uniqueUserIds();
        const handleConnectResult = await this.manager.handleConnect({id: connectionId, user: {id: userId}});
        
        if(handleConnectResult.isErr()) return [handleConnectResult];
        
        const welcomMessageResult = await this.manager.sendMessage(new WelcomeMessage(new ConnectionMessageTarget(connectionId)));
        const joinMessageResult =  currentUsers.includes(userId) ? [] : await this.manager.sendMessage(new JoinMessage(userId, [...currentUsers, userId]));
        
        return [...welcomMessageResult, ...joinMessageResult];
    }
    
    async onDisconnect(connectionId: string): Promise<Array<Result<void, Error>>>{
        const userOfConnection = await this.resolveUserOfConnection(connectionId);
        if(userOfConnection.isErr()) return [ new Err(userOfConnection.value) ];
        
        
        const handleDisconnectResult =  await this.manager.handleDisconnect(connectionId);
        if(handleDisconnectResult.isErr()) return [handleDisconnectResult];
        
        const currentUsers = await this.manager.uniqueUserIds();
        
        const user = userOfConnection.value;
        if(!currentUsers.includes(user.id)){
            return await this.manager.sendMessage(new LeaveMessage(user.id, currentUsers));
        }else{
            return [new Ok(undefined)];
        }
    }
    
    async onChatAction(connectionId: string, action: ChatAction): Promise<Array<Result<void, Error>>>{
        if(action.type === 'RoomMessage'){
            return this.onRoomMessageAction(connectionId, action);
        }else if(action.type === 'DirectMessage'){
            return this.onDirectMessageAction(connectionId, action);
        }else if(action.type === 'UserlistRequest'){
            return this.onUserlistRequestAction(connectionId);
        }
        
        return [new Err(new Error(`Invalid action:${JSON.stringify(action)}`))];
    }
    
    async onRoomMessageAction(connectionId:string, action: RoomMessageAction): Promise<Array<Result<void, Error>>>{
        const userOfConnection = await this.resolveUserOfConnection(connectionId);
        if(userOfConnection.isErr()) return [ new Err(userOfConnection.value) ];
        
        return this.manager.sendMessage(new RoomMessage(userOfConnection.value.id, action.payload.message));
    }
    
    async onDirectMessageAction(connectionId: string, action: DirectMessageAction): Promise<Array<Result<void, Error>>>{
        const userOfConnection = await this.resolveUserOfConnection(connectionId);
        if(userOfConnection.isErr()) return [ new Err(userOfConnection.value) ];
        
        return this.manager.sendMessage(new DirectMessage(new UserMessageTarget(action.payload.to) ,userOfConnection.value.id, action.payload.message));
    }
    
    async onUserlistRequestAction(connectionId: string): Promise<Array<Result<void, Error>>>{
        const currentUsers = await this.manager.uniqueUserIds();
        return this.manager.sendMessage(new UserlistResponseMessage(new ConnectionMessageTarget(connectionId), currentUsers));
    }
    
    
    private async resolveUserOfConnection(connectionId: string): Promise<Result<User, Error>>{
        const userOfConnection = await this.manager.resolveUserOf(connectionId);
        return userOfConnection.isSome() ? new Ok(userOfConnection.value) : new Err(new Error(`User of "${connectionId}" is not found`));
    }
}