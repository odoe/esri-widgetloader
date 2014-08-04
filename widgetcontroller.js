/*global define */
/*jshint laxcomma:true*/
define([
  'require',
  'dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/_base/array',
  'dojo/on',
  'dojo/Deferred',
  'dojo/Evented',
  'dojo/dom',
  'dojo/dom-construct',
  'dojo/dom-class',

  'dijit/_WidgetBase'
], function(
  require,
  declare, lang, arrayUtils,
  on, Deferred, Evented,
  dom, domConstruct, domClass,
  _WidgetBase
) {

  function head(x) {
    return x[0];
  }

  function target(opt) {
    return opt.target || document.body;
  }

  function addCss(css) {
    var style = dom.byId('esrijs-style');
    if (!style) {
      return domConstruct.create('style', {
        id: 'esrijs-style',
        type: 'text/css',
        innerHTML: css
      }, head(document.getElementsByTagName('head')));
    } else {
      style.innerHTML += css;
      return style;
    }
  }

  function domNode(opt) {
    return domConstruct.create('div', {
      id: opt.node
    });
  }

  function targetElem(domTarget) {
    if (domTarget === document.body) {
      return domTarget;
    } else {
      return dom.byId(domTarget);
    }
  }

  // TODO - not happy with how this pluck
  // works. Need to play with some more
  function pluck(type, arr) {
    var targets = []
      , cleanArray = [];
    for(var i = 0, item; (item = arr[i]); i++) {
      if (item.type === type) {
        targets.push(item);
      } else {
        cleanArray.push(item);
      }
    }
    return {
      targets: targets,
      array: cleanArray
    };
  }

  function message(item) {
    console.debug('widget loaded - ', item);
  }

  return declare([_WidgetBase, Evented], {

    constructor: function(options) {
      this.inherited(arguments);
      this.widgets = arrayUtils.filter(this.get('widgets'), function(w) {
        if (w.hasOwnProperty('enabled')) {
          return (w.enabled.toString() === 'true');
        } else {
          return true;
        }
      });
    },

    /**
     * Mimic a regular widget with ::startup
     * Will preload any required widgets and
     * load the map widget first by default.
     *
     * @public
     */
    startup: function() {
      var loaded = this._preload(this.get('widgets'));
      this.set('widgets', loaded.array);
      var plucked = pluck('map', this.get('widgets'));
      this.set('widgets', plucked.array);
      arrayUtils.map(plucked.targets, this._loader, this);
    },

    /** private methods **/

    /**
     * Sets loaded to true and emits
     * "widget-loaded" event.
     *
     * @private
     */
    _init: function() {
      this.loaded = true;
      this.emit('widgets-loaded', {
        widgetCount: this.get('widgets').length
      });
    },

    /**
     * Will load the main map widget first and
     * and wait for it to finish loading
     * before loading other widgets.
     * NOTE - this is not esri/map, this should be
     * a widget that wraps map creation.
     *
     * @private
     * @param {Object} item
     */
    _loader: function(item) {
      this._widgetLoader(item).then(lang.hitch(this, function(map) {
        this.own(
          on.once(map, 'map-ready', lang.hitch(this, function(params) {
            if (this.get('widgets').length > 0) {
              for (var i = 0, widget; (widget = this.get('widgets')[i]); i++) {
                widget.options = widget.options || {};
                lang.mixin(widget.options, params);
                this._widgetLoader(widget).then(message);
              }
            }
            this._init();
          }))
        );
      }));
    },

    /**
     * Can preload widgets with type = "preload".
     * This is usually a widget that does not require
     * the map, like some navigation or menus.
     *
     * @private
     */
    _preload: function(widgets) {
      var preload = pluck('preload', widgets);
      for(var i = 0, item; (item = preload.targets[i]); i++) {
        item.options = item.options || {};
        lang.hitch(this, this._widgetLoader(item));
      }
      return preload;
    },

    /**
     * Default loader
     *
     * @private
     * @param {Object} widget
     */
    _widgetLoader: function(widget) {
      // TODO - not sure I need to do this mixin
      //lang.mixin(widget.options, this.options);
      return this._requireWidget(widget);
    },

    /**
     * Helper function to load widgets using require
     *
     * @private
     * @param {Object} widget
     */
    _requireWidget: function(widget) {
      var deferred = new Deferred();
      require([widget.path], function(Widget) {
        var node
          , handle
          , w;
        if (!!widget.node) {
          node = domNode(widget);
          domConstruct.place(node, targetElem(target(widget)));
        }
        if (widget.css) {
          addCss(widget.css);
        }
        w = new Widget(widget.options, node);
        deferred.resolve(w);
        handle = on.once(w, 'load', function() {
          handle.remove();
          if (widget.nodeVisible === false) {
            domClass.add(w.domNode, 'hidden');
          }
          if (widget.className) {
            domClass.add(w.domNode, widget.className);
          }
        });
        w.startup();
      });
      return deferred.promise;
    }

  });

});
