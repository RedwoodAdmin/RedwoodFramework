Redwood.controller("SubjectCtrl", ["$rootScope", "$scope", "RedwoodSubject", function($rootScope, $scope, rs) {

	rs.on_load(function() {
		rs.config.pairs.forEach(function(pair, index) { //decide who is the first player and who is the second player
			var userIndex = pair.indexOf(parseInt(rs.user_id));
			if(userIndex > -1) {
				$scope.pair_index = index;
				$scope.user_index = userIndex;
				$scope.partner_id = pair[($scope.user_index + 1) % 2].toString();
			}
		});

		$scope.matrix = $scope.user_index === 0 ? rs.config.matrix : transpose(rs.config.matrix);

		$scope.round = 0;

		rs.gate('on_load', function() {
			rs.trigger("next_round"); //Start first round
		});
	});

	$scope.onSelection = function(selection) {
		if($scope.inputsEnabled) { //Only trigger action if selection has changed
			$scope.selection = selection;
		}
	};

	$scope.confirm = function() {
		if(!angular.isNullOrUndefined($scope.selection)) { //Check that user has selected an action
			$scope.inputsEnabled = false;
			rs.trigger("action", $scope.selection); //Trigger the current selection
		} else {
			alert("Please select an action.");
		}
	};

	rs.on("action", function(value) {
		$scope.inputsEnabled = false;
		$scope.selection = value;
		$scope.action = value;
		rs.after_waiting_for([$scope.partner_id], function() { //Call this function once the specified subjects have reached this point
			allocateRewards($scope.action, $scope.partnerAction);
			rs.trigger("next_round");
		});
	});

	rs.recv("action", function(sender, value) {
		if(sender == $scope.partner_id) {
			$scope.partnerAction = value; //Store partner action
		}
	});

	rs.on("next_round", function() {
		$scope.round++;
		$scope.rounds = rs.config.rounds[$scope.pair_index];

		$scope.prevAction = $scope.action; //Shift current action to previous action
		$scope.prevPartnerAction = $scope.partnerAction;

		if($scope.round > $scope.rounds) { //If we have completed the last round
			rs.next_period(5);
		} else {
			$scope.inputsEnabled = true;
		}
	});

	var allocateRewards = function(ai, aj){ //Allocate points according to user actions and matrix
		$scope.reward = $scope.matrix[ai - 1][aj - 1][0];
		rs.add_points($scope.reward);

		$scope.partnerReward = $scope.matrix[ai - 1][aj - 1][1];
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
