const steem = require('steem')
steem.config.set('websocket','wss://steemd-int.steemitdev.com');
steem.api.setOptions({ url: 'https://api.steemit.com' });
steem.broadcast.transfer()