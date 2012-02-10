/*
 *  Copyright 2011 Rackspace
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

var events = require('events');
var fs = require('fs');
var util = require('util');
var path = require('path');

var async = require('async');
var log = require('logmagic').local('dreadnot');
var mkdirp = require('mkdirp');

var sprintf = require('./util/sprintf');

var errors = require('./errors');
var Stack = require('./stack').Stack;



function Dreadnot(config, stackdir) {
  log.info('using config', config);
  this.config = config;
  this.stackdir = stackdir;
  this._stacks = {};
  this.locks = {};
  this.emitter = new events.EventEmitter();
  this.warning = '';
  this.queue = async.queue(function(task, callback) {
    task(callback);
  }, 1);
}


Dreadnot.prototype._getStack = function(name) {
  if (!this._stacks[name]) {
    this._stacks[name] = new Stack(name, this, this.config);
  }

  return this._stacks[name];
};


Dreadnot.prototype.emit = function(id, data) {
  this.emitter.emit(id, data);
};


Dreadnot.prototype.lock = function(names, deployment, callback) {
  var i;

  // Check for conflicting locks
  for (i = 0; i < names.length; i++) {
    if (this.locks[names[i]]) {
      return new errors.StackLockedError(this.locks[names[i]]);
    }
  }

  // Set requested locks
  for (i = 0; i < names.length; i++) {
    this.locks[names[i]] = deployment;
  }

  return null;
};


Dreadnot.prototype.unlock = function(names) {
  var i;

  for (i = 0; i < names.length; i++) {
    delete this.locks[names[i]];
  }
};



/**
 * Set or clear a warning.
 *
 * @param {Object} user User object.
 * @param {String} text User Warning text.
 * @param {Function} callback Callback called with (err).
 */
Dreadnot.prototype.setWarning = function(user, text, callback) {
  var self = this;

  this.queue.push(function(callback) {
    fs.writeFile(path.join(self.config.data_root, 'warning.txt'), text, function(err) {
      var oldWarning = self.warning;

      if (!err) {
        self.warning = text;
        if (text) {
          log.warnf('warning set to "${text}"', {
            text: text
          });

          self.emitter.emit('warning.set', {'text': text, 'username': user.name});
        } else {
          log.info('warning cleared');

          self.emitter.emit('warning.removed', {'text': oldWarning, 'username': user.name});
        }
      }
      callback(err);
    });
  }, callback);
};


Dreadnot.prototype.getStack = function(name, callback) {
  var stack = this._stacks[name];
  if (!stack) {
    callback(new errors.NotFoundError('Stack not found'));
  } else {
    callback(null, stack);
  }
};


Dreadnot.prototype.init = function(callback) {
  var self = this,
      stackNames = Object.keys(this.config.stacks);

  async.series([
    mkdirp.bind(null, self.config.data_root, 493),

    function(callback) {
      fs.readFile(path.join(self.config.data_root, 'warning.txt'), 'utf8', function(err, text) {
        if (err && err.code !== 'ENOENT') {
          callback(err);
        } else {
          self.warning = err ? '' : text.replace(/^\s+|\s+$/g, '');
          if (self.warning) {
            log.warnf('warning set to "${text}"', {
              text: self.warning
            });
          } else {
            log.info('no warning set');
          }
          callback();
        }
      });
    },

    function(callback) {
      async.forEach(stackNames, function(stackName, callback) {
        self._getStack(stackName).init(callback);
      }, callback);
    }
  ], callback);
};


Dreadnot.prototype.getName = function() {
  return this.config.name;
};


Dreadnot.prototype.getSummary = function(callback) {
  callback(null, {name: this.config.env});
};


Dreadnot.prototype.getDetails = function(callback) {
  var self = this,
      stackNames = Object.keys(this.config.stacks);

  async.map(stackNames, function(stackName, callback) {
    self._getStack(stackName).getDetails(callback);
  },

  function(err, summaries) {
    callback(err, {
      name: self.config.env,
      stacks: summaries
    });
  });
};


Dreadnot.prototype.runningStatus = function(callback) {
  var self = this,
      stackNames = Object.keys(this.config.stacks);

  async.map(stackNames, function(stackName, callback) {
    self._getStack(stackName).runningStatus(callback);
  }, callback);
};


exports.Dreadnot = Dreadnot;
