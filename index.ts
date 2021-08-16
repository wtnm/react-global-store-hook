import {useEffect, useRef, useState} from 'react';
import {isEqual, isPromise, isFunction, isString, isObject, isArray, isMergeable, isUndefined} from 'is-fns';

export default class GlobalStore {
  private readonly state: Map<string, any>
  private listeners = {}
  private subscribers: Set<Function> = new Set()
  private notify: null | number = null;
  private notified = new Map();
  private currentChanges = [{}, {}]; // [nextStateParts, prevStateParts]
  private previousChanges = [{}, {}];

  constructor(initialState: { [key: string]: any } = {}) {this.state = new Map(Object.entries(initialState))}

  private notifyListeners = () => {
    this.notify = null;
    this.previousChanges = this.currentChanges;
    this.currentChanges = [{}, {}];
    Object.keys(this.previousChanges[0]).forEach(key => {
      if (this.listeners[key])
        this.listeners[key].forEach((listener) => {
          const {req, subscriber, previous} = listener;
          if (!this.notified.get(subscriber)) {
            let result = this.makeStateParts(req);
            if (!isEqual(previous, result)) subscriber(listener.previous = result);
            this.notified.set(subscriber, true);
          }
        });
    })
    this.subscribers.forEach(subscriber => subscriber(this.previousChanges))
    this.notified = new Map();
  }

  private setStateAndNotifier = (key, value) => {
    if (Object.is(this.state.get(key), value)) return;
    if (!this.currentChanges[1].hasOwnProperty(key)) this.currentChanges[1][key] = this.state.get(key);
    this.currentChanges[0][key] = value;
    if (isUndefined(value)) {this.state.delete(key)} else {this.state.set(key, value)}
    if (!this.notify) this.notify = setTimeout(this.notifyListeners, 0); // execute on the next tick
  }

  private getStoreKey = (v) => isArray(v) ? v[0] : v;

  private getValue = (keys) => {
    if (isString(keys)) return this.state.get(keys);
    if (isArray(keys)) {
      if (keys.length === 0) return this.previousChanges;
      let res: any = this.state.get(keys[0]);
      for (let i = 1; i < keys.length; i++) {
        if (isMergeable(res)) res = res[keys[i]];
        else return undefined;
      }
      return res;
    }
  }

  private makeStateParts = (req) => (isString(req) || isArray(req)) ? this.getValue(req) : (!req ? req :
    Object.keys(req).reduce((r, prop) => (r[prop] = this.getValue(req[prop])) && r || r, {}));

  private usePrevReqAndState = (req, partState) => {
    const {current} = useRef({});
    if (!isEqual(req, current.req, {deep: true}) || current.state !== this.state) { // new subscription were made
      current.state = this.state;
      current.req = req;
      current.check = partState;   // save old partState to check
      current.result = this.makeStateParts(req);
      return [current.req, current.result]
    } else if (current.hasOwnProperty('check') && current.check === partState) { // partState not yet updated
      if (isObject(req) || this.makeStateParts(req) !== partState) return [current.req, current.result];
    }
    delete current.check;  // subscription made and partState updated
    return [req, partState]
  }

  useSubscribe = (req: false | string | string[] | { [key: string]: string | string[] }) => {
    let [partState, setPartState] = useState(this.makeStateParts(req));
    [req, partState] = this.usePrevReqAndState(req, partState);
    useEffect(() => this.subscribe(req, setPartState), [req, this.state]);
    return partState
  };

  subscribe = (req, subscriber) => {
    if (isArray(req) && !req.length) return this.subscribers.add(subscriber) && (() => this.subscribers.delete(subscriber))
    if (req === true || !req && req !== "") return req;
    const subsObject = {req, subscriber};
    const props = isObject(req) ? Object.keys(req) : [""];
    props.forEach(prop => {
      const key = this.getStoreKey(isObject(req) ? req[prop] : req);
      if (!this.listeners[key]) this.listeners[key] = new Set();
      this.listeners[key].add(subsObject);
    });
    return () => props.forEach(p => this.listeners[this.getStoreKey(isObject(req) ? req[p] : req)].delete(subsObject));
  };

  set = (key, value) => {
    if (isFunction(value)) value = value(this.state.get(key));
    if (isPromise(value)) value.then((val) => this.setStateAndNotifier(key, val)).catch((e) => {throw new Error(e)})
    else this.setStateAndNotifier(key, value)
  }

  get = (req) => this.makeStateParts(req)

  keys = () => this.state.keys()
}
