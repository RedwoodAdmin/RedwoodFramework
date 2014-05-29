Redwood.controller("SubjectCtrl", ["$rootScope", "$scope", "RedwoodSubject", 'SynchronizedStopWatch', function($rootScope, $scope, rs, SynchronizedStopWatch) {

	var CLOCK_FREQUENCY = 5;

	rs.on_load(function() { //called once the page has loaded for a new sub period

		rs.config.pairs.forEach(function(pair, index) { //decide who is the first player and who is the second player
			var userIndex = pair.indexOf(parseInt(rs.user_id));
			if(userIndex > -1) {
				$scope.pair_index = index;
				$scope.user_index = userIndex;
				$scope.partner_id = pair[($scope.user_index + 1) % 2].toString();
			}
		});

		$scope.matrix = $scope.user_index === 0 ? rs.config.matrix : transpose(rs.config.matrix);

		$scope.config = rs.config;

		$scope.yMax = $scope.matrix[0][0][0];
		$scope.matrix.forEach(function(row) {
			row.forEach(function(cell) {
				cell.forEach(function(value) {
					$scope.yMax = Math.max($scope.yMax, value);
				})
			})
		});

		$scope.clock = SynchronizedStopWatch.instance()
			.frequency(CLOCK_FREQUENCY).onTick(processTick)
			.duration(rs.config.period_length_s).onComplete(function() {
				rs.trigger("simulation_complete");
			});

		var numSubPeriods = rs.config.num_sub_periods || (rs.config.period_length_s * CLOCK_FREQUENCY); //If this config value is zero there will be a subperiod every tick
		$scope.ticksPerSubPeriod = Math.max(Math.floor(rs.config.period_length_s * CLOCK_FREQUENCY / numSubPeriods), 1);

		$scope.subPeriods = [];
		if($scope.ticksPerSubPeriod > 1){ //set up the sub period markers so they can be displayed on the plot
			var subPeriod = 0;
			do {
				subPeriod += $scope.ticksPerSubPeriod;
				$scope.subPeriods.push(subPeriod / $scope.clock.getDurationInTicks());
			} while(subPeriod < $scope.clock.getDurationInTicks());
		}

		$scope.rewards = [];
		$scope.opponentRewards = [];
		$scope.plot = [];
		$scope.opponentPlot = [];

		$scope.readyEnabled = true;
	});

	$scope.ready = function() {
		$scope.readyEnabled = false;
		rs.trigger("ready");
	};

	rs.on("ready", function(value){ //event handler for ready button click
		$scope.readyEnabled = false;
		rs.gate('ready', function() {

			if(rs.config.initial_delay_s > 0) {
				$scope.tEnableInput = rs.config.initial_delay_s * CLOCK_FREQUENCY; //only enable input after the initial delay period specified in the config
			} else {
				$scope.actionsEnabled = true; //otherwise enable input immediately
			}

			$scope.action = rs.config.initial_actions[rs.user_id - 1]; //set actions to the initial actions specified in the config
			$scope.partnerAction = rs.config.initial_actions[$scope.partner_id - 1];
			$scope.prevPartnerAction = $scope.partnerAction;

			$scope.clock.start();
		});
	});

	var processTick = function(tick){ //sent by admin at the specified frequency as long as all subjects have acknowledged the previous tick

		$scope.tick = tick;

		if(tick % $scope.ticksPerSubPeriod === 0) { //if this is the end of a sub period (in the "continuous" version, every tick is the end of a sub period)
			var reward = $scope.matrix[$scope.action - 1][$scope.partnerAction - 1][0]; //allocate reward based on the current user actions and the matrix
			$scope.rewards.push(reward);
			rs.add_points(reward * $scope.ticksPerSubPeriod / $scope.clock.getDurationInTicks()); //add the integral of the current reward value over the length of the subperiod

			$scope.plot.push([(tick - $scope.ticksPerSubPeriod) / $scope.clock.getDurationInTicks(), $scope.rewards[$scope.rewards.length - 1]]);
			$scope.plot.push([tick / $scope.clock.getDurationInTicks(), $scope.rewards[$scope.rewards.length - 1]]);
			var opponentReward = $scope.matrix[$scope.action - 1][$scope.partnerAction - 1][1];
			$scope.opponentRewards.push(opponentReward);
			$scope.opponentPlot.push([(tick - $scope.ticksPerSubPeriod) / $scope.clock.getDurationInTicks(), $scope.opponentRewards[$scope.opponentRewards.length - 1]]);
			$scope.opponentPlot.push([tick / $scope.clock.getDurationInTicks(), $scope.opponentRewards[$scope.opponentRewards.length - 1]]);
			$scope.prevPartnerAction = $scope.partnerAction;
		}

		if($scope.tEnableInput) {
			$scope.inputCountdown = Math.ceil(($scope.tEnableInput - $scope.tick) / CLOCK_FREQUENCY);
			if(tick >= $scope.tEnableInput) {
				$scope.actionsEnabled = true;
				$scope.tEnableInput = 0;
			}
		}

	};

	$scope.onAction = function(action) {
		if(action !== $scope.action){ //only trigger action events when selection has actually changed
			$scope.action = action;
			rs.trigger("action", action);
		}
	};

	rs.on("action", function(value){ //triggered when the user changes their selection
		$scope.action = value;
		if(rs.config.action_cost > 0) { //subtract the action cost specified in the config
			rs.add_points(-rs.config.action_cost);
		}
		if(rs.config.action_delay_s > 0) { //disable inputs for the action delay specified in the config
			$scope.tEnableInput = $scope.tick + (rs.config.action_delay_s * CLOCK_FREQUENCY);
			$scope.actionsEnabled = false;
		}
	});

	rs.recv("action", function(sender, value){ //receive other subjects actions
		if(sender === $scope.partner_id){ //if the other subject is the opponent, update their current action
			$scope.partnerAction = value;
		}
	});

	rs.on("simulation_complete", function(value) {
		$scope.actionsEnabled = false;
		rs.next_period(5); //request the framework to advance to the next period
	});

	var transpose = function(matrix) { //transpose a 2x2 matrix
		var transposed = [[[], []], [[], []]];
		for(var i = 0; i < 4; i++){
			var row = Math.floor(i/2);
			var column = i % 2;
			transposed[column][row] = [matrix[row][column][1], matrix[row][column][0]];
		}
		return transposed;
	};

}]);

