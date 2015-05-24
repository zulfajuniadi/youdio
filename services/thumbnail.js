var path = require('path');
require('dotenv').config({path: path.join(__dirname, '../.env')});
var db = require(path.join(__dirname, '../lib/db'));
var fs = require('fs');
var async = require('async');
var Queue = require('bull');
var thumbnailQueue = Queue('thumbnail queue', process.env.REDIS_PORT, process.env.REDIS_HOST);
var normalizeQueue = Queue('normalize queue', process.env.REDIS_PORT, process.env.REDIS_HOST);

var s3 = require('s3');
var httpreq = require('httpreq');
 
var client = s3.createClient({
  maxAsyncS3: 20,     // this is the default 
  s3RetryCount: 3,    // this is the default 
  s3RetryDelay: 1000, // this is the default 
  multipartUploadThreshold: 20971520, // this is the default (20 MB) 
  multipartUploadSize: 15728640, // this is the default (15 MB) 
  s3Options: {
    accessKeyId: process.env.S3_KEYID,
    secretAccessKey: process.env.S3_KEY,
    region: 'ap-southeast-1'
  },
});

module.exports = function() {

  console.log('thumbnail: started');

  thumbnailQueue.process(function(job, done){
    
    console.log('thumbnail:process: ' + job.data.id);

    async.forEach(Object.keys(job.data.thumbnails), function(key, callback){

      var fileName = job.data.thumbnails[key].url.split('/').pop();
      var file = path.join(__dirname, '../tmp', job.data.id, fileName);

      httpreq.get(job.data.thumbnails[key].url, {binary: true}, function (err, res){
        if (err){
          console.log('thumbnail:error: ' + err);
        }else{
          fs.writeFileSync(file, res.body);
          job.data.thumbnails[key].url = 'https://s3-ap-southeast-1.amazonaws.com/youdio/streams/' + job.data.id + '/' + fileName;
          db.write(job.data.filePath, job.data);
        }
        callback();
      });

    }, function(){
      console.log('thumbnail:done: ' + job.data.id);
      normalizeQueue.add(job.data);
      done();
    })

  });
}