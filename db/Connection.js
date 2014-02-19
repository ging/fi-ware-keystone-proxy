var config = require("../config.js");

var Connection = (function() {

    var mysql = require('mysql');
    var connection = mysql.createConnection(config.db);

	connection.connect();

	return {
		connection: connection
	}
})();

exports.Connection = Connection.connection;