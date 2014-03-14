angular.module('ScopeTree', ['Tree'])
  .factory("ScopeTree", ['Tree', function(Tree){
    var ScopeTree = function(jsiScope){
      Tree.apply(this, arguments);
      this._scope = jsiScope;
      //find scope name
      var getScopeName = function(jsiStateStack){
        var name = "";
        for (var i = 0; i < jsiStateStack.length; i++) {
          if (jsiStateStack[i].scope === jsiScope) {
            break;//jsiScope =  jsiStateStack[i].scope;
          }
        }
        if(jsiStateStack[i+1]){
          name = jsiStateStack[i+1].node.callee.name;
        }else{
          name = 'Global';
        }
        return name;
      }
      this.name = getScopeName(window.myInterpreter.stateStack);
      this.variables = {};
      this.highlights = {};
      stringifyProperties(this.variables, jsiScope.properties);
      if(jsiScope.parentScope){
        this._parent = new ScopeTree(jsiScope.parentScope);
        this._parent._children.push(this);
      }
    };
    ScopeTree.prototype = Object.create(Tree.prototype);
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
    ScopeTree.prototype.removeDescendant = function(tree){
      var validator = function(a,b){return a._scope === b._scope;};
      return Tree.prototype.removeDescendant.call(this, tree, validator);
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
  }]);