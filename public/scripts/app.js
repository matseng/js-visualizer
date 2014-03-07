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
    // $scope.visualize = function(code) {
    //   svg.append('circle')
    //     .attr({'r': 20, 'class': 'newdatapoint'})
    //     .attr('cx', 40)
    //     .attr('cy', 20)
    //     .attr('fill', 'green')
    //     .selectAll('text')
    //     .append('text')
    //     .attr('x', 40)
    //     .attr('y', 20)
    //     .style('stroke', 'black')
    //     .text('i');
    // };
    $scope.codeText = "var x = 1;var fun1 = function(){var y = 2;var fun2 = function(){var z = 3;var fun3 = function(){var alpha = 4}();}();}();";//"var result = []; \nfunction fibonacci(n, output) { \n  var a = 1, b = 1, sum; \n  for (var i = 0; i < n; i++) { \n    output.push(a); \n    sum = a + b; \n    a = b; \n    b = sum; \n  }\n}\nfibonacci(16, result);\nalert(result.join(', '));";
    $scope.remove = function(data) {
        data.nodes = [];
    };

    $scope.add = function(data) {
        var post = data.nodes.length + 1;
        var newName = data.name + '-' + post;
        data.nodes.push({name: newName,nodes: []});
    };

    $scope.parseButton = function() {
      var code = $scope.codeText;
      console.log(code);
      myInterpreter = new Interpreter(code, initAlert);
      disable('');
    };

    $scope.stepButton = function() {
      var node, start, end, ok;
      if (myInterpreter.stateStack[0]) {
        node = myInterpreter.stateStack[0].node;
        start = node.start;
        end = node.end;
      } else {
        start = 0;
        end = 0;
      }
      // createSelection(start, end);
      try {
        ok = myInterpreter.step();
      } finally {
        if (!ok) {
          disable('disabled');
        }
      }
      updateScopeViz();
    };

    var initAlert = function(interpreter, scope) {
      var wrapper = function(text) {
        text = text ? text.toString() : '';
        return interpreter.createPrimitive(alert(text));
      };
      interpreter.setProperty(scope, 'alert',
          interpreter.createNativeFunction(wrapper));
    };

    var disable = function(disabled) {
      document.getElementById('stepButton').disabled = disabled;
      document.getElementById('runButton').disabled = disabled;
    };

    var updateScopeViz = function(){
      var scopeCount = 0;
      var buildScopes = function(jsiScope, vizScope){
        scopeCount++;
        vizScope.variables = Object.keys(jsiScope.properties);
        if(jsiScope.parentScope === null){
          vizScope.name = "Global";
          return vizScope;
        }else{
          var child = vizScope;
          vizScope = {name: scopeCount, variables: [], child: [child]};
          return buildScopes(jsiScope.parentScope, vizScope);
        }
      };
      $scope.tree[0] = buildScopes(window.myInterpreter.getScope(), {name: "0", variables:[], child:[]});
      // console.log(JSON.stringify($scope.tree));
    };

    // var createSelection = function(start, end) {
    //   var field = $scope.codeText;
    //   if (field.createTextRange) {
    //     var selRange = field.createTextRange();
    //     selRange.collapse(true);
    //     selRange.moveStart('character', start);
    //     selRange.moveEnd('character', end);
    //     selRange.select();
    //   } else if (field.setSelectionRange) {
    //     field.setSelectionRange(start, end);
    //   } else if (field.selectionStart) {
    //     field.selectionStart = start;
    //     field.selectionEnd = end;
    //   }
    //   field.focus();
    // };
    $scope.tree = [{name: "Global", variables: [], child: [{name: "child", variables: [], child: []}]}];
  });


