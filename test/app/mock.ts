import {ConnectionRepository, Connection} from '../../lib/app/wsconn';
import {Result, Ok, Err, Optional, Some, None} from '../../lib/app/monad';

export class ConnectionRepositoryMock implements ConnectionRepository{
    constructor(private list: Array<Connection> = []){}
    
    async findById(connectionId: string): Promise<Optional<Connection>>{
        const result = this.list.find(con => con.id === connectionId);
        return !!result ? new Some(result) : new None();
    }
    async findByUserId(userId: string): Promise<Array<Connection>>{
        return this.list.filter(con => con.user.id === userId);
    }
    async findAll(): Promise<Array<Connection>>{
        return this.list;
    }
    async save(connection: Connection): Promise<Result<void, Error>>{
        if((await this.findById(connection.id)).isSome()){
            return new Err(new Error(`Duplicate connection id: ${connection.id}`));
        }
        
        this.list = [...this.list, connection];
        
        return new Ok(undefined);
    }
    async remove(connectionId: string): Promise<Result<void, Error>>{
        if((await this.findById(connectionId)).isNone()){
            return new Err(new Error(`You can not remove invalid id: ${connectionId}`));
        }
        
        this.list = this.list.filter(con => con.id !== connectionId);
        
        return new Ok(undefined);
    }
}