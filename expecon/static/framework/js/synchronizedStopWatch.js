
Redwood.factory('SynchronizedStopWatch', ['$q', '$rootScope', '$timeout', 'RedwoodSubject', function($q, $rootScope, $timeout, rs) {
	'use strict';

	var instanceCount = 0;

	return {
		instance: function() {
			var instanceId = ++instanceCount;
			var prefix = '_timer_' + instanceId + '_t_';

			var frequency = 1,
				duration = 1,
				onTick = function() {},
				onComplete = function() {},
				subjects;

			var tick = 0, t = 0, tickTarget = 0;

			var timeout, atBarrier;

			var resumed = $q.defer();
			resumed.resolve();
			var resume = resumed.promise;

			function executeTick() {
				if(!atBarrier) {
					atBarrier = true;
					$timeout.cancel(timeout);
					resume.then(function() {
						rs.synchronizationBarrier(prefix + tick, subjects).then(function() {
							atBarrier = false;
							tick++;
						t = Math.floor(tick / frequency);
						onTick(tick, t);
							if(tick < tickTarget) {
								schedule_tick();
							} else {
								onComplete();
							}
						});
					});
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

			rs.recv("_at_barrier", function(sender, barrierId) {
				if(rs.is_realtime && barrierId == prefix + tick + '_' + rs.period) {
					executeTick();
				}
			});

			rs.on('_timer_' + instanceId + '_pause_', function() {
				resumed = $q.defer();
				resume = resumed.promise;
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

				subjects: function(subjectIds) {
					subjects = subjectIds;
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

				pause: function() {
					rs.trigger('_timer_' + instanceId + '_pause_');
				},

				resume: function() {
					resumed.resolve();
				},

				getDurationInTicks: function() {
					return tickTarget;
				}

			};

			return api;

		}
	};

}]);