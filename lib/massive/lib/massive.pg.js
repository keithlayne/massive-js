var pg = require("pg");
var _ = require("underscore")._;
var util = require("util");
var events = require("events");
var massiveQuery = require("./massive.query");

//default it, cause we're nice

var Client = function(){
  var _connectionString = "tcp://postgres@localhost/postgres";
  events.EventEmitter.call(this);
};

util.inherits(Client,events.EventEmitter);

Client.prototype.connect = function(connection) {
  console.log("Setting connection to " + connection);
  _connectionString = connection;
};

Client.prototype.stream = function(query) { 
  pg.connect(_connectionString, function(err,db){
    if(err) throw err;
    var dbQuery = db.query(query.sql, query.params);
    dbQuery.on("error", function(err){
      query.emit("error", err);
    });

    dbQuery.on("row", function(row){
      query.emit("row",row);
    });

    //make sure we close off the connection
    dbQuery.on('end', function(){
      db.end.bind(db);
      query.emit("end", this);
    });
  });
};
Client.prototype.run = function(sql,params){
  return new massiveQuery(sql,params);
};
Client.prototype.find = function(query){
    
  pg.connect(_connectionString, function(err,client){
    client.query(query.sql, query.params,function(err,result){
      if(err) query.emit("error", err);
      else query.emit("ready", result.rows);
    });
  });

};
Client.prototype.single = function(query){
    
  pg.connect(_connectionString, function(err,client){
    client.query(query.sql, query.params,function(err,result){
      if(err) query.emit("error", err);
      else {
        var result = null;
        if(result.rows.length > 0){
          result = result.rows[0];
        }
        query.emit("ready", result);
      } 
    });
  });

};
Client.prototype.execute = function(query,callback) {
  pg.connect(_connectionString, function(err,client){
    client.query(query.sql, query.params , function(err,result){
      if(err) query.emit("error", err);
      else query.emit("executed",result);
    });
  });

};


var _translateType = function(typeName) { 
  var _result = typeName;
  
  switch(typeName){
    case "pk" :
      _result ="serial PRIMARY KEY";
      break;
    case "money" : 
      _result ="decimal(8,2)";
      break;
    case "date" : 
      _result = "timestamptz";
      break;
    case "string" : 
      _result ="varchar(255)";
      break;
    case "search" : 
      _result ="tsvector";
      break;
    case "int" : 
      _result ="int4";
      break;
  }
  return _result;
}

var _containsPK = function(columns) {
  return _.any(columns.values,"pk");
}

Client.prototype.dropTable = function(tableName) { 
  return new massiveQuery("DROP TABLE IF EXISTS " + tableName + ";");
}

Client.prototype.createTable = function(tableName, columns) {
  
  var _sql ="CREATE TABLE " + tableName + "(";
  var _cols = [];

  //force a PK
  if(!_containsPK(columns)){
    columns.id = "pk";
  }

  for(var c in columns){

    if(c == "timestamps"){
      _cols.push("created_at timestamptz not null default 'now'");
      _cols.push("updated_at timestamptz not null default 'now'");
    }else{
      var colName = c;
      var colParts = columns[c].split(" ");
      var colType = colParts[0];
      var translated = _translateType(colType);
      var extras = _.without(colParts,colType).join(" ");
      var declaration = colName + " " + translated + " " + extras; 
      //console.log(declaration);
      _cols.push(declaration);

    }

  }

  _sql+= _cols.join(",") + ");";
  //console.log(_sql);
  return new massiveQuery(_sql);
};



module.exports = new Client();

