import {ConnectionManager, resolveMessageTarget, MessageTarget, Message, ConnectionMessageTarget, UserMessageTarget, BroadcastMessageTarget} from '../../lib/app/wsconn';
import { Ok } from '../../lib/app/monad';
import {ConnectionRepositoryMock} from './mock';


describe('resolveMessageTarget', () => {
    it('resolves every MessageTargets to ConnectionMessageTarget', async () => {
        const mockRepo = new ConnectionRepositoryMock(
            [
                {id: 'conn1', user:{id: 'user1'}},
                {id: 'conn2', user:{id: 'user2'}},
                {id: 'conn3', user:{id: 'user2'}},
            ]
        );
        
        const targetFunc = resolveMessageTarget(mockRepo);
        
        const conn2conn = await targetFunc(new ConnectionMessageTarget('conn3'));
        expect(conn2conn.length).toBe(1);
        expect(conn2conn[0].connectionId).toBe('conn3');
        
        const user2conn = await targetFunc(new UserMessageTarget('user2'));
        expect(user2conn.length).toBe(2);
        expect(user2conn.some(target => target.connectionId === 'conn2')).toBeTruthy();
        expect(user2conn.some(target => target.connectionId === 'conn3')).toBeTruthy();
        
        const broadcast2conn =  await targetFunc(new BroadcastMessageTarget());
        expect(broadcast2conn.length).toBe(3);
        expect(broadcast2conn.some(target => target.connectionId === 'conn1')).toBeTruthy();
        expect(broadcast2conn.some(target => target.connectionId === 'conn2')).toBeTruthy();
        expect(broadcast2conn.some(target => target.connectionId === 'conn3')).toBeTruthy();
    })
});

class SimpleMessage implements Message<MessageTarget>{
    readonly type = 'SimpleMessage' as const
    constructor(public readonly target: MessageTarget){}
    
    toJsonString(){
        return JSON.stringify({
            message: `dummy message to ${JSON.stringify(this.target)}`
        })
    }
}

describe('ConnectionManager', () => {
    test('handle connect/disconnect', async()=>{
        const mockRepo = new ConnectionRepositoryMock();
        const sendMessageFunc = jest.fn();
        
        const manager = new ConnectionManager(mockRepo, sendMessageFunc);
        
        let res = await manager.handleConnect({id: 'conn1', user: {id: 'user1'}});
        expect(res.isOk()).toBeTruthy();
        
        res = await manager.handleConnect({id: 'conn1', user: {id: 'user2'}}); //Same Conn ID
        expect(res.isErr()).toBeTruthy();
        
        res = await manager.handleDisconnect('conn1');
        expect(res.isOk()).toBeTruthy();
        
        res = await manager.handleDisconnect('conn1'); // Already disconnected
        expect(res.isErr()).toBeTruthy();
    });
    
    test('sending message', async() => {
        const mockRepo = new ConnectionRepositoryMock(
            [
                {id: 'conn1', user:{id: 'user1'}},
                {id: 'conn2', user:{id: 'user2'}},
                {id: 'conn3', user:{id: 'user2'}},
            ]
        );
        const sendMessageFunc = jest.fn().mockResolvedValue(new Ok(undefined));
        
        const manager = new ConnectionManager(mockRepo, sendMessageFunc);
        
        const message = new SimpleMessage(new BroadcastMessageTarget());
        
        const result = await manager.sendMessage(message);
        
        expect(result.length).toBe(3);
        expect(result.every(r => r.isOk())).toBeTruthy();
        
        expect(sendMessageFunc.mock.calls.length).toBe(3);
        expect(sendMessageFunc).toHaveBeenCalledWith('conn1', message.toJsonString());
        expect(sendMessageFunc).toHaveBeenCalledWith('conn2', message.toJsonString());
        expect(sendMessageFunc).toHaveBeenCalledWith('conn3', message.toJsonString());
    });
    
    test('resolving user of conn', async() => {
        const mockRepo = new ConnectionRepositoryMock(
            [
                {id: 'conn1', user:{id: 'user1'}},
                {id: 'conn2', user:{id: 'user2'}},
                {id: 'conn3', user:{id: 'user2'}},
            ]
        );
        const sendMessageFunc = jest.fn();
        
        const manager = new ConnectionManager(mockRepo, sendMessageFunc);
        
        let res = await manager.resolveUserOf('conn1');
        expect(res.unwrap()?.id).toBe('user1');
        res = await manager.resolveUserOf('conn2');
        expect(res.unwrap()?.id).toBe('user2');
        res = await manager.resolveUserOf('conn3');
        expect(res.unwrap()?.id).toBe('user2');
        res = await manager.resolveUserOf('conn4'); //connection does not exists
        expect(res.isNone()).toBeTruthy();
        
    });
    
    test('fetching unique user ids', async() => {
        const mockRepo = new ConnectionRepositoryMock(
            [
                {id: 'conn1', user:{id: 'user1'}},
                {id: 'conn2', user:{id: 'user2'}},
                {id: 'conn3', user:{id: 'user2'}},
            ]
        );
        const sendMessageFunc = jest.fn();
        
        const manager = new ConnectionManager(mockRepo, sendMessageFunc);
        
        const res = await manager.uniqueUserIds();
        expect(res.length).toBe(2);
        expect(res).toContain('user1');
        expect(res).toContain('user2');
    })
})