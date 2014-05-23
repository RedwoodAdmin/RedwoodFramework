
Redwood.factory("Helpers", function() {

	// return the last element of the array
	Array.prototype.last = function() {
		return this.length ? this[this.length - 1] : undefined;
	};

	// return the sum of the array
	Array.prototype.sum = function() {
		var total = 0;
		this.forEach(function(value) {
			total += value;
		});
		return total;
	};

	Array.prototype.max = function() {
		return Math.max.apply(null, this)
	};

	Array.prototype.min = function() {
		return Math.min.apply(null, this)
	};

	// return the mean of the array
	Array.prototype.mean = function() {
		return this.length ? this.sum() / this.length : undefined;
	};

	// run a Fischer-Yates shuffle on a collection
	// e.g. [1, 2, 3, 4, 5].shuffle()
	Array.prototype.shuffle = function(rng) {
		var result = angular.copy(this);
		if(rng === undefined) {
			rng = Math;
		}
		var i, j;
		for(i = 1; i < this.length; i++) {
			j = Math.floor(rng.random() * (i + 1));
			if(j !== i) {
				result[i] = this[j];
				result[j] = this[i];
			}
		}
		return result;
	};

	Object.size = function(object) {
		var count = 0;
		angular.forEach(object, function(prop) {
			count++;
		});
		return count;
	};

	angular.isNullOrUndefined = function(val) {
		return angular.isUndefined(val) || val === null;
	};

	return {
		getPoisson: function(lambda) {
			var L = Math.exp(-lambda);
			var p = 1.0;
			var k = 0;

			do {
				k++;
				p *= Math.random();
			} while(p > L);

			return k - 1;
		},

		require: function(script) {
			//this function checks to see if a required script was loaded or not
			return $.ajax({
				url: script,
				dataType: "script",
				async: false,
				error: function() {
					throw new Error("Could not load script " + script);
				}
			});
		},

		tryParse: function(string) {
			var result = string;
			if(string.toLowerCase() === "true") {
				result = true;
			} else if(string.toLowerCase() === "false") {
				result = false;
			} else {
				try {
					var temp = JSON.parse(string);
					result = (angular.isNullOrUndefined(temp) ? result : temp);
				} catch(SyntaxError) {
				}
			}
			return result;
		}
	};

});

Redwood.directive("animateToggleClass", ['$timeout', function($timeout) {
	return {
		link: function($scope, element, attrs) {
			var options = attrs.animateToggleClass;
			var enabled = false;
			var timeout;

			function animate() {
				element.toggleClass(options.class);
				timeout = $timeout(animate, options.delay);
			}

			$scope.$watch(options.enabled.toString(), function(value) {
				if(value && !enabled) {
					element.addClass(options.class);
					timeout = $timeout(animate, options.delay);
				} else if (enabled && !value) {
					$timeout.cancel(timeout);
					element.removeClass(options.class);
				}
				enabled = value;
			});

		}
	};
}]);

Redwood.directive("keyPress", function() {
	return {
		restrict: 'E',
		link: function($scope, element, attrs) {
			if(attrs.keyCode && attrs.callback) {
				$(document).keydown(function(evt) {
					if(evt.keyCode == attrs.keyCode) {
						$scope.$parent.$apply(function() {
							$scope.$parent.$eval(attrs.callback);
						});
					}
				});
			}
		}
	};
});
