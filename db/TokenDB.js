var connection = require("./Connection.js").Connection;

var TokenDB = (function() {

    var generateToken = function () {
        return require('crypto').randomBytes(16).toString('hex');
    };

    var create = function(access_token, tenant, name, callback) {
        var token = generateToken();
        console.log("Saving token", token, "with access_token", access_token, "with tenant", tenant, "and name", name);
        set(token, access_token, tenant, name, callback);
    };
    
    var list = function(callback) {
        var q = 'SELECT * FROM token';
        connection.query(q, function(err, rows, fields) {
            if (err) callback(undefined);
            var result = {};
            for (var r in rows) {
                result[rows[r].token] = rows[r];
            }
            callback(result);
        });
    }

    var get = function(item, callback) {
        var q = 'SELECT * FROM token WHERE token = ' + connection.escape(item);
        connection.query(q, function(err, rows, fields) {
            if (err) callback(undefined);
            callback(rows[0]);
        });
    };

    var set = function(token, tenant, name, access_token, callback) {
        var q = 'INSERT INTO token (token, tenant, name, access_token) VALUES (' + 
            connection.escape(token) + ', ' + 
            connection.escape(tenant) + ', ' + 
            connection.escape(name) + ', ' + 
            connection.escape(access_token) + ')';

        connection.query(q, function(err, rows, fields) {
            if (err) callback(undefined);
            callback(token);
        });
    };

    var remove = function(token, callback) {
        var q = 'DELETE FROM token WHERE token = ' + connection.escape(token);

        connection.query(q, function(err, rows, fields) {
            if (err) callback(undefined);
            callback();
        });
    };

    var search = function(access_token, tenant, callback) {
        var token;
        list(function (token_list) {
            for (var t in token_list) {
                if (token_list[t].access_token === access_token && token_list[t].tenant === tenant) {
                    token = t;
                    console.log('[TOKEN AUTH] Getting existing token user', access_token, 'and tenant ', tenant, 'token: ', token);
                    callback(token);
                    return;
                }
            }
            callback(undefined);
        });
    };

    var searchByNameAndTenant = function(name, tenant, callback) {
        var token;
        list(function (token_list) {
            for (var t in token_list) {
                if (token_list[t].name === name && token_list[t].tenant === tenant) {
                    token = t;
                    console.log('[TOKEN AUTH] Getting existing token user', name, 'and tenant ', tenant, 'token: ', token);
                    callback(token);
                    return;
                }
            }
            callback(undefined);
        });
    };

    return {
        create: create,
        get: get,
        set: set,
        list: list,
        search: search,
        searchByNameAndTenant: searchByNameAndTenant,
        remove: remove
    }
})();

exports.TokenDB = TokenDB;