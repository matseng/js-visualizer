var myApp = angular.module('myApp', []);

myApp.controller('firstController', ['$scope', function($scope) {
  $scope.message = 'Hello World 3';
}]);

myApp.directive('myDirective', function(){
  return {
    restrict: 'E',
    // scope: {
    //   messageText: '='
    // },
    templateUrl: 'messageExample.html'
  };
});

