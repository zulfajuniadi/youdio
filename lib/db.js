
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var dbPath = path.join(__dirname, '../.db');

var read = function(name) {
  var fileName = path.join(dbPath, name) + '.json';
  if(!fs.existsSync(fileName)) {
    if(name.indexOf('/') > -1) {
      mkdirp.sync(path.dirname(fileName));
    }
    fs.writeFileSync(fileName, '{}');
  }
  return JSON.parse(fs.readFileSync(fileName));
}

var write = function(name, data) {
  var fileName = path.join(dbPath, name) + '.json';
  if(!fs.existsSync(fileName)) {
    if(name.indexOf('/') > -1) {
      mkdirp.sync(path.dirname(fileName));
    }
  }
  fs.writeFileSync(fileName, JSON.stringify(data));
  return read(name);
}

module.exports = {
  read: read,
  write: write
}