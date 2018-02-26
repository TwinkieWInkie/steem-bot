'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _steem = require('steem');

var _steem2 = _interopRequireDefault(_steem);

var _constants = require('./constants');

var _responder = require('./responder');

var _responder2 = _interopRequireDefault(_responder);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SteemBotCore = function () {
	function SteemBotCore(_ref, keystone) {
		var _this = this;

		var username = _ref.username,
		    postingKey = _ref.postingKey,
		    activeKey = _ref.activeKey,
		    config = _ref.config;

		_classCallCheck(this, SteemBotCore);

		this.username = username;
		this.postingKey = postingKey;
		this.activeKey = activeKey;
		this.config = config;
		this.BotPost = keystone.list('BotPosts').model;

		setTimeout(function () {
			_this.init();
		}, 500);
	}

	_createClass(SteemBotCore, [{
		key: 'handlePostOperation',
		value: function handlePostOperation(op) {
			if (this.config.post && typeof this.config.post.handler === 'function') {
				var _config$post = this.config.post,
				    targets = _config$post.targets,
				    handler = _config$post.handler;

				var responder = new _responder2.default({
					targetUsername: op.author,
					targetPermlink: op.permlink,
					responderUsername: this.username,
					postingKey: this.postingKey,
					activeKey: this.activeKey
				});

				if (typeof targets === 'string' && targets === _constants.ALL_USERS) {
					handler(op, responder);
				} else if (targets.includes(op.author)) {
					handler(op, responder);
				}
			}
		}
	}, {
		key: 'handleCommentOperation',
		value: function handleCommentOperation(op) {
			if (this.config.comment && typeof this.config.comment.handler === 'function') {
				var _config$comment = this.config.comment,
				    targets = _config$comment.targets,
				    handler = _config$comment.handler;

				var responder = new _responder2.default({
					targetUsername: op.author,
					targetPermlink: op.permlink,
					responderUsername: this.username,
					postingKey: this.postingKey,
					activeKey: this.activeKey
				});

				if (typeof targets === 'string' && targets === _constants.ALL_USERS) {
					handler(op, responder);
				} else if (targets.includes(op.author)) {
					handler(op, responder);
				}
			}
		}
	}, {
		key: 'handleTransferOperation',
		value: function handleTransferOperation(op) {
			if (this.config.deposit && typeof this.config.deposit.handler === 'function') {
				var _config$deposit = this.config.deposit,
				    targets = _config$deposit.targets,
				    handler = _config$deposit.handler;

				var responder = new _responder2.default({
					targetUsername: op.from,
					targetPermlink: '',
					responderUsername: this.username,
					postingKey: this.postingKey,
					activeKey: this.activeKey,
					transferMemo: op.memo
				});

				if (typeof targets === 'string' && targets === _constants.ALL_USERS) {
					handler(op, responder);
				} else if (targets.includes(op.to)) {
					handler(op, responder);
				}
			}
		}
	}, {
		key: 'fatalRefund',
		value: function fatalRefund(errCall) {
			var _this2 = this;

			_steem2.default.api.getAccountHistory(this.username, -1, 0, function (err, result) {
				if (err) errCall();

				var transfer = result[0][1].op[0] === 'transfer' ? result[0][1].op[1] : false;

				if (transfer === false || transfer.amount.split(' ')[1] !== 'SBD' || transfer.to !== _this2.username) {
					errCall();
				} else {
					_steem2.default.broadcast.transfer(_this2.activeKey, _this2.username, transfer.from, transfer.amount, 'Please try again later', function (err, res) {
						errCall();
					});
				}
			});
		}
	}, {
		key: 'init',
		value: function init() {
			var _this3 = this;

			new TransferListner(this.username, this.BotPost);
			new TransferQueue(function (doc) {
				_this3.handleTransferOperation(doc);
			}, this.BotPost);
		}
	}]);

	return SteemBotCore;
}();

