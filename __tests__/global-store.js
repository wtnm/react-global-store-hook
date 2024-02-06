// set env variable to the `tsconfig.json` path before loading mocha (default: './tsconfig.json')

process.env.TS_NODE_PROJECT = './tsconfig.json';

require('ts-mocha');
const { expect } = require('chai');
const sleep = require('sleep-promise');
const GlobalStore = require('../index.ts').default;
require('jsdom-global')();
const React = require('react');
const { render } = require('react-dom');
const { act } = require('react-dom/test-utils');

describe('test global store', function () {
  const initialState = { one: 1, two: 2 };
  const store = new GlobalStore(initialState);
  const { subscribe, get, set, useSubscribe } = store;

  let container = null;
  container = document.createElement('div');
  document.body.appendChild(container);

  it('tests initial state', () => {
    expect(get('one')).to.be.equal(initialState.one);
    expect(get('two')).to.be.equal(initialState.two);
  });

  it('tests subscribe', async () => {
    const unsub = subscribe([], ({ prev, current }) => {
      expect(prev.one).to.be.equal(1);
      expect(current.one).to.be.equal(11);
      expect(prev.three).to.be.equal(undefined);
      expect(current.three).to.be.equal(3);
    });
    const unsub2 = subscribe('one', (value) => {
      expect(value).to.be.equal(11);
    });
    set('one', 11);
    set('three', 3);
    await sleep(5);
    unsub();
    unsub2();
  });

  it('tests useSubscribe basic', async () => {
    const TestGlobalState = ({ name }) => useSubscribe(name);

    act(() => {
      render(React.createElement(TestGlobalState, { name: 'one' }), container);
    });
    expect(container.textContent).to.be.equal('11');
    set('one', 10);
    await sleep(5);
    expect(container.textContent).to.be.equal('10');
  });

  it('tests useSubscribe subscription change', async () => {
    const TestGlobalState = ({ name }) => useSubscribe(name);

    act(() => {
      render(React.createElement(TestGlobalState, { name: 'one' }), container);
    });
    expect(container.textContent).to.be.equal('10');
    await sleep(5);
    act(() => {
      render(React.createElement(TestGlobalState, { name: 'two' }), container);
    });
    expect(container.textContent).to.be.equal('2');
  });

  it('tests useSubscribe complex', async () => {
    const TestGlobalState = ({ req1, req2 }) => {
      const val1 = useSubscribe(req1);
      const val2 = useSubscribe(req2);
      return JSON.stringify({ val1, val2 });
    };
    act(() => {
      render(React.createElement(TestGlobalState, { req1: ['one'], req2: ['two'] }), container);
    });
    expect(container.textContent).to.be.equal('{"val1":10,"val2":2}');
    set('one', 1);
    set('two', 22);
    await sleep(5);
    expect(container.textContent).to.be.equal('{"val1":1,"val2":22}');
    act(() => {
      render(React.createElement(TestGlobalState, { req1: ['one'], req2: ['three'] }), container);
    });
    expect(container.textContent).to.be.equal('{"val1":1,"val2":3}');
  });

  it('tests useSubscribe with path', async () => {
    const TestGlobalState = ({ reqs }) => {
      const val1 = useSubscribe(...reqs);
      return JSON.stringify(val1);
    };
    act(() => {
      render(React.createElement(TestGlobalState, { reqs: [['four', 'five'], ['two']] }), container);
    });
    expect(container.textContent).to.be.equal('[null,22]');
    set(['four', 'five'], 5);
    set('six', { seven: 7 });
    await sleep(5);
    expect(container.textContent).to.be.equal('[5,22]');
    act(() => {
      render(React.createElement(TestGlobalState, { reqs: [['six', 'seven']] }), container);
    });
    expect(container.textContent).to.be.equal('7');
    act(() => {
      render(React.createElement(TestGlobalState, { reqs: ['six'] }), container);
    });
    expect(container.textContent).to.be.equal('{"seven":7}');
    act(() => {
      render(React.createElement(TestGlobalState, { reqs: ['six'] }), container);
    });
    expect(container.textContent).to.be.equal('{"seven":7}');
  });

  const store2 = new GlobalStore(initialState);

  it('tests useSubscribe with different stores', async () => {
    const TestGlobalState = ({ store, req }) => {
      const val = store.useSubscribe(req);
      return JSON.stringify(val);
    };
    act(() => {
      render(React.createElement(TestGlobalState, { store, req: 'two' }), container);
    });
    expect(container.textContent).to.be.equal('22');

    act(() => {
      render(React.createElement(TestGlobalState, { store: store2, req: 'two' }), container);
    });
    expect(container.textContent).to.be.equal('2');

    set('two', 222);
    store2.set('two', 21);
    await sleep(5);
    expect(container.textContent).to.be.equal('21');

    act(() => {
      render(React.createElement(TestGlobalState, { store, req: 'two' }), container);
    });
    expect(container.textContent).to.be.equal('222');
  });
});
