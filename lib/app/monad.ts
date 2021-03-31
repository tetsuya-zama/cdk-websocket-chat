export type Optional<T> = Some<T> | None<T>;

export class Some<T>{
    constructor(public readonly value: T){}
    
    unwrap(): T | null{
        return this.value;
    }
    
    type = 'Some' as const
    
    isSome: () => this is Some<T> = () => true;
    isNone: () => this is None<T> = () => false;
    
    map: <S>(f:(val:T)=>S | Optional<S>) => Optional<S> = (f) => {
        const result = f(this.value);
        if(result instanceof Some || result instanceof None){
            return result;
        }else{
            return new Some(result);
        }
    }
}

export class None<T>{
    constructor(){}
    
    unwrap(): T | null {
        return null;
    }
    
    type = 'None' as const
    
    isSome: () => this is Some<T> = () => false;
    isNone: () => this is None<T> = () => true;
    
    map: <S>(f:(val:T)=>S | Optional<S>) => Optional<S> = (_) => {
        return new None();
    }
}

export type Result<T,E> = Ok<T,E> | Err<T,E>;

export class Ok<T,E>{
    constructor(public readonly value: T){}
    
    unwrap(): T | E {
        return this.value;
    }
    
    type = 'Ok' as const
    
    isOk: () => this is Ok<T,E> = () => true;
    isErr: () => this is Err<T,E> = () => false;
    
    map: <S>(f:(val:T)=>S | Result<S,E>) => Result<S,E> = (f) => {
        const result = f(this.value);
        if(result instanceof Ok || result instanceof Err){
            return result;
        }else{
            return new Ok(result);
        }
    }
}

export class Err<T,E>{
    constructor(public readonly value: E){}
    
    unwrap(): T | E {
        return this.value;
    }
    
    type = 'Err' as const
    
    isOk: () => this is Ok<T,E> = () => false;
    isErr: () => this is Err<T,E> = () => true;
    
    map: <S>(f:(val:T)=>S | Result<S,E>) => Result<S,E> = (_) => {
        return new Err(this.value);
    }
}