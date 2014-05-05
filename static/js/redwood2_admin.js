
Redwood.factory("Admin", ["$rootScope", "Redwood", function($rootScope, rw) {

	var ra = {};

	ra.user_id = rw.user_id;
	ra.set_period = rw.set_period;
	ra.set_group = rw.set_group;
	ra.on_load = rw.on_load;
	ra.subjects = [];
	ra.subject = {};

	ra._event_handlers = {};
	ra._msg_handlers = {};

	ra.routerConnected = false;

	ra._call_all = function(callbacks, argsArray) {
		if(!callbacks || !$.isArray(callbacks) || callbacks.length === 0) return;
		argsArray = argsArray || [];
		if(!$.isArray(argsArray)) {
			argsArray = [argsArray];
		}
		for(var i = 0; i < callbacks.length; i++) {
			callbacks[i].apply(ra, argsArray);
		}
	};

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

	ra.sendAsSubject = function(key, value, user_id) {
		ra.__send__(key, value, user_id, ra.periods[user_id], ra.groups[user_id]);
	};

	ra.sendCustom = ra.__send__;

	ra.trigger = function(key, value) {
		ra.__send__(key, value, ra.user_id, 0, 0);
	};

	ra.on = function(eventName, f) {
		if(!ra._event_handlers[eventName]) {
			ra._event_handlers[eventName] = [];
			rw.recv_self(eventName, ra._handle_event_msg);
		}
		ra._event_handlers[eventName].push(f);
	};

	ra.set = function(user_id, key, value) {
		ra.__send__(key, value, user_id, 0, rw.groups[user_id]);
	};

	ra.recv = function(key, f) {
		if(!ra._msg_handlers[key]) {
			ra._msg_handlers[key] = [];
			rw.recv_others(key, ra._handle_msg);
		}
		ra._msg_handlers[key].push(f);
	};

	ra._handle_event_msg = function(msg) {
		ra._broadcast_event(msg.Key, msg.Value);
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
		ra.routerConnected = isConnected;
		if(isConnected) {
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
		ra.recv("__register__", function(userId) {
			f(userId);
		});
	}
	ra.on_register(function(userId) {
		ra.subjects.push({
			user_id: userId,
			group: undefined,
			period: undefined,
			paused: false,
			points: 0,
			accumulated_points: 0,
			points_by_period: function() {
				var results = [];
				if(!this.data["_accumulated_points"] || !this.data["_accumulated_points"].length) {
					return results;
				}
				results.push(this.data["_accumulated_points"][0]);
				for(var i = 1; i < this.data["_accumulated_points"].length; i++) {
					results.push(this.data["_accumulated_points"][i] - this.data["_accumulated_points"][i - 1]);
				}
				return results;
			},
			data: {},
			get: function(key) {
				return (isNullOrUndefined(this.data[key]) ? undefined : this.data[key].last());
			},
			getPrevious: function(key) {
				return (isNullOrUndefined(this.data[key]) ? undefined
					: (this.data[key].length > 1 ? this.data[key][this.data[key].length - 2] : undefined));
			}});
		ra.subjects.sort(function(a,b) {
			return parseInt(a.user_id) - parseInt(b.user_id);
		});
		ra.subjects.forEach(function(subject) {
			ra.subject[subject.user_id] = subject;
		});
	});

	rw.recv_subjects("*", function(msg) {
		if((msg.Period > 0 && msg.Period != rw.periods[msg.Sender])
			|| !ra.subject[msg.Sender]) return;
		if(!ra.subject[msg.Sender].data[msg.Key]) {
			ra.subject[msg.Sender].data[msg.Key] = [];
		}
		ra.subject[msg.Sender].data[msg.Key].push(msg.Value);
	});

	ra.on_set_group = function(f) {
		ra.recv("__set_group__", function(sender, value) {
			f(sender, value.group);
		});
	};
	ra.on_set_group(function(sender, group) {
		ra.groups = rw.groups;
		ra.subject[sender].group = group;
	});

	ra.recv("__set_points__", function(subject, value) {
		ra.subject[subject].accumulated_points += (value.points - ra.subject[subject].points);
		ra.subject[subject].points = value.points;
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
	ra.recv("__set_period__", function(sender, value) {
		ra.periods = rw.periods;
		ra.subject[sender].period = value.period;
	});


	ra.pause = function() {
		for(var i = 0; i < ra.subjects.length; i++) {
			ra.__send__("__pause__", { period: ra.subjects[i].period + 1 }, ra.subjects[i].user_id, 0, ra.subjects[i].group);
		}
	};
	ra.resume = function() {
		for(var i = 0; i < ra.subjects.length; i++) {
			ra.__send__("__resume__", { period: ra.subjects[i].period }, ra.subjects[i].user_id, 0, ra.subjects[i].group);
		}
	};

	ra.on_subject_paused = function(callback) {
		ra.on_subject_paused_callbacks = ra.on_subject_paused_callbacks || [];
		ra.on_subject_paused_callbacks.push(callback);
	};
	ra.on_all_paused = function(callback) {
		ra.on_all_paused_callbacks = ra.on_all_paused_callbacks || [];
		ra.on_all_paused_callbacks.push(callback);
	};
	ra.on_subject_resumed = function(callback) {
		ra.on_subject_resumed_callbacks = ra.on_subject_resumed_callbacks || [];
		ra.on_subject_resumed_callbacks.push(callback);
	};
	ra.recv("__paused__", function(user, value) {
		ra.subject[user].paused = true;
		ra._call_all(ra.on_subject_paused_callbacks, user);
		if(!ra.subjects.firstWhere(function() {
			return !this.paused;
		})) {
			ra._call_all(ra.on_all_paused_callbacks);
		}
	});
	ra.recv("__resumed__", function(user, value) {
		ra.subject[user].paused = false;
		ra._call_all(ra.on_subject_resumed_callbacks, user);
	});

	ra.start_session = function() {
		for(var i = 0; i < ra.subjects.length; i++) {
			ra.set_period(0, ra.subjects[i].user_id); //set all subjects to period 0
		}
	};

	ra.reset = function() {
		ra.trigger("__reset__");
	};

	ra.delete_session = function() {
		ra.trigger("__delete__");
		$.post("admin/archive");
	};

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

	return ra;

}]);
