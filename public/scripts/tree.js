angular.module('Tree', [])
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
  });
