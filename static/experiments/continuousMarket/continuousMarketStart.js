

Redwood.controller("SubjectCtrl", ["$compile", "$rootScope", "$scope", "$timeout", "RedwoodSubject", function($compile, $rootScope, $scope, $timeout, rs) {

	$scope.bid = {};
	$scope.ask = {};

	$scope.plotModel = {
		config: {},
		bidProjections: [],
		askProjections: [],
		hover: false,
		allocation: false
	};

	$scope.accept = {
		qty: 0
	};

	$scope.onBidInputChange = function() {
		if(isValidBid($scope.bid.price, $scope.bid.qty)) {
			var y = $scope.allocation.y - ($scope.bid.price * $scope.bid.qty);
			var x = $scope.allocation.x + $scope.bid.qty;
			$scope.plotModel.hover = {x: x, y: y};
		} else {
			$scope.plotModel.hover = false;
		}
	};

	$scope.submitBid = function() {
		if(isValidBid($scope.bid.price, $scope.bid.qty)) {
			$scope.bidButtonLocked = true;
			var index = rs.subject[rs.user_id].data.offer ? rs.subject[rs.user_id].data.offer.length : 0;
			rs.trigger("offer", {index: index, price: $scope.bid.price, qty: $scope.bid.qty});
			$scope.bid = {};
		}
	};

	$scope.onAskInputChange = function() {
		if(isValidAsk($scope.ask.price, -$scope.ask.qty)) {
			var y = $scope.allocation.y + ($scope.ask.price * $scope.ask.qty);
			var x = $scope.allocation.x - $scope.ask.qty;
			$scope.plotModel.hover = {x: x, y: y};
		} else {
			$scope.plotModel.hover = false;
		}
	};

	$scope.submitAsk = function() {
		if(isValidAsk($scope.ask.price, -$scope.ask.qty)) {
			$scope.askButtonLocked = true;
			var index = rs.subject[rs.user_id].data.offer ? rs.subject[rs.user_id].data.offer.length : 0;
			rs.trigger("offer", {index: index, price: $scope.ask.price, qty: -$scope.ask.qty});
			$scope.ask = {};
		}
	};

	$scope.projectOffer = function(offer) {
		if(!$scope.inputsEnabled) return;
		if(offer.user_id === rs.user_id) return;
		if(offer.qty < 0 && !$scope.config.canBuy) return;
		if(offer.qty > 0 && !$scope.config.canSell) return;
		var y = $scope.allocation.y + (offer.price * offer.qty);
		var x = $scope.allocation.x - offer.qty;
		$scope.plotModel.hover = {x: x, y: y};
	};

	$scope.openOffer = function(offer) {
		if(!$scope.inputsEnabled) return;
		if(offer.qty < 0 && !$scope.config.canBuy && offer.user_id !== rs.user_id) return;
		if(offer.qty > 0 && !$scope.config.canSell && offer.user_id !== rs.user_id) return;
		if(offer.user_id != rs.user_id) {
			$scope.selectedOffer = offer;
			$scope.accept.qty = Math.abs(offer.qty);
			$("#acceptModal").modal('show');
		}
	};

	$scope.acceptOffer = function() {
		if(!$scope.inputsEnabled) return;
		var offer = $scope.selectedOffer;
		if(offer.qty < 0 && !$scope.config.canBuy) return;
		if(offer.qty > 0 && !$scope.config.canSell) return;

		if($scope.accept.qty > 0 && $scope.accept.qty <= Math.abs(offer.qty)) {
			$(this).attr("disabled", "disabled");
			rs.trigger("accept", {user_id: offer.user_id, key: offer.key, qty: Math.abs(offer.qty) / offer.qty * $scope.accept.qty});
			$("#acceptModal").modal('hide');
		} else {
			alert("Please enter a valid quantity to accept for this offer.");
		}
	};

	$scope.$on("heatMap.click", function(e, x, y) {
		var qty = x - $scope.allocation.x;
		var price = (($scope.allocation.y - y) / qty);

		$scope.ask = {};
		$scope.bid = {};

		if($scope.config.canBid && isValidBid(price, qty)) {
			$scope.bid = {price: price, qty: qty};

		} else if($scope.config.canAsk && isValidAsk(price, qty)) {
			$scope.ask = {price: price, qty: -qty};
		}
	});

	rs.on("trade", function() {
		$scope.trades = rs.data.trade || [];
	});
	rs.recv("trade", function() {
		$scope.trades = rs.data.trade || [];
	});

	function isValidBid(price, qty) {
		return !isNaN(price)
			&& price >= 0
			&& !isNaN(qty)
			&& qty > 0;
	}

	function isValidAsk(price, qty) {
		return !isNaN(price)
			&& price >= 0
			&& !isNaN(qty)
			&& qty < 0;
	}

	rs.on_load(function() {

		processConfig();

		$scope.utilityFunction = new Function(["x", "y"], "return " + $scope.config.utility + ";");

		$scope.dotsPerLine = 80;

		$scope.Ex = $scope.config.Ex;
		$scope.Ey = $scope.config.Ey;

		$scope.showDefault = $scope.config.enableDefault && $scope.config.showDefault;

		$scope.plotModel.config.utilityFunction = $scope.utilityFunction;
		$scope.plotModel.config.dotsPerLine = $scope.dotsPerLine;
		$scope.plotModel.config.numCurves = $scope.config.numCurves;

		$scope.rounds = $scope.config.rounds || 1;
		$scope.round = 0;
		rs.trigger("next_round");

	});

	var checkTime = function() {
		if(!$scope.roundStartTime) return;
		var now = (new Date()).getTime() / 1000;
		$scope.timeRemaining = ($scope.roundStartTime + $scope.config.roundDuration) - now;
		if ($scope.timeRemaining <= 0) {
			$scope.timeRemaining = 0;
			$scope.inputsEnabled = false;
			$scope.roundStartTime = null;
			rs.trigger("next_round");
		} else {
			$timeout(checkTime, 1000);
		}
	};

	rs.recv("next_round", function(sender, time) {
		if($scope.roundStartTime) {
			$scope.inputsEnabled = false;
			$scope.roundStartTime = null;
			rs.trigger("next_round");
		}
	});


	rs.on("next_round", function(time) {

		$scope.inputsEnabled = false;

		if($scope.rounds && $scope.round >= $scope.rounds) {
			rs.trigger("next_period");
			return;
		}

		//Begin next round
		$scope.round++;

		rs.synchronizationBarrier('round-' + $scope.round).then(function() {

			$scope.allocation = {x: $scope.Ex, y: $scope.Ey};

			$scope.plotModel.config.xLimit = $scope.config.XLimit;
			$scope.plotModel.config.yLimit = $scope.config.YLimit;
			$scope.$broadcast("plot.activate");

			$scope.offers = {};

			$scope.roundStartTime = (new Date()).getTime() / 1000;
			rs.trigger("roundStartTime", $scope.roundStartTime);
			rs.timeout(checkTime);

			$scope.inputsEnabled = true;
		});
	});

	rs.on("roundStartTime", function(roundStartTime) {
		$scope.roundStartTime = Math.min(roundStartTime, $scope.roundStartTime);
	});
	rs.recv("roundStartTime", function(sender, roundStartTime) {
		$scope.roundStartTime = Math.min(roundStartTime, $scope.roundStartTime);
	});

	rs.on("allocation", function(allocation) {
		$scope.allocation = allocation;
	});

	rs.on("offer", function(offer) {
		offer = $.extend(offer, {user_id: rs.user_id});
		var key = getOfferKey(offer);
		$scope.offers[key] = $.extend(offer, {key: key});

		$scope.bidButtonLocked = false;
		$scope.askButtonLocked = false;
	});

	rs.recv("offer", function(user_id, offer) {
		offer = $.extend(offer, {user_id: user_id});
		var key = getOfferKey(offer);
		$scope.offers[key] = $.extend(offer, {key: key});
	});

	rs.on("accept", function(accepted) {
		var offer = $scope.offers[accepted.key];
		if(Math.abs(offer.qty) >= Math.abs(accepted.qty)) {
			$scope.allocation.y += offer.price * accepted.qty;
			$scope.allocation.x -= accepted.qty;
			offer.qty -= accepted.qty;
			if(offer.qty == 0) {
				offer.closed = true;
			}
			rs.trigger("trade", angular.extend(accepted, {price: offer.price}));
		} else {
			alert("Transaction failed.");
		}
	});

	rs.recv("accept", function(sender, accepted) {
		if(Math.abs($scope.offers[accepted.key].qty) >= Math.abs(accepted.qty)) {
			if(accepted.user_id == rs.user_id) {
				$scope.allocation.y -= $scope.offers[accepted.key].price * $scope.offers[accepted.key].qty;
				$scope.allocation.x += $scope.offers[accepted.key].qty;
			}
			$scope.offers[accepted.key].qty -= accepted.qty;
			if($scope.offers[accepted.key].qty == 0) {
				$scope.offers[accepted.key].closed = true;
			}
		}
	});

	rs.on("result", function(value) {
		if(!$scope.results) {
			$scope.results = [];
		}
		$scope.results.push(value);
	});

	rs.on("next_period", function() {
		var finalResult = {x: $scope.allocation.x, y: $scope.allocation.y, utility: $scope.utilityFunction($scope.allocation.x, $scope.allocation.y)};
		finalResult.period = rs.period;
		rs.set("results", finalResult);
		rs.add_points($scope.utilityFunction($scope.allocation.x, $scope.allocation.y));
		rs.next_period();
	});

	var processConfig = function() {
		var userIndex = parseInt(rs.user_id) - 1;
		$scope.config = {};

		$scope.config.Ex = $.isArray(rs.config.Ex) ? rs.config.Ex[userIndex] : rs.config.Ex;
		$scope.config.Ey = $.isArray(rs.config.Ey) ? rs.config.Ey[userIndex] : rs.config.Ey;
		$scope.config.utility = $.isArray(rs.config.utility) ? rs.config.utility[userIndex] : rs.config.utility;
		$scope.config.canBid = $.isArray(rs.config.canBid) ? rs.config.canBid[userIndex] : rs.config.canBid;
		$scope.config.canAsk = $.isArray(rs.config.canAsk) ? rs.config.canAsk[userIndex] : rs.config.canAsk;
		$scope.config.canBuy = $.isArray(rs.config.canBuy) ? rs.config.canBuy[userIndex] : rs.config.canBuy;
		$scope.config.canSell = $.isArray(rs.config.canSell) ? rs.config.canSell[userIndex] : rs.config.canSell;

		$scope.config.XLimit = $.isArray(rs.config.XLimit) ? rs.config.XLimit[userIndex] : rs.config.XLimit;
		$scope.config.YLimit = $.isArray(rs.config.YLimit) ? rs.config.YLimit[userIndex] : rs.config.YLimit;
		$scope.config.ProbX = $.isArray(rs.config.ProbX) ? rs.config.ProbX[userIndex] : rs.config.ProbX;
		$scope.config.showHeatmap = $.isArray(rs.config.showHeatmap) ? rs.config.showHeatmap[userIndex] : rs.config.showHeatmap;
		$scope.config.numCurves = $.isArray(rs.config.numCurves) ? rs.config.numCurves[userIndex] : rs.config.numCurves;

		$scope.config.rounds =  rs.config.rounds;
		$scope.config.roundDuration =  rs.config.roundDuration;

		$scope.config.pause = rs.config.pause;
	};

	function getOfferKey(offer) {
		return offer.user_id + "-" + offer.index;
	}

	$scope.$watch("offers", function(offers) {
		if(!offers) return;
		$scope.bids = Object.keys(offers)
			.filter(function(d) {
				return offers[d].qty > 0 && !offers[d].closed;
			})
			.sort(function(a, b) {
				return offers[a].price - offers[b].price;
			})
			.map(function(d) {
				return offers[d];
			});


		$scope.asks = Object.keys(offers)
			.filter(function(d) {
				return offers[d].qty < 0 && !offers[d].closed;
			})
			.sort(function(a, b) {
				return offers[b].price - offers[a].price;
			})
			.map(function(d) {
				return offers[d];
			});

		if($scope.config.canSell) {
			var x = $scope.allocation.x;
			var y = $scope.allocation.y;
			$scope.plotModel.bidProjections = $scope.bids
				.filter(function(bid) {
					return bid.user_id != rs.user_id;
				})
				.map(function(bid) {
					x -= bid.qty;
					y += (bid.price * bid.qty);
					return {
						x: x,
						y: y
					};
				});
		}

		if($scope.config.canBuy) {
			var x = $scope.allocation.x;
			var y = $scope.allocation.y;
			$scope.plotModel.askProjections = $scope.asks
				.filter(function(ask) {
					return ask.user_id != rs.user_id;
				})
				.map(function(ask) {
					x -= ask.qty;
					y += (ask.price * ask.qty);
					return {
						x: x,
						y: y
					};
				});
		}

	}, true /*Deep watch*/);

	$scope.$watch("allocation", function(allocation) {
		$scope.plotModel.allocation = allocation;
	}, true);

}]);

