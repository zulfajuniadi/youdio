var Youtube = require("youtube-api");
var path = require('path');
require('dotenv').config({path: path.join(__dirname, '../.env')});
var db = require(path.join(__dirname, '../lib/db'));
var async = require("async");
var fs = require("fs");
var Queue = require('bull');
var downloadQueue = Queue('download queue', process.env.REDIS_PORT, process.env.REDIS_HOST);

require('dotenv')
  .config({
    path: path.join(__dirname, '../.env')
  });

Youtube.authenticate({
  type: "key",
  key: process.env.API_KEY
});

async.each(process.env.CHANNELS.split(','), function(channelId, done) {

  async.waterfall([

    function(callback) {

      var opts = {
        channelId: channelId
      }

      var channel = db.read(channelId);
      if (!channel.lastDate) {
        channel = db.write(channelId, {
          lastDate: '1970-01-01T00:00:00.000Z'
        });
      }

      opts.channel = channel;

      callback(null, opts);

    },

    function(opts, callback) {

      var saved = 0;

      var doSearch = function(nextPageToken) {

        var searchOptions = {
          channelId: opts.channelId,
          order: 'date',
          part: 'snippet,id',
          maxResults: 50,
          publishedAfter: opts.channel.lastDate
        };

        if (nextPageToken) {
          searchOptions['pageToken'] = nextPageToken;
          delete searchOptions['publishedAfter'];
        }

        Youtube.search.list(searchOptions, function(err, data) {
          if (err) {
            console.error(searchOptions);
            callback(err);
            return;
          }

          data.items.forEach(function(item) {

            if (new Date(item.snippet.publishedAt) > new Date(opts.channel.lastDate)) {
              db.write(opts.channelId, {
                lastDate: item.snippet.publishedAt
              });
              opts.channel.lastDate = item.snippet.publishedAt;
            }

            if(item.id.videoId && !fs.existsSync(path.join(__dirname, '../.db/', opts.channelId, item.id.videoId + '.json'))) {
              var filePath = opts.channelId + '/' + item.id.videoId;
              var video = db.write(filePath, {
                id: item.id.videoId,
                filePath: filePath,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnails: item.snippet.thumbnails,
                publishedAt: item.snippet.publishedAt,
                url: null,
                downloaded: 0,
                normalized: 0,
                uploaded: 0,
                plays: 0,
                rating: 0,
                ratings: [],
                favories: [],
                laters: [],
                updatedAt: (new Date).toISOString(),
                deletedAt: null,
              });
              downloadQueue.add(video);
              saved = saved+1;
            }
          })

          if (data.nextPageToken) {
            doSearch(data.nextPageToken);
          } else {
            console.log(opts.channelId + ': ' + saved + ' items saved');
            callback(null, opts);
          }
        })
      }
      doSearch(null);
    }

  ], function() {
    done();
  });

}, function() {
  downloadQueue.close();
});