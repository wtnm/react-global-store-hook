// set env variable to the `tsconfig.json` path before loading mocha (default: './tsconfig.json')

process.env.TS_NODE_PROJECT = './tsconfig.json';

require('ts-mocha');
const {expect} = require('chai');
const sleep = require('sleep-promise');
const GlobalStore = require('../index.ts').default;
require('jsdom-global')()
const React = require("react");
const {render} = require("react-dom");
const {act} = require("react-dom/test-utils");

describe('test global store', function () {
  const initialState = {one: 1, two: 2};
  let store = new GlobalStore(initialState);
  let {subscribe, getValue, setValue, useSubscribe} = store;

  let container = null;
  container = document.createElement("div");
  document.body.appendChild(container);


  it('tests initial state', () => {
    expect(getValue('one')).to.be.equal(initialState.one);
    expect(getValue('two')).to.be.equal(initialState.two);
  })

  it('tests subscribe', async () => {
    let unsub = subscribe([], ([next, prev]) => {
      expect(prev.one).to.be.equal(1);
      expect(next.one).to.be.equal(11);
      expect(prev.three).to.be.equal(undefined);
      expect(next.three).to.be.equal(3);
    })
    setValue('one', 11);
    setValue('three', 3);
    await sleep(5);
    unsub();
  })

  it('tests useSubscribe', async () => {
    const TestGlobalState = ({name}) => useSubscribe(name);

    act(() => { render(React.createElement(TestGlobalState, {name: 'one'}), container); });
    expect(container.textContent).to.be.equal("11");
    setValue('one', 10);
    await sleep(5);
    expect(container.textContent).to.be.equal("10");
  })

  it('tests useSubscribe subscription change', async () => {
    const TestGlobalState = ({name}) => useSubscribe(name);

    act(() => { render(React.createElement(TestGlobalState, {name: 'one'}), container); });
    expect(container.textContent).to.be.equal("10");
    await sleep(5);
    act(() => { render(React.createElement(TestGlobalState, {name: 'two'}), container); });
    expect(container.textContent).to.be.equal("2");
  })

  it('tests useSubscribe', async () => {
    const TestGlobalState = ({req}) => {
      let val = useSubscribe(req);
      return JSON.stringify(val);
    }
    act(() => { render(React.createElement(TestGlobalState, {req: {one: 'one', two: 'two'}}), container); });
    expect(container.textContent).to.be.equal('{"one":10,"two":2}');
    setValue('one', 1);
    setValue('two', 22);
    await sleep(5);
    expect(container.textContent).to.be.equal('{"one":1,"two":22}');
    act(() => { render(React.createElement(TestGlobalState, {req: {one: 'one', three: 'three'}}), container); });
    expect(container.textContent).to.be.equal('{"one":1,"three":3}');
  })

  it('tests useSubscribe with path', async () => {
    const TestGlobalState = ({req}) => {
      let val = useSubscribe(req);
      return JSON.stringify(val);
    }
    act(() => { render(React.createElement(TestGlobalState, {req: {four: ['four', 'five'], two: ['two']}}), container); });
    expect(container.textContent).to.be.equal('{"two":22}');
    setValue('four', {five: 5});
    setValue('six', {seven: 7});
    await sleep(5);
    expect(container.textContent).to.be.equal('{"four":5,"two":22}');
    act(() => { render(React.createElement(TestGlobalState, {req: ['six', 'seven']}), container); });
    expect(container.textContent).to.be.equal('7');
    act(() => { render(React.createElement(TestGlobalState, {req: 'six'}), container); });
    expect(container.textContent).to.be.equal('{"seven":7}');
  })

  let store2 = new GlobalStore(initialState);

  it('tests useSubscribe with different stores', async () => {
    const TestGlobalState = ({store, req}) => {
      let val = store.useSubscribe(req);
      return JSON.stringify(val);
    }
    act(() => { render(React.createElement(TestGlobalState, {store, req: 'two'}), container); });
    expect(container.textContent).to.be.equal('22');

    act(() => { render(React.createElement(TestGlobalState, {store: store2, req: 'two'}), container); });
    expect(container.textContent).to.be.equal('2');

    setValue('two', 222);
    store2.setValue('two', 21);
    await sleep(5);
    expect(container.textContent).to.be.equal('21');

    act(() => { render(React.createElement(TestGlobalState, {store, req: 'two'}), container); });
    expect(container.textContent).to.be.equal('222');
  })
})
