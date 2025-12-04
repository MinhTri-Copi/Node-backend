import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Polyfill fetch and FormData for Node.js < 18
// Try @whatwg-node/fetch first (better compatibility), fallback to node-fetch + form-data
if (typeof fetch === 'undefined' || typeof FormData === 'undefined') {
    try {
        // Try @whatwg-node/fetch (provides both fetch and FormData)
        const { fetch: whatwgFetch, FormData: WhatwgFormData, Headers: WhatwgHeaders, Request: WhatwgRequest, Response: WhatwgResponse } = require('@whatwg-node/fetch');
        global.fetch = whatwgFetch;
        global.FormData = WhatwgFormData;
        global.Headers = WhatwgHeaders;
        global.Request = WhatwgRequest;
        global.Response = WhatwgResponse;
        console.log('✅ Using @whatwg-node/fetch polyfill for fetch and FormData API');
    } catch (whatwgError) {
        // Fallback to node-fetch + form-data
        try {
            const nodeFetch = require('node-fetch');
            global.fetch = nodeFetch;
            global.Headers = nodeFetch.Headers;
            global.Request = nodeFetch.Request;
            global.Response = nodeFetch.Response;
            console.log('✅ Using node-fetch polyfill for fetch API');
            
            // Try to use FormData from @whatwg-node/fetch even if fetch failed
            try {
                const { FormData: WhatwgFormData } = require('@whatwg-node/fetch');
                global.FormData = WhatwgFormData;
                console.log('✅ Using @whatwg-node/fetch FormData polyfill');
            } catch (formDataError) {
                // Last resort: use form-data package
                const FormDataPolyfill = require('form-data');
                // Use form-data directly - OpenAI SDK should handle it
                global.FormData = FormDataPolyfill;
                console.log('✅ Using form-data polyfill for FormData API');
            }
        } catch (error) {
            console.error('❌ Failed to load fetch/FormData polyfills.');
            console.error('   Please install: npm install @whatwg-node/fetch');
            console.error('   Or: npm install node-fetch@2 form-data');
            console.error('   Or upgrade Node.js to version 18+ which has built-in fetch and FormData');
            process.exit(1);
        }
    }
}

// LM Studio server URL (mặc định: http://127.0.0.1:1234)
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://127.0.0.1:1234';
// For 8GB RAM CPU: Use qwen2.5-1.5b-instruct (balanced) or qwen2.5-0.5b-instruct (fastest)
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'qwen2.5-1.5b-instruct';

// Khởi tạo OpenAI client với baseURL trỏ đến LM Studio
const openai = new OpenAI({
    baseURL: LM_STUDIO_URL + '/v1',
    apiKey: 'lm-studio', // LM Studio không yêu cầu API key thật
    fetch: global.fetch, // Explicitly pass fetch
});

console.log('🚀 Bắt đầu test LM Studio Server...\n');
console.log(`📍 Server URL: ${LM_STUDIO_URL}`);
console.log(`🤖 Model: ${LM_STUDIO_MODEL}\n`);

/**
 * Helper function: Parse JSON từ response có reasoning tags
 * DeepSeek R1 models thường trả về reasoning trong <think> tags
 */
