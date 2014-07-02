Redwood.directive("rwSubjectHeader", ["RedwoodSubject", function(rs) {
    return {
        link: function(scope, element, attrs) {
            scope.showPoints = "showPoints" in attrs;

            var loadSubjectFields = function() {
                scope.user_id = rs.user_id;
                scope.period = rs.period;
                scope.totalPoints = rs.accumulated_points;
            }
            
            // not so DRY, but it should make sure we
            // dont set this stuff before the data in rs is loaded.
            loadSubjectFields();
            rs.on_load(loadSubjectFields);
        },
        scope: {
            title: '@title',
            round: '=round',
            rounds: '=rounds',
            timeRemaining: '=timeRemaining',
            timeTotal: '=timeTotal'
        },
        templateUrl: "/static/components/html/subjectHeader.html"
    };
}]);

