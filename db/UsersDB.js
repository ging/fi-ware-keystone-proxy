var	config = require("../config.js");

var UsersDB = (function() {
	var usersDataBase = config.adminUsers || {};
	
	var list = function() {
		return usersDataBase;
	}

	var get = function(item) {
		return usersDataBase[item] || {};
	};

	var set = function(item, data) {
		usersDataBase[item] = data;
	};
	return {
		get: get,
		set: set,
		list: list
	}
})();

exports.UsersDB = UsersDB;