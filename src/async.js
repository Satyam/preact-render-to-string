import { objectKeys, encodeEntities, falsey, memoize, indent, isLargeString, styleObjToCss, hashToClassName, assign, getNodeProps } from './util';

const SHALLOW = { shallow: true };

// components without names, kept as a hash for later comparison to return consistent UnnamedComponentXX names.
const UNNAMED = [];

const EMPTY = {};

const VOID_ELEMENTS = [
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr'
];


function renderJsxToHtml(nodeName, attributes, opts, isSvgMode, isComponent) {
	// render JSX to HTML
	let s = '', html;

	if (attributes) {
		let attrs = objectKeys(attributes);

		// allow sorting lexicographically for more determinism (useful for tests, such as via preact-jsx-chai)
		if (opts && opts.sortAttributes===true) attrs.sort();

		for (let i=0; i<attrs.length; i++) {
			let name = attrs[i],
				v = attributes[name];
			if (name==='children') continue;
			if (!(opts && opts.allAttributes) && (name==='key' || name==='ref')) continue;

			if (name==='className') {
				if (attributes['class']) continue;
				name = 'class';
			}
			else if (isSvgMode && name.match(/^xlink\:?(.+)/)) {
				name = name.toLowerCase().replace(/^xlink\:?(.+)/, 'xlink:$1');
			}

			if (name==='class' && v && typeof v==='object') {
				v = hashToClassName(v);
			}
			else if (name==='style' && v && typeof v==='object') {
				v = styleObjToCss(v);
			}

			let hooked = opts.attributeHook && opts.attributeHook(name, v, context, opts, isComponent);
			if (hooked || hooked==='') {
				s += hooked;
				continue;
			}

			if (name==='dangerouslySetInnerHTML') {
				html = v && v.__html;
			}
			else if ((v || v===0 || v==='') && typeof v!=='function') {
				if (v===true || v==='') {
					v = name;
					// in non-xml mode, allow boolean attributes
					if (!opts || !opts.xml) {
						s += ' ' + name;
						continue;
					}
				}
				s += ` ${name}="${encodeEntities(v)}"`;
			}
		}
	}

	// account for >1 multiline attribute
	let sub = s.replace(/^\n\s*/, ' ');
	if (sub!==s && !~sub.indexOf('\n')) s = sub;
	else if (~s.indexOf('\n')) s += '\n';

	s = `<${nodeName}${s}>`;

	if (VOID_ELEMENTS.indexOf(nodeName)>-1) {
		s = s.replace(/>$/, ' />');
	}

	if (html) {
		// if multiline, indent.
		let pretty = opts.pretty,
			indentChar = typeof pretty==='string' ? pretty : '\t';
		if (pretty && isLargeString(html)) {
			html = '\n' + indentChar + indent(html, indentChar);
		}
		s += html;
	}
	return s;
}

// function renderChildren(nodeName, children, context, opts, isSvgMode, hasLarge) {
// 	let len = children && children.length,
// 		pieces = [],
// 		pretty = opts.pretty,
// 		indentChar = typeof pretty==='string' ? pretty : '\t';
//
// 	for (let i=0; i<len; i++) {
// 		let child = children[i];
// 		if (!falsey(child)) {
// 			let childSvgMode = nodeName==='svg' ? true : nodeName==='foreignObject' ? false : isSvgMode,
// 				ret = renderToString(child, context, opts, true, childSvgMode);
// 			if (!hasLarge && pretty && isLargeString(ret)) hasLarge = true;
// 			pieces.push(ret);
// 		}
// 	}
// 	if (hasLarge) {
// 		for (let i=pieces.length; i--; ) {
// 			pieces[i] = '\n' + indentChar + indent(pieces[i], indentChar);
// 		}
// 	}
// 	return pieces;
// }
//
// function renderComponent(vnode, context, opts) {
// 	let nodeName = vnode.nodeName,
// 		props = getNodeProps(vnode),
// 		rendered;
//
// 	if (!nodeName.prototype || typeof nodeName.prototype.render!=='function') {
// 		// stateless functional components
// 		rendered = nodeName(props, context);
// 	}
// 	else {
// 		// class-based components
// 		let c = new nodeName(props, context);
// 		c.props = props;
// 		c.context = context;
// 		if (c.componentWillMount) c.componentWillMount();
// 		rendered = c.render(c.props, c.state, c.context);
//
// 		if (c.getChildContext) {
// 			context = assign(assign({}, context), c.getChildContext());
// 		}
// 	}
//
// 	return renderToString(rendered, context, opts, opts.shallowHighOrder!==false);
//
// }
//
// /** The default export is an alias of `render()`. */
// export default function renderToString(vnode, context, opts, inner, isSvgMode) {
// 	let { nodeName, attributes, children } = vnode || EMPTY,
// 		isComponent = false;
// 	context = context || {};
// 	opts = opts || {};
//
// 	let pretty = opts.pretty,
// 		indentChar = typeof pretty==='string' ? pretty : '\t';
//
// 	if (vnode==null || vnode===false) {
// 		return '';
// 	}
//
// 	// #text nodes
// 	if (!nodeName) {
// 		return encodeEntities(vnode);
// 	}
//
// 	// components
// 	if (typeof nodeName==='function') {
// 		isComponent = true;
// 		if (opts.shallow && (inner || opts.renderRootComponent===false)) {
// 			nodeName = getComponentName(nodeName);
// 		}
// 		else {
// 			return renderComponent(vnode, context, opts);
// 		}
// 	}
//
// 	let s = renderJsxToHtml(nodeName, attributes, opts, isSvgMode, isComponent);
//
// 	const pieces = renderChildren(nodeName, children, context, opts, isSvgMode, ~s.indexOf('\n'));
//
// 	if (pieces.length) {
// 		s += pieces.join('');
// 	}
// 	else if (opts && opts.xml) {
// 		return s.substring(0, s.length-1) + ' />';
// 	}
//
// 	if (opts.jsx || VOID_ELEMENTS.indexOf(nodeName)===-1) {
// 		if (pretty && ~s.indexOf('\n')) s += '\n';
// 		s += `</${nodeName}>`;
// 	}
//
// 	return s;
// }

