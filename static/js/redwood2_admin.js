
var RedwoodAdmin = {
	_initialize: function() {
		var ra = this;
		ra.user_id = rw.user_id;
		ra.set_period = rw.set_period;
		ra.set_group = rw.set_group;
		ra.on_load = rw.on_load;
		
		ra._event_handlers = {};
		ra._msg_handlers = {};
		
		ra.get_config = function(period, group) {
			for(var i = 0; i < rw.configs.length; i++) {
				var config = rw.configs[i];
				if(((!config.period && i + 1 == period) || config.period == period) //match period
						&& (!config.group || config.group == group)) { //match group
					return config;
				}
			}
		};
		
		ra.__send__ = function(key, value, sender, period, group) {
			sender = sender || ra.user_id;
			period = period || ra._default_message_period || 0;
			group = group || ra._default_message_group || 0;
			rw.send(key, value, { period: period, group: group, sender: sender });
		};
		
		ra.set_default_message_period = function(period) {
			ra._default_message_period = period;
		}
		
		ra.set_default_message_group = function(group) {
			ra._default_message_group = group;
		}
		
		ra.trigger = function(eventName, value) {
			ra.__send__(eventName, value);
			if(!rw.__sync__.in_progress) {
				ra._broadcast_event(eventName, value);
			}
		};
		
		ra.send = function(key, value, period, group) {
			ra.__send__(key, value, ra.user_id, period, group);
		};
		
		ra.set = function(user_id, key, value) {
			ra.__send__(key, value, user_id, 0, rw.groups[user_id]);
		};
		
		ra.on = function(eventName, f) {
			if(!ra._event_handlers[eventName]) {
				ra._event_handlers[eventName] = [];
				rw.recv_self(eventName, ra._handle_event_msg);
			}
			ra._event_handlers[eventName].push(f);
		};
		
		ra.recv = function(key, f) {
			if(!ra._msg_handlers[key]) {
				ra._msg_handlers[key] = [];
				rw.recv_others(key, ra._handle_msg);
			}
			ra._msg_handlers[key].push(f);
		};
		
		ra._handle_event_msg = function(msg) {
			if(rw.__sync__.in_progress) {
				ra._broadcast_event(msg.Key, msg.Value);
			}
		};
		
		ra._broadcast_event = function(eventName, value) {
			if(ra._event_handlers[eventName]) {
				for(var i = 0, l = ra._event_handlers[eventName].length; i < l; i++) {
					ra._event_handlers[eventName][i](value);
				}
			}
		}
		
		ra._handle_msg = function(msg) {
			if(ra._msg_handlers[msg.Key]) {
				for(var i = 0, l = ra._msg_handlers[msg.Key].length; i < l; i++) {
					ra._msg_handlers[msg.Key][i](msg.Sender, msg.Value);
				}
			}
		};
		
		ra.on_router_connected = function(f) {
			ra.recv("__router_status__", function() {
				f(rw.__ws__.readyState === WebSocket.OPEN);
			});
		};
		
		ra.on_router_connected(function(isConnected) {
			if(isConnected) {
				ra.subjects = rw.subjects;
				ra.periods = rw.periods;
				ra.groups = rw.groups;
			}
		});
		
		ra.on_set_config = function(f) {
			rw.recv_self("__set_config__", function(msg) {
				f(msg.Value);
			});
		}
		ra.on_set_config(function(configs) {
			ra.configs = rw.configs;
		});
		
		ra.on_register = function(f) {
			ra.recv("__register__", function(sender) {
				f(sender);
			});
		}
		ra.on_register(function(sender) {
			ra.subjects = rw.subjects;
		});
		
		ra.on_set_group = function(f) {
			ra.recv("__set_group__", function(sender, value) {
				f(sender, value.group);
			});
		};
		ra.on_set_group(function(sender, group) {
			ra.groups = rw.groups;
		});
		
		ra.on_set_period = function(f) {
			ra.recv("__set_period__", function(sender, value) {
				for(var i = 0, l = rw.configs.length; i < l; i++) {
					var config = rw.configs[i];
					if (config.period === value.period || (isNullOrUndefined(config.period) && i === value.period - 1)) {
						f(sender, value.period);
					}
				}
			});
		};
		ra.on_set_period(function(sender, value) {
			ra.periods = rw.periods;
		});
		
		ra._when_live_callbacks = {};
		ra.when_live = function(key, f) {
			if(rw.__sync__.in_progress) {
				ra._when_live_callbacks[key] = f;
				ra.on("_cancel_" + key, function(){
					delete ra._when_live_callbacks[key];
				});
			} else {
				f();
			}
		};
		ra.cancel = function(key) {
			ra.trigger("_cancel_" + key);
		};
		rw.on_sync_complete(function() {
			for(var key in ra._when_live_callbacks) {
				ra._when_live_callbacks[key]();
			}
		});
		
		ra.start_session = function() {
			for(var i = 0; i < ra.subjects.length; i++) {
				ra.set_period(0, ra.subjects[i]); //set all subjects to period 0
			}
		};
	},
	create: function(){} //to be overridden
};

$(function () {
	RedwoodAdmin._initialize();
	RedwoodAdmin.create();
	
	$("[data-load-config]").each(function() {
		var widget = $(this);
		widget.attr("accept", "text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
		widget.change(function(event) {
			if (event.target.files.length === 1) {
				var filename = event.target.files[0];
				var reader = new FileReader();
				reader.onload = (function(f) {
				  return function(e) {
					rw.set_config(e.target.result);
				  };
				})(filename);
				reader.readAsText(filename);
			}
			return false;
		});
	});
});