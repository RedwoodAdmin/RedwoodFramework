
function Redwood() {
	var rw = this;
	
	rw.KEY = {
		__register__: "__register__",
		__pause__: "__pause__",
		__reset__: "__reset__",
		__delete__: "__delete__",
		__error__: "__error__",
		
		__set_config__: "__set_config__",
		__set_group__: "__set_group__",
		__set_period__: "__set_period__",
		__set_page__: "__set_page__",
		
		__router_status__: "__router_status__",
		__queue_start__: "__queue_start__",
		__queue_end__: "__queue_end__",
		
		__page_loaded__: "__page_loaded__",
		
		__set_points__: "__set_points__",
		__get_period__: "__get_period__",
	};
	
	var components = window.location.pathname.split("/");
	var sessionIndex = components.indexOf("session") + 1;
	rw.__session__ = parseInt(components[sessionIndex]);
	rw.__instance__ = (sessionIndex === 2 ? "" : "/" + components[1]);
	if (components[sessionIndex + 1] === "admin") {
		if (components.length > sessionIndex + 2) {
			rw.user_id = "listener";
		} else {
			rw.user_id = "admin";
		}
	} else {
		rw.user_id = components[sessionIndex + 2];
	}

	require(rw.__instance__ + '/static/js/random.js');
	require(rw.__instance__ + '/static/js/bootstrap.js');
	require(rw.__instance__ + '/static/js/bootstrap-modal.js');
	require(rw.__instance__ + '/static/js/domparser.js');
	require(rw.__instance__ + '/static/js/jquery.csv-0.7.min.js');
	
	rw.__listeners__ = {};
	
	rw.__connect__ = function() {
	
		var host = window.location.hostname;
		var port = 8080;
		var url = "ws://" + host + ":" + port + rw.__instance__ + "/" + rw.__session__ + "/" + rw.user_id;
		
		rw.__ws__ = new WebSocket(url);
		
		rw.__ws__.onopen = function() {
			
			// public
			rw.subjects = [];
			rw.points = {}; //by subject
			rw.groups = {}; //by subject
			rw.periods = {}; //by subject
			rw.pages = {}; //by subject
			rw.config = {};
			rw.configs = [];
			rw.queue = [];
			rw.time_delta = 0;
			rw.send = rw.__default_send__;
			
			rw.__sync__ = {in_progress: false};
			rw.__broadcast__({
				Key: rw.KEY.__router_status__,
				Value: {connected: true}
			});
			
			$("#redwood-error").modal("hide");
		};
	
		rw.__ws__.onerror = function(e) {
			rw.send = rw.__error_send__;
			rw.__broadcast__({
				Key: rw.KEY.__router_status__,
				Value: {connected: false, details: e}
			});
		}; // throw an error if a connection to the router can't be established
	
		rw.__ws__.onclose = function(e) {
			$("body").append(error_modal);
			if ($("#redwood-error").css("display") === "none") {
				$("#redwood-error").modal();
			}
			rw.send = rw.__error_send__;
			rw.__broadcast__({
				Key: rw.KEY.__router_status__,
				Value: {connected: false, details: e}
			});
			rw.__retry_connect__(10);
		};

		rw.__ws__.onmessage = function(ws_msg) {
			if(rw.__pending_reload__)
				return;
			var msg = JSON.parse(ws_msg.data);
			if(typeof REDWOOD2_MESSAGE_LOG !== 'undefined' && REDWOOD2_MESSAGE_LOG) {
				console.log(msg.Period
					+ ", " + msg.Group
					+ ", " + msg.Sender
					+ ", " + msg.Key
					+ ", " + msg.Value);
			}
			if(msg.Key === rw.KEY.__queue_start__) {
				rw.__nonce__ = msg.Nonce;
				rw.__sync__.in_progress = true;
				rw.__sync__.send = rw.send;
				rw.send = rw.__sync_send__;
				rw.__send_queue__ = [];
			} else if(msg.Key === rw.KEY.__queue_end__) {
				rw.__sync__.in_progress = false;
				rw.send = rw.__sync__.send;
				if(!rw.__is_reload__){
					rw.send(rw.KEY.__page_loaded__);
				}
				for(var i = 0, l = (rw.__send_queue__.length); i < l; i++) {
					//rw.send(rw.__send_queue__[i].key, rw.__send_queue__[i].value, rw.__send_queue__[i].args);
				}
			}
			if(rw.__sync__.in_progress && rw.__send_queue__.length > 0) {
				var queuedMsg = rw.convertToMessage(rw.__send_queue__[0].key, rw.__send_queue__[0].value, rw.__send_queue__[0].args);
				if(msg.Key === queuedMsg.Key && msg.Sender === queuedMsg.Sender) {
					rw.__send_queue__.shift();
				}
			}
			
			rw.__handle_msg__(msg);
			if (msg.Key === rw.KEY.__queue_end__) {
				rw.__is_reload__ = false;
			}
		};
	};
	
	rw.__retry_connect__ = function(t) {
		$("#connection-retry").text(t);
		if (t === 0) {
			rw.__connect__();
		} else {
			setTimeout(function() {
				rw.__retry_connect__(t - 1);
			}, 1000);
		}
	};
	
	rw.convertToMessage = function(key, value, args) {
		args = args || {};
		
		if (!('period' in args)) {
			args.period = rw.period;
		}
		if (!('group' in args)) {
			args.group = 0;
		}
		if (!('sender' in args)) {
			args.sender = rw.user_id;
		}
		
		return {
			Session: rw.__session__,
			Nonce: rw.__nonce__,
			Period: args.period,
			Group: args.group,
			Sender: args.sender,
			StateUpdate: args.state_update,
			Key: key,
			Value: value,
			ClientTime: new Date().getTime()
		};
	};
	
	rw.__default_send__ = function(key, value, args) {
		var msg = rw.convertToMessage(key, value, args);
		rw.__ws__.send(JSON.stringify(msg));
		return msg;
	};
	
	rw.__is_queueable__ = function(key) {
		return key.substring(0, 2) !== "__"
			||(key !== rw.KEY.__register__
			&& key !== rw.KEY.__pause__
			&& key !== rw.KEY.__reset__
			&& key !== rw.KEY.__delete__
			&& key !== rw.KEY.__error__
			
			&& key !== rw.KEY.__set_config__
			&& key !== rw.KEY.__set_group__
			&& key !== rw.KEY.__set_period__
			&& key !== rw.KEY.__set_page__
			
			&& key !== rw.KEY.__router_status__
			&& key !== rw.KEY.__queue_start__
			&& key !== rw.KEY.__queue_end__);
	};
	
	rw.__sync_send__ = function(key, value, args) {
		if(rw.__is_queueable__(key)) {
			rw.__send_queue__.push({key: key, value: value, args: args});
		}
	};
	
	rw.__error_send__ = function(key, value, args) {
		console.log("ERROR: Failed to send message: Key: " + key + " value: " + value);
	};
	
	rw.send = rw.__error_send__;
	
	rw.recv = function(key, f) {
		if (!(key in rw.__listeners__)) {
			rw.__listeners__[key] = [];
		}
		rw.__listeners__[key].push(f);
	};
	
	rw.recv_self = function(key, f) {
		rw.recv(key, function(msg){
			if(msg.Sender === rw.user_id)
				f(msg);
		});
	};
	
	rw.recv_others = function(key, f) {
		rw.recv(key, function(msg){
			if(msg.Sender !== rw.user_id)
				f(msg);
		});
	};
	
	rw.recv_subjects = function(key, f) {
		rw.recv(key, function(msg){
			if(msg.Sender && msg.Sender !== "admin")
				f(msg);
		});
	};
	
	rw.unbind = function(key, listener) {
		var i = rw.__listeners__[key].indexOf(listener);
		rw.__listeners__[key].splice(i, 1);
	};
	
	rw.on_sync_complete = function(f) {
		rw.recv(rw.KEY.__queue_end__, f);
	};
	
	rw.on_load = function(f) {
		rw.recv_self(rw.KEY.__page_loaded__, function(msg) {
			if(msg.Period === rw.period || (rw.user_id == "admin" && isNullOrUndefined(rw.period))) {
				f();
			}
		});
	};
	
	rw.__is_reload__ = false;
	rw.recv_self(rw.KEY.__page_loaded__, function(msg) {
		if(msg.Period === rw.period || isNullOrUndefined(rw.period)) {
			if(rw.__sync__.in_progress){
				rw.__is_reload__ = true;
			}
		}
	});
	
	rw.__get_period_callbacks__ = [];
	rw.recv('__get_period__', function(msg) {
		var callback = rw.__get_period_callbacks__.shift();
		if(callback) {
			callback(msg);
		}
	});
	rw.get_period = function(period, callback) {
		rw.__get_period_callbacks__.push(callback);
		rw.send('__get_period__', { period: period });
	};
	
	rw.get_outside_page = function(url) { // bypass cross-site security and retrieve a page from another domain
		var htmlstring;
		$.ajax(rw.__instance__ + '/session/' + rw.__session__ + '/get_outside_page', {
			data: { 'url': url },
			async: false,
			success: function(data) {
				htmlstring = data;
			}
		});
		
		var parser = new DOMParser();
		var dom = parser.parseFromString(htmlstring, "text/html");
		return $(dom);
	};
	
	rw.__broadcast__ = function(msg) {
		if ("*" in rw.__listeners__ && !rw.KEY[msg.Key]) {
			for (var i = 0; i < rw.__listeners__["*"].length; i++) {
				rw.__listeners__["*"][i](msg);
			}
		}
		if ("__*__" in rw.__listeners__) {
			for (var i = 0; i < rw.__listeners__["*"].length; i++) {
				rw.__listeners__["*"][i](msg);
			}
		}
		if (msg.Key in rw.__listeners__) {
			for (var i = 0; i < rw.__listeners__[msg.Key].length; i++) {
				rw.__listeners__[msg.Key][i](msg);
			}
		}
	};

	rw.__handle_msg__ = function(msg) {
		
		if (!rw.__sync__.in_progress) {
			var delta = new Date().getTime() - (msg.Time / 1e6);
			if (rw.time_delta === 0) {
				rw.time_delta = delta;
			} else {
				rw.time_delta += 0.1 * (delta - rw.time_delta);
			}
		}
		
		switch(msg.Key) {
			case rw.KEY.__reset__ :
			case rw.KEY.__delete__:
				if(!rw.__sync__.in_progress) {
					rw.__pending_reload__ = true;
				}
				break;
			
			case rw.KEY.__set_period__:
				rw.periods[msg.Sender] = msg.Value.period;
				/*if(!rw.__sync__.in_progress && msg.Sender === rw.user_id) {
					reload = true;
				}*/
				if(msg.Sender === rw.user_id) {
					rw.period = msg.Value.period;
				}
				if(rw.__sync__.in_progress && msg.Sender === rw.user_id){
					rw.__is_reload__ = false;
				}
				break;
				
			case rw.KEY.__set_page__:
				rw.pages[msg.Sender] = msg.Value.page;
				if(!rw.__sync__.in_progress && msg.Sender === rw.user_id) {
					rw.__pending_reload__ = true;
				}
				break;
			
			case rw.KEY.__error__:
				$("body").append($("<div>").addClass("container").html(msg.Value));
				break;
			
			case rw.KEY.__set_config__:
				rw.configs = $.csv.toObjects(msg.Value);
				for (var row = 0; row < rw.configs.length; row++) {
					for (var col in rw.configs[row]) {
						if (typeof(rw.configs[row][col]) === "string") {
							rw.configs[row][col] = tryParse(rw.configs[row][col]);
						}
					}
				}
				break;
			case rw.KEY.__set_group__:
				rw.groups[msg.Sender] = msg.Value.group;
				break;
			case rw.KEY.__set_points__:
				rw.points[msg.Sender] = msg.Value.points;
				break;
			case rw.KEY.__register__:
				rw.subjects.push(msg.Sender);
				rw.subjects.sort(function(a, b) {
					return parseInt(a) - parseInt(b);
				});
				break;
		}
		
		rw.queue.push(msg);
		rw.__broadcast__(msg);
		
		if(rw.__pending_reload__) {
			setTimeout(function() { window.location.reload(true); }, 0);
		}
	};
	
	rw.set_config = function(config) {
		rw.send(rw.KEY.__set_config__, config, { state_update: true }); 
	}
	
	rw.set_period = function(period, user_id) {
		rw.send(rw.KEY.__set_period__, { period: period }, { sender: (user_id || rw.user_id), state_update: true });
	}
	
 	rw.set_group = function(group, user_id) {
		rw.send(rw.KEY.__set_group__, { group: group }, { sender: (user_id || rw.user_id), state_update: true });
	}
	
	rw.set_page = function(page, user_id) {
		rw.send(rw.KEY.__set_page__, { page: page }, { sender: (user_id || rw.user_id), state_update: true });
	}
	
	rw.__connect__();

}

$(function() {
	rw = new Redwood();
	$("[name='data-user-id']").text(rw.user_id);
});
