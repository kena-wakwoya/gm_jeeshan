const axios = require('axios');
const AppError = require('../utils/AppError'); // Custom error class

class CaptchaService {
    // Constants for 2Captcha interaction
    static API_BASE_URL = 'https://2captcha.com';
    static INITIAL_POLLING_DELAY_MS = 15 * 1000; // 15 seconds
    static POLLING_INTERVAL_MS = 5 * 1000;      // 5 seconds
    static MAX_POLLING_ATTEMPTS = 10;           // Max 10 attempts after initial delay

    /**
     * Solves a CAPTCHA using the 2Captcha API.
     * This directly maps to your PHP `solveCaptcha` method.
     * @param {string} type - The CAPTCHA type (e.g., 'recaptcha_v2', 'recaptcha_v3', 'hcaptcha').
     * @param {string} sitekey - The site key of the CAPTCHA.
     * @param {string} pageurl - The URL of the page where the CAPTCHA is located.
     * @param {string} apiKey - Your 2Captcha API key.
     * @returns {Promise<string>} The solved CAPTCHA token.
     * @throws {AppError} If the CAPTCHA type is unsupported, 2Captcha API fails, or CAPTCHA is not solved within limits.
     */
    async solveCaptcha(type, sitekey, pageurl, apiKey) {
        if (!apiKey) {
            throw new AppError('2Captcha API key is missing.', 400);
        }

        const methodMap = {
            'recaptcha_v2': 'userrecaptcha',
            'recaptcha_v3': 'userrecaptcha&version=3', // Note: v3 might need action & data-s params
            'hcaptcha': 'hcaptcha'
        };

        const method = methodMap[type];
        if (!method) {
            throw new AppError(`Unsupported CAPTCHA type: ${type}`, 400);
        }

        let taskId = null;
        try {
            // Step 1: Submit CAPTCHA
            const submitUrl = `${CaptchaService.API_BASE_URL}/in.php?key=${apiKey}&method=${method}&googlekey=${sitekey}&pageurl=${encodeURIComponent(pageurl)}&json=1`;
            console.log(`Submitting CAPTCHA to 2Captcha: ${submitUrl}`); // Log URL without exposing API key
            const submitResponse = await axios.get(submitUrl);
            const submitData = submitResponse.data;

            if (submitData.status !== 1) {
                throw new AppError(`2Captcha submission failed: ${submitData.request || 'Unknown error'}`, 500);
            }
            taskId = submitData.request;
            console.log(`CAPTCHA submitted successfully. Task ID: ${taskId}`);

        } catch (error) {
            if (error instanceof AppError) throw error; // Re-throw if already a custom error
            throw new AppError(`Failed to submit CAPTCHA to 2Captcha: ${error.message}`, error.response ? error.response.status : 500);
        }

        // Step 2: Poll for CAPTCHA result
        await new Promise(resolve => setTimeout(resolve, CaptchaService.INITIAL_POLLING_DELAY_MS)); // Initial wait

        for (let i = 0; i < CaptchaService.MAX_POLLING_ATTEMPTS; i++) {
            const getResultUrl = `${CaptchaService.API_BASE_URL}/res.php?key=${apiKey}&action=get&id=${taskId}&json=1`;
            console.log(`Polling 2Captcha for result (attempt ${i + 1}/${CaptchaService.MAX_POLLING_ATTEMPTS})...`);

            try {
                const getResultResponse = await axios.get(getResultUrl);
                const resultData = getResultResponse.data;

                console.log("2Captcha polling response:", resultData);

                if (resultData.status === 1) {
                    console.log(`CAPTCHA solved: ${resultData.request}`);
                    return resultData.request; // Return the solved token
                }

                if (resultData.request !== 'CAPCHA_NOT_READY') {
                    throw new AppError(`2Captcha polling error: ${resultData.request || 'Unknown error'}`, 500);
                }

                // If CAPTCHA_NOT_READY, wait and retry
                await new Promise(resolve => setTimeout(resolve, CaptchaService.POLLING_INTERVAL_MS));

            } catch (error) {
                if (error instanceof AppError) throw error; // Re-throw if already a custom error
                throw new AppError(`Failed to poll 2Captcha for result: ${error.message}`, error.response ? error.response.status : 500);
            }
        }

        // If loop completes without returning, it means max retries reached
        throw new AppError('CAPTCHA not solved within allowed time/retries.', 504); // 504 Gateway Timeout
    }
}

module.exports = new CaptchaService();