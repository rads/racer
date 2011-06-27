wrapTest = require('./util').wrapTest
assert = require('assert')
util = require('util')
EventEmitter = require('events').EventEmitter
_ = require('../lib/util')
Model = require('../lib/Model')

model = (environment) ->
  _.onServer = environment == 'server'
  new Model()

ServerSocketMock = ->
  self = this
  clients = this._clients = []
  self.on 'connection', (client) ->
    clients.push client.browserSocket
    client._serverSocket = self
  self.broadcast = (message) ->
    clients.forEach (client) ->
      client.emit 'message', message
util.inherits ServerSocketMock, EventEmitter

ServerClientMock = (browserSocket) ->
  self = this
  self.browserSocket = browserSocket
  self.broadcast = (message) ->
    self._serverSocket._clients.forEach (client) ->
      if browserSocket != client
        client.emit 'message', message
util.inherits ServerClientMock, EventEmitter

BrowserSocketMock = ->
  self = this
  serverClient = new ServerClientMock self
  self.connect = ->
    serverSocket.emit 'connection', serverClient
  self.send = (message) ->
    serverClient.emit 'message', message
util.inherits BrowserSocketMock, EventEmitter

module.exports =
  'test Model server and browser models sync': ->
    serverModel = model 'server'
    browserModel1 = model 'browser'
    browserModel2 = model 'browser'
    serverSocket = new ServerSocketMock()
    browserSocket1 = new BrowserSocketMock()
    browserSocket2 = new BrowserSocketMock()
    serverModel._setSocket serverSocket
    browserModel1._setSocket browserSocket1
    browserModel2._setSocket browserSocket2

    serverModel.set 'color', 'red'
    serverModel.get().should.eql color: 'red'
    browserModel1.get().should.eql color: 'red'
    browserModel2.get().should.eql color: 'red'