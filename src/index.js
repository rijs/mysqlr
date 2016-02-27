// -------------------------------------------
// Loads resources from the /resources folder
// -------------------------------------------
export default function mysql(ripple){
  log('creating')
  strip(ripple.types['application/data'])
  key('adaptors.mysql', d => init(ripple))(ripple)
  return ripple
}

const init = ripple => config => {
  const con = require('mysql').createPool(config)
  escape = con.escape.bind(con)
  
  return {
    add   : exec('add')(con)
  , update: exec('update')(con)
  , remove: exec('remove')(con)
  }
}

const exec = type => con => ripple => (res, index, value) => { 
  const table = header('table')(res)
      , p = promise()
    
  if (!index) return load(con)(ripple)(res)
  if (!table) return
  
  var levels = index.split('.')
    , record = levels.length === 1 
             ? (levels.shift(), value) 
             : res.body[levels.shift()]
    , field  = levels.shift()

  if (field) record = key(['id', field])(record)
  if (!is.obj(record) 
  || levels.length 
  || (field && !is.in(res.headers.fields)(field))) 
    return log('cannot generate SQL for', res.name, index)

  const sql = sqls[type](table, key(res.headers.fields)(record))
  log('SQL', sql.grey)
  con.query(sql, (e, rows) => {
    if (e) return err(type, table, 'failed', e)
    log(type.green.bold, table, 'done', rows.insertId ? str(rows.insertId).grey : '')
  
    rows.insertId 
      ? p.resolve(value.id = rows.insertId)
      : p.resolve()
  })

  return p
}

const load = con => ripple => res => { 
  const table = header('table')(res) || res.name
      , p = promise()
  
  if (key(loaded)(res)) return
  key(loaded, true)(res)

  con.query(`SHOW COLUMNS FROM ${table}`, (e, rows) => {
    if (e && e.code == 'ER_NO_SUCH_TABLE') return log('no table', table), key('headers.table', '')(res)
    if (e) return err(table, e)
    key('headers.fields', rows.map(key('Field')))(res)
    key('headers.table', table)(res)

    con.query(`SELECT * FROM ${table}`, (e, rows) => {
      if (e) return err(table, e)
      log('got', table, rows.length)
      ripple({ name: res.name, body: rows })
    })

  })
}

const sqls = {
  add(name, body) { return 'INSERT INTO {table} ({keys}) VALUES ({values});'
    .replace('{table}', name)
    .replace('{keys}', keys(body)
      .filter(not(is('id')))
      .map(prepend('`'))
      .map(append('`'))
      .join(',')
    )
    .replace('{values}', keys(body)
      .filter(not(is('id')))
      .map(from(body))
      .map(escape)
      .join(',')
    )
  }
, update(name, body) { return 'UPDATE {table} SET {kvpairs} WHERE id = {id};'
    .replace('{table}', name)
    .replace('{id}', body['id'])
    .replace('{kvpairs}', keys(body)
      .filter(not(is('id')))
      .map(kvpair(body))
      .join(',')
    )
  }
, remove(name, body) { return 'DELETE FROM {table} WHERE id = {id};'
    .replace('{table}', name)
    .replace('{id}', body['id'])
  }
}

const kvpair = arr => key => '`' + key + "`=" + escape(arr[key])

const strip = type => {
  type.to = proxy(type.to, ({ name, body, headers }) => { 
    const stripped = {}

    keys(headers)
      .filter(not(is('fields')))
      .filter(not(is('mysql')))
      .filter(not(is('table')))
      .map(header => stripped[header] = headers[header])

    return { name, body, headers: stripped } 
  })
}

import { default as from } from 'utilise/from'
import identity from 'utilise/identity'
import promise from 'utilise/promise'
import prepend from 'utilise/prepend'
import append from 'utilise/append'
import header from 'utilise/header'
import client from 'utilise/client'
import proxy from 'utilise/proxy'
import wrap from 'utilise/wrap'
import keys from 'utilise/keys'
import key from 'utilise/key'
import not from 'utilise/not'
import str from 'utilise/str'
import is from 'utilise/is'
const loaded = 'headers.mysql.loaded'
    , log = require('utilise/log')('[ri/mysql]')
    , err = require('utilise/err')('[ri/mysql]')
var escape