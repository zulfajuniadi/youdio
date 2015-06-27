var path = require('path');
require('dotenv').config({path: path.join(__dirname, '../.env')});
var db = require(path.join(__dirname, '../lib/db'));
var fs = require("fs");
var rimraf = require("rimraf");
var Queue = require('bull');
var ytdl = require('youtube-dl');
var diskusage = require('diskusage');

var downloadQueue  = Queue('download queue', process.env.REDIS_PORT, process.env.REDIS_HOST);
var thumbnailQueue = Queue('thumbnail queue', process.env.REDIS_PORT, process.env.REDIS_HOST);


module.exports = function() {

  console.log('download:started');
  downloadQueue.process(function(job, done) {
    diskusage.check('/', function(err, info) {
      if(info.free / info.total < 0.2) {
        console.log('download:skipped due to available space');
        setTimeout(function() {
          console.log('download:retrying');
          job.retry();
        }, 5 * 60 * 1000);
      } else {
        try {
          console.log('download:start: ' + job.data.id);
          var video = ytdl('http://www.youtube.com/watch?v=' + job.data.id, 
            ['--extract-audio', '--audio-format=m4a', '--write-thumbnail', '--retries=3', '--output='+ job.data.id + '.m4a']);

          var dir = path.join(__dirname, '../tmp', job.data.id);

          if(fs.existsSync(dir))
            rimraf.sync(dir);

          fs.mkdirSync(dir);

          var size = 0;
          video.on('info', function(info) {
            var ext = info._filename.split('.').pop();
            size = info.size;
            console.log('download:process: ' + job.data.id);
            var output = path.join(dir, job.data.id + '.' + ext);
            video.pipe(fs.createWriteStream(output));
          });

          var pos = 0;
          video.on('data', function(data) {
            pos += data.length;
            if (size) {
              var percent = (pos / size * 100).toFixed(2);
              job.data.downloaded = percent;
              job.progress(percent);
              db.write(job.data.filePath, job.data);
            }
          });

          video.on('end', function() {
            job.data.youtube_url = 'http://www.youtube.com/watch?v=' + job.data.id;
            job.data.downloaded = 100;
            db.write(job.data.filePath, job.data);
            console.log('download:done: ' + job.data.id);
            thumbnailQueue.add(job.data);
            done();
          });
        } catch (e) {
          console.error(e);
          job.retry();
        }
      }
    });

  });

};
