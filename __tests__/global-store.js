// set env variable to the `tsconfig.json` path before loading mocha (default: './tsconfig.json')

process.env.TS_NODE_PROJECT = './tsconfig.json';

require('ts-mocha');
const {expect} = require('chai');
const sleep = require('sleep-promise');
const createStore = require('../index.ts').default;
require('jsdom-global')()
const React = require("react");
const {render} = require("react-dom");
const {act} = require("react-dom/test-utils");

describe('test global store', function () {
  const initialState = {one: 1, two: 2};
  let {subscribe, get, set, useSubscribe} = createStore(initialState);

  let container = null;
  container = document.createElement("div");
  document.body.appendChild(container);


  it('tests initial state', () => {
    expect(get('one')).to.be.equal(initialState.one);
    expect(get('two')).to.be.equal(initialState.two);
  })

  it('tests subscribe', async () => {
    let unsub = subscribe(true, ([next, prev]) => {
      expect(prev.one).to.be.equal(1);
      expect(next.one).to.be.equal(11);
      expect(prev.three).to.be.equal(undefined);
      expect(next.three).to.be.equal(3);
    })
    set('one', 11);
    set('three', 3);
    await sleep(5);
    unsub();
  })

  it('tests useSubscribe', async () => {
    const TestGlobalState = ({name}) => useSubscribe(name);

    act(() => { render(React.createElement(TestGlobalState, {name: 'one'}), container); });
    expect(container.textContent).to.be.equal("11");
    set('one', 10);
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
    set('one', 1);
    set('two', 22);
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
    set('four', {five: 5});
    set('six', {seven: 7});
    await sleep(5);
    expect(container.textContent).to.be.equal('{"four":5,"two":22}');
    act(() => { render(React.createElement(TestGlobalState, {req: ['six', 'seven']}), container); });
    expect(container.textContent).to.be.equal('7');
    act(() => { render(React.createElement(TestGlobalState, {req: 'six'}), container); });
    expect(container.textContent).to.be.equal('{"seven":7}');
  })

  let {set: setGS, useSubscribe: useGS} = createStore(initialState);

  it('tests useSubscribe with different stores', async () => {
    const TestGlobalState = ({useHook, req}) => {
      let val = useHook(req);
      return JSON.stringify(val);
    }
    act(() => { render(React.createElement(TestGlobalState, {useHook: useSubscribe, req: 'two'}), container); });
    expect(container.textContent).to.be.equal('22');

    act(() => { render(React.createElement(TestGlobalState, {useHook: useGS, req: 'two'}), container); });
    expect(container.textContent).to.be.equal('2');

    set('two', 222);
    setGS('two', 21);
    await sleep(5);
    expect(container.textContent).to.be.equal('21');

    act(() => { render(React.createElement(TestGlobalState, {useHook: useSubscribe, req: 'two'}), container); });
    expect(container.textContent).to.be.equal('222');
  })
})
