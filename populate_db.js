var config = require("./config.js");
var mysql = require('mysql');

var connection = mysql.createConnection({
  	host     : 'localhost',
  	user     : 'root',
  	password : 'root'
});

console.log('--- Checking mysql data schemas ---');

connection.connect();

connection.query('SHOW DATABASES LIKE "keystone_proxy"', function(err, rows, fields) {
	if (err) throw err;

	if (rows.length === 0) {
		console.log('- Creating mysql data schemas');
		connection.query('CREATE database keystone_proxy', function(err, rows, fields) {
			if (err) throw err;

			console.log('- Database keystone_proxy created');

			connection.query('USE keystone_proxy', function(err, rows, fields) {
				if (err) throw err;

				console.log('- Database changed to keystone_proxy');

				connection.query('CREATE TABLE token (token VARCHAR(64) not null primary key,tenant VARCHAR(64),name VARCHAR(128), access_token VARCHAR(128))', function(err, rows, fields) {
					if (err) throw err;

					console.log('- Table token created');
					console.log('--- DONE ---');
				});
				connection.end();
			});	
		});
	} else {
		console.log('- Mysql data schemas already exist');
		console.log('--- DONE ---');
		connection.end();
	}
});