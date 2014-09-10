Redwood.controller("SubjectCtrl", ["$rootScope", "$scope", "RedwoodSubject", function($rootScope, $scope, rs) {

	var ROLES = $scope.ROLES = {
		P: 0,
		R: 1
	};

	var $R, $P;
	var role;

	$scope.state = {};
	$scope.allResponses = [];


	$scope.propose = function() {
		var invalid;

		$scope.oppositeGroup.forEach(function(subjectId, i) {
			if(isNaN($scope.offerInputs[i])) {
				invalid = invalid || (i + 1);
			}
		});
		if(invalid) {
			alert("Please use the slider to specify a value for offer number " + invalid);
		} else {
			$scope.oppositeGroup.forEach(function(subject, i) {
				rs.trigger("offer", {to: subject, value: Number($scope.offerInputs[i])});
			});
			$scope.state.showInput = false;
			$scope.state.message = "Awaiting responses...";
		}
	};

	$scope.respond = function() {
		var invalid;
		$scope.oppositeGroup.forEach(function(subjectId, i) {
			if(!$scope.responseInputs[i]) {
				invalid = invalid || (i + 1);
			}
		});
		if(invalid) {
			alert("Please accept or reject offer " + invalid);
		} else {
			$scope.oppositeGroup.forEach(function(subjectId, i) {
				rs.trigger("response", {to: $scope.offers[i].from, value: $scope.offers[i].value, response: $scope.responseInputs[i] == 'accept'});
			});
			$scope.state.showInput = false;
		}
	};

	rs.on_load(function() {

		$scope.groups = assignGroups();

		$scope.state.role = role = rs.self.role;
		$scope.oppositeRole = (role === ROLES.P ? ROLES.R : ROLES.P);

		$scope.k = $scope.groups[$scope.oppositeRole].length;
		$scope.responses = [];

		$scope.round = 0;

		$R = rs.config.$R;
		$P = angular.isArray(rs.config.$P) ? rs.config.$P[rs.self.get("rank")] : rs.config.$P;

		$scope.$R = (!rs.config.showR && role === ROLES.P) ? 'R' : $R;
		$scope.$P = (!rs.config.showP && role === ROLES.R) ? 'P' : $P;
		$scope.basePay = role === ROLES.P ? '$' + $P : '$' + $R;

		if(rs.config.showR && role === ROLES.P) {
			$scope.oppositeBasePay = '$' + $R;
		} else if(rs.config.showP && role === ROLES.R) {
			if(angular.isArray(rs.config.$P)) {
				$scope.oppositeBasePay = 'See offers';
			} else {
				$scope.oppositeBasePay = '$' + $P;
			}
		} else {
			$scope.oppositeBasePay = 'Unknown';
		}

		rs.trigger("next_round");
	});

	rs.on("next_round", function() {
		$scope.round++;
		$scope.state.message = 'Waiting for other players...';

		if($scope.responses.length) {
			$scope.responses[$scope.responses.length - 1].forEach(function(response) {
				$scope.allResponses.push(response);
			});
		}

		rs.synchronizationBarrier('round-' + $scope.round).then(function() {

			if($scope.round > $scope.k) {
				if(rs.user_id === rs.subjects[0].user_id) {
					var match = {
						round: Math.floor(Math.random() * $scope.k),
						index: Math.floor(Math.random() * $scope.oppositeGroup.length)
					};
					rs.trigger("match", match);
				}
				return;
			}

			var oppositeGroupIndex = (role === ROLES.P ? (rs.self.group + ($scope.round - 1)) % $scope.k : (rs.self.group - ($scope.round - 1) + $scope.k) % $scope.k);
			$scope.oppositeGroup = $scope.groups[$scope.oppositeRole][oppositeGroupIndex];
			$scope.responses.push([]);
			var responses = $scope.responses[$scope.responses.length - 1];

			if(role === ROLES.P) {
				$scope.offerInputs = [];
				$scope.oppositeGroup.forEach(function(subject, i) {
					var index = (rs.self.index + i) % $scope.oppositeGroup.length;
					$scope.offerInputs.push('?');
					responses.push({from: $scope.oppositeGroup[index]});
				});
				delete $scope.state.message;
				$scope.state.showInput = true;
			} else {
				$scope.offers = [];
				$scope.responseInputs = [];
				$scope.oppositeGroup.forEach(function(subject, i) {
					var index = (rs.self.index - i + $scope.oppositeGroup.length) % $scope.oppositeGroup.length;
					$scope.offers.push({from: $scope.oppositeGroup[index]});
					responses.push({to: $scope.oppositeGroup[index]});
				});
				$scope.state.message = 'Awaiting offers...';
			}
		});
	});

	rs.on('offer', function() {
		$scope.state.showInput = false;
		$scope.state.message = "Awaiting responses...";
	});

	rs.recv("offer", function(sender, value) {
		if(value.to == rs.user_id) {
			var offer = $scope.offers.filter(function(offer) {
				return offer.from == sender;
			})[0];
			offer.value = value.value;
			offer.$P = angular.isArray(rs.config.$P) ? rs.config.$P[rs.subject[offer.from].get("rank")] : $P;

			var allOffersReceived = !$scope.offers.some(function(offer) {
				return angular.isUndefined(offer.value);
			});
			if(allOffersReceived) {
				delete $scope.state.message;
				$scope.state.showInput = true;
			}
		}
	});

	rs.on("response", function(value) {
		$scope.state.showInput = false;

		var response = $scope.responses[$scope.round - 1].filter(function(response) {
			return response.to == value.to;
		})[0];
		response.value = value.value;
		response.response = value.response;
		var allResponsesReceived = !$scope.responses[$scope.round - 1].some(function(response) {
			return angular.isUndefined(response.value);
		});
		if(allResponsesReceived) {
			rs.trigger("next_round");
		}
	});

	rs.recv("response", function(sender, value) {
		if(value.to == rs.user_id) {
			delete $scope.state.message;
			var response = $scope.responses[$scope.round - 1].filter(function(response) {
				return response.from == sender;
			})[0];
			response.value = value.value;
			response.response = value.response;
			var allResponsesReceived = !$scope.responses[$scope.round - 1].some(function(response) {
				return angular.isUndefined(response.value);
			});
			if(allResponsesReceived) {
				rs.trigger("next_round");
			}
		}
	});

	rs.recv("match", function(sender, value) {
		allocateRewards(value);
		rs.next_period();
	});

	rs.on("match", function(value) {
		allocateRewards(value);
		rs.next_period();
	});

	function assignGroups() {
		var groups = [];
		for(var role = 0; role < 2; role++) {
			groups.push([]);
			var subjects = rs.subjects.filter(function(subject) {
				return subject.get("role") == role;
			});
			var groupSize = Math.ceil(subjects.length / rs.config.k);
			var lastGroupSize = subjects.length - ((rs.config.k - 1) * groupSize);
			for(var group = 0; group < rs.config.k; group++) {
				groups[role].push([]);
				for(var i = 0, il = (group == rs.config.k - 1 ? lastGroupSize : groupSize); i < il; i++) {
					groups[role][group].push(subjects[group * groupSize + i].user_id);
					rs.subject[groups[role][group][i]].role = role;
					rs.subject[groups[role][group][i]].group = group;
					rs.subject[groups[role][group][i]].index = i;
				}
			}
		}
		return groups;
	}

	var allocateRewards = function(match) {
		if(role == ROLES.P) {
			var payment = $P;
			if($scope.responses[match.round][match.index].response) {
				payment += (rs.config.maxX - $scope.responses[match.round][match.index].value);
			}
			rs.add_points(payment);
		} else {
			var payment = $R;
			if($scope.responses[match.round][match.index].response) {
				payment += $scope.responses[match.round][match.index].value;
			}
			rs.add_points(payment);
		}
		rs.set("responses", $scope.responses);
		rs.set("selected_offer", match);
	};

}])

	.directive('slider', ['$timeout', 'RedwoodSubject', function($timeout, rs) {
		return {
			restrict: 'E',
			replace: true,
			template:
				'<div>' +
					'<div class="slider"></div>' +
					'<div class="slider-min" style="display:inline-block; text-align:left;">${{(0).toFixed(2)}}</div>' +
					'<div class="slider-max" style="display:inline-block; text-align:right;">${{config.maxX.toFixed(2)}}</div>' +
				'</div>',
			link: function($scope, elem, attr) {
				var $slider = $(elem).find('.slider');

				$slider.slider({
					min: 0, max: rs.config.maxX,
					step: 0.1,
					slide: function(event, ui) {
						if(ui.value < rs.config.minX) {
							$slider.slider("value", rs.config.minX);
							ui.value = rs.config.minX;
							event.preventDefault();
						}
						$scope.$apply(function() {
							$scope.offerInputs[$scope.$index] = ui.value.toFixed(2);
						});
					},
					stop: function(event, ui) {
						if(ui.value < rs.config.minX) {
							$slider.slider("value", rs.config.minX);
						}
					},
					change: function() {
						$slider.find(".ui-slider-handle").show();
					}
				});

				$timeout(function() {
					$(elem).find('.slider-min').css('width', $slider.outerWidth() / 2 + 'px');
					$(elem).find('.slider-max').css('width', $slider.outerWidth() / 2 + 'px');
				});

				$slider.find('.ui-slider-handle').hide();

			}
		};

	}])

	.filter('response', function() {
		return function(response) {
			return response ? "Accepted" : "Rejected";
		}
	})
	.filter('role', function() {
		return function(role) {
			if(role === 0) return 'Proposer';
			if(role === 1) return 'Responder';
		}
	});