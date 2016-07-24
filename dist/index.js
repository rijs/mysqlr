'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = mysql;

var _from = require('utilise/from');

var _from2 = _interopRequireDefault(_from);

var _identity = require('utilise/identity');

var _identity2 = _interopRequireDefault(_identity);

var _promise = require('utilise/promise');

var _promise2 = _interopRequireDefault(_promise);

var _prepend = require('utilise/prepend');

var _prepend2 = _interopRequireDefault(_prepend);

var _append = require('utilise/append');

var _append2 = _interopRequireDefault(_append);

var _header = require('utilise/header');

var _header2 = _interopRequireDefault(_header);

var _copy = require('utilise/copy');

var _copy2 = _interopRequireDefault(_copy);

var _keys = require('utilise/keys');

var _keys2 = _interopRequireDefault(_keys);

var _noop = require('utilise/noop');

var _noop2 = _interopRequireDefault(_noop);

var _key = require('utilise/key');

var _key2 = _interopRequireDefault(_key);

var _not = require('utilise/not');

var _not2 = _interopRequireDefault(_not);

var _str = require('utilise/str');

var _str2 = _interopRequireDefault(_str);

var _is = require('utilise/is');

var _is2 = _interopRequireDefault(_is);

/* istanbul ignore next */
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function mysql(ripple) {
  log('creating');
  var type = ripple.types['application/data'];
  type.to = strip(type.to);
  (0, _key2.default)('adaptors.mysql', function (d) {
    return init(ripple);
  })(ripple);
  return ripple;
}

var init = function init(ripple) {
  return function (config) {
    var con = require('mysql').createPool(config);
    escape = con.escape.bind(con);
    return {
      update: crud(ripple, con)('update'),
      remove: crud(ripple, con)('remove'),
      add: crud(ripple, con)('add'),
      load: load(ripple, con)
      // change: change(ripple, con)
    };
  };
};

var crud = function crud(ripple, con) {
  return function (type) {
    return function (name, record) {
      var res = ripple.resources[name],
          table = (0, _header2.default)('mysql.table')(res),
          fields = (0, _header2.default)('mysql.fields')(res),
          p = (0, _promise2.default)(),
          sql = void 0;

      if (!table) return deb('no table', name);
      if (!(sql = sqls[type](table, (0, _key2.default)(fields)(record)))) return deb('no sql', name);
      log('SQL', sql.grey);

      con.query(sql, function (e, rows) {
        if (e) return err(type, table, 'failed', e);
        log(type.green.bold, table, 'done', rows.insertId ? (0, _str2.default)(rows.insertId).grey : '');
        p.resolve(rows.insertId || record.id);
      });

      return p;
    };
  };
};

// const change = (ripple, con) => type => (res, change) => {
//   let levels = (change.key || '').split('.')
//     , xto    = header('mysql.xto')(res)
//     , index  = levels[0]
//     , field  = levels[1]
//     , record = change.value

//   if (!change.key) return load(ripple, con)(res)
//   if (!levels.length || levels.length > 2 || (field && !is.in(fields)(field))) return deb('cannot update', name, key)
//   if (xto && !xto(res, change)) return deb('skipping update', name)
//   if (field) record = key(['id', field])(res.body[index])
//   crud(ripple, con)(type)(res.name, record)
// }

var load = function load(ripple, con) {
  return function (name) {
    var res = ripple.resources[name],
        table = (0, _header2.default)('mysql.table')(res) || res.name,
        p = (0, _promise2.default)();

    con.query('SHOW COLUMNS FROM ' + table, function (e, rows) {
      if (e && e.code == 'ER_NO_SUCH_TABLE') return log('no table', table), (0, _key2.default)('headers.mysql.table', '')(res);
      if (e) return err(table, e);
      (0, _key2.default)('headers.mysql.fields', rows.map((0, _key2.default)('Field')))(res);
      (0, _key2.default)('headers.mysql.table', table)(res);

      con.query('SELECT * FROM ' + table, function (e, rows) {
        if (e) return err(table, e);
        log('got'.green, table, (0, _str2.default)(rows.length).grey);
        p.resolve(rows);
      });
    });

    return p;
  };
};

var sqls = {
  add: function add(name, body) {
    return 'INSERT INTO {table} ({keys}) VALUES ({values});'.replace('{table}', name).replace('{keys}', (0, _keys2.default)(body).filter((0, _not2.default)((0, _is2.default)('id'))).map((0, _prepend2.default)('`')).map((0, _append2.default)('`')).join(',')).replace('{values}', (0, _keys2.default)(body).filter((0, _not2.default)((0, _is2.default)('id'))).map((0, _from2.default)(body)).map(escape).join(','));
  },
  update: function update(name, body) {
    return (0, _keys2.default)(body).length == 1 && 'id' in body ? '' : 'UPDATE {table} SET {kvpairs} WHERE id = {id};'.replace('{table}', name).replace('{id}', body['id']).replace('{kvpairs}', (0, _keys2.default)(body).filter((0, _not2.default)((0, _is2.default)('id'))).map(kvpair(body)).join(','));
  },
  remove: function remove(name, body) {
    return 'DELETE FROM {table} WHERE id = {id};'.replace('{table}', name).replace('{id}', body['id']);
  }
};

var kvpair = function kvpair(arr) {
  return function (key) {
    return '`' + key + "`=" + escape(arr[key]);
  };
};

var strip = function strip(next) {
  return function (req) {
    var headers = {};

    (0, _keys2.default)(req.headers).filter((0, _not2.default)((0, _is2.default)('mysql'))).map((0, _copy2.default)(req.headers, headers));

    req.headers = headers;
    return (next || _identity2.default)(req);
  };
};

var log = require('utilise/log')('[ri/mysql]'),
    err = require('utilise/err')('[ri/mysql]'),
    deb = _noop2.default; //require('utilise/log')('[ri/mysql]')
var escape;