
	var rs = RedwoodSubject; //create an alias for RedwoodSubject

	var state = {}; //State object
	
	var Display = { //Display controller

		initialize: function() {

            var width = $("#d3-plot").width();
            $("#d3-plot").css("height", width);
			if(state.config.showHeatmap) {
				$("#d3-plot").show();
			}

			if(state.config.canBid) $("#bidForm").show();
			if(state.config.canAsk) $("#askForm").show();

			$("#prob-x").text(state.config.ProbX);
			$("#prob-y").text(1 - state.config.ProbX);

			rs.on("next_round", function() {
				$("[name='round']").text(state.round + (state.rounds ? " / " + state.rounds : ""));
			});

			$("#accept").click(Display.acceptOffer);

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

			$("#bid-button").click(function() {
				if(!state.inputsEnabled || !state.config.canBid) return;
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
				if(!state.inputsEnabled || !state.config.canAsk) return;
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

		projectOffer: function(event) {
			if(!state.inputsEnabled) return;
			var key = $(this).attr("key");
			var offer = state.offers[key];
			if(offer.user_id === rs.user_id) return;
			if(offer.qty < 0 && !state.config.canBuy) return;
			if(offer.qty > 0 && !state.config.canSell) return;
			var y = state.allocation.y - (offer.price * offer.qty);
			var x = state.allocation.x + offer.qty;
			Display.svgDrawHoverData(x, y);
		},

		openOffer: function(event) {
			if(!state.inputsEnabled) return;
			var key = $(this).attr("key");
			var offer = state.offers[key];
			if(offer.qty < 0 && !state.config.canBuy && offer.user_id !== rs.user_id) return;
			if(offer.qty > 0 && !state.config.canSell && offer.user_id !== rs.user_id) return;
			if(offer.user_id != rs.user_id) {
				Display.populateAcceptModal(key);
				$("#acceptQty").val(Math.abs(offer.qty));
				$("#accept").removeAttr("disabled");
				$("#acceptModal").modal('show');
			}
		},

		populateAcceptModal: function(key) {
			var offer = state.offers[key];
			$("#acceptType").text(offer.qty > 0 ? "Bid" : "Ask");
			$("#acceptPrice").text(Math.abs(offer.price));
			$("#acceptMaxQty").text(Math.abs(offer.qty));
			$("#acceptQty").attr("max", Math.abs(offer.qty));
			$("#accept").attr("key", key);
			$("#acceptQty").val(Math.min(Math.abs(offer.qty), $("#acceptQty").val()));
		},

		acceptOffer: function(event) {
			if(!state.inputsEnabled) return;
			var key = $(this).attr("key");
			var offer = state.offers[key];
			if(offer.qty > 0 && !state.config.canBuy) return;
			if(offer.qty < 0 && !state.config.canSell) return;

			var acceptedQty = parseFloat($("#acceptQty").val());
			if(acceptedQty > 0 && acceptedQty <= Math.abs(offer.qty)) {
				$(this).attr("disabled", "disabled");
				rs.trigger("accept", {user_id: offer.user_id, key: key, qty: Math.abs(offer.qty) / offer.qty * acceptedQty});
				$("#acceptModal").modal('hide');
			} else {
				alert("Please enter a valid quantity to accept for this offer.");
			}
		},

		updateTradePanels: function() {
			var data = Object.keys(state.offers)
				.filter(function(d) {
					return state.offers[d].qty > 0 && !state.offers[d].closed;
				})
				.sort(function(a, b) {
					return state.offers[a].price - state.offers[b].price;
				});

			d3.select("#bids-container").selectAll(".offer").remove();
			var bids = d3.select("#bids-container").selectAll(".offer").data(data);
			bids.enter().append("div")
				.attr("class", "offer input-group input-group-sm")
				.attr("key", function(d) { return d; })
				.on("click", Display.projectOffer)
				.on("dblclick", Display.openOffer);

			bids.append("span")
				.attr("class", "input-group-addon no-input")
				.text(function(d) { return state.offers[d].price })
				.filter(function(d) { return state.offers[d].user_id == rs.user_id })
				.classed("alert-danger", true);

			bids.append("span")
				.attr("class", "input-group-addon no-input")
				.text(function(d) { return state.offers[d].qty })
				.filter(function(d) { return state.offers[d].user_id == rs.user_id })
				.classed("alert-danger", true);

			data = Object.keys(state.offers)
				.filter(function(d) {
					return state.offers[d].qty < 0 && !state.offers[d].closed;
				})
				.sort(function(a, b) {
					return state.offers[a].price - state.offers[b].price;
				});

			d3.select("#asks-container").selectAll(".offer").remove();
			var asks = d3.select("#asks-container").selectAll(".offer").data(data);
			asks.enter().append("div")
				.attr("class", "offer input-group input-group-sm")
				.attr("key", function(d) { return d; })
				.on("click", Display.projectOffer)
				.on("dblclick", Display.openOffer);

			asks.append("span")
				.attr("class", "input-group-addon no-input")
				.text(function(d) { return state.offers[d].price })
				.filter(function(d) { return state.offers[d].user_id == rs.user_id })
				.classed("alert-danger", true);

			asks.append("span")
				.attr("class", "input-group-addon no-input")
				.text(function(d) { return -state.offers[d].qty })
				.filter(function(d) { return state.offers[d].user_id == rs.user_id })
				.classed("alert-danger", true);

			data = rs.data.trade || [];
			d3.select("#trades-container").selectAll(".trade").remove();
			var trades = d3.select("#trades-container").selectAll(".trade").data(data);
			trades.enter().append("div")
				.attr("class", "trade input-group input-group-sm");

			trades.append("span")
				.attr("class", "input-group-addon no-input")
				.text(function(d) { return state.offers[d.key].price })
				.filter(function(d) { return state.offers[d.key].user_id == rs.user_id })
				.classed("alert-danger", true);

			trades.append("span")
				.attr("class", "input-group-addon no-input")
				.text(function(d) { return d.qty })
				.filter(function(d) { return state.offers[d.key].user_id == rs.user_id })
				.classed("alert-danger", true);

			$("#x-allocation").text(state.allocation.x.toFixed(2));
			$("#y-allocation").text(state.allocation.y.toFixed(2));

			data = Object.keys(state.offers)
				.filter(function(d) {
					return d === $("#accept").attr("key");
				});
			if(data.length > 0) {
				Display.populateAcceptModal(data[0]);
			}
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
			var plotMargin = { top: 10, right: 10, bottom: 30, left: 40 };

			state.svg = d3.select("#d3-plot");

			state.plotWidth = $("#d3-plot").width() - plotMargin.left - plotMargin.right;
			state.plotHeight = $("#d3-plot").height() - plotMargin.bottom - plotMargin.top;

			state.plot = state.svg.append("g")
				.attr("transform", "translate(" + plotMargin.left + "," + plotMargin.top + ")");

			state.scales = {};

            state.scales.indexToX = d3.scale.linear().domain([0, state.dotsPerLine - 1]).range([0, state.xLimit]);
            state.scales.indexToY = d3.scale.linear().domain([0, state.dotsPerLine - 1]).range([0, state.yLimit]);
            state.scales.xToOffset = d3.scale.linear().domain([0, state.xLimit]).range([0, state.plotWidth]).clamp(true);
			state.scales.yToOffset = d3.scale.linear().domain([0, state.yLimit]).range([state.plotHeight, 0]).clamp(true);
            state.scales.xIndexToOffset = function(d) { return state.scales.xToOffset(state.scales.indexToX(d)); };
            state.scales.yIndexToOffset = function(d) { return state.scales.yToOffset(state.scales.indexToY(d)); };

            state.scales.offsetToX = d3.scale.linear().domain([0, state.plotWidth]).range([0, state.xLimit]).clamp(true);
            state.scales.offsetToY = d3.scale.linear().domain([state.plotHeight, 0]).range([0, state.yLimit]).clamp(true);

			state.xAxis = d3.svg.axis()
				.scale(state.scales.xToOffset)
				.outerTickSize(5);
			state.plot.append("g")
				.attr("transform", "translate(0," + (state.plotHeight) + ")")
				.attr("class", "axis")
				.call(state.xAxis);

			state.yAxis = d3.svg.axis()
				.scale(state.scales.yToOffset)
				.orient("left")
				.outerTickSize(5);
			state.plot.append("g")
				.attr("class", "axis")
				.call(state.yAxis);

			state.utilityGrid = d3.rw.functionGrid(state.utilityFunction, state.scales.indexToX, state.scales.indexToY);
			
			state.minUtility = d3.min(state.utilityGrid, function(col) {
				return d3.min(col);
			});
			state.maxUtility = d3.max(state.utilityGrid, function(col) {
				return d3.max(col);
			});
			
			var colorRange = ["#0000ff", "#0000ff", "#0000ff", "#00ffff", "#00ff00", "#ffff00", "#ff0000"];
			var colorDomain = d3.rw.stretch([state.minUtility, state.maxUtility], colorRange.length);
			state.scales.colorScale = d3.scale.linear().domain(colorDomain).range(colorRange);

			Display.svgDrawHeatMap();
			
			state.indifferenceCurve = d3.rw.indifferenceCurve()
                .grid(state.utilityGrid)
                .xScale(state.scales.xIndexToOffset)
                .yScale(state.scales.yIndexToOffset);
            state.plot.append("g")
				.attr("class", "selection-curve")
				.call(state.indifferenceCurve);

			state.hoverCurve = d3.rw.indifferenceCurve()
				.grid(state.utilityGrid)
				.xScale(state.scales.xIndexToOffset)
				.yScale(state.scales.yIndexToOffset);

			Display.svgDrawAllocation();

            for(var i = 0; i < state.config.numCurves; i++) {
                var value = state.utilityFunction((i + 1) * state.xLimit / (state.config.numCurves + 1), (i + 1) * state.yLimit / (state.config.numCurves + 1));

                var curve = d3.rw.indifferenceCurve()
                    .grid(state.utilityGrid)
                    .xScale(state.scales.xIndexToOffset)
                    .yScale(state.scales.yIndexToOffset)
                    .value(value);

                state.plot.append("g")
					.attr("class", "reference-curve")
					.call(curve);
            }

            state.plot.on("mousemove", function() {
                var position = d3.mouse(this);
                Display.svgDrawHoverData(state.scales.offsetToX(position[0]), state.scales.offsetToY(position[1]));
            });
		},
		
		svgDrawHeatMap: function() {
		    var heatMap = d3.rw.heatMap()
                .grid(state.utilityGrid)
                .xScale(state.scales.xIndexToOffset)
                .yScale(state.scales.yIndexToOffset)
                .colorScale(state.scales.colorScale);
			state.plot.append("g").call(heatMap);
		},

        svgDrawHoverData: function(x, y) {
			var xOffset = state.scales.xToOffset(x);
			var xPercent = (x - state.scales.xToOffset.domain()[0]) / (state.scales.xToOffset.domain()[1] - state.scales.xToOffset.domain()[0]);
			var yOffset = state.scales.yToOffset(y);
			var yPercent = (y - state.scales.yToOffset.domain()[0]) / (state.scales.yToOffset.domain()[1] - state.scales.yToOffset.domain()[0]);

			var utility = state.utilityFunction(x, y);

			var hoverText = state.plot.selectAll(".hover-text").data([utility]);
            hoverText.enter()
                .append("text")
                .attr("class", "hover-text")
                .style("fill", "grey");
            hoverText
                .attr("x", xOffset + (xPercent > 0.9 ? -50 : 10))
                .attr("y", yOffset - (yPercent > 0.95 ? -15 : 10))
                .text(function(d) { return "[" + d.toFixed(2) + "]"; });

            var hoverPoint = state.plot.selectAll(".hover-point").data([{x: xOffset, y: yOffset}]);
            hoverPoint.enter()
                .append("circle")
                .attr("class", "hover-point")
                .attr("r", 5)
                .style("fill", "grey");
            hoverPoint
                .attr("cx", function(d) { return d.x; })
                .attr("cy", function(d) { return d.y; });

			state.hoverCurveContainer = state.plot.selectAll(".hover-curve").data([0]);
			state.hoverCurveContainer.enter()
				.append("g")
				.attr("class", "hover-curve");
			state.hoverCurveContainer.call(state.hoverCurve.value(utility));
        },

        svgDrawAllocation: function() {
            var utility = state.utilityFunction(state.allocation.x, state.allocation.y);

            var allocationPoint = state.plot.selectAll(".allocation-point").data([state.allocation]);
            allocationPoint.enter()
                .append("circle")
                .attr("class", "allocation-point")
                .attr("r", 5)
                .style("fill", "black");
            allocationPoint
                .attr("cx", function(d) { return state.scales.xToOffset(d.x); })
                .attr("cy", function(d) { return state.scales.yToOffset(d.y); });

            var allocationText = state.plot.selectAll(".allocation-text").data([state.allocation]);
            allocationText.enter()
                .append("text")
                .attr("class", "allocation-text");
            allocationText
                .attr("x", function(d) { return state.scales.xToOffset(d.x) + 10; })
                .attr("y", function(d) { return state.scales.yToOffset(d.y) - 10; })
                .text("[" + utility.toFixed(2) + "]");

            state.indifferenceCurve.value(utility);

        }
	};

	rs.create = function() {

		rs.on_load(function() {

			processConfig();

            state.utilityFunction = new Function(["x", "y"], "return " + state.config.utility + ";");
			
			state.dotsPerLine = 100;

			Display.initialize();

			if(state.config.referencePeriod) {
				var referenceResult = rs.subject[rs.user_id].data.results.firstWhere(function() {
					return this.period === state.config.referencePeriod;
				});
				state.Ex = referenceResult.x;
				state.Ey = referenceResult.y;

			} else {
				state.Ex = state.config.Ex;
				state.Ey = state.config.Ey;
			}
			
			state.showDefault = state.config.enableDefault && state.config.showDefault;

			state.rounds = state.config.rounds || 1;
			state.round = 0;
			rs.trigger("next_round");

		});

		rs.on("next_round", function() {

			state.inputsEnabled = false;

			if(state.rounds && state.round >= state.rounds) {
				rs.trigger("next_period");
				return;
			}

			//Begin next round
			state.round++;
			state.cursor = undefined;
			state.allocation = {x: state.Ex, y: state.Ey};
			
			state.xLimit = state.config.XLimit;
			state.yLimit = state.config.YLimit;

			state.offers = {};
			
			Display.svgPrepare();
			
			state.inputsEnabled = true;
		});

		rs.on("allocation", function(allocation) {
			state.allocation = allocation;
		});

		rs.on("offer", function(offer) {
			offer = $.extend(offer, {user_id: rs.user_id});
			var key = getOfferKey(offer);
			state.offers[key] = offer;
		});

		rs.recv("offer", function(user_id, offer) {
			offer = $.extend(offer, {user_id: user_id});
			var key = getOfferKey(offer);
			state.offers[key] = offer;
		});

		rs.on("accept", function(accepted) {
			if(Math.abs(state.offers[accepted.key].qty) >= Math.abs(accepted.qty)) {
				state.allocation.y -= state.offers[accepted.key].price * accepted.qty;
				state.allocation.x += accepted.qty;
				state.offers[accepted.key].qty -= accepted.qty;
				if(state.offers[accepted.key].qty == 0) {
					state.offers[accepted.key].closed = true;
				}
				rs.trigger("trade", accepted);
			} else {
				alert("Transaction failed.");
			}
		});

		rs.recv("accept", function(sender, accepted) {
			if(Math.abs(state.offers[accepted.key].qty) >= Math.abs(accepted.qty)) {
				if(accepted.user_id == rs.user_id) {
					state.allocation.y += state.offers[accepted.key].price * state.offers[accepted.key].qty;
					state.allocation.x -= state.offers[accepted.key].qty;
				}
				state.offers[accepted.key].qty -= accepted.qty;
				if(state.offers[accepted.key].qty == 0) {
					state.offers[accepted.key].closed = true;
				}
			}
		});

		rs.on("result", function(value) {
			if(!state.results) {
				state.results = [];
			}
			state.results.push(value);
		});

		rs.on("next_period", function() {
			var finalResult = state.results[state.results.length - 1];
			finalResult.period = rs.period;
			rs.set("results", finalResult);
			if(state.config.plotResult) {
				state.finalResult = finalResult;
				rs.next_period(5);
			} else {
				rs.next_period();
			}
		});

		var processConfig = function() {
			var userIndex = parseInt(rs.user_id) - 1;
			state.config = {};

			state.config.Ex = $.isArray(rs.config.Ex) ? rs.config.Ex[userIndex] : rs.config.Ex;
			state.config.Ey = $.isArray(rs.config.Ey) ? rs.config.Ey[userIndex] : rs.config.Ey;
			state.config.utility = $.isArray(rs.config.utility) ? rs.config.utility[userIndex] : rs.config.utility;
			state.config.canBid = $.isArray(rs.config.canBid) ? rs.config.canBid[userIndex] : rs.config.canBid;
			state.config.canAsk = $.isArray(rs.config.canAsk) ? rs.config.canAsk[userIndex] : rs.config.canAsk;
			state.config.canBuy = $.isArray(rs.config.canBuy) ? rs.config.canBuy[userIndex] : rs.config.canBuy;
			state.config.canSell = $.isArray(rs.config.canSell) ? rs.config.canSell[userIndex] : rs.config.canSell;

			state.config.XLimit = $.isArray(rs.config.XLimit) ? rs.config.XLimit[userIndex] : rs.config.XLimit;
			state.config.YLimit = $.isArray(rs.config.YLimit) ? rs.config.YLimit[userIndex] : rs.config.YLimit;
			state.config.ProbX = $.isArray(rs.config.ProbX) ? rs.config.ProbX[userIndex] : rs.config.ProbX;
			state.config.showHeatmap = $.isArray(rs.config.showHeatmap) ? rs.config.showHeatmap[userIndex] : rs.config.showHeatmap;
            state.config.numCurves = $.isArray(rs.config.numCurves) ? rs.config.numCurves[userIndex] : rs.config.numCurves;

			state.config.rounds =  rs.config.rounds;

			state.config.referencePeriod = rs.config.referencePeriod;
			state.config.pause = rs.config.pause;
		};

		function getOfferKey(offer) {
			return offer.user_id + "-" + offer.index;
		}

	};