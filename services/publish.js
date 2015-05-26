var path = require('path');
require('dotenv').config({path: path.join(__dirname, '../.env')});
var db = require(path.join(__dirname, '../lib/db'));
var fs = require("fs");
var Queue = require('bull');
var elasticsearch = require('elasticsearch');
var publishQueue = Queue('publish queue',process.env.REDIS_PORT, process.env.REDIS_HOST);

var client = new elasticsearch.Client({
  host: process.env.ELASTICSEARCH_SERVER,
  log: 'trace'
});

module.exports = function() {

  console.log('publish: started');

  publishQueue.process(function(job, done) {

    console.log('publish:process: ' + job.data.id);

    job.data.key = job.data.id;
    job.data.updatedAt = (new Date).toISOString();
    job.data.createdAt = (new Date).toISOString();
    
    client.create({
      index: 'youdio',
      type: 'videos',
      id: job.data.id,
      body: job.data
    }, function(err, response){
      console.log('publish:done: ' + job.data.id);
      done();
    });
    
  });

}
