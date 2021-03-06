import {meteorInstall} from "meteor/modules"


// For some reason meteor-node-stubs is not working, TODO create an issue.
// Here we are creating stubs packages to be availabe on the client side. This must be called before mocha require
// See an example from https://goo.gl/us9YVR

meteorInstall({
  node_modules: {
    "tty.js": function (r, e, module) {
      module.exports = { isatty: ()=>{ return false}}
    }
  }
});


meteorInstall({
  node_modules: {
    "fs.js": function (r, e, module) {
      module.exports = {
        existsSync: ()=>{},
        readdirSync: ()=>{},
        statSync: ()=>{},
        watchFile: ()=>{}
      }
    }
  }
});


meteorInstall({
  node_modules: {
    "constants.js": function (r, e, module) {
      module.exports = {
        test: {'test':'test'}
      }
    }
  }
});


// This is virtually a copy from <repo-dir>/support/browser-entry.js
export default (mocha, Mocha)=>{
  //
  // /**
  //  * Shim process.stdout.
  //  */
  //
  // process.stdout = require('browser-stdout')();

  /**
   * Save timer references to avoid Sinon interfering (see GH-237).
   */

  var Date = global.Date;
  var setTimeout = global.setTimeout;
  var setInterval = global.setInterval;
  var clearTimeout = global.clearTimeout;
  var clearInterval = global.clearInterval;

  var uncaughtExceptionHandlers = [];

  var originalOnerrorHandler = global.onerror;

  /**
   * Remove uncaughtException listener.
   * Revert to original onerror handler if previously defined.
   */

  process.removeListener = function(e, fn){
    if ('uncaughtException' == e) {
      if (originalOnerrorHandler) {
        global.onerror = originalOnerrorHandler;
      } else {
        global.onerror = function() {};
      }
      var i = Mocha.utils.indexOf(uncaughtExceptionHandlers, fn);
      if (i != -1) { uncaughtExceptionHandlers.splice(i, 1); }
    }
  };

  /**
   * Implements uncaughtException listener.
   */

  process.on = function(e, fn){
    if ('uncaughtException' == e) {
      global.onerror = function(err, url, line){
        fn(new Error(err + ' (' + url + ':' + line + ')'));
        return !mocha.allowUncaught;
      };
      uncaughtExceptionHandlers.push(fn);
    }
  };

// The BDD UI is registered by default, but no UI will be functional in the
// browser without an explicit call to the overridden `mocha.ui` (see below).
// Ensure that this default UI does not expose its methods to the global scope.
//   mocha.suite.removeAllListeners('pre-require');

  var immediateQueue = []
    , immediateTimeout;

  function timeslice() {
    var immediateStart = new Date().getTime();
    while (immediateQueue.length && (new Date().getTime() - immediateStart) < 100) {
      immediateQueue.shift()();
    }
    if (immediateQueue.length) {
      immediateTimeout = setTimeout(timeslice, 0);
    } else {
      immediateTimeout = null;
    }
  }

  /**
   * High-performance override of Runner.immediately.
   */

  Mocha.Runner.immediately = function(callback) {
    immediateQueue.push(callback);
    if (!immediateTimeout) {
      immediateTimeout = setTimeout(timeslice, 0);
    }
  };

  /**
   * Function to allow assertion libraries to throw errors directly into mocha.
   * This is useful when running tests in a browser because window.onerror will
   * only receive the 'message' attribute of the Error.
   */
  mocha.throwError = function(err) {
    Mocha.utils.forEach(uncaughtExceptionHandlers, function (fn) {
      fn(err);
    });
    throw err;
  };

  /**
   * Override ui to ensure that the ui functions are initialized.
   * Normally this would happen in Mocha.prototype.loadFiles.
   */

  mocha.ui = function(ui){
    Mocha.prototype.ui.call(this, ui);
    this.suite.emit('pre-require', global, null, this);
    return this;
  };

  /**
   * Setup mocha with the given setting options.
   */

  mocha.setup = function(opts){
    if ('string' == typeof opts) opts = { ui: opts };
    for (var opt in opts) this[opt](opts[opt]);
    return this;
  };

  /**
   * Run mocha, returning the Runner.
   */

  mocha.run = function(fn){
    var options = mocha.options;
    mocha.globals('location');

    var query = Mocha.utils.parseQuery(global.location.search || '');
    if (query.grep) mocha.grep(new RegExp(query.grep));
    if (query.fgrep) mocha.grep(query.fgrep);
    if (query.invert) mocha.invert();

    return Mocha.prototype.run.call(mocha, function(err){
      // The DOM Document is not available in Web Workers.
      var document = global.document;
      if (document && document.getElementById('mocha') && options.noHighlighting !== true) {
        Mocha.utils.highlightTags('code');
      }
      if (fn) fn(err);
    });
  };

  /**
   * Expose the process shim.
   * https://github.com/mochajs/mocha/pull/916
   */

  Mocha.process = process;
}
