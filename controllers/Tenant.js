var IDM = require("../lib/IDM.js").IDM,
	TokenDB = require("../db/TokenDB.js").TokenDB,
	TenantMappingDB = require("../db/TenantMappingDB.js").TenantMappingDB,
	config = require("../config.js");

var Tenant = (function() {

	var pad = function(number, length) {

	    var str = '' + number;
	    while (str.length < length) {
	        str = '0' + str;
	    }

	    return str;

	};

	var getKeystoneTenant = function (tenantId) {

	    if (TenantMappingDB.get(tenantId)) {
	        return TenantMappingDB.get(tenantId);
	    } else {
	        return pad(tenantId, 32);
	    }
	};

	var list = function(req, res) {
	    console.log('[GET TENANTS] Get tenants for token: ', req.headers['x-auth-token']);

	    var oauth_token;

	    TokenDB.get(req.headers['x-auth-token'], function (tok) {
	    	if (tok) {
	        	oauth_token = tok.access_token;
		    }

		    if (oauth_token === undefined) {
		    	oauth_token = req.headers['x-auth-token'];
		    }
		    console.log("tok", tok, "oauth_token", oauth_token);
		    
		    if (oauth_token) {
		        IDM.getUserData(oauth_token, function (status, resp) {

			        console.log('[GET TENANTS] User access-token OK');
			        var tenants = [];
			        for (var orgIdx in resp.organizations) {
			            if (resp.organizations.hasOwnProperty(orgIdx)) {
			                  var org = resp.organizations[orgIdx];
			                  var tenant = {
			                    enabled: true,
			                    id: getKeystoneTenant(org.id),
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
						if(tok) {
				        	// It's a privileged user
					    	if (tok.isAdmin) {
								var tenants = [{
									enabled: true,
									id: getKeystoneTenant(tok.tenant),
									name: tok.tenant,
									description: "Admin access"
								}];
								res.send(200, JSON.stringify({tenants:tenants}));
					    	} else {
					    		res.send(200, '{"tenants": []}');
					    	}
					    } else {
					    	console.log('[GET TENANTS] User token not authorized 1');
			            res.send(401, 'User token not authorized');	
					    }
			            
			        } else {
			            console.log('[GET TENANTS] Error in IDM communication ', e);
			            res.send(503, 'Error in IDM communication');
			        }
			    });
		    } else {
		    	console.log('[GET TENANTS] User token not authorized 2');
			    res.send(401, 'User token not authorized');
		    }


	    });
	};
	return {
		list: list
	}
})();

exports.Tenant = Tenant;