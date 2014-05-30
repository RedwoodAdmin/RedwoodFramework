
Redwood.factory("RedwoodSubject", ["$rootScope", "$timeout", "RedwoodCore", function($rootScope, $timeout, rw) {

	var rs = {};

	rs.user_id = rw.user_id;
	rs.subjects = [];
	rs.other_subjects = [];
	rs.subject = {};
	rs.points = 0;
	rs.accumulated_points = 0;
	$rootScope.points = 0;
	$rootScope.totalPoints = 0;
	rs.is_realtime = false;
	rs._messaging_enabled = false;

	rs._send_queue = [];
	rs._event_handlers = {};
	rs._msg_handlers = {};

	rs._pause = {};

	rs.data = {};

	rs._handle_event_msg = function(msg) {
		if(msg.Period != rw.periods[msg.Sender]) return;
		rs._broadcast_event(msg.Key, msg.Value);
	};

	rs._handle_msg = function(msg) {
		if(msg.Sender != "admin" && msg.Period != rw.periods[msg.Sender]) return;
		if(rs._msg_handlers[msg.Key]) {
			for(var i = 0, l = rs._msg_handlers[msg.Key].length; i < l; i++) {
				rs._msg_handlers[msg.Key][i](msg.Sender, msg.Value);
			}
		}
	};

	rs._broadcast_event = function(eventName, value) {
		if(rs._event_handlers[eventName]) {
			for(var i = 0, l = rs._event_handlers[eventName].length; i < l; i++) {
				rs._event_handlers[eventName][i](value);
			}
		}
	};

	rs._enable_messaging = function() {
		rs._messaging_enabled = true;
		var message = rs._send_queue.shift();
		while(message) {
			rw.send(message.key, message.value, message.opts);
			message = rs._send_queue.shift();
		}
	};

	rs._send = function(key, value, opts) {
		opts = opts || {};
		if(angular.isNullOrUndefined(opts.period)) opts.period = rs.period;
		if(angular.isNullOrUndefined(opts.group)) opts.group = rs._group;
		if(angular.isNullOrUndefined(opts.sender)) opts.sender = rs.user_id;

		if(rs._messaging_enabled) {
			rw.send(key, value, opts);
		} else {
			rs._send_queue.push({key: key, value: value, opts: opts});
		}
	};

	rs.trigger = function(eventName, value) {
		rs._send(eventName, value);
	};

	rs.on = function(eventName, f) {
		if(!rs._event_handlers[eventName]) {
			rs._event_handlers[eventName] = [];
			rw.recv_self(eventName, rs._handle_event_msg);
		}
		rs._event_handlers[eventName].push(f);
	};

	rs.send = function(key, value) {
		rs._send(key, value);
	};

	rs.recv = function(key, f) {
		if(!rs._msg_handlers[key]) {
			rs._msg_handlers[key] = [];
			rw.recv_others(key, rs._handle_msg);
		}
		rs._msg_handlers[key].push(f);
	};

	rs.recv(rw.KEY.__set_config__, function(sender, value) {
		rs.configs = rw.configs;
	});

	rw.recv_self("__set_period__", function(msg) {
		rs.period = msg.Value.period;
		rs.config = {};
		for(var i = 0, l = rw.configs.length; i < l; i++) {
			var config = rw.configs[i];
			if ((!config.period && rs.period == i + 1) || config.period === rs.period) {
				if (!config.group || config.group == rs._group) {
					rs.config = config;
					if(rs.config.pause) {
						rs._pause[rs.period] = true;
					}
				}
			}
		}
		if(rs.period === 0) {
			rw.set_page("Wait", rs.user_id);
		} else if(Object.size(rs.config) === 0) {
			rw.set_page("Finish", rs.user_id);
		} else {
			rw.set_page("Start", rs.user_id);
		}
	});

	rs.set_points = function(points) {
		rs.trigger("__set_points__", { period: rs.period, points: parseFloat(points) });
	};

	rs.add_points = function(points) {
		rs.trigger("__set_points__", { period: rs.period, points: parseFloat(rs.points + points) });
	};

	rs.on("__set_points__", function(value) {
		rs.subject[rs.user_id].accumulated_points += (value.points - rs.points);
		rs.accumulated_points = rs.subject[rs.user_id].accumulated_points;
		rs.subject[rs.user_id].points = value.points;
		rs.points = value.points;

		$rootScope.totalPoints = rs.accumulated_points;
		$rootScope.periodPoints = rs.points;
	});

	rs.recv("__set_points__", function(sender, value) {
		rs.subject[sender].accumulated_points += (value.points - rs.subject[sender].points);
		rs.subject[sender].points = value.points;
	});

	rs.on_points_changed = function(f) {
		rs.on("__set_points__", function(value) {
			f(value.points);
		});
	};
	rs.recv_points_changed = function(f) {
		rs.recv("__set_points__", function(sender, value) {
			f(sender, value.points);
		});
	};

	rs.set = function(key, value) {
		rs._send(key, value, {period: 0});
	};

	rs.save = function(key, value) {
		rs._send(key, value);
	};
	rs.retrieve = function(key, f) {
		rs.retrieveMany([key], function(results) {
			f(results[key]);
		});
	};
	rs.retrieveMany = function(key_array, f) {
		rs._retrieve(key_array, [rs.user_id], function(results) {
			var repackaged = {};
			for(var i = 0, l = key_array.length; i < l; i++) {
				repackaged[key_array[i]] = results[key_array[i]][rs.user_id];
			}
			f(repackaged);
		});
	};
	rs._retrieve = function(key_array, user_id_array, f) {
		rs._retrieve_callbacks = rs._retrieve_callbacks || [];
		rs._retrieve_callbacks.push(f);
		if(!rw.__sync__.in_progress) {
			var results = {};
			for(var i = 0, l = key_array.length; i < l; i++) {
				results[key_array[i]] = {};
				for(var j = 0, l2 = user_id_array.length; j < l2; j++) {
					results[key_array[i]][user_id_array[j]] = null;
				}
			}
			if(rs.period > 1) {
				rw.get_period(rs.period - 1, function (m) {
					var q = m.Value;
					for(var i = 0, l = q.length; i < l; i++) {
						var msg = q[i];
						if(user_id_array.indexOf(msg.Sender) > -1 && key_array.indexOf(msg.Key) > -1) {
							results[msg.Key][msg.Sender] = msg.Value;
						}
					}
					rs.save("_rs_retrieve", results);
				});
			} else {
				rs.save("_rs_retrieve", results);
			}
		}
	};

	rw.recv_self("_rs_retrieve", function(msg) {
		if(msg.Period != rw.periods[msg.Sender]) return;
		var f = rs._retrieve_callbacks.shift();
		f(msg.Value);
	});

	rs.next_period = function(delay_secs) {
		delay_secs = delay_secs || 0;
		rs.timeout(function(){rs.trigger("_next_period");}, delay_secs * 1000);
	};

	rs.on("_next_period", function() {
		rs.set("_accumulated_points", rs.accumulated_points);
		rw.set_period(rs.period + 1);
	});

	rs.finish = function(delay_secs) {
		delay_secs = delay_secs || 0;
		rs.timeout(function(){rs.trigger("_finish");}, delay_secs * 1000);
	};

	rs.on("_finish", function() {
		rs.set("_accumulated_points", rs.accumulated_points);
		rw.set_period(rw.configs.length + 1);
	});

	rw.on_sync_complete(function() {
		rs.is_realtime = true;
	});

	/*rs._when_live_callbacks = {};
	rs.when_live = function(key, f) {
		if(rw.__sync__.in_progress) {
			rs._when_live_callbacks[key] = f;
			rs.on("_cancel_" + key, function(){
				delete rs._when_live_callbacks[key];
			});
		} else {
			$timeout(f, 0);
		}
	};
	rs.cancel = function(key) {
		rs.trigger("_cancel_" + key);
	};
	rw.on_sync_complete(function() {
		for(var key in rs._when_live_callbacks) {
			rs._when_live_callbacks[key]();
		}
	});*/

	/*rs._when_realtime_callbacks = {};
	rs.when_realtime = function(f, delay_ms) {
		delay_ms = delay_ms || 0;
		var key = Object.size(rs._when_realtime_callbacks);
		if(rw.__sync__.in_progress) {
			rs._when_realtime_callbacks[key] = {f: f, delay: delay_ms};
		} else {
			$timeout(function() {
				f();
			}, delay_ms);
		}
	};
	rw.on_sync_complete(function() {
		for(var key in rs._when_realtime_callbacks) {
			$timeout(function() {
				rs._when_realtime_callbacks[key].f();
			}, rs._when_realtime_callbacks[key].delay);
		}
	});*/

	rs._delayIfNotRealtime = function(f) {
		if(rw.__sync__.in_progress) {
			rw.on_sync_complete(f);
		} else {
			f();
		}
	};

	rs._timeout_callbacks = {};
	var timeoutKey = 1;
	rs.timeout = function(f, delay_ms) {
		delay_ms = delay_ms || 0;
		var key = timeoutKey++;
		rs._timeout_callbacks[key] = {f: f, delay: delay_ms};
		rs._delayIfNotRealtime(function() {
			if(rs._timeout_callbacks[key]) {
				rs._timeout_callbacks[key].timeout = $timeout(function() {
					rs.trigger('_execute_timeout', key);
				}, rs._timeout_callbacks[key].delay);
			}
		});
		return key;
	};
	rs.on('_execute_timeout', function(key) {
		rs._timeout_callbacks[key].f();
		delete rs._timeout_callbacks[key];
	});
	rs.timeout.cancel = function(key) {
		if(!key || !rs._timeout_callbacks[key]) return;
		if(rs._timeout_callbacks[key] && rs._timeout_callbacks[key].timeout) {
			$timeout.cancel(rs._timeout_callbacks[key].timeout);
		}
		delete rs._timeout_callbacks[key];
	};

	rw.recv_subjects("__set_group__", function(msg) {
		if(msg.Sender == rs.user_id) {
			rs._group = msg.Value.group;
		}
		rs.subjects.push({
			user_id: msg.Sender,
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
			data: {
				_synced: []
			},
			get: function(key) {
				return (angular.isNullOrUndefined(this.data[key]) ? undefined : this.data[key].last());
			},
			getPrevious: function(key) {
				return (angular.isNullOrUndefined(this.data[key]) ? undefined
						: (this.data[key].length > 1 ? this.data[key][this.data[key].length - 2] : undefined));
			},
			_loaded: false});
		rs.subjects.sort(function(a,b) {
			return parseInt(a.user_id) - parseInt(b.user_id);
		});
		rs.subjects.forEach(function(subject) {
			rs.subject[subject.user_id] = subject;
		});
		rs.other_subjects = rs.subjects.filter(function(subject) {
			subject.user_id !== rs.user_id;
		})
	});

	rw.recv_subjects("*", function(msg) {
		if((msg.Period > 0 && msg.Period != rw.periods[msg.Sender])
				|| !rs.subject[msg.Sender]) return;
		if(!rs.data[msg.Key]) {
			rs.data[msg.Key] = [];
		}
		rs.data[msg.Key].push(msg.Value);
		if(!rs.subject[msg.Sender].data[msg.Key]) {
			rs.subject[msg.Sender].data[msg.Key] = [];
		}
		rs.subject[msg.Sender].data[msg.Key].push(msg.Value);
	});

	rw.recv_subjects("__page_loaded__", function(msg) {
		if(msg.Period != rw.periods[msg.Sender]
			|| rw.groups[msg.Sender] != rs._group
			|| !rs.subject[msg.Sender]) return;
		rs.subject[msg.Sender]._loaded = true;
		var not_loaded = rs.subjects.some(function(subject) {return !subject._loaded;});
		if(!not_loaded) {
			rs._enable_messaging();
		}
	});

	var gates = {};
	rs.gate = function(gateId, f, subjectIds) {
		gateId += '_' + rs.period;
		gates[gateId] = gates[gateId] || {received: []};
		if(subjectIds) {
			gates[gateId].subjectIds = subjectIds;
		}
		gates[gateId].callback = f;
		rs.trigger("_at_gate", gateId);
	};
	rs.on('_at_gate', function(gateId) {
		gates[gateId].received.push(rs.user_id);
		checkGate(gateId);
	});
	rs.recv('_at_gate', function(sender, gateId) {
		gates[gateId] = gates[gateId] || {received: []};
		gates[gateId].received.push(sender);
		checkGate(gateId);
	});
	function checkGate(gateId) {
		var gate = gates[gateId];
		if(gate.subjectIds) {
			if(gate.subjectIds.some(function(id) {
				return gate.received.indexOf(id) < 0;
			})) {
				return;
			}
		} else {
			if(rs.subjects.some(function(subject) {
				return gate.received.indexOf(subject.user_id) < 0;
			})) {
				return;
			}
		}
		gate.callback();
		delete gates[gateId];
	}

	/*rs._waits = [];
	rs.on("_synced", function() {
		rs._on_synced(rs.user_id);
	});
	rs.recv("_synced", function(sender, value) {
		rs._on_synced(sender);
	});
	rs.after_waiting_for_all = function(f) {
		var subjects = rw.subjects.filter(function(id) {
			return rw.groups[id] == rs._group;
		});
		rs._waits.push({ users: subjects, f: f });
		rs.trigger("_synced", { period: rs.period });
	};
	rs.after_waiting_for = function(users, f) {
		users.push(rs.user_id);
		rs._waits.push({ users: users, f: f });
		rs.trigger("_synced", { period: rs.period });
	};
	rs._on_synced = function(user_id) {

		if(rs._waits[0]) {
			var subjects = rs.subjects.filter(function(subject) {
				return rs._waits[0].users.indexOf(subject.user_id) > -1;
			});
			var syncCount = subjects[0].data._synced.filter(function(subject) {
				return subject.period == rs.period;
			}).length;
			if(!subjects.some(function(subject) {
					return subject.data._synced.filter(function(s) {
						return s.period == rs.period;
					}).length != syncCount;
				})) {
				var f = rs._waits.shift().f;
				f();
			}
		}
	};*/

	rs._start_period = function() {
		while(rs._on_load_callbacks.length) {
			(rs._on_load_callbacks.shift())();
		}
	};

	rw.on_load(function() {
		$rootScope.period = rs.period;
		rs.gate('_on_load', function() {

			if(rs.config && $.isArray(rs.config.groups) && rs.config.groups.length > 0 && $.isArray(rs.config.groups[0])) {
				for(var i = 0; i < rs.config.groups.length; i++) {
					for(var j = 0; j < rs.config.groups[i].length; j++) {
						if(rs.subject[rs.config.groups[i][j]]) {
							rs.subject[rs.config.groups[i][j]].groupForPeriod = i + 1;
						}
					}
				}
			}

			for(var i = 0, l = rs.subjects.length; i < l; i++) {
				rs.subjects[i].accumulated_points += (rs.subjects[i].get("_accumulated_points") ? rs.subjects[i].get("_accumulated_points") : 0);
			}
			rs.accumulated_points = rs.subject[rs.user_id].accumulated_points;
			$rootScope.totalPoints = rs.accumulated_points;

			if(rs._pause[rs.period]) {
				rw.send("__paused__", { period: rs.period }, { period: rs.period, group: rs._group, sender: rs.user_id });
			} else {
				rs._start_period();
			}
		});
	});

	rw.recv_self("_pause", function(msg) {
		rs._pause[msg.Value.period] = true;
	});

	rw.recv_self("__resume__", function(msg) {
		if(rs._pause[msg.Value.period]) {
			rs._pause[msg.Value.period] = false;
			if(rs.period === msg.Value.period) {
				rs._start_period();
				rs.send("__resumed__", {period: rs.period});
			}
		}
	});

	rs._on_load_callbacks = [];
	rs.on_load = function(f) {
		rs._on_load_callbacks.push(f);
	};

	return rs;
}]);
