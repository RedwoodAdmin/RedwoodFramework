
var RedwoodSubject = {
	_initialize: function() {
		var rs = this;
		rs.user_id = rw.user_id;
		rs.subjects = [];
		rs.points = 0;
		rs.accumulated_points = 0;
		rs.get_period = rw.get_period;
		rs.on_load = rw.on_load;
		rs._messaging_enabled = false;
		
		rs._send_queue = [];
		rs._event_handlers = {};
		rs._msg_handlers = {};
		
		rs._handle_event_msg = function(msg) {
			if(rw.__sync__.in_progress) {
				rs._broadcast_event(msg.Key, msg.Value);
			}
		};
		
		rs._handle_msg = function(msg) {
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
		}
		
		rs._enable_messaging = function() {
			rs._messaging_enabled = true;
			var message = rs._send_queue.shift();
			while(message) {
				rs._send(message.key, message.value);
				message = rs._send_queue.shift();
			}
		};
		
		rs._send = function(key, value) {
			if(rs._messaging_enabled) {
				rw.send(key, value, { period: rs.period, group: rs.group, sender: rs.user_id });
			} else {
				rs._send_queue.push({key: key, value: value});
			}
		};
		
		rs.trigger = function(eventName, value) {
			rs._send(eventName, value);
			if(!rw.__sync__.in_progress) {
				rs._broadcast_event(eventName, value);
			}
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
		
		rw.recv_self("__set_group__", function(msg) {
			rs.group = msg.Value.group;
		});
		
		rw.recv_self("__set_period__", function(msg) {
			rs.period = msg.Value.period;
			rs.config = {};
			for(var i = 0, l = rw.configs.length; i < l; i++) {
				var config = rw.configs[i];
				if (config.period === rs.period) {
					if (config.group == 0 || config.group == rs.group) {
						rs.config = config;
					}
				}
			}
			if(Object.size(rs.config) === 0) {
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
			rs.accumulated_points += (value.points - rs.points);
			rs.points = value.points;
		});
		
		rs.recv("__set_points__", function(sender, value) {
			rs.subject_by_id(sender).accumulated_points += (value.points - rs.subject_by_id(sender).points);
			rs.subject_by_id(sender).points = value.points;
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
		
		rs.save = function(key, value) {
			rs._send(key, value);
		};
		rs.retrieve = function(key, f) {
			rs.retrieveMany([key], [rs.user_id], function(results) {
				f(results[key][rs.user_id]);
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
				var period = (rs.period > 1 ? rs.period - 1 : rs.period);
				rw.get_period(period, function (m) {
					var q = m.Value;
					for(var i = 0, l = q.length; i < l; i++) {
						var msg = q[i];
						if(user_id_array.indexOf(msg.Sender) > -1 && key_array.indexOf(msg.Key) > -1) {
							results[msg.Key][msg.Sender] = msg.Value;
						}
					}
					rs.save("_rs_retrieve", results);
				});
			}
		};
		
		
		rw.recv_self("_rs_retrieve", function(msg) {
			var f = rs._retrieve_callbacks.shift();
			f(msg.Value);
		});
		
		rs.next_period = function(delay_secs) {
			setTimeout(function(){rs.trigger("_next_period");}, delay_secs * 1000);
		};
		
		rs.on("_next_period", function() {
			rs.save("_accumulated_points", rs.accumulated_points);
			rw.set_period(rs.period + 1);
		});
		
		rs._when_live_callbacks = {};
		rs.when_live = function(key, f) {
			if(rw.__sync__.in_progress) {
				rs._when_live_callbacks[key] = f;
				rs.on("_cancel_" + key, function(){
					delete rs._when_live_callbacks[key];
				});
			} else {
				f();
			}
		};
		rs.cancel = function(key) {
			rs.trigger("_cancel_" + key);
		};
		rw.on_sync_complete(function() {
			for(var key in rs._when_live_callbacks) {
				rs._when_live_callbacks[key]();
			}
		});
		
		rw.recv_subjects("__register__", function(msg) {
			rs.subjects.push({
				user_id: msg.Sender,
				points: 0,
				accumulated_points: 0,
				_loaded: false,
				_synced: []});
			rs.subjects.sort(function(a,b) {
				return parseInt(a.user_id) - parseInt(b.user_id);
			});
			if(msg.Sender === rs.user_id) {
				rs.subject = rs.subjects.firstWhere(function() {
					return this.user_id === rs.user_id;
				});
			}
		});
		
		rs.subject_by_id = function(user_id) {
			return rs.subjects.firstWhere(function() {return this.user_id == user_id;});
		};
		
		rw.recv_subjects("__page_loaded__", function(msg) {
			rs.subject_by_id(msg.Sender)._loaded = true;
			var not_loaded = rs.subjects.firstWhere(function() {return !this._loaded;});
			if(!not_loaded) {
				rs._enable_messaging();
			}
		});
		
		rs._waits = [];
		rs.recv("user_synced", function(sender, value) {
			rs._on_user_synced(sender);
		});
		rs.after_waiting_for_all = function(f) {
			rs._waits.push({ users: rw.subjects, f: f });
			rs.trigger("user_synced");
		};
		rs.after_waiting_for = function(users, f) {
			rs._waits.push({ users: users, f: f });
			rs.trigger("user_synced");
		};
		rs.on("user_synced", function() {
			rs._on_user_synced(rs.user_id);
		});
		rs._on_user_synced = function(user_id) {
			rs.subject_by_id(user_id)._synced.push(true);
			if(rs._waits[0]) {
				var subjects = rs.subjects.where(function() {
					var _this = this;
					return rs._waits[0].users.firstWhere(function() {return _this.user_id == this});
				});
				if(!subjects.firstWhere(function() { return !this._synced[0]; })) {
					var f = rs._waits.shift().f;
					f();
					subjects.forEach(function() {
						this._synced.shift();
					});
				}
			}
		};
		
		rs.on_load(function() {
			rs._retrieve(["_accumulated_points"], rw.subjects, function(results) {
				for(var i = 0, l = rs.subjects.length; i < l; i++) {
					rs.subjects[i].accumulated_points += results["_accumulated_points"][rs.subjects[i].user_id];
				}
				rs.accumulated_points = rs.subject_by_id(rs.user_id).accumulated_points;
			});
		});
	},
	
	create: function(){} //to be overridden
};

$(function () {
	RedwoodSubject._initialize();
	RedwoodSubject.create();
});