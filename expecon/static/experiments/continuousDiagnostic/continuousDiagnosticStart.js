Redwood.controller("SubjectCtrl", ["$rootScope", "$scope", "RedwoodSubject", "SynchronizedStopWatch", function($rootScope, $scope, rs, SynchronizedStopWatch) {

	$scope.status = {};

	rs.on_load(function() {
		var player_index;
		rs.config.pairs.forEach(function(pair) {
			var index = pair.indexOf(Number(rs.user_id));
			if(index > -1) {
				player_index = index;
				$scope.partner_id = pair[(index + 1)%2].toString();
			}
		});

		$scope.clock = SynchronizedStopWatch.instance()
			.subjects([$scope.partner_id])
			.frequency(rs.config.frequency).onTick(handleTick)
			.duration(rs.config.period_length_s).onComplete(onComplete);
	});

	$scope.ready = function() {
		rs.trigger("ready");
		$scope.status.ready = true;
	};

	rs.on("ready", function(value) {

		$scope.status.ready = true;

		rs.synchronizationBarrier('ready').then(function() {
			$scope.frequency = rs.config.frequency;
			$scope.tMax = $scope.clock.getDurationInTicks();
			$scope.ticksPerSubPeriod = Math.floor($scope.clock.getDurationInTicks() / (rs.config.num_sub_periods || $scope.clock.getDurationInTicks()));
			$scope.t = 0;

			$scope.myEntry = $scope.tMax + 1;
			$scope.otherEntry = $scope.tMax + 1;

			$scope.subPeriods = [];
			if($scope.ticksPerSubPeriod > 1) {
				for(var i = 1; i <= $scope.tMax; i++) {
					if(i % $scope.ticksPerSubPeriod === 0) {
						$scope.subPeriods.push(i / $scope.tMax);
					}
				}
			}

			$scope.symmetric = [];
			$scope.symmRewards = [];
			for(var tick = 0; tick <= $scope.tMax; tick++) {
				if(tick % $scope.ticksPerSubPeriod === 0) {
					var i = tick / $scope.tMax;
					var points = $scope.earn(i, i);
					$scope.symmRewards.push(points);
					$scope.symmetric.push([tick / $scope.tMax, points]);
					$scope.symmetric.push([(tick + $scope.ticksPerSubPeriod) / $scope.tMax, points]);
				}
			}

			if(rs.config.delay) {
				SynchronizedStopWatch.instance()
					.subjects([$scope.partner_id])
					.frequency(1).onTick(function(tick, lapsed, remaining) {
						$scope.delayRemaining = remaining;
					})
					.duration(rs.config.delay).onComplete(start)
					.start();
			} else {
				start();
			}
		});
	});

	function start() {
		$scope.clock.start();
		$scope.status.started = true;
	}

	$scope.enter = function() {
		if(!$scope.status.entered) {
			$scope.status.entered = true;
			$scope.myEntry = $scope.t - ($scope.t % $scope.ticksPerSubPeriod);
			rs.trigger('enter', $scope.myEntry);
		}
	};

	rs.on('enter', function(value) {
		$scope.status.entered = true;
		$scope.myEntry = value;

		if($scope.otherEntry < ($scope.tMax + 1)) {
			rs.set_points($scope.earn($scope.myEntry / $scope.tMax, $scope.otherEntry / $scope.tMax));
		} else if(rs.config.pauset) {
			pause();
		}
	});

	rs.recv("enter", function(sender, value) { //receive other subjects actions
		if(sender === $scope.partner_id) {
			$scope.otherEntry = value;
			if($scope.myEntry < ($scope.tMax + 1)) {
				rs.set_points($scope.earn($scope.myEntry / $scope.tMax, $scope.otherEntry / $scope.tMax));
			} else if(rs.config.pauset) {
				pause();
			}
		}
	});

	$scope.revealed = function() {
		return $scope.myEntry < ($scope.tMax + 1) && $scope.t >= $scope.myEntry + $scope.ticksPerSubPeriod;
	};

	function pause() {
		$scope.clock.pause();
		SynchronizedStopWatch.instance()
			.subjects([$scope.partner_id])
			.frequency(1).onTick(function(tick, lapsed, remaining) {
				$scope.pauseRemaining = remaining;
				$scope.$broadcast('replot');
			})
			.duration(rs.config.pauset).onComplete(function() {
				$scope.clock.resume();
			})
			.start();
	}

	function handleTick(tick, lapsed, remaining) {
		$scope.t = tick;

		$scope.first = [];
		$scope.firstRewards = [];
		$scope.second = [];
		$scope.secondRewards = [];

		if(Math.min($scope.myEntry, $scope.otherEntry) < $scope.tMax + 1
			&& $scope.t >= Math.min($scope.myEntry, $scope.otherEntry) + $scope.ticksPerSubPeriod) {
			var anchor1 = Math.min($scope.myEntry, $scope.otherEntry);
		} else {
			var anchor1 = $scope.t - ($scope.t % $scope.ticksPerSubPeriod);
		}

		if(Math.max($scope.myEntry, $scope.otherEntry) < $scope.tMax + 1
			&& $scope.t >= Math.max($scope.myEntry, $scope.otherEntry) + $scope.ticksPerSubPeriod) {
			var anchor2 = Math.max($scope.myEntry, $scope.otherEntry)
		} else {
			var anchor2 = $scope.tMax
		}

		var i, j, firstReward, secondReward;

		for(var tick = anchor1; tick <= anchor2; tick++) {
			if(tick % $scope.ticksPerSubPeriod === 0) {
				i = anchor1 / $scope.tMax;
				j = tick / $scope.tMax;

				firstReward = $scope.earn(i, j);
				$scope.firstRewards.push(firstReward);
				$scope.first.push([tick / $scope.tMax, firstReward]);
				$scope.first.push([(tick + $scope.ticksPerSubPeriod) / $scope.tMax, firstReward]);

				secondReward = $scope.earn(j, i);
				$scope.secondRewards.push(secondReward);
				$scope.second.push([tick / $scope.tMax, secondReward]);
				$scope.second.push([(tick + $scope.ticksPerSubPeriod) / $scope.tMax, secondReward]);
			}
		}

		for(var tick = anchor2; tick <= $scope.tMax; tick++) {
			if(tick % $scope.ticksPerSubPeriod === 0) {
				i = anchor1 / $scope.tMax;
				j = anchor2 / $scope.tMax;

				firstReward = $scope.earn(i, j);
				$scope.firstRewards.push(firstReward);
				$scope.first.push([tick / $scope.tMax, firstReward]);
				$scope.first.push([(tick + $scope.ticksPerSubPeriod) / $scope.tMax, firstReward]);

				secondReward = $scope.earn(j, i);
				$scope.secondRewards.push(secondReward);
				$scope.second.push([tick / $scope.tMax, secondReward]);
				$scope.second.push([(tick + $scope.ticksPerSubPeriod) / $scope.tMax, secondReward]);
			}
		}

		$scope.timeRemaining = Math.floor(($scope.tMax - $scope.t) / $scope.frequency);

		$scope.$broadcast('replot');
	}

	function onComplete() {
		if($scope.myEntry >= ($scope.tMax + 1) && $scope.otherEntry >= ($scope.tMax + 1)) {
			rs.set_points($scope.earn(1, 1));
		} else if($scope.myEntry >= ($scope.tMax + 1) && $scope.otherEntry < ($scope.tMax + 1)) {
			rs.set_points($scope.earn(1, $scope.otherEntry / $scope.tMax));
		} else if($scope.myEntry < ($scope.tMax + 1) && $scope.otherEntry >= ($scope.tMax + 1)) {
			rs.set_points($scope.earn($scope.myEntry / $scope.tMax, 1));
		}

		$scope.status.entered = true;

		rs.synchronizationBarrier('next_period').then(function() {
			rs.next_period(5);
		});
	}

	$scope.earn = function(i, j) {
		var f = rs.config.f;
		var d = rs.config.d;
		var s = rs.config.s;
		var c = rs.config.c;

		if(i < j) {
			return Math.min(100 * ((1 - j) * 0.5 * d + (j - i) * (0.5 * (1 - j) + 1) * f - c * (Math.pow(1 - i, 2))), rs.config.profcap)
		} else {
			return Math.min(100 * ((1 - i) * (0.5 * d - 0.5 * (i - j) * s) - c * (Math.pow(1 - i, 2))), rs.config.profcap);
		}
	}

}]);