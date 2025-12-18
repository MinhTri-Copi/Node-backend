/**
 * CV Matching Client
 * Client để gọi Python FastAPI ML CV Matching Service
 */

const ML_SERVICE_URL = process.env.FAST_GRADING_URL || 'http://127.0.0.1:8000';

/**
 * Match CV với danh sách JD bằng ML model
 * 
 * @param {string} cvText - CV text của ứng viên
 * @param {Array<string>} jdTexts - List các JD texts cần match
 * @returns {Promise<Array>} Array of { jdIndex, matchScore, scoreRatio } (sorted by scoreRatio desc)
 */
export async function matchCVWithML(cvText, jdTexts) {
    try {
        if (!cvText || !jdTexts || jdTexts.length === 0) {
            return [];
        }

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout (CV matching có thể lâu hơn)

        const response = await fetch(`${ML_SERVICE_URL}/match-cv`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
                cvText,
                jdTexts 
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ CV Matching service error: ${response.status} - ${errorText}`);
            throw new Error(`CV Matching service failed: ${response.status}`);
        }

        const data = await response.json();
        return data.matches || []; // [{jdIndex, matchScore, scoreRatio}, ...]

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('❌ CV Matching service timeout');
            throw new Error('CV Matching service timeout');
        }
        console.error('❌ Error calling CV Matching service:', error.message);
        throw error;
    }
}

/**
 * Health check CV Matching service
 */
export async function checkCVMatchingHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(`${ML_SERVICE_URL}/health`, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        return data.status === 'ok';

    } catch (error) {
        console.warn('⚠️ CV Matching service không khả dụng:', error.message);
        return false;
    }
}

