(function($, window, document, undefined) {
	var $body = $("html, body"),
		consl = (window.console || false),
		defaults = {
			anchors: "a",
			prefetch: false,
			blacklist: ".no-smoothstate, [target]",
			development: false,
			pageCacheSize: 0,
			alterRequestUrl: function(url) {
				return url
			},
			onStart: {
				duration: 0,
				render: function(url, $container) {}
			},
			onProgress: {
				duration: 0,
				render: function(url, $container) {
					$body.css("cursor", "wait");
					$body.find("a").css("cursor", "wait")
				}
			},
			onEnd: {
				duration: 0,
				render: function(url, $container, $content) {
					$body.css("cursor", "auto");
					$body.find("a").css("cursor", "auto");
					$container.html($content)
				}
			},
			callback: function(url, $container, $content) {}
		},
		utility = {
			isExternal: function(url) {
				var match = url.match(/^([^:\/?#]+:)?(?:\/\/([^\/?#]*))?([^?#]+)?(\?[^#]*)?(#.*)?/);
				if (typeof match[1] === "string" && match[1].length > 0 && match[1].toLowerCase() !== window.location.protocol) {
					return true
				}
				if (typeof match[2] === "string" && match[2].length > 0 && match[2].replace(new RegExp(":(" + {
					"http:": 80,
					"https:": 443
				}[window.location.protocol] + ")?$"), "") !== window.location.host) {
					return true
				}
				return false
			},
			isHash: function(url) {
				var hasPathname = (url.indexOf(window.location.pathname) > 0) ? true : false,
					hasHash = (url.indexOf("#") > 0) ? true : false;
				return (hasPathname && hasHash) ? true : false
			},
			shouldLoad: function($anchor, blacklist) {
				var url = $anchor.prop("href");
				return (!utility.isExternal(url) && !utility.isHash(url) && !$anchor.is(blacklist))
			},
			htmlDoc: function(html) {
				var parent, elems = $(),
					matchTag = /<(\/?)(html|head|body|title|base|meta)(\s+[^>]*)?>/ig,
					prefix = "ss" + Math.round(Math.random() * 100000),
					htmlParsed = html.replace(matchTag, function(tag, slash, name, attrs) {
						var obj = {};
						if (!slash) {
							elems = elems.add("<" + name + "/>");
							if (attrs) {
								$.each($("<div" + attrs + "/>")[0].attributes, function(i, attr) {
									obj[attr.name] = attr.value
								})
							}
							elems.eq(-1).attr(obj)
						}
						return "<" + slash + "div" + (slash ? "" : " id='" + prefix + (elems.length - 1) + "'") + ">"
					});
				if (!elems.length) {
					return $(html)
				}
				if (!parent) {
					parent = $("<div/>")
				}
				parent.html(htmlParsed);
				$.each(elems, function(i) {
					var elem = parent.find("#" + prefix + i).before(elems[i]);
					elems.eq(i).html(elem.contents());
					elem.remove()
				});
				return parent.children().unwrap()
			},
			clearIfOverCapacity: function(obj, cap) {
				if (!Object.keys) {
					Object.keys = function(obj) {
						var keys = [],
							k;
						for (k in obj) {
							if (Object.prototype.hasOwnProperty.call(obj, k)) {
								keys.push(k)
							}
						}
						return keys
					}
				}
				if (Object.keys(obj).length > cap) {
					obj = {}
				}
				return obj
			},
			getContentById: function(id, $html) {
				$html = ($html instanceof jQuery) ? $html : utility.htmlDoc($html);
				var $insideElem = $html.find(id),
					updatedContainer = ($insideElem.length) ? $.trim($insideElem.html()) : $html.filter(id).html(),
					newContent = (updatedContainer.length) ? $(updatedContainer) : null;
				return newContent
			},
			storePageIn: function(object, url, $html) {
				$html = ($html instanceof jQuery) ? $html : utility.htmlDoc($html);
				object[url] = {
					status: "loaded",
					title: $html.find("title").text(),
					html: $html
				};
				return object
			},
			triggerAllAnimationEndEvent: function($element, resetOn) {
				resetOn = " " + resetOn || "";
				var animationCount = 0,
					animationstart = "animationstart webkitAnimationStart oanimationstart MSAnimationStart",
					animationend = "animationend webkitAnimationEnd oanimationend MSAnimationEnd",
					eventname = "allanimationend",
					onAnimationStart = function(e) {
						if ($(e.delegateTarget).is($element)) {
							e.stopPropagation();
							animationCount++
						}
					},
					onAnimationEnd = function(e) {
						if ($(e.delegateTarget).is($element)) {
							e.stopPropagation();
							animationCount--;
							if (animationCount === 0) {
								$element.trigger(eventname)
							}
						}
					};
				$element.on(animationstart, onAnimationStart);
				$element.on(animationend, onAnimationEnd);
				$element.on("allanimationend" + resetOn, function() {
					animationCount = 0;
					utility.redraw($element)
				})
			},
			redraw: function($element) {
				$element.height(0);
				setTimeout(function() {
					$element.height("auto")
				}, 0)
			}
		},
		onPopState = function(e) {
			if (e.state !== null) {
				var url = window.location.href,
					$page = $("#" + e.state.id),
					page = $page.data("smoothState");
				if (page.href !== url && !utility.isHash(url)) {
					page.load(url, true)
				}
			}
		},
		SmoothState = function(element, options) {
			var $container = $(element),
				cache = {},
				currentHref = window.location.href,
				load = function(url, isPopped) {
					isPopped = isPopped || false;
					var hasRunCallback = false,
						callbBackEnded = false,
						responses = {
							loaded: function() {
								var eventName = hasRunCallback ? "ss.onProgressEnd" : "ss.onStartEnd";
								if (!callbBackEnded || !hasRunCallback) {
									$container.one(eventName, function() {
										updateContent(url)
									})
								} else {
									if (callbBackEnded) {
										updateContent(url)
									}
								}
								if (!isPopped) {
									window.history.pushState({
										id: $container.prop("id")
									}, cache[url].title, url)
								}
							},
							fetching: function() {
								if (!hasRunCallback) {
									hasRunCallback = true;
									$container.one("ss.onStartEnd", function() {
										options.onProgress.render(url, $container, null);
										setTimeout(function() {
											$container.trigger("ss.onProgressEnd");
											callbBackEnded = true
										}, options.onStart.duration)
									})
								}
								setTimeout(function() {
									if (cache.hasOwnProperty(url)) {
										responses[cache[url].status]()
									}
								}, 10)
							},
							error: function() {
								window.location = url
							}
						};
					if (!cache.hasOwnProperty(url)) {
						fetch(url)
					}
					options.onStart.render(url, $container, null);
					setTimeout(function() {
						$container.trigger("ss.onStartEnd")
					}, options.onStart.duration);
					responses[cache[url].status]()
				},
				updateContent = function(url) {
					var containerId = "#" + $container.prop("id"),
						$content = cache[url] ? utility.getContentById(containerId, cache[url].html) : null;
					if ($content) {
						document.title = cache[url].title;
						$container.data("smoothState").href = url;
						options.onEnd.render(url, $container, $content);
						$container.one("ss.onEndEnd", function() {
							options.callback(url, $container, $content)
						});
						setTimeout(function() {
							$container.trigger("ss.onEndEnd")
						}, options.onEnd.duration)
					} else {
						if (!$content && options.development && consl) {
							consl.warn("No element with an id of " + containerId + " in response from " + url + " in " + cache)
						} else {
							window.location = url
						}
					}
				},
				fetch = function(url) {
					if (cache.hasOwnProperty(url)) {
						return
					}
					cache = utility.clearIfOverCapacity(cache, options.pageCacheSize);
					cache[url] = {
						status: "fetching"
					};
					var requestUrl = options.alterRequestUrl(url) || url,
						request = $.ajax(requestUrl);
					request.success(function(html) {
						utility.storePageIn(cache, url, html);
						$container.data("smoothState").cache = cache
					});
					request.error(function() {
						cache[url].status = "error"
					})
				},
				hoverAnchor = function(event) {
					var $anchor = $(event.currentTarget),
						url = $anchor.prop("href");
					if (utility.shouldLoad($anchor, options.blacklist)) {
						event.stopPropagation();
						fetch(url)
					}
				},
				clickAnchor = function(event) {
					var $anchor = $(event.currentTarget),
						url = $anchor.prop("href");
					if (!event.metaKey && !event.ctrlKey && utility.shouldLoad($anchor, options.blacklist)) {
						event.stopPropagation();
						event.preventDefault();
						load(url)
					}
				},
				bindEventHandlers = function($element) {
					$element.on("click", options.anchors, clickAnchor);
					if (options.prefetch) {
						$element.on("mouseover touchstart", options.anchors, hoverAnchor)
					}
				},
				toggleAnimationClass = function(classname) {
					var classes = $container.addClass(classname).prop("class");
					$container.removeClass(classes);
					setTimeout(function() {
						$container.addClass(classes)
					}, 0);
					$container.one("ss.onStartEnd ss.onProgressEnd ss.onEndEnd", function() {
						$container.removeClass(classname)
					})
				};
			options = $.extend(defaults, options);
			if (window.history.state === null) {
				window.history.replaceState({
					id: $container.prop("id")
				}, document.title, currentHref)
			}
			utility.storePageIn(cache, currentHref, document.documentElement.outerHTML);
			utility.triggerAllAnimationEndEvent($container, "ss.onStartEnd ss.onProgressEnd ss.onEndEnd");
			bindEventHandlers($container);
			return {
				href: currentHref,
				cache: cache,
				load: load,
				fetch: fetch,
				toggleAnimationClass: toggleAnimationClass
			}
		},
		declareSmoothState = function(options) {
			return this.each(function() {
				if (this.id && !$.data(this, "smoothState")) {
					$.data(this, "smoothState", new SmoothState(this, options))
				} else {
					if (!this.id && consl) {
						consl.warn("Every smoothState container needs an id but the following one does not have one:", this)
					}
				}
			})
		};
	window.onpopstate = onPopState;
	$.smoothStateUtility = utility;
	$.fn.smoothState = declareSmoothState
})(jQuery, window, document);
(function($) {
	var $body = $('html, body'),
		content = $('#main').smoothState({
			prefetch: 1,
			pageCacheSize: 4,
			onStart: {
				duration: 1000,
				render: function(url, $container) {
					content.toggleAnimationClass('animated lightSpeedOut')
				}
			},
			onEnd: {
				duration: 1000,
				render: function(url, $container, $content) {
					$body.css("cursor", "auto");
					$body.find("a").css("cursor", "auto");
					$container.html($content);
					$container.addClass("animated-half lightSpeedIn")
				}
			},
		}).data('smoothState');
	$("body").on("click", "#donate>i", function() {
		$(this).toggleClass("icon-moneybox icon-cross");
		$("#donate").toggleClass("active");
		$("#donate .donate-wrap").toggle(200);
		toggleform()
	});
	$("body").on("click", "#link-alipay", function() {
		$("#alipay-form").submit()
	})
})(jQuery);

function toggleform() {
	var form_content = ['<form action="https://shenghuo.alipay.com/send/payment/fill.htm" accept-charset="gbk" id="alipay-form" method="post" name="alipay-form" target="_blank">', '<input name="optEmail" type="hidden" value="a308057848@163.com" />', '<input name="memo" type="hidden" value="我喜欢这个应用,打赏 :)" />', '<input id="payAmount" name="payAmount" type="hidden" value="100.00" />', '<input id="title" name="title" type="hidden" value="捐赠给CL1024应用" />', '</form>'].join("\n");
	if ($("#alipay-form").length) {
		$("#alipay-form").remove()
	} else {
		$("#footer").append(form_content)
	}
}