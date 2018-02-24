import steem from 'steem';
import { ALL_USERS } from './constants';
import Responder from './responder';

class SteemBotCore {
  constructor({username, postingKey, activeKey, config}, keystone) {
    this.username = username;
    this.postingKey = postingKey;
    this.activeKey = activeKey;
    this.config = config;
    this.BotPost = keystone.list('BotPosts').model
	  
	setTimeout( () => {
		this.init();
	},500)
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
      steem.api.getAccountHistory(this.username, -1, 0, (err, result) => {
          if (err)
              errCall()

          var transfer = result[0][1].op[0] === 'transfer' ? result[0][1].op[1] : false

          if (transfer === false
            || transfer.amount.split(' ')[1] !== 'SBD'
            || transfer.to !== this.username
          ) {
              errCall()
          } else {
              steem.broadcast.transfer(
                  this.activeKey,
                  this.username,
                  transfer.from,
                  transfer.amount,
                  'Please try again later',
                  function (err, res) {
                      errCall()
                  }
              )
          }
      });
  }
  
  init() {
  	new TransferListner(this.username, this.BotPost)
	new TransferQueue( (doc) => {
		this.handleTransferOperation(doc)
	}, this.BotPost)
  }
}

class TransferQueue {
	constructor (callback, BotPost) {
		this.callback = callback
		this.BotPost = BotPost
		this.init()
	}
	
	init () {
		setInterval( () => {
			BotPosts.find({ done: false }).exec((err, docs) => {
				docs.forEach( (doc) => this.giveDocument(doc))
			})
		}, 15000)
	}
	
	giveDocument (doc) {
		doc.tries++
		
		if (doc.tries === 3) 
			doc.doRefund = true
		
		doc.save(() => {
			this.callback(doc)
		})
	}
}

class TransferListner {
	constructor(username, BotPost) {
		this.username = username
		this.BotPost = BotPost
		
		this.init()
	}

	init() {
		setInterval(() => {
			steem.api.getAccountHistory(this.username, -1, 5, (err, res) => {
				res.forEach(i => new Promise((resolve, reject) => this.handleTransaction(i, resolve, reject)))
			}).then(() => {
	
			})
		}, 10000)
	}

	handleTransaction(i, resolve, reject) {
		if (i.op[0] === 'transfer') {
			if (i.op[1].to === this.username || i.op[1].from !== 'smartsteem') {
				this.BotPost.findOne({trx_id: i.trx_id})
					.exec((err, result) => {
						if (result !== null) {
							this.giveDocument(result, resolve, reject)
						} else {
							this.createDocument(i, resolve, reject)
						}
					})
			} else reject()
		} else reject()
	}

	createDocument(i, resolve, reject) {
		const transaction = i.op[1]

		this.giveDocument(
			new BotPost({
					trx_id: i.trx_id,
					amount: transaction.amount,
					from: transaction.from,
					to: transaction.to,
					memo: transaction.memo
				}
			))
	}

	giveDocument(doc, resolve, reject) {
		doc.save(function () {
			if (err)
				reject()
			else
				resolve(doc)
		})
	}
}

export default SteemBotCore;
