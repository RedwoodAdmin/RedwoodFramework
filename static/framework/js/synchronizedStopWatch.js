
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

			var tick = 0, tickTarget = 0;

			var timeout, executingTick = false;

			var resumed = $q.defer();
			resumed.resolve();
			var resume = resumed.promise;

			function executeTick(thenStop) {
				if(!executingTick) {
					executingTick = true;
					$timeout.cancel(timeout);
					timeout = undefined;
					resume.then(function() {
						rs.synchronizationBarrier(prefix + tick, subjects).then(function() {
							executingTick = false;
							onTick(tick, tick / frequency, (tickTarget - tick) / frequency);
							if(tick < tickTarget) {
								if(!thenStop) schedule_tick();
							} else {
								onComplete();
							}
							tick++;
						});
					});
				}
			}

			function schedule_tick() {
				if(!timeout && !executingTick && tick < tickTarget) {
					if(rs.is_realtime) {
						timeout = $timeout(function() {
							executeTick();
						}, 1000 / frequency);
					} else {
						executeTick();
					}
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
			rs.on('_timer_' + instanceId + '_resume_', function() {
				resumed.resolve();
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
					if(!timeout && !executingTick && tick < tickTarget) {
						if(tick == 0) {
							$rootScope.$evalAsync(function() {
								executeTick();
							});
						} else {
							schedule_tick();
						}
					}
				},

				doNextTick: function() {
					if(!timeout && !executingTick && tick < tickTarget) {
						$rootScope.$evalAsync(function() {
							executeTick(true);
						});
					}
				},

				pause: function() {
					rs.trigger('_timer_' + instanceId + '_pause_');
				},

				resume: function() {
					rs.trigger('_timer_' + instanceId + '_resume_');
				},

				getDurationInTicks: function() {
					return tickTarget;
				}

			};

			return api;

		}
	};

}]);