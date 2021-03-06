/**
 * Module dependencies
 */

var History = require('history');
var shortcuts = require('shortcuts');
var isKey = require('is-key');
var debounce = require('debounce');
var cursorMove = require('cursor-move');
var events = require('events');
var selection = window.getSelection();
var selectionRange = require('selection-range');
var Emitter = require('emitter');

/**
 * Expose constructor
 */

module.exports = TextHistory;

/**
 * Edit History Constructor
 * 
 * @param {Element} el      
 * @param {Array} history 
 */

function TextHistory(el, history){
  if (!(this instanceof TextHistory)) return new TextHistory(el, history);
  this.el = el;
  this.addedToHistory = false;
  this.history = new History(history);
  this.bind();
}

Emitter(TextHistory.prototype);

/**
 * Bind events
 */

TextHistory.prototype.bind = function(){
  this.delayedHistory = debounce(this.prepareToAdd.bind(this), 1000);
  this.cursor = cursorMove(this.el);
  this._boundPrepare = this.prepareToAdd.bind(this);
  this.cursor.on('change', this._boundPrepare);
  this.shortcuts = shortcuts(this.el, this);
  this.shortcuts.bind('super + z', 'undo');
  this.shortcuts.bind('super + shift + z', 'redo');
  this.events = events(this.el, this);
  this.events.bind('keydown', 'onkeydown');
  this.events.bind('keypress', 'onkeypress');
  this.events.bind('paste', 'onchange');
  this.events.bind('cut', 'onchange');
};

/**
 * Unbind our events
 */

TextHistory.prototype.unbind = function(){
  this.cursor.unbind();
  this.events.unbind();
  this.shortcuts.unbind();
  this.cursor.off('change', this._boundPrepare);
};

/**
 * Normalize keypress to include del and backspace
 * 
 * @param  {Event} e 
 */

TextHistory.prototype.onkeydown = function(e){
  if (isKey(e, ['del', 'backspace'])){
    this.onkeypress();
  }
};

/**
 * onkeypress 
 * 
 * @param  {Event} e 
 */

TextHistory.prototype.onkeypress = function(e){
  if (!selection.isCollapsed || !this.addedToHistory) {
    this.addedToHistory = true;
    this.emit('add to history');
    this.add();
  }
  this.delayedHistory();
};

/**
 * paste & cut
 * 
 * @param  {Event} e 
 */

TextHistory.prototype.onchange = function(e){
  // todo: deal with paste & cut
};

/**
 * Contents to add to the string
 * 
 * @return {String} 
 */

TextHistory.prototype.contents = function(content){
  if (content) return this.el.innerHTML = content;
  return this.el.innerHTML;
};

/**
 * Add contents to history
 * 
 * @param {Boolean} stay at current history
 */

TextHistory.prototype.add = function(stay){
  this.firstUndo = true;
  var buf = new String(this.contents());
  var pos = selectionRange(this.el);
  if (pos) {
    buf.start = pos.start;
    if (pos.start != pos.end) {
      buf.end = pos.end;
    }
  }
  buf.start = buf.start || 0;
  var current = this.history.current();
  if (buf.valueOf() == (current && current.valueOf()) 
    && buf.start == current.start
    && buf.end == current.end
    ) return;
  this.history.add(buf, stay);
};

/**
 * Restore cursor to buf
 * 
 * @param  {String} buf 
 */

TextHistory.prototype.restoreCursor = function(buf){
  if (typeof buf.start != 'undefined'){
    if (buf.end) selectionRange(this.el, buf.start, buf.end);
    else selectionRange(this.el, buf.start);
  }
};

/**
 * Undo to previous history
 */

TextHistory.prototype.undo = function(e){
  if (e) {
    e.preventDefault();
    if (e.shiftKey) return;
  }

  if (this.firstUndo) {
    this.add(true);
    this.firstUndo = false;
  } else {
    this.history.back();
  }

  var buf = this.history.current();
  if (!buf) return;
  this.contents(buf);
  this.restoreCursor(buf);
  this.emit('undo', buf);
  this.emit('restore', buf);
};

/**
 * Redo history
 * 
 * @param  {Event} e 
 */

TextHistory.prototype.redo = function(e){
  if (e) e.preventDefault();
  this.firstUndo = false;
  this.history.forward();
  var buf = this.history.current();
  if (!buf) return;
  this.contents(buf);
  this.restoreCursor(buf);
  this.emit('redo', buf);
  this.emit('restore', buf);
};

/**
 * Add to history on next input
 */

TextHistory.prototype.prepareToAdd = function(){
  this.addedToHistory = false;
};
