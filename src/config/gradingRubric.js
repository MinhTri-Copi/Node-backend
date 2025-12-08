/**
 * RUBRIC CHẤM ĐIỂM CHO CÂU TỰ LUẬN
 * 
 * Rubric này được dùng cho:
 * 1. LLM khi chấm bài tự động
 * 2. Thầy/bạn khi chấm thủ công để tạo dữ liệu train
 * 3. ML model khi được train
 */

const GRADING_RUBRIC = {
    /**
     * Rubric cho câu tự luận ngắn / định nghĩa
     * Áp dụng cho các câu hỏi như: "HTML là gì?", "CSS dùng để làm gì?"
     */
    SHORT_ESSAY: {
        name: 'Tự luận ngắn / Định nghĩa',
        description: 'Câu hỏi yêu cầu định nghĩa, giải thích ngắn gọn một khái niệm',
        
        criteria: [
            {
                scoreRange: [8, 10], // 80-100%
                label: 'Đúng ý chính, đầy đủ',
                description: 'Trả lời đúng ý chính, đầy đủ thông tin, rõ ràng, có thể khác cách diễn đạt nhưng ý nghĩa đúng',
                examples: {
                    correct: [
                        'HTML là ngôn ngữ đánh dấu dùng để xây dựng cấu trúc trang web',
                        'HTML là ngôn ngữ markup để tạo cấu trúc website'
                    ],
                    incorrect: []
                },
                keywords: ['đúng ý', 'đầy đủ', 'rõ ràng', 'chính xác']
            },
            {
                scoreRange: [6, 7], // 60-70%
                label: 'Đúng ý nhưng thiếu 1 phần nhỏ',
                description: 'Trả lời đúng ý chính nhưng thiếu một số chi tiết quan trọng hoặc chưa đầy đủ',
                examples: {
                    correct: [
                        'HTML là ngôn ngữ đánh dấu',
                        'HTML dùng để xây dựng trang web'
                    ],
                    incorrect: []
                },
                keywords: ['đúng ý', 'thiếu chi tiết', 'chưa đầy đủ']
            },
            {
                scoreRange: [3, 5], // 30-50%
                label: 'Có nhắc đến đúng khái niệm nhưng mơ hồ',
                description: 'Có nhắc đến đúng từ khóa/khái niệm nhưng giải thích mơ hồ, không rõ ràng, hoặc chỉ đúng một phần nhỏ',
                examples: {
                    correct: [
                        'HTML là ngôn ngữ',
                        'HTML dùng cho web'
                    ],
                    incorrect: []
                },
                keywords: ['mơ hồ', 'không rõ ràng', 'chỉ đúng một phần']
            },
            {
                scoreRange: [0, 2], // 0-20%
                label: 'Lạc đề / Nói sai',
                description: 'Trả lời sai hoàn toàn, không liên quan đến câu hỏi, hoặc chỉ là các ký tự ngẫu nhiên',
                examples: {
                    correct: [],
                    incorrect: [
                        'HTML là ngôn ngữ lập trình',
                        'sdf', 'fd', 'abc'
                    ]
                },
                keywords: ['sai', 'lạc đề', 'không liên quan']
            }
        ],
        
        /**
         * Hàm chuyển đổi similarity score (0-1) thành điểm theo rubric
         */
        similarityToScore: (similarity, maxScore) => {
            if (similarity >= 0.8) {
                // 80-100% similarity → 8-10 điểm
                return Math.max(8, Math.min(10, similarity * 10)) * (maxScore / 10);
            } else if (similarity >= 0.6) {
                // 60-79% similarity → 6-7 điểm
                return Math.max(6, Math.min(7, similarity * 10)) * (maxScore / 10);
            } else if (similarity >= 0.3) {
                // 30-59% similarity → 3-5 điểm
                return Math.max(3, Math.min(5, similarity * 10)) * (maxScore / 10);
            } else {
                // < 30% similarity → 0-2 điểm
                return Math.max(0, Math.min(2, similarity * 10)) * (maxScore / 10);
            }
        }
    },
    
    /**
     * Rubric cho câu tự luận dài (nếu có trong tương lai)
     */
    LONG_ESSAY: {
        name: 'Tự luận dài',
        description: 'Câu hỏi yêu cầu giải thích chi tiết, phân tích, so sánh',
        // TODO: Implement later if needed
        criteria: []
    }
};

/**
 * Lấy rubric phù hợp dựa trên loại câu hỏi
 */
const getRubricForQuestion = (questionType, questionLength = 'trungbinh') => {
    if (questionType === 'tracnghiem') {
        return null; // Trắc nghiệm không cần rubric (chấm đúng/sai)
    }
    
    // Tự luận
    if (questionLength === 'dai') {
        return GRADING_RUBRIC.LONG_ESSAY;
    }
    
    // Mặc định: tự luận ngắn
    return GRADING_RUBRIC.SHORT_ESSAY;
};

/**
 * Tạo prompt cho LLM dựa trên rubric
 */
const createRubricPrompt = (rubric) => {
    if (!rubric) return '';
    
    let prompt = `\nRUBRIC CHẤM ĐIỂM:\n`;
    prompt += `${rubric.name}: ${rubric.description}\n\n`;
    
    rubric.criteria.forEach((criterion, idx) => {
        prompt += `${idx + 1}. ${criterion.label} (${criterion.scoreRange[0]}-${criterion.scoreRange[1]} điểm):\n`;
        prompt += `   ${criterion.description}\n`;
    });
    
    return prompt;
};

module.exports = {
    GRADING_RUBRIC,
    getRubricForQuestion,
    createRubricPrompt
};

