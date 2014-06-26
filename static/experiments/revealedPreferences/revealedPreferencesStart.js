Redwood.controller("SubjectCtrl", ["$rootScope", "$scope", "RedwoodSubject", function($rootScope, $scope, rs) {

	rs.on_load(function() {

		processConfig();

		if($scope.config.referencePeriod) {
			var referenceResult = rs.subject[rs.user_id].data.results.filter(function(result) {
				return result.period === $scope.config.referencePeriod;
			})[0];
			$scope.Ex = referenceResult.x;
			$scope.Ey = referenceResult.y;
		} else {
			$scope.Ex = $scope.config.Ex;
			$scope.Ey = $scope.config.Ey;
		}

		$scope.showDefault = $scope.config.enableDefault && $scope.config.showDefault;

		$scope.rounds = $scope.config.rounds || 1;
		$scope.round = 0;
		rs.trigger("next_round");
	});

	rs.on("next_round", function() {
		$scope.inputsEnabled = false;

		if($scope.rounds && $scope.round >= $scope.rounds) {
			rs.trigger("next_period");
			return;
		} else if($scope.round > 0 && $scope.config.x_over_y_threshold) {
			var prices = rs.subject[rs.user_id].get("prices");
			if(Math.abs(prices.x / prices.y) < $scope.config.x_over_y_threshold) {
				rs.trigger("next_period");
				return;
			}
		}

		//Begin next round
		$scope.round++;
		$scope.cursor = undefined;
		$scope.selection = undefined;

		var prices = rs.subject[rs.user_id].get("prices");
		$scope.Px = $scope.round > 1 ? prices.x : $scope.config.Px;
		$scope.Py = $scope.round > 1 ? prices.y : $scope.config.Py;

		$scope.budget = ($scope.Ex * $scope.Px) + ($scope.Ey * $scope.config.Py);
		$scope.maxX = $scope.budget / $scope.Px;
		$scope.maxY = $scope.budget / $scope.config.Py;

		$scope.xLimit = $scope.config.XLimit ? $scope.config.XLimit : $scope.maxX;
		$scope.yLimit = $scope.config.YLimit ? $scope.config.YLimit : $scope.maxY;

		if($scope.config.enableDefault) {
			rs.trigger("selection", [$scope.Ex, $scope.Ey]);
		}

		$scope.inputsEnabled = true;
	});

	rs.on("selection", function(selection) {
		$scope.selection = selection;
		$scope.inputsEnabled = true;
	});

	$scope.confirm = function() {
		if(!$scope.selection) {
			alert("Please select a ratio of x and y by clicking on the graph.");
		} else {
			$scope.inputsEnabled = false;
			rs.trigger("confirm");
		}
	};

	rs.on("confirm", function() {
		$scope.inputsEnabled = false;
		var chosen = Math.random() < $scope.config.ProbX ? "x" : "y";
		rs.trigger("result", { x: $scope.selection[0], y: $scope.selection[1], chosen: chosen });

		rs.synchronizationBarrier('round_' + $scope.round).then(function() {
			var excessDemandX = 0;
			var excessDemandY = 0;
			rs.subjects.filter(function(subject) {
				return subject.groupForPeriod && subject.groupForPeriod === rs.subject[rs.user_id].groupForPeriod;
			}).forEach(function(subject) {
				var selection = subject.get("selection");
				excessDemandX += selection[0] - $scope.Ex;
				excessDemandY += selection[1] - $scope.Ey;
			});
			var newPriceX = priceUpdateFormula($scope.Px, excessDemandX);
			var newPriceY = priceUpdateFormula($scope.Py, excessDemandY);
			rs.set("prices", { x: newPriceX, y: newPriceY, deltaX: newPriceX - $scope.Px, deltaY: newPriceY - $scope.Py });
			rs.trigger("next_round");
		});
	});

	rs.on("result", function(value) {
		$scope.results = $scope.results || [];
		$scope.results.push(value);
	});

	rs.on("next_period", function() {
		var finalResult = $scope.results[$scope.results.length - 1];
		finalResult.period = rs.period;
		rs.set("results", finalResult);
		if($scope.config.plotResult) {
			$scope.finalResult = finalResult;
			rs.next_period(5);
		} else {
			rs.next_period();
		}
	});

	var processConfig = function() {
		var userIndex = parseInt(rs.user_id) - 1;
		$scope.config = {};

		$scope.config.Ex = $.isArray(rs.config.Ex) ? rs.config.Ex[userIndex] : rs.config.Ex;
		$scope.config.Ey = $.isArray(rs.config.Ey) ? rs.config.Ey[userIndex] : rs.config.Ey;
		$scope.config.Px = $.isArray(rs.config.Px) ? rs.config.Px[userIndex] : rs.config.Px;
		$scope.config.Py = $.isArray(rs.config.Py) ? rs.config.Py[userIndex] : rs.config.Py;
		$scope.config.Z = $.isArray(rs.config.Z) ? rs.config.Z[userIndex] : rs.config.Z;
		$scope.config.XLimit = $.isArray(rs.config.XLimit) ? rs.config.XLimit[userIndex] : rs.config.XLimit;
		$scope.config.YLimit = $.isArray(rs.config.YLimit) ? rs.config.YLimit[userIndex] : rs.config.YLimit;
		$scope.config.XGrid = $.isArray(rs.config.XGrid) ? rs.config.XGrid[userIndex] : rs.config.XGrid;
		$scope.config.YGrid = $.isArray(rs.config.YGrid) ? rs.config.YGrid[userIndex] : rs.config.YGrid;
		$scope.config.ProbX = $.isArray(rs.config.ProbX) ? rs.config.ProbX[userIndex] : rs.config.ProbX;
		$scope.config.enableDefault = $.isArray(rs.config.enableDefault) ? rs.config.enableDefault[userIndex] : rs.config.enableDefault;
		$scope.config.showDefault = $.isArray(rs.config.showDefault) ? rs.config.showDefault[userIndex] : rs.config.showDefault;
		$scope.config.plotResult = $.isArray(rs.config.plotResult) ? rs.config.plotResult[userIndex] : rs.config.plotResult;

		$scope.config.rounds = rs.config.rounds;
		if(rs.config.x_over_y_threshold) {
			$scope.config.x_over_y_threshold = rs.config.x_over_y_threshold;
		}

		$scope.config.referencePeriod = rs.config.referencePeriod;
		$scope.config.pause = rs.config.pause;
	};

	var priceUpdateFormula = function(currentPrice, excessDemand) {
		return Math.max(currentPrice + excessDemand * ($scope.config.Z ? $scope.config.Z : 0), 0.01);
	};

}])

