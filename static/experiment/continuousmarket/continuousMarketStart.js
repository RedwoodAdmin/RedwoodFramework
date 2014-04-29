

Redwood.controller("SubjectCtrl", ["$rootScope", "$scope", "Subject", function($rootScope, $scope, rs) {

	$scope.projectOffer = function(offer) {
		if(!$scope.inputsEnabled) return;
		if(offer.user_id === rs.user_id) return;
		if(offer.qty < 0 && !$scope.config.canBuy) return;
		if(offer.qty > 0 && !$scope.config.canSell) return;
		var y = $scope.allocation.y + (offer.price * offer.qty);
		var x = $scope.allocation.x - offer.qty;
		Display.svgDrawHoverData(x, y);
	};

	$scope.openOffer = function(offer) {
		if(!$scope.inputsEnabled) return;
		if(offer.qty < 0 && !$scope.config.canBuy && offer.user_id !== rs.user_id) return;
		if(offer.qty > 0 && !$scope.config.canSell && offer.user_id !== rs.user_id) return;
		if(offer.user_id != rs.user_id) {
			$scope.selectedOffer = offer;
			$scope.acceptQty = Math.abs(offer.qty);
			$("#accept").removeAttr("disabled");
			$("#acceptModal").modal('show');
		}
	};

	$scope.acceptOffer = function() {
		if(!$scope.inputsEnabled) return;
		var offer = $scope.selectedOffer;
		if(offer.qty < 0 && !$scope.config.canBuy) return;
		if(offer.qty > 0 && !$scope.config.canSell) return;

		var acceptedQty = parseFloat($("#acceptQty").val());
		if(acceptedQty > 0 && acceptedQty <= Math.abs(offer.qty)) {
			$(this).attr("disabled", "disabled");
			rs.trigger("accept", {user_id: offer.user_id, key: offer.key, qty: Math.abs(offer.qty) / offer.qty * acceptedQty});
			$("#acceptModal").modal('hide');
		} else {
			alert("Please enter a valid quantity to accept for this offer.");
		}
	};

	$scope.svgHeight = function() {
		return $("#d3-plot").width();
	};

	var Display = {

		initialize: function() {

			rs.on("accept", function(point) {
				Display.updateTradePanels();
				Display.svgDrawAllocation();
			});

			rs.recv("accept", function(sender, point) {
				Display.updateTradePanels();
				Display.svgDrawAllocation();
			});

			rs.on("trade", function(point) {
				Display.updateTradePanels();
			});

			rs.recv("trade", function(point) {
				Display.updateTradePanels();
			});

			$("#bid-price").change(function() {
				Display.onBidInputChange();
			});
			$("#bid-qty").change(function() {
				Display.onBidInputChange();
			});

			$("#ask-price").change(function() {
				Display.onAskInputChange();
			});
			$("#ask-qty").change(function() {
				Display.onAskInputChange();
			});

			$("#bid-button").click(function() {
				if(!$scope.inputsEnabled || !$scope.config.canBid) return;
				$("#bid-button").attr("disabled", "disabled");
				var price = parseFloat($("#bid-price").val());
				var qty = parseFloat($("#bid-qty").val());
				if(Display.isValidBid(price, qty)) {
					$("#bid-price").val("");
					$("#bid-qty").val("");
					var index = rs.subject[rs.user_id].data.offer ? rs.subject[rs.user_id].data.offer.length : 0;
					rs.trigger("offer", {index: index, price: price, qty: qty});
				} else {
					$("#bid-button").removeAttr("disabled");
				}
			});

			$("#ask-button").click(function() {
				if(!$scope.inputsEnabled || !$scope.config.canAsk) return;
				$("#ask-button").attr("disabled", "disabled");
				var price = parseFloat($("#ask-price").val());
				var qty = -parseFloat($("#ask-qty").val());
				if(Display.isValidAsk(price, qty)) {
					$("#ask-price").val("");
					$("#ask-qty").val("");
					var index = rs.subject[rs.user_id].data.offer ? rs.subject[rs.user_id].data.offer.length : 0;
					rs.trigger("offer", {index: index, price: price, qty: qty});
				} else {
					$("#ask-button").removeAttr("disabled");
				}
			});

			rs.on("offer", function() {
				$("#bid-button").removeAttr("disabled");
				$("#ask-button").removeAttr("disabled");
				Display.updateTradePanels();
			});

			rs.recv("offer", function() {
				Display.updateTradePanels();
			});

		},

		onBidInputChange: function() {
			if(!$scope.inputsEnabled || !$scope.config.canBid) return;
			var price = parseFloat($("#bid-price").val());
			var qty = parseFloat($("#bid-qty").val());
			if(Display.isValidBid(price, qty)) {
				var y = $scope.allocation.y - (price * qty);
				var x = $scope.allocation.x + qty;
				Display.svgDrawHoverData(x, y);
			} else {
				Display.svgDrawHoverData(false);
			}
		},

		onAskInputChange: function() {
			if(!$scope.inputsEnabled || !$scope.config.canAsk) return;
			var price = parseFloat($("#ask-price").val());
			var qty = -parseFloat($("#ask-qty").val());
			if(Display.isValidAsk(price, qty)) {
				var y = $scope.allocation.y - (price * qty);
				var x = $scope.allocation.x + qty;
				Display.svgDrawHoverData(x, y);
			} else {
				Display.svgDrawHoverData(false);
			}
		},

		updateTradePanels: function() {
			$scope.bids = Object.keys($scope.offers)
				.filter(function(d) {
					return $scope.offers[d].qty > 0 && !$scope.offers[d].closed;
				})
				.sort(function(a, b) {
					return $scope.offers[a].price - $scope.offers[b].price;
				})
				.map(function(d) {
					return $scope.offers[d];
				});


			$scope.asks = Object.keys($scope.offers)
				.filter(function(d) {
					return $scope.offers[d].qty < 0 && !$scope.offers[d].closed;
				})
				.sort(function(a, b) {
					return $scope.offers[a].price - $scope.offers[b].price;
				})
				.map(function(d) {
					return $scope.offers[d];
				});

			$scope.trades = rs.data.trade || [];
		},

		isValidBid: function(price, qty) {
			return !isNaN(price)
				&& price >= 0
				&& !isNaN(qty)
				&& qty > 0;
		},

		isValidAsk: function(price, qty) {
			return !isNaN(price)
				&& price >= 0
				&& !isNaN(qty)
				&& qty < 0;
		},

		svgPrepare: function() {
			var plotMargin = { top: 10, right: 10, bottom: 40, left: 40 };

			$scope.svg = d3.select("#d3-plot");

			$scope.plotWidth = $("#d3-plot").width() - plotMargin.left - plotMargin.right;
			$scope.plotHeight = $("#d3-plot").height() - plotMargin.bottom - plotMargin.top;

			$scope.plot = $scope.svg.append("g")
				.attr("transform", "translate(" + plotMargin.left + "," + plotMargin.top + ")");

			$scope.scales = {};

			$scope.scales.indexToX = d3.scale.linear().domain([0, $scope.dotsPerLine - 1]).range([0, $scope.xLimit]);
			$scope.scales.indexToY = d3.scale.linear().domain([0, $scope.dotsPerLine - 1]).range([0, $scope.yLimit]);
			$scope.scales.xToOffset = d3.scale.linear().domain([0, $scope.xLimit]).range([0, $scope.plotWidth]).clamp(true);
			$scope.scales.yToOffset = d3.scale.linear().domain([0, $scope.yLimit]).range([$scope.plotHeight, 0]).clamp(true);
			$scope.scales.xIndexToOffset = function(d) { return $scope.scales.xToOffset($scope.scales.indexToX(d)); };
			$scope.scales.yIndexToOffset = function(d) { return $scope.scales.yToOffset($scope.scales.indexToY(d)); };

			$scope.scales.offsetToX = d3.scale.linear().domain([0, $scope.plotWidth]).range([0, $scope.xLimit]).clamp(true);
			$scope.scales.offsetToY = d3.scale.linear().domain([$scope.plotHeight, 0]).range([0, $scope.yLimit]).clamp(true);

			$scope.xAxis = d3.svg.axis()
				.scale($scope.scales.xToOffset)
				.outerTickSize(5);
			$scope.plot.append("g")
				.attr("transform", "translate(0," + ($scope.plotHeight) + ")")
				.attr("class", "axis")
				.call($scope.xAxis);

			$scope.yAxis = d3.svg.axis()
				.scale($scope.scales.yToOffset)
				.orient("left")
				.outerTickSize(5);
			$scope.plot.append("g")
				.attr("class", "axis")
				.call($scope.yAxis);

			$scope.plot.append("text")
				.attr("class", "axis label")
				.attr("x", $scope.scales.xToOffset($scope.xLimit / 2))
				.attr("y", $scope.scales.yToOffset(0) + 35)
				.text("[ X ]");

			$scope.plot.append("text")
				.attr("class", "axis label")
				.attr("transform", "rotate(-90)")
				.attr("y", $scope.scales.xToOffset(0) - 30)
				.attr("x", -$scope.scales.yToOffset($scope.yLimit / 2))
				.text("[ Y ]");

			$scope.utilityGrid = d3.rw.functionGrid($scope.utilityFunction, $scope.scales.indexToX, $scope.scales.indexToY);

			$scope.minUtility = d3.min($scope.utilityGrid, function(col) {
				return d3.min(col);
			});
			$scope.maxUtility = d3.max($scope.utilityGrid, function(col) {
				return d3.max(col);
			});

			var colorRange = ["#0000ff", "#0000ff", "#0000ff", "#00ffff", "#00ff00", "#ffff00", "#ff0000"];
			var colorDomain = d3.rw.stretch([$scope.minUtility, $scope.maxUtility], colorRange.length);
			$scope.scales.colorScale = d3.scale.linear().domain(colorDomain).range(colorRange);

			Display.svgDrawHeatMap();

			$scope.indifferenceCurve = d3.rw.indifferenceCurve()
				.grid($scope.utilityGrid)
				.xScale($scope.scales.xIndexToOffset)
				.yScale($scope.scales.yIndexToOffset);
			$scope.plot.append("g")
				.attr("class", "selection-curve")
				.call($scope.indifferenceCurve);

			$scope.hoverCurve = d3.rw.indifferenceCurve()
				.grid($scope.utilityGrid)
				.xScale($scope.scales.xIndexToOffset)
				.yScale($scope.scales.yIndexToOffset);

			Display.svgDrawAllocation();

			for(var i = 0; i < $scope.config.numCurves; i++) {
				var value = $scope.utilityFunction((i + 1) * $scope.xLimit / ($scope.config.numCurves + 1), (i + 1) * $scope.yLimit / ($scope.config.numCurves + 1));

				var curve = d3.rw.indifferenceCurve()
					.grid($scope.utilityGrid)
					.xScale($scope.scales.xIndexToOffset)
					.yScale($scope.scales.yIndexToOffset)
					.value(value);

				$scope.plot.append("g")
					.attr("class", "reference-curve")
					.call(curve);
			}

			$scope.plot.on("mousemove", function() {
				var position = d3.mouse(this);
				Display.svgDrawHoverData($scope.scales.offsetToX(position[0]), $scope.scales.offsetToY(position[1]));
			});

			$scope.plot.on("mouseleave", function() {
				Display.svgDrawHoverData(false);
			});

			$scope.plot.on("click", function() {
				var position = d3.mouse(this);
				Display.autoFill($scope.scales.offsetToX(position[0]), $scope.scales.offsetToY(position[1]));
			});
		},

		autoFill: function(x, y) {

			$("#bid-qty").val(null);
			$("#bid-price").val(null);
			$("#ask-qty").val(null);
			$("#ask-price").val(null);

			var qty = x - $scope.allocation.x,
				price = (($scope.allocation.y - y) / qty);

			if(qty > 0 && $scope.config.canBid) {
				if(Display.isValidBid(price, qty)) {
					$("#bid-qty").val(qty);
					$("#bid-price").val(price);
				}
			}

			if(qty < 0 && $scope.config.canAsk) {
				if(Display.isValidAsk(price, qty)) {
					$("#ask-qty").val(-qty);
					$("#ask-price").val(price);
				}
			}
		},

		svgDrawHeatMap: function() {
			var heatMap = d3.rw.heatMap()
				.grid($scope.utilityGrid)
				.xScale($scope.scales.xIndexToOffset)
				.yScale($scope.scales.yIndexToOffset)
				.colorScale($scope.scales.colorScale);
			$scope.plot.append("g").call(heatMap);
		},

		svgDrawHoverData: function(x, y) {

			var hoverContainer = $scope.plot.selectAll(".hover-container").data(x === false ? [] : [0]);
			hoverContainer.enter()
				.append("g")
				.attr("class", "hover-container");
			hoverContainer.exit()
				.remove();

			if(x !== false) {
				var xOffset = $scope.scales.xToOffset(x);
				var xPercent = (x - $scope.scales.xToOffset.domain()[0]) / ($scope.scales.xToOffset.domain()[1] - $scope.scales.xToOffset.domain()[0]);
				var yOffset = $scope.scales.yToOffset(y);
				var yPercent = (y - $scope.scales.yToOffset.domain()[0]) / ($scope.scales.yToOffset.domain()[1] - $scope.scales.yToOffset.domain()[0]);

				var utility = $scope.utilityFunction(x, y);

				var hoverText = hoverContainer.selectAll(".hover-text").data([utility]);
				hoverText.enter()
					.append("text")
					.attr("class", "hover-text")
					.style("fill", "grey");
				hoverText
					.attr("x", xOffset + (xPercent > 0.9 ? -50 : 10))
					.attr("y", yOffset - (yPercent > 0.95 ? -15 : 10))
					.text(function(d) { return "[" + d.toFixed(2) + "]"; });

				var hoverPoint = hoverContainer.selectAll(".hover-point").data([{x: xOffset, y: yOffset}]);
				hoverPoint.enter()
					.append("circle")
					.attr("class", "hover-point")
					.attr("r", 5)
					.style("fill", "grey");
				hoverPoint
					.attr("cx", function(d) { return d.x; })
					.attr("cy", function(d) { return d.y; });

				$scope.hoverCurveContainer = hoverContainer.selectAll(".hover-curve").data([0]);
				$scope.hoverCurveContainer.enter()
					.append("g")
					.attr("class", "hover-curve");
				$scope.hoverCurveContainer.call($scope.hoverCurve.value(utility));
			}
		},

		svgDrawAllocation: function() {
			var utility = $scope.utilityFunction($scope.allocation.x, $scope.allocation.y);

			var allocationPoint = $scope.plot.selectAll(".allocation-point").data([$scope.allocation]);
			allocationPoint.enter()
				.append("circle")
				.attr("class", "allocation-point")
				.attr("r", 5)
				.style("fill", "black");
			allocationPoint
				.attr("cx", function(d) { return $scope.scales.xToOffset(d.x); })
				.attr("cy", function(d) { return $scope.scales.yToOffset(d.y); });

			var allocationText = $scope.plot.selectAll(".allocation-text").data([$scope.allocation]);
			allocationText.enter()
				.append("text")
				.attr("class", "allocation-text");
			allocationText
				.attr("x", function(d) { return $scope.scales.xToOffset(d.x) + 10; })
				.attr("y", function(d) { return $scope.scales.yToOffset(d.y) - 10; })
				.text("[" + utility.toFixed(2) + "]");

			$scope.indifferenceCurve.value(utility);

		}
	};

	rs.on_load(function() {

		processConfig();

		$scope.utilityFunction = new Function(["x", "y"], "return " + $scope.config.utility + ";");

		$scope.dotsPerLine = 100;

		Display.initialize();

		$scope.Ex = $scope.config.Ex;
		$scope.Ey = $scope.config.Ey;

		$scope.showDefault = $scope.config.enableDefault && $scope.config.showDefault;

		$scope.rounds = $scope.config.rounds || 1;
		$scope.round = 0;
		rs.trigger("next_round");

	});

	var checkTime = function() {
		if(!$scope.roundStartTime) return;
		var now = (new Date()).getTime() / 1000;
		var timeRemaining = ($scope.roundStartTime + $scope.config.roundDuration) - now;
		if (timeRemaining <= 0) {
			timeRemaining = 0;
			$scope.inputsEnabled = false;
			$scope.roundStartTime = null;
			rs.trigger("next_round");
		} else {
			$scope.timeChecker = setTimeout(checkTime, 1000);
		}

		var minutes = Math.floor(timeRemaining / 60).toString();
		if(minutes.length < 2) {
			minutes = "0" + minutes;
		}
		var seconds = Math.floor(timeRemaining - (minutes * 60)).toString();
		if(seconds.length < 2) {
			seconds = "0" + seconds;
		}
		$scope.time = minutes + ":" + seconds;
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

		rs.after_waiting_for_all(function() {
			$scope.roundStartTime = (new Date()).getTime() / 1000;
			rs.trigger("roundStartTime", $scope.roundStartTime);
			//rs.schedule(checkTime);

			$scope.allocation = {x: $scope.Ex, y: $scope.Ey};

			$scope.xLimit = $scope.config.XLimit;
			$scope.yLimit = $scope.config.YLimit;

			$scope.offers = {};

			Display.svgPrepare();
			Display.updateTradePanels();

			$scope.inputsEnabled = true;
		});
	});

	rs.on("roundStartTime", function(roundStartTime) {
		$scope.roundStartTime = Math.min(roundStartTime, $scope.roundStartTime);
	});
	rs.recv("roundStartTime", function(sedner, roundStartTime) {
		$scope.roundStartTime = Math.min(roundStartTime, $scope.roundStartTime);
	});

	rs.on("allocation", function(allocation) {
		$scope.allocation = allocation;
	});

	rs.on("offer", function(offer) {
		offer = $.extend(offer, {user_id: rs.user_id});
		var key = getOfferKey(offer);
		$scope.offers[key] = $.extend(offer, {key: key});
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

}]);

Redwood.filter("offerType", function() {
	return function(offer) {
		if(angular.isUndefined(offer) || offer === null) {
			return "";
		}
		return (offer.qty > 0 ? "Bid" : "Ask");
	};
});

Redwood.filter("abs", function() {
	return function(value) {
		if(!value) return value;
		return Math.abs(value);
	};
});