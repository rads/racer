Promise = require '../../Promise'
DataField = require './Field'
{merge} = require '../../util'
{assignToUnflattened} = require '../../util/path'

# @constructor DataSchema
# @param {DataSource} source is the data source with which to associate this DataSchema
# @param {String} name is the name of the DataSchema
# @param {String} ns is the namespace of the DataSchema
# @param {Schema} LogicalSkema is the LogicalSchema subclass
# @param {Object} conf maps field names to field descriptors
# @param {Object} virtualsConf maps virtual field names to virtual field descriptors
DataSchema = module.exports = (@source, @name, ns, LogicalSkema, conf, virtualsConf) ->
  # Disable find, findOne if missing a namespace
  unless @ns = ns then @find = @findOne = null
  fields = @fields = {}
  self = this
  for fieldName, descriptor of conf
    # Add field to the data schema
    logicalPath  = fieldName
    logicalField = LogicalSkema?.fields[logicalPath]
    if descriptor instanceof DataSchema.Buffer
      do (descriptor, fieldName, logicalPath, logicalField) ->
        descriptor.onFlush = (bufferedDescriptor, DataSkema) ->
          dataField = self._createFieldFrom bufferedDescriptor, ns, fieldName, logicalField
          bootstrapField dataField, fieldName, fields, LogicalSkema, logicalPath
      continue
    dataField = @_createFieldFrom descriptor, ns, fieldName, logicalField
    bootstrapField dataField, fieldName, fields, LogicalSkema, logicalPath

  if virtualsConf then for fieldName, descriptor of virtualsConf
    logicalPath = fieldName
    logicalField = LogicalSkema?.fields[logicalPath]
    if descriptor instanceof DataSchema.Buffer
      do (descriptor, fieldName, logicalPath, logicalField) ->
        descriptor.onFlush = (bufferedDescriptor, DataSkema) ->
          virtualField = self._createVirtualFrom bufferedDescriptor, ns, fieldName, logicalField
          bootstrapField virtualField, fieldName, fields, LogicalSkema, logicalPath
      continue
    virtualField = @_createVirtualFrom descriptor, ns, fieldName, logicalField
    bootstrapField virtualField, fieldName, fields, LogicalSkema, logicalPath
  return

bootstrapField = (dataField, fieldName, fields, LogicalSkema, logicalPath) ->
  fields[fieldName] = dataField
  if LogicalSkema
    # TODO Place console.warn here? i.e., if dataField is undefined? See console.warn in QueryDispatcher
    LogicalSkema.fields[logicalPath].dataFields.push dataField

DataSchema:: =
  # shortcut for use in rvalues of other data source schemas
  # e.g.,
  #     CustomSchema.source(mongo, 'namespace', {
  #       _id: ObjectId
  #       someAttr: mysql.Skema.field('id')
  #     });
  field: (path) -> $pointsTo: @fields[path]

  cast: (val) ->
    fields = @fields
    for path, v of val
      type = fields[path].type
      if type.cast
        val[path] = type.cast v
    return val

  # Be able to act like a type
  createField: (opts) -> new DataField @, opts
  uncast: (val) ->
    fields = @fields
    for path, v of val
      field = fields[path]
      if field.type.uncast
        val[path] = field.type.uncast v
    return val

  # TODO addDataField ?

  # @param {Object} descriptor
  # @param {String|False} ns is the namespace relative to the data source (as
  #     opposed to the logical source schema). `false` means that this is to 
  #     be used for embedded docs
  # @param {String} path
  # @param {Field|undefined} logicalField
  _createFieldFrom: (descriptor, ns, path, logicalField) ->
    source = @source
    conf = {path, ns, logicalField, source}
    return conf unless type = source.inferType descriptor
    return type.createField conf

  _createVirtualFrom: (descriptor, ns, path, logicalField) ->
    source = @source
    {typeParams, fieldParams} = source.virtualParams descriptor
    virtualType = @types.baseType.extend 'Virtual', typeParams
    fieldParams = merge {path, ns, logicalField, source}, fieldParams
    return virtualType.createField fieldParams

  maybeDeferTranslateSet: (cmdSeq, doc, dataField, conds, path, val) ->
    return false unless cid = val.cid
    # Handle embedded docs
    pending = cmdSeq.pendingByCid[cid] ||= []
    op = ['set'].concat Array::slice.call(arguments, 1)
    pending.push op
    return true

  # TODO DRY - repeated in Mongo/types in baseType
  translateSet: (cmd, cmdSeq, path, val) ->
    val = @cast val if @cast
    switch cmd.method
      when 'update'
        set = cmd.val.$set ||= {}
        set[path] = val
      when 'insert'
        if -1 == path.indexOf '.'
          cmd.val[path] = val
        else
          assignToUnflattened cmd.val, path, val
      else
        throw new Error 'Implement for other incoming method ' + cmd.method
    return true


AbstractSchema = require '../AbstractSchema'
for _k, _v of AbstractSchema
  DataSchema::[_k] = _v

DataQuery = require './Query'
for queryMethodName, queryFn of DataQuery::
  continue unless typeof queryFn is 'function'
  do (queryMethodName, queryFn) ->
    DataSchema::[queryMethodName] = (args...)->
      query = new DataQuery @
      return queryFn.apply query, args

# Used to generate DataSchema.Buffer, which is used in DataSource::schema(schemaName) to buffer up methods invoked on an instance of DataSchema that has not yet been defined
bufferify = (Klass) ->
  klassProto = Klass::
  BufferKlass = -> return
  bufferKlassProto = BufferKlass::
  buffer = []
  for k, v of klassProto
    continue unless typeof v is 'function'
    do (k) ->
      bufferKlassProto[k] = (args...) ->
        buffer.push [k, args]
        return @
  if 'flush' of klassProto && typeof klassProto.flush is 'function'
    throw new Error 'Trying to over-write method `flush`'
  bufferKlassProto.flush = (klassInstance) ->
    val = klassInstance
    for [method, args], i in buffer
      val = val[method] args...
    @onFlush val, klassInstance
  return BufferKlass

DataSchema.Buffer = bufferify DataSchema

DataSchema.ABSTRACT = 'TODO'
DataSchema.EXCLUDE = 'TODO'

DataSchema::types =
  baseType:
    createField: (opts) -> new DataField @, opts

    extend: (name, conf) ->
      extType = Object.create @
      extType._name = name
      merge extType, conf
      return extType

    translateSet: (cmd, cmdSeq, path, val) ->
      val = @cast val if @cast
      switch cmd.method
        when 'update'
          set = cmd.val.$set ||= {}
          set[path] = val
        when 'insert'
          if -1 == path.indexOf '.'
            cmd.val[path] = val
          else
            assignToUnflattened cmd.val, path, val
        else
          throw new Error 'Implement for other incoming method ' + cmd.method
      return true