.directive('plot', ['RedwoodSubject', function(rs) {
		return {
			restrict: 'A',
			link: function($scope, $elem, attr) {

				$elem.bind("plothover", function (event, pos, item) {
					if(!$scope.inputsEnabled) return;
					var x = Math.min($scope.maxX, Math.max(0, pos.x));
					var y = ($scope.budget - (x * $scope.Px)) / $scope.config.Py;
					$scope.cursor = [x, y];
					replot();
				});

				$elem.bind("plotclick", function (event, pos, item) {
					if(!$scope.inputsEnabled) return;
					var x = Math.min($scope.maxX, Math.max(0, pos.x));
					var y = ($scope.budget - (x * $scope.Px)) / $scope.config.Py;
					rs.trigger("selection", [x, y]);
				});

				$elem.bind("mouseout", function (event) {
					if(!$scope.inputsEnabled) return;
					$scope.cursor = undefined;
					replot();
				});

				rs.on("next_round", function() {
					replot();
				});

				rs.on("selection", function() {
					replot();
				});

				$scope.$watch('finalResult', function() {
					replot();
				});

				function replot() {

					var data = [];

					data.push([0, $scope.maxY]);
					data.push([$scope.maxX, 0]);

					var dataset = [];

					dataset.push({
						data: data,
						lines: { show: true, lineWidth: 1.5 },
						points: { show: false },
						color: "red"
					});

					if($scope.cursor) {
						dataset.push({ //hollow cursor dot
							data: [$scope.cursor],
							lines: { show: false },
							points: { show: true, fill: false, radius: 4 },
							color: "black",
							hoverable: false
						});
					}

					if($scope.showDefault) {
						dataset.push({ //grey default dot
							data: [[$scope.Ex, $scope.Ey]],
							lines: { show: false },
							points: { show: true, lineWidth: 4, fill: true, radius: 3 },
							color: "grey",
							hoverable: false
						});
						dataset.push({ //grey default dot
							data: [[$scope.Ex, $scope.Ey]],
							lines: { show: false },
							points: { show: true, fill: true, radius: 1 },
							color: "grey",
							hoverable: false
						});
					}

					if($scope.selection) {
						dataset.push({ //black selection dot
							data: [$scope.selection],
							lines: { show: false },
							points: { show: true, lineWidth: 4, fill: true, radius: 4 },
							color: "black",
							hoverable: false
						});
						dataset.push({ //black selection dot
							data: [$scope.selection],
							lines: { show: false },
							points: { show: true, fill: true, radius: 1 },
							color: "black",
							hoverable: false
						});
						if(!$scope.finalResult) {
							dataset.push({ //dashed selection lines
								data: [[0, $scope.selection[1]], $scope.selection, [$scope.selection[0], 0]],
								dashes: { show: true, lineWidth: 1 },
								color: "black",
								hoverable: false
							});
						}
					}

					if($scope.finalResult) {
						var resultPoint = $scope.finalResult.chosen === "x" ? [$scope.finalResult.x, 0] : [0, $scope.finalResult.y];
						dataset.push({ //green result dot
							data: [resultPoint],
							lines: { show: false },
							points: { show: true, lineWidth: 4, fill: true, radius: 3 },
							color: "green",
							hoverable: false
						});
						dataset.push({ //green result dot
							data: [resultPoint],
							lines: { show: false },
							points: { show: true, fill: true, radius: 1 },
							color: "#51a351",
							hoverable: false
						});
						dataset.push({ //green result line
							data: [resultPoint, $scope.selection],
							dashes: { show: true, lineWidth: 1 },
							color: "#51a351",
							hoverable: false
						});
					}

					function draw_text(plot, ctx) { //display barrier and bankrupt text
						if($scope.cursor) {
							var offset = plot.pointOffset({ x: $scope.cursor[0], y: $scope.cursor[1] });
							var text = "[" + $scope.cursor[0].toFixed(2) + ", " + $scope.cursor[1].toFixed(2) + "]";
							ctx.fillStyle = "grey";
							ctx.fillText(text, offset.left + 10, offset.top - 10);
						}

						if($scope.selection) {
							var offset = plot.pointOffset({ x: $scope.selection[0], y: $scope.selection[1] });
							var text = "[" + $scope.selection[0].toFixed(2) + ", " + $scope.selection[1].toFixed(2) + "]";
							ctx.fillStyle = "black";
							ctx.fillText(text, offset.left + 10, offset.top - 10);
						}

						if($scope.showDefault) {
							var offset = plot.pointOffset({ x: $scope.Ex, y: $scope.Ey });
							var text = "[" + $scope.Ex.toFixed(2) + ", " + $scope.Ey.toFixed(2) + "]";
							ctx.fillStyle = "grey";
							ctx.fillText(text, offset.left + 10, offset.top - 10);
						}

						if($scope.finalResult) {
							var offset = plot.pointOffset({ x: resultPoint[0] , y: resultPoint[1] });
							var text = "[" + (resultPoint[0] || resultPoint[1]).toFixed(2) + "]";
							ctx.fillStyle = "#51a351";
							ctx.fillText(text, offset.left + 10, offset.top - 10);
						}
					}

					var opts = {
						grid: { clickable: true, hoverable: true },
						xaxis: { tickLength: 0, min: 0, max: $scope.xLimit },
						yaxis: { tickLength: 0, min: 0, max: $scope.yLimit },
						series: { shadowSize: 0 },
						hooks: { draw: [draw_text] }
					};

					$.plot($elem, dataset, opts);
				}

			}
		};
	}]);