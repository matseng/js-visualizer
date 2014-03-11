var jsvis = angular.module('jsvis', ['ngRoute','ngAnimate'])
  .controller('MainController', function($scope, $interval, ScopeService) {
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
          // $scope.editor.setReadOnly(false);
        }
      }
      ScopeService.updateScopeViz();
      $scope.scopeTree = ScopeService.masterTree;
    };

    $scope.runButton = function() {
      $scope.stepInterval = $interval(function() { 
        $scope.stepInButton();
        if (myInterpreter.stateStack.length === 0) {
          $scope.stopInterval();
        }
      }, 100);
    };

    $scope.stopInterval = function() {
      clearInterval($scope.stepInterval);
      disable('disabled');      
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
            disable('disabled');
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
            var tempEnd = node.end;
          }
          if(myInterpreter.stateStack.length === 0) {
            // $scope.editor.setReadOnly(false);
            disable('disabled');
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
      if(jsiScope.parentScope !== null){
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
    // VizTree.prototype._addNewNodes = function(vizTree){
    //   var foundNode = this.findNode(vizTree);
    //   if( foundNode === false){
    //     var parentNode = this.findNode(vizTree._parent);
    //     parentNode.addChild(vizTree);
    //   }else if( vizTree._children.length !== 0 ){
    //     for (var i = 0; i < vizTree._children.length; i++) {
    //       this._addNewNodes(vizTree._children[i]);
    //     }
    //   }
    // };
    // VizTree.prototype._removeOldNodes = function(vizTree){
    //   console.log(this.variables, vizTree.variables);
    //   var foundNode = vizTree.findNode(this);
    //   if( foundNode === false){
    //     console.log('deleting: ', this);
    //     var parentNode = this._parent;
    //     parentNode.remove(this);
    //     console.log('sad parent: ', parentNode);
    //   }else if( foundNode._children.length === 1 ){
    //     var newThis = this.findNode(foundNode._children[0]);
    //     newThis._removeOldNodes(vizTree);
    //     // for (var i = 0; i < this._children.length; i++) {
    //     //   var newThis = this._children[i];
    //     //   newThis._removeOldNodes(vizTree);
    //     // }
    //   }
    // };
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
    VizTree.prototype.remove = function(vizTree){
      var parent = vizTree._parent;
      parent._children = _.difference(parent._children, [vizTree]);
      return vizTree;
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
      var stateStack = window.myInterpreter.stateStack;
      if(window.myInterpreter.getScope() === undefined){
        return;
      }
      var newScope = new VizTree(window.myInterpreter.getScope());
      if(this.masterTree === null){
        this.masterTree = newScope.getRoot();
      }else{
        //add new nodes
        this.masterTree.add(newScope);
        //remove old nodes
        // jsiDiffNodes = _.difference(oldFlattened, newFlattened);
        // for (i = 0; i < jsiDiffNodes.length; i++) {
        //   this.remove(new VizTree(jsiDiffNodes[i]));
        // }
        this.masterTree.updateVariables(newScope.getRoot());
      }
      this.highlightActiveScope();
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
