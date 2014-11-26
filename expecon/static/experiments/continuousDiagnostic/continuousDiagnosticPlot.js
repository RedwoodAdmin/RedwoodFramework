Redwood.directive('plot', ["$rootScope", "RedwoodSubject", function($rootScope, rs) {

	return {
		restrict: 'E',
		scope: false,
		template: '<div></div>',
		replace: true,
		link: function($scope, element, attrs) {

			$scope.$on('replot', function () {

				var xrange = 1;
				var lastSubPeriod = $scope.t - ($scope.t % $scope.ticksPerSubPeriod);

				var opts = {
					xaxis: { color: "white", ticks: 1, tickLength: 0, min: 0, max: xrange, axisLabel: "Time", axisLabelUseCanvas: true},
					yaxis: { tickLength: 0, min: 0, max: rs.config.ymax },
					yaxes: [
						{},
						{position: "right", color: "white", ticks: 1, tickFormatter: function(val, axis) {
							return val * 10000
						}}
					],
					series: { shadowSize: 0 }
				};

				var dataset = [];
				for(var p = 0; p < $scope.subPeriods.length; p++) { //mark each sub-period with a vertical red line
					dataset.push({
						data: [
							[$scope.subPeriods[p], opts.yaxis.min],
							[$scope.subPeriods[p], opts.yaxis.max]
						],
						lines: { lineWidth: 0.1 },
						color: "gray"
					});
				}


				dataset.push({ //plot first mover's future payoffs
					data: $scope.first,
					lines: { lineWidth: 1 },
					color: "green"
				});

				dataset.push({ //plot second mover's future payoffs
					data: $scope.second,
					lines: { lineWidth: 1 },
					color: "red",
					yaxis: 2
				});

				//Check for Entry
				if(angular.isDefined($scope.myEntry) || angular.isDefined($scope.otherEntry)) { // At least one person has entered

					if(angular.isDefined($scope.myEntry) && angular.isDefined($scope.otherEntry)) { //Both have entered

						dataset.push({ //plot symmetric payoffs
							data: $scope.symmetric,
							lines: { lineWidth: 0.5 },
							color: "black"
						});

						dataset.push({ //display the time of first entry
							data: [
								[(Math.min($scope.myEntry, $scope.otherEntry) + $scope.ticksPerSubPeriod) / $scope.tMax, opts.yaxis.min],
								[(Math.min($scope.myEntry, $scope.otherEntry) + $scope.ticksPerSubPeriod) / $scope.tMax, opts.yaxis.max]
							],
							color: "green",
							dashes: {show: true, lineWidth: 1.5}
						});

						dataset.push({ //display the time of second entry
							data: [
								[(Math.max($scope.myEntry, $scope.otherEntry) + $scope.ticksPerSubPeriod) / $scope.tMax, opts.yaxis.min],
								[(Math.max($scope.myEntry, $scope.otherEntry) + $scope.ticksPerSubPeriod) / $scope.tMax, opts.yaxis.max]
							],
							color: "red",
							dashes: {show: true, lineWidth: 1.5}
						});


						if($scope.myEntry === $scope.otherEntry) { // Simultaneous entry
							dataset.push({ //plot second mover's future payoffs
								data: $scope.second,
								lines: { lineWidth: 1 },
								color: "black"
							});

							dataset.push({ //plot symmetric payoffs
								data: [
									[$scope.t / $scope.tMax, $scope.earn($scope.myEntry / $scope.tMax, $scope.myEntry / $scope.tMax)]
								],
								color: "black",
								points: {show: true, fillColor: false}
							});

						} else { // Non-simultaneous entry

							dataset.push({ //green player earnings
								data: [
									[$scope.t / $scope.tMax, $scope.earn(Math.min($scope.myEntry / $scope.tMax, $scope.otherEntry / $scope.tMax), Math.max($scope.myEntry / $scope.tMax, $scope.otherEntry / $scope.tMax))]
								],
								points: { show: true, fillColor: false},
								color: "green"
							});

							dataset.push({ //red player earnings
								data: [
									[$scope.t / $scope.tMax, $scope.earn(Math.max($scope.myEntry / $scope.tMax, $scope.otherEntry / $scope.tMax), Math.min($scope.myEntry / $scope.tMax, $scope.otherEntry / $scope.tMax))]
								],
								points: { show: true, fillColor: false },
								color: "red"
							});

						}

					} else { // Only one player has entered

						var entry = angular.isDefined($scope.myEntry) ? $scope.myEntry : $scope.otherEntry;

						if(angular.isDefined($scope.myEntry) || (angular.isDefined($scope.otherEntry) && $scope.t > $scope.otherEntry + $scope.ticksPerSubPeriod)) { //Entry is revealed

							dataset.push({ //display the time of first entry
								data: [
									[(entry + $scope.ticksPerSubPeriod) / $scope.tMax, opts.yaxis.min],
									[(entry + $scope.ticksPerSubPeriod) / $scope.tMax, opts.yaxis.max]
								],
								color: "green",
								dashes: {show: true, lineWidth: 1.5}
							});

							dataset.push({ //display the current time indicator as a vertical line
								data: [
									[$scope.t / $scope.tMax, opts.yaxis.min],
									[$scope.t / $scope.tMax, opts.yaxis.max]
								],
								color: "red",
								dashes: {show: true, lineWidth: 1}
							});

							dataset.push({ //green player earnings
								data: [
									[$scope.t / $scope.tMax, $scope.earn(entry / $scope.tMax, lastSubPeriod / $scope.tMax)]
								],
								points: {show: true, fillColor: false},
								color: "green"
							});

							dataset.push({ //red player earnings
								data: [
									[$scope.t / $scope.tMax, $scope.earn(lastSubPeriod / $scope.tMax, entry / $scope.tMax)]
								],
								points: { show: true, fillColor: false },
								color: "red"
							});

							dataset.push({ //plot symmetric payoffs
								data: $scope.symmetric,
								lines: { lineWidth: 0.5 },
								color: "black"
							});


						} else { //Entry is not yet revealed

							dataset.push({ //display the current time indicator as a vertical line
								data: [
									[$scope.t / $scope.tMax, opts.yaxis.min],
									[$scope.t / $scope.tMax, opts.yaxis.max]
								],
								color: "green",
								dashes: {show: true, lineWidth: 0.5}
							});

							dataset.push({ //green player earnings
								data: [
									[$scope.t / $scope.tMax, $scope.earn(entry / $scope.tMax, lastSubPeriod / $scope.tMax)]
								],
								points: { show: true, fillColor: false},
								color: "black"
							});

							dataset.push({ //plot symmetric payoffs
								data: $scope.symmetric,
								lines: { lineWidth: 1 },
								color: "black"
							});

						}

					}

				} else { // Nobody has entered

					dataset.push({
						data: [
							[$scope.t / $scope.tMax, opts.yaxis.min],
							[$scope.t / $scope.tMax, opts.yaxis.max]
						],
						color: "green",
						dashes: {show: true, lineWidth: 0.5}
					});

					dataset.push({ //plot symmetric payoffs
						data: $scope.symmetric,
						lines: { lineWidth: 1 },
						color: "black"
					});

					dataset.push({ //plot symmetric payoffs
						data: [
							[$scope.t / $scope.tMax, $scope.earn(lastSubPeriod / $scope.tMax, lastSubPeriod / $scope.tMax)]
						],
						points: { show: true, fillColor: false},
						color: "black"
					});

				}

				// Text in plot
				function draw_text(plot, ctx) { //Text Display

					if(angular.isDefined($scope.myEntry) || angular.isDefined($scope.otherEntry)) { // At least one person has entered

						if(angular.isDefined($scope.myEntry) && angular.isDefined($scope.otherEntry)) { //Both have entered

							if($scope.myEntry === $scope.otherEntry) { // Simultaneous entry

								ctx.fillStyle = "black";
								var o = plot.pointOffset({
									x: $scope.t / $scope.tMax,
									y: $scope.earn($scope.myEntry / $scope.tMax, $scope.otherEntry / $scope.tMax)
								});
								var s = "Me";
								var m = ctx.measureText(s);
								ctx.fillText(s, o.left - 0.5 * m.width, o.top - 5);

								ctx.fillStyle = "black";
								var o = plot.pointOffset({
									x: $scope.t / $scope.tMax,
									y: $scope.earn($scope.myEntry / $scope.tMax, $scope.otherEntry / $scope.tMax)
								});
								var s = "Other";
								var m = ctx.measureText(s);
								ctx.fillText(s, o.left - 0.5 * m.width, o.top + 12);

								ctx.fillStyle = "black";
								var o = plot.pointOffset({
									x: ($scope.myEntry + $scope.ticksPerSubPeriod) / $scope.tMax,
									y: opts.yaxis.min
								});
								var s = "Joint";
								var m = ctx.measureText(s);
								ctx.fillText(s, o.left - 0.5 * m.width, o.top + 14);
								var s = "Entry Time";
								var m = ctx.measureText(s);
								ctx.fillText(s, o.left - 0.5 * m.width, o.top + 26);

								ctx.fillStyle = "black";
								var o = plot.pointOffset({
									x: opts.xaxis.max,
									y: $scope.earn($scope.myEntry / $scope.tMax, $scope.otherEntry / $scope.tMax)
								});
								var s = Math.floor($scope.earn($scope.myEntry / $scope.tMax, $scope.otherEntry / $scope.tMax) * 100) / 100;
								var m = ctx.measureText(s);
								ctx.fillText(s, o.left + 5, o.top);

							} else { // Non-simultaneous entry

								if($scope.myEntry < $scope.otherEntry) {

									ctx.fillStyle = "green";
									var o = plot.pointOffset({
										x: $scope.t / $scope.tMax,
										y: $scope.earn($scope.myEntry / $scope.tMax, $scope.otherEntry / $scope.tMax)
									});
									var s = "Me";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top - 5);

									ctx.fillStyle = "red";
									var o = plot.pointOffset({
										x: $scope.t / $scope.tMax,
										y: $scope.earn($scope.otherEntry / $scope.tMax, $scope.myEntry / $scope.tMax)
									});
									var s = "Other";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top + 12);

									ctx.fillStyle = "red";
									var o = plot.pointOffset({
										x: ($scope.otherEntry + $scope.ticksPerSubPeriod) / $scope.tMax,
										y: opts.yaxis.min
									});
									var s = "Other's";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top + 14);
									var s = "Entry Time";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top + 26);

									ctx.fillStyle = "green";
									var o = plot.pointOffset({
										x: ($scope.myEntry + $scope.ticksPerSubPeriod) / $scope.tMax,
										y: opts.yaxis.min
									});
									var s = "My";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top + 14);
									var s = "Entry Time";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top + 26);


									ctx.fillStyle = "green";
									var o = plot.pointOffset({
										x: opts.xaxis.max,
										y: $scope.earn($scope.myEntry / $scope.tMax, $scope.otherEntry / $scope.tMax)
									});
									var s = Math.floor($scope.earn($scope.myEntry / $scope.tMax, $scope.otherEntry / $scope.tMax) * 100) / 100;
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left + 5, o.top);

									ctx.fillStyle = "red";
									var o = plot.pointOffset({
										x: opts.xaxis.max,
										y: $scope.earn($scope.otherEntry / $scope.tMax, $scope.myEntry / $scope.tMax)
									});
									var s = Math.floor($scope.earn($scope.otherEntry / $scope.tMax, $scope.myEntry / $scope.tMax) * 100) / 100;
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left + 5, o.top);

								} else {

									ctx.fillStyle = "red";
									var o = plot.pointOffset({
										x: $scope.t / $scope.tMax,
										y: $scope.earn($scope.myEntry / $scope.tMax, $scope.otherEntry / $scope.tMax)
									});
									var s = "Me";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top + 12);

									ctx.fillStyle = "green";
									var o = plot.pointOffset({
										x: $scope.t / $scope.tMax,
										y: $scope.earn($scope.otherEntry / $scope.tMax, $scope.myEntry / $scope.tMax)
									});
									var s = "Other";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top - 5);


									ctx.fillStyle = "green";
									var o = plot.pointOffset({
										x: ($scope.otherEntry + $scope.ticksPerSubPeriod) / $scope.tMax,
										y: opts.yaxis.min
									});
									var s = "Other's";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top + 14);
									var s = "Entry Time";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top + 26);

									ctx.fillStyle = "red";
									var o = plot.pointOffset({
										x: ($scope.myEntry + $scope.ticksPerSubPeriod) / $scope.tMax,
										y: opts.yaxis.min
									});
									var s = "My";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top + 14);
									var s = "Entry Time";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top + 26);

									ctx.fillStyle = "red";
									var o = plot.pointOffset({
										x: opts.xaxis.max,
										y: $scope.earn($scope.myEntry / $scope.tMax, $scope.otherEntry / $scope.tMax)
									});
									var s = Math.floor($scope.earn($scope.myEntry / $scope.tMax, $scope.otherEntry / $scope.tMax) * 100) / 100;
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left + 5, o.top);

									ctx.fillStyle = "green";
									var o = plot.pointOffset({
										x: opts.xaxis.max,
										y: $scope.earn($scope.otherEntry / $scope.tMax, $scope.myEntry / $scope.tMax)
									});
									var s = Math.floor($scope.earn($scope.otherEntry / $scope.tMax, $scope.myEntry / $scope.tMax) * 100) / 100;
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left + 5, o.top);

								}

							}

						} else { // Only one player has entered

							var entry = angular.isDefined($scope.myEntry) ? $scope.myEntry : $scope.otherEntry;

							if(angular.isDefined($scope.myEntry) || (angular.isDefined($scope.otherEntry) && $scope.t > $scope.otherEntry + $scope.ticksPerSubPeriod)) { //Entry is revealed

								if(angular.isDefined($scope.myEntry)) {

									ctx.fillStyle = "green";
									var o = plot.pointOffset({
										x: $scope.t / $scope.tMax,
										y: $scope.earn($scope.myEntry / $scope.tMax, lastSubPeriod / $scope.tMax)
									});
									var s = "Me";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top - 5);

									ctx.fillStyle = "red";
									var o = plot.pointOffset({
										x: $scope.t / $scope.tMax,
										y: $scope.earn(lastSubPeriod / $scope.tMax, $scope.myEntry / $scope.tMax)
									});
									var s = "Other";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top + 12);

									ctx.fillStyle = "green";
									var o = plot.pointOffset({
										x: ($scope.myEntry + $scope.ticksPerSubPeriod) / $scope.tMax,
										y: opts.yaxis.min
									});
									var s = "My";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top + 14);
									var s = "Entry Time";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top + 26);

								} else {

									ctx.fillStyle = "red";
									var o = plot.pointOffset({
										x: $scope.t / $scope.tMax,
										y: $scope.earn(lastSubPeriod / $scope.tMax, $scope.otherEntry / $scope.tMax)
									});
									var s = "Me";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top + 12);

									ctx.fillStyle = "green";
									var o = plot.pointOffset({
										x: $scope.t / $scope.tMax,
										y: $scope.earn($scope.otherEntry / $scope.tMax, lastSubPeriod / $scope.tMax)
									});
									var s = "Other";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top - 5);


									ctx.fillStyle = "green";
									var o = plot.pointOffset({
										x: ($scope.otherEntry + $scope.ticksPerSubPeriod) / $scope.tMax,
										y: opts.yaxis.min
									});
									var s = "Other's";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top + 14);
									var s = "Entry Time";
									var m = ctx.measureText(s);
									ctx.fillText(s, o.left - 0.5 * m.width, o.top + 26);

								}

							} else { //Entry is not yet revealed

								ctx.fillStyle = "black";
								var o = plot.pointOffset({
									x: $scope.t / $scope.tMax,
									y: $scope.earn(lastSubPeriod / $scope.tMax, lastSubPeriod / $scope.tMax)
								});
								var s = "Me";
								var m = ctx.measureText(s);
								ctx.fillText(s, o.left - 0.5 * m.width, o.top - 5);

								ctx.fillStyle = "black";
								var o = plot.pointOffset({
									x: $scope.t / $scope.tMax,
									y: $scope.earn(lastSubPeriod / $scope.tMax, lastSubPeriod / $scope.tMax)
								});
								var s = "Other";
								var m = ctx.measureText(s);
								ctx.fillText(s, o.left - 0.5 * m.width, o.top + 12);

							}


						}

					} else { // Nobody has entered

						ctx.fillStyle = "black";
						var o = plot.pointOffset({
							x: $scope.t / $scope.tMax,
							y: $scope.earn(lastSubPeriod / $scope.tMax, lastSubPeriod / $scope.tMax)
						});
						var s = "Me";
						var m = ctx.measureText(s);
						ctx.fillText(s, o.left - 0.5 * m.width, o.top - 5);

						ctx.fillStyle = "black";
						var o = plot.pointOffset({
							x: $scope.t / $scope.tMax,
							y: $scope.earn(lastSubPeriod / $scope.tMax, lastSubPeriod / $scope.tMax)
						});
						var s = "Other";
						var m = ctx.measureText(s);
						ctx.fillText(s, o.left - 0.5 * m.width, o.top + 12);

					}

				}

				opts.hooks = { draw: [draw_text] };

				$.plot(element, dataset, opts);

			});
		}
	}
}]);