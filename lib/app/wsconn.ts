import {Optional, Result} from './monad';

export interface Connection{
    id: string,
    user: User
}

export interface User {
    id: string
}

export interface ConnectionRepository{
    findById(connectionId: string): Promise<Optional<Connection>>
    findByUserId(userId: string): Promise<Array<Connection>>
    findAll(): Promise<Array<Connection>>
    save(connection: Connection): Promise<Result<void, Error>>
    remove(connectionId: string): Promise<Result<void, Error>>
}

export type SendMessageFunction = (connectionId: string, messageText: string) => Result<void, Error>;


export interface Message<TARGET_TYPES> {
    type: string,
    target: TARGET_TYPES
    toJsonString: () => string
}

export type MessageTarget = ConnectionMessageTarget | UserMessageTarget | BroadcastMessageTarget;

export class ConnectionMessageTarget{
    constructor(public readonly connectionId: string){}
}

export class UserMessageTarget{
    constructor(public readonly userId: string){}
}

export class BroadcastMessageTarget{
    constructor(){}
}

export type ResolveMessageTargetFunction<REPO_TYPE, TARGET_TYPES> = (repo: REPO_TYPE) => (target: TARGET_TYPES) => Promise<Array<ConnectionMessageTarget>>;

export const resolveMessageTarget: ResolveMessageTargetFunction<ConnectionRepository, MessageTarget> = (repo: ConnectionRepository) => async(target: MessageTarget) => {
    if(target instanceof UserMessageTarget){
        const connections = await repo.findByUserId(target.userId);
        return connections.map(conn => new ConnectionMessageTarget(conn.id));
    }else if(target instanceof BroadcastMessageTarget){
        const connections = await repo.findAll();
        return connections.map(conn => new ConnectionMessageTarget(conn.id));
    }
    
    return [target];
}

export class ConnectionManager<REPO_TYPE extends ConnectionRepository, TARGET_TYPES>{
    private resolveMessageTarget: ReturnType<ResolveMessageTargetFunction<REPO_TYPE, TARGET_TYPES>>;
    
    constructor(
        private repository: ConnectionRepository,
        private sendMessageFunc: SendMessageFunction,
        resolveMessageTargetFunc: ResolveMessageTargetFunction<ConnectionRepository | REPO_TYPE, TARGET_TYPES> = resolveMessageTarget
    ){
        this.resolveMessageTarget = resolveMessageTargetFunc(repository);
    }
    
    async handleConnect(connection: Connection): Promise<Result<void, Error>>{
        return this.repository.save(connection);
    }
    
    async handleDisconnect(connectionId: string): Promise<Result<void, Error>>{
        return this.repository.remove(connectionId);
    }
    
    async sendMessage(message: Message<TARGET_TYPES>): Promise<Array<Result<void, Error>>>{
        const connectionTargets = await this.resolveMessageTarget(message.target);
        
        return await Promise.all(connectionTargets.map(target => this.sendMessageFunc(target.connectionId, message.toJsonString())));
    }
    
    async resolveUserOf(connectionId: string): Promise<Optional<User>>{
        return (await this.repository.findById(connectionId)).map(conn => conn.user);
    }
    
    async uniqueUserIds(): Promise<Array<string>>{
        const connections = await this.repository.findAll();
        return [...new Set(connections.map(con => con.user.id))];
    }
}