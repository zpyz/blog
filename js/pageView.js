layui.extend({}).define(['jquery'], function (exports) {
    var MOD_NAME = 'pageView';
    var $ = layui.jquery;

    var pages = '';
    var appDiv;
    var prevPath = '';
    var pageInfo = {};
    var widgetCache = {};
    var dataStorage = {};

    function correctRouter(href) {
        if (!/^\//.test(href)) href = '/' + href;
        return href.replace(/^(\/+)/, '/').replace(new RegExp('\/' + 'index' + '$'), '/');
    }

    function renderPage() {
        var router = layui.router();
        var path = router.path;
        var pathUrl = correctRouter(path.join('/'));

        if (!path.length) path = [''];
        if (path[path.length - 1] === '') path[path.length - 1] = 'index';
        pageInfo = {
            path: pathUrl,
            hash: router.hash,
            search: router.search,
        };
        if (pathUrl === prevPath) {
            layui.event.call(this, MOD_NAME, 'change', pageInfo);
        } else {
            render(pathUrl);
            prevPath = pathUrl;
        }
    }

    function pageCache(view, cacheConf, html) {
        var pk = MOD_NAME + '$' + view + '@' + pages;
        if (typeof html === 'undefined') {
            var c = layui.data(pk);
            if ((typeof c.v !== "undefined" && c.v === cacheConf.v) && (typeof c.expire === 'undefined' || c.expire > new Date().getTime())) {
                return c.html;
            } else {
                layui.data(pk, null);
                return undefined;
            }
        } else {
            if (cacheConf.v) {
                layui.data(pk, {key: 'v', value: cacheConf.v});
            }
            if (cacheConf.expire) {
                layui.data(pk, {key: 'expire', value: ((new Date()).getTime() + cacheConf.expire)});
            }
            layui.data(pk, {key: 'html', value: html})
        }
    }

    function replaceContent($el, $pageData, $template) {
        $template = $template || $pageData.find('template');
        var title = $pageData.find('title');
        if (title.length > 0) document.title = title.text();
        $el.html($template.html());
        $el.prepend($pageData.find('style'));
        $el.append($pageData.find('script'));
    }

    function render(view, conf) {
        replaceBlock(appDiv, view, conf);
    }

    function replaceBlock(el, view, conf) {
        var $el = $(el);
        conf = conf || {};
        if (view === '' || view === '/') view = '/index';
        if (conf.cache) {
            var cacheHtml = pageCache(view, conf.cache);
            if (cacheHtml) {
                replaceContent($el, $('<div>' + cacheHtml + '</div>'));
                return;
            }
        }
        $.ajax({
            url: pages + view + ".html",
            type: 'get',
            dataType: 'html',
            success: function (html) {
                var pageData = $('<div>' + html + '</div>');
                var template = pageData.find('template');
                if (template.length > 0) {
                    if (conf.cache) {
                        pageCache(view, conf.cache, html);
                    }
                    replaceContent($el, pageData, template);
                } else {
                    $el.html('<h1>404</h1>');
                }
            }, error: function (err) {
                console.log(err);
            }
        })
    }

    function prepareWidget(name, $pageData, $template) {
        if (!widgetCache[name]) {
            widgetCache[name] = {};
        }
        $template = $template || $pageData.find('template');
        widgetCache[name].html = $template.html();
        $(document.body).prepend($pageData.find('style'));
        $(document.body).append($pageData.find('script'));
    }

    function loadOneWidget(name, version, callback) {
        var widgetPath = "/widget/" + name + ".html";
        var cacheHtml = pageCache(widgetPath, {v: version});
        if (cacheHtml) {
            prepareWidget(name, $('<div>' + cacheHtml + '</div>'));
            if (typeof callback === 'function') callback();
            return;
        }
        $.ajax({
            url: pages + widgetPath,
            type: 'get',
            dataType: 'html',
            success: function (html) {
                var pageData = $('<div>' + html + '</div>');
                var template = pageData.find('template');
                if (template.length > 0) {
                    pageCache(widgetPath, {v: version}, html);
                    prepareWidget(name, pageData, template);
                    if (typeof callback === 'function') callback();
                }
            }, error: function (err) {
                console.log(err);
            }
        })
    }

    function loadWidget(name, version, callback) {
        if (uu.isArray(name)) {
            var i = 0;
            var cb = function () {
                i++;
                if (i < name.length && typeof name[i] !== "undefined") {
                    loadOneWidget(name[i], version, cb);
                } else {
                    if (typeof callback === 'function') callback();
                }
            };
            loadOneWidget(name[i], version, cb);
        } else {
            loadOneWidget(name, version, callback);
        }
    }

    function defineWidget(name, callback) {
        widgetCache[name].builder = callback;
    }

    function widget(el, name, param) {
        var $el = $(el);
        if (typeof name === "undefined" && typeof param === "undefined") {
            return $el.data('pageWidget');
        }
        if (widgetCache[name]) {
            var Builder = widgetCache[name].builder;
            $el.html(widgetCache[name].html);
            if (typeof Builder === 'function') {
                var handler = new Builder($el, param);
                $el.data('pageWidget', handler);
                $el.attr('widget', name);
                if (typeof handler.created === "function") {
                    handler.created();
                }
                return handler;
            }
        }
    }

    function publish(evtName, data) {
        layui.event(MOD_NAME, 'publish(' + evtName + ')', data);
    }

    function subscribe(evtName, callback) {
        return layui.onevent(MOD_NAME, 'publish(' + evtName + ')', callback);
    }

    function data() {
        if (arguments.length === 0) {
            return dataStorage;
        } else if (arguments.length === 1) {
            return dataStorage[arguments[0]];
        } else {
            dataStorage[arguments[0]] = arguments[1];
        }
    }

    function getPageInfo() {
        return pageInfo;
    }

    function buildPath(path, search, hash) {
        path = path || '';
        search = search || {};
        hash = hash || '';
        for (var s in search) {
            if (search.hasOwnProperty(s)) {
                path += ('/' + s + '=' + search[s]);
            }
        }
        if (hash) {
            path += ('#' + hash);
        }
        return path;
    }

    function navigate(path, search, hash) {
        window.location.hash = '#' + buildPath(path, search, hash);
    }

    function config(options) {
        pages = options.pages;
        appDiv = $(options.el);

        $(function () {
            renderPage();
        });

        $(window).on('hashchange', function (e) {
            renderPage();
        });
    }

    var pageView = {
        config: config,
        data: data,
        loadWidget: loadWidget,
        defineWidget: defineWidget,
        widget: widget,
        replaceBlock: replaceBlock,
        render: renderPage,
        publish: publish,
        subscribe: subscribe,
        getPageInfo: getPageInfo,
        buildPath: buildPath,
        navigate: navigate,
        on: function (events, callback) {
            return layui.onevent.call(this, MOD_NAME, events, callback);
        }
    };

    exports('pageView', pageView);
});