function parseJSONFromResponse(responseText) {
    if (!responseText) return null;
    
    let cleaned = responseText.trim();
    
    // Loại bỏ reasoning tags (DeepSeek R1 format) - nhiều pattern khác nhau
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/redacted_reasoning>/gi, '');
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/redacted_reasoning>/gi, '');
    
    // Loại bỏ markdown code blocks
    cleaned = cleaned.replace(/```json\n?/gi, '');
    cleaned = cleaned.replace(/```\n?/g, '');
    
    // Loại bỏ các dòng trống thừa
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n').trim();
    
    // Tìm JSON object trong text
    // Strategy 1: Tìm JSON object đầy đủ từ { đến }
    let firstBrace = cleaned.indexOf('{');
    let lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        // Extract JSON string
        let jsonString = cleaned.substring(firstBrace, lastBrace + 1);
        
        // Đếm số dấu ngoặc để đảm bảo JSON đầy đủ
        let openBraces = (jsonString.match(/{/g) || []).length;
        let closeBraces = (jsonString.match(/}/g) || []).length;
        
        // Nếu số dấu ngoặc khớp, thử parse
        if (openBraces === closeBraces) {
            try {
                const parsed = JSON.parse(jsonString);
                // Kiểm tra xem có phải là object hợp lệ với các field cần thiết không
                if (typeof parsed === 'object' && parsed !== null) {
                    return parsed;
                }
            } catch (error) {
                // Continue to next strategy
            }
        }
    }
    
    // Strategy 2: Tìm JSON trong từng dòng (cho trường hợp JSON bị chia nhỏ)
    const lines = cleaned.split('\n');
    let jsonLines = [];
    let inJson = false;
    let braceCount = 0;
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.includes('{') || inJson) {
            inJson = true;
            jsonLines.push(trimmed);
            braceCount += (trimmed.match(/{/g) || []).length;
            braceCount -= (trimmed.match(/}/g) || []).length;
            
            if (braceCount === 0 && trimmed.includes('}')) {
                // Đã tìm thấy JSON đầy đủ
                const jsonCandidate = jsonLines.join(' ').replace(/\s+/g, ' ');
                try {
                    const parsed = JSON.parse(jsonCandidate);
                    if (typeof parsed === 'object' && parsed !== null) {
                        return parsed;
                    }
                } catch (e) {
                    // Reset và thử lại
                    jsonLines = [];
                    inJson = false;
                    braceCount = 0;
                }
            }
        }
    }
    
    // Strategy 3: Tìm pattern JSON đơn giản trong toàn bộ text
    const jsonMatch = cleaned.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (typeof parsed === 'object' && parsed !== null) {
                return parsed;
            }
        } catch (e) {
            // Ignore
        }
    }
    
    return null;
}

/**
 * Test 1: Kiểm tra danh sách models
 */
async function testListModels() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TEST 1: Lấy danh sách models');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    try {
        const models = await openai.models.list();
        console.log('✅ Kết nối thành công!');
        console.log(`📦 Số lượng models: ${models.data.length}\n`);
        
        models.data.forEach((model, index) => {
            console.log(`${index + 1}. ${model.id}`);
        });
        
        console.log('\n');
        return true;
    } catch (error) {
        console.error('❌ Lỗi khi lấy danh sách models:');
        console.error(`   ${error.message}\n`);
        return false;
    }
}

/**
 * Test 2: Test chat completion đơn giản
 */
async function testSimpleChat() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💬 TEST 2: Chat completion đơn giản');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    try {
        const startTime = Date.now();
        
        const completion = await openai.chat.completions.create({
            model: LM_STUDIO_MODEL,
            messages: [
                { role: 'user', content: 'Xin chào! Bạn có thể giới thiệu về bản thân không?' }
            ],
            temperature: 0.7,
            max_tokens: 150,
        });
        
        const duration = Date.now() - startTime;
        
        console.log('✅ Chat completion thành công!');
        console.log(`⏱️  Thời gian phản hồi: ${duration}ms\n`);
        console.log('📝 Response:');
        console.log(completion.choices[0].message.content);
        console.log('\n');
        
        return true;
    } catch (error) {
        console.error('❌ Lỗi khi test chat completion:');
        console.error(`   ${error.message}\n`);
        return false;
    }
}

/**
 * Test 3: Test chấm điểm câu hỏi tự luận
 */
