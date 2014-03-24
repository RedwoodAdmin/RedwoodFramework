
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
	
	d3.rw.indifferenceCurve = function(grid, threshold) {
		var curve = [];
		
		var xEstimate, yEstimate;
		var prevX = 0, prevY;
		var width = grid.length, height = grid[0].length;
		
		for(var x = 1, maxX = width + 1; x < maxX; x++) {
			
			prevY = 0;
			
			for(var y = 1, maxY = height + 1; y < maxY; y++) {
				
				// Check for x crossing
				if (x < height && (grid[prevX][prevY] > threshold) !== (grid[x][prevY] > threshold)) {
					var xEstimate = prevX + (threshold - grid[prevX][prevY]) / (grid[x][prevY] - grid[prevX][prevY]);
					curve.push([xEstimate, prevY]);
				}
				
				// Check for y crossing
				if(y < height && (grid[prevX][prevY] > threshold) !== (grid[prevX][y] > threshold)) {
					var yEstimate = prevY + (threshold - grid[prevX][prevY]) / (grid[prevX][y] - grid[prevX][prevY]);
					curve.push([prevX, yEstimate]);
				}
				prevY++;
			}
			
			prevX++;
		}
		
		return curve.sort(function(a, b) {
			return a[0] - b[0];
		});
	};

})();

(function() { //Stretch
	
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
