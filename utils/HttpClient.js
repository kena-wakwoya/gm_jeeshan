const axios = require('axios');
const HttpsProxyAgent = require('https-proxy-agent');

class HttpClient {
    async sendRequest(url, method, headers = {}, data = {}, proxyAddress = null) {
        const config = {
            method,
            url,
            headers,
            validateStatus: () => true, // Don't throw for 4xx/5xx responses, we want to check http_code
            timeout: 15000 // 15 seconds timeout
        };

        if (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT') {
            config.data = data;
        }

        if (proxyAddress) {
            try {
                // HttpsProxyAgent expects full URL, e.g., 'http://user:pass@ip:port'
                config.httpsAgent = new HttpsProxyAgent.HttpsProxyAgent(proxyAddress);
            } catch (e) {
                console.error("Invalid proxy address for HttpsProxyAgent:", proxyAddress, e.message);
                // Depending on strictness, you might throw an error or proceed without proxy
            }
        }
        console.log("this is the configuration")
        console.log(config)
        try {
            const response = await axios(config);
            return {
                response: response.data,
                http_code: response.status,
                error: null
            };
        } catch (error) {
            return {
                response: null,
                http_code: error.response ? error.response.status : 0, // 0 for network/timeout errors
                error: error.message
            };
        }
    }
}

module.exports = new HttpClient();