Redwood.directive("svgPlot", ['$timeout', 'AsyncCallManager', function($timeout, AsyncCallManager) {
	return {
		restrict: 'E',
		replace: true,
		scope: {
			config: '=',
			bidProjections: '=',
			askProjections: '=',
			allocation: '=',
			hover: '='
		},
		template: "<svg version='1.1'></svg>",
		link: function($scope, element, attrs) {

			var utilityGrid,
				scales = {},
				referenceValues,
				mouseDown,
				dragging = false;

			var xMin, xMax, yMin, yMax;

			var svgWidth = $(element[0]).parent().width();
			var svgHeight = svgWidth;

			$(element[0]).height(svgHeight);

			var svg = d3.select(element[0]);

			var plotMargin = { top: 10, right: 10, bottom: 40, left: 40 };

			var plotWidth = svgWidth - plotMargin.left - plotMargin.right;
			var plotHeight = svgHeight - plotMargin.bottom - plotMargin.top;

			svg.append("defs").append("clipPath")
				.attr("id", "plotAreaClip")
				.append("rect")
				.attr("x", "0")
				.attr("y", "0")
				.attr("width", plotWidth)
				.attr("height", plotHeight);

			var plot = svg.append("g")
				.attr("transform", "translate(" + plotMargin.left + "," + plotMargin.top + ")")
				.attr("clip-path", "url(#plotAreaClip)");

			var baseLayer = plot.append("g")
				.style("cursor", "pointer");

			var heatMapContainer = baseLayer.append("g");

			var xAxisContainer = svg.append("g")
				.attr("class", "axis")
				.attr("transform", "translate(" + (plotMargin.left) + ", " + (plotMargin.top + plotHeight) + ")");
			var xAxis = d3.svg.axis()
				.outerTickSize(5);

			var yAxisContainer = svg.append("g")
				.attr("class", "axis")
				.attr("transform", "translate(" + plotMargin.left + ", " + plotMargin.top + ")");
			var yAxis = d3.svg.axis()
				.orient("left")
				.outerTickSize(5);

			svg.append("text")
				.attr("class", "axis label")
				.attr("x", (plotWidth / 2) + plotMargin.left)
				.attr("y", svgHeight - 5)
				.text("[ X ]");

			svg.append("text")
				.attr("class", "axis label")
				.attr("transform", "rotate(-90)")
				.attr("y", 10)
				.attr("x", -((plotHeight / 2) + plotMargin.top))
				.text("[ Y ]");

			var bidProjectionContainer = baseLayer.append("g")
				.attr("class", "bid-projection-container");
			var askProjectionContainer = baseLayer.append("g")
				.attr("class", "ask-projection-container");

			var allocationContainer = baseLayer.append("g")
				.attr("class", "allocation-container");
			var allocationText = allocationContainer.append("text")
				.attr("class", "allocation-text");
			var allocationPoint = allocationContainer.append("circle")
				.attr("class", "allocation-point")
				.attr("r", 5);
			var allocationCurve = d3.rw.indifferenceCurve();

			var hoverContainer = baseLayer.append("g")
				.attr("class", "hover-container");
			var hoverText = hoverContainer.append("text")
				.attr("class", "hover-text");
			var hoverPoint = hoverContainer.append("circle")
				.attr("class", "hover-point")
				.attr("r", 5);
			var hoverCurve = d3.rw.indifferenceCurve();

			plot.on("click", function() {
				var position = d3.mouse(this);
				var x = scales.offsetToX(position[0]);
				var y = scales.offsetToY(position[1]);
				$scope.$emit("heatMap.click", x, y);
			});

			plot.on("mousedown", function() {
				var position = d3.mouse(this);
				$scope.$apply(function() {
					mouseDown = {x: scales.offsetToX(position[0]), y: scales.offsetToY(position[1])};
				});
			});
			plot.on("mouseup", function() {
				$scope.$apply(function() {
					mouseDown = false;
					if(dragging) {
						dragging = false;
						onMove();
					}
				});
			});

			var from, to;
			plot.on("mousemove", function() {
				var position = d3.mouse(this);
				$scope.$apply(function() {

					var values = {x: scales.offsetToX(position[0]), y: scales.offsetToY(position[1])};

					if(mouseDown) {
						dragging = true;
						from = angular.copy(mouseDown);
						to = angular.copy(values);
						onDrag();
					} else {
						$scope.hover = values;
					}
				});
			});

			plot.on("mouseleave", function() {
				$scope.$apply(function() {
					mouseDown = false;
					if(dragging) {
						dragging = false;
						to = from;
						onDrag();
					}
					$scope.hover = false;
				});
			});

			var zoom = d3.behavior.zoom()
				.on("zoom", function() {
					//mouseDown = false;
					var position = d3.mouse(this);
					var x = scales.offsetToX(position[0]);
					var y = scales.offsetToY(position[1]);
					onZoom(x, y);
				});
			plot.call(zoom);

			$scope.$on("plot.activate", function() {

				initialize();

				$scope.$watch("config", redrawAll, true);
				$scope.$watch("bidProjections", function(projections) {
					redrawProjections(projections, "bid");
				}, true);
				$scope.$watch("askProjections", function(projections) {
					redrawProjections(projections, "ask");
				}, true);
				$scope.$watch("allocation", redrawAllocation, true);
				$scope.$watch("hover", redrawHoverCurve, true);
			});

			function generateScales() {
				scales.indexToX = d3.scale.linear().domain([0, $scope.config.dotsPerLine - 1]).range([xMin, xMax]);
				scales.indexToY = d3.scale.linear().domain([0, $scope.config.dotsPerLine - 1]).range([yMin, yMax]);
				scales.xToOffset = d3.scale.linear().domain([xMin, xMax]).range([0, plotWidth]).clamp(false);
				scales.yToOffset = d3.scale.linear().domain([yMin, yMax]).range([plotHeight, 0]).clamp(false);
				scales.xIndexToOffset = function(d) { return scales.xToOffset(scales.indexToX(d)); };
				scales.yIndexToOffset = function(d) { return scales.yToOffset(scales.indexToY(d)); };
				scales.offsetToX = d3.scale.linear().domain([0, plotWidth]).range([xMin, xMax]).clamp(true);
				scales.offsetToY = d3.scale.linear().domain([plotHeight, 0]).range([yMin, yMax]).clamp(true);
			}

			function onDrag() {
				/*
				var xDiff = scales.xToOffset(to.x) - scales.xToOffset(from.x);
				var yDiff = scales.yToOffset(to.y) - scales.yToOffset(from.y);
				baseLayer.attr("transform", "translate(" + xDiff + "," + yDiff + ")");
				*/
				onMove();
			}

			var onMove = AsyncCallManager.mergeOverlappingCallsTo(function() {

				return $timeout(function() {
					var xDiff = to.x - from.x;
					var xRange = xMax - xMin;
					xMin = Math.max(Math.min($scope.config.xLimit, xMin - xDiff), 0);
					xMax = xMin + xRange;
					if(xMax > $scope.config.xLimit) {
						xMax = $scope.config.xLimit;
						xMin = xMax - xRange;
					}

					var yDiff = to.y - from.y;
					var yRange = yMax - yMin;
					yMin = Math.max(Math.min($scope.config.yLimit, yMin - yDiff), 0);
					yMax = yMin + yRange;
					if(yMax > $scope.config.yLimit) {
						yMax = $scope.config.yLimit;
						yMin = yMax - yRange;
					}

					generateScales();

					baseLayer.attr("transform", "translate(" + "0" + "," + "0" + ")");
					redrawAll($scope.config);
				});
			});

			function onZoom(x, y) {
				var scale = 1 / d3.event.scale;
				if(scale > 1) {
					zoom.scale(1);
					scale = 1;
				}
				if(d3.event.scale > 10000) {
					zoom.scale(10000);
					scale = 1 / d3.event.scale;
				}

				var xRange = $scope.config.xLimit * scale;
				var xFactor = (x - xMin) / (xMax - xMin);
				xMin = Math.max(x - (xRange * xFactor), 0);
				xMax = xMin + xRange;
				if(xMax > $scope.config.xLimit) {
					xMax = $scope.config.xLimit;
					xMin = xMax - xRange;
				}

				var yRange = $scope.config.yLimit * scale;
				var yFactor = (y - yMin) / (yMax - yMin);
				yMin = Math.max(y - (yRange * yFactor), 0);
				yMax = yMin + yRange;
				if(yMax > $scope.config.yLimit) {
					yMax = $scope.config.yLimit;
					yMin = yMax - yRange;
				}

				generateScales();

				redrawAll($scope.config);
			}

			function initialize() {

				xMin = 0;
				xMax = $scope.config.xLimit;
				yMin = 0;
				yMax = $scope.config.yLimit;

				generateScales();

				utilityGrid = d3.rw.functionGrid($scope.config.utilityFunction, scales.indexToX, scales.indexToY);

				var minUtility = d3.min(utilityGrid, function(col) {
					return d3.min(col);
				});
				var maxUtility = d3.max(utilityGrid, function(col) {
					return d3.max(col);
				});

				var colorRange = ["#0000ff", "#0000ff", "#0000ff", "#00ffff", "#00ff00", "#ffff00", "#ff0000"];
				var colorDomain = d3.rw.stretch([minUtility, maxUtility], colorRange.length);
				scales.colorScale = d3.scale.linear().domain(colorDomain).range(colorRange);

				referenceValues = [];
				for(var i = 0; i < $scope.config.numCurves; i++) {
					referenceValues.push($scope.config.utilityFunction(((i + 1) * (xMax - xMin) / ($scope.config.numCurves + 1)) + xMin, ((i + 1) * (yMax - yMin) / ($scope.config.numCurves + 1)) + yMin));
				}

			}

			function redrawAll(config) {
				if(!config) {
					return;
				}

				xAxis.scale(scales.xToOffset);
				xAxisContainer.call(xAxis);

				yAxis.scale(scales.yToOffset);
				yAxisContainer.call(yAxis);

				utilityGrid = d3.rw.functionGrid(config.utilityFunction, scales.indexToX, scales.indexToY);

				var heatMap = d3.rw.heatMap()
					.grid(utilityGrid)
					.xScale(scales.xIndexToOffset)
					.yScale(scales.yIndexToOffset)
					.colorScale(scales.colorScale);
				heatMapContainer.call(heatMap);

				var referenceCurves = baseLayer.selectAll(".reference-curve").data(referenceValues);
				referenceCurves.enter()
					.append("g")
					.attr("class", "reference-curve");
				referenceCurves.each(function(value) {
					d3.select(this).call(d3.rw.indifferenceCurve()
							.grid(utilityGrid)
							.xScale(scales.xIndexToOffset)
							.yScale(scales.yIndexToOffset)
							.value(value)
					);
				});

				redrawProjections($scope.bidProjections, "bid");
				redrawProjections($scope.askProjections, "ask");

				allocationCurve.grid(utilityGrid)
					.xScale(scales.xIndexToOffset)
					.yScale(scales.yIndexToOffset);
				redrawAllocation($scope.allocation);

				hoverCurve.grid(utilityGrid)
					.xScale(scales.xIndexToOffset)
					.yScale(scales.yIndexToOffset);
				redrawHoverCurve($scope.hover);
			}

			function redrawAllocation(allocation) {
				if(!$scope.config) {
					return;
				}

				if(!allocation) {
					allocationContainer.attr("visibility", "hidden");
				}

				var utility = $scope.config.utilityFunction(allocation.x, allocation.y);

				allocationText
					.attr("x", scales.xToOffset(allocation.x) + 10)
					.attr("y", scales.yToOffset(allocation.y) - 10)
					.text("[" + utility.toFixed(2) + "]");

				allocationPoint.attr("cx", scales.xToOffset(allocation.x)).attr("cy", scales.yToOffset(allocation.y));

				allocationContainer.call(allocationCurve.value(utility));

				allocationContainer.attr("visibility", "visible");
			}

			function redrawProjections(projections, type) {

				var container = type === "bid" ? bidProjectionContainer : askProjectionContainer;
				var color = type === "bid" ? "red" : "blue";
				var points = container.selectAll('.projection-point').data(projections || []);

				points.enter()
					.append("circle")
					.attr("class", "projection-point")
					.attr("r", 5)
					.attr("fill", color);

				points
					.attr("cx", function(projection) {
						return scales.xToOffset(projection.x);
					})
					.attr("cy", function(projection) {
						return scales.yToOffset(projection.y);
					});

				points.exit().remove();

				var connectors = container.selectAll('.projection-connector').data(projections || []);

				var previous = [scales.xToOffset($scope.allocation.x), scales.yToOffset($scope.allocation.y)];
				connectors.enter()
					.append("g")
					.attr("class", "projection-connector");
				connectors
					.each(function(projection) {
						d3.select(this).selectAll('*').remove();
						var current = [scales.xToOffset(projection.x), scales.yToOffset(projection.y)];
						d3.select(this).append("path").data([[angular.copy(previous), current]])
							.style("fill", "none")
							.style("stroke", color)
							.style("stroke-width", "2")
							.attr("d", d3.svg.line());
						previous = current;
					});

				connectors.exit().remove();
			}

			function redrawHoverCurve(hover) {
				if(!$scope.config) {
					return;
				}

				if(!hover) {
					hoverContainer.attr("visibility", "hidden");
				} else {

					var xOffset = scales.xToOffset(hover.x);
					var yOffset = scales.yToOffset(hover.y);

					var utility = $scope.config.utilityFunction(hover.x, hover.y);

					hoverText
						.attr("x", xOffset + 10)
						.attr("y", yOffset - 10)
						.text("[" + utility.toFixed(2) + "]");

					hoverPoint.attr("cx", xOffset).attr("cy", yOffset);

					hoverContainer.call(hoverCurve.value(utility));

					hoverContainer.attr("visibility", "visible");

				}

			}

		}
	};
}]);

Redwood
	.filter("offerType", function() {
		return function(offer) {
			if(angular.isUndefined(offer) || offer === null) {
				return "";
			}
			return (offer.qty > 0 ? "Bid" : "Ask");
		};
	});