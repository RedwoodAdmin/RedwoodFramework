Redwood.controller("SubjectCtrl", ['$q', "$rootScope", "$scope", 'AsyncCallManager', "RedwoodSubject", function($q, $rootScope, $scope, AsyncCallManager, rs) {

	$scope.inputsEnabled = false;

	$scope.ready = function() {
		if ($scope.inputsEnabled && $scope.periodData.barrier !== undefined) {
			$scope.inputsEnabled = false;
			rs.trigger("ready");
		} else {
			alert("Set barrier");
		}
	};

	var Display = {
		initialize: function() {
			Display.mousedown = false;
			$("#plot").bind("plothover", function (event, pos, item) {
				if (Display.mousedown && $scope.inputsEnabled) {
					if(rs.config.grid) {
						$scope.periodData.barrier = Math.max(0, Math.round(pos.y / rs.config.grid) * rs.config.grid);
					} else {
						$scope.periodData.barrier = Math.max(0, Math.round(pos.y));
					}
					Display.replot();
				}
			});
			$("#plot").bind("mousedown", function (event) {
				Display.mousedown = true;
			});
			$("#plot").bind("mouseup", function (event) {
				if(Display.mousedown){
					Display.mousedown = false;
					if($scope.inputsEnabled && $scope.periodData.barrier !== undefined)
						rs.trigger("barrier", $scope.periodData.barrier); //Set barrier at current mouse position
				}
			});
			$("#plot").bind("mouseout", function (event) { //Mouse leaving plot area is treated the same as releasing the mouse button - stop moving barrier
				if(Display.mousedown){
					Display.mousedown = false;
					if($scope.inputsEnabled && $scope.periodData.barrier !== undefined)
						rs.trigger("barrier", $scope.periodData.barrier); //Set barrier at current mouse position
				}
			});

			rs.on("ready", function(value){
				$scope.inputsEnabled = false;
			});

			if(rs.config.show_params) {
				$("#p_up").text(($scope.p_up * 100).toFixed(2) + "%");
				$("#up_size").text($scope.up_size);
				$("#p_end").text(($scope.p_end * 100).toFixed(2) + "%");
				$("#param-display").show();
			}
		},

		replot: AsyncCallManager.limitCallRateTo(function() { //Redraw plot area

			var deferred = $q.defer();

			var account = $scope.account;
			var last_x = account[account.length - 1][0];
			var last_y = account[account.length - 1][1];
			if ($scope.periodData.barrier > $scope.ymax && !rs.config.fix_y) { //Adjust height of plot to fit barrier
				$scope.ymax = $scope.periodData.barrier + 10;
			}
			var xrange = 200;
			var opts = {
				grid: { clickable: true, hoverable: true },
				xaxis: { tickLength: 0, min: -xrange / 2, max: xrange / 2 },
				yaxis: { tickLength: 0, min: 0, max: $scope.ymax + 10 },
				series: { shadowSize: 0 }
			};
			if (last_x + 20 > opts.xaxis.max) {
				opts.xaxis.max = account.length - $scope.withdrawals.length/3 + 20; //Slide plot to show most recent data
			}
			opts.xaxis.min = opts.xaxis.max - xrange;
			var dataset = [];
			dataset.push({
				data: account, //plot account
				lines: { show: true, lineWidth: 1.5 },
				points: { show: false },
				color: last_y <= 0 ? "rgb(255,20,0)" : "rgb(0,100,255)",
				hoverable: false
			});
			dataset.push({ //show dot at front of account line
				data: [ [last_x, last_y] ],
				lines: { show: false },
				points: { show: true, fill: true, radius: 2 },
				color: $scope.periodData.bankrupt ? "rgb(255,20,0)" : "rgb(0,100,255)",
				hoverable: false
			});
			dataset.push({ ////show dot at front of account line
				data: [ [last_x, last_y] ],
				lines: { show: false },
				points: { show: true, fill: true, radius: 1 },
				color: $scope.periodData.bankrupt ? "rgb(255,20,0)" : "rgb(0,100,255)",
				hoverable: false
			});
			if(rs.period > 1 && $scope.inputsEnabled){ //Display barrier from previous period as reference
				dataset.push({
					data: [
						[last_x, $scope.previousPeriodData.barrier],
						[opts.xaxis.max, $scope.previousPeriodData.barrier]
					],
					dashes: { show: true, lineWidth: 1.5 },
					color: "grey",
					hoverable: false
				});
			}
			dataset.push({ //Display barrier as dashed line
				data: [
					[last_x, $scope.periodData.barrier],
					[opts.xaxis.max, $scope.periodData.barrier]
				],
				dashes: { show: true, lineWidth: 1.5 },
				color: "black",
				hoverable: false
			});
			dataset.push({
				data: $scope.withdrawals, //Show withdrawals as green vertical lines
				lines: { show: true, lineWidth: 1.5 },
				color: "rgb(36,255,0)",
				hoverable: false
			});
			var withdrawal = last_y - $scope.periodData.barrier;
			if (withdrawal > 0) {
				dataset.push({
					data: [
						[last_x, last_y],
						[last_x, last_y - withdrawal]
					],
					lines: { show: true, lineWidth: 1.5 },
					color: "rgb(36,255,0)"
				});
			}

			function draw_text(plot, ctx) { //display barrier and bankrupt text
				var o = plot.pointOffset({ x: last_x, y: $scope.periodData.barrier });
				var s = $scope.periodData.barrier;
				var w = ctx.measureText(s).width;
				var x = o.left + 5;
				var y = o.top - 5;
				if (y < 10) {
					y = o.top + 10;
				}
				ctx.fillText(s, x, y);
				if($scope.withdrawals.length > 2) {// && last_x - $scope.withdrawals[$scope.withdrawals.length - 2][0] == 0) {
					for(var i = $scope.withdrawals.length - 2; i > 0; i -= 3) {
						if(last_x - $scope.withdrawals[i][0] > 3) {
							continue;
						}
						s = "$";
						var o = plot.pointOffset({ x: $scope.withdrawals[i][0], y: $scope.withdrawals[i][1] });
						var x = o.left - 3;
						var y = o.top - 5 - (last_x - $scope.withdrawals[i][0]) * 3;
						ctx.fillStyle = "green";
						ctx.fillText(s, x, y );
					}
				}
				var withdrawal = last_y - $scope.periodData.barrier;
				if(withdrawal > 0 && last_x == 0) {
					s = "$";
					var o = plot.pointOffset({ x: 0, y: rs.config.initial });
					var x = o.left - 3;
					var y = o.top - 5;
					ctx.fillStyle = "green";
					ctx.fillText(s, x, y );
				}
				if(rs.period > 1 && $scope.inputsEnabled){
					ctx.fillStyle = "grey";
					var o = plot.pointOffset({
						x: last_x,
						y: $scope.previousPeriodData.barrier
					});
					var s = "previous barrier";
					var m = ctx.measureText(s);
					ctx.fillText(s, o.left - m.width - 5, o.top + 2);
				}
				if (last_y <= 0) {
					$("#plot-text").html("<span class='text-danger'>Bankrupt</span>");
				} else if ($scope.inputsEnabled) {
					$("#plot-text").html("<span class='text-success'>Set Barrier</span>");
				} else {
					$("#plot-text").html("&nbsp");
				}
			}
			opts.hooks = { draw: [draw_text] };

			$.plot("#plot", dataset, opts);

			deferred.resolve();
			return deferred.promise;
		}),

		clearStatisticalData: function() {
			$("#statistical-data-row").empty();
		},

		displayStatisticalData: function() { //Display the statistical data for the group
			var data = {
				barriers: {},
				bankruptcy: {}
			};
			for(var user_id in rs.subject) {
				var subject = rs.subject[user_id];
				data.barriers[user_id] = subject.data["period_data"].map(function(d) {
					return d.barrier;
				});
				data.bankruptcy[user_id] = subject.data["period_data"].map(function(d) {
					return d.bankrupt ? 1 : 0;
				});
			}

			if(Object.size(data) > 0){
				Display.clearStatisticalData();
				$("#statistical-data-row").append("<p>Cumulative data:</p>");
				var table = "<table class='table table-bordered table-condensed'>" +
					"	<tr>" +
					"		<th>Participant</td>" +
					"		<th>Ave. Barrier</td>" +
					"		<th>Total Withdrawals</td>" +
					"		<th>Bankruptcy Rate</td>" +
					"	</tr>";

				table = table + "<tr class='info'>";
				table = table + "	<td>" + rs.self.alias + "</td>";
				table = table + "	<td>" + Math.round(data.barriers[rs.user_id].sum() / data.barriers[rs.user_id].length) + "</td>";
				table = table + "	<td>" + rs.accumulated_points + "</td>";
				table = table + "	<td>" + Math.round(data.bankruptcy[rs.user_id].sum() * 100 / data.bankruptcy[rs.user_id].length) + "%</td>";
				table = table + "</tr>";

				if(rs.config.show_others) {
					for(var userId in data.barriers){
						if(userId !== rs.user_id){
							table = table + "<tr>";
							table = table + "	<td>" + rs.subject[userId].alias + "</td>";
							table = table + "	<td>" + Math.round(data.barriers[userId].sum() / data.barriers[userId].length) + "</td>";
							table = table + "	<td>" + rs.subject[userId].accumulated_points + "</td>";
							table = table + "	<td>" + Math.round(data.bankruptcy[userId].sum() * 100 / data.bankruptcy[userId].length) + "%</td>";
							table = table + "</tr>";
						}
					}
				}
				table = table + "</table>";
				$("#statistical-data-row").append(table);
			}
		}
	};

	//Types
	var Direction = {UP: true, DOWN: false};

	var processTick = function(value) {
		if (value.withdrawal > 0) {
			rs.add_points(value.withdrawal);
		}
		var x = value.x;
		var y = value.y;
		var withdrawal = value.withdrawal;
		$scope.account.push([x, y + withdrawal]);
		if(!rs.config.fix_y) {
			$scope.ymax = y > $scope.ymax ? y : $scope.ymax;
		}
		if (withdrawal !== 0) {
			$scope.account.push([x, y]); //Update account
			$scope.withdrawals.push([x, $scope.periodData.barrier]);
			$scope.withdrawals.push([x, $scope.periodData.barrier + withdrawal]);
			$scope.withdrawals.push(null);
		}
		if(y <= 0 && !$scope.periodData.bankrupt){ //Player is bankrupt if the account reaches 0
			$scope.periodData.bankrupt = true;
			rs.trigger("bankrupt", true);
		}
	};

	rs.on("tick", function (value) { //Update state based on tick values
		processTick(value);
	});

	rs.on("barrier", function (value) {
		$scope.periodData.barrier = value; //Save current barrier
		Display.replot();
	});

	rs.on("bankrupt", function(value){
		$scope.periodData.bankrupt = true; //Save bankruptcy state
	});

	rs.on_points_changed(function(points) {
		$scope.periodData.points = points; //Save current points (for use in previous period data display
	});

	rs.on_load(function () {

		rs.self.alias = 'A (You)';
		var alias = 'B';
		rs.otherSubjects.forEach(function(subject) {
			subject.alias = alias;
			alias = String.fromCharCode(alias.charCodeAt(0) + 1);
		});

		$scope.ticks = $.isArray(rs.config.ticks) ? rs.config.ticks[rs.user_id - 1] : rs.config.ticks;
		$scope.p_up = $.isArray(rs.config.p_up) ? rs.config.p_up[rs.user_id - 1] : rs.config.p_up;
		$scope.up_size = $.isArray(rs.config.up_size) ? rs.config.up_size[rs.user_id - 1] : rs.config.up_size;
		$scope.p_end = $.isArray(rs.config.p_end) ? rs.config.p_end[rs.user_id - 1] : rs.config.p_end;

		$scope.account = [[0, rs.config.initial]];
		$scope.withdrawals = [];
		$scope.ymax = rs.config.initial_ymax;

		$scope.periodData = {
			barrier: undefined,
			bankrupt: false,
			points: 0
		};

		if(rs.period > 1) {
			$scope.previousPeriodData = rs.self.get("period_data");
			$scope.otherSubjectsPrevData = rs.otherSubjects.map(function(subject) {
				return angular.extend(subject.get("period_data"), {alias: subject.alias});
			});

			rs.trigger("barrier", $scope.previousPeriodData.barrier);
			if(rs.config.show_historical) {
				Display.displayStatisticalData();
			}
		}

		Display.initialize();
		$scope.inputsEnabled = true;

	});

	rs.on("ready", function(value){
		rs.synchronizationBarrier('ready').then(function() { //Once all users have reached this point
			if(rs.user_id == rs.subjects[0].user_id || !rs.config.same_draws){ //Decide whether to generate own draws
				$scope.tickDirections = generateTickDirections();
				$scope.started = true;
				rs.send("tick_directions", $scope.tickDirections);
				//Display.displayData(false);
				var withdrawal = Math.max(rs.config.initial - $scope.periodData.barrier, 0);
				processTick({ x: 0, y: rs.config.initial - withdrawal, withdrawal: withdrawal });
				rs.timeout(function() {
					$scope.ticker = start_ticker();
				});
			}
		});
	});

	rs.recv("tick_directions", function(sender, value) {
		if(rs.config.same_draws){ //Only accept partner's tick sequence if config specifies using same draws
			$scope.tickDirections = [];
			for(var i = 0; i < value.length; i++){ //Save draws
				$scope.tickDirections.push(value[i]);
			}
			//Display.displayData(false);
			var withdrawal = Math.max(rs.config.initial - $scope.periodData.barrier, 0);
			processTick({ x: 0, y: rs.config.initial - withdrawal, withdrawal: withdrawal });
			rs.timeout(function() { //Start experiment
				$scope.ticker = start_ticker();
			});
		}
	});

	rs.on("simulation_complete", function (value) { //Simulation is complete
		$scope.simulation_complete = true;
		rs.synchronizationBarrier('simulation_complete').then(function() { //When all user's reach this point
			if($.isArray(rs.config.earnings_abc[0])) {
				var a = rs.config.earnings_abc[rs.user_id - 1][0];
				var b = rs.config.earnings_abc[rs.user_id - 1][1];
				var c = rs.config.earnings_abc[rs.user_id - 1][2];
			} else {
				var a = rs.config.earnings_abc[0];
				var b = rs.config.earnings_abc[1];
				var c = rs.config.earnings_abc[2];
			}
			var earnings = a*Math.max(Math.pow(rs.points, b) - c, 0); //a*max( (withdrawals^b)-c, 0)
			var points_by_period = rs.self.get("points_by_period");
			var total_earnings = (points_by_period && points_by_period.total_earnings ? points_by_period.total_earnings + earnings: earnings);
			rs.set("points_by_period", {period: rs.period, points: rs.points, earnings: earnings, total_earnings: total_earnings});
			rs.send("__set_show_up_fee__", {show_up_fee: total_earnings});
			rs.set("period_data", $scope.periodData); //Save period data to be retrieved next period
			rs.next_period(5); //Advance period after 5 second delay
		});
	});

	var start_ticker = function() {
		var curr_x = $scope.account[$scope.account.length - 1][0];
		var curr_y = $scope.account[$scope.account.length - 1][1];

		if (curr_x >= $scope.ticks || ($scope.periodData.bankrupt && rs.config.end_early)) {
			return undefined;
		}

		var ticker = setInterval(function () {

			var tick = run_ticker(curr_x, curr_y);
			curr_x++;
			curr_y = tick.y;

			rs.trigger("tick", { x: curr_x, y: tick.y, withdrawal: tick.withdrawal });

			if (curr_x >= $scope.ticks || ($scope.periodData.bankrupt && rs.config.end_early)) {
				rs.trigger("simulation_complete");
				clearInterval(ticker);
			}

		}, 1000 / rs.config.ticks_per_second);
		return ticker;
	};

	var generateTickDirections = function() {
		var tickDirections = [];
		var rand = new Random();
		for(var i = 0; i < $scope.ticks; i++){
			tickDirections[i] = (rand.random() <= $scope.p_up ? Direction.UP : Direction.DOWN);
		}
		return tickDirections;
	};

	var run_ticker = function(curr_x, curr_y) {
		var next_y = curr_y;
		var withdrawal = 0;
		var direction = $scope.tickDirections[curr_x];
		if (curr_y > 0) {

			if (direction === Direction.UP) {
				next_y += $scope.up_size;
			} else {
				next_y -= $scope.up_size;
			}

			if (next_y < 0) {
				next_y = 0;
			}
			if (next_y > $scope.periodData.barrier) {
				withdrawal += next_y - $scope.periodData.barrier;
				next_y = $scope.periodData.barrier;
			}
		} else {
			next_y = 0;
		}
		return { y: next_y, direction: direction, withdrawal: withdrawal };
	};
	
	$scope.$watch('account', function(account) {
		if(account) {
			Display.replot();
			if($scope.tickDirections !== undefined) {
				//Display.displayData(false);
			}
		}
	}, true);

}]);
