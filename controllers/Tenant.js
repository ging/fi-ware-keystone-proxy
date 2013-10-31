var IDM = require("../lib/IDM.js").IDM,
	TokenDB = require("../db/TokenDB.js").TokenDB,
	config = require("../config.js");

var Tenant = (function() {

	var list = function(req, res) {
	    console.log('[GET TENANTS] Get tenants for token: ', req.headers['x-auth-token']);

	    var oauth_token;

	    if (TokenDB.get(req.headers['x-auth-token'])) {
	        oauth_token = TokenDB.get(req.headers['x-auth-token']).access_token;
	    }

	    if (oauth_token === undefined) {
	    	oauth_token = TokenDB.get(req.headers['x-auth-token']);
	    }

	    console.log('[GET TENANTS] Get user info for oauth_token: ', oauth_token);

	    if (oauth_token) {
	        IDM.getUserData(oauth_token, function (status, resp) {

		        console.log('[GET TENANTS] User access-token OK');
		        var tenants = [];
		        for (var orgIdx in resp.organizations) {
		            if (resp.organizations.hasOwnProperty(orgIdx)) {
		                  var org = resp.organizations[orgIdx];
		                  var tenant = {
		                    enabled: true,
		                    id: org.id,
		                    name: org.name,
		                    description: org.description
		                  }
		                  tenants.push(tenant);
		           }
		        }
		        
		        var orgs = JSON.stringify({tenants:tenants});

		        if (req.headers['accept'] === 'application/xml') {
		            orgs = xmlParser.json2xml_str({tenants:tenants});
		        }
		        res.send(orgs);

		    }, function (status, e) {
		        if (status === 200) {
		            res.send(200, "{}");
		        } else if (status === 401) {

		        	// It can be an admin user.
					if(TokenDB.get(req.headers['x-auth-token'])) {
			        	// It's a privileged user
				    	if (TokenDB.get(req.headers['x-auth-token']).isAdmin) {
							var tenants = [{
								enabled: true,
								id: TokenDB.get(req.headers['x-auth-token']).tenant,
								name: TokenDB.get(req.headers['x-auth-token']).tenant,
								description: "Admin access"
							}];
							res.send(200, JSON.stringify({tenants:tenants}));
				    	} else {
				    		res.send(200, '{"tenants": []}');
				    	}
				    } else {
				    	console.log('[GET TENANTS] User token not authorized');
		            res.send(401, 'User token not authorized');	
				    }
		            
		        } else {
		            console.log('[GET TENANTS] Error in IDM communication ', e);
		            res.send(503, 'Error in IDM communication');
		        }
		    });
	    } else {
	    	console.log('[GET TENANTS] User token not authorized');
		    res.send(401, 'User token not authorized');
	    }

	    
	};
	return {
		list: list
	}
})();

exports.Tenant = Tenant;