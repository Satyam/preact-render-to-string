/*eslint max-nested-callbacks: ["error", 4]*/
import { asyncRender } from '../src';
import { h, Component } from 'preact';
import chai, { expect } from 'chai';
import { spy, match } from 'sinon';
import sinonChai from 'sinon-chai';
chai.use(sinonChai);

const shouldBe = (html, msg) => rendered => expect(rendered, msg).to.equal(html);

describe('Async render', () => {
	describe('Basic JSX', () => {
		it('should render JSX', () =>
			asyncRender(<div class="foo">bar</div>)
			.then(shouldBe(`<div class="foo">bar</div>`))
		);

		it('should omit falsey attributes', () =>
			asyncRender(<div a={null} b={undefined} c={false} />)
			.then(shouldBe(`<div></div>`))
		);
		it('should render {0} attribute as "0"', () =>
			asyncRender(<div foo={0} />)
			.then(shouldBe(`<div foo="0"></div>`))
		);

		it('should collapse collapsible attributes', () =>
			asyncRender(<div class="" style="" foo={true} bar />)
			.then(shouldBe(`<div class style foo bar></div>`))
		);

		it('should omit functions', () =>
			asyncRender(<div a={()=>{}} b={function(){}} />)
			.then(shouldBe(`<div></div>`))
		);

		it('should encode entities', () =>
			asyncRender(<div a={'"<>&'}>{'"<>&'}</div>)
			.then(shouldBe(`<div a="&quot;&lt;&gt;&amp;">&quot;&lt;&gt;&amp;</div>`))
		);

		it('should omit falsey children', () =>
			asyncRender(<div>{null}|{undefined}|{false}</div>)
			.then(shouldBe(`<div>||</div>`))
		);

		it('should self-close void elements', () =>
			asyncRender(<div><input type='text' /><wbr /></div>)
			.then(shouldBe(`<div><input type="text" /><wbr /></div>`))
		);

		it('does not close void elements with closing tags', () =>
			asyncRender(<input><p>Hello World</p></input>)
			.then(shouldBe(`<input /><p>Hello World</p>`))
		);

		it('should serialize object styles', () =>
			asyncRender(<div style={{ color:'red', border:'none' }} />)
			.then(shouldBe(`<div style="color: red; border: none;"></div>`))
		);

		it('should ignore empty object styles', () =>
			asyncRender(<div style={{}} />)
			.then(shouldBe(`<div></div>`))
		);

		it('should render SVG elements', () =>
			asyncRender(
				<svg>
					<image xlinkHref="#" />
					<foreignObject>
						<div xlinkHref="#" />
					</foreignObject>
					<g>
						<image xlinkHref="#" />
					</g>
				</svg>
			)
			.then(shouldBe(`<svg><image xlink:href="#"></image><foreignObject><div xlinkHref="#"></div></foreignObject><g><image xlink:href="#"></image></g></svg>`))
		);
	});

	describe('Functional Components', () => {
		it('should render functional components', () => {
			let Test = spy( ({ foo, children }) => <div foo={foo}>{ children }</div> );

			return asyncRender(<Test foo="test">content</Test>)
			.then(rendered => {
				expect(rendered)
					.to.equal(`<div foo="test">content</div>`);

				expect(Test)
					.to.have.been.calledOnce
					.and.calledWithExactly(
						match({
							foo: 'test',
							children: ['content']
						}),
						match({})
					);
			});
		});

		it('should render functional components within JSX', () => {
			let Test = spy( ({ foo, children }) => <div foo={foo}>{ children }</div> );

			return asyncRender(
				<section>
					<Test foo={1}><span>asdf</span></Test>
				</section>
			)
			.then(rendered => {
				expect(rendered)
					.to.equal(`<section><div foo="1"><span>asdf</span></div></section>`);

				expect(Test)
					.to.have.been.calledOnce
					.and.calledWithExactly(
						match({
							foo: 1,
							children: [
								match({ nodeName:'span', children:['asdf'] })
							]
						}),
						match({})
					);
			});

		});

		it('should apply defaultProps', () => {
			const Test = props => <div {...props} />;
			Test.defaultProps = {
				foo: 'default foo',
				bar: 'default bar'
			};
			return Promise.all([
				asyncRender(<Test />).then(shouldBe('<div foo="default foo" bar="default bar"></div>', 'defaults')),
				asyncRender(<Test bar="b" />).then(shouldBe('<div foo="default foo" bar="b"></div>', 'partial')),
				asyncRender(<Test foo="a" bar="b" />).then(shouldBe('<div foo="a" bar="b"></div>', 'overridden'))
			]);
		});
	});

	describe('Classical Components', () => {
		it('should render classical components', () => {
			let Test = spy(class Test extends Component {
				render({ foo, children }, state) {
					return <div foo={foo}>{ children }</div>;
				}
			});
			spy(Test.prototype, 'render');

			return asyncRender(<Test foo="test">content</Test>)
			.then(rendered => {
				const PROPS = {
					foo: 'test',
					children: ['content']
				};

				expect(rendered)
					.to.equal(`<div foo="test">content</div>`);

				expect(Test)
					.to.have.been.calledOnce
					.and.calledWith(match(PROPS), match({}));

				expect(Test.prototype.render)
					.to.have.been.calledOnce
					.and.calledWithExactly(
						match(PROPS),
						match({}),	// empty state
						match({})	// empty context
					);
			});

		});

		it('should render classical components within JSX', () => {
			let Test = spy(class Test extends Component {
				render({ foo, children }, state) {
					return <div foo={foo}>{ children }</div>;
				}
			});

			spy(Test.prototype, 'render');

			return asyncRender(
				<section>
					<Test foo={1}><span>asdf</span></Test>
				</section>
			)
			.then(rendered => {

				expect(rendered)
					.to.equal(`<section><div foo="1"><span>asdf</span></div></section>`);

				expect(Test).to.have.been.calledOnce;

				expect(Test.prototype.render)
					.to.have.been.calledOnce
					.and.calledWithExactly(
						match({
							foo: 1,
							children: [
								match({ nodeName:'span', children:['asdf'] })
							]
						}),
						match({}),	// empty state
						match({})
					);
			});

		});

		it('should apply defaultProps', () => {
			class Test extends Component {
				static defaultProps = {
					foo: 'default foo',
					bar: 'default bar'
				};
				render(props) {
					return <div {...props} />;
				}
			}
			return Promise.all([
				asyncRender(<Test />).then(shouldBe('<div foo="default foo" bar="default bar"></div>', 'defaults')),
				asyncRender(<Test bar="b" />).then(shouldBe('<div foo="default foo" bar="b"></div>', 'partial')),
				asyncRender(<Test foo="a" bar="b" />).then(shouldBe('<div foo="a" bar="b"></div>', 'overridden'))
			]);
		});

		it('should invoke componentWillMount', () => {
			class Test extends Component {
				componentWillMount() {}
				render(props) {
					return <div {...props} />;
				}
			}
			spy(Test.prototype, 'componentWillMount');
			spy(Test.prototype, 'render');

			return asyncRender(<Test />)
			.then(() =>
				expect(Test.prototype.componentWillMount)
					.to.have.been.calledOnce
					.and.to.have.been.calledBefore(Test.prototype.render)
			);

		});

		it('should pass context to grandchildren', () => {
			const CONTEXT = { a:'a' };
			const PROPS = { b:'b' };

			class Outer extends Component {
				getChildContext() {
					return CONTEXT;
				}
				render(props) {
					return <div><Inner {...props} /></div>;
				}
			}
			spy(Outer.prototype, 'getChildContext');

			class Inner extends Component {
				render(props, state, context) {
					return <div>{ context && context.a }</div>;
				}
			}
			spy(Inner.prototype, 'render');

			return asyncRender(<Outer />)
			.then(() => {
				expect(Outer.prototype.getChildContext).to.have.been.calledOnce;
				expect(Inner.prototype.render).to.have.been.calledWith(match({}), {}, CONTEXT);
			})
			.then(() => {
				CONTEXT.foo = 'bar';
				return asyncRender(<Outer {...PROPS} />);
			})
			.then(() => {
				expect(Outer.prototype.getChildContext).to.have.been.calledTwice;
				expect(Inner.prototype.render).to.have.been.calledWith(match(PROPS), {}, CONTEXT);
			});
		});

		it('should pass context to direct children', () => {
			const CONTEXT = { a:'a' };
			const PROPS = { b:'b' };

			class Outer extends Component {
				getChildContext() {
					return CONTEXT;
				}
				render(props) {
					return <Inner {...props} />;
				}
			}
			spy(Outer.prototype, 'getChildContext');

			class Inner extends Component {
				render(props, state, context) {
					return <div>{ context && context.a }</div>;
				}
			}
			spy(Inner.prototype, 'render');

			asyncRender(<Outer />)
			.then(() => {
				expect(Outer.prototype.getChildContext).to.have.been.calledOnce;
				expect(Inner.prototype.render).to.have.been.calledWith(match({}), {}, CONTEXT);
			})
			.then(() => {
				CONTEXT.foo = 'bar';
				return asyncRender(<Outer {...PROPS} />);
			})
			.then(() => {
				expect(Outer.prototype.getChildContext).to.have.been.calledTwice;
				expect(Inner.prototype.render).to.have.been.calledWith(match(PROPS), {}, CONTEXT);

				// make sure render() could make use of context.a
				expect(Inner.prototype.render).to.have.returned(match({ children:['a'] }));
			});
		});

		it('should preserve existing context properties when creating child contexts', () => {
			let outerContext = { outer:true },
				innerContext = { inner:true };
			class Outer extends Component {
				getChildContext() {
					return { outerContext };
				}
				render() {
					return <div><Inner /></div>;
				}
			}

			class Inner extends Component {
				getChildContext() {
					return { innerContext };
				}
				render() {
					return <InnerMost />;
				}
			}

			class InnerMost extends Component {
				render() {
					return <strong>test</strong>;
				}
			}

			spy(Inner.prototype, 'render');
			spy(InnerMost.prototype, 'render');

			return asyncRender(<Outer />)
			.then(() => {
				expect(Inner.prototype.render).to.have.been.calledWith(match({}), {}, { outerContext });
				expect(InnerMost.prototype.render).to.have.been.calledWith(match({}), {}, { outerContext, innerContext });
			});
		});
	});

	describe('High-order components', () => {
		class Outer extends Component {
			render({ children, ...props }) {
				return <Inner {...props} a="b">child <span>{ children }</span></Inner>;
			}
		}

		class Inner extends Component {
			render({ children, ...props }) {
				return <div id="inner" {...props} b="c" c="d">{ children }</div>;
			}
		}

		it('should resolve+render high order components', () =>
			asyncRender(<Outer a="a" b="b" p={1}>foo</Outer>)
			.then(shouldBe('<div id="inner" a="b" b="c" p="1" c="d">child <span>foo</span></div>'))
		);


		it('should render nested high order components when shallowHighOrder=false', () => {
			// using functions for meaningful generation of displayName
			function Outer() { return <Middle />; }
			function Middle() { return <div><Inner /></div>; }
			function Inner() { return 'hi'; }

			return Promise.all([
				asyncRender(<Outer />).then(shouldBe('<div>hi</div>')),
				asyncRender(<Outer />, null, { shallow:true }).then(shouldBe('<Middle></Middle>','{shallow:true}')),
				asyncRender(<Outer />, null, { shallow:true, shallowHighOrder:false })
				.then(shouldBe(
					'<div><Inner></Inner></div>', 'but it should never render nested grandchild components',
					'{shallow:true,shallowHighOrder:false}'
				))
			]);
		});
	});

	describe('dangerouslySetInnerHTML', () => {
		it('should support dangerouslySetInnerHTML', () => {
			// some invalid HTML to make sure we're being flakey:
			let html = '<a href="foo">asdf</a> some text <ul><li>foo<li>bar</ul>';
			return asyncRender(<div id="f" dangerouslySetInnerHTML={{__html:html}} />)
			.then(shouldBe(`<div id="f">${html}</div>`));
		});

		it('should override children', () =>
			asyncRender(<div dangerouslySetInnerHTML={{__html:'foo'}}><b>bar</b></div>)
			.then(shouldBe('<div>foo</div>'))
		);
	});

	describe('className / class massaging', () => {
		it('should render class using className', () =>
			asyncRender(<div className="foo bar" />)
			.then(shouldBe('<div class="foo bar"></div>'))
		);

		it('should render class using class', () =>
			asyncRender(<div class="foo bar" />)
			.then(shouldBe('<div class="foo bar"></div>'))
		);

		it('should prefer class over className', () =>
			asyncRender(<div class="foo" className="foo bar" />)
			.then(shouldBe('<div class="foo"></div>'))
		);

		it('should stringify object classNames', () =>
			Promise.all([
				asyncRender(<div class={{ foo:1, bar:0, baz:true, buzz:false }} />)
					.then(shouldBe('<div class="foo baz"></div>', 'class')),

				asyncRender(<div className={{ foo:1, bar:0, baz:true, buzz:false }} />)
					.then(shouldBe('<div class="foo baz"></div>', 'className'))
			])
		);
	});

	describe('sortAttributes', () => {
		it('should leave attributes unsorted by default', () =>
			asyncRender(<div b1="b1" c="c" a="a" b="b" />)
			.then(shouldBe('<div b1="b1" c="c" a="a" b="b"></div>'))
		);

		it('should sort attributes lexicographically if enabled', () =>
			asyncRender(<div b1="b1" c="c" a="a" b="b" />, null, { sortAttributes:true })
			.then(shouldBe('<div a="a" b="b" b1="b1" c="c"></div>'))
		);
	});

	describe('xml:true', () => {
		let renderXml = jsx => asyncRender(jsx, null, { xml:true });

		it('should render end-tags', () =>
			Promise.all([
				renderXml(<div />).then(shouldBe(`<div />`)),
				renderXml(<a />).then(shouldBe(`<a />`)),
				renderXml(<a>b</a>).then(shouldBe(`<a>b</a>`))
			])
		);

		it('should render boolean attributes with named values', () =>
			renderXml(<div foo bar />).then(shouldBe(`<div foo="foo" bar="bar" />`))
		);

		it('should exclude falsey attributes', () =>
			renderXml(<div foo={false} bar={0} />).then(shouldBe(`<div bar="0" />`))
		);
	});
	describe('returning Promises from componentWillMount', () => {
		class Test extends Component {
			componentWillMount() {
				return new Promise(resolve => {
					setTimeout(() => {
						resolve({foo: 'bar'});
					},1);
				});
			}
			render(props) {
				return <div {...props} />;
			}
		}
		it('should wait for the async properties to be fetched', () => {
			return asyncRender(<Test />)
			.then(shouldBe('<div foo="bar"></div>'));
		});
		it('should merge the extra properties with existing', () => {
			return asyncRender(<Test hello="world" />, null, { sortAttributes:true })
			.then(shouldBe('<div foo="bar" hello="world"></div>'));
		});
		it('should render children normally', () => {
			return asyncRender(<Test hello="world">baaz</Test>, null, { sortAttributes:true })
			.then(shouldBe('<div foo="bar" hello="world">baaz</div>'));
		});
	});
});
