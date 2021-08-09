import {useCallback, useEffect, useRef, useState} from 'react';
import {isEqual, isPromise, isFunction, isString, isObject, isArray, isMergeable} from 'is-fns';

export default function (initialState: any = {}) {
  const state: Map<string, any> = new Map(Object.entries(initialState));
  const listeners = {};
  const subscribers: Set<Function> = new Set();
  let notify: null | number = null;
  let notified = new Map();
  let nextStateParts = {};
  let prevStateParts = {};

  const notifyListeners = () => {
    notify = null;
    Object.keys(nextStateParts).forEach(key => {
      if (listeners[key])
        listeners[key].forEach((listener) => {
          const {req, subscriber, previous} = listener;
          if (!notified.get(subscriber)) {
            let result = makeStateParts(req);
            if (!isEqual(previous, result)) subscriber(listener.previous = result);
            notified.set(subscriber, true);
          }
        });
    })
    subscribers.forEach(subscriber => subscriber([nextStateParts, prevStateParts]))
    nextStateParts = {};
    prevStateParts = {};
    notified = new Map();
  }

  const setStateAndNotifier = (key, value) => {
    if (Object.is(state.get(key), value)) return;
    if (!prevStateParts.hasOwnProperty(key)) prevStateParts[key] = state.get(key);
    nextStateParts[key] = value;
    state.set(key, value);
    if (!notify) notify = setTimeout(notifyListeners, 0); // execute on next tick
  }

  const setValue = (key, value) => {
    if (isFunction(value)) value = value(state.get(key));
    if (isPromise(value)) value.then((val) => setStateAndNotifier(key, val)).catch((e) => {throw new Error(e)})
    else setStateAndNotifier(key, value)
  }

  const getInState = (keys) => {
    if (isString(keys)) return state.get(keys);
    if (isArray(keys)) {
      if (keys.length === 0) throw new Error('Request key length must be at least 1');
      let res: any = state.get(keys[0]);
      for (let i = 1; i < keys.length; i++) {
        if (isMergeable(res)) res = res[keys[i]];
        else return undefined;
      }
      return res;
    }
  }

  const makeStateParts = (req) => (isString(req) || isArray(req)) ? getInState(req) : (!req ? req :
    Object.keys(req).reduce((r, prop) => (r[prop] = getInState(req[prop])) && r || r, {}));

  const usePrevReqAndState = (req, partState) => {
    const {current} = useRef({});
    if (!isEqual(req, current.req, {deep: true}) || current.state !== state) { // new subscription were made
      current.state = state;
      current.req = req;
      current.check = partState;   // save old partState to check
      current.result = makeStateParts(req);
      return [current.req, current.result]
    } else if (current.hasOwnProperty('check') && current.check === partState) // partState not yet updated
      return [current.req, current.result]
    else delete current.check;  // subscription made and partState updated
    return [req, partState]
  }

  const useStore = (key: string | string[] | { [key: string]: string | string[] }) => {
    let [partState, setPartState] = useState(makeStateParts(key));
    [key, partState] = usePrevReqAndState(key, partState);
    useEffect(() => subscribe(key, setPartState), [key, state]);
    return partState
  };

  const getStoreKey = (v) => isArray(v) ? v[0] : v;

  const subscribe = (req, subscriber) => {
    if (req === true) return subscribers.add(subscriber) && (() => subscribers.delete(subscriber))
    if (!req && req !== "") return req;
    const subsObject = {req, subscriber};
    const props = isObject(req) ? Object.keys(req) : [""];
    props.forEach(prop => {
      const key = getStoreKey(isObject(req) ? req[prop] : req);
      if (!listeners[key]) listeners[key] = new Set();
      listeners[key].add(subsObject);
    });
    return () => props.forEach(p => listeners[getStoreKey(isObject(req) ? req[p] : req)].delete(subsObject));
  };

  return {useStore, subscribe, set: setValue, get: getInState, keys: () => state.keys()};
}
