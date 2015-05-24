var path = require('path');
require('dotenv').config({path: path.join(__dirname, '../.env')});
var db = require(path.join(__dirname, '../lib/db'));
var fs = require('fs');
var Queue = require('bull');
var child = require('child_process');
var uploadQueue = Queue('upload queue', process.env.REDIS_PORT, process.env.REDIS_HOST);
var publishQueue = Queue('publish queue',process.env.REDIS_PORT, process.env.REDIS_HOST);

var s3 = require('s3');
var rimraf = require('rimraf');
 
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

  console.log('upload:started');

  uploadQueue.process(function(job, done){

    var srcFolder = path.join(__dirname, '../tmp/', job.data.id);

    console.log('upload:process: ' + job.data.id);

    var params = {
      localDir: srcFolder,
      s3Params: {
        Bucket: 'youdio',
        Prefix: 'streams/' + job.data.id,
        ACL: 'public-read',
      },
    };
    var uploader = client.uploadDir(params);
    uploader.on('error', function(err) {
      console.error('upload:error: ', err.stack);
    });
    uploader.on('progress', function() {
      job.progress((uploader.progressAmount / uploader.progressTotal * 100).toFixed(2));
    });
    uploader.on('end', function() {
      job.data.uploaded = 100;
      job.data.url = s3.getPublicUrlHttp('youdio', 'streams/' + job.data.id + '/' + job.data.id + '.mp3');
      db.write(job.data.filePath, job.data);
      rimraf.sync(srcFolder);
      console.log('upload:done: ' + job.data.id);
      publishQueue.add(job.data);
      done();
    });

  });

}