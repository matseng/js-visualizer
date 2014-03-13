var jsvis = angular.module('jsvis', ['ngRoute','ngAnimate'])
  .controller('MainController', function($scope, $interval, ScopeService) {
    var runInterval;
    $scope.disableSteps = true;
    $scope.disableRun = true;
    $scope.codeText = '';
    $scope.prevStatement = '';
    $scope.highlight = function(scopeTree, name){
      var root = scopeTree.getRoot();
      var value = ScopeService.getValue(scopeTree, name);
      ScopeService.toggleHighlights(root, value);
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
        var nextNodeType = myInterpreter.stateStack[0].node.type;
        addReadableText($scope.editor, nextNodeType);
        if (nextNodeType === 'FunctionDeclaration') {
          $scope.nextIsFuncDef = true;
        }
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
  .factory('Tree', function(){
    var Tree = function(value){
      this._parent = null;
      this._children = [];
      this.value = value;
    };
    Tree.prototype.addChild = function(tree){
      this._children.unshift(tree); // *** this will affect how activescope is found! reverse previous logic
      tree._parent = this;
    };
    Tree.prototype.getRoot = function(){
      var currentNode = this;
      while(currentNode._parent !== null){
        currentNode = currentNode._parent;
      }
      return currentNode;
    };
    Tree.prototype.findNode = function(tree, validator){
      validator = validator || function(a,b){return a === b;};
      if(validator(tree, this)){
        return this;
      }
      var foundNode = _.find(this._children, function(child){
        return child.findNode(tree, validator);
      });
      return foundNode;
    };
    Tree.prototype.removeDescendant = function(tree, validator){
      var foundNode = this.findNode(tree, validator);
      if(!foundNode){
        console.log("ERR: Node not found.");
        return false;
      }
      var parent = foundNode._parent;
      parent._children = _.reject(parent._children, function(vizNode){
        return validator(vizNode, tree);
      });
      return tree;
    };
    return Tree;
  })
  .factory("ScopeTree", ['Tree', function(Tree){
    var ScopeTree = function(jsiScope){
      this._scope = jsiScope;
      _.extend(this, new Tree());
      this.variables = {};
      this.highlights = {};
      stringifyProperties(this.variables, jsiScope.properties);
      if(jsiScope.parentScope){
        this._parent = new ScopeTree(jsiScope.parentScope);
        this._parent._children.push(this);
      }
    };
    ScopeTree.prototype.flatten = function(){
      var results = [];
      results.push(this._scope);
      for (var i = 0; i < this._children.length; i++) {
        results = results.concat(this._children[i].flatten());
      }
      return results;
    };
    ScopeTree.prototype.addScope  = function(scope){
      if(scope._parent === null){
        this.updateVariables(scope);
      }else{
        var currentNode = scope;
        var validator = function(a,b){return a._scope === b._scope;};
        var foundNode = this.findNode(currentNode, validator);
        while(!foundNode && currentNode._parent){
          currentNode = currentNode._parent;
          foundNode = this.findNode(currentNode, validator);
        }
        if(currentNode._children.length > 0 && foundNode){
          foundNode.addChild(currentNode._children[0]);
        }
      }
    };
    ScopeTree.prototype.updateVariables = function(newTree){
      var newNames = Object.keys(newTree.variables);
      var oldVariables = _.pick(this.variables, newNames);
      this.variables = _.extend(oldVariables, newTree.variables);
      for (var i = 0; i < this._children.length && i < newTree._children.length; i++) {
        this._children[i].updateVariables(newTree._children[i]);
      }
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
    return ScopeTree;
  }])
  .service("ScopeService", ['ScopeTree', function(ScopeTree){
    this.masterTree = null;
    this.activeScope = null;
    this.clearScopes = function(){
      this.masterTree = null;
      this.activeScope = null;
    };
        //--------------------
    this.getValue = function(tree, name){
      var result = tree._scope.properties[name];
      if(result === undefined && tree._parent !== null){
        result = getValue(tree._parent, name);
      }
      return result;
    };
    this.toggleHighlights = function(tree, value){
      for (var key in tree._scope.properties) {
        if (tree._scope.properties[key] === value){
          tree.highlights[key] = !tree.highlights[key];
        }else{
          tree.highlights[key] = false;
        }
      }
      for (var i = 0; i < tree._children.length; i++) {
        this.toggleHighlights(tree._children[i], value);
      }
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
    this.updateScopeViz = function(){
      //add new
      if(window.myInterpreter.getScope() === undefined){
        return;
      }
      var newScope = new ScopeTree(window.myInterpreter.getScope());
      if(this.masterTree === null){
        this.masterTree = newScope.getRoot();
      }else{
        this.masterTree.addScope(newScope);
        this.masterTree.updateVariables(newScope.getRoot());
      }

      var tempTrees = [];
      var stateStack = window.myInterpreter.stateStack;
      for (var i = 0; i < stateStack.length; i++) {
        if(stateStack[i].scope){
          var childNode = new ScopeTree(stateStack[i].scope);
          tempTrees.push(childNode);
        }
      }
      var newScopeTree = _.last(tempTrees);
      for (i = 0; i < tempTrees.length-1; i++) {
        newScopeTree.addScope(tempTrees[i]);
      }
      var newFlattened = newScopeTree.flatten();
      var oldFlattened = this.masterTree.flatten();
      var diff = _.difference(oldFlattened, newFlattened);
      var validator = function(a,b){return a._scope === b._scope;};
      for (i = 0; i < diff.length; i++) {
        this.masterTree.removeDescendant(new ScopeTree(diff[i]), validator);
      }
      this.highlightActiveScope();
    };
  }])
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
