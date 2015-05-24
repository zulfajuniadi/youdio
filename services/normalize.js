var path = require('path');
require('dotenv').config({path: path.join(__dirname, '../.env')});
var db = require(path.join(__dirname, '../lib/db'));
var fs = require('fs');
var Queue = require('bull');
var child = require('child_process');
var mp3Length = require('mp3-length');
var normalizeQueue = Queue('normalize queue',process.env.REDIS_PORT, process.env.REDIS_HOST);
var uploadQueue = Queue('upload queue',process.env.REDIS_PORT, process.env.REDIS_HOST);

module.exports = function() {

  console.log('normalize:started');

  normalizeQueue.process(function(job, done) {

    console.log('normalize:process:detect: ' + job.data.id + '.m4a');

    var srcFile = path.join(__dirname, '../tmp', job.data.id, job.data.id + '.m4a');
    var dstFile = srcFile.replace('.m4a', '.mp3');

    if(!fs.existsSync(srcFile))
      return done();

    child.execFile('/usr/local/bin/ffmpeg', [
      '-i', srcFile, '-af', 'volumedetect', '-f', 'null', '/dev/null'
    ], function(err, stdout, stderr) {

      var volume = stderr.split("\n").filter(function(line){
        return line.indexOf('mean_volume') > -1;
      }).pop().split(']').pop().split(':').pop().replace(/[A-Za-z\s]/g, '');

      if(volume.charAt(0) == '-') {
        volume = parseInt(volume.substr(1), 10);
      } else {
        volume = parseInt('-' + volume, 10);
      };

      volume = -5 - volume; // set mean volume to 5db

      if(fs.existsSync(dstFile))
        fs.unlinkSync(dstFile);

      console.log('normalize:process:volume: ' + job.data.id + '.m4a');
      job.progress(5);

      child.execFile('/usr/local/bin/ffmpeg', [
        '-i', srcFile, '-af', 'volume=' + volume + 'dB', '-acodec', 'libmp3lame', '-ab', '128k', dstFile
      ], function(){
        mp3Length(dstFile, function(err, secs){
          fs.stat(dstFile, function(err, stat) {
            console.log('normalize:done: ' + job.data.id + '.m4a');
            job.data.duration = secs;
            job.data.normalized = 100;
            job.data.size = stat.size;
            db.write(job.data.filePath, job.data);
            fs.unlinkSync(srcFile);
            job.progress(100);
            uploadQueue.add(job.data);
            done();
          });
        })
      })
    });
  });

};
