var TokenDB = (function() {
	var authDataBase = {};

	var generateToken = function () {
	    return require('crypto').randomBytes(16).toString('hex');
	};

	var create = function(access_token, tenant, isAdmin) {
		var token = generateToken();
		set(token, {access_token: access_token, tenant: tenant, isAdmin: isAdmin});
		return token;
	};
	
	var list = function() {
		return authDataBase;
	}

	var get = function(item) {
		return authDataBase[item];
	};

	var set = function(item, data) {
		authDataBase[item] = data;
	};

	var search = function(access_token, tenant) {
		var token;
		for (var t in list()) {
            if (get(t).access_token === access_token && get(t).tenant === tenantId) {
                token = t;
                console.log('[TOKEN AUTH] Getting existing token user', access_token, 'and tenant ', tenantId, 'token: ', token);
                break;
            }
        }
        return token;
	};

	return {
		create: create,
		get: get,
		set: set,
		list: list,
		search: search
	}
})();

exports.TokenDB = TokenDB;