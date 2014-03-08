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
    $scope.codeText = '  \
var result = [];  \n  \
function fibonacci(n, output) {  \n  \
  var a = 1, b = 1, sum;  \n  \
  for (var i = 0; i < n; i++) {  \n  \
    output.push(a);  \n  \
    sum = a + b;  \n  \
    a = b;  \n  \
    b = sum;  \n  \
  }  \n  \
}  \n  \
fibonacci(4, result);  \n  \
alert(result.join(", ")); ';

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
      console.log('start: ' + start + ', end: ' + end);
      //createSelection(start, end);
      isCompleteStatement(start, end);
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
    $scope.biggerStepButton = function() {
      if (myInterpreter.stateStack[0]) {
        var node = myInterpreter.stateStack[0].node;
        var start = node.start;
        var end = node.end;
        var completeStatementBoolean = false;  //initialized to false to enter while loop
        var allCodeString = $scope.editor.getValue();
        while(completeStatementBoolean === false){
          node = myInterpreter.stateStack[0].node;
          start = node.start;
          end = node.end;
          completeStatementBoolean = isCompleteStatement(start, end);
          if(completeStatementBoolean){  //this if statement is for testing purposes
            console.log('Complete statement found!');
            console.log("  " + allCodeString.substring(start, end));
          }
          $scope.stepButton();
        }
      }
    }    
    $scope.biggerStepButton_old = function() {
      if (myInterpreter.stateStack[0]) {
        var node = myInterpreter.stateStack[0].node;
        var start = node.start;
        var end = node.end;
        var completeStatementBoolean = isCompleteStatement(start, end);
        if(completeStatementBoolean){
          $scope.stepButton();
        } else {
          var allCodeString = $scope.editor.getValue();
          while(completeStatementBoolean === false){
            node = myInterpreter.stateStack[0].node;
            start = node.start;
            end = node.end;
            completeStatementBoolean = isCompleteStatement(start, end);
            if(completeStatementBoolean){
              console.log('Complete statement found!');
              console.log("  " + allCodeString.substring(start, end));
            }
            $scope.stepButton();
          }
        }
      }
    }
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
      document.getElementById('biggerStepButton').disabled = disabled;
      document.getElementById('runButton').disabled = disabled;
    };
    /* 
    Highlights the text of current expression that is being evaluated:
    */
    function createSelection(start, end) {
      var field = document.getElementById('code')
      if (field.createTextRange) {
        var selRange = field.createTextRange();
        selRange.collapse(true);
        selRange.moveStart('character', start);
        selRange.moveEnd('character', end);
        selRange.select();
      } else if (field.setSelectionRange) {
        field.setSelectionRange(start, end);
      } else if (field.selectionStart) {
        field.selectionStart = start;
        field.selectionEnd = end;
      }
      field.focus();
      //console.log(isNewLine(field, start, end));
    }  //END createSelection
    
    /*
    Returns true if the node type is a complete statement 
    (e.g. forStatement, variableStatement (includes a semicolon), expressionStatement (includes semicolor))
    */
    var isCompleteStatement = function(start, end){
      var str = $scope.editor.getValue();
      for(var i = end; i < str.length; i++){
        var char = str[i];
        if(!(/\s/.test(char)))  //character is NOT a white space
          return false;
        if(/\r|\n/.test(char)){  //new line found (good)
          break;
        }
      }
      for(var j = start - 1 ; j >= 0; j--){
        var char = str[j];
        if(!(/\s/.test(char)))
          return false;  //return false bc character is NOT a white space
        if(/\r|\n/.test(char)){
          break;
        }
      }
      //console.log(str.substring(start, end));
      return true;
    }  //END isCompleteStatement
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


