import { useEffect, useRef, useState } from 'react';
import isFunction from 'lodash/isFunction';
import isArray from 'lodash/isArray';
import isString from 'lodash/isString';
import isEqual from 'lodash/isEqual';
import isUndefined from 'lodash/isUndefined';
import isMergeable from 'is-mergeable-object';
import isPromise from 'is-promise';
import { merge } from 'react-merge';

type Subscriber = (value: any) => void;

type Listener = {
  paths: Array<string | string[]>;
  subscriber: Subscriber;
  previous?: any;
  isSubscriberReactHook: boolean;
};

export default class GlobalStore {
  private readonly state: Map<string, any>;
  private listeners: { [key: string]: Set<Listener> } = {};
  private subscribers: Set<Subscriber> = new Set();
  private notify: null | ReturnType<typeof setTimeout> = null;
  private notified = new Map();
  // nextChanges is using to accumulate changes, and then notify listeners in one batch
  private nextChanges: { prev: { [key: string]: any }; current: { [key: string]: any } } = { prev: {}, current: {} };
  private currentChanges: { prev: { [key: string]: any }; current: { [key: string]: any } } = { prev: {}, current: {} };

  constructor(initialState: { [key: string]: any } = {}) {
    this.state = new Map(Object.entries(initialState));
  }

  private notifyListeners = () => {
    this.notify = null;
    this.currentChanges = this.nextChanges;
    this.nextChanges = { prev: {}, current: {} };
    Object.keys(this.currentChanges.current).forEach((key) => {
      if (this.listeners[key])
        this.listeners[key].forEach((listener) => {
          const { paths, subscriber, previous, isSubscriberReactHook } = listener;
          if (!this.notified.get(subscriber)) {
            const result = this.getResult(paths);
            if (!isEqual(previous, result)) {
              listener.previous = result;
              subscriber(isSubscriberReactHook && isFunction(result) ? () => result : result);
            }
            this.notified.set(subscriber, true);
          }
        });
    });
    this.subscribers.forEach((subscriber) => subscriber(this.currentChanges));
    this.notified = new Map();
  };

  private setStateAndNotify = (key: string, value: any) => {
    if (Object.is(this.state.get(key), value)) return;
    if (!(key in this.nextChanges.prev)) this.nextChanges.prev[key] = this.state.get(key);
    this.nextChanges.current[key] = value;
    if (isUndefined(value)) {
      this.state.delete(key);
    } else {
      this.state.set(key, value);
    }
    if (!this.notify) this.notify = setTimeout(this.notifyListeners, 0); // execute on the next tick
  };

  private getStoreKey = (v: string | string[]) => (isArray(v) ? v[0] : v);

  private useManageSubscriptionOrStoreChange = (
    paths: Array<string | string[]>,
    componentValue: any,
  ): [Array<string | string[]>, any] => {
    const { current: self }: { current: { paths: Array<string | string[]>; [key: string]: unknown } } = useRef({
      paths,
    });
    if (!isEqual(paths, self.path) || self.state !== this.state) {
      // new subscription were made or different store is using
      self.state = this.state;
      self.path = paths;
      self.componentValue = componentValue; // save value from component to check
      self.storeValue = this.getResult(paths); // get value from store
      return [self.paths, self.storeValue];
    } else if ('componentValue' in self && self.componentValue === componentValue) {
      if (this.getResult(paths) !== componentValue)
        // value updated in store, but not updated in component, cause listener is not called yet
        return [self.paths, self.storeValue];
    } // subscription or store changed and value updated both in store and component
    delete self.componentValue;
    return [self.paths, componentValue];
  };

  private _subscribe = (
    paths: false | Array<string | string[]>,
    subscriber: Subscriber,
    isSubscriberReactHook = false,
  ) => {
    if (isArray(paths) && !paths.length)
      return this.subscribers.add(subscriber) && (() => this.subscribers.delete(subscriber));
    if (!paths) return;
    const subsObject: Listener = { paths, subscriber, isSubscriberReactHook };
    const subsKeys: string[] = paths.map((path) => {
      const key = this.getStoreKey(path);
      if (!this.listeners[key]) this.listeners[key] = new Set();
      this.listeners[key].add(subsObject);
      return key;
    });
    if (isSubscriberReactHook) subscriber(this.getResult(paths));
    return () => {
      subsKeys.forEach((key) => {
        this.listeners[key].delete(subsObject);
      });
    };
  };

  private getResult(paths: Array<string | string[]>) {
    const result = paths.map((path) => this.get(path));
    return result.length <= 1 ? result[0] : result;
  }

  useSubscribe = (...paths: Array<string | string[]>) => {
    // eslint-disable-next-line prefer-const
    let [value, setValue] = useState(this.getResult(paths));
    [paths, value] = this.useManageSubscriptionOrStoreChange(paths, value);
    useEffect(() => this._subscribe(paths, setValue, true), [paths, this.state]);
    return value;
  };

  set = (path: string | string[], value: any) => {
    if (isFunction(value)) value = value(this.get(path));
    const [key, ...restPath] = isArray(path) ? path : [path];
    const currentValue = this.get(key);
    if (isPromise(value))
      (value as Promise<unknown>)
        .then((promiseValue) =>
          this.setStateAndNotify(key, merge(currentValue, promiseValue, { path: restPath, replace: true })),
        )
        .catch((e) => {
          throw new Error(e);
        });
    else this.setStateAndNotify(key, merge(currentValue, value, { path: restPath, replace: true }));
  };

  get = (path: string | string[]) => {
    if (path.length === 0) return this.currentChanges;
    if (isString(path)) return this.state.get(path);
    if (isArray(path)) {
      let res: unknown = this.state.get(path[0]);
      for (let i = 1; i < path.length; i++) {
        if (isMergeable(res)) res = (res as { [key: string]: unknown })[path[i]];
        else return undefined;
      }
      return res;
    }
  };

  subscribe = (path: string | string[], subscriber: Subscriber) =>
    this._subscribe(path.length ? [path] : [], subscriber);
  keys = () => this.state.keys();
}
