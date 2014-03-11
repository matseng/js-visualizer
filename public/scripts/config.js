jsvis.config(function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);
    $routeProvider
      .when('/', {
        templateUrl: '../views/mainindex.html',
        controller: 'MainController'
      })
      .when('/about', {
        templateUrl: '../views/mainindex.html',
        controller: 'MainController'
      })
      .when('/contact', {
        templateUrl: '../views/mainindex.html',
        controller: 'MainController'
      })
      .otherwise({
        redirectTo: '/'
      });
  });
