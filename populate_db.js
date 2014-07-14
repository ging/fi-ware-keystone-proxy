var config = require("./config.js");
var mysql = require('mysql');

var connection = mysql.createConnection({
  	host     : config.db.host,
  	user     : config.db.user,
  	port	 : config.db.port,
  	password : config.db.password
});

console.log('--- Checking mysql data schemas ---');

connection.connect();

var createTable = function() {
	connection.query('USE ' + config.db.database + '', function(err, rows, fields) {
		if (err) throw err;

		console.log('- Database changed to ' + config.db.database);

		connection.query('CREATE TABLE token (token VARCHAR(64) not null primary key,tenant VARCHAR(64),name VARCHAR(128), access_token VARCHAR(128), expires DATETIME)', function(err, rows, fields) {

			if (err) {
				console.log('- Table ' + config.db.database + ' already exists.');
			} else {
				console.log('- Table token created');
				console.log('--- DONE ---');
			}
		});

		connection.end();
	});
};

var createDatabase = function() {
	connection.query('CREATE database ' + config.db.database, function(err, rows, fields) {
		if (err) throw err;

		console.log('- Database ' + config.db.database + ' created');
		createTable();
	});
};

connection.query('SHOW DATABASES LIKE "' + config.db.database + '"', function(err, rows, fields) {
	if (err) throw err;

	if (rows.length === 0) {
		console.log('- Creating mysql database');
		createDatabase();
	} else {
		createTable();
	}
});