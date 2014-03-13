var jsvis = angular.module('jsvis', ['ngRoute','ngAnimate'])
  .controller('MainController', function($scope, $interval, ScopeService) {
    var runInterval;
    $scope.disableSteps = true;
    $scope.disableRun = true;
    $scope.codeText = '';
    $scope.prevStatement = '';
    $scope.highlight = function(scopeTree, name){
      var root = scopeTree.getRoot();
      var value = scopeTree.getValueOf(name);
      root.toggleHighlights(value);
    };

    $scope.parseButton = function() {
      // $scope.editor.setReadOnly(true);
      var code = $scope.editor.getValue();
      myInterpreter = new Interpreter(code, initAlert);
      $scope.disableRun = false;
      $scope.disableSteps = false;
      $scope.editor.session.clearBreakpoints();
      ScopeService.clearScopes();
    };

    $scope.nextIsFuncDef = false;
    $scope.stepButton = function() {
      var node, start, end, ok;
      if (myInterpreter.stateStack[0]) {
        $scope.nextNodeType = myInterpreter.stateStack[0].node.type;
        if (myInterpreter.stateStack[0].node.type === 'FunctionDeclaration') {
          $scope.nextIsFuncDef = true;
        }
        node = myInterpreter.stateStack[0].node;
        start = node.start;
        end = node.end;
      } else {
        start = 0;
        end = 0;
      }
      var annoRange = $scope.editor.getSelection().makeRange(start, end);
      $scope.editor.getSession().setAnnotations([{
        row: annoRange.start.row,
        column: annoRange.start.column,
        text: $scope.nextNodeType,
        type: "info"
      }]);
      $scope.editor.getSelection().setSelectionRangeIndices(start, end);
      $scope.editor.session.clearBreakpoints();
      var startRow = $scope.editor.getSelection().getRowColumnIndices(start).row;
      var endRow = $scope.editor.getSelection().getRowColumnIndices(end).row;
      $scope.editor.session.setBreakpoint([startRow]);
      try {
        unDimFunctionBody($scope.editor);
        ok = myInterpreter.step();
        if ($scope.nextIsFuncDef === true) {
          dimFunctionBody($scope.editor,startRow,endRow);
          $scope.nextIsFuncDef = false;
        }
      } finally {
        if (!ok) {
          $scope.disableSteps = true;
          $scope.diableRun = true;
          $scope.editor.session.clearBreakpoints();
          // $scope.editor.setReadOnly(false);
        }
      }
      ScopeService.updateScopeViz();
      $scope.scopeTree = ScopeService.masterTree;
    };

    $scope.run = function() {
      if(runInterval){
        pause();
      }else{
        $scope.disableSteps = true;
        $scope.disableRun = false;
        runInterval = $interval(function() {
          $scope.stepInButton();
          if (myInterpreter.stateStack.length === 0) {
            stop();
          }
        }, 500);
      }
    };

    var pause = function() {
      $interval.cancel(runInterval);
      runInterval = null;
      $scope.disableSteps = false;
      $scope.disableRun = false;
    };

    var stop = function() {
      $interval.cancel(runInterval);
      runInterval = null;
      $scope.disableSteps = true;
      $scope.disableRun = true;
    };

    $scope.stepInButton = function() {
      if (myInterpreter.stateStack[0]) {
        var node = myInterpreter.stateStack[0].node;
        var start = node.start;
        var end = node.end;
        var programString = $scope.editor.getValue();
        var currStatement = programString.slice(start,end);
        var currCompleteStatement = isCompleteStatement(programString, start, end);
        $scope.stepButton();
        while($scope.prevStatement === currStatement || currCompleteStatement === false || currStatement === programString.trim()){
          if(myInterpreter.stateStack[0]){
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
          if(myInterpreter.stateStack.length === 0) {
            // $scope.editor.setReadOnly(false);
            $scope.disableSteps = true;
            $scope.disableRun = true;
            break;
          }
        }
      }
    };
    $scope.stepOverButton = function(){
      if (myInterpreter.stateStack[0]) {
        var node = myInterpreter.stateStack[0].node;
        var start = node.start;
        var end = node.end;
        var programString = $scope.editor.getValue();
        var currStatement = programString.slice(start,end);
        if (currStatement === programString.trim()) {
          $scope.stepInButton();
          return;
        }
        while(start <= end){
          if(myInterpreter.stateStack[0]){
            node = myInterpreter.stateStack[0].node;
            start = node.start;
          }
          if(myInterpreter.stateStack.length === 0) {
            // $scope.editor.setReadOnly(false);
            $scope.disableSteps = true;
            $scope.disableRun = true;
            break;
          }
          $scope.stepButton();
        }
      }
    };
  })
  .service("ScopeService", function(){
    this.masterTree = null;
    this.activeScope = null;
    this.clearScopes = function(){
      this.masterTree = null;
      this.activeScope = null;
    };

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
    var stringifyProperties = function(variables, properties){
      for(var key in properties){
        if(globalVarKeys[key] !== undefined){
          continue;
        }
        if(key === "arguments"){
          variables[key] = stringifyArguments(properties[key]);
        }else if(properties[key] === undefined){
          variables[key] = "undefined";
        }else if(properties[key].type === "object"){
          variables[key] = "{}";
        }else if(properties[key].type === "function"){
          variables[key] = "function(){}";
        }else if(properties[key].data === Infinity){
          variables[key] = "Infinity";
        }else if(properties[key].data === undefined){
          variables[key] = "undefined";
        }else{
          variables[key] = properties[key].data;
        }
      }
    };
    var VizTree = function(jsiScope){
      this._scope = jsiScope;
      this._parent = null;
      this._children = [];
      this.variables = {};
      this.highlights = {};
      stringifyProperties(this.variables, jsiScope.properties);
      if(jsiScope.parentScope){
        this._parent = new VizTree(jsiScope.parentScope);
        this._parent._children.push(this);
      }
    };
    VizTree.prototype.findNode = function(vizTree){
      if(vizTree._scope === this._scope){
        return this;
      }
      for (var i = 0; i < this._children.length; i++) {
        var foundNode = this._children[i].findNode(vizTree);
        if( foundNode !== false){
          return foundNode;
        }
      }
      return false;
    };
    VizTree.prototype.addChild = function(vizTree){
      this._children.unshift(vizTree);
      vizTree._parent = this;
    };
    VizTree.prototype.updateVariables = function(vizTree){
      var newNames = Object.keys(vizTree.variables);
      var oldVariables = _.pick(this.variables, newNames);
      this.variables = _.extend(oldVariables, vizTree.variables);
      for (var i = 0; i < this._children.length && i < vizTree._children.length; i++) {
        this._children[i].updateVariables(vizTree._children[i]);
      }
    };
    VizTree.prototype.flatten = function(){
      var results = [];
      results.push(this._scope);
      for (var i = 0; i < this._children.length; i++) {
        results = results.concat(this._children[i].flatten());
      }
      return results;
    };
    VizTree.prototype.add = function(vizTree){
      if(vizTree._parent === null){
        this.updateVariables(vizTree);
      }else{
        var currentNode = vizTree;
        var foundNode = this.findNode(currentNode);
        while(foundNode === false){
          currentNode = currentNode._parent;
          foundNode = this.findNode(currentNode);
        }
        if(currentNode._children.length > 0){
          foundNode.addChild(currentNode._children[0]);
        }
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
      }
      for (var i = 0; i < this._children.length; i++) {
        this._children[i].toggleHighlights(value);
      }
    };
    VizTree.prototype.remove = function(vizTree){
      var foundNode = this.findNode(vizTree);
      if(foundNode === false){
        console.log("ERR: Node not found.");
        return false;
      }
      var parent = foundNode._parent;
      parent._children = _.filter(parent._children, function(vizNode){
        return vizNode._scope !== vizTree._scope;
      });
      return vizTree;
    };
    this.updateScopeViz = function(){
      //add new
      if(window.myInterpreter.getScope() === undefined){
        return;
      }
      var newScope = new VizTree(window.myInterpreter.getScope());
      if(this.masterTree === null){
        this.masterTree = newScope.getRoot();
      }else{
        this.masterTree.add(newScope);
        this.masterTree.updateVariables(newScope.getRoot());
      }

      //remove old
      var tempTrees = [];
      var stateStack = window.myInterpreter.stateStack;
      for (var i = 0; i < stateStack.length; i++) {
        if(stateStack[i].scope){
          var childNode = new VizTree(stateStack[i].scope);
          tempTrees.push(childNode);
        }
      }
      var newScopeTree = _.last(tempTrees);
      for (i = 0; i < tempTrees.length-1; i++) {
        newScopeTree.add(tempTrees[i]);
      }
      var newFlattened = newScopeTree.flatten();
      var oldFlattened = this.masterTree.flatten();
      var diff = _.difference(oldFlattened, newFlattened);
      for (i = 0; i < diff.length; i++) {
        this.masterTree.remove(new VizTree(diff[i]));
      }
      this.highlightActiveScope();
    };
    this.highlightActiveScope = function(){
      var currentNode = this.masterTree;
      while(currentNode._children.length > 0){
        currentNode = _.first(currentNode._children);
      }
      if(this.activeScope){
        this.activeScope.active = false;
      }
      this.activeScope = currentNode;
      currentNode.active = true;
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
    }
  });