var TransferQueue = function () {
	function TransferQueue(callback, BotPost) {
		_classCallCheck(this, TransferQueue);

		this.callback = callback;
		this.BotPost = BotPost;
		this.init();
	}

	_createClass(TransferQueue, [{
		key: 'init',
		value: function init() {
			var _this4 = this;

			setInterval(function () {
				_this4.BotPost.find({ done: false }).exec(function (err, docs) {
					docs.forEach(function (doc) {
						return _this4.giveDocument(doc);
					});
				});
			}, 15000);
		}
	}, {
		key: 'giveDocument',
		value: function giveDocument(doc) {
			var _this5 = this;

			doc.tries++;

			if (doc.tries > 3) doc.doRefund = true;

			doc.save(function (err) {
				console.log(err);
				console.log(doc);
				_this5.callback(doc);
			});
		}
	}]);

	return TransferQueue;
}();

var TransferListner = function () {
	function TransferListner(username, BotPost) {
		_classCallCheck(this, TransferListner);

		this.username = username;
		this.BotPost = BotPost;

		this.init();
	}

	_createClass(TransferListner, [{
		key: 'init',
		value: function init() {
			var _this6 = this;

			setInterval(function () {
				_steem2.default.api.getAccountHistory(_this6.username, -1, 5, function (err, res) {
					res.forEach(function (i) {
						return new Promise(function (resolve, reject) {
							return _this6.handleTransaction(i[1], resolve, reject).then(function () {
								return console.log('Success');
							}).catch(function (err) {
								return console.log(err);
							});
						});
					});
				});
			}, 10000);
		}
	}, {
		key: 'handleTransaction',
		value: function handleTransaction(i, resolve, reject) {
			var _this7 = this;

			if (i.op[0] === 'transfer') {
				if (i.op[1].to === this.username || i.op[1].from !== 'smartsteem') {
					this.BotPost.findOne({ trx_id: i.trx_id }).exec(function (err, result) {
						if (result !== null) {
							_this7.giveDocument(result, resolve, reject, i);
						} else {
							_this7.createDocument(i, resolve, reject);
						}
					});
				} else reject();
			} else reject();
		}
	}, {
		key: 'createDocument',
		value: function createDocument(i, resolve, reject) {
			var transaction = i.op[1];

			this.giveDocument(new this.BotPost({
				trx_id: i.trx_id,
				amount: transaction.amount,
				from: transaction.from,
				to: transaction.to,
				memo: transaction.memo
			}), resolve, reject, i);
		}
	}, {
		key: 'giveDocument',
		value: function giveDocument(doc, resolve, reject, i) {
			doc.save(function (err) {
				if (err) reject();else this.alreadyUpvoted(i, doc).then(function () {
					return resolve(doc);
				}).catch(function (err) {
					return reject(err);
				});
			});
		}
	}, {
		key: 'alreadyUpvoted',
		value: function alreadyUpvoted(i, doc) {
			var _this8 = this;

			var memo = i.op[1].memo;

			var username = extractUsernameFromLink(transaction.memo);
			var permlink = extractPermlinkFromLink(transaction.memo);

			return Promise(function (resolve, reject) {
				return _steem2.default.api.getContent(username, permlink, function (err, res) {
					if (res.active_votes.map(function (i) {
						return i.voter === _this8.username;
					}).length >= 1) reject('already upvoted');else resolve(doc);
				});
			});
		}
	}]);

	return TransferListner;
}();

exports.default = SteemBotCore;


function extractUsernameFromLink(steemitLink) {
	var usernamePos = steemitLink.search(/\/@.+\//);
	if (usernamePos === -1) return;

	var firstPart = steemitLink.slice(usernamePos + 2); // adding 2 to remove "/@"
	return firstPart.slice(0, firstPart.search('/'));
}

function extractPermlinkFromLink(steemitLink) {
	var usernamePos = steemitLink.search(/\/@.+\//);
	if (usernamePos === -1) return;

	var firstPart = steemitLink.slice(usernamePos + 1); // adding 1 to remove the first "/"
	return firstPart.slice(firstPart.search('/') + 1).replace('/', '').replace('#', '');
}