function renderChildren(nodeName, children, context, opts, isSvgMode, hasLarge) {
	let len = children && children.length,
		pieces = [],
		pretty = opts.pretty,
		indentChar = typeof pretty==='string' ? pretty : '\t';

	return Promise.all(children.map(child => {
		if (falsey(child)) return '\n';
		let childSvgMode = nodeName==='svg' ? true : nodeName==='foreignObject' ? false : isSvgMode;
		return asyncRender(child, context, opts, true, childSvgMode)
		.then(ret => {
			hasLarge = pretty && isLargeString(ret);
			return ret;
		});
	}))
	.then(pieces => (
		hasLarge
		? pieces.map(piece => '\n' + indentChar + indent(piece, indentChar))
		: pieces
	));
}

function renderComponent(vnode, context, opts) {
	let nodeName = vnode.nodeName,
		props = getNodeProps(vnode),
		rendered;

	if (!nodeName.prototype || typeof nodeName.prototype.render!=='function') {
		// stateless functional components
		rendered = nodeName(props, context);
		return asyncRender(rendered, context, opts, opts.shallowHighOrder!==false);
	}

	// class-based components
	let c = new nodeName(props, context),
		promisedProps;
	const doRender = newProps => {
		if (newProps) c.props = assign(assign({}, c.props), newProps);

		rendered = c.render(c.props, c.state, c.context);

		if (c.getChildContext) {
			context = assign(assign({}, context), c.getChildContext());
		}
		return asyncRender(rendered, context, opts, opts.shallowHighOrder!==false);
	};

	c.props = props;
	c.context = context;
	if (c.componentWillMount) promisedProps = c.componentWillMount();
	if (promisedProps && typeof promisedProps.then === 'function') {
		return promisedProps.then(doRender);
	}
	return Promise.resolve(doRender());
}

export default function asyncRender(vnode, context, opts, inner, isSvgMode) {
	let { nodeName, attributes, children } = vnode || EMPTY,
		isComponent = false;
	context = context || {};
	opts = opts || {};

	let pretty = opts.pretty,
		indentChar = typeof pretty==='string' ? pretty : '\t';

	if (vnode==null || vnode===false) {
		return Promise.resolve('');
	}

	// #text nodes
	if (!nodeName) {
		return Promise.resolve(encodeEntities(vnode));
	}

	// components
	if (typeof nodeName==='function') {
		isComponent = true;
		if (opts.shallow && (inner || opts.renderRootComponent===false)) {
			nodeName = getComponentName(nodeName);
		}
		else {
			return renderComponent(vnode, context, opts);
		}
	}

	let s = renderJsxToHtml(nodeName, attributes, opts, isSvgMode, isComponent);



	return renderChildren(nodeName, children, context, opts, isSvgMode, ~s.indexOf('\n'))
	.then(pieces => {
		if (pieces.length) {
			s += pieces.join('');
		}
		else if (opts && opts.xml) {
			return s.substring(0, s.length-1) + ' />';
		}

		if (opts.jsx || VOID_ELEMENTS.indexOf(nodeName)===-1) {
			if (pretty && ~s.indexOf('\n')) s += '\n';
			s += `</${nodeName}>`;
		}
		return s;
	});
}

function getComponentName(component) {
	let proto = component.prototype,
		ctor = proto && proto.constructor;
	return component.displayName || component.name || (proto && (proto.displayName || proto.name)) || getFallbackComponentName(component);
}

function getFallbackComponentName(component) {
	let str = Function.prototype.toString.call(component),
		name = (str.match(/^\s*function\s+([^\( ]+)/) || EMPTY)[1];
	if (!name) {
		// search for an existing indexed name for the given component:
		let index = -1;
		for (let i=UNNAMED.length; i--; ) {
			if (UNNAMED[i]===component) {
				index = i;
				break;
			}
		}
		// not found, create a new indexed name:
		if (index<0) {
			index = UNNAMED.push(component) - 1;
		}
		name = `UnnamedComponent${index}`;
	}
	return name;
}
