Redwood.controller("AdminCtrl", ["$rootScope", "$scope", "Admin", function($rootScope, $scope, ra) {

	var ROLE = {
		P: 0,
		R: 1
	};

	var Display = { //Display controller

		initialize: function() {
			$("#start-session").click(function () {
				$("#start-session").attr("disabled", "disabled");
				ra.trigger("start_session");
			});

			ra.on("start_session", function() {
				$("#start-session").attr("disabled", "disabled");
				$("#pause-session").removeAttr("disabled");
			});

			$("#refresh-subjects").click(function () {
				$("#refresh-subjects").attr("disabled", "disabled");
				ra.refreshSubjects().then(function() {
					$("#refresh-subjects").removeAttr("disabled");
				});
			});

			$("#reset-session").click(function () {
				ra.reset();
			});

			$("#pause-session").click(function () {
				$("#pause-session").attr("disabled", "disabled");
				ra.trigger("pause");
			});
			ra.on("pause", function() {
				$("#pause-session").attr("disabled", "disabled");
			});

			$("#resume-session").click(function () {
				$("#resume-session").attr("disabled", "disabled");
				ra.trigger("resume");
			});
			ra.on("resume", function() {
				$("#resume-session").attr("disabled", "disabled");
				$("#pause-session").removeAttr("disabled");
			});

			ra.on_subject_paused(function(userId) {
				$("#pause-session").attr("disabled", "disabled");
				$("tr.subject-" + userId).addClass("warning"); //Display current period for each user
				$("tr.subject-" + userId + " :nth-child(4)").text("Paused"); //Display current period for each user
			});

			ra.on_all_paused(function() {
				$("#resume-session").removeAttr("disabled");
			});

			ra.on_subject_resumed(function(user) {
				$("tr.subject-" + user).removeClass("warning"); //Display current period for each user
				$("tr.subject-" + user + " :nth-child(4)").text(""); //Display current period for each user
			});

			$("#archive").click(function () {
				var r = confirm("Are you sure you want to archive this session?");
				if(r == true) {
					ra.delete_session();
				}
			});

			ra.on_router_connected(function(connected) { //Display router connection status
				var status = $("#router-status");
				if (connected) {
					status.text("Router Connected");
					status.removeClass("badge-important");
					status.addClass("badge-success");
				} else {
					status.text("Router Disconnected");
					status.removeClass("badge-success");
					status.addClass("badge-important");
				}
			});

			ra.on_set_period(function(user, period) {
				$("tr.subject-" + user + " :nth-child(3)").text(period); //Display current period for each user
			});

			ra.on_set_group(function(user, group) {
				$("tr.subject-" + user + " :nth-child(2)").text(group); //Display group for each user
			});

			ra.on_register(function(user) { //Add a row to the table to each user
				$("#subject-list").empty();
				for(var i = 0, l = ra.subjects.length; i < l; i++) {
					$("#subject-list").append($("<tr>").addClass("subject-" + ra.subjects[i].user_id).append(
						$("<td>").text(ra.subjects[i].user_id).after(
							$("<td>").text(0).after(
								$("<td>").text(0).after(
									$("<td>").text(""))))));
				}
			});

			ra.on_set_config(function(config) { //Display the config file
				$("table.config").empty();
				var a = $.csv.toArrays(config);
				for (var i = 0; i < a.length; i++) {
					var row = a[i];
					var tr = $("<tr>");
					for (var j = 0; j < row.length; j++) {
						var cell = row[j];
						var td = $((i == 0 ? "<th>" : "<td>")).text(cell);
						tr.append(td);
					}
					$("table.config").append(tr);
				}
			});
		}
	};

	var resetGroups = function() {
		var config = ra.get_config(1, 0) || {};
		for (var i = 0; i < ra.subjects.length; i++) { //set all subjects to group 1 (this is so that matching can be changed per period)
			if($.isArray(config.groups)) {
				for(var groupId = 0; groupId < config.groups.length; groupId++) {
					if($.isArray(config.groups[groupId])) {
						if(config.groups[groupId].indexOf(parseInt(ra.subjects[i].user_id)) > -1) { //Nested group array
							ra.set_group(groupId + 1, ra.subjects[i].user_id);
						}
					} else {
						ra.set_group(1, ra.subjects[i].user_id);
					}
				}
			} else {
				ra.set_group(1, ra.subjects[i].user_id);
			}
		}
	};

	Display.initialize();

	ra.on_load(function () {
		resetGroups(); //Assign groups to users
	});

	ra.on_register(function(user) { //Add a row to the table to each user
		resetGroups();
	});

	ra.on("start_session", function() {
		var answer = ra.configs[0].num_circles;//Math.round(Math.random() * 100 + 50);
		ra.trigger("answer", answer);
		$scope.estimates = {};

		ra.start_session();
	});

	ra.on("pause", function() {
		ra.pause();
	});

	ra.on("resume", function() {
		ra.resume();
	});

	ra.on("answer", function(value) {
		$scope.answer = value;
	});

	ra.recv("estimation", function(sender, value) {
		$scope.estimates[sender] = value;
		if(!ra.subjects.firstWhere(function() {
			return isNullOrUndefined($scope.estimates[this]);
		})) {
			ra.trigger("assign_roles");
		}
	});

	ra.on("assign_roles", function() {
		$scope.roles = {};
		var subjects = [];
		for(var i = 0, l = ra.subjects.length; i < l; i++) {
			subjects.push(ra.subjects[i]);
		}
		subjects.sort(function(a,b) {
			return Math.abs($scope.answer - $scope.estimates[a]) - Math.abs($scope.answer - $scope.estimates[b]);
		});
		var remainders = subjects.length % 2;
		remainders += (((subjects.length - remainders) / 2) % ra.configs[0].k) * 2;
		for(var i = 0, l = (subjects.length - remainders); i < l; i++) {
			ra.set(subjects[i], "rank", i);
			if(i < l/2) {
				ra.set(subjects[i], "role", ROLE.P);
			} else {
				ra.set(subjects[i], "role", ROLE.R);
			}
		}
		for(var j = i, l = subjects.length; j < l; j++) {
			ra.set_group(2, subjects[j]);
			ra.__send__("excluded", true, subjects[j], 0, 2);
			//ra.__send__("__set_points__", true, subjects[j], 0, 2);
			//ra.set_period(ra.configs.length + 1, subjects[j])
		}
		ra.trigger("roles_assigned");
	});

}]);
