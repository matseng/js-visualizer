var jsvis = angular.module('jsvis', ['ngRoute','ngAnimate', 'ScopeTree'])
  .controller('MainController', function($scope, $interval, ScopeService) {
    var runInterval;
    $scope.disableSteps = true;
    $scope.disableRun = true;
    $scope.codeText = '';
    $scope.prevStatement = '';
    //scopeviz
    $scope.highlight = function(scopeTree, name){
      var root = scopeTree.getRoot();
      var value = ScopeService.getValue(scopeTree, name);
      ScopeService.toggleHighlights(root, value);
    };

    //editor
    $scope.parseButton = function() {
      $scope.editor.setReadOnly(true);
      var code = $scope.editor.getValue();
      myInterpreter = new Interpreter(code, initAlert);
      $scope.disableRun = false;
      $scope.disableSteps = false;
      $scope.editor.session.clearBreakpoints();
      ScopeService.clearScopes();
    };

    $scope.stepButton = function() {
      var nextIsFuncDef = false;
      var node, start, end, ok;
      if (myInterpreter.stateStack[0]) {
        var nextNodeType = myInterpreter.stateStack[0].node.type;
        addReadableText($scope.editor, nextNodeType);
        if (nextNodeType === 'FunctionDeclaration') {
          nextIsFuncDef = true;
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
        if (nextIsFuncDef === true) {
          dimFunctionBody($scope.editor,startRow,endRow);
          nextIsFuncDef = false;
        }
      } finally {
        if (!ok) {
          endSteps($scope);
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
      endSteps($scope);
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
          } else {
            break;
          }
        }
      }
      if(myInterpreter.stateStack.length === 0) {
        endSteps($scope);
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
          } else {
            break;
          }
          $scope.stepButton();
        }
      }
      if(myInterpreter.stateStack.length === 0) {
        endSteps($scope);
      }
    };
  })
  .service("ScopeService", ['ScopeTree', function(ScopeTree){
    this.masterTree = null;
    this.activeScope = null;
    this.clearScopes = function(){
      this.masterTree = null;
      this.activeScope = null;
    };
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
      // var validator = function(a,b){return a._scope === b._scope;};
      for (i = 0; i < diff.length; i++) {
        this.masterTree.removeDescendant(new ScopeTree(diff[i]));
      }
      this.highlightActiveScope();
    };
  }])
  .service('TimeMachine', ['ScopeTree' ,function(ScopeTree){
    this.history = [];
    var Diff = function(){
      this.prev = null;
      this.next = null;
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
