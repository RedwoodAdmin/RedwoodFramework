
	var rs = RedwoodSubject; //create an alias for RedwoodSubject

	var state = {}; //State object
	
	var Display = { //Display controller

		initialize: function() {

            var width = $("#d3-plot").width();
            $("#d3-plot").css("height", width);

			$("#prob-x").text(state.config.ProbX);
			$("#prob-y").text(1 - state.config.ProbX);

			rs.on("next_round", function() {
				$("[name='round']").text(state.round + (state.rounds ? " / " + state.rounds : ""));
				//Display.replot();
			});

			$("#plot").bind("plothover", function (event, pos, item) {
				if(!state.inputsEnabled) return;
				var x = Math.max(0, pos.x);
				x = Math.min(state.maxX, x);
				var y = (state.budget - (x * state.Px)) / state.config.Py;
				state.cursor = [x, y];
				//Display.replot();
			});

			$("#plot").bind("plotclick", function (event, pos, item) {
				if(!state.inputsEnabled) return;
				var x = Math.max(0, pos.x);
				x = Math.min(state.maxX, x);
				var y = (state.budget - (x * state.Px)) / state.config.Py;
				rs.trigger("allocation", {x: x, y: y});
			});

			$("#plot").bind("mouseout", function (event) {
				if(!state.inputsEnabled) return;
				state.cursor = undefined;
				//Display.replot();
			});

			rs.on("allocation", function(point) {
				$("#confirm-button").removeAttr("disabled");
				//Display.generateContourPoints(point[0], point[1]);
				Display.svgDrawAllocation();
				//Display.replot();
			});

			$("#confirm-button").click(function() {
				if(!state.inputsEnabled) return;
				if(!state.allocation) {
					alert("Please select a ratio of x and y by clicking on the graph.");
				} else {
					$("#confirm-button").attr("disabled", "disabled");
					rs.trigger("confirm");
				}
			});

			rs.on("confirm", function() {
				$("confirm-button").attr("disabled", "disabled");
			});
		},
		
		svgPrepare: function() {
			state.svg = d3.select("#d3-plot");
			state.plotWidth = $("#d3-plot").width();
			state.plotHeight = $("#d3-plot").height();
            
            state.scales = {};

            state.scales.indexToX = d3.scale.linear().domain([0, state.dotsPerLine - 1]).range([0, state.xLimit]);
            state.scales.indexToY = d3.scale.linear().domain([0, state.dotsPerLine - 1]).range([0, state.yLimit]);
            state.scales.xToOffset = d3.scale.linear().domain([0, state.xLimit]).range([0, state.plotWidth]).clamp(true);
			state.scales.yToOffset = d3.scale.linear().domain([0, state.yLimit]).range([state.plotHeight, 0]).clamp(true);
            state.scales.xIndexToOffset = function(d) { return state.scales.xToOffset(state.scales.indexToX(d)); };
            state.scales.yIndexToOffset = function(d) { return state.scales.yToOffset(state.scales.indexToY(d)); };

            state.scales.offsetToX = d3.scale.linear().domain([0, state.plotWidth]).range([0, state.xLimit]);
            state.scales.offsetToY = d3.scale.linear().domain([state.plotHeight, 0]).range([0, state.yLimit]);

			state.heatModel = {};
			

			
			state.heatModel.grid = d3.rw.functionGrid(state.utilityFunction, state.scales.indexToX, state.scales.indexToY);
			
			state.minUtility = d3.min(state.heatModel.grid, function(col) {
				return d3.min(col);
			});
			state.maxUtility = d3.max(state.heatModel.grid, function(col) {
				return d3.max(col);
			});
			
			var colorRange = ["#0000ff", "#0000ff", "#0000ff", "#00ffff", "#00ff00", "#ffff00", "#ff0000"];
			var colorDomain = d3.rw.stretch([state.minUtility, state.maxUtility], colorRange.length);
			state.heatModel.colorScale = d3.scale.linear().domain(colorDomain).range(colorRange);
			
			state.heatMap = state.svg.append("g")
				.attr("class", "heatMap");
			
			Display.svgDrawHeatMap();
			
			state.line = d3.svg.line();

            state.indifferenceCurve = d3.rw.indifferenceCurve()
                .grid(state.heatModel.grid)
                .xScale(state.scales.xIndexToOffset)
                .yScale(state.scales.yIndexToOffset)
                .line(state.line);
			state.svg.append("g").call(state.indifferenceCurve);

            for(var i = 0; i < state.config.numCurves; i++) {
                var value = state.utilityFunction((i + 1) * state.xLimit / (state.config.numCurves + 1), (i + 1) * state.yLimit / (state.config.numCurves + 1));

                var curve = d3.rw.indifferenceCurve()
                    .grid(state.heatModel.grid)
                    .xScale(state.scales.xIndexToOffset)
                    .yScale(state.scales.yIndexToOffset)
                    .value(value)
                    .line(state.line);

                state.svg.append("g").call(curve);
            }

            //        (d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px");})

            state.svg.on("mousemove", function() {
                var position = d3.mouse(this);
                Display.svgDrawHoverData(position[0], position[1]);
            });
		},
		
		svgDrawHeatMap: function() {
		
			var width = state.scales.xToOffset(state.scales.indexToX(1));
			var height = state.scales.yToOffset(state.scales.indexToY(state.dotsPerLine - 2));

			var verticalGradients = state.heatMap.selectAll(".verticalGradient")
				.data(state.heatModel.grid)
				.enter()
				.append("linearGradient")
				.attr("class", "verticalGradient")
				.attr("id", function(d, i) {
					return "verticalGradient-" + i;})
				.attr("x1", "100%")
				.attr("y1", "100%")
				.attr("x2", "100%")
				.attr("y2", "0%")
				.attr("spreadMethod", "pad");
			
			verticalGradients.selectAll("stop")
				.data(function(d){return d;})
				.enter()
				.append("stop")
				.attr("offset", function(d, i) {
					return (i * 100 / (state.heatModel.grid.length - 1)) + "%"; })
				.attr("stop-color", function(d, i) {
					return state.heatModel.colorScale(d); })
				.attr("stop-opacity", 1);

			state.heatMap.selectAll(".verticalRect")
				.data(state.heatModel.grid)
				.enter()
				.append("rect")
				.attr("class", "verticalRect")
				.attr("x", function(d,i) { return i*(width); })
				.attr("y", function(d,i) { return 0; })
				.attr("width", width)
				.attr("height", state.plotHeight)
				.attr("stroke", "transparent")
				.attr("fill", function(d, i) { return "url(#verticalGradient-" + i + ")"; });
			
			var horizontalGradients = state.heatMap.selectAll(".horizontalGradient")
				.data(state.heatModel.grid[0])
				.enter()
				.append("linearGradient")
				.attr("class", "horizontalGradient")
				.attr("id", function(d, i) {
					return "horizontalGradient-" + i;})
				.attr("x1", "0%")
				.attr("y1", "0%")
				.attr("x2", "100%")
				.attr("y2", "0%")
				.attr("spreadMethod", "pad");
			
			horizontalGradients.selectAll("stop")
				.data(function(d1, y) {
						var data = [];
						state.heatModel.grid.forEach(function(col, x) {
							data.push(state.heatModel.grid[x][y]);
						});
						return data;
					})
				.enter()
				.append("stop")
				.attr("offset", function(d, i) {
					return (i * 100 / (state.heatModel.grid.length - 1)) + "%"; })
				.attr("stop-color", function(d, i) {
					return state.heatModel.colorScale(d); })
				.attr("stop-opacity", 0.5);

			state.heatMap.selectAll(".horizontalRect")
				.data(state.heatModel.grid)
				.enter()
				.append("g")
				.append("rect")
				.attr("class", "horizontalRect")
				.attr("x", function(d,i) { return 0; })
				.attr("y", function(d,i) { return state.plotHeight - height - i*height; })
				.attr("width", state.plotWidth)
				.attr("height", height)
                .attr("stroke", "transparent")
				.attr("fill", function(d, i) { return "url(#horizontalGradient-" + i + ")"; });
			
		},

        svgDrawHoverData: function(x, y) {
            var utility = state.utilityFunction(state.scales.offsetToX(x), state.scales.offsetToY(y));

            var hoverText = state.svg.selectAll(".hover-text").data([utility]);
            hoverText.enter()
                .append("text")
                .attr("class", "hover-text")
                .style("fill", "grey");
            hoverText
                .attr("x", x + 10)
                .attr("y", y - 10)
                .text(function(d) { return "[" + d.toFixed(2) + "]"; });

            var hoverPoint = state.svg.selectAll(".hover-point").data([{x: x, y: y}]);
            hoverPoint.enter()
                .append("circle")
                .attr("class", "hover-point")
                .attr("r", 5)
                .style("fill", "grey");
            hoverPoint
                .attr("cx", function(d) { return d.x; })
                .attr("cy", function(d) { return d.y; });
        },

        svgDrawAllocation: function() {
            var utility = state.utilityFunction(state.allocation.x, state.allocation.y);

            var allocationPoint = state.svg.selectAll(".allocation-point").data([state.allocation]);
            allocationPoint.enter()
                .append("circle")
                .attr("class", "allocation-point")
                .attr("r", 5)
                .style("fill", "black");
            allocationPoint
                .attr("cx", function(d) { return state.scales.xToOffset(d.x); })
                .attr("cy", function(d) { return state.scales.yToOffset(d.y); });

            var allocationText = state.svg.selectAll(".allocation-text").data([state.allocation]);
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
			
			state.dotsPerLine = 109;

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
			$("#confirm-button").attr("disabled", "disabled");

			if(state.rounds && state.round >= state.rounds) {
				rs.trigger("next_period");
				return;
			} else if(state.round > 0 && state.config.x_over_y_threshold) {
				var prices = rs.subject[rs.user_id].get("prices");
				if(Math.abs(prices.x / prices.y) < state.config.x_over_y_threshold) {
					rs.trigger("next_period");
					return;
				}
			}

			//Begin next round
			state.round++;
			state.cursor = undefined;
			state.allocation = undefined;
			
			var prices = rs.subject[rs.user_id].get("prices");
			state.Px = state.round > 1 ? prices.x : state.config.Px;
			state.Py = state.round > 1 ? prices.y : state.config.Py;

			state.budget = (state.Ex * state.Px) + (state.Ey * state.config.Py);
			state.maxX = state.budget / state.Px;
			state.maxY = state.budget / state.config.Py;
			
			state.xLimit = state.config.XLimit ? state.config.XLimit : state.maxX;
			state.yLimit = state.config.YLimit ? state.config.YLimit : state.maxY;
			
			Display.svgPrepare();
			
			if(state.config.enableDefault) {
				rs.trigger("allocation", {x: state.Ex, y: state.Ey});
			}

			state.inputsEnabled = true;
		});

		rs.on("allocation", function(allocation) {
			state.allocation = allocation;
		});

		rs.on("confirm", function() {
			state.inputsEnabled = false;
			var chosen = Math.random() < state.config.ProbX ? "x" : "y";
			rs.trigger("result", { x: state.allocation.x, y: state.allocation.y, chosen: chosen });

			rs.after_waiting_for_all(function() {
				var excessDemandX = 0;
				var excessDemandY = 0;
				rs.subjects.where(function() {
						return this.groupForPeriod && this.groupForPeriod === rs.subject[rs.user_id].groupForPeriod;
					}).forEach(function(d) {
						var allocation = d.get("allocation");
						excessDemandX += allocation.x - state.Ex;
						excessDemandY += allocation.y - state.Ey;
				});
				var newPriceX = priceUpdateFormula(state.Px, excessDemandX);
				var newPriceY = priceUpdateFormula(state.Py, excessDemandY);
				rs.set("prices", { x: newPriceX, y: newPriceY, deltaX: newPriceX - state.Px, deltaY: newPriceY - state.Py });
				rs.trigger("next_round");
			});
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
				//Display.replot();
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
			state.config.Px = $.isArray(rs.config.Px) ? rs.config.Px[userIndex] : rs.config.Px;
			state.config.Py = $.isArray(rs.config.Py) ? rs.config.Py[userIndex] : rs.config.Py;
			state.config.Z = $.isArray(rs.config.Z) ? rs.config.Z[userIndex] : rs.config.Z;
			state.config.XLimit = $.isArray(rs.config.XLimit) ? rs.config.XLimit[userIndex] : rs.config.XLimit;
			state.config.YLimit = $.isArray(rs.config.YLimit) ? rs.config.YLimit[userIndex] : rs.config.YLimit;
			state.config.XGrid = $.isArray(rs.config.XGrid) ? rs.config.XGrid[userIndex] : rs.config.XGrid;
			state.config.YGrid = $.isArray(rs.config.YGrid) ? rs.config.YGrid[userIndex] : rs.config.YGrid;
			state.config.ProbX = $.isArray(rs.config.ProbX) ? rs.config.ProbX[userIndex] : rs.config.ProbX;
			state.config.enableDefault = $.isArray(rs.config.enableDefault) ? rs.config.enableDefault[userIndex] : rs.config.enableDefault;
			state.config.showDefault = $.isArray(rs.config.showDefault) ? rs.config.showDefault[userIndex] : rs.config.showDefault;
			state.config.plotResult = $.isArray(rs.config.plotResult) ? rs.config.plotResult[userIndex] : rs.config.plotResult;
            state.config.utility = $.isArray(rs.config.utility) ? rs.config.utility[userIndex] : rs.config.utility;
            state.config.numCurves = $.isArray(rs.config.numCurves) ? rs.config.numCurves[userIndex] : rs.config.numCurves;

			state.config.rounds =  rs.config.rounds;
			if(rs.config.x_over_y_threshold) {
				state.config.x_over_y_threshold = rs.config.x_over_y_threshold;
			}

			state.config.referencePeriod = rs.config.referencePeriod;
			state.config.pause = rs.config.pause;
		};

		var priceUpdateFormula = function(currentPrice, excessDemand) {
			return Math.max(currentPrice + excessDemand * (state.config.Z ? state.config.Z : 0), 0.01);
		};

	};