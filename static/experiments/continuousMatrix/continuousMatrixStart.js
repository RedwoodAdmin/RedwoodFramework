Redwood.controller("SubjectCtrl", ["$rootScope", "$scope", "Subject", function($rootScope, $scope, rs) {

	$("#ready-button").click(function(){
		rs.trigger("ready");
	});

	rs.on("ready", function(value){ //event handler for ready button click
		Display.readyButtonFlasher.setFlashing(false);
		$("#ready-button").attr("disabled", "disabled");
	});

	$scope.onUserAction = function(action) {
		if(Display.actionsEnabled && action !== state.myAction){ //only trigger action events when selection has actually changed
			rs.trigger("__action__", action);
		}
	};

	if(state.tEnableInput) {
		$("#delay").text("Delay: " + Math.ceil((state.tEnableInput - state.t) / state.frequency) + "s"); //Display delay indicator
	}

	replot: function() { //update the plot
		var xrange = 1;
		var opts = {
			xaxis: { tickLength: 0, min: 0, max: xrange },
			yaxis: { tickLength: 0, min: 0, max: Display.matrix.maxReward + (Display.matrix.maxReward * 0.2) },
			series: { shadowSize: 0 }
		};
		var dataset = [];
		for(var p = 0; p < state.subPeriods.length; p++){ //mark each sub-period with a vertical red line
			dataset.push({
				data: [
					[state.subPeriods[p], opts.yaxis.min],
					[state.subPeriods[p], opts.yaxis.max]
				],
				lines: { lineWidth: 1 },
				color: "red"
			});
		}
		dataset.push({ //plot your rewards as a grey integral
			data: state.plot,
			lines: { fill: true, lineWidth: 0, fillColor: "grey" },
			color: "grey"
		});
		dataset.push({ //plot your opponent's rewards as a black line
			data: state.opponentPlot,
			lines: { lineWidth: 2 },
			color: "black"
		});
		dataset.push({ //display the current time indicator as a vertical grey line
			data: [
				[state.t / state.tMax, opts.yaxis.min],
				[state.t / state.tMax, opts.yaxis.max]
			],
			color: "grey"
		});
		$.plot("#plot", dataset, opts);
	}

	setActionsEnabled: function(enabled) { //enables or disables user input, removes links when not enabled
		$("#delay").html("&nbsp"); //clear input delay indicator

	}


	var initializeSimulation = function() { //this is sent by admin as the first tick when the simulation is starting
		state.frequency = 10; //store the tick frequency
		var num_sub_periods = rs.config.num_sub_periods || (rs.config.period_length_s * state.frequency); //If this config value is zero there will be a subperiod every tick
		state.ticksPerSubPeriod = Math.floor(rs.config.period_length_s * state.frequency / num_sub_periods);
		state.tMax = state.ticksPerSubPeriod * num_sub_periods; //The number of ticks that will be sent this period.

		state.t = 0;
		state.myAction = rs.config.initial_actions[rs.user_id - 1]; //set actions to the initial actions specified in the config
		state.opponentAction = rs.config.initial_actions[state.partner_id - 1];
		state.prevOpponentAction = state.opponentAction;

		//initialize other state variables
		state.rewards = [];
		state.opponentRewards = [];
		state.plot = [];
		state.opponentPlot = [];
		state.subPeriods = [];
		if(state.ticksPerSubPeriod > 1){ //set up the sub period markers so they can be displayed on the plot
			for(var i = 1; i <= state.tMax; i++){
				if(i % state.ticksPerSubPeriod === 0){
					state.subPeriods.push(i / state.tMax);
				}
			}
		}
		Display.updateMatrix();
		Display.replot();
		Display.showLegend();

		if(rs.config.initial_delay_s > 0) {
			state.tEnableInput = rs.config.initial_delay_s * state.frequency; //only enable input after the initial delay period specified in the config
		} else {
			Display.setActionsEnabled(true); //otherwise enable input immediately
		}
		//rs.send("__tick_ack__", {t: state.t}); //send a tick acknowledgement back for admin
	};

	var processTick = function(value){ //sent by admin at the specified frequency as long as all subjects have acknowledged the previous tick
		//rs.send("__tick_ack__", {t: value.t}); //send a tick acknowledgement back for admin
		state.t = value.t;
		if(value.t % state.ticksPerSubPeriod === 0){ //if this is the end of a sub period (in the "continuous" version, every tick is the end of a sub period)
			state.prevOpponentAction = state.opponentAction;
			Display.updateMatrix();
			var reward = state.matrix[state.myAction - 1][state.prevOpponentAction - 1][0]; //allocate reward based on the current user actions and the matrix
			state.rewards.push(reward);
			rs.add_points(state.rewards[state.rewards.length - 1] * state.ticksPerSubPeriod / state.tMax); //add the integral of the current reward value over the length of the subperiod
			state.plot.push([(state.t - state.ticksPerSubPeriod) / state.tMax, state.rewards[state.rewards.length - 1]]);
			state.plot.push([state.t / state.tMax, state.rewards[state.rewards.length - 1]]);
			var opponentReward = state.matrix[state.myAction - 1][state.prevOpponentAction - 1][1];
			state.opponentRewards.push(opponentReward);
			state.opponentPlot.push([(state.t - state.ticksPerSubPeriod) / state.tMax, state.opponentRewards[state.opponentRewards.length - 1]]);
			state.opponentPlot.push([state.t / state.tMax, state.opponentRewards[state.opponentRewards.length - 1]]);
		}
		Display.replot();
		if(state.tEnableInput && state.t >= state.tEnableInput) {
			Display.setActionsEnabled(true);
			state.tEnableInput = undefined;
		}
		if(state.t === state.tMax) { //if this is the final tick of the simulation
			rs.trigger("simulation_complete");
		}
	};

	rs.on("simulation_complete", function(value) {
		Display.setActionsEnabled(false);
		state.period_complete = true;
		rs.next_period(5); //request the framework to advance to the next period
	});

	rs.on("__action__", function(value){ //triggered when the user changes their selection
		state.myAction = value;
		Display.updateMatrix();
		if(rs.config.action_cost > 0) { //subtract the action cost specified in the config
			rs.add_points(-rs.config.action_cost);
		}
		if(rs.config.action_delay_s > 0) { //disable inputs for the action delay specified in the config
			state.tEnableInput = state.t + (rs.config.action_delay_s * state.frequency);
			Display.setActionsEnabled(false);
		}
	});

	rs.recv("__action__", function(sender, value){ //receive other subjects actions
		if(sender === state.partner_id){ //if the other subject is the opponent, update their current action
			state.opponentAction = value;
		};
	});

	rs.on_load(function() { //called once the page has loaded for a new sub period
		var player_index;
		for(var pair = 0; pair < rs.config.pairs.length; pair++) { //decide who is the first player and who is the second player
			if(rs.config.pairs[pair][0] == rs.user_id || rs.config.pairs[pair][1] == rs.user_id) {
				if(rs.config.pairs[pair][0] == rs.user_id) {
					player_index = 0;
					state.partner_id = rs.config.pairs[pair][1].toString();
				} else if(rs.config.pairs[pair][1] == rs.user_id) {
					player_index = 1;
					state.partner_id = rs.config.pairs[pair][0].toString();
				}
			}
		}

		if(player_index === 0) {
			state.matrix = rs.config.matrix;
		} else if(player_index === 1) {
			state.matrix = transpose(rs.config.matrix); //transpose the matrix for the second player
		}

		Display.initialize();

		rs.when_realtime(function() {
			state.timer_latch = true;
		});
	});

	rs.on("ready", function(value){ //event handler for ready button click
		rs.after_waiting_for_all(function() {
			initializeSimulation();
			next_tick();
		});
	});

	var next_tick = function() {
		rs.after_waiting_for_all(function() {
			state.sync_latch = true;
			if(state.timer_latch || !rs.is_realtime) {
				executeTick();
			}
		});
		if(rs.is_realtime) {
			state.timer = setTimeout(function() {
				state.timer_latch = true;
				if(state.sync_latch) {
					executeTick();
				}
			}, 1000 / state.frequency);
		}
	};

	var executeTick = function() {
		state.sync_latch = false;
		state.timer_latch = false;
		clearTimeout(state.timer);
		if(state.t < state.tMax - 1) {
			next_tick();
		}
		processTick({t: state.t + 1});
	};

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

Redwood.filter("action", function() {
	var actions = {
		1: "A",
		2: "B"
	};
	return function(value) {
		return	actions[value];
	}
});
