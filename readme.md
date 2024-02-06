

<!-- toc -->



<!-- tocstop -->

## Overview
`react-global-store-hook` - global store based on react hooks

## Installation

To install the stable version:

```
npm install --save react-global-store-hook
```


## Quick example
```
import GlobalStore from 'react-global-store-hook';

const store = new GlobalStore({ count: 0 });

setInterval(() => {
  store.set('count', store.get('count') + 1);
}, 1000);

export function SecondsCounter() {
  const count = store.useSubscribe('count');
  return <div>{count}</div>;
}

const unsubscribe = store.subsctibe('count', (value) => console.log(value));
```

## Documentation
### GlobalStore(initialState: { [key: string]: any } = {})
```
import GlobalStore from 'react-global-store-hook';
const store = new GlobalStore();
```
Store constructor. Can be initialized with initial state.

### GlobalStore methods

#### useSubscribe = (...paths: Array<string | string[]>): any | any[] | { prev: any, current: any }
React hook to subscribe for store updates in react functional components.

If no arguments passed, then subscribes to all changes and returns value in format `{ prev: any, current: any }`.

If one argument passed returns single value in `path = paths[0]`.

Otherwise return tuple of values in each `path of paths`

Example:
```
const store = new GlobalStore({ one: 1, two: { deep: 2 }, three: 3 });

export function Example() {
  const deepTwo = store.useSubscribe(['two', 'deep']);
  const [one, three] = store.useSubscribe('one', 'three');
  return (
    <div>
      <div>{deepTwo}</div> {/* 2 */}
      <div>{one}</div> {/* 1 */}
      <div>{three}</div> {/* 3 */}
    </div>
  );
}
```
#### subscribe = (path: string | string[], subscriber: (value: any) => void): Function
Subscribes `subscriber` for store value updates in `path`. Returns function to unsubscribe

#### set = (path: string | string[], value: any): void
Set new `value` in store `path`

#### get = (path: string | string[]): any
Get `value` in store `path`

#### keys(): string[]
Returns all store keys