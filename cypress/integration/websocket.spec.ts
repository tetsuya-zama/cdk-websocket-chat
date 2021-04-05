import { timer } from 'rxjs';
import { takeUntil, reduce} from 'rxjs/operators';
import {WebSocketSubjectConfig} from 'rxjs/webSocket';

const ENDPOINT = Cypress.env('endpoint');

interface IMessage {
    type: string,
    payload: any
}

const config: WebSocketSubjectConfig<IMessage> = {
    url: ENDPOINT
}

describe("webchat api", () => {
    it("is simply connect to api", done => {
        cy.stream(config).then(subject => {
            subject
                .pipe(
                    // @ts-ignore
                    takeUntil(timer(1000)),
                    reduce((acc: IMessage[], val: IMessage) => [...acc, val],[])
                )
                .subscribe({
                    error: (err) => expect(err).to.be.undefined,
                    complete:done
                })
        })
    })
})