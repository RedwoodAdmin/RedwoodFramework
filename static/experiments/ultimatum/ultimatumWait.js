Redwood.controller("SubjectCtrl", ["$rootScope", "$scope", "RedwoodSubject", function($rootScope, $scope, rs) {

	$scope.IMAGE_URL = IMAGE_URL;

	$scope.state = {};

	rs.on_load(function() {

		$scope.config = rs.configs[0];

		$scope.$R = $scope.config.showR ? $scope.config.$R : 'R';
		$scope.$P = $scope.config.showP ? $scope.config.$P : 'P';

		$scope.state.loaded = true;
	});

	rs.on("ready", function() {
		$scope.state.ready = true;

		$("#answer").text($scope.answer);
		drawPlot();
		rs.timeout(function() {
			rs.trigger("time_up");
		}, 5000);
	});

	rs.on("time_up", function() {
		$scope.state.timeUp = true;
	});

	$scope.ready = function() {
		rs.trigger("ready");
	};

	$scope.submit = function(estimate) {
		var intRegex = /^\d+$/;
		if(intRegex.test(estimate)) {
			rs.trigger("submit", parseInt(estimate));
		} else {
			alert("Please enter a positive integer");
		}
	};

	rs.on("submit", function(value) {
		$scope.estimate = value;
		$scope.state.submitted = true;
	});

	function drawPlot() {
		var opts = {
			xaxis: { show: false, min: 0, max: 1 },
			yaxis: { show: false, min: 0, max: 1 }
		};

		var data = [];
		for(var i = 0, l = $scope.answer; i < l; i++) {
			data.push([Math.random(), Math.random()]);
		}

		var dataset = [];
		dataset.push({
			data: data, //plot account
			lines: { show: false },
			points: { show: true },
			hoverable: false
		});

		$.plot("#plot", dataset, opts);
	}

	rs.recv("answer", function(sender, value) {
		$scope.answer = value;
	});

	rs.on("submit", function(value) {
		rs.send("estimation", value);
	});

	rs.recv("roles_assigned", function() {
		rs.next_period();
	});

}]);