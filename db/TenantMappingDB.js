var config = require("../config.js");
var connection = require("./Connection.js").Connection;

var TenantMappingDB = (function() {
	var tenantsMapping = {};

	if (config.tenant_maping_required) {

	    connection.query('SELECT * FROM tenant', function(err, rows, fields) {
			if (err) throw err;

			for (var i in rows) {
				if (rows[i].idm_id !== null) {
				    tenantsMapping[rows[i].idm_id] = {id:rows[i].id, name: rows[i].name};
				}
			}
			console.log('Tenant Mapping : ', tenantsMapping);
	    });
	}
	
	var list = function() {
		return tenantsMapping;
	}

	var get = function(item) {
		var id;
		if (tenantsMapping[item]) {
			id = tenantsMapping[item].id;
		}
		return id;
	};

	var getFromName = function(item) {
		for (var i in tenantsMapping) {
			var tenant = tenantsMapping[i];
			if (tenant.name === item) {
				return tenant.id;
			}
		}
		return;
	};

	var set = function(item, data) {
		tenantsMapping[item] = {id:data};
	};
	return {
		get: get,
		getFromName: getFromName,
		set: set,
		list: list
	}
})();

exports.TenantMappingDB = TenantMappingDB;