import {ChatApplication} from '../../lib/app/chatapp';
import {ConnectionManager, resolveMessageTarget, MessageTarget, Message, ConnectionMessageTarget, UserMessageTarget, BroadcastMessageTarget} from '../../lib/app/wsconn';
import { Ok } from '../../lib/app/monad';
import {ConnectionRepositoryMock} from './mock';

describe('ChatApplication', () => {
    test('new user connection handling', async() => {
        const mockRepo = new ConnectionRepositoryMock(
            [
                {id: 'conn1', user:{id: 'user1'}},
                {id: 'conn2', user:{id: 'user2'}},
                {id: 'conn3', user:{id: 'user2'}},
            ]
        );
        const sendMessageFunc = jest.fn().mockResolvedValue(new Ok(undefined));
        
        const manager = new ConnectionManager(mockRepo, sendMessageFunc);
        
        const app = new ChatApplication(manager);
        
        let res = await app.onConnect('conn4', 'user3'); //new connection and new user
        expect(res.every(r => r.isOk())).toBeTruthy();
        
        expect(sendMessageFunc.mock.calls.length).toBe(5); //1 welcome message and 4 join messages
        expect(sendMessageFunc).toHaveBeenCalledWith('conn4', JSON.stringify({type:'WelcomeMessage' ,message:'ようこそチャットルームへ!!'})); // welcome message
        const expectedJoinMessage = JSON.stringify({type:'JoinMessage' ,message:'user3さんが入室しました。あいさつしまししょう。'});
        //join messages
        expect(sendMessageFunc).toHaveBeenCalledWith('conn1', expectedJoinMessage);
        expect(sendMessageFunc).toHaveBeenCalledWith('conn2', expectedJoinMessage);
        expect(sendMessageFunc).toHaveBeenCalledWith('conn3', expectedJoinMessage);
        expect(sendMessageFunc).toHaveBeenCalledWith('conn4', expectedJoinMessage);
    });
    
    test('exist user connection handling', async() => {
        const mockRepo = new ConnectionRepositoryMock(
            [
                {id: 'conn1', user:{id: 'user1'}},
                {id: 'conn2', user:{id: 'user2'}},
                {id: 'conn3', user:{id: 'user2'}},
            ]
        );
        const sendMessageFunc = jest.fn().mockResolvedValue(new Ok(undefined));
        
        const manager = new ConnectionManager(mockRepo, sendMessageFunc);
        
        const app = new ChatApplication(manager);
        
        let res = await app.onConnect('conn4', 'user1'); //new connection and existing user
        expect(res.every(r => r.isOk())).toBeTruthy();
        
        expect(sendMessageFunc.mock.calls.length).toBe(1); //only a welcome message
        expect(sendMessageFunc).toHaveBeenCalledWith('conn4', JSON.stringify({type:'WelcomeMessage' ,message:'ようこそチャットルームへ!!'})); // welcome message
    })
    
    test('invalid connection handling', async() => {
        const mockRepo = new ConnectionRepositoryMock(
            [
                {id: 'conn1', user:{id: 'user1'}},
                {id: 'conn2', user:{id: 'user2'}},
                {id: 'conn3', user:{id: 'user2'}},
            ]
        );
        const sendMessageFunc = jest.fn().mockResolvedValue(new Ok(undefined));
        
        const manager = new ConnectionManager(mockRepo, sendMessageFunc);
        
        const app = new ChatApplication(manager);
        
        let res = await app.onConnect('conn1', 'user2'); //existing connection
        
        expect(res.length).toBe(1);
        expect(res[0].isErr()).toBeTruthy(); //only Err should be return
        
        expect(sendMessageFunc).not.toHaveBeenCalled(); //no messages will be sent
    })
    
    test('handling user leaving', async () => {
        const mockRepo = new ConnectionRepositoryMock(
            [
                {id: 'conn1', user:{id: 'user1'}},
                {id: 'conn2', user:{id: 'user2'}},
                {id: 'conn3', user:{id: 'user2'}},
            ]
        );
        const sendMessageFunc = jest.fn().mockResolvedValue(new Ok(undefined));
        
        const manager = new ConnectionManager(mockRepo, sendMessageFunc);
        
        const app = new ChatApplication(manager);
        
        let res = await app.onDisconnect('conn1'); // all connections of user1 are disconnected
        expect(res.every(r => r.isOk())).toBeTruthy();
        
        expect(res.length).toBe(2); // 2 leave messages;
        const expectedLeaveMessage = JSON.stringify({type: 'LeaveMessage', message:'user1さんが退出しました。'});
        expect(sendMessageFunc).toHaveBeenCalledWith('conn2', expectedLeaveMessage);
        expect(sendMessageFunc).toHaveBeenCalledWith('conn3', expectedLeaveMessage);
    })
    
    test('handling disconnection of existing user', async() => {
        const mockRepo = new ConnectionRepositoryMock(
            [
                {id: 'conn1', user:{id: 'user1'}},
                {id: 'conn2', user:{id: 'user2'}},
                {id: 'conn3', user:{id: 'user2'}},
            ]
        );
        const sendMessageFunc = jest.fn().mockResolvedValue(new Ok(undefined));
        
        const manager = new ConnectionManager(mockRepo, sendMessageFunc);
        
        const app = new ChatApplication(manager);
        
        let res = await app.onDisconnect('conn2'); // disconnected but user2 is still alive
        expect(res.every(r => r.isOk())).toBeTruthy();
        expect(res.length).toBe(1); // only single Ok result;
        
        expect(sendMessageFunc).not.toHaveBeenCalled(); // no messages are sent
    });
    
    test('handling invalid disconnection', async() => {
        const mockRepo = new ConnectionRepositoryMock(
            [
                {id: 'conn1', user:{id: 'user1'}},
                {id: 'conn2', user:{id: 'user2'}},
                {id: 'conn3', user:{id: 'user2'}},
            ]
        );
        const sendMessageFunc = jest.fn().mockResolvedValue(new Ok(undefined));
        
        const manager = new ConnectionManager(mockRepo, sendMessageFunc);
        
        const app = new ChatApplication(manager);
        
        let res = await app.onDisconnect('conn4'); // connection does not exist
        expect(res.every(r => r.isErr())).toBeTruthy();
        expect(res.length).toBe(1); // only single Err result;
        
        expect(sendMessageFunc).not.toHaveBeenCalled(); // no messages are sent
    });
    
    test('handling Room Message Action', async () => {
        const mockRepo = new ConnectionRepositoryMock(
            [
                {id: 'conn1', user:{id: 'user1'}},
                {id: 'conn2', user:{id: 'user2'}},
                {id: 'conn3', user:{id: 'user2'}},
            ]
        );
        const sendMessageFunc = jest.fn().mockResolvedValue(new Ok(undefined));
        
        const manager = new ConnectionManager(mockRepo, sendMessageFunc);
        
        const app = new ChatApplication(manager);
        
        let res = await app.onChatAction('conn1', {type: "RoomMessage", payload: {message: 'Hi!Everyone!!'}});
        expect(res.every(r => r.isOk())).toBeTruthy();
        expect(res.length).toBe(3); // 3 room messages
        
        const expectedMessage = JSON.stringify({
            type: "RoomMessage",
            from: "user1",
            message: "Hi!Everyone!!"
        });
        expect(sendMessageFunc).toHaveBeenCalledWith('conn1', expectedMessage);
        expect(sendMessageFunc).toHaveBeenCalledWith('conn2', expectedMessage);
        expect(sendMessageFunc).toHaveBeenCalledWith('conn3', expectedMessage);
        
    });
    
    test('handling Direct Message Action', async () => {
        const mockRepo = new ConnectionRepositoryMock(
            [
                {id: 'conn1', user:{id: 'user1'}},
                {id: 'conn2', user:{id: 'user2'}},
                {id: 'conn3', user:{id: 'user2'}},
            ]
        );
        const sendMessageFunc = jest.fn().mockResolvedValue(new Ok(undefined));
        
        const manager = new ConnectionManager(mockRepo, sendMessageFunc);
        
        const app = new ChatApplication(manager);
        
        let res = await app.onChatAction('conn1', {type: "DirectMessage", payload: {to: 'user2', message: 'Hi'}});
        expect(res.every(r => r.isOk())).toBeTruthy();
        expect(res.length).toBe(2); // 2 direct messages
        
        const expectedMessage = JSON.stringify({
            type: "DirectMessage",
            to: "user2",
            from: "user1",
            message: "Hi"
        });
        
        expect(sendMessageFunc).toHaveBeenCalledWith('conn2', expectedMessage);
        expect(sendMessageFunc).toHaveBeenCalledWith('conn3', expectedMessage);
    });
    
    test('handling UserlistRequest Action',async() => {
        const mockRepo = new ConnectionRepositoryMock(
            [
                {id: 'conn1', user:{id: 'user1'}},
                {id: 'conn2', user:{id: 'user2'}},
                {id: 'conn3', user:{id: 'user2'}},
            ]
        );
        const sendMessageFunc = jest.fn().mockResolvedValue(new Ok(undefined));
        
        const manager = new ConnectionManager(mockRepo, sendMessageFunc);
        
        const app = new ChatApplication(manager);
        
        let res = await app.onChatAction('conn2', {type: "UserlistRequest"});
        expect(res.every(r => r.isOk())).toBeTruthy();
        expect(res.length).toBe(1); // 1 response
        
        const expectedMessage = JSON.stringify({
            type: 'UserlistResponseMessage',
            userIds: ['user1', 'user2']
        });
        
        expect(sendMessageFunc).toHaveBeenCalledWith('conn2', expectedMessage); // only requested conn will recieve the response message
    });
})