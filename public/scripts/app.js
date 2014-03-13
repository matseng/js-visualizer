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

    $scope.nextIsFuncDef = false;
    $scope.thisNodeType = '', $scope.nextNodeType = '';
    $scope.stepButton = function() {
      var node, start, end, ok;
      if (myInterpreter.stateStack[0]) {
        $scope.thisNodeType = $scope.nextNodeType;
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
      // console.log($($scope.editor.renderer.content));
      $scope.editor.session.clearBreakpoints();
      var startRow = $scope.editor.getSelection().getRowColumnIndices(start).row;
      var endRow = $scope.editor.getSelection().getRowColumnIndices(end).row;
      $scope.editor.session.setBreakpoint([startRow]);
      try {
        $scope.editor.getSession().removeMarker($scope.markerID);
        ok = myInterpreter.step();
        if ($scope.nextIsFuncDef === true) {
          // var $lines = $($scope.editor.renderer.content)[0].childNodes[1].childNodes[2];


          var $lines = $($scope.editor.renderer.$textLayer.element.childNodes);
          for (var i = startRow+1; i < endRow; i++) {
            $($scope.editor.renderer.$textLayer.element.childNodes[i]).addClass('ace_dimmer');
            $($scope.editor.renderer.$textLayer.element.childNodes[i].children).addClass('ace_dimmer');
          }
          console.log($lines);
          // dimFunctionBody(start,end);
          // text = $scope.editor.getValue();
          // console.log(start, end, text, text.slice(start, end));
          // var range = $scope.editor.getSelection().makeRangeBtwnRows(start,end);
          // $scope.markerID = $scope.editor.getSession().addMarker(range, 'ace_dimmer', 'text', true);
          $scope.nextIsFuncDef = false;
        }
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


    var dimFunctionBody = function(start, end) {

      // $scope.editor.getSelection().addClass('ace_comment');

      // $scope.editor.setSelectionStyle('.ace_comment');

      // var cursor = $scope.editor.getSelection().getRowColumnIndices(end-2);
      // console.log($scope.editor.getSelection().getCursor());
      // var programString = $scope.editor.getValue();
      // var functionString = programString.slice(start,end+1);
      // var leftCurlyBrace = functionString.indexOf('\{');
      // // console.log(leftCurlyBrace, programString[start+leftCurlyBrace]);
      // var rightCurlyBrace = functionString.lastIndexOf('\}');
      // // console.log(rightCurlyBrace, programString[start+rightCurlyBrace]);


      // var range = $scope.editor.getSelection().makeRangeBtwnRows(start,end-1);
      // $scope.editor.toggleBlockCommentDim(range);
      $scope.editor.toggleBlockComment();

      // var regexp = /\{[\s\S]*\}/;
      // var functionString = $scope.editor.getValue().slice(start,end-1);
      // var toDim = functionString.match(regexp)[0].slice(1);
      // var functionStringArray = functionString.split("\n");
      // console.log(toDim);
      // var toDimArray = toDim.split('\n');
      // console.log(toDimArray.length);
      // for (var i = 0; i < toDimArray.length; i++) {
        // console.log("'" + toDimArray[i] + "'");
      // }
      // var toDim2 = toDim.replace(/\n/g, "[\s\S]");
      // toDim = toDim2.replace(/\;/g, "\\;");
      // var toDim3 = toDim.replace(/\}/g, "\\}");
      // console.log(toDim2, toDim, toDim3);
      // $scope.editor.getSession().setMode("ace/mode/js2");     
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
      $scope.editor.session.clearBreakpoints();
      $scope.editor.clearSelection();
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
        }else if(properties[key] === undefined || properties[key].data === undefined){
          variables[key] = "undefined";
        }else if(properties[key].type === "object"){
          variables[key] = "{}";
        }else if(properties[key].type === "function"){
          variables[key] = "function(){}";
        }else if(properties[key].data === Infinity){
          variables[key] = "Infinity";
        }
        else{
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
    VizTree.prototype.removeSubtree = function(vizTree){
      var parent = vizTree._parent;
      parent._children = _.difference(parent._children, [vizTree]);
      return vizTree;
    };
    VizTree.prototype.updateVariables = function(vizTree){
      var newNames = Object.keys(vizTree.variables);
      var oldVariables = _.pick(this.variables, newNames);
      this.variables = _.extend(oldVariables, vizTree.variables);
      for (var i = 0; i < this._children.length && i < vizTree._children.length; i++) {
        this._children[i].updateVariables(vizTree._children[i]);
      }
    };
    VizTree.prototype._addNewNodes = function(vizTree){
      var foundNode = this.findNode(vizTree);
      if( foundNode === false){
        var parentNode = this.findNode(vizTree._parent);
        parentNode.addChild(vizTree);
      }else if( vizTree._children.length !== 0 ){
        for (var i = 0; i < vizTree._children.length; i++) {
          this._addNewNodes(vizTree._children[i]);
        }
      }
    };
    VizTree.prototype._removeOldNodes = function(vizTree){
      var foundNode = vizTree.findNode(this);
      if( foundNode === false){
        console.log('deleting: ', this);
        var parentNode = this._parent;
        parentNode.removeSubtree(this);
        console.log('sad parent: ', parentNode);
      }else if( vizTree._children.length !== 0 ){
        for (var i = 0; i < this._children.length; i++) {
          var newThis = this._children[i];
          newThis._removeOldNodes(vizTree);
        }
      }
    };
    VizTree.prototype.merge = function(vizTree){
      this._addNewNodes(vizTree);
      this.updateVariables(vizTree);
      this._removeOldNodes(vizTree);
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
    this.updateScopeViz = function(){
      var stateStack = window.myInterpreter.stateStack;
      var tempTree = new VizTree(window.myInterpreter.getScope());
      tempTree = tempTree.getRoot();
      if(tempTree === undefined){
        return;
      }
      if(this.masterTree === null){
        this.masterTree = tempTree;
      }else{
        this.masterTree.merge(tempTree);
      }
      window.masterTree = this.masterTree;
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
      // scope.editor.setOptions({
      //   enableBasicAutocompletion: true,
      //   enableSnippets: true
      // });
    }
  });
