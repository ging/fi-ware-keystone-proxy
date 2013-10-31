var config = require('../config.js'),
	proxy = require('../HTTPClient.js');

var IDM = (function() {
	
	// Private variables
	var credentialsDigest = new Buffer(config.client_id+":"+config.client_secret).toString('base64');
	var idmHostName = config.accountServer;

	// Public functions
	var authenticate = function (username, password, callback, callbackError) {

	    // Llamar al IDM
	    var options = {
	        host: idmHostName,
	        path: '/oauth2/token',
	        method: 'POST',
	        headers: {  "Content-Type": "application/x-www-form-urlencoded",
	                    "Authorization": "Basic " + credentialsDigest}
	    };

	    var data="grant_type=password&username=" + username + "&password=" + password;

	    proxy.sendData("https", options, data, undefined, function (status, resp) {

	        var resp1 = JSON.parse(resp);

	        callback(status, resp1["access_token"]);

	    }, callbackError);

	};

	var getUserData = function (access_token, callback, callbackError) {

	    // Llamar al IDM

	    var options = {
	        host: idmHostName,
	        port: 443,
	        path: '/user?access_token=' + access_token,
	        method: 'GET',
	        headers: {}
	    };

	    proxy.sendData("https", options, undefined, undefined, function (status, resp) {

	        var resp1 = JSON.parse(resp);
	        //console.log("Response from IDM: ", resp);

	        if (resp1 !== null) {

	            for (var orgIdx in resp1.organizations) {
	                var org = resp1.organizations[orgIdx];
	                org.id = org.actorId;
	                org.name = org.displayName;
	            }

	            var myOrg = {
	                   id: resp1.actorId,
	                   name: resp1.nickName,
	                   roles: [
	                            {"id": "8db87ccbca3b4d1ba4814c3bb0d63aab", "name": "Member"}
	                            //{"id": "09e95db0ea3f4495a64e95bfc64b0c55", "name": "admin"}
	                        ]
	                };

	            if (resp1.organizations === undefined) {
	                resp1.organizations = [];
	            };

	            resp1.organizations.push(myOrg);
	        } else {
	            resp1 = {organizations:{}};
	        }

	        callback(status, resp1);

	    }, callbackError);

	}

	return {
		authenticate: authenticate,
		getUserData: getUserData
	}

})();
exports.IDM = IDM;