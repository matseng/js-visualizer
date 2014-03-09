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
    $scope.lastColIndices;
//    $scope.codeText;
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
      getlastColIndices(code);
      myInterpreter = new Interpreter(code, initAlert);
      disable('');
    };

    var getlastColIndices = function(code) {
      $scope.editor.setValue(code);
      var lastRowIndex = $scope.editor.getSelection().getAllRanges()[0].end.row;
      $scope.lastColIndices = [];
      var lastColIndex = 0;

      for (var i = 0; i <= lastRowIndex; i++){
        $scope.editor.getSelection().moveCursorTo(i,0);
        $scope.editor.getSelection().moveCursorLineEnd();
        lastColIndex += $scope.editor.getSelection().getAllRanges()[0].end.column;
        if (i>0) { lastColIndex += 1; }
        $scope.lastColIndices[i] = lastColIndex;
      }
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
      selectCode(start, end);
      isCompleteStatement(start, end);
      try {
        ok = myInterpreter.step();
      } finally {
        if (!ok) {
          disable('disabled');
        }
      }
      ScopeService.updateScopeViz();
      $scope.treeArray = [ScopeService.masterTree];
    };

    var selectCode = function(start, end) {
      var startArray = getRowAndCol(start);
      var endArray = getRowAndCol(end);
      $scope.editor.getSelection().setSelectionRange({
        start: {
          row: startArray[0],
          column: startArray[1]
        },
        end: {
          row: endArray[0],
          column: endArray[1]
        }
      });
      $scope.editor.session.clearBreakpoints();
      $scope.editor.session.setBreakpoint([startArray[0]]);

    };

    var getRowAndCol = function(charIndex) {
      if (charIndex <= $scope.lastColIndices[0]) {
        return [0,charIndex];
      }
      var row = 1;
      for (var i = 1; i < $scope.lastColIndices.length; i++) {
        if (charIndex > $scope.lastColIndices[i]) {
          row = i+1;
        }
      }
      var col = charIndex - $scope.lastColIndices[row-1] - 1;
      return [row, col];
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
          // if(completeStatementBoolean){  //this if statement is for testing purposes
          //   console.log('Complete statement found!');
          //   console.log("  " + allCodeString.substring(start, end));
          // }
          $scope.stepButton();
        }
      }
    }
    $scope.biggerStepButton = function() {
      // TODO: To create stepIn, save current completeStatement 
        // iterate thru program via step until a a new completeStatement is encountered
      // To create stepOver, save ' '
        // iterate thru prgm via step past next expressionStatement until a new completeStatement is encountered
      

      if (myInterpreter.stateStack[0]) {
        var node = myInterpreter.stateStack[0].node;
        var start = node.start;
        var end = node.end;
        var oddNumComStaObjBoolean = false;  //initialized to false to enter while loop
        var programString = $scope.editor.getValue();
        while(oddNumComStaObjBoolean === false){
          node = myInterpreter.stateStack[0].node;
          start = node.start;
          end = node.end;
          oddNumComStaObjBoolean = isOddNumberedCompletedStatement(programString, start, end);
          if(oddNumComStaObjBoolean){  //this if statement is for testing purposes
            console.log('Complete statement found!');
            console.log("  " + programString.substring(start, end));
          }
          $scope.stepButton();
        }
      }
    }
    var isOddNumberedCompletedStatement = function(programString, start, end){
      if (!myInterpreter.oddNumberedCompletedStatement){
        myInterpreter.oddNumberedCompletedStatement = {};
      }
      var oddNumComStaObj = myInterpreter.oddNumberedCompletedStatement;
      var completeStatement = isCompleteStatement(programString, start, end);
      if(completeStatement === false)
        return false;
      if(oddNumComStaObj[start, end] === undefined){
        oddNumComStaObj[start, end] = true;
        return true;
      } else {
        oddNumComStaObj[start, end] = !(oddNumComStaObj[start, end]);
        return oddNumComStaObj[start, end];
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
      $scope.editor.session.clearBreakpoints();
    };
    /* 
    Highlights the text of current expression that is being evaluated:
    */
    // function createSelection(start, end) {
    //   var field = document.getElementById('code');
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
    //   //console.log(isNewLine(field, start, end));
    // }  //END createSelection
    /*
    Returns true if the node type is a complete statement 
    (e.g. forStatement, variableStatement (includes a semicolon), expressionStatement (includes semicolor))
    */
    var isCompleteStatement = function(programString, start, end){
      // var str = $scope.editor.getValue();
      for(var i = end; i < programString.length; i++){
        var char = programString[i];
        if(!(/\s/.test(char)))  //character is NOT a white space
          return false;
        if(/\r|\n/.test(char)){  //new line found (good)
          break;
        }
      }
      for(var j = start - 1 ; j >= 0; j--){
        var char = programString[j];
        if(!(/\s/.test(char)))
          return false;  //return false bc character is NOT a white space
        if(/\r|\n/.test(char)){
          break;
        }
      }
      //console.log(str.substring(start, end));
      return true;
    }  //END isCompleteStatement

    /*
    Returns true if the node type is a complete statement
    (e.g. forStatement, variableStatement (includes a semicolon), expressionStatement (includes semicolor))
    */
    var isCompleteStatement_old = function(start, end){
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

    var VizTree = function(jsiScope){
      this._scope = jsiScope;
      this._parent = null;
      this._children = [];
      this.variables = [];
      for(var key in jsiScope.properties){
        if(key === "arguments"){
          this.variables.push([key, stringifyArguments(jsiScope.properties[key])]);
        }else if(jsiScope.properties[key] !== undefined){
          if(jsiScope.properties[key].type === "object"){
            this.variables.push([key, "{}"]);
          }else if(jsiScope.properties[key].type === "function"){
            this.variables.push([key, "function(){}"]);
          }else{
            this.variables.push([key, jsiScope.properties[key].data]);
          }
        }
      }
      if(jsiScope.parentScope !== null){
        this._parent = new VizTree(jsiScope.parentScope);
        this._parent._children.push(this);
      }
    };
    VizTree.prototype.findNode = function(jsiNode){
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
      var foundNode = this.findNode(vizNode._scope);
      if( foundNode === false){
        var parentNode = this.findNode(vizNode._parent._scope);
        parentNode.addChild(vizNode);
      }else if( vizNode._children[0] !== undefined ){
        this.merge(vizNode._children[0]);
      }
    };

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
      // scope.editor.getSession().setBreakpoint([0]);
    }

  });
