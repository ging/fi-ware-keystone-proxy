var config = require("../config.js");

var TenantMappingDB = (function() {
	var tenantsMapping = {};

	if (config.db) {

	    var mysql = require('mysql');
	    var connection = mysql.createConnection(config.db);

	    connection.connect();

	    connection.query('SELECT * FROM tenant', function(err, rows, fields) {
	      if (err) throw err;

	      for (var i in rows) {
	        if (rows[i].idm_id !== null) {
	            tenantsMapping[rows[i].idm_id] = rows[i].id;
	        }
	      }

	      console.log('VA : ', tenantsMapping);
	      
	    });

	    connection.end();
	}
	
	var list = function() {
		return tenantsMapping;
	}

	var get = function(item) {
		return tenantsMapping[item];
	};

	var set = function(item, data) {
		tenantsMapping[item] = data;
	};
	return {
		get: get,
		set: set,
		list: list
	}
})();

exports.TenantMappingDB = TenantMappingDB;