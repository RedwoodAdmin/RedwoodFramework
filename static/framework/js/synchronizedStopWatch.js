
Redwood.factory('SynchronizedStopWatch', ['$q', '$rootScope', '$timeout', 'RedwoodSubject', function($q, $rootScope, $timeout, rs) {
	'use strict';

	return {
		instance: function() {

			var frequency = 1,
				duration = 1,
				onTick = function() {},
				onComplete = function() {};

			var tick = 0, t = 0, tickTarget = 0;

			var timeout, latch;

			function executeTick() {
				if(!latch) {
					rs.gate('_tick_' + tick, function() {
						latch = false;
						tick++;
						t = Math.floor(tick / frequency);
						onTick(tick, t);
						if(tick < tickTarget) {
							schedule_tick();
						} else {
							onComplete();
						}
					});
					latch = true;
				}
			}

			function schedule_tick() {
				if(rs.is_realtime) {
					timeout = $timeout(function() {
						executeTick();
					}, 1000 / frequency);
				} else {
					executeTick();
				}
			}

			rs.recv("_at_gate", function(sender, gateId) {
				if(rs.is_realtime && gateId == '_tick_' + tick) {
					$timeout.cancel(timeout);
					executeTick();
				}
			});

			var api = {

				frequency: function(freq) {
					if(arguments.length < 1) return frequency;
					frequency = freq;
					tickTarget = Math.floor(duration * frequency);
					return api;
				},

				duration: function(s) {
					if(arguments.length < 1) return duration;
					duration = s;
					tickTarget = Math.floor(duration * frequency);
					return api;
				},

				onTick: function(f) {
					onTick = f;
					return api;
				},

				onComplete: function(f) {
					onComplete = f;
					return api;
				},

				start: function() {
					if(!timeout && tick < tickTarget) {
						schedule_tick();
					}
					return api;
				},

				getDurationInTicks: function() {
					return tickTarget;
				}

			};

			return api;

		}
	};

}]);