async function testGrading() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 TEST 3: Chấm điểm câu hỏi tự luận');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const question = 'Giải thích khái niệm RESTful API là gì?';
    const correctAnswer = 'RESTful API là một kiến trúc web service sử dụng các phương thức HTTP (GET, POST, PUT, DELETE) để thực hiện các thao tác CRUD trên tài nguyên. Nó tuân theo các nguyên tắc REST (Representational State Transfer) như stateless, cacheable, và sử dụng URL để định danh tài nguyên.';
    const candidateAnswer = 'RESTful API là một cách thiết kế web service sử dụng HTTP methods như GET, POST để làm việc với dữ liệu. Nó dựa trên nguyên tắc REST và sử dụng URL để truy cập tài nguyên.';
    const maxScore = 10;
    
    console.log('📌 Câu hỏi:');
    console.log(`   ${question}\n`);
    console.log('✅ Đáp án đúng:');
    console.log(`   ${correctAnswer}\n`);
    console.log('📝 Đáp án của ứng viên:');
    console.log(`   ${candidateAnswer}\n`);
    
    const prompt = `Chấm điểm câu trả lời. CHỈ TRẢ VỀ JSON, KHÔNG CÓ TEXT NÀO KHÁC, KHÔNG CÓ REASONING TAGS.

CÂU HỎI: ${question}
ĐÁP ÁN ĐÚNG: ${correctAnswer}
ĐÁP ÁN HỌC SINH: ${candidateAnswer}
THANG ĐIỂM: ${maxScore} điểm

Trả về JSON này (copy chính xác format, chỉ thay số và text):
{"score":8,"comment":"Câu trả lời tốt, đúng ý chính nhưng thiếu một số chi tiết.","similarity":0.85}`;

    try {
        const startTime = Date.now();
        
        const completion = await openai.chat.completions.create({
            model: LM_STUDIO_MODEL,
            messages: [
                { role: 'system', content: 'Bạn là API endpoint trả về JSON. Bạn CHỈ trả về JSON object, KHÔNG có text, KHÔNG có reasoning, KHÔNG có markdown, KHÔNG có tags. Format: {"score":number,"comment":"string","similarity":number}' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3, // Thấp hơn để kết quả nhất quán hơn
            max_tokens: 500,
        });
        
        const duration = Date.now() - startTime;
        const responseText = completion.choices[0].message.content.trim();
        
        console.log('✅ Chấm điểm thành công!');
        console.log(`⏱️  Thời gian phản hồi: ${duration}ms\n`);
        console.log('📊 Kết quả:');
        
        // Parse JSON response
        const result = parseJSONFromResponse(responseText);
        
        if (result && typeof result === 'object' && 'score' in result) {
            console.log(`   Điểm số: ${result.score}/${maxScore}`);
            console.log(`   Độ tương đồng: ${(result.similarity * 100).toFixed(1)}%`);
            console.log(`   Nhận xét: ${result.comment}\n`);
            
            return {
                success: true,
                score: result.score,
                comment: result.comment,
                similarity: result.similarity,
                duration: duration
            };
        } else {
            console.log('⚠️  Không thể parse JSON, hiển thị raw response:');
            console.log(responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));
            console.log('\n');
            return {
                success: false,
                rawResponse: responseText,
                duration: duration
            };
        }
    } catch (error) {
        console.error('❌ Lỗi khi chấm điểm:');
        console.error(`   ${error.message}\n`);
        return { success: false, error: error.message };
    }
}

/**
 * Test 4: Test với nhiều câu hỏi khác nhau
 */
async function testMultipleQuestions() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📚 TEST 4: Chấm nhiều câu hỏi');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const testCases = [
        {
            question: 'Node.js là gì?',
            correctAnswer: 'Node.js là một runtime environment cho JavaScript chạy trên server-side, được xây dựng trên V8 engine của Chrome.',
            candidateAnswer: 'Node.js là môi trường chạy JavaScript trên server.',
            maxScore: 5
        },
        {
            question: 'Giải thích khái niệm Promise trong JavaScript.',
            correctAnswer: 'Promise là một object đại diện cho kết quả (thành công hoặc thất bại) của một thao tác bất đồng bộ. Nó có 3 trạng thái: pending, fulfilled, rejected. Promise giúp xử lý callback hell và làm code dễ đọc hơn với .then() và .catch().',
            candidateAnswer: 'Promise là cách xử lý bất đồng bộ trong JavaScript, giúp tránh callback hell.',
            maxScore: 10
        }
    ];
    
    const results = [];
    
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`\n📌 Câu hỏi ${i + 1}/${testCases.length}: ${testCase.question}`);
        
        const prompt = `Chấm điểm. CHỈ TRẢ VỀ JSON, KHÔNG CÓ TEXT NÀO KHÁC.

CÂU HỎI: ${testCase.question}
ĐÁP ÁN ĐÚNG: ${testCase.correctAnswer}
ĐÁP ÁN HỌC SINH: ${testCase.candidateAnswer}
THANG ĐIỂM: ${testCase.maxScore} điểm

Trả về: {"score":5,"comment":"Nhận xét ngắn gọn","similarity":0.8}`;

        try {
            const completion = await openai.chat.completions.create({
                model: LM_STUDIO_MODEL,
                messages: [
                    { role: 'system', content: 'Bạn là API endpoint trả về JSON. Bạn CHỈ trả về JSON object, KHÔNG có text, KHÔNG có reasoning, KHÔNG có markdown, KHÔNG có tags. Format: {"score":number,"comment":"string","similarity":number}' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 300,
            });
            
            const responseText = completion.choices[0].message.content.trim();
            const result = parseJSONFromResponse(responseText);
            
            if (result && typeof result === 'object' && 'score' in result) {
                console.log(`   ✅ Điểm: ${result.score}/${testCase.maxScore}`);
                results.push({ ...testCase, result });
            } else {
                console.log(`   ❌ Lỗi: Không thể parse JSON từ response`);
                results.push({ ...testCase, error: 'Parse JSON failed', rawResponse: responseText.substring(0, 200) });
            }
        } catch (error) {
            console.log(`   ❌ Lỗi: ${error.message}`);
            results.push({ ...testCase, error: error.message });
        }
    }
    
    console.log('\n📊 Tổng kết:');
    console.log(`   ✅ Thành công: ${results.filter(r => r.result).length}/${testCases.length}`);
    console.log(`   ❌ Thất bại: ${results.filter(r => r.error).length}/${testCases.length}\n`);
    
    return results;
}

