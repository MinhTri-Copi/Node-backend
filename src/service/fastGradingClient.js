/**
 * PHA D - Fast Grading Client
 * Client để gọi Python FastAPI ML Grading Service
 */

const FAST_GRADING_URL = process.env.FAST_GRADING_URL || 'http://127.0.0.1:8000';

/**
 * Chấm bài bằng ML model (nhanh hơn LLM)
 * 
 * @param {Array} items - Array of { correctAnswer, studentAnswer, maxScore }
 * @returns {Promise<Array>} Array of { score, ratio }
 */
export async function gradeWithFastModel(items) {
    try {
        if (!items || items.length === 0) {
            return [];
        }

        // Create AbortController for timeout (tương thích với Node.js cũ)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(`${FAST_GRADING_URL}/grade`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ items }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Fast grading service error: ${response.status} - ${errorText}`);
            throw new Error(`Fast grading service failed: ${response.status}`);
        }

        const data = await response.json();
        return data.results || []; // [{score, ratio}, ...]

    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('❌ Fast grading service timeout');
            throw new Error('Fast grading service timeout');
        }
        console.error('❌ Error calling fast grading service:', error.message);
        throw error;
    }
}

/**
 * Health check fast grading service
 */
export async function checkFastGradingHealth() {
    try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(`${FAST_GRADING_URL}/health`, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        return data.status === 'ok' && data.model_loaded && data.embedder_loaded;

    } catch (error) {
        console.warn('⚠️ Fast grading service không khả dụng:', error.message);
        return false;
    }
}

