
Redwood.factory('AsyncCallManager', ['$q', '$rootScope', '$timeout', function($q, $rootScope, $timeout) {
    'use strict';

    var asyncCallManagerService = {

        queueOverlappingCallsTo: function(f) {

            var queue = [];
            var busy = false;

            var execute = function() {
                var deferred = queue.shift();
                f().then(function(result) {
                    deferred.resolve(result);
                    if(queue.length > 0) {
                        execute();
                    } else {
                        busy = false;
                    }
                });
            };

            var wrapper = function() {
                var deferred = $q.defer();
                queue.push(deferred);

                if(!busy) {
                    busy = true;
                    $rootScope.$evalAsync(execute);
                }

                return deferred.promise;
            }

            return wrapper;
        },

        mergeOverlappingCallsTo: function(f) {

            var queue = [];
            var busy = false;

            var execute = function() {
                var deferred = queue.shift();
                f().then(function(result) {
                    deferred.resolve(result);
                    while(queue.length) {
                        deferred = queue.shift();
                        deferred.resolve(result);
                    }
                    busy = false;
                });
            };

            var wrapper = function() {
                var deferred = $q.defer();
                queue.push(deferred);

                if(!busy) {
                    busy = true;
                    $rootScope.$evalAsync(execute);
                }

                return deferred.promise;
            };

            return wrapper;
        },

        waitForSubsequentCallsTo: function(f, delay) {

            var queue = [];
            var scheduledExecution;

            var execute = function() {
                var q = [];
                while(queue.length) {
                    q.push(queue.pop()); //reverse order
                }
                var deferred = q.shift();
                f().then(function(result) {
                    deferred.resolve(result);
                    while(q.length) {
                        deferred = q.shift();
                        deferred.resolve(result);
                    }
                });
            };

            var wrapper = function() {
                var deferred = $q.defer();
                queue.push(deferred);

                if(scheduledExecution) {
                    $timeout.cancel(scheduledExecution);
                }
                scheduledExecution = $timeout(execute, delay);

                return deferred.promise;
            }

            return wrapper;
        }

    };

    return asyncCallManagerService;

}]);