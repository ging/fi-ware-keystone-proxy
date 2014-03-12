Installation
===================

Keystone implementation for OAuth2 compatibility in FI-WARE

- Software requirements:

	+ nodejs 
	+ npm
	+ Note: Both can be installed from (http://nodejs.org/download/)
	+ mysql
	
- Clone repository:

<pre>
git clone https://github.com/ging/fi-ware-keystone-proxy.git
</pre>


- Clone config.js.template in config.js and fill it. 

- Install the dependencies:

<pre>
cd fi-ware-keystone-proxy/
npm install
</pre>

- Populate de DB

<pre>
node ./populate_db.js
</pre>

- Start server

<pre>
sudo node server
</pre>
