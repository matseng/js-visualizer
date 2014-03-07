var jsvis = angular.module('jsvis', ['ngRoute'])

  .config(function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);
    $routeProvider
      .when('/', {
        templateUrl: '../views/mainindex.html',
        controller: 'MainController'
      })
      .otherwise({
        redirectTo: '/'
      });
  })
  .controller('MainController', function($scope) {
    $scope.message = 'Hello World';
    $scope.visualize = function() {
      svg.append('circle')
        .attr({'r': 20, 'class': 'newdatapoint'})
        .attr('cx', 40)
        .attr('cy', 20)
        .attr('fill', 'green')
        // .selectAll('text')
        // .append('text')
        // .attr('x', 40)
        // .attr('y', 20)
        // .style('stroke', 'black')
        // .text('i')

    };
  });

