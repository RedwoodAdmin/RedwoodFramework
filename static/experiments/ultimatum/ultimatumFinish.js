Redwood.controller("SubjectCtrl", ["$rootScope", "$scope", "RedwoodSubject", function($rootScope, $scope, rs) {

	$scope.state = {};

	rs.on_load(function() {
		if(rs.self.get("excluded")) {
			$scope.state.excluded = true;
		} else {
			$scope.responses = rs.self.get("responses");
			$scope.selectedOffer = rs.self.get('selected_offer');
			$scope.response = $scope.responses[$scope.selectedOffer.round][$scope.selectedOffer.index];
		}
	});

}])
	.filter('response', function() {
		return function(response) {
			return response ? 'Accepted' : 'Rejected';
		}
	});