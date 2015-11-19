// -------------------------------------------
// Loads resources from the /resources folder
// -------------------------------------------
export default function mysql(ripple){
  log('creating')
  strip(ripple.types['application/data'])
  key('adaptors.mysql', wrap(init(ripple)))(ripple)
  return ripple
}

function init(ripple) {
  return config => {
    var con = require('mysql').createPool(config)
    escape = con.escape.bind(con)
    
    return {
      push: exec('push')(con)
    , update: exec('update')(con)
    , remove: exec('remove')(con)
    , load: load(con)
    }
  }
}

function exec(type) {
  return (con) => {
    return (ripple) => {
      return (res, index, value) => {
        var p = promise()
          , table = header('table')(res)
          
        if (!table) return
        if (!is.obj(value)) return
        var sql = sqls[type](table, key(res.headers.fields)(value))

        con.query(sql, function(e, rows) {
          if (e) return err(type, table, 'failed', e)
          log(type.green.bold, table, 'done', rows.insertId ? str(rows.insertId).grey : '')
        
          rows.insertId 
            ? p.resolve(value.id = rows.insertId)
            : p.resolve()
        })

        return p
      }
    }
  }
}

function load(con){
  return (ripple) => {
    return (res) => { 
      var p = promise(), table = header('table')(res) || res.name
      
      con.query(`SHOW COLUMNS FROM ${table}`, function(e, rows) {
        if (e && e.code == 'ER_NO_SUCH_TABLE') return log('no table', table), key('headers.table', '')(res)
        if (e) return err(table, e)
        key('headers.fields', rows.map(key('Field')))(res)
        key('headers.table', table)(res)

        con.query(`SELECT * FROM ${table}`, function(e, rows) {
          if (e) return err(table, e)
          log('got', table, rows.length)
          ripple({ name: res.name, body: rows })
        })

      })

    }
  }
}

var sqls = {
  push: function(name, body) {
    var template = 'INSERT INTO {table} ({keys}) VALUES ({values});'
    template = template.replace('{table}', name)
    template = template.replace('{keys}', Object
      .keys(body)
      .filter(not(is('id')))
      .join(',')
    )
    template = template.replace('{values}', Object
      .keys(body)
      .filter(not(is('id')))
      .map(from(body))
      .join(',')
    )
    log(template.grey)
    return template
  }
, update: function(name, body) {
    // TODO This should produe a minimal statement via diff
    var template = 'UPDATE {table} SET {kvpairs} WHERE id = {id};'
    template = template.replace('{table}', name)
    template = template.replace('{id}', body['id'])
    template = template.replace('{kvpairs}', Object
      .keys(body)
      .filter(not(is('id')))
      .map(kvpair(body))
      .join(',')
    )
    log(template.grey)
    return template
  }
, remove: function(name, body) {
    var template = 'DELETE FROM {table} WHERE id = {id};'
    template = template.replace('{table}', name)
    template = template.replace('{id}', body['id'])
    log(template.grey)
    return template
  }
}

function kvpair(arr) {
  return function(key){
    return key+"="+escape(arr[key])
  }
}

function strip(type){
  type.to = proxy(type.to, ({ name, body, headers }) => { 
    var stripped = {}

    keys(headers)
      .filter(not(is('fields')))
      .filter(not(is('table')))
      .map(header => stripped[header] = headers[header])

    return {
      name
    , body
    , headers: stripped
    } 
  })
}

import { default as from } from 'utilise/from'
import identity from 'utilise/identity'
import promise from 'utilise/promise'
import header from 'utilise/header'
import client from 'utilise/client'
import proxy from 'utilise/proxy'
import wrap from 'utilise/wrap'
import keys from 'utilise/keys'
import key from 'utilise/key'
import not from 'utilise/not'
import str from 'utilise/str'
import is from 'utilise/is'
var log = require('utilise/log')('[ri/mysql]')
  , err = require('utilise/err')('[ri/mysql]')
  , escape