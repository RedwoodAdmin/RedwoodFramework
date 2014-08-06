Redwood.controller("SubjectCtrl", ["$rootScope", "$scope", "RedwoodSubject", function($rootScope, $scope, rs) {

	$scope.IMAGE_URL = IMAGE_URL;

	var ROLE = {
		P: 0,
		R: 1
	};

	$scope.state = {};

	rs.on_load(function() {

		$scope.config = rs.configs[0];

		$scope.$R = $scope.config.showR ? $scope.config.$R : 'R';
		$scope.$P = $scope.config.showP ? $scope.config.$P : 'P';

		$scope.state.loaded = true;

	});

	rs.on("ready", function() {
		$scope.state.ready = true;
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
			rs.trigger("estimate", parseInt(estimate));
		} else {
			alert("Please enter a positive integer");
		}
	};

	rs.on("estimate", function(value) {
		$scope.estimate = value;
		$scope.state.submitted = true;

		rs.synchronizationBarrier('submitted').then(function() {
			assignRoles();
		});
	});

	function assignRoles() {
		var correctAnswer = rs.configs[0].num_circles;
		var subjects = rs.subjects
			.map(function(subject) {
				return {
					user_id: subject.user_id,
					estimate: subject.get('estimate')
				};
			})
			.sort(function(a, b) {
				return Math.abs(correctAnswer - a.estimate) - Math.abs(correctAnswer - b.estimate);
			});
		var rank = subjects.indexOf(subjects.filter(function(subject) {
			return subject.user_id == rs.user_id;
		})[0]);
		var numRemainders = subjects.length % 2;
		numRemainders += (((subjects.length - numRemainders) / 2) % rs.configs[0].k) * 2;

		rs.set("rank", rank);
		if(rank < (subjects.length - numRemainders) / 2) {
			rs.set("role", ROLE.P);
			rs.next_period();
		} else if(rank < (subjects.length - numRemainders)) {
			rs.set("role", ROLE.R);
			rs.next_period();
		} else {
			rs.exclude();
			rs.add_points(rs.configs[0].$R);
			rs.finish();
		}
	}

	function drawPlot() {
		var opts = {
			xaxis: { show: false, min: 0, max: 1 },
			yaxis: { show: false, min: 0, max: 1 }
		};

		var data = [];
		for(var i = 0, l = rs.configs[0].num_circles; i < l; i++) {
			data.push([Math.random(), Math.random()]);
		}

		var dataset = [];
		dataset.push({
			data: data,
			lines: { show: false },
			points: { show: true },
			hoverable: false
		});

		$.plot("#plot", dataset, opts);
	}

}]);