Redwood.directive('plot', [function() {
	return {
		link: function($scope, elem, attr) {

			$scope.$watch('config', function(plot) {
				replot();
			}, true);

			$scope.$watch('tick', function(plot) {
				replot();
			}, true);

			function replot() {

				if(!$scope.config) return;

				var xRange = 1;
				var opts = {
					xaxis: { tickLength: 0, min: 0, max: xRange },
					yaxis: { tickLength: 0, min: 0, max: $scope.yMax + ($scope.yMax * 0.2) },
					series: { shadowSize: 0 }
				};
				var dataset = [];
				if($scope.subPeriods) {
					for(var p = 0; p < $scope.subPeriods.length; p++){ //mark each sub-period with a vertical red line
						dataset.push({
							data: [
								[$scope.subPeriods[p], opts.yaxis.min],
								[$scope.subPeriods[p], opts.yaxis.max]
							],
							lines: { lineWidth: 1 },
							color: "red"
						});
					}
				}
				if($scope.plot) {
					dataset.push({ //plot your rewards as a grey integral
						data: $scope.plot,
						lines: { fill: true, lineWidth: 0, fillColor: "grey" },
						color: "grey"
					});
					dataset.push({ //plot your opponent's rewards as a black line
						data: $scope.opponentPlot,
						lines: { lineWidth: 2 },
						color: "black"
					});
				}

				if($scope.clock) {
					dataset.push({ //display the current time indicator as a vertical grey line
						data: [
							[$scope.tick / $scope.clock.getDurationInTicks(), opts.yaxis.min],
							[$scope.tick / $scope.clock.getDurationInTicks(), opts.yaxis.max]
						],
						color: "grey"
					});
				}
				$.plot(elem, dataset, opts);
			}
		}
	}
}]);