/**
 * Test 5: Test performance với nhiều requests
 */
async function testPerformance() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚡ TEST 5: Test hiệu năng');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const numRequests = 3;
    const times = [];
    
    console.log(`🔄 Gửi ${numRequests} requests tuần tự...\n`);
    
    for (let i = 0; i < numRequests; i++) {
        try {
            const startTime = Date.now();
            await openai.chat.completions.create({
                model: LM_STUDIO_MODEL,
                messages: [
                    { role: 'user', content: `Câu hỏi test ${i + 1}: Giải thích ngắn gọn về JavaScript.` }
                ],
                max_tokens: 50,
            });
            const duration = Date.now() - startTime;
            times.push(duration);
            console.log(`   Request ${i + 1}: ${duration}ms`);
        } catch (error) {
            console.log(`   Request ${i + 1}: ❌ ${error.message}`);
        }
    }
    
    if (times.length > 0) {
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        
        console.log('\n📊 Thống kê:');
        console.log(`   ⏱️  Thời gian trung bình: ${avgTime.toFixed(0)}ms`);
        console.log(`   ⚡ Nhanh nhất: ${minTime}ms`);
        console.log(`   🐌 Chậm nhất: ${maxTime}ms\n`);
    }
}

/**
 * Chạy tất cả các tests
 */
async function runAllTests() {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║        TEST LM STUDIO SERVER - CHẤM ĐIỂM TỰ ĐỘNG         ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
    const results = {
        listModels: false,
        simpleChat: false,
        grading: null,
        multipleQuestions: null,
        performance: false
    };
    
    // Test 1: List models
    results.listModels = await testListModels();
    
    if (!results.listModels) {
        console.log('❌ Không thể kết nối với LM Studio server!');
        console.log('   Vui lòng kiểm tra:');
        console.log('   1. LM Studio server đã được bật chưa?');
        console.log(`   2. Server URL đúng chưa? (Hiện tại: ${LM_STUDIO_URL})`);
        console.log('   3. Port có bị chặn không?\n');
        return;
    }
    
    // Test 2: Simple chat
    results.simpleChat = await testSimpleChat();
    
    // Test 3: Grading
    results.grading = await testGrading();
    
    // Test 4: Multiple questions
    results.multipleQuestions = await testMultipleQuestions();
    
    // Test 5: Performance
    await testPerformance();
    
    // Tổng kết
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                    KẾT QUẢ TỔNG KẾT                        ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
    console.log(`✅ List Models: ${results.listModels ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Simple Chat: ${results.simpleChat ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Grading: ${results.grading?.success ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Multiple Questions: ${results.multipleQuestions ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Performance: PASS\n`);
    
    if (results.grading?.success) {
        console.log('🎉 LM Studio server hoạt động tốt và sẵn sàng chấm điểm!');
    } else {
        console.log('⚠️  Có một số vấn đề cần kiểm tra lại.');
    }
}

// Chạy tests
runAllTests().catch(error => {
    console.error('\n❌ Lỗi nghiêm trọng:');
    console.error(error);
    process.exit(1);
});


