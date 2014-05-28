
Redwood.factory('SynchronizedStopWatch', ['$q', '$rootScope', '$timeout', 'RedwoodSubject', function($q, $rootScope, $timeout, rs) {
	'use strict';

	var frequency = 1,
		duration = 1,
		onTick = function() {},
		onComplete = function() {};

	var tick = 0, t = 0, tickTarget = 0;

	var timeout, syncLatch, timerLatch;

	function executeTick() {
		rs.gate('_tick_' + tick, function() {
			syncLatch = false;
			timerLatch = false;
			tick++;
			t = Math.floor(tick / frequency);
			onTick(tick, t);
			if(tick < tickTarget) {
				schedule_tick();
			}
		});
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

	var synchronizedStopWatchService = {

		frequency: function(freq) {
			if(arguments.length < 1) return frequency;
			frequency = freq;
			tickTarget = Math.floor(duration * frequency);
			return synchronizedStopWatchService;
		},

		duration: function(s) {
			if(arguments.length < 1) return duration;
			duration = s;
			tickTarget = Math.floor(duration * frequency);
			return synchronizedStopWatchService;
		},

		onTick: function(f) {
			onTick = f;
			return synchronizedStopWatchService;
		},

		onComplete: function(f) {
			onComplete = f;
			return synchronizedStopWatchService;
		},

		start: function() {
			if(!timeout && tick < tickTarget) {
				schedule_tick();
			}
		},

		durationInTicks: function() {
			return tickTarget;
		}

	};

	return synchronizedStopWatchService;

}]);