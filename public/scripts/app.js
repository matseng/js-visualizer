var jsvis = angular.module('jsvis', ['ngRoute'])
  .config(function($routeProvider, $locationProvider) {
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
  })
  .controller('MainController', function($scope, ScopeService) {
    $scope.codeText = '';

    $scope.highlight = function(scopeTree, name){
      var root = scopeTree.getRoot();
      var value = scopeTree.getValueOf(name);
      root.toggleHighlights(value);
    };

    $scope.parseButton = function() {
      var code = $scope.editor.getValue();
      myInterpreter = new Interpreter(code, initAlert);
      disable('');
      $scope.editor.session.clearBreakpoints();
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
      $scope.editor.getSelection().setSelectionRangeIndices(start, end);
      $scope.editor.session.clearBreakpoints();
      var startRow = $scope.editor.getSelection().getRowColumnIndices(start).row;
      $scope.editor.session.setBreakpoint([startRow]);
      isCompleteStatement(start, end);
      try {
        ok = myInterpreter.step();
      } finally {
        if (!ok) {
          disable('disabled');
          $scope.editor.session.clearBreakpoints();
        }
      }
      ScopeService.updateScopeViz();
      $scope.scopeTree = ScopeService.masterTree;
    };
    $scope.biggerStepButton_old = function() {
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
          $scope.stepButton();
        }
      }
    };
    $scope.biggerStepButton = function() {
      if (myInterpreter.stateStack[0]) {
        var node = myInterpreter.stateStack[0].node;
        var start = node.start;
        var end = node.end;
        var programString = $scope.editor.getValue();
        var currStatement = programString.slice(start,end);
        var currCompleteStatement = isCompleteStatement(programString, start, end);
        $scope.stepButton();
        while($scope.prevStatement === currStatement || currCompleteStatement === false){
          node = myInterpreter.stateStack[0].node;
          start = node.start;
          end = node.end;
          if (isCompleteStatement(programString, start, end)) {
            if (currCompleteStatement === true) {
              $scope.prevStatement = currStatement;
            }
            currCompleteStatement = true;
            currStatement = programString.slice(start,end);
          }
          $scope.stepButton();
        }
      }
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
      document.getElementById('biggerStepButton').disabled = disabled;
      document.getElementById('runButton').disabled = disabled;
    };
    /*
    Returns true if the node type is a complete statement
    (e.g. forStatement, variableStatement (includes a semicolon), expressionStatement (includes semicolor))
    */
    var isCompleteStatement = function(programString, start, end){
      // var str = $scope.editor.getValue();
      var currChar;
      for(var i = end; i < programString.length; i++){
        currChar = programString[i];
        if(!(/\s/.test(currChar)))  //currCharacter is NOT a white space
          return false;
        if(/\r|\n/.test(currChar)){  //new line found (good)
          break;
        }
      }
      for(var j = start - 1 ; j >= 0; j--){
        currChar = programString[j];
        if(!(/\s/.test(currChar)))
          return false;  //return false bc character is NOT a white space
        if(/\r|\n/.test(currChar)){
          break;
        }
      }
      //console.log(str.substring(start, end));
      return true;
    };  //END isCompleteStatement
    var removeSelfReferences = function(scope){
      for(var prop in scope){
        if(typeof scope[prop] === "object"){
          scope[prop] = "{}";
        }
      }
    };
  })
  .service("ScopeService", function(){
    this.masterTree = null;

    var stringifyArguments = function(args){
      var result = [];
      for(var i =0; i < args.length; i++){
        result.push(i+' : '+args.properties[i]);
      }
      if(args.length > 0){
        return '{' + result.join(', ') + ', length : ' + args.length +'}';
      }else{
        return '{' + result.join(', ') + 'length : ' + args.length +'}';
      }
    };

    var globalVarKeys =
      {'Infinity' : true,
      'NaN' : true,
      'undefined' : true,
      'window' : true,
      'self' : true,
      'Function': true,
      'Object': true,
      'Array': true,
      'Number': true,
      'String': true,
      'Boolean': true,
      'Date' : true ,
      'Math' : true,
      'isNaN' : true,
      'isFinite' : true,
      'parseFloat' : true,
      'parseInt' : true,
      'eval' : true,
      'escape' : true,
      'unescape' : true,
      'decodeURI' : true,
      'decodeURIComponent' : true,
      'encodeURI' : true,
      'encodeURIComponent' : true,
      'alert' : true
    };

    var VizTree = function(jsiScope){
      this._scope = jsiScope;
      this._parent = null;
      this._children = [];
      this.variables = {};
      this.highlights = {};
      for(var key in jsiScope.properties){
        if(globalVarKeys[key] !== undefined){
          continue;
        }
        if(key === "arguments"){
          this.variables[key] = stringifyArguments(jsiScope.properties[key]);
        }else if(jsiScope.properties[key] !== undefined){
          if(jsiScope.properties[key].type === "object"){
              this.variables[key] = "{}";
          }else if(jsiScope.properties[key].type === "function"){
            this.variables[key] = "function(){}";
          }else {
            if(jsiScope.properties[key].data === Infinity){
              this.variables[key] = "Infinity";
            }else{
              this.variables[key] = jsiScope.properties[key].data;
            }
          }
        }

      }
      if(jsiScope.parentScope !== null){
        this._parent = new VizTree(jsiScope.parentScope);
        this._parent._children.push(this);
      }
    };
    VizTree.prototype.findNode = function(vizNode){
      var jsiNode = vizNode._scope;
      if(jsiNode === this._scope){
        return this;
      }
      for (var i = 0; i < this._children.length; i++) {
        var foundNode = this._children[i].findNode(jsiNode);
        if( foundNode !== null){
          return foundNode;
        }
      }
      return false;
    };
    VizTree.prototype.addChild = function(vizNode){
      this._children.push(vizNode);
      vizNode._parent = this;
    };
    VizTree.prototype.merge = function(vizNode){
      var foundNode = this.findNode(vizNode);
      if( foundNode === false){
        var parentNode = this.findNode(vizNode._parent);
        parentNode.addChild(vizNode);
      }else if( vizNode._children[0] !== undefined ){
        this.merge(vizNode._children[0]);
      }
    };
    VizTree.prototype.getRoot = function(){
      var currentNode = this;
      while(currentNode._parent !== null){
        currentNode = currentNode._parent;
      }
      return currentNode;
    };
    VizTree.prototype.getValueOf = function(name){
      var result = this._scope.properties[name];
      if(result === undefined && this._parent !== null){
        result = this._parent.getValueOf(name);
      }
      return result;
    };
    VizTree.prototype.toggleHighlights = function(value){
      for (var key in this._scope.properties) {
        if (this._scope.properties[key] === value){
          this.highlights[key] = !this.highlights[key];
        }else{
          this.highlights[key] = false;
        }
      };
      for (var i = 0; i < this._children.length; i++) {
        this._children[i].toggleHighlights(value);
      }
    }


    this.updateScopeViz = function(){
      var tempTrees = [];
      var scopeCount = 0;
      var stateStack = window.myInterpreter.stateStack;
      for (var i = 0; i < stateStack.length; i++) {
        if(stateStack[i].scope){
          var childNode = new VizTree(stateStack[i].scope);
          while(childNode._parent !== null){
            childNode = childNode._parent;
          }
          var rootNode = childNode;
          tempTrees.push(rootNode);
        }
      }
      this.masterTree = tempTrees[0];
      for (i = 1; i < tempTrees.length; i++) {
        this.masterTree.merge(tempTrees[i]);
      }
      var currentNode = this.masterTree;
      while(currentNode._children.length > 0){
        currentNode = _.first(currentNode._children)
      }
      currentNode.activeScope = true;
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
      scope.editor.getSession().setTabSize(2);
      scope.editor.setValue(scope.codeText);
      scope.editor.clearSelection();
      scope.editor.renderer.setShowGutter(true);
    }

  });
