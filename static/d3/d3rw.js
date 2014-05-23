
d3.rw = d3.rw || {};

(function() { //Utility Grid
	
	d3.rw.functionGrid = function(utilityFunction, xScale, yScale) {
		var grid = [];
		for(var xIndex = 0; xIndex <= xScale.domain()[1]; xIndex++) {
			grid.push([]);
			for(var yIndex = 0; yIndex <= yScale.domain()[1]; yIndex++) {
				grid[xIndex].push(utilityFunction(xScale(xIndex), yScale(yIndex)));
			}
		}
		return grid;
	};

})();

(function() { //Indifference Curve
	
	d3.rw.indifferenceCurve = function() {

        var grid,
            xScale,
            yScale,
            value,
            line = d3.svg.line(),
            container;

        function draw() {
            var path = [];

            var xEstimate, yEstimate;
            var prevX = 0, prevY;
            var width = grid.length, height = grid[0].length;

            for(var x = 1, maxX = width + 1; x < maxX; x++) {

                prevY = 0;

                for(var y = 1, maxY = height + 1; y < maxY; y++) {

                    // Check for x crossing
                    if (x < height && (grid[prevX][prevY] > value) !== (grid[x][prevY] > value)) {
                        var xEstimate = prevX + (value - grid[prevX][prevY]) / (grid[x][prevY] - grid[prevX][prevY]);
                        path.push([xScale(xEstimate), yScale(prevY)]);
                    }

                    // Check for y crossing
                    if(y < height && (grid[prevX][prevY] > value) !== (grid[prevX][y] > value)) {
                        var yEstimate = prevY + (value - grid[prevX][prevY]) / (grid[prevX][y] - grid[prevX][prevY]);
                        path.push([xScale(prevX), yScale(yEstimate)]);
                    }
                    prevY++;
                }

                prevX++;
            }

			path = path.sort(function(a, b) {
                return a[0] - b[0];
            });

            var curve = container.selectAll(".indifference-curve").data(path.length ? [path] : []);
            curve.enter()
				.append("path")
                .attr("class", "indifference-curve")
				.style("fill", "none");
            curve.attr("d", line)
			curve.exit().remove();
        }

        function indifferenceCurve(g) {

            container = g;

            if(value !== undefined) {
                draw();
            }

        }

        indifferenceCurve.grid = function(_) {
            if (!arguments.length) return grid;
            grid = _;
            return indifferenceCurve;
        };

        indifferenceCurve.xScale = function(_) {
            if (!arguments.length) return xScale;
            xScale = _;
            return indifferenceCurve;
        };

        indifferenceCurve.yScale = function(_) {
            if (!arguments.length) return yScale;
            yScale = _;
            return indifferenceCurve;
        };

        indifferenceCurve.value = function(_) {
            if (!arguments.length) return value;
            value = _;

            if(container !== undefined) {
                draw();
            }

            return indifferenceCurve;
        };

        return indifferenceCurve;
    };

})();

(function() {

    d3.rw.heatMap = function() {

        var grid,
            xScale,
            yScale,
            colorScale;

        function heatMap(g) {

            var data = [],
                sum,
				dx = (xScale(1) - xScale(0)) > 0 ? 0 : 1,
				dy = (yScale(1) - yScale(0)) > 0 ? 0 : 1;

            for(var x = 0; x < grid.length - 1; x++) {
                for(var y = 0; y < grid.length - 1; y++) {
                    sum = grid[x][y] + grid[x + 1][y] + grid[x + 1][y + 1] + grid[x][y + 1];
                    data.push({x: xScale(x + dx), y: yScale(y + dy), color: colorScale(sum / 4)});
                }
            }

			var width = Math.abs(xScale(1) - xScale(0)),
				height = Math.abs(yScale(1) - yScale(0));

            var rectangles = g.selectAll(".heatmap-rect").data(data);

            rectangles.enter()
                .append("rect")
                .attr("class", "heatmap-rect");

            rectangles
                .attr("x", function(d) { return d.x; })
                .attr("y", function(d) { return d.y; })
                .attr("width", width)
                .attr("height", height)
                .style("stroke", function(d) { return d.color; })
                .style("fill", function(d) { return d.color; });

            rectangles.exit().remove();
        }

        heatMap.grid = function(_) {
            if (!arguments.length) return grid;
            grid = _;
            return heatMap;
        };

        heatMap.xScale = function(_) {
            if (!arguments.length) return xScale;
            xScale = _;
            return heatMap;
        };

        heatMap.yScale = function(_) {
            if (!arguments.length) return yScale;
            yScale = _;
            return heatMap;
        };

        heatMap.colorScale = function(_) {
            if (!arguments.length) return colorScale;
            colorScale = _;
            return heatMap;
        };

        return heatMap;

    };

})();

/**
 * Up-samples or down-samples a given input array. It can be thought of as follows:
 * The values in the input array are connected with straight lines to form a continuous curve.
 * The value of this curve is then measured at c equally spaced intervals.
 * @param {Array<Any type that can be interpolated by d3>} input. The input array.
 * @param {Number} c. The number of samples to return.
 * @return {Array<typeof input>} An array of length c
 */
(function() {
	
	d3.rw.stretch = function(input, c) {
		if(input.length < 2) {
			throw("Cannot stretch fewer than 2 points");
		}
		
		c = c || (input.length + 1);
		
		if(c < 1) {
			throw("Cannot stretch to less than 1 point");
		}
		
		var inputIndex = d3.scale.linear().domain([0, c - 1]).range([0, input.length - 1]);
		
		var result = [];
		
		var i, a, interpolator;
		for(var o = 0; o < c - 1; o++) {
			i = inputIndex(o);
			a = Math.floor(i);
			interpolator = d3.interpolate(input[a], input[a + 1]);
			result.push(interpolator(i - a));
		}
		
		result.push(input[input.length - 1]);
		
		return result;
	};

})();
