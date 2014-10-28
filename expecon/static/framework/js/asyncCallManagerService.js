
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
            };

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

        waitAndOnlyExecuteLastCallTo: function(f, delay) {

            var batches = [[]];
            var timeout;

            var execute = asyncCallManagerService.queueOverlappingCallsTo(function() {
                var deferred = $q.defer();
                var batch = batches.shift();
                var call = batch.pop();
                f().then(function(result) {
                    call.resolve(result);
                    while(batch.length) {
                        call = batch.pop();
                        call.resolve(result);
                    }
                    deferred.resolve();
                });
                return deferred.promise;
            });

            var wrapper = function() {
                var deferred = $q.defer();
                batches[batches.length - 1].push(deferred);

                if(timeout) {
                    $timeout.cancel(timeout);
                }
                timeout = $timeout(function() {
                    batches.push([]);
                    execute();
                }, delay);

                return deferred.promise;
            };

            return wrapper;
        },

		limitCallRateTo: function(f, dt) {

			var batches = [[]];
			var timeout;

			var execute = asyncCallManagerService.queueOverlappingCallsTo(function() {
				var deferred = $q.defer();
				var batch = batches.shift();
				var call = batch.pop();
				f().then(function(result) {
					call.resolve(result);
					while(batch.length) {
						call = batch.pop();
						call.resolve(result);
					}
					deferred.resolve();
				});
				return deferred.promise;
			});

			var wrapper = function() {
				var deferred = $q.defer();
				batches[batches.length - 1].push(deferred);

				if(!timeout) {
					timeout = $timeout(function() {
						batches.push([]);
						execute();
						timeout = null;
					}, dt);
				}

				return deferred.promise;
			};

			return wrapper;
		}

    };

    return asyncCallManagerService;

}]);