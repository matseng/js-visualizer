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
  .controller('MainController', function($scope, ScopeService) {
    $scope.allValues = {};
    $scope.message = 'Hello World';
    $scope.codeText;
    $scope.remove = function(data) {
        data.nodes = [];
    };
    $scope.add = function(data) {
        var post = data.nodes.length + 1;
        var newName = data.name + '-' + post;
        data.nodes.push({name: newName,nodes: []});
    };
    $scope.parseButton = function() {
      var code = $scope.editor.getValue();
      // var code = $scope.codeText;
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
      try {
        ok = myInterpreter.step();
      } finally {
        if (!ok) {
          disable('disabled');
        }
      }
      $scope.tree[0] = ScopeService.updateScopeViz();
      $scope.treeArray = ScopeService.treeArray;
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
    var removeSelfReferences = function(scope){
      for(var prop in scope){
        if(typeof scope[prop] === "object"){
          scope[prop] = "{}";
        }
      }
    };
    $scope.tree = [{name: "Global", variables: [], child: [ {name: "child1", variables: [], child: []}, {name: "child2", variables: [], child: []} ]}];
  })
  .service("ScopeService", function(){
    this._globalScope = {name: "Global", variables: [], child: [] };
    this.treeArray = 
    this.getScope = function(scope){
      return globalScope;
    };
    this.updateScopeViz = function(){
      var tempTrees = [];
      var scopeCount = 0;
      var stateStack = window.myInterpreter.stateStack;
      var buildScopeTree = function(jsiScope, vizScope){
        scopeCount++;
        vizScope.variables = Object.keys(jsiScope.properties);
        if(jsiScope.parentScope === null){
          vizScope.name = "Global";
          return vizScope;
        }else{
          var child = vizScope;
          // console.log('vizScope: ',vizScope);
          vizScope = {name: scopeCount, variables: [], child: [child]};
          return buildScopeTree(jsiScope.parentScope, vizScope);
        }
      };
      for (var i = 0; i < stateStack.length; i++) {
        if(stateStack[i].scope){
          tempTrees.push(buildScopeTree(stateStack[i].scope, {name: "0", variables:[], child:[]} ));
        }
      }
      this._globalScope = tempTrees[0];
      // for (i = 1; i < tempTrees.length; i++) {
      //   // console.log(tempTrees[i]);
      //   if(tempTrees[i].child[0]){
      //     this._globalScope.child.push(tempTrees[i].child[0]);
      //   }
      // }
      this.treeArray = tempTrees;//[this._globalScope];
    };
  })
  .directive('aceEditor', function() {
    return {
      require: '?ngModel',
      link:link
    };
    function link(scope, element, attrs, ngModel) {
      scope.editor = ace.edit("editor");
      scope.editor.setTheme("ace/theme/monokai");
      scope.editor.getSession().setMode("ace/mode/javascript");
      scope.editor.setValue(scope.codeText);
    }
  });


