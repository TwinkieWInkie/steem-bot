import steem from 'steem';
import { ALL_USERS } from './constants';
import Responder from './responder';
import scraperjs from 'scraperjs'

class SteemBotCore {
  constructor({username, postingKey, activeKey, config}) {
    this.username = username;
    this.postingKey = postingKey;
    this.activeKey = activeKey;
    this.config = config;
    this.init();
  }

  handlePostOperation(op) {
    if (this.config.post && typeof(this.config.post.handler) === 'function') {
      const { targets, handler } = this.config.post;
      const responder = new Responder({
        targetUsername: op.author,
        targetPermlink: op.permlink,
        responderUsername: this.username,
        postingKey: this.postingKey,
        activeKey: this.activeKey,
      });

      if (typeof(targets) === 'string' && targets === ALL_USERS) {
        handler(op, responder);
      } else if (targets.includes(op.author)) {
        handler(op, responder);
      }
    }
  }

  handleCommentOperation(op) {
    if (this.config.comment && typeof(this.config.comment.handler) === 'function') {
      const { targets, handler } = this.config.comment;
      const responder = new Responder({
        targetUsername: op.author,
        targetPermlink: op.permlink,
        responderUsername: this.username,
        postingKey: this.postingKey,
        activeKey: this.activeKey,
      });

      if (typeof(targets) === 'string' && targets === ALL_USERS) {
        handler(op, responder);
      } else if (targets.includes(op.author)) {
        handler(op, responder);
      }
    }
  }

  handleTransferOperation(op) {
    if (this.config.deposit && typeof(this.config.deposit.handler) === 'function') {
      const { targets, handler } = this.config.deposit;
      const responder = new Responder({
        targetUsername: op.from,
        targetPermlink: '',
        responderUsername: this.username,
        postingKey: this.postingKey,
        activeKey: this.activeKey,
        transferMemo: op.memo,
      });

      if (typeof(targets) === 'string' && targets === ALL_USERS) {
        handler(op, responder);
      } else if (targets.includes(op.to)) {
        handler(op, responder);
      }
    }
  }

  fatalRefund(errCall) {
      steem.config.set('websocket','wss://steemd-int.steemitdev.com');
      steem.api.setOptions({ url: 'https://api.steemit.com' });

      const getTransfer = new Promise( () => {
          scraperjs.StaticScraper.create(
              'https://steemit.com/'
              + '@' + this.username
              + '/transfers')
              .scrape(($) => {
                  getTransfer.resolve($('.row:nth-of-type(9) tbody > tr .TransferHistoryRow__text')
                      .innerHTML
                      .replace(/<!--[^>]*-->/g, '')
                      .replace(/<[^>]*>/g, '')
                      .replace('  ', ' ')
                      .split(' ')
                  )
              })
      }).then( (transfer) => {
          if (transfer[0] == 'Receive' && transfer[2] == 'SBD') {
              const amount = Number(transfer[1])
              const to = transfer[4]

              steem.broadcast.transfer(
                  this.activeKey,
                  this.username,
                  to,
                  amount,
                  'Please try again',
                  (err, res) => {
                      console.log(err, res)

                      errCall()
                  }
               )
          }
      })
  }

  init() {
    steem.api.streamOperations((err, res) => {
      if (err) {
          this.fatalRefund( () => {
              throw(new Error('Something went wrong with streamOperations method of Steem-js'));
          })
      }

      const opType = res[0];
      const op = res[1];

      switch(opType) {
        case 'comment':
          // Both posts and comments are known as 'comment' in this API, so we recognize them by checking the
          // value of parent_author
          if (op.parent_author === '') {
            this.handlePostOperation(op);
          } else {
            this.handleCommentOperation(op);
          }
          break;
        case 'transfer':
          this.handleTransferOperation(op);
          break;
      }
    });
  }
}

export default SteemBotCore;
