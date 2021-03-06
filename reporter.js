var yyyymmdd = require('yyyy-mm-dd')
var stripAnsi = require('strip-ansi')
var chalk = require('chalk')
var path = require('path')
var os = require('os')

var pkg = require('./package.json')

var PADDING = '        '
var SEPARATOR = os.EOL + os.EOL
var NEXT_LINE = os.EOL === '\n' ? '\r\v' : os.EOL

function rightPag (str, length) {
  var add = length - stripAnsi(str).length
  for (var i = 0; i < add; i++) str += ' '
  return str
}

function time (c) {
  return c.dim('at ' + yyyymmdd.withTime(module.exports.now()))
}

function line (c, label, color, message) {
  var labelFormat = c.bold[color].bgBlack.inverse
  var messageFormat = c.bold[color]

  return rightPag(labelFormat(label), 8) +
         messageFormat(message) + ' ' +
         time(c)
}

function info (c, str) {
  return line(c, ' INFO ', 'green', str)
}

function warn (c, str) {
  return line(c, ' WARN ', 'yellow', str)
}

function error (c, str) {
  return line(c, ' ERROR ', 'red', str)
}

function params (c, type, fields) {
  var max = 0
  var current
  for (var i = 0; i < fields.length; i++) {
    current = fields[i][0].length + 2
    if (current > max) max = current
  }
  return fields.map(function (field) {
    return PADDING + rightPag(field[0] + ': ', max) + c.bold(field[1])
  }).join(NEXT_LINE)
}

function errorParams (c, type, client) {
  if (!client) {
    return ''
  } else {
    var user = client.user ? client.user.id : 'unauthenticated'
    return params(c, 'error', [
      ['User ID', user],
      ['Node ID', client.nodeId || 'unknown'],
      ['Subprotocol', client.sync.otherSubprotocol || 'unknown'],
      ['IP address', client.remoteAddress]
    ])
  }
}

function note (c, str) {
  return PADDING + c.grey(str)
}

function prettyStackTrace (c, err, root) {
  if (root.slice(-1) !== path.sep) root += path.sep

  return err.stack.split('\n').slice(1).map(function (i) {
    i = i.replace(/^\s*/, PADDING)
    var match = i.match(/(\s+at [^(]+ \()([^)]+)\)/)
    if (!match || match[2].indexOf(root) !== 0) {
      return c.red(i)
    } else {
      match[2] = match[2].slice(root.length)
      if (match[2].indexOf('node_modules') !== -1) {
        return c.red(match[1] + match[2] + ')')
      } else {
        return c.yellow(match[1] + match[2] + ')')
      }
    }
  }).join(NEXT_LINE)
}

var reporters = {

  listen: function listen (c, app) {
    var url
    if (app.listenOptions.server) {
      url = 'Custom HTTP server'
    } else {
      url = (app.listenOptions.cert ? 'wss://' : 'ws://') +
        app.listenOptions.host + ':' + app.listenOptions.port
    }

    var dev = app.env === 'development'

    return [
      info(c, 'Logux server is listening'),
      params(c, 'info', [
        ['Logux server', pkg.version],
        ['PID', app.options.pid],
        ['Node ID', app.options.nodeId],
        ['Environment', app.env],
        ['Subprotocol', app.options.subprotocol],
        ['Supports', app.options.supports],
        ['Listen', url]
      ]),
      (dev ? note(c, 'Press Ctrl-C to shutdown server') : '')
    ]
  },

  connect: function connect (c, app, ip) {
    return [
      info(c, 'Client was connected'),
      params(c, 'info', [['IP address', ip]])
    ]
  },

  authenticated: function authenticated (c, app, client) {
    return [
      info(c, 'User was authenticated'),
      params(c, 'info', [
        ['User ID', client.user.id],
        ['Node ID', client.nodeId || 'unknown'],
        ['Subprotocol', client.sync.otherSubprotocol],
        ['Logux protocol', client.sync.otherProtocol.join('.')],
        ['IP address', client.remoteAddress]
      ])
    ]
  },

  disconnect: function disconnect (c, app, client) {
    var user = client.user ? client.user.id : 'unauthenticated'
    return [
      info(c, 'Client was disconnected'),
      params(c, 'info', [
        ['User ID', user],
        ['Node ID', client.nodeId || 'unknown'],
        ['IP address', client.remoteAddress]
      ])
    ]
  },

  destroy: function destroy (c) {
    return [
      info(c, 'Shutting down Logux server')
    ]
  },

  runtimeError: function runtimeError (c, app, client, err) {
    var prefix = err.name + ': ' + err.message
    if (err.name === 'Error') prefix = err.message
    return [
      error(c, prefix),
      prettyStackTrace(c, err, app.options.root),
      errorParams(c, 'error', client)
    ]
  },

  syncError: function syncError (c, app, client, err) {
    var prefix
    if (err.received) {
      prefix = 'SyncError from client: ' + err.description
    } else {
      prefix = 'SyncError: ' + err.description
    }
    return [
      error(c, prefix),
      errorParams(c, 'error', client)
    ]
  },

  clientError: function clientError (c, app, client, err) {
    return [
      warn(c, 'Client error: ' + err.description),
      errorParams(c, 'warn', client)
    ]
  }

}

module.exports = function (type, app) {
  var c = chalk
  if (app.env !== 'development') {
    c = new chalk.constructor({ enabled: false })
  }

  var reporter = reporters[type]
  var args = [c].concat(Array.prototype.slice.call(arguments, 1))

  return reporter.apply({ }, args).filter(function (i) {
    return i !== ''
  }).join(NEXT_LINE) + SEPARATOR
}

module.exports.now = function () {
  return new